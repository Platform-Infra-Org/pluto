import {
  AppRootElementBlueprint,
  SubPageBlueprint,
  createFrontendModule,
} from '@backstage/frontend-plugin-api';
import { AiChatShell } from './AiChatShell';

/** No PageBlueprint, so AI does not create a sidebar tab or /ai route. */
const floatingChat = AppRootElementBlueprint.make({
  name: 'floating-ai-chat',
  params: { element: <AiChatShell /> },
});
const settings = SubPageBlueprint.make({
  name: 'ai-chat-settings',
  attachTo: { id: 'page:user-settings', input: 'pages' },
  params: {
    path: 'ai-chat',
    title: 'AI Chat',
    loader: async () => {
      const { AiChatSettingsPage } = await import('./AiChatSettingsPage');
      return <AiChatSettingsPage />;
    },
  },
});
export const aiChatUiModule = createFrontendModule({
  pluginId: 'app',
  extensions: [floatingChat, settings],
});
