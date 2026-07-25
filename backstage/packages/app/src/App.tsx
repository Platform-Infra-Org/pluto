import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import platformRequestsPlugin from '@internal/plugin-platform-requests';
import platformBuilderPlugin from '@internal/plugin-platform-builder';
import { platformUiModule } from '@internal/plugin-platform-ui';
import { authModule } from './modules/auth';

export default createApp({
  features: [
    catalogPlugin,
    platformRequestsPlugin,
    platformBuilderPlugin,
    // One plugin: shadcn theme + global styles + color picker + custom nav.
    platformUiModule,
    authModule,
  ],
});
