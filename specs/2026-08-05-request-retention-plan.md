# Request Retention & Lifecycle — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `platform_requests` and `platform_approvals` growing forever. Undecided requests lapse to a new terminal state; finished requests are deleted after a per-state window that the operator configures.

**Architecture:** One new terminal state, `EXPIRED`, and one scheduled task in `platform-requests-backend` beside the two that already exist. The task does two passes: expire stale `PENDING_APPROVAL` rows, then hard-delete terminal rows past their window. All decisions about *what* is stale live in a pure function that takes the clock as an argument, so the logic is tested without a database or a scheduler.

**Tech Stack:** TypeScript, knex, `coreServices.scheduler`, Backstage config, Jest with `TestDatabases` (SQLite).

## Global Constraints

- Branch: `feat/request-retention`, cut from `main`. This is backend work and should not sit behind the UI redesign.
- **Nothing in flight is ever deleted.** `APPROVED` and `IN_PROGRESS` are excluded from deletion unconditionally, not by configuration — a live Argo workflow still references its request, and the secret sweep reads `IN_PROGRESS` ids to decide which Kubernetes Secrets are orphaned.
- Deletion is off by default. A platform that upgrades and says nothing must keep every row.
- Run tests from `backstage/`: `CI=true yarn test [path-filter]`.
- Every task ends green: `yarn tsc`, `CI=true yarn test`, `yarn lint:all`.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Stale `PENDING_APPROVAL` | **Expire to a new `EXPIRED` state**, delete later under the terminal window | A request that silently vanishes from the requester's list is indistinguishable from a bug. Lapsing is a fact worth recording |
| Removal | **Hard delete**, request rows and their approvals | It is what actually satisfies a retention policy and what bounds the tables. An archive table only moves the growth |
| Windows | **Per state**, with defaults | The operator asked to differentiate rejected / approved / pending. Rejected noise deserves a shorter life than a successful provision |
| Default | **Disabled** | Deleting rows is irreversible; it should be a decision, not an upgrade side effect |
| Clock | Injected into the pure planner | Makes "is this stale" testable without waiting or mocking timers globally |

### The states, and what happens to each

| State | Terminal | Retention behaviour |
|---|---|---|
| `PENDING_APPROVAL` | no | After `pendingExpiryDays`, becomes `EXPIRED`. Never deleted directly |
| `APPROVED` | no | **Never touched** — transient, a workflow is being submitted |
| `IN_PROGRESS` | no | **Never touched** — a workflow is running and the secret sweep depends on it |
| `SUCCEEDED` | yes | Deleted after `succeededDays` |
| `FAILED` | yes | Deleted after `failedDays` |
| `REJECTED` | yes | Deleted after `rejectedDays` |
| `EXPIRED` | yes | Deleted after `expiredDays` |

### Expiry must clear the held secret

A `PENDING_APPROVAL` request carrying a **provided** secret holds it envelope-encrypted in `secret_enc`. The approve path clears it once the value reaches the Kubernetes Secret; the reject path clears it too. Expiry is a third way a request ends, and it must clear the blob for the same reason — otherwise a request nobody ever decided keeps its ciphertext indefinitely, which is the one case where "we keep rows forever" turns into a security question rather than a housekeeping one.

### Config

```yaml
platform:
  requests:
    retention:
      enabled: false              # default: nothing is deleted
      frequency: { hours: 6 }
      dryRun: false               # log what would happen, change nothing
      batchSize: 500              # rows deleted per state per run
      pendingExpiryDays: 14       # PENDING_APPROVAL -> EXPIRED
      succeededDays: 90
      failedDays: 90
      rejectedDays: 30
      expiredDays: 30
```

Any window may be set to `0` to disable that state's deletion while leaving the others active.

---

## File Structure

