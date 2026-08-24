import {
  createFrontendModule,
  createTranslationMessages,
} from '@backstage/frontend-plugin-api';
import { TranslationBlueprint } from '@backstage/plugin-app-react';
import { scaffolderTranslationRef } from '@backstage/plugin-scaffolder';

const scaffolderMessages = createTranslationMessages({
  ref: scaffolderTranslationRef,
  messages: {
    'templateListPage.title': 'New Request',
    'templateListPage.pageTitle': 'New Request',
  },
});

export const scaffolderTranslationsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    TranslationBlueprint.make({
      params: { resource: scaffolderMessages },
    }),
  ],
});
