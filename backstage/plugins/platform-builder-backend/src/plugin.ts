import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { Publisher } from './publisher';

/**
 * platformBuilderPlugin backend plugin — generates + publishes a Scaffolder
 * template and Argo WorkflowTemplate from a service definition.
 *
 * @public
 */
export const platformBuilderPlugin = createBackendPlugin({
  pluginId: 'platform-builder',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpAuth, httpRouter, logger, config }) {
        const publisher = new Publisher(
          {
            giteaBaseUrl:
              config.getOptionalString('platform.builder.gitea.baseUrl') ??
              'http://localhost:3001',
            giteaUser:
              config.getOptionalString('platform.builder.gitea.user') ??
              'platform',
            giteaPassword:
              config.getOptionalString('platform.builder.gitea.password') ??
              'platform',
            owner:
              config.getOptionalString('platform.builder.gitea.owner') ??
              'platform',
            repo:
              config.getOptionalString('platform.builder.gitea.repo') ??
              'software-templates',
            argoBaseUrl:
              config.getOptionalString('platform.argo.baseUrl') ??
              'http://localhost:2746',
            argoNamespace:
              config.getOptionalString('platform.argo.namespace') ?? 'argo',
          },
          logger,
        );

        httpRouter.use(await createRouter({ httpAuth, publisher }));
      },
    });
  },
});