| File | Responsibility |
|---|---|
| `plugins/platform-common/src/index.ts` | `RequestState` gains `EXPIRED` |
| `plugins/platform-requests-backend/src/retention.ts` | **New.** Pure planner: config + clock → what to expire and delete. No I/O |
| `plugins/platform-requests-backend/src/retention.test.ts` | **New.** Unit tests for the planner |
| `plugins/platform-requests-backend/src/store.ts` | `expireStale`, `deleteTerminalBefore` |
| `plugins/platform-requests-backend/src/store.test.ts` | Round-trip tests for both, against SQLite |
| `plugins/platform-requests-backend/src/stateMachine.ts` | `EXPIRED` rejects further decisions |
| `plugins/platform-requests-backend/src/plugin.ts` | The scheduled task |
| `plugins/platform-requests-backend/config.d.ts` | The retention block |
| `plugins/platform-ui/src/sprites.ts` | An `EXPIRED` sprite |
| `plugins/platform-requests/src/components/RequestsPage.tsx` | Badge + label for `EXPIRED` |
| `app-config.yaml`, `docs/…` | Example and documentation |

---

## Task 1: The EXPIRED state

Adding to `RequestState` deliberately breaks three exhaustive maps. That is the point — the compiler and the sprite test enumerate every place a state must be handled.

**Files:**
- Modify: `plugins/platform-common/src/index.ts`
- Modify: `plugins/platform-requests-backend/src/stateMachine.ts`
- Modify: `plugins/platform-ui/src/sprites.ts`
- Modify: `plugins/platform-ui/src/sprites.test.ts`
- Modify: `plugins/platform-requests/src/components/RequestsPage.tsx`

**Interfaces:**
- Produces: `RequestState` now includes `'EXPIRED'`; `STATE_SPRITES.EXPIRED` exists.

- [ ] **Step 1: Add the state**

In `platform-common/src/index.ts`:

```ts
export type RequestState =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  /** Nobody decided it in time. Terminal; set by the retention task. */
  | 'EXPIRED';
```

- [ ] **Step 2: Run the type checker and let it list the work**

```bash
cd backstage && yarn tsc
```

Expected: FAIL, in `STATE_SPRITES` (a `Record<RequestState, Sprite>`) and anywhere else a state map is exhaustive. Fix each site as the next steps describe rather than widening a type to silence it.

- [ ] **Step 3: Draw the sprite**

In `plugins/platform-ui/src/sprites.ts`, an emptied hourglass — the same object as `PENDING_APPROVAL`, run out:

```ts
export const HOURGLASS_SPENT: Sprite = [
  '................',
  '..############..',
  '..############..',
  '...#........#...',
  '....#......#....',
  '.....#....#.....',
  '......#..#......',
  '.......##.......',
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '..############..',
  '................',
];
```

and add it to the map:

```ts
  EXPIRED: HOURGLASS_SPENT,
```

- [ ] **Step 4: Extend the sprite test**

`sprites.test.ts` asserts the exact key list, so add `'EXPIRED'` to it:

```ts
    expect(Object.keys(STATE_SPRITES).sort()).toEqual([
      'APPROVED', 'EXPIRED', 'FAILED', 'IN_PROGRESS',
      'PENDING_APPROVAL', 'REJECTED', 'SUCCEEDED',
    ]);
```

- [ ] **Step 5: Label it in the UI**

In `RequestsPage.tsx`, both lookup maps gain an entry:

```ts
    EXPIRED: 'Expired',
```
```ts
    EXPIRED: 'muted',
```

- [ ] **Step 6: Refuse decisions on an expired request**

In `stateMachine.ts`, `applyDecision` already guards on `PENDING_APPROVAL`; confirm an `EXPIRED` request is rejected with a `ConflictError` and add a test:

```ts
  it('refuses to decide a request that already expired', () => {
    expect(() =>
      applyDecision(
        { ...baseRequest, state: 'EXPIRED' },
        'user:default/admin',
        'approve',
        { isAdmin: true, approverInGroup: () => true },
      ),
    ).toThrow(ConflictError);
  });
```

