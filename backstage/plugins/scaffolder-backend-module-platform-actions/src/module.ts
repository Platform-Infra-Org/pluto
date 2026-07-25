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
        resourceType: z =>
          z.string().describe('Resource type; also the default WorkflowTemplate name.'),
        resourceName: z => z.string().describe('Name of the resource to act on.'),
        kind: z =>
          z
            .enum(['CREATE', 'UPDATE', 'DELETE'])
            .optional()
            .describe('Request verb. Default: CREATE.'),
        params: z =>
          z
            .record(z.any())
            .optional()
            .describe('Arbitrary parameters; exposed to argoSubmit tokens.'),
        argoSubmit: z =>
          z
            .object({
              namespace: z
                .string()
                .optional()
                .describe('Argo namespace to submit into. Default: platform.argo.namespace.'),
              resourceKind: z
                .enum(['WorkflowTemplate', 'ClusterWorkflowTemplate', 'CronWorkflow'])
                .optional()
                .describe('Argo resource kind. Default: WorkflowTemplate.'),
              workflowTemplate: z
                .string()
                .optional()
                .describe('Template name to submit. Default: resourceType.'),
              entrypoint: z.string().optional().describe('Override the template entrypoint.'),
              serviceAccount: z
                .string()
                .optional()
                .describe('Service account to run the workflow as.'),
              generateName: z
                .string()
                .optional()
                .describe('Prefix for the generated workflow name.'),
              parameters: z
                .record(z.string())
                .optional()
                .describe('Argo parameters (name -> value). Default: { request: paramsJson }.'),
              labels: z
                .record(z.string())
                .optional()
                .describe('Workflow labels (the request-id label is always added).'),
              annotations: z.record(z.string()).optional().describe('Workflow annotations.'),
            })
            .optional()
            .describe(
              'Full control over the Argo submit. String values support << token >> ' +
                'templating: requestId, resourceName, resourceType, requester, paramsJson, ' +
                'params.<field>. Omit for default behavior.',
            ),
      },
      output: {
        requestId: z => z.number().describe('Id of the created request.'),
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
