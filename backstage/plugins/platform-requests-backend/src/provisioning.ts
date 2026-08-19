import {
  AuthService,
  LoggerService,
  UrlReaderService,
} from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import {
  DEFAULT_NAMESPACE,
  Request as PlatformRequest,
  resourceRef,
} from '@internal/plugin-platform-common';
import { parse as parseYaml } from 'yaml';
import { ArgoClient } from './argo';
import { RequestsStore } from './store';
import { SecretStore } from './secretStore';
import { Cipher, generateSecret } from './crypto';

/** A resource's data plus where its files live in Git (for git-ops). */
export interface ResolvedResource {
  data: Record<string, unknown>;
  resourcePath?: string;
  dataPath?: string;
  /**
   * The resource's own `spec.owner`, verbatim.
   *
   * Not the same thing as the request's `<< ownerGroup >>`: that is the team
   * that owns the *template*, and is who may approve. This is who owns the
   * resource being acted on, which is what a workflow needs to notify, tag or
   * charge per resource in a batch that may span owners.
   */
  owner?: string;
  /**
   * The catalog entity itself, for `<< entityJson >>` / `<< entity.<path> >>`.
   * Kept whole rather than cherry-picked so a template can reach a field the
   * named tokens never anticipated, without a backend change.
   */
  entity?: Record<string, unknown>;
  /**
   * Why this resource could not be resolved, when it could not.
   *
   * Absent means resolved — including resolved to genuinely empty data, which
   * is a legitimate state and must stay distinguishable from failure. A caller
   * that acts destructively on `data` has to be able to tell the difference:
   * an empty payload from a *failed* read makes a decommission step silently
   * do nothing while the files are removed anyway.
   */
  error?: string;
}

/** Repo path from a Gitea raw URL (.../raw/branch/<b>/<path> -> <path>). */
const gitPathOf = (url: string): string | undefined =>
  url.match(/\/raw\/branch\/[^/]+\/(.+)$/)?.[1];

/**
 * Resolves a resource's data + the git paths of its files. The
 * `platform.io/resource-data` annotation is a ref (like techdocs-ref):
 * `url:<absolute>` fetches that URL, `dir:<relative>` (or a bare path) resolves
 * against the resource's own location. Data falls back to `spec.resourceData`.
 * The git paths let git-ops act on the actual files regardless of the
 * resource's layout (flat or subdir).
 */
export function createResourceResolver(deps: {
  catalog: CatalogService;
  auth: AuthService;
  urlReader: UrlReaderService;
  logger: LoggerService;
  /** Catalog namespace resources are ingested into; `default` unless configured. */
  namespace?: string;
}) {
  const {
    catalog,
    auth,
    urlReader,
    logger,
    namespace = DEFAULT_NAMESPACE,
  } = deps;

  const resolveResource = async (
    resourceName: string,
  ): Promise<ResolvedResource> => {
    try {
      const entity = await catalog.getEntityByRef(
        resourceRef(namespace, resourceName),
        { credentials: await auth.getOwnServiceCredentials() },
      );
      if (!entity) {
        return {
          data: {},
          error: `resource '${resourceName}' not found in the catalog`,
        };
      }
      const loc = (
        entity.metadata.annotations?.['backstage.io/managed-by-location'] ??
        entity.metadata.annotations?.['backstage.io/managed-by-origin-location']
      )?.replace(/^url:/, '');
      const resourcePath = loc ? gitPathOf(loc) : undefined;

      const ref = entity.metadata.annotations?.['platform.io/resource-data'];
      let data: Record<string, unknown> = {};
      let dataPath: string | undefined;
      if (ref) {
        let url: string | undefined;
        if (ref.startsWith('url:')) {
          url = ref.slice('url:'.length);
        } else if (loc) {
          const rel = ref.startsWith('dir:') ? ref.slice('dir:'.length) : ref;
          url = new URL(rel, loc).toString();
        }
        if (url) {
          dataPath = gitPathOf(url);
          try {
            const read = await urlReader.readUrl(url);
            const text = (await read.buffer()).toString('utf8');
            const parsed = parseYaml(text); // yaml.parse handles JSON too
            if (parsed && typeof parsed === 'object') {
              data = parsed as Record<string, unknown>;
            }
          } catch (e) {
            // A declared ref that cannot be read is a failure, not an empty
            // resource — and deliberately does not fall through to
            // `spec.resourceData`, which would mask it.
            const error = `resource-data ref '${ref}' for '${resourceName}' is unreadable: ${e}`;
            logger.warn(error);
            return { data: {}, resourcePath, dataPath, error };
          }
        }
      }
      if (!Object.keys(data).length) {
        const sd = (entity.spec as { resourceData?: unknown } | undefined)
          ?.resourceData;
        if (sd && typeof sd === 'object') {
          data = sd as Record<string, unknown>;
        }
      }
      return {
        data,
        resourcePath,
        dataPath,
        owner: (entity.spec as { owner?: string } | undefined)?.owner,
        entity: entity as unknown as Record<string, unknown>,
      };
    } catch (e) {
      const error = `resolveResource '${resourceName}' failed: ${e}`;
      logger.warn(error);
      return { data: {}, error };
    }
  };

  return {
    resolveResource,
    resourceDataFor: async (resourceName: string) =>
      (await resolveResource(resourceName)).data,
  };
}

/**
 * The APPROVED hook: submit the request's Argo workflow, record it, and — when
 * the request carries a secretSpec — create the per-request Kubernetes Secret
 * owned by that workflow. The router calls this, then flips the request to
 * IN_PROGRESS. See TechDocs: Explanation -> Secret lifecycle for the ordering constraint.
 */
