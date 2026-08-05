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
 * APPROVED and IN_PROGRESS never appear in the plan. That is deliberate and not
 * configurable: a live Argo workflow still references its request, and the
 * secret sweep reads IN_PROGRESS ids to decide which Secrets are orphaned.
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

export function readRetentionConfig(root: RootConfigService): RetentionConfig {
  const c = root.getOptionalConfig('platform.requests.retention');
  if (!c) return RETENTION_DEFAULTS;
  const num = (key: string, dflt: number) => c.getOptionalNumber(key) ?? dflt;
  return {
    enabled: c.getOptionalBoolean('enabled') ?? RETENTION_DEFAULTS.enabled,
    dryRun: c.getOptionalBoolean('dryRun') ?? RETENTION_DEFAULTS.dryRun,
    batchSize: num('batchSize', RETENTION_DEFAULTS.batchSize),
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
