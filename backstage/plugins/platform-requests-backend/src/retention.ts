import { RootConfigService } from '@backstage/backend-plugin-api';
import { RequestState } from '@internal/plugin-platform-common';

export interface RetentionConfig {
  enabled: boolean;
  dryRun: boolean;
  batchSize: number;
  pendingExpiryDays: number;
  succeededDays: number;
  failedDays: number;
  rejectedDays: number;
  expiredDays: number;
}

/** Off by default: deleting rows is irreversible, so it must be chosen. */
export const RETENTION_DEFAULTS: RetentionConfig = {
  enabled: false,
  dryRun: false,
  batchSize: 500,
  pendingExpiryDays: 14,
  succeededDays: 90,
  failedDays: 90,
  rejectedDays: 30,
  expiredDays: 30,
};

export interface RetentionPlan {
  /** PENDING_APPROVAL older than this ISO timestamp becomes EXPIRED. */
  expirePendingBefore?: string;
  /** Per terminal state: delete rows whose updated_at is older than this. */
  deleteBefore: Array<{ state: RequestState; before: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const cutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS).toISOString();

/**
 * What this run should do, given the clock. Pure — the caller supplies `now`,
 * which is what makes "is this stale" testable without waiting or faking timers.
 *
 * APPROVED, IN_PROGRESS and AWAITING_INPUT never appear in the plan. That is
 * deliberate and not configurable: a live Argo workflow still references its
 * request, and the secret sweep reads IN_PROGRESS ids to decide which Secrets
 * are orphaned. AWAITING_INPUT is the longest-lived of the three — a suspended
 * workflow waits on a human and can sit for weeks — which makes it the one most
 * likely to look stale to a sweep that only reads timestamps.
 */
export function planRetention(cfg: RetentionConfig, now: Date): RetentionPlan {
  if (!cfg.enabled) return { deleteBefore: [] };

  const windows: Array<[RequestState, number]> = [
    ['SUCCEEDED', cfg.succeededDays],
    ['FAILED', cfg.failedDays],
    ['REJECTED', cfg.rejectedDays],
    ['EXPIRED', cfg.expiredDays],
  ];

  return {
    // 0 means "never expire", not "expire everything".
    expirePendingBefore:
      cfg.pendingExpiryDays > 0 ? cutoff(now, cfg.pendingExpiryDays) : undefined,
    deleteBefore: windows
      .filter(([, days]) => days > 0)
      .map(([state, days]) => ({ state, before: cutoff(now, days) })),
  };
}

/**
 * A window below a day is a typo, not an intent — and an intent that would
 * expire or delete requests seconds after they are created. Treat it as 0
 * ("keep forever") and say so, rather than acting on it.
 */
export function sanitiseDays(
  key: string,
  value: number,
  warn: (msg: string) => void,
): number {
  if (value === 0) return 0;
  if (!Number.isFinite(value) || value < 0) {
    warn(`platform.requests.retention.${key} is not a valid number of days; treating it as 0 (never)`);
    return 0;
  }
  if (value < 1) {
    warn(`platform.requests.retention.${key} is ${value} days, which is under a day and almost certainly a mistake; treating it as 0 (never)`);
    return 0;
  }
  return value;
}

export function readRetentionConfig(
  root: RootConfigService,
  warn: (msg: string) => void = () => {},
): RetentionConfig {
  const c = root.getOptionalConfig('platform.requests.retention');
  if (!c) return RETENTION_DEFAULTS;
  const num = (key: string, dflt: number) =>
    sanitiseDays(key, c.getOptionalNumber(key) ?? dflt, warn);
  return {
    enabled: c.getOptionalBoolean('enabled') ?? RETENTION_DEFAULTS.enabled,
    dryRun: c.getOptionalBoolean('dryRun') ?? RETENTION_DEFAULTS.dryRun,
    // Not a day count — read it raw.
    batchSize:
      c.getOptionalNumber('batchSize') ?? RETENTION_DEFAULTS.batchSize,
    pendingExpiryDays: num(
      'pendingExpiryDays',
      RETENTION_DEFAULTS.pendingExpiryDays,
    ),
    succeededDays: num('succeededDays', RETENTION_DEFAULTS.succeededDays),
    failedDays: num('failedDays', RETENTION_DEFAULTS.failedDays),
    rejectedDays: num('rejectedDays', RETENTION_DEFAULTS.rejectedDays),
    expiredDays: num('expiredDays', RETENTION_DEFAULTS.expiredDays),
  };
}
