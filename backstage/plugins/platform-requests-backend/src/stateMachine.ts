import { ConflictError, NotAllowedError } from '@backstage/errors';
import {
  Approval,
  ApprovalPolicy,
  Request,
  RequestState,
} from '@internal/plugin-platform-common';

/** Has `policy` been met by the given approvals? Pure — no I/O. */
export function policySatisfied(
  policy: ApprovalPolicy,
  approvals: Approval[],
  approverHasRole: (approver: string, role: string) => boolean,
): boolean {
  const approved = approvals.filter(a => a.decision === 'approve');
  const distinct = new Set(approved.map(a => a.approver));
  switch (policy.mode) {
    case 'SINGLE':
      return distinct.size >= 1;
    case 'N_OF_M':
      return distinct.size >= policy.n;
    case 'RBAC':
      return approved.some(a => approverHasRole(a.approver, policy.role));
    default:
      return false;
  }
}

/**
 * Apply an approve/reject decision to a PENDING_APPROVAL request. Pure: returns
 * the next state and the approval to record; callers persist them.
 */
export function applyDecision(
  request: Request,
  approver: string,
  decision: 'approve' | 'reject',
  opts: {
    note?: string;
    approverHasRole: (role: string) => boolean;
    /** Is the approver a member of the given group entityRef? */
    approverInGroup: (groupRef: string) => boolean;
  },
): { nextState: RequestState; approval: Approval } {
  if (request.state !== 'PENDING_APPROVAL') {
    throw new ConflictError(
      `Cannot ${decision} a request in state ${request.state}`,
    );
  }
  // Per-team RBAC: only an admin, or a member of the request's owning service
  // team (the Scaffolder Template owner), may decide it. This also governs
  // self-approval — the owning service owner (or an admin) may approve their
  // own request; anyone else cannot approve at all. Absent ownerGroup =>
  // admin-only.
  const isAdmin = opts.approverHasRole('platform-admin');
  const ownsRequest =
    !!request.ownerGroup && opts.approverInGroup(request.ownerGroup);
  if (!isAdmin && !ownsRequest) {
    throw new NotAllowedError(
      'Only an admin or a member of the owning service team may decide this request',
    );
  }

  const approval: Approval = {
    approver,
    decision,
    note: opts.note,
    at: new Date().toISOString(),
  };

  if (decision === 'reject') {
    return { nextState: 'REJECTED', approval };
  }

  const approvals = [...request.approvals, approval];
  // ponytail: only the current approver's roles are resolvable here; prior
  // approvers' RBAC roles aren't re-checked. Enough for single-holder RBAC.
  const satisfied = policySatisfied(request.policy, approvals, (a, role) =>
    a === approver ? opts.approverHasRole(role) : false,
  );
  return {
    nextState: satisfied ? 'APPROVED' : 'PENDING_APPROVAL',
    approval,
  };
}
