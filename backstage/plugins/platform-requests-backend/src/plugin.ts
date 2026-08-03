import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { notificationService } from '@backstage/plugin-notifications-node';
import { Request as PlatformRequest } from '@internal/plugin-platform-common';
import { createRouter } from './router';
import { RequestsStore } from './store';
import { ArgoClient } from './argo';
import { createNotifier } from './notifications';
import { createSecretStore } from './secretStore';
import { createCipher } from './crypto';
import { createResourceResolver, createSubmitWorkflow } from './provisioning';

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

        // Native Backstage notifications (approvers on new requests, requester
        // on decisions + terminal outcomes) — best-effort, see notifications.ts.
        const notify = createNotifier(notifications, logger);

        // Per-request Secret provisioning (docs/SECRETS-LIFECYCLE.md). Disabled
        // unless platform.secrets.enabled; then Kubernetes-backed.
        const secretStore = createSecretStore({ config, logger });
        // One key or a list; the first encrypts, the rest only open blobs from
        // before a rotation (see crypto.ts).
        const keyCfg = config.getOptional('platform.secrets.encryptionKey');
        const keys = Array.isArray(keyCfg)
          ? keyCfg.map(String)
          : [keyCfg].filter(k => typeof k === 'string');
        const cipher = createCipher(keys);

        const { resolveResource, resourceDataFor } = createResourceResolver({
          catalog,
          auth,
          urlReader,
          logger,
        });

        // On APPROVED the router calls this, then flips the request to IN_PROGRESS.
        const submitWorkflow = createSubmitWorkflow({
          argo,
          store,
          resolveResource,
          logger,
          secretStore,
          cipher,
        });

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
          const verbKeys: Record<string, string> = {
            UPDATE: 'platform.io/verb-update',
            DELETE: 'platform.io/verb-delete',
          };
          const key = verbKeys[kind];
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
            cipher,
            secretsEnabled: !!secretStore,
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

        // Safety-net sweep for orphaned/expired request Secrets (the happy path
        // is the Workflow ownerReference). Config-gated; off when secrets are.
        const sweepCfg = config.getOptionalConfig('platform.secrets.sweep');
        if (secretStore && (sweepCfg?.getOptionalBoolean('enabled') ?? true)) {
          const freqCfg = sweepCfg?.getOptionalConfig('frequency');
          const frequency = freqCfg
            ? {
                hours: freqCfg.getOptionalNumber('hours'),
                minutes: freqCfg.getOptionalNumber('minutes'),
                seconds: freqCfg.getOptionalNumber('seconds'),
              }
            : { minutes: 15 };
          const maxAgeMs =
            (sweepCfg?.getOptionalNumber('maxAgeHours') ?? 24) * 3600_000;
          await scheduler.scheduleTask({
            id: 'platform-requests-secret-sweep',
            frequency,
            timeout: { minutes: 2 },
            fn: async () => {
              // A Secret exists only for IN_PROGRESS requests (created at approval,
              // GC'd by the Workflow after). Anything else labelled ours is orphaned.
              const inProgress = await store.list({ state: 'IN_PROGRESS' });
              await secretStore.sweep({
                activeRequestIds: new Set(inProgress.map(r => r.id)),
                maxAgeMs,
              });
            },
          });
        }
      },
    });
  },
});
