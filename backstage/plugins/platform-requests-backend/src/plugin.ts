import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { RequestsStore } from './store';

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
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        database: coreServices.database,
        permissions: coreServices.permissions,
      },
      async init({ logger, httpAuth, httpRouter, database, permissions }) {
        const store = await RequestsStore.create(database);
        logger.info('platform-requests store initialized');
        httpRouter.use(await createRouter({ httpAuth, permissions, store }));
      },
    });
  },
});
