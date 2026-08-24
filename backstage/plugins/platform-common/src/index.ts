/**
 * Shared types for the platform plugin suite.
 *
 * @packageDocumentation
 */

export {
  DEFAULT_NAMESPACE,
  resourceRef,
  userRef,
  catalogPath,
} from './refs';

export {
  serviceOwnerMap,
  serviceOwnedTypes,
  type ServiceOwnerMap,
} from './resourceOwnership';

/** Lifecycle states of a resource request. */
export type RequestState =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  /**
   * The workflow is running but has stopped at an Argo `suspend` step and is
   * waiting for an approver to release it. Non-terminal, and reversible: the
   * poller moves the request back to IN_PROGRESS once no suspended node
   * remains, including when someone resumes from the Argo UI directly.
   */
  | 'AWAITING_INPUT'
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
  /**
   * Send every request param to Argo as its own named parameter.
   *
   * Defaults to **true**: a template declaring `name`, `owner`, `size` receives
   * exactly those, instead of having to parse them back out of one JSON blob.
   * Set `false` when a template wants only what `parameters` states explicitly
   * — for instance because it declares none of the request's fields and would
   * reject the submit.
   */
  forwardParams?: boolean;
  /**
   * Extra Argo parameters (name -> value), each value `<< token >>`-templated.
   *
   * Merged **over** the forwarded request params, so naming one here overrides
   * the forwarded value of the same name. Absent = only the forwarded params.
   */
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

/**
 * An Argo `suspend` step that is currently waiting.
 *
 * Argo has no "Suspended" phase — a waiting suspend node reports
 * `type: 'Suspend'` with `phase: 'Running'`, which is why this is detected on
 * the pair rather than on phase alone.
 */
export interface SuspendedNode {
  /** Argo node id. The only safe resume selector: display names repeat across
   *  loop iterations, and resuming the wrong one is silent. */
  id: string;
  /** displayName, as shown in the graph. */
  name: string;
  templateName?: string;
  /** The suspend template's message, if it set one. */
  message?: string;
  /**
   * The team this gate belongs to: the suspend template's own
   * `platform.io/approver-group` annotation, verbatim.
   *
   * Absent means the template did not name one, and the request's `ownerGroup`
   * answers the step as it always has. Present means the named group answers it
   * *instead* — the owning team is not sufficient for this step. Present but
   * empty is a broken annotation and leaves only admins, deliberately: see
   * `mayResumeNode`. The distinction between absent and empty is load-bearing,
   * so never normalise one into the other.
   */
  approverGroup?: string;
  /**
   * The step's input parameters — what the workflow computed and what the
   * approver is being asked to review.
   *
   * These are workflow-authored review values (a plan, a cost, a diff). Secrets
   * do not travel this way: they reach a workflow through a Kubernetes Secret
   * and `secretKeyRef`, never through a parameter.
   */
  inputs: SuspendInput[];
  /**
   * The questions the step is asking: outputs it declared as
   * `valueFrom: supplied: {}`. Only these may be set on resume — Argo rejects
   * anything else.
   */
  suppliedOutputs: SuppliedOutput[];
}

/** One input parameter of a suspend step. */
export interface SuspendInput {
  name: string;
  value?: string;
}

/**
 * An answer the suspend step is waiting for.
 *
 * `required` is derived from the step's own declaration rather than from
 * anything the platform decides: an Argo output parameter with a `default` can
 * be resumed without a value, and one without a default cannot. The workflow
 * author already expressed the intent; this reads it rather than guessing.
 */
export interface SuppliedOutput {
  name: string;
  /** The step's own `description`, shown as help text under the field. */
  description?: string;
  /** The step's `enum`; when present the field is a choice, not free text. */
  enum?: string[];
  /** The step's declared default, used as the field's initial value. */
  default?: string;
  /** True when the step declared no default — resuming needs an answer. */
  required: boolean;
}

/** A resource request tracked through approval + workflow execution. */
export interface Request {
  id: number;
  kind: RequestKind;
  resourceType: string;
  resourceName: string;
  /**
   * Every resource this request acts on, when it acts on more than one.
   *
   * Absent for the ordinary single-resource request, where `resourceName` is
   * the whole story. When present, `resourceName` holds the same names joined
   * — so lists, notifications and search keep working on one string — and this
   * is the structured form the workflow and the detail page read.
   */
  resourceNames?: string[];
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
  /**
   * Suspend steps currently waiting in the workflow, refreshed on every poll.
   *
   * A cache of Argo's answer, never the source of truth: the resume endpoint
   * re-reads the live workflow before acting on any of it.
   */
  suspendedNodes?: SuspendedNode[];
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
  /** Required unless `resourceNames` is given. */
  resourceName?: string;
  /** Bulk requests: every resource acted on. Server derives `resourceName`. */
  resourceNames?: string[];
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
  requestDelete: 'platform.request.delete',
  // Minting a presigned upload URL — its own permission because PlatformFile
  // uploads a file while the form is still being filled in, before any
  // request exists to attach requestCreate's gate to.
  uploadCreate: 'platform.upload.create',
} as const;

/** A request in a terminal state is "finished". */
export function isTerminal(state: RequestState): boolean {
  return state === 'SUCCEEDED' || state === 'FAILED' || state === 'REJECTED';
}

