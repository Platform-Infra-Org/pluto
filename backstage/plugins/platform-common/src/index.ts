/**
 * Shared types for the platform plugin suite.
 *
 * @packageDocumentation
 */

/** Lifecycle states of a resource request. */
export type RequestState =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  /** Nobody decided it in time. Terminal; set by the retention task. */
  | 'EXPIRED';

/** The verb a request performs against a resource. */
export type RequestKind = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * How many approvals a request needs (all subject to the owning-team gate:
 * only an admin or a member of the request's owning team may approve).
 * - `SINGLE`: one approval.
 * - `N_OF_M`: `n` distinct approvals.
 */
export type ApprovalPolicy =
  | { mode: 'SINGLE' }
  | { mode: 'N_OF_M'; n: number };

/** A single approve/reject decision recorded against a request. */
export interface Approval {
  approver: string;
  decision: 'approve' | 'reject';
  note?: string;
  at: string;
}

/**
 * Fully describes what a request submits to Argo's
 * `POST /api/v1/workflows/{namespace}/submit`. All string values support
 * `<< token >>` templating (tokens: requestId, resourceName, resourceType,
 * requester, paramsJson, params.<field>), resolved by the backend at submit
 * time. The `<< >>` delimiter is distinct from Scaffolder's `${{ }}`, so no
 * escaping is needed in a template. Absent = default behavior.
 */
export interface ArgoSubmitSpec {
  /** default: platform.argo.namespace ('argo') */
  namespace?: string;
  /** 'WorkflowTemplate' (default) | 'ClusterWorkflowTemplate' | 'CronWorkflow' */
  resourceKind?: string;
  /** template name; default: resourceType */
  workflowTemplate?: string;
  entrypoint?: string;
  serviceAccount?: string;
  /** Argo parameters (name -> value); default { request: '${{ paramsJson }}' } */
  parameters?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  generateName?: string;
}

/**
 * A secret field a request needs materialised into its Kubernetes Secret at
 * approval. `generate` = the backend mints the value at approval (never captured
 * from the user); `provided` = the user supplied it at submit (held
 * envelope-encrypted until approval). See TechDocs: Explanation -> Secret lifecycle.
 */
export interface SecretFieldSpec {
  /** Key inside the request's Secret (what the WorkflowTemplate secretKeyRefs). */
  name: string;
  source: 'generate' | 'provided';
  /** Generated secrets only: random byte length before base64url (default 24). */
  length?: number;
}

/** A resource request tracked through approval + workflow execution. */
export interface Request {
  id: number;
  kind: RequestKind;
  resourceType: string;
  resourceName: string;
  params: Record<string, unknown>;
  state: RequestState;
  policy: ApprovalPolicy;
  requester: string;
  approvals: Approval[];
  /**
   * The owning service team (a group entityRef), resolved at creation from the
   * owner of the Scaffolder Template for this resourceType. Only a member of
   * this group (the service owner) — or an admin — may approve/reject. Absent
   * when no owning template was found (then only admins can decide).
   */
  ownerGroup?: string;
  /** Per-request Argo submit spec; absent = default behavior. */
  argoSubmit?: ArgoSubmitSpec;
  /**
   * Name of the Argo workflow **output parameter** to read when the workflow
   * succeeds — its value identifies the created resource (a catalog name or a
   * URL). Stored back as `resultRef` and linked from the request.
   */
  resultOutput?: string;
  /** The value read from `resultOutput` on success (created resource ref/URL). */
  resultRef?: string;
  /** Argo workflow name once submitted (P2). */
  workflowName?: string;
  /** Namespace the workflow was submitted into (for status/nodes queries). */
  workflowNamespace?: string;
  /** Argo workflow phase mirrored onto the request (P2). */
  workflowPhase?: string;
  /** Error message when the request FAILED. */
  error?: string;
  /**
   * Secret fields this request materialises into a Kubernetes Secret at approval.
   * The encrypted values (for `provided` fields) live in a private DB column that
   * is **never** part of this DTO — the UI only ever sees field names/sources.
   */
  secretSpec?: SecretFieldSpec[];
  /** Name of the per-request Kubernetes Secret, once created at approval. */
  secretName?: string;
  createdAt: string;
  updatedAt: string;
}

/** Body accepted by `POST /requests`. */
export interface NewRequest {
  kind: RequestKind;
  resourceType: string;
  resourceName: string;
  params?: Record<string, unknown>;
  policy?: ApprovalPolicy;
  argoSubmit?: ArgoSubmitSpec;
  resultOutput?: string;
  /** Secret fields to materialise at approval (see {@link SecretFieldSpec}). */
  secretSpec?: SecretFieldSpec[];
}

/** Permission ids exposed by the platform suite. */
export const PLATFORM_PERMISSIONS = {
  requestCreate: 'platform.request.create',
  requestApprove: 'platform.request.approve',
  requestRead: 'platform.request.read',
} as const;

/** A request in a terminal state is "finished". */
export function isTerminal(state: RequestState): boolean {
  return state === 'SUCCEEDED' || state === 'FAILED' || state === 'REJECTED';
}

/**
 * How many approvals a request has, out of how many it needs.
 *
 * Rejections are decisions, not approvals: they live in the same array and must
 * not count toward the total. A single rejection settles the request anyway,
 * but the count is what gets rendered, so it has to be right on its own.
 */
export function approvalProgress(request: {
  policy: ApprovalPolicy;
  approvals: Approval[];
}): { granted: number; required: number } {
  return {
    granted: request.approvals.filter(a => a.decision === 'approve').length,
    required: request.policy.mode === 'SINGLE' ? 1 : request.policy.n,
  };
}