- [ ] **Step 7: Verify and commit**

```bash
cd backstage && yarn tsc && CI=true yarn test && yarn lint:all
git add backstage/plugins
git commit -m "feat(requests): add the EXPIRED terminal state"
```

---

## Task 2: The retention planner

Pure function, no database, no scheduler, no ambient clock. This is where the rules live and where they are tested.

**Files:**
- Create: `plugins/platform-requests-backend/src/retention.ts`
- Create: `plugins/platform-requests-backend/src/retention.test.ts`

**Interfaces:**
- Produces:
  ```ts
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
  export const RETENTION_DEFAULTS: RetentionConfig;
  export interface RetentionPlan {
    /** PENDING_APPROVAL older than this ISO timestamp becomes EXPIRED. */
    expirePendingBefore?: string;
    /** Per terminal state: delete rows whose updated_at is older than this. */
    deleteBefore: Array<{ state: RequestState; before: string }>;
  }
  export function planRetention(cfg: RetentionConfig, now: Date): RetentionPlan;
  export function readRetentionConfig(root: RootConfigService): RetentionConfig;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
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
      cfg({ succeededDays: 90, failedDays: 90, rejectedDays: 30, expiredDays: 30 }),
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
    expect(planRetention(cfg({ pendingExpiryDays: 0 }), NOW).expirePendingBefore)
      .toBeUndefined();
  });

  it('defaults to disabled, so an upgrade deletes nothing', () => {
    expect(RETENTION_DEFAULTS.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd backstage && CI=true yarn test plugins/platform-requests-backend/src/retention.test.ts
```

Expected: FAIL — `Cannot find module './retention'`.

- [ ] **Step 3: Write the planner**

```ts
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
  expirePendingBefore?: string;
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
      cfg.pendingExpiryDays > 0
        ? cutoff(now, cfg.pendingExpiryDays)
        : undefined,
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
    pendingExpiryDays: num('pendingExpiryDays', RETENTION_DEFAULTS.pendingExpiryDays),
    succeededDays: num('succeededDays', RETENTION_DEFAULTS.succeededDays),
    failedDays: num('failedDays', RETENTION_DEFAULTS.failedDays),
    rejectedDays: num('rejectedDays', RETENTION_DEFAULTS.rejectedDays),
    expiredDays: num('expiredDays', RETENTION_DEFAULTS.expiredDays),
  };
}
```

- [ ] **Step 4: Run the tests**

```bash
cd backstage && CI=true yarn test plugins/platform-requests-backend/src/retention.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-requests-backend/src/retention.ts \
        backstage/plugins/platform-requests-backend/src/retention.test.ts
git commit -m "feat(requests): pure retention planner with per-state windows"
```

---

## Task 3: The store operations