export function createSubmitWorkflow(deps: {
  argo: ArgoClient;
  store: RequestsStore;
  resolveResource: (resourceName: string) => Promise<ResolvedResource>;
  logger: LoggerService;
  /** Absent when platform.secrets is disabled. */
  secretStore?: SecretStore;
  /** Absent when no encryption key is configured. */
  cipher?: Cipher;
}) {
  const { argo, store, resolveResource, logger, secretStore, cipher } = deps;

  return async (request: PlatformRequest) => {
    // CREATE has no existing resource yet; update/delete resolve the resource's
    // data + the git paths of its files (for git-ops). A bulk request resolves
    // every name it holds.
    const names = request.resourceNames;
    let r: ResolvedResource = { data: {} };
    let resources:
      | Array<{
          name: string;
          path: string;
          dataPath: string;
          data: Record<string, unknown>;
          owner: string;
          title: string;
        }>
      | undefined;

    if (request.kind !== 'CREATE') {
      // One resource is a batch of one. Resolving both through the same path is
      // what lets a template use `<< resourcesJson >>` for single and bulk
      // alike — otherwise the delete button and the bulk delete send different
      // shapes and every workflow has to exist twice.
      const all = names?.length ? names : [request.resourceName];
      const resolved = await Promise.all(all.map(n => resolveResource(n)));

      // Refuse the whole batch rather than deleting one of its members with
      // an empty payload: a workflow that decommissions from `data` would
      // skip the real teardown and remove the files anyway, and report
      // success. A batch is all-or-nothing about *knowing what it is doing*,
      // even though it is not all-or-nothing about doing it.
      const bad = resolved
        .map((x, i) => (x.error ? `${all[i]} (${x.error})` : undefined))
        .filter(Boolean);
      if (bad.length) {
        // A single resource keeps its own sentence: "cannot resolve 1 of 1"
        // reads as a batch failure and sends the reader looking for the batch.
        throw new Error(
          all.length === 1
            ? `request ${request.id}: ${resolved[0].error}`
            : `request ${request.id}: cannot resolve ${bad.length} of ${all.length} resources: ${bad.join('; ')}`,
        );
      }

      resources = all.map((name, i) => ({
        name,
        path: resolved[i].resourcePath ?? '',
        dataPath: resolved[i].dataPath ?? '',
        data: resolved[i].data ?? {},
        // '' rather than absent, so every element has the same shape and a
        // workflow can read `{{item.owner}}` without a conditional.
        owner: resolved[i].owner ?? '',
        // Read off the entity we already resolved — no second catalog call.
        // Display text only: `name` above stays the resolution key, because a
        // title is neither unique nor what the catalog is keyed on.
        // `entity` is Record<string, unknown> here, so metadata is narrowed at
        // the read rather than widening the whole resolver's type for one field.
        title:
          (resolved[i].entity?.metadata as { title?: string } | undefined)
            ?.title ?? '',
      }));
      // The scalar tokens stay populated from the first (and, for a single
      // request, only) resource, so `<< resourceData >>`, `<< resourcePath >>`
      // and `<< resourceDataPath >>` keep working for every template that
      // already uses them — verb-update among them. Nothing has to migrate.
      r = resolved[0];
    }

    // Secret name is generated up-front so the workflow can secretKeyRef it (as
    // << secretName >>); the Secret itself is created just after submit, owned
    // by the Workflow.
    const needsSecret = !!request.secretSpec?.length;
    if (needsSecret && !secretStore) {
      throw new Error(
        `request ${request.id} needs secrets but platform.secrets is disabled`,
      );
    }
    const secretName =
      needsSecret && secretStore ? secretStore.newName(request.id) : undefined;

    const { name, namespace, uid } = await argo.submitSpec(request.argoSubmit, {
      requestId: request.id,
      resourceName: request.resourceName,
      resourceType: request.resourceType,
      requester: request.requester,
      ownerGroup: request.ownerGroup,
      params: request.params ?? {},
      resourceData: r.data,
      resourcePath: r.resourcePath,
      resourceDataPath: r.dataPath,
      // Like the other scalar tokens: the first (and, for a single request,
      // only) resource. Deliberately not added to `resourcesJson` — a whole
      // entity per element would bloat every bulk workflow's parameters for a
      // field almost no template reads. Add it there when one actually does.
      entity: r.entity,
      resources,
      secretName,
    });
    await store.setWorkflow(request.id, { name, namespace });
    logger.info(
      `request ${request.id}: submitted workflow ${name} in ${namespace}`,
    );

    if (!needsSecret || !secretName || !secretStore) return;

    if (!uid) {
      throw new Error(
        `request ${request.id}: Argo returned no workflow uid; cannot own the Secret`,
      );
    }
    // Generated values are minted now; provided values are decrypted from the
    // held blob. Neither is ever logged.
    const data: Record<string, string> = {};
    for (const f of request.secretSpec!) {
      if (f.source === 'generate') data[f.name] = generateSecret(f.length);
    }
    const enc = await store.getSecretEnc(request.id);
    if (enc) {
      if (!cipher) {
        throw new Error(
          `request ${request.id} holds an encrypted secret but ` +
            'platform.secrets.encryptionKey is unset',
        );
      }
      Object.assign(data, JSON.parse(cipher.decrypt(enc)));
    }

    await secretStore.create({
      name: secretName,
      requestId: request.id,
      data,
      owner: { name, uid },
    });
    await store.setSecretName(request.id, secretName);
    await store.clearSecretEnc(request.id); // blob consumed
  };
}
