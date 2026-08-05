import { planRetention, RETENTION_DEFAULTS } from './retention';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const cfg = (over: Partial<typeof RETENTION_DEFAULTS> = {}) => ({
  ...RETENTION_DEFAULTS,
  enabled: true,
  ...over,
});

describe('planRetention', () => {
  it('plans nothing at all when disabled', () => {
    const plan = planRetention(cfg({ enabled: false }), NOW);
    expect(plan.expirePendingBefore).toBeUndefined();
    expect(plan.deleteBefore).toEqual([]);
  });

  it('expires pending requests older than the configured days', () => {
    const plan = planRetention(cfg({ pendingExpiryDays: 14 }), NOW);
    expect(plan.expirePendingBefore).toBe('2026-07-22T12:00:00.000Z');
  });

  it('gives each terminal state its own cutoff', () => {
    const plan = planRetention(
      cfg({
        succeededDays: 90,
        failedDays: 90,
        rejectedDays: 30,
        expiredDays: 30,
      }),
      NOW,
    );
    const by = Object.fromEntries(plan.deleteBefore.map(d => [d.state, d.before]));
    expect(by.SUCCEEDED).toBe('2026-05-07T12:00:00.000Z');
    expect(by.REJECTED).toBe('2026-07-06T12:00:00.000Z');
    expect(by.EXPIRED).toBe('2026-07-06T12:00:00.000Z');
  });

  it('never plans deletion for a state that is still in flight', () => {
    const plan = planRetention(cfg(), NOW);
    const states = plan.deleteBefore.map(d => d.state);
    expect(states).not.toContain('APPROVED');
    expect(states).not.toContain('IN_PROGRESS');
    expect(states).not.toContain('PENDING_APPROVAL');
  });

  it('treats 0 days as "keep this state forever"', () => {
    const plan = planRetention(cfg({ rejectedDays: 0 }), NOW);
    expect(plan.deleteBefore.map(d => d.state)).not.toContain('REJECTED');
  });

  it('treats 0 pending days as "never expire"', () => {
    expect(
      planRetention(cfg({ pendingExpiryDays: 0 }), NOW).expirePendingBefore,
    ).toBeUndefined();
  });

  it('defaults to disabled, so an upgrade deletes nothing', () => {
    expect(RETENTION_DEFAULTS.enabled).toBe(false);
  });
});
