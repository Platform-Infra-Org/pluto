import { ConflictError } from '@backstage/errors';
import {
  ApprovalPolicy,
  Request,
} from '@internal/plugin-platform-common';
import { applyDecision, policySatisfied } from './stateMachine';

const baseRequest = (policy: ApprovalPolicy): Request => ({
  id: 1,
  kind: 'CREATE',
  resourceType: 'bucket',
  resourceName: 'my-bucket',
  params: {},
  state: 'PENDING_APPROVAL',
  policy,
  requester: 'alice',
  approvals: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const noRoles = () => false;

describe('policySatisfied', () => {
  const approve = (approver: string) => ({
    approver,
    decision: 'approve' as const,
    at: '2026-01-01T00:00:00.000Z',
  });

  it('SINGLE needs one approve', () => {
    expect(policySatisfied({ mode: 'SINGLE' }, [], noRoles)).toBe(false);
    expect(policySatisfied({ mode: 'SINGLE' }, [approve('bob')], noRoles)).toBe(
      true,
    );
  });

  it('N_OF_M needs n distinct approvers', () => {
    const p = { mode: 'N_OF_M', n: 2 } as const;
    expect(policySatisfied(p, [approve('bob')], noRoles)).toBe(false);
    expect(
      policySatisfied(p, [approve('bob'), approve('bob')], noRoles),
    ).toBe(false);
    expect(
      policySatisfied(p, [approve('bob'), approve('carol')], noRoles),
    ).toBe(true);
  });

  it('RBAC needs an approve by a role holder', () => {
    const p = { mode: 'RBAC', role: 'admin' } as const;
    const hasRole = (a: string, role: string) => a === 'bob' && role === 'admin';
    expect(policySatisfied(p, [approve('carol')], hasRole)).toBe(false);
    expect(policySatisfied(p, [approve('bob')], hasRole)).toBe(true);
  });
});

describe('applyDecision', () => {
  const grant = () => true;
  const deny = () => false;

  it('SINGLE: one approve -> APPROVED', () => {
    const { nextState } = applyDecision(
      baseRequest({ mode: 'SINGLE' }),
      'bob',
      'approve',
      { approverHasRole: deny },
    );
    expect(nextState).toBe('APPROVED');
  });

  it('N_OF_M n=2: stays pending until a second distinct approver', () => {
    const req = baseRequest({ mode: 'N_OF_M', n: 2 });
    const first = applyDecision(req, 'bob', 'approve', {
      approverHasRole: deny,
    });
    expect(first.nextState).toBe('PENDING_APPROVAL');

    const withOne: Request = { ...req, approvals: [first.approval] };
    // duplicate approver does not count twice
    expect(
      applyDecision(withOne, 'bob', 'approve', { approverHasRole: deny })
        .nextState,
    ).toBe('PENDING_APPROVAL');
    // second distinct approver satisfies
    expect(
      applyDecision(withOne, 'carol', 'approve', { approverHasRole: deny })
        .nextState,
    ).toBe('APPROVED');
  });

  it('RBAC: role holder approves -> APPROVED, non-holder stays pending', () => {
    const req = baseRequest({ mode: 'RBAC', role: 'admin' });
    expect(
      applyDecision(req, 'bob', 'approve', { approverHasRole: grant })
        .nextState,
    ).toBe('APPROVED');
    expect(
      applyDecision(req, 'carol', 'approve', { approverHasRole: deny })
        .nextState,
    ).toBe('PENDING_APPROVAL');
  });

  it('reject -> REJECTED', () => {
    const { nextState, approval } = applyDecision(
      baseRequest({ mode: 'SINGLE' }),
      'bob',
      'reject',
      { approverHasRole: deny },
    );
    expect(nextState).toBe('REJECTED');
    expect(approval.decision).toBe('reject');
  });

  it('self-approval throws', () => {
    expect(() =>
      applyDecision(baseRequest({ mode: 'SINGLE' }), 'alice', 'approve', {
        approverHasRole: deny,
      }),
    ).toThrow(ConflictError);
  });

  it('deciding a non-pending request throws', () => {
    const req = { ...baseRequest({ mode: 'SINGLE' }), state: 'APPROVED' as const };
    expect(() =>
      applyDecision(req, 'bob', 'approve', { approverHasRole: deny }),
    ).toThrow(ConflictError);
  });
});
