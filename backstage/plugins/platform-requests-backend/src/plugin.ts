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
import { CatalogWriter } from './catalogWriter';

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
          },
          logger,
        );

        const catalogWriter = new CatalogWriter(
          {
            giteaBaseUrl:
              config.getOptionalString('platform.catalog.gitea.baseUrl') ??
              'http://localhost:3001',
            user:
              config.getOptionalString('platform.catalog.gitea.user') ??
              'platform',
            password:
              config.getOptionalString('platform.catalog.gitea.password') ??
              'platform',
            owner:
              config.getOptionalString('platform.catalog.gitea.owner') ??
              'platform',
            repo:
              config.getOptionalString('platform.catalog.gitea.repo') ??
              'catalog',
          },
          logger,
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
          async finished(r: { id: number; resourceType: string; resourceName: string; requester: string }, ok: boolean) {
            try {
              await notifications.send({
                recipients: { type: 'entity', entityRef: `user:default/${r.requester}` },
                payload: {
                  title: `Request #${r.id} ${ok ? 'succeeded' : 'failed'}`,
                  description: `${r.resourceType}/${r.resourceName}`,
                  link: `/requests/${r.id}`,
                  severity: ok ? 'normal' : 'high',
                },
              });
            } catch (e) {
              logger.warn(`notify finished failed for ${r.id}: ${e}`);
            }
          },
        };

        // On APPROVED the router calls this, then flips the request to IN_PROGRESS.
        const submitWorkflow = async (request: PlatformRequest) => {
          const { name, namespace } = await argo.submitSpec(request.argoSubmit, {
            requestId: request.id,
            resourceName: request.resourceName,
            resourceType: request.resourceType,
            requester: request.requester,
            params: request.params ?? {},
          });
          await store.setWorkflow(request.id, { name, namespace });
          logger.info(
            `request ${request.id}: submitted workflow ${name} in ${namespace}`,
          );
        };

        // The acting user's platform roles (admin bypass) + raw group refs
        // (per-team ownership), both from their catalog ownership.
        const GROUP_ROLE: Record<string, string> = {
          'group:default/platform-admins': 'platform-admin',
          'group:default/platform-auditors': 'auditor',
        };
        const principalResolver = async (
          credentials: Parameters<typeof userInfo.getUserInfo>[0],
        ) => {
          try {
            const info = await userInfo.getUserInfo(credentials);
            const groups = info.ownershipEntityRefs;
            const roles = groups
              .map(ref => GROUP_ROLE[ref])
              .filter((r): r is string => Boolean(r));
            return { roles, groups };
          } catch {
            return { roles: [], groups: [] };
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

        httpRouter.use(
          await createRouter({
            httpAuth,
            permissions,
            store,
            submitWorkflow,
            onCreated: notify.approvalNeeded,
            workflowNodesFor: (name, namespace) => argo.nodesFor(name, namespace),
            principalResolver,
            ownerResolver,
          }),
        );

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
                  // Apply the result to the catalog repo (edit/delete).
                  try {
                    if (r.kind === 'DELETE') {
                      await catalogWriter.deleteResource(r.resourceName);
                    } else if (r.kind === 'UPDATE') {
                      await catalogWriter.updateResource(r.resourceName, r.params);
                    }
                  } catch (e) {
                    logger.warn(`catalog write failed for request ${r.id}: ${e}`);
                  }
                  await store.setState(r.id, 'SUCCEEDED');
                  await notify.finished(r, true);
                  logger.info(`request ${r.id}: workflow succeeded`);
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
          },
        });
      },
    });
  },
});
