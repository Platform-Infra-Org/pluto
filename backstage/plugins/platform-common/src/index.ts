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
  | 'REJECTED';

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