**Files:**
- Modify: `plugins/platform-requests-backend/src/store.ts`
- Modify: `plugins/platform-requests-backend/src/store.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** PENDING_APPROVAL older than `before` -> EXPIRED, clearing the held secret. */
  async expireStale(before: string): Promise<number>;
  /** Delete terminal rows and their approvals. Returns rows deleted. */
  async deleteTerminalBefore(
    state: RequestState, before: string, limit: number,
  ): Promise<number>;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `store.test.ts`, inside the existing `it.each(databases.eachSupportedId())` style:

```ts
  it.each(databases.eachSupportedId())(
    'expires stale pending requests and clears their held secret, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const old = await store.create({
        kind: 'CREATE', resourceType: 'postgres', resourceName: 'old',
        params: {}, policy: { mode: 'SINGLE' }, requester: 'user:default/sam',
        secretEnc: 'cipher-text',
      } as any);
      const fresh = await store.create({
        kind: 'CREATE', resourceType: 'postgres', resourceName: 'fresh',
        params: {}, policy: { mode: 'SINGLE' }, requester: 'user:default/sam',
      } as any);

      // Backdate the first one past the cutoff.
      await store.testOnlySetUpdatedAt(old.id, '2020-01-01T00:00:00.000Z');

      const expired = await store.expireStale('2026-01-01T00:00:00.000Z');
      expect(expired).toBe(1);
      expect((await store.get(old.id))!.state).toBe('EXPIRED');
      expect((await store.get(fresh.id))!.state).toBe('PENDING_APPROVAL');
      // The held secret must not outlive the decision.
      expect(await store.getSecretEnc(old.id)).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'deletes terminal requests with their approvals, and nothing else, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const rejected = await store.create({
        kind: 'CREATE', resourceType: 'postgres', resourceName: 'gone',
        params: {}, policy: { mode: 'SINGLE' }, requester: 'user:default/sam',
      } as any);
      await store.addApproval(rejected.id, {
        approver: 'user:default/admin', decision: 'reject', at: new Date().toISOString(),
      } as any);
      await store.setState(rejected.id, 'REJECTED');
      await store.testOnlySetUpdatedAt(rejected.id, '2020-01-01T00:00:00.000Z');

      const inProgress = await store.create({
        kind: 'CREATE', resourceType: 'postgres', resourceName: 'live',
        params: {}, policy: { mode: 'SINGLE' }, requester: 'user:default/sam',
      } as any);
      await store.setState(inProgress.id, 'IN_PROGRESS');
      await store.testOnlySetUpdatedAt(inProgress.id, '2020-01-01T00:00:00.000Z');

      const n = await store.deleteTerminalBefore('REJECTED', '2026-01-01T00:00:00.000Z', 500);
      expect(n).toBe(1);
      expect(await store.get(rejected.id)).toBeUndefined();
      // Same age, different state: untouched.
      expect((await store.get(inProgress.id))!.state).toBe('IN_PROGRESS');
      // The approval went with it.
      expect(await store.testOnlyCountApprovals(rejected.id)).toBe(0);
    },
  );

  it.each(databases.eachSupportedId())(
    'honours the batch limit, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      for (let i = 0; i < 5; i++) {
        const r = await store.create({
          kind: 'CREATE', resourceType: 'postgres', resourceName: `r${i}`,
          params: {}, policy: { mode: 'SINGLE' }, requester: 'user:default/sam',
        } as any);
        await store.setState(r.id, 'REJECTED');
        await store.testOnlySetUpdatedAt(r.id, '2020-01-01T00:00:00.000Z');
      }
      expect(await store.deleteTerminalBefore('REJECTED', '2026-01-01T00:00:00.000Z', 2)).toBe(2);
      expect(await store.deleteTerminalBefore('REJECTED', '2026-01-01T00:00:00.000Z', 500)).toBe(3);
    },
  );
```

- [ ] **Step 2: Run them and watch them fail**

```bash
cd backstage && CI=true yarn test plugins/platform-requests-backend/src/store.test.ts
```

Expected: FAIL — `expireStale` is not a function.

- [ ] **Step 3: Implement the store methods**

```ts
  /**
   * PENDING_APPROVAL rows last touched before `before` become EXPIRED.
   *
   * The held secret is cleared in the same statement. A request nobody decided
   * must not keep its ciphertext: approve and reject both clear it, and expiry
   * is the third way a request ends.
   */
  async expireStale(before: string): Promise<number> {
    const now = new Date().toISOString();
    return this.db('platform_requests')
      .where('state', 'PENDING_APPROVAL')
      .andWhere('updated_at', '<', before)
      .update({ state: 'EXPIRED', secret_enc: null, updated_at: now });
  }

  /**
   * Delete up to `limit` rows in `state` last touched before `before`, with
   * their approvals. Callers must never pass a non-terminal state; the planner
   * is what guarantees that, and it is unit-tested.
   */
  async deleteTerminalBefore(
    state: RequestState,
    before: string,
    limit: number,
  ): Promise<number> {
    const rows = await this.db<{ id: number }>('platform_requests')
      .select('id')
      .where('state', state)
      .andWhere('updated_at', '<', before)
      .orderBy('id', 'asc')
      .limit(limit);
    const ids = rows.map(r => r.id);
    if (ids.length === 0) return 0;

    // Approvals first: the FK points at the request.
    await this.db('platform_approvals').whereIn('request_id', ids).del();
    return this.db('platform_requests').whereIn('id', ids).del();
  }
