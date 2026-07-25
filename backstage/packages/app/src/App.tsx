import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import platformRequestsPlugin from '@internal/plugin-platform-requests';
import { navModule } from './modules/nav';
import { authModule } from './modules/auth';
import { themeModule } from './modules/theme';

export default createApp({
  features: [
    catalogPlugin,
    platformRequestsPlugin,
    navModule,
    authModule,
    themeModule,
  ],
});
