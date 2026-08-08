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
 * `['resource:default/bucket-a']` -> `['bucket-a']`.
 *
 * `MultiEntityPicker` yields entityRefs; the request model holds bare names,
 * because that is what `resolveResource` and the git-ops workflow take.
 */
export function resourceNamesFrom(refs: string[]): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const name = ref.includes('/') ? ref.split('/').pop()! : ref;
    const trimmed = name.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
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
        resourceName: z =>
          z
            .string()
            .optional()
            .describe('Name of the resource to act on. Required unless resourceNames is given.'),
        resourceNames: z =>
          z
            .array(z.string())
            .optional()
            .describe(
              'Bulk requests: every resource to act on. Accepts entityRefs ' +
                '(as MultiEntityPicker yields) or bare names. Mutually ' +
                'exclusive with resourceName.',
            ),
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
        resultOutput: z =>
          z
            .string()
            .optional()
            .describe(
              'Argo workflow output parameter to read on success — its value ' +
                'identifies the created resource (catalog name or URL), linked ' +
                'from the finished request.',
            ),
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
        secrets: z =>
          z
            .array(
              z.object({
                name: z.string().describe('Key inside the request Secret.'),
                source: z
                  .enum(['generate', 'provided'])
                  .describe(
                    'generate = backend mints it at approval; provided = supply `value`.',
                  ),
                length: z
                  .number()
                  .int()
                  .positive()
                  .optional()
                  .describe('generate: random byte length (default 24).'),
                value: z
                  .string()
                  .optional()
                  .describe(
                    'provided secrets: the value, wired from `${{ secrets.<x> }}` ' +
                      'so the Scaffolder redacts it from logs and stored task state.',
                  ),
              }),
            )
            .optional()
            .describe(
              'Secret fields materialised into the request Kubernetes Secret at ' +
                'approval — the value never lands in params, Argo, Git, or logs.',
            ),
      },
      output: {
        requestId: z => z.number().describe('Id of the created request.'),
      },
    },
    async handler(ctx) {
      const requester = actorName(ctx.user?.ref);
      const names = ctx.input.resourceNames?.length
        ? resourceNamesFrom(ctx.input.resourceNames)
        : undefined;
      if (Boolean(ctx.input.resourceName) === Boolean(names)) {
        throw new Error(
          'platform:request:submit: give exactly one of resourceName or resourceNames',
        );
      }
      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'platform-requests',
      });
      const baseUrl = await discovery.getBaseUrl('platform-requests');

      // Split the secret inputs into the (non-sensitive) spec and the plaintext
      // provided values. The backend encrypts the values on receipt; only the
      // spec is persisted here. A `provided` secret with no value is an optional
      // field the user left blank — drop it entirely (the Scaffolder form already
      // enforced any required ones, so an empty value here means "not supplied").
      const secrets = (ctx.input.secrets ?? []).filter(
        s => s.source === 'generate' || Boolean(s.value),
      );
      const secretSpec = secrets.map(s => ({
        name: s.name,
        source: s.source,
        ...(s.length ? { length: s.length } : {}),
      }));
      const secretValues: Record<string, string> = {};
      for (const s of secrets) {
        if (s.source === 'provided') secretValues[s.name] = s.value!;
      }

      const res = await fetch(`${baseUrl}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kind: ctx.input.kind ?? 'CREATE',
          resourceType: ctx.input.resourceType,
          ...(ctx.input.resourceName
            ? { resourceName: ctx.input.resourceName }
            : { resourceNames: names }),
          params: ctx.input.params ?? {},
          ...(ctx.input.argoSubmit ? { argoSubmit: ctx.input.argoSubmit } : {}),
          ...(ctx.input.resultOutput
            ? { resultOutput: ctx.input.resultOutput }
            : {}),
          ...(secretSpec.length
            ? { secretSpec, secretValues }
            : {}),
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
        `Created request #${created.id} for ${requester} (${ctx.input.resourceType}/${
          ctx.input.resourceName ?? `${names!.length} resources`
        })`,
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