```

Add the two test-only helpers next to them, marked as such:

```ts
  /** Test-only: backdate a row so retention can be exercised without waiting. */
  async testOnlySetUpdatedAt(id: number, at: string): Promise<void> {
    await this.db('platform_requests').where({ id }).update({ updated_at: at });
  }

  /** Test-only: how many approvals a request still has. */
  async testOnlyCountApprovals(id: number): Promise<number> {
    const [{ c }] = await this.db('platform_approvals')
      .where({ request_id: id })
      .count({ c: '*' });
    return Number(c);
  }
```

- [ ] **Step 4: Run the tests**

```bash
cd backstage && CI=true yarn test plugins/platform-requests-backend/src/store.test.ts
```

Expected: PASS, including the three new cases.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-requests-backend/src/store.ts \
        backstage/plugins/platform-requests-backend/src/store.test.ts
git commit -m "feat(requests): store operations to expire and delete stale requests"
```

---

## Task 4: The scheduled task

**Files:**
- Modify: `plugins/platform-requests-backend/src/plugin.ts`
- Modify: `plugins/platform-requests-backend/config.d.ts`
- Modify: `backstage/app-config.yaml`

- [ ] **Step 1: Declare the config**

In `config.d.ts`, under `platform`:

```ts
    /** Request retention. Off by default — deleting rows is irreversible. */
    requests?: {
      retention?: {
        /** @default false */
        enabled?: boolean;
        /** Log what would be expired and deleted, change nothing. @default false */
        dryRun?: boolean;
        /** Rows deleted per state per run. @default 500 */
        batchSize?: number;
        /** Days a PENDING_APPROVAL waits before becoming EXPIRED. 0 disables. @default 14 */
        pendingExpiryDays?: number;
        /** @default 90 */
        succeededDays?: number;
        /** @default 90 */
        failedDays?: number;
        /** @default 30 */
        rejectedDays?: number;
        /** @default 30 */
        expiredDays?: number;
        frequency?: { hours?: number; minutes?: number; seconds?: number };
      };
    };
```

- [ ] **Step 2: Schedule the task**

In `plugin.ts`, after the secret sweep block:

```ts
        // Retention: expire undecided requests, then delete terminal ones past
        // their window. Off unless configured — see docs.
        const retention = readRetentionConfig(config);
        if (retention.enabled) {
          const freqCfg = config.getOptionalConfig(
            'platform.requests.retention.frequency',
          );
          await scheduler.scheduleTask({
            id: 'platform-requests-retention',
            frequency: freqCfg
              ? {
                  hours: freqCfg.getOptionalNumber('hours'),
                  minutes: freqCfg.getOptionalNumber('minutes'),
                  seconds: freqCfg.getOptionalNumber('seconds'),
                }
              : { hours: 6 },
            timeout: { minutes: 5 },
            fn: async () => {
              const plan = planRetention(retention, new Date());

              if (plan.expirePendingBefore) {
                if (retention.dryRun) {
                  const stale = await store.list({ state: 'PENDING_APPROVAL' });
                  const n = stale.filter(
                    r => r.updatedAt < plan.expirePendingBefore!,
                  ).length;
                  logger.info(`retention (dry run): would expire ${n} pending requests`);
                } else {
                  const n = await store.expireStale(plan.expirePendingBefore);
                  if (n > 0) logger.info(`retention: expired ${n} pending requests`);
                }
              }

              for (const { state, before } of plan.deleteBefore) {
                if (retention.dryRun) {
                  const rows = await store.list({ state });
                  const n = rows.filter(r => r.updatedAt < before).length;
                  logger.info(`retention (dry run): would delete ${n} ${state} requests`);
                  continue;
                }
                const n = await store.deleteTerminalBefore(
                  state,
                  before,
                  retention.batchSize,
                );
                if (n > 0) logger.info(`retention: deleted ${n} ${state} requests`);
              }
            },
          });
        }
```

