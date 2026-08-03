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
      if (!entity) return { data: {} };
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
            logger.warn(
              `resource-data ref '${ref}' for '${resourceName}' failed: ${e}`,
            );
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
      logger.warn(`resolveResource '${resourceName}' failed: ${e}`);
      return { data: {} };
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
    // data + the git paths of its files (for git-ops).
    const r =
      request.kind === 'CREATE'
        ? { data: {}, resourcePath: undefined, dataPath: undefined }
        : await resolveResource(request.resourceName);

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
