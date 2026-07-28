import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { notificationService } from '@backstage/plugin-notifications-node';
import { Request as PlatformRequest } from '@internal/plugin-platform-common';
import { parse as parseYaml } from 'yaml';
import { createRouter } from './router';
import { RequestsStore } from './store';
import { ArgoClient } from './argo';

/**
 * platformRequestsPlugin backend plugin
 *
 * @public
 */
export const platformRequestsPlugin = createBackendPlugin({
  pluginId: 'platform-requests',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
        urlReader: coreServices.urlReader,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        permissions: coreServices.permissions,
        scheduler: coreServices.scheduler,
        notifications: notificationService,
        userInfo: coreServices.userInfo,
        catalog: catalogServiceRef,
      },
      async init({
        logger,
        config,
        auth,
        discovery,
        urlReader,
        httpAuth,
        httpRouter,
        database,
        permissions,
        scheduler,
        notifications,
        userInfo,
        catalog,
      }) {
        const store = await RequestsStore.create(database);
        logger.info('platform-requests store initialized');

        const argo = new ArgoClient(
          {
            baseUrl:
              config.getOptionalString('platform.argo.baseUrl') ??
              'http://localhost:2746',
            namespace:
              config.getOptionalString('platform.argo.namespace') ?? 'argo',
            defaultTemplate:
              config.getOptionalString('platform.argo.defaultTemplate') ??
              'demo-resource',
            // If set, Argo calls route through the Backstage proxy at this path
            // (which injects the real argo-server auth). Unset = direct baseUrl.
            proxyPath: config.getOptionalString('platform.argo.proxyPath'),
          },
          logger,
          { discovery, auth },
        );

        // Native Backstage notifications: approvers on new requests, requester
        // on terminal outcomes. Never let a notification failure break the flow.
        const notify = {
          async approvalNeeded(r: { id: number; kind: string; resourceType: string; resourceName: string; requester: string }) {
            try {
              await notifications.send({
                recipients: { type: 'entity', entityRef: 'group:default/platform-admins' },
                payload: {
                  title: `Approval needed: ${r.kind} ${r.resourceType}/${r.resourceName}`,
                  description: `Requested by ${r.requester}`,
                  link: `/requests/${r.id}`,
                  severity: 'normal',
                },
              });
            } catch (e) {
              logger.warn(`notify approvalNeeded failed for ${r.id}: ${e}`);
            }
          },
          // Alert the requester when their request changes state after a
          // decision (approved → workflow running, or rejected).
          async decided(r: PlatformRequest) {
            const map: Record<string, { title: string; sev: 'normal' | 'high' } | undefined> = {
              IN_PROGRESS: { title: `Request #${r.id} approved — workflow running`, sev: 'normal' },
              REJECTED: { title: `Request #${r.id} was rejected`, sev: 'high' },
            };
            const m = map[r.state];
            if (!m) return; // still pending (e.g. partial N_OF_M) — no alert
            try {
              await notifications.send({
                recipients: { type: 'entity', entityRef: `user:default/${r.requester}` },
                payload: {
                  title: m.title,
                  description: `${r.resourceType}/${r.resourceName}`,
                  link: `/requests/${r.id}`,
                  severity: m.sev,
                },
              });
            } catch (e) {
              logger.warn(`notify decided failed for ${r.id}: ${e}`);
            }
          },
          async finished(
            r: { id: number; resourceType: string; resourceName: string; requester: string },
            ok: boolean,
            resultRef?: string,
          ) {
            try {
              await notifications.send({
                recipients: { type: 'entity', entityRef: `user:default/${r.requester}` },
                payload: {
                  title: `Request #${r.id} ${ok ? 'succeeded' : 'failed'}`,
                  description: resultRef
                    ? `${r.resourceType}/${r.resourceName} → ${resultRef}`
                    : `${r.resourceType}/${r.resourceName}`,
                  link: `/requests/${r.id}`,
                  severity: ok ? 'normal' : 'high',
                },
              });
            } catch (e) {
              logger.warn(`notify finished failed for ${r.id}: ${e}`);
            }
          },
        };

        // Repo path from a Gitea raw URL (.../raw/branch/<b>/<path> -> <path>).
        const gitPathOf = (url: string): string | undefined => {
          const m = url.match(/\/raw\/branch\/[^/]+\/(.+)$/);
          return m?.[1];
        };

        // Resolve a resource's data + the git paths of its files. The
        // `platform.io/resource-data` annotation is a ref (like techdocs-ref):
        // `url:<absolute>` fetches that URL, `dir:<relative>` (or a bare path)
        // resolves against the resource's own location. Data falls back to
        // `spec.resourceData`. The git paths let git-ops act on the actual
        // files regardless of the resource's layout (flat or subdir).
        const resolveResource = async (
          resourceName: string,
        ): Promise<{
          data: Record<string, unknown>;
          resourcePath?: string;
          dataPath?: string;
        }> => {
          try {
            const entity = await catalog.getEntityByRef(
              `resource:default/${resourceName}`,
              { credentials: await auth.getOwnServiceCredentials() },
            );
            if (!entity) return { data: {} };
            const loc = (
              entity.metadata.annotations?.['backstage.io/managed-by-location'] ??
              entity.metadata.annotations?.[
                'backstage.io/managed-by-origin-location'
              ]
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

        const resourceDataFor = async (resourceName: string) =>
          (await resolveResource(resourceName)).data;

        // On APPROVED the router calls this, then flips the request to IN_PROGRESS.
        const submitWorkflow = async (request: PlatformRequest) => {
          // CREATE has no existing resource yet; update/delete resolve the
          // resource's data + the git paths of its files (for git-ops).
          const r =
            request.kind === 'CREATE'
              ? { data: {}, resourcePath: undefined, dataPath: undefined }
              : await resolveResource(request.resourceName);
          const { name, namespace } = await argo.submitSpec(request.argoSubmit, {
            requestId: request.id,
            resourceName: request.resourceName,
            resourceType: request.resourceType,
            requester: request.requester,
            params: request.params ?? {},
            resourceData: r.data,
            resourcePath: r.resourcePath,
            resourceDataPath: r.dataPath,
          });
          await store.setWorkflow(request.id, { name, namespace });
          logger.info(
            `request ${request.id}: submitted workflow ${name} in ${namespace}`,
          );
        };

        // Which groups count as platform admins (configurable). An admin
        // bypasses the owning-team approval gate and sees all requests.
        const adminGroups =
          config.getOptionalStringArray('platform.rbac.adminGroups') ?? [
            'group:default/platform-admins',
          ];

        // The acting user's admin flag + raw group refs (per-team ownership),
        // both from their catalog ownership.
        const principalResolver = async (
          credentials: Parameters<typeof userInfo.getUserInfo>[0],
        ) => {
          try {
            const info = await userInfo.getUserInfo(credentials);
            const groups = info.ownershipEntityRefs;
            const isAdmin = groups.some(g => adminGroups.includes(g));
            return { isAdmin, groups };
          } catch {
            return { isAdmin: false, groups: [] };
          }
        };

        // The owning service team for a resourceType = the owner of the
        // Scaffolder Template that provides it (matched by a
        // `platform.io/resource-type` annotation, or by template name).
        const ownerResolver = async (
          resourceType: string,
        ): Promise<string | undefined> => {
          try {
            const { items } = await catalog.getEntities(
              { filter: { kind: 'template' } },
              { credentials: await auth.getOwnServiceCredentials() },
            );
            const tpl = items.find(
              t =>
                t.metadata.annotations?.['platform.io/resource-type'] ===
                  resourceType || t.metadata.name === resourceType,
            );
            const owner = tpl?.spec?.owner;
            return typeof owner === 'string' ? owner : undefined;
          } catch (e) {
            logger.warn(`ownerResolver failed for '${resourceType}': ${e}`);
            return undefined;
          }
        };

        // Per-verb Argo submit config for UPDATE/DELETE (create carries it in the
        // template's submit step). Read from the template's `platform.io/verb-*`
        // annotation (JSON: { argoSubmit, resultOutput }).
        const verbConfigResolver = async (
          resourceType: string,
          kind: string,
        ): Promise<
          { argoSubmit?: unknown; resultOutput?: string } | undefined
        > => {
          const key =
            kind === 'UPDATE'
              ? 'platform.io/verb-update'
              : kind === 'DELETE'
              ? 'platform.io/verb-delete'
              : undefined;
          if (!key) return undefined;
          try {
            const { items } = await catalog.getEntities(
              { filter: { kind: 'template' } },
              { credentials: await auth.getOwnServiceCredentials() },
            );
            const tpl = items.find(
              t =>
                t.metadata.annotations?.['platform.io/resource-type'] ===
                  resourceType || t.metadata.name === resourceType,
            );
            const raw = tpl?.metadata.annotations?.[key];
            if (!raw) return undefined;
            const parsed = JSON.parse(raw);
            return {
              argoSubmit: parsed.argoSubmit,
              resultOutput: parsed.resultOutput,
            };
          } catch (e) {
            logger.warn(
              `verbConfigResolver failed for '${resourceType}'/${kind}: ${e}`,
            );
            return undefined;
          }
        };

        httpRouter.use(
          await createRouter({
            httpAuth,
            permissions,
            store,
            submitWorkflow,
            onCreated: notify.approvalNeeded,
            onDecided: notify.decided,
            workflowNodesFor: (name, namespace) => argo.nodesFor(name, namespace),
            principalResolver,
            ownerResolver,
            verbConfigResolver,
            resourceDataFor,
          }),
        );

        // Read the configured output parameter off a request's finished workflow.
        const readResult = async (
          r: PlatformRequest,
        ): Promise<string | undefined> => {
          if (!r.resultOutput || !r.workflowName) return undefined;
          try {
            const outs = await argo.outputsFor(r.workflowName, r.workflowNamespace);
            return outs[r.resultOutput];
          } catch (e) {
            logger.warn(`readResult failed for request ${r.id}: ${e}`);
            return undefined;
          }
        };

        // Poll Argo and mirror workflow phase onto IN_PROGRESS requests; a request
        // is only SUCCEEDED once its workflow Succeeds (completion gating).
        await scheduler.scheduleTask({
          id: 'platform-requests-argo-poll',
          frequency: { seconds: 5 },
          timeout: { seconds: 30 },
          fn: async () => {
            const inProgress = await store.list({ state: 'IN_PROGRESS' });
            for (const r of inProgress) {
              try {
                const { phase, message } = await argo.statusFor(
                  r.id,
                  r.workflowNamespace,
                );
                if (!phase) continue;
                await store.setWorkflow(r.id, { phase });
                if (phase === 'Succeeded') {
                  // The workflow is the sole Git writer — it created/updated/
                  // deleted the resource in the catalog repo itself.
                  // Read the configured output → the created resource ref/URL.
                  const resultRef = await readResult(r);
                  if (resultRef) await store.setResult(r.id, resultRef);
                  await store.setState(r.id, 'SUCCEEDED');
                  await notify.finished(r, true, resultRef);
                  logger.info(
                    `request ${r.id}: workflow succeeded${
                      resultRef ? ` → ${resultRef}` : ''
                    }`,
                  );
                } else if (phase === 'Failed' || phase === 'Error') {
                  await store.setWorkflow(r.id, { error: message });
                  await store.setState(r.id, 'FAILED');
                  await notify.finished(r, false);
                  logger.info(`request ${r.id}: workflow ${phase}`);
                }
              } catch (e) {
                logger.warn(`poll failed for request ${r.id}: ${e}`);
              }
            }

            // Backfill: succeeded requests whose result output wasn't read yet
            // (e.g. a transient miss) — retry while the workflow still exists.
            // ponytail: naive full scan of SUCCEEDED; fine at this scale.
            const succeeded = await store.list({ state: 'SUCCEEDED' });
            for (const r of succeeded) {
              if (!r.resultOutput || r.resultRef) continue;
              const ref = await readResult(r);
              if (ref) {
                await store.setResult(r.id, ref);
                logger.info(`request ${r.id}: backfilled result → ${ref}`);
              }
            }
          },
        });
      },
    });
  },
});
