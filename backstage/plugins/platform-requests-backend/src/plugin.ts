import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
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
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        permissions: coreServices.permissions,
        scheduler: coreServices.scheduler,
      },
      async init({
        logger,
        config,
        httpAuth,
        httpRouter,
        database,
        permissions,
        scheduler,
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

        // On APPROVED the router calls this, then flips the request to IN_PROGRESS.
        const submitWorkflow = async (request: {
          id: number;
          resourceType: string;
          params: Record<string, unknown>;
        }) => {
          const name = await argo.submit(
            request.resourceType,
            request.id,
            JSON.stringify(request.params ?? {}),
          );
          await store.setWorkflow(request.id, { name });
          logger.info(`request ${request.id}: submitted workflow ${name}`);
        };

        httpRouter.use(
          await createRouter({ httpAuth, permissions, store, submitWorkflow }),
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
                const { phase, message } = await argo.statusFor(r.id);
                if (!phase) continue;
                await store.setWorkflow(r.id, { phase });
                if (phase === 'Succeeded') {
                  await store.setState(r.id, 'SUCCEEDED');
                  logger.info(`request ${r.id}: workflow succeeded`);
                } else if (phase === 'Failed' || phase === 'Error') {
                  await store.setWorkflow(r.id, { error: message });
                  await store.setState(r.id, 'FAILED');
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
