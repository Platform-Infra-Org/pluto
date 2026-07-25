import {
  coreServices,
  createBackendModule,
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import {
  createTemplateAction,
  scaffolderActionsExtensionPoint,
} from '@backstage/plugin-scaffolder-node';

/** `user:default/requester` -> `requester`. */
function actorName(ref?: string): string {
  if (!ref) return 'unknown';
  return ref.split('/').pop()!.split(':')[0];
}

/**
 * `platform:request:submit` — the final step of every platform software template.
 * Creates a resource Request (PENDING_APPROVAL) in platform-requests, on behalf
 * of the initiating user. The Scaffolder task finishes immediately; the request
 * then tracks approval + the Argo workflow to completion.
 */
export function createRequestSubmitAction(services: {
  auth: AuthService;
  discovery: DiscoveryService;
}) {
  const { auth, discovery } = services;
  return createTemplateAction({
    id: 'platform:request:submit',
    description: 'Create a platform resource request (pending approval).',
    schema: {
      input: {
        resourceType: z => z.string(),
        resourceName: z => z.string(),
        kind: z => z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
        params: z => z.record(z.any()).optional(),
        argoSubmit: z => z.record(z.any()).optional(),
      },
      output: {
        requestId: z => z.number(),
      },
    },
    async handler(ctx) {
      const requester = actorName(ctx.user?.ref);
      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'platform-requests',
      });
      const baseUrl = await discovery.getBaseUrl('platform-requests');
      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kind: ctx.input.kind ?? 'CREATE',
          resourceType: ctx.input.resourceType,
          resourceName: ctx.input.resourceName,
          params: ctx.input.params ?? {},
          ...(ctx.input.argoSubmit ? { argoSubmit: ctx.input.argoSubmit } : {}),
          requester,
        }),
      });
      if (!res.ok) {
        throw new Error(
          `platform:request:submit failed: ${res.status} ${await res.text()}`,
        );
      }
      const created = (await res.json()) as { id: number };
      ctx.output('requestId', created.id);
      ctx.logger.info(
        `Created request #${created.id} for ${requester} (${ctx.input.resourceType}/${ctx.input.resourceName})`,
      );
    },
  });
}

export const scaffolderModulePlatformActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'platform-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        auth: coreServices.auth,
        discovery: coreServices.discovery,
      },
      async init({ scaffolderActions, auth, discovery }) {
        scaffolderActions.addActions(
          createRequestSubmitAction({ auth, discovery }),
        );
      },
    });
  },
});
