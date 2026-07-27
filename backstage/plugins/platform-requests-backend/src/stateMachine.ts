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
): boolean {
  const approved = approvals.filter(a => a.decision === 'approve');
  const distinct = new Set(approved.map(a => a.approver));
  switch (policy.mode) {
    case 'SINGLE':
      return distinct.size >= 1;
    case 'N_OF_M':
      return distinct.size >= policy.n;
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
    /** Is the approver a platform admin (bypasses the owning-team gate)? */
    isAdmin: boolean;
    /** Is the approver a member of the given group entityRef? */
    approverInGroup: (groupRef: string) => boolean;
  },
): { nextState: RequestState; approval: Approval } {
  if (request.state !== 'PENDING_APPROVAL') {
    throw new ConflictError(
      `Cannot ${decision} a request in state ${request.state}`,
    );
  }
  // Per-team gate: only an admin, or a member of the request's owning service
  // team (the Scaffolder Template owner), may decide it. This also governs
  // self-approval — the owning service owner (or an admin) may approve their
  // own request; anyone else cannot approve at all. Absent ownerGroup =>
  // admin-only.
  const ownsRequest =
    !!request.ownerGroup && opts.approverInGroup(request.ownerGroup);
  if (!opts.isAdmin && !ownsRequest) {
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
  return {
    nextState: policySatisfied(request.policy, approvals)
      ? 'APPROVED'
      : 'PENDING_APPROVAL',
    approval,
  };
}
