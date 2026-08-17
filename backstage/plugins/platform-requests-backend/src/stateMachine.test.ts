import { ConflictError, NotAllowedError } from '@backstage/errors';
import {
  ApprovalPolicy,
  Request,
} from '@internal/plugin-platform-common';
import { applyDecision, mayResumeNode, policySatisfied } from './stateMachine';

const OWNER = 'group:default/team-a';

const baseRequest = (policy: ApprovalPolicy): Request => ({
  id: 1,
  kind: 'CREATE',
  resourceType: 'bucket',
  resourceName: 'my-bucket',
  params: {},
  state: 'PENDING_APPROVAL',
  policy,
  requester: 'alice',
  ownerGroup: OWNER,
  approvals: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// An admin (bypasses the owning-team gate) and a service owner (member of the
// request's owning team), as applyDecision opts.
const asAdmin = { isAdmin: true, approverInGroup: () => false };
const asOwner = {
  isAdmin: false,
  approverInGroup: (g: string) => g === OWNER,
};
const asOutsider = { isAdmin: false, approverInGroup: () => false };

describe('policySatisfied', () => {
  const approve = (approver: string) => ({
    approver,
    decision: 'approve' as const,
    at: '2026-01-01T00:00:00.000Z',
  });

  it('SINGLE needs one approve', () => {
    expect(policySatisfied({ mode: 'SINGLE' }, [])).toBe(false);
    expect(policySatisfied({ mode: 'SINGLE' }, [approve('bob')])).toBe(true);
  });

  it('N_OF_M needs n distinct approvers', () => {
    const p = { mode: 'N_OF_M', n: 2 } as const;
    expect(policySatisfied(p, [approve('bob')])).toBe(false);
    expect(policySatisfied(p, [approve('bob'), approve('bob')])).toBe(false);
    expect(policySatisfied(p, [approve('bob'), approve('carol')])).toBe(true);
  });
});

describe('mayResumeNode', () => {
  const DBA = 'group:default/dba';
  const owner = { groups: [OWNER] };
  const dba = { groups: [DBA] };
  const nobody = { groups: [] };

  describe('a step with no approver-group annotation (unchanged behaviour)', () => {
    it('lets the owning team through', () => {
      expect(
        mayResumeNode({ isAdmin: false, ...owner, ownerGroup: OWNER }).allowed,
      ).toBe(true);
    });

    it('keeps everyone else out, and names the team that would be allowed', () => {
      const v = mayResumeNode({ isAdmin: false, ...dba, ownerGroup: OWNER });
      expect(v.allowed).toBe(false);
      expect(v.reason).toContain(OWNER);
    });

    it('is admin-only when the request has no owning team', () => {
      expect(
        mayResumeNode({ isAdmin: false, ...owner, ownerGroup: undefined }).allowed,
      ).toBe(false);
      expect(
        mayResumeNode({ isAdmin: true, ...nobody, ownerGroup: undefined }).allowed,
      ).toBe(true);
    });
  });

  describe('a step that names a group', () => {
    it('lets a member of the named group through', () => {
      expect(
        mayResumeNode({
          isAdmin: false,
          ...dba,
          ownerGroup: OWNER,
          approverGroup: DBA,
        }).allowed,
      ).toBe(true);
    });

    // The case the whole change exists for: the owner approved the request at
    // the start, but this gate belongs to someone else.
    it('DENIES the owning team a step that names another team', () => {
      const v = mayResumeNode({
        isAdmin: false,
        ...owner,
        ownerGroup: OWNER,
        approverGroup: DBA,
      });
      expect(v.allowed).toBe(false);
      expect(v.reason).toContain(DBA);
      expect(v.reason).not.toContain(OWNER);
    });
  });

  describe('a step whose group is empty or unresolvable', () => {
    it('is admin-only for an empty annotation — fail closed', () => {
      for (const approverGroup of ['', '   ']) {
        const v = mayResumeNode({
          isAdmin: false,
          ...owner,
          ownerGroup: OWNER,
          approverGroup,
        });
        expect(v.allowed).toBe(false);
        expect(v.reason).toMatch(/could not be resolved/);
      }
    });

    // A group ref that resolves to nothing is a group nobody is a member of, so
    // it denies through the same path rather than needing a catalog lookup.
    it('is admin-only for a group nobody is in', () => {
      expect(
        mayResumeNode({
          isAdmin: false,
          ...owner,
          ownerGroup: OWNER,
          approverGroup: 'group:default/typo',
        }).allowed,
      ).toBe(false);
    });
  });

  it('an admin is allowed in every state', () => {
    for (const approverGroup of [undefined, DBA, '', 'group:default/typo']) {
      expect(
        mayResumeNode({
          isAdmin: true,
          ...nobody,
          ownerGroup: undefined,
          approverGroup,
        }).allowed,
      ).toBe(true);
    }
  });
});

describe('applyDecision', () => {
  it('SINGLE: owning service owner approves -> APPROVED', () => {
    const { nextState } = applyDecision(
      baseRequest({ mode: 'SINGLE' }),
      'bob',
      'approve',
      asOwner,
    );
    expect(nextState).toBe('APPROVED');
  });

  it('N_OF_M n=2: stays pending until a second distinct owner approves', () => {
    const req = baseRequest({ mode: 'N_OF_M', n: 2 });
    const first = applyDecision(req, 'bob', 'approve', asOwner);
    expect(first.nextState).toBe('PENDING_APPROVAL');

    const withOne: Request = { ...req, approvals: [first.approval] };
    // duplicate approver does not count twice
    expect(
      applyDecision(withOne, 'bob', 'approve', asOwner).nextState,
    ).toBe('PENDING_APPROVAL');
    // second distinct approver satisfies
    expect(
      applyDecision(withOne, 'carol', 'approve', asOwner).nextState,
    ).toBe('APPROVED');
  });

  it('N_OF_M: an admin and an owner can be the two distinct approvers', () => {
    const req = baseRequest({ mode: 'N_OF_M', n: 2 });
    const first = applyDecision(req, 'admin', 'approve', asAdmin);
    expect(first.nextState).toBe('PENDING_APPROVAL');
    const withOne: Request = { ...req, approvals: [first.approval] };
    expect(
      applyDecision(withOne, 'bob', 'approve', asOwner).nextState,
    ).toBe('APPROVED');
  });

  it('reject by the owning team -> REJECTED', () => {
    const { nextState, approval } = applyDecision(
      baseRequest({ mode: 'SINGLE' }),
      'bob',
      'reject',
      asOwner,
    );
    expect(nextState).toBe('REJECTED');
    expect(approval.decision).toBe('reject');
  });

  it('a non-owner non-admin cannot decide (another team) -> NotAllowedError', () => {
    expect(() =>
      applyDecision(baseRequest({ mode: 'SINGLE' }), 'bob', 'approve', asOutsider),
    ).toThrow(NotAllowedError);
  });

  it('an admin may decide any request (bypasses the owning-team gate)', () => {
    expect(
      applyDecision(baseRequest({ mode: 'SINGLE' }), 'bob', 'approve', asAdmin)
        .nextState,
    ).toBe('APPROVED');
  });

  it('the owning service owner may self-approve; a non-owner requester cannot', () => {
    // alice is the requester; as an owner she may self-approve
    expect(
      applyDecision(baseRequest({ mode: 'SINGLE' }), 'alice', 'approve', asOwner)
        .nextState,
    ).toBe('APPROVED');
    // alice as a non-owner cannot approve her own request
    expect(() =>
      applyDecision(baseRequest({ mode: 'SINGLE' }), 'alice', 'approve', asOutsider),
    ).toThrow(NotAllowedError);
  });

  it('absent ownerGroup -> only an admin may decide', () => {
    const req = { ...baseRequest({ mode: 'SINGLE' }), ownerGroup: undefined };
    expect(() =>
      applyDecision(req, 'bob', 'approve', asOwner),
    ).toThrow(NotAllowedError);
    expect(applyDecision(req, 'bob', 'approve', asAdmin).nextState).toBe(
      'APPROVED',
    );
  });

  it('deciding a non-pending request throws', () => {
    const req = { ...baseRequest({ mode: 'SINGLE' }), state: 'APPROVED' as const };
    expect(() =>
      applyDecision(req, 'bob', 'approve', asAdmin),
    ).toThrow(ConflictError);
  });

  it('refuses to decide a request that already expired', () => {
    expect(() =>
      applyDecision(
        { ...baseRequest({ mode: 'SINGLE' }), state: 'EXPIRED' },
        'user:default/admin',
        'approve',
        { isAdmin: true, approverInGroup: () => true },
      ),
    ).toThrow(ConflictError);
  });
});