/**
 * States whose rows may be destroyed — by retention, or by a person.
 *
 * Deliberately **not** `isTerminal`. That answers "did this request reach an
 * outcome", and EXPIRED did not: nobody ever decided it. But an expired request
 * is exactly as dead as a rejected one, and retention has always deleted it, so
 * leaving it out here would make the one state that exists *because* it was
 * abandoned the only one nobody could clear from the UI.
 *
 * The complement is what matters: APPROVED, IN_PROGRESS and AWAITING_INPUT are
 * absent because a live Argo workflow still references its request, and the
 * secret sweep reads IN_PROGRESS ids to decide which Secrets are orphaned.
 * PENDING_APPROVAL is absent because it has an outcome ahead of it — approve,
 * reject or expire it instead.
 */
export const DELETABLE_STATES = [
  'SUCCEEDED',
  'FAILED',
  'REJECTED',
  'EXPIRED',
] as const satisfies readonly RequestState[];

export type DeletableState = (typeof DELETABLE_STATES)[number];

export function isDeletable(state: RequestState): boolean {
  return (DELETABLE_STATES as readonly RequestState[]).includes(state);
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

/**
 * May this principal release *this* suspend step? Pure — no I/O.
 *
 * Authorisation is per node, not per request: one workflow can wait on a cost
 * gate owned by finance and a schema gate owned by DBAs at the same time, and
 * each is answered by its own team. The router and the UI both read their
 * verdict here so they cannot drift.
 *
 * | node                          | who may resume it                        |
 * |-------------------------------|------------------------------------------|
 * | no `approverGroup`            | admin or `ownerGroup` (unchanged)        |
 * | `approverGroup` names a group | admin or that group — **not** the owner  |
 * | `approverGroup` empty/unknown | admin only                               |
 *
 * The owner approves the request at the start; a step that names a team belongs
 * to that team. An unresolvable group falls to admin-only rather than widening
 * back to the owner — a typo then stalls visibly and someone escalates, which
 * is the same instinct as `applyDecision`'s absent-ownerGroup rule. Nothing
 * here can resolve a group ref, and it does not need to: a group nobody is a
 * member of denies everyone but an admin by the same code path.
 */
export function mayResumeNode(opts: {
  isAdmin: boolean;
  /** The principal's group entityRefs. */
  groups: string[];
  /** The request's owning service team, if it has one. */
  ownerGroup?: string;
  /** The step's `platform.io/approver-group`; undefined = not annotated. */
  approverGroup?: string;
}): { allowed: boolean; reason: string } {
  if (opts.isAdmin) return { allowed: true, reason: 'admin' };

  // `undefined` (no annotation) and `''` (a broken one) mean different things,
  // so this tests for presence and never for truthiness.
  if (opts.approverGroup !== undefined) {
    const named = opts.approverGroup.trim();
    if (named === '') {
      return {
        allowed: false,
        reason:
          'This step names an approver group that could not be resolved, so only an admin can resume it',
      };
    }
    return opts.groups.includes(named)
      ? { allowed: true, reason: `member of ${named}` }
      : {
          allowed: false,
          reason: `Only ${named} or an admin can resume this step`,
        };
  }

  if (!opts.ownerGroup) {
    return {
      allowed: false,
      reason: 'This request has no owning team, so only an admin can resume it',
    };
  }
  return opts.groups.includes(opts.ownerGroup)
    ? { allowed: true, reason: `member of ${opts.ownerGroup}` }
    : {
        allowed: false,
        reason: `Only ${opts.ownerGroup} or an admin can resume this step`,
      };
}

/**
 * The short id a request records for whoever filed it.
 *
 * `user:default/dana` becomes `dana`. Exported because two sides compare
 * against it and they must agree: the router stores it on the row, and the
 * suspend panel decides whether to offer the requester a Stop button. Passing
 * a raw `userEntityRef` to that check silently denies the one person the rule
 * is for, and the UI and the API then disagree about the same request.
 */
export function actorIdOf(userEntityRef: string): string {
  return userEntityRef.split('/').pop()!.split(':')[0];
}

/**
 * May this principal end the whole run? Pure — no I/O.
 *
 * Argo has no way to stop one node: `/stop` ends the workflow. So refusing a
 * gate and abandoning the request are the same operation reached from two
 * places, and they are gated differently on purpose.
 *
 * - **From a gate** the question is the gate's own — use {@link mayResumeNode}.
 *   The team that owns a step may refuse it, and refusing ends the run.
 * - **From the request** the question is this one: the owning team, an admin,
 *   or the person who filed it. A requester who no longer wants what they asked
 *   for should not have to find an approver to withdraw it.
 *
 * `requester` is matched on the stored entityRef rather than on group
 * membership, so the set cannot widen later when somebody joins a team.
 */
export function mayStopWorkflow(opts: {
  isAdmin: boolean;
  /** The principal's group entityRefs. */
  groups: string[];
  /** The caller's own user entityRef. */
  actor: string;
  /** The request's owning service team, if it has one. */
  ownerGroup?: string;
  /** Who filed the request. */
  requester: string;
}): { allowed: boolean; reason: string } {
  if (opts.isAdmin) return { allowed: true, reason: 'admin' };
  // Both empty must never match each other. An unresolved identity and a
  // request with no recorded requester would otherwise compare equal and open
  // the gate to anyone — the emptiness is the bug, and it must not be the key.
  if (opts.actor && opts.actor === opts.requester) {
    return { allowed: true, reason: 'the requester' };
  }
  if (opts.ownerGroup && opts.groups.includes(opts.ownerGroup)) {
    return { allowed: true, reason: `member of ${opts.ownerGroup}` };
  }
  return {
    allowed: false,
    reason: opts.ownerGroup
      ? `Only ${opts.ownerGroup}, the requester or an admin can stop this workflow`
      : 'Only the requester or an admin can stop this workflow',
  };
}
