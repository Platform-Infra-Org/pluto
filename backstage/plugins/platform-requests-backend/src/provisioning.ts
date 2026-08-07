import {
  AuthService,
  LoggerService,
  UrlReaderService,
} from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { Request as PlatformRequest } from '@internal/plugin-platform-common';
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
}) {
  const { catalog, auth, urlReader, logger } = deps;

  const resolveResource = async (
    resourceName: string,
  ): Promise<ResolvedResource> => {
    try {
      const entity = await catalog.getEntityByRef(
        `resource:default/${resourceName}`,
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
      return { data, resourcePath, dataPath };
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
    let r: {
      data: Record<string, unknown>;
      resourcePath?: string;
      dataPath?: string;
      error?: string;
    } = { data: {} };
    let resources:
      | Array<{ name: string; path: string; dataPath: string; data: string }>
      | undefined;

    if (request.kind !== 'CREATE') {
      if (names?.length) {
        const resolved = await Promise.all(names.map(n => resolveResource(n)));
        // Refuse the whole batch rather than deleting one of its members with
        // an empty payload: a workflow that decommissions from `data` would
        // skip the real teardown and remove the files anyway, and report
        // success. A batch is all-or-nothing about *knowing what it is doing*,
        // even though it is not all-or-nothing about doing it.
        const bad = resolved
          .map((x, i) => (x.error ? `${names[i]} (${x.error})` : undefined))
          .filter(Boolean);
        if (bad.length) {
          throw new Error(
            `request ${request.id}: cannot resolve ${bad.length} of ${names.length} resources: ${bad.join('; ')}`,
          );
        }
        resources = names.map((name, i) => ({
          name,
          path: resolved[i].resourcePath ?? '',
          dataPath: resolved[i].dataPath ?? '',
          data: JSON.stringify(resolved[i].data ?? {}),
        }));
      } else {
        r = await resolveResource(request.resourceName);
        if (r.error) {
          throw new Error(`request ${request.id}: ${r.error}`);
        }
      }
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
      params: request.params ?? {},
      resourceData: r.data,
      resourcePath: r.resourcePath,
      resourceDataPath: r.dataPath,
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
