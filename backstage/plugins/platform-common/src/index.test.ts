import { approvalProgress, isTerminal, Approval } from './index';

const approve = (approver: string): Approval => ({
  approver,
  decision: 'approve',
  at: '2026-08-06T00:00:00.000Z',
});
const reject = (approver: string): Approval => ({
  approver,
  decision: 'reject',
  at: '2026-08-06T00:00:00.000Z',
});

describe('approvalProgress', () => {
  it('needs one approval under a SINGLE policy', () => {
    expect(
      approvalProgress({ policy: { mode: 'SINGLE' }, approvals: [] }),
    ).toEqual({ granted: 0, required: 1 });
  });

  it('counts the one approval that satisfies a SINGLE policy', () => {
    expect(
      approvalProgress({ policy: { mode: 'SINGLE' }, approvals: [approve('a')] }),
    ).toEqual({ granted: 1, required: 1 });
  });

  it('takes the required count from an N_OF_M policy', () => {
    expect(
      approvalProgress({ policy: { mode: 'N_OF_M', n: 3 }, approvals: [] }),
    ).toEqual({ granted: 0, required: 3 });
  });

  it('does not count a rejection as an approval', () => {
    expect(
      approvalProgress({
        policy: { mode: 'N_OF_M', n: 3 },
        approvals: [approve('a'), reject('b'), approve('c')],
      }),
    ).toEqual({ granted: 2, required: 3 });
  });
});

describe('isTerminal', () => {
  it('treats a settled request as finished', () => {
    expect(isTerminal('SUCCEEDED')).toBe(true);
    expect(isTerminal('REJECTED')).toBe(true);
  });

  it('treats a request still in flight as unfinished', () => {
    expect(isTerminal('PENDING_APPROVAL')).toBe(false);
    expect(isTerminal('IN_PROGRESS')).toBe(false);
  });
});
