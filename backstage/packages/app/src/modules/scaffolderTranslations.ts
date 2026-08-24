import { createTranslationMessages } from '@backstage/frontend-plugin-api';
import { scaffolderTranslationRef } from '@backstage/plugin-scaffolder';

export const scaffolderTranslationsModule = createTranslationMessages({
  ref: scaffolderTranslationRef,
  messages: {
    'templateListPage.title': 'New Request',
    'templateListPage.pageTitle': 'New Request',
  },
});
