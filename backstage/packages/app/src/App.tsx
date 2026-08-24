import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import techdocsPlugin from '@backstage/plugin-techdocs/alpha';
import platformRequestsPlugin, {
  platformRelationsCardModule,
} from '@internal/plugin-platform-requests';
import {
  platformUiModule,
  platformScaffolderFieldsModule,
  setBrandingImages,
} from '@internal/plugin-platform-ui';
import { BRANDING_IMAGES } from './branding';
import { authModule } from './modules/auth';
import { scaffolderTranslationsModule } from './modules/scaffolderTranslations';

// Images bundled from src/branding, handed to the UI plugin; config decides
// which subfolder becomes the template card headers.
setBrandingImages(BRANDING_IMAGES);

export default createApp({
  features: [
    catalogPlugin,
    // Docs-like-code: renders each entity's Markdown docs (Docs tab + /docs).
    techdocsPlugin,
    platformRequestsPlugin,
    // One plugin: shadcn theme + global styles + color picker + custom nav.
    platformUiModule,
    // Registers the DynamicSelect scaffolder field (ui:field: DynamicSelect).
    platformScaffolderFieldsModule,
    // Our shadcn React Flow relations graph card (replaces catalog-graph's).
    platformRelationsCardModule,
    // Override scaffolder page heading to "New Request".
    scaffolderTranslationsModule,
    authModule,
  ],
});