Import `planRetention` and `readRetentionConfig` from `./retention`.

- [ ] **Step 3: Document it in app-config.yaml**

```yaml
  # Request retention. Off by default: deleting rows cannot be undone.
  # Expiry moves an undecided request to EXPIRED; the windows below then delete
  # terminal requests. APPROVED and IN_PROGRESS are never deleted.
  # requests:
  #   retention:
  #     enabled: true
  #     dryRun: false           # log what would go, change nothing
  #     frequency: { hours: 6 }
  #     pendingExpiryDays: 14   # PENDING_APPROVAL -> EXPIRED (0 = never)
  #     succeededDays: 90
  #     failedDays: 90
  #     rejectedDays: 30
  #     expiredDays: 30
```

- [ ] **Step 4: Verify the task registers, and that it does nothing by default**

```bash
cd backstage && yarn tsc && CI=true yarn test && yarn lint:all
```

Restart the dev server and confirm the log shows `platform-requests-argo-poll`
and `platform-requests-secret-sweep` registering but **not**
`platform-requests-retention` — the default is disabled.

Then enable it in `app-config.local.yaml` with `dryRun: true` and
`pendingExpiryDays: 0.0001`, restart, and confirm the log reports a would-expire
count without changing any row. Restore the file afterwards.

- [ ] **Step 5: Commit**

```bash
git add backstage/plugins/platform-requests-backend backstage/app-config.yaml
git commit -m "feat(requests): scheduled retention task with dry-run"
```

---

## Task 5: Documentation

**Files:**
- Modify: `docs/explanation/request-lifecycle.md`
- Modify: `docs/reference/configuration.md`
- Modify: `docs/how-to/prepare-for-production.md`

- [ ] **Step 1: Explain the lifecycle**

Add `EXPIRED` to the lifecycle page: what sets it, that it is terminal, and that
expiry clears the held secret exactly as reject does.

- [ ] **Step 2: Reference the config**

Add `platform.requests.retention` to the configuration reference, with the
default table and the note that `APPROVED` / `IN_PROGRESS` are never deleted.

- [ ] **Step 3: Add it to the production checklist**

`prepare-for-production.md` currently says nothing about retention. Add a line:
decide a retention policy, or state deliberately that requests are kept forever.

- [ ] **Step 4: Verify and commit**

```bash
cd .. && mkdocs build --strict --site-dir /tmp/docs-check
git add docs
git commit -m "docs: request retention and the EXPIRED state"
```

---

## Verification

- `yarn tsc`, `CI=true yarn test`, `yarn lint:all`, `yarn build:all` green.
- Default config: the retention task does not register; no row is ever deleted.
- `dryRun: true`: counts are logged, `SELECT count(*)` before and after is unchanged.
- Enabled: a backdated `PENDING_APPROVAL` becomes `EXPIRED` and its `secret_enc` is null.
- Enabled: a backdated `REJECTED` disappears with its approvals; a same-age `IN_PROGRESS` does not.
- `batchSize` caps a single run.
- The UI shows `EXPIRED` with its own sprite and badge.

## Not doing

- **Archiving.** Hard delete was chosen; an archive table only moves the growth.
- **Per-template or per-team windows.** One policy for the instance. Ask if a
  team needs to keep provisioning history longer than the platform default.
- **Deleting `IN_PROGRESS`**, however old. A stuck workflow is an operational
  problem to surface, not a row to remove — and the secret sweep depends on
  those ids.
- **Notifying requesters on expiry.** The notification plumbing exists
  (`notify.decided`), so it is a small follow-up if the lapse should reach the
  person who asked.
