/** Deliberately constrained Scaffolder handoff for the local demo only.
 * This module is never exposed as an LLM/MCP tool.
 */
import type { McpClient } from './agent';
import { createHash } from 'node:crypto';
import { updateDraft, type RequestDraft } from './draft';
import { fingerprint, type DraftReview } from './review';

export const SUBMITTABLE_TEMPLATE = 'template:default/demo-resource';
export type SubmissionReceipt = {
  taskId: string;
  templateRef: string;
  submittedAt: string;
};
export type SubmissionChallenge = {
  token: string;
  fingerprint: string;
  templateRevision: string;
  expiresAt: number;
};

const asRecord = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const asArray = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** A template may be user-visible without being safe/eligible for AI submission.
 * Refuse template changes that introduce new fields, secrets, steps or actions.
 */
export function assertDemoSubmissionTemplate(entity: unknown): void {
  const e = asRecord(entity),
    meta = asRecord(e.metadata),
    spec = asRecord(e.spec);
  if (
    String(e.kind).toLowerCase() !== 'template' ||
    String(meta.name).toLowerCase() !== 'demo-resource' ||
    String(meta.namespace || 'default').toLowerCase() !== 'default'
  )
    throw new Error('Template is not eligible for AI submission');
  const params = asArray(spec.parameters);
  if (params.length !== 1) throw new Error('Unexpected form sections');
  const section = asRecord(params[0]),
    props = asRecord(section.properties);
  if (
    Object.keys(props).sort().join(',') !== 'region,resourceName,valuesFile' ||
    asArray(section.required).map(String).sort().join(',') !==
      'region,resourceName' ||
    asRecord(props.resourceName).type !== 'string' ||
    asRecord(props.region).type !== 'string' ||
    asRecord(props.region)['ui:field'] !== 'DynamicSelect' ||
    asRecord(props.valuesFile)['ui:field'] !== 'PlatformFile'
  )
    throw new Error('Unrecognized template form');
  const steps = asArray(spec.steps);
  if (steps.length !== 1) throw new Error('Unexpected Scaffolder steps');
  const step = asRecord(steps[0]),
    input = asRecord(step.input),
    taskParams = asRecord(input.params),
    argo = asRecord(input.argoSubmit);
  if (
    step.action !== 'platform:request:submit' ||
    input.kind !== 'CREATE' ||
    input.resourceType !== 'demo-resource' ||
    input.resourceName !== '${{ parameters.resourceName }}' ||
    taskParams.region !== '${{ parameters.region }}' ||
    argo.workflowTemplate !== 'git-ops' ||
    argo.entrypoint !== 'create' ||
    argo.namespace !== 'argo' ||
    input.secrets !== undefined
  )
    throw new Error('Template action is not the vetted demo request action');
}

/** Bind the browser confirmation to the precise catalog template revision. */
export function templateRevision(entity: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(asRecord(entity).spec ?? null))
    .digest('hex');
}

/** Always validate current schema AND live options before authorizing or submitting. */
export async function validateSubmissionDraft(
  mcp: McpClient,
  current: RequestDraft | undefined,
  review: DraftReview | undefined,
) {
  if (!current || current.templateRef !== SUBMITTABLE_TEMPLATE)
    throw new Error('Only the vetted Demo Resource template may be submitted');
  if (!review || fingerprint(current) !== review.fingerprint)
    throw new Error('The user must review this exact draft first');
  const draft = await updateDraft({
    mcp,
    current,
    templateRef: current.templateRef,
  });
  if (!draft.readyForReview || fingerprint(draft) !== review.fingerprint)
    throw new Error('Draft is not valid or current');
  if (Object.keys(draft.values).sort().join(',') !== 'region,resourceName')
    throw new Error('Unsupported fields cannot be submitted');
  if (
    typeof draft.values.resourceName !== 'string' ||
    typeof draft.values.region !== 'string'
  )
    throw new Error('Invalid draft values');
  return {
    draft,
    values: {
      resourceName: draft.values.resourceName,
      region: draft.values.region,
    },
  };
}

/** Use a freshly issued on-behalf-of Scaffolder plugin token at the callsite.
 * The Scaffolder itself checks taskCreatePermission and executes the real template.
 */
export async function createScaffolderTask({
  baseUrl,
  token,
  values,
  fetchImpl = fetch,
}: {
  baseUrl: string;
  token: string;
  values: { resourceName: string; region: string };
  fetchImpl?: typeof fetch;
}): Promise<string> {
  if (!token) throw new Error('Missing user-bound Scaffolder token');
  const url = new URL(baseUrl.replace(/\/$/, '') + '/v2/tasks');
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Invalid Scaffolder service URL');
  if (
    url.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    process.env.AI_CHAT_ALLOW_HTTP_DEV !== '1'
  )
    throw new Error('Scaffolder service requires HTTPS outside localhost');
  const response = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ templateRef: SUBMITTABLE_TEMPLATE, values }),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 201) {
    // Never expose upstream response body; it may include sensitive information.
    throw new Error(
      `Scaffolder submission rejected with HTTP ${response.status}`,
    );
  }
  const data: unknown = await response.json(),
    id = asRecord(data).id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(id))
    throw new Error('Scaffolder returned an invalid task identifier');
  return id;
}
