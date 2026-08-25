import {
  DatabaseService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import {
  Approval,
  ApprovalPolicy,
  ArgoSubmitSpec,
  NewRequest,
  Request,
  RequestKind,
  RequestState,
  SecretFieldSpec,
  SuspendedNode,
} from '@internal/plugin-platform-common';

const migrationsDir = resolvePackagePath(
  '@internal/backstage-plugin-platform-requests-backend',
  'migrations',
);

type RequestRow = {
  id: number;
  kind: string;
  resource_type: string;
  resource_name: string;
  resource_names: string | null;
  params: string;
  state: string;
  policy: string;
  requester: string;
  owner_group: string | null;
  argo_submit: string | null;
  result_output: string | null;
  result_ref: string | null;
  workflow_name: string | null;
  workflow_namespace: string | null;
  workflow_phase: string | null;
  suspended_nodes: string | null;
  error: string | null;
  secret_spec: string | null;
  secret_name: string | null;
  // secret_enc is deliberately absent: it is read only via getSecretEnc, never
  // selected into a Request DTO (redaction by construction).
  created_at: string | Date;
  updated_at: string | Date;
};

type ApprovalRow = {
  id: number;
  request_id: number;
  approver: string;
  decision: string;
  note: string | null;
  created_at: string | Date;
};

const toIso = (v: string | Date): string =>
  v instanceof Date ? v.toISOString() : v;

/** Requests + approvals persistence backed by the plugin database. */
export class RequestsStore {
  private constructor(private readonly db: Knex) {}

  static async create(database: DatabaseService): Promise<RequestsStore> {
    const db = await database.getClient();
    await db.migrate.latest({ directory: migrationsDir });
    return new RequestsStore(db);
  }

  async create(
    input: NewRequest & {
      requester: string;
      ownerGroup?: string;
      /** Envelope-encrypted provided secret values (never plaintext). */
      secretEnc?: string;
    },
  ): Promise<Request> {
    const now = new Date().toISOString();
    const [row] = await this.db('platform_requests')
      .insert({
        kind: input.kind,
        resource_type: input.resourceType,
        resource_name: input.resourceName!,
        resource_names: input.resourceNames
          ? JSON.stringify(input.resourceNames)
          : null,
        params: JSON.stringify(input.params ?? {}),
        state: 'PENDING_APPROVAL',
        policy: JSON.stringify(input.policy ?? { mode: 'SINGLE' }),
        requester: input.requester,
        owner_group: input.ownerGroup ?? null,
        argo_submit: input.argoSubmit ? JSON.stringify(input.argoSubmit) : null,
        result_output: input.resultOutput ?? null,
        secret_spec: input.secretSpec ? JSON.stringify(input.secretSpec) : null,
        secret_enc: input.secretEnc ?? null,
        created_at: now,
        updated_at: now,
      })
      .returning('id');

    const id = typeof row === 'object' ? (row as { id: number }).id : row;
    return (await this.get(id))!;
  }

  async get(id: number): Promise<Request | undefined> {
    const row = await this.db<RequestRow>('platform_requests')
      .where({ id })
      .first();
    if (!row) return undefined;
    const approvals = await this.db<ApprovalRow>('platform_approvals')
      .where({ request_id: id })
      .orderBy('id', 'asc');
    return assemble(row, approvals);
  }

  async list(filter?: {
    state?: RequestState;
    /** Exact requester (the caller's own requests). */
    requester?: string;
    /** ownerGroup ∈ these groups (the caller's approval scope). */
    ownerGroups?: string[];
    /** requester = X OR ownerGroup ∈ groups (own + team-owned). */
    visibleTo?: { requester: string; ownerGroups: string[] };
  }): Promise<Request[]> {
    let q = this.db<RequestRow>('platform_requests');
    if (filter?.state) q = q.where('state', filter.state);
    if (filter?.requester) q = q.where('requester', filter.requester);
    if (filter?.ownerGroups) q = q.whereIn('owner_group', filter.ownerGroups);
    if (filter?.visibleTo) {
      const { requester, ownerGroups } = filter.visibleTo;
      q = q.where(b =>
        b.where('requester', requester).orWhereIn('owner_group', ownerGroups),
      );
    }
    const rows = await q.orderBy('id', 'asc');
    // ponytail: N+1 to join approvals; fine at this scale, batch if it grows.
    return Promise.all(rows.map(r => this.get(r.id) as Promise<Request>));
  }

  async addApproval(id: number, approval: Approval): Promise<void> {
    await this.db('platform_approvals').insert({
      request_id: id,
      approver: approval.approver,
      decision: approval.decision,
      note: approval.note ?? null,
      created_at: approval.at,
    });
  }

  /** Record the created-resource ref read from the workflow's output. */
  async setResult(id: number, resultRef: string): Promise<void> {
    await this.db('platform_requests')
      .where({ id })
      .update({ result_ref: resultRef, updated_at: new Date().toISOString() });
  }

  async setState(id: number, state: RequestState): Promise<void> {
    const update: Record<string, unknown> = {
      state,
      updated_at: new Date().toISOString(),
    };
    // A succeeded request has no failure reason. Enforced here rather than at
    // the call sites because every path that can reach SUCCEEDED — the poller,
    // the re-check route, and whatever is added next — goes through this one
    // method. null (not '') so `assemble`'s `row.error ?? undefined` actually
    // drops the field, rather than leaving a falsy-but-present empty string.
    if (state === 'SUCCEEDED') update.error = null;
    await this.db('platform_requests').where({ id }).update(update);
  }

  async setWorkflow(
    id: number,
    patch: {
      name?: string;
      namespace?: string;
      phase?: string;
      error?: string;
      /** Replaces the cached list wholesale; [] clears it. */
      suspendedNodes?: SuspendedNode[];
    },
  ): Promise<void> {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.workflow_name = patch.name;
    if (patch.namespace !== undefined) update.workflow_namespace = patch.namespace;
    if (patch.phase !== undefined) update.workflow_phase = patch.phase;
    if (patch.error !== undefined) update.error = patch.error;
    if (patch.suspendedNodes !== undefined) {
      update.suspended_nodes = JSON.stringify(patch.suspendedNodes);
    }
    await this.db('platform_requests').where({ id }).update(update);
  }

  /** The request's encrypted provided-secret blob, if any (approval-only read). */
  async getSecretEnc(id: number): Promise<string | undefined> {
    const row = await this.db<RequestRow>('platform_requests')
      .where({ id })
      .first('secret_enc as secret_enc');
    return (row as { secret_enc?: string | null })?.secret_enc ?? undefined;
  }

  /** Clear the encrypted blob (after it's written to the Secret, or on reject). */
  async clearSecretEnc(id: number): Promise<void> {
    await this.db('platform_requests')
      .where({ id })
      .update({ secret_enc: null, updated_at: new Date().toISOString() });
  }

  /** Record the per-request Secret's name (set at approval). */
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
   * their approvals. Callers must never pass a non-terminal state; planRetention
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

  /**
   * Delete one request and its approvals. Returns rows deleted (0 = gone
   * already).
   *
   * The caller decides whether the state permits it — `isDeletable` in the
   * router, `planRetention` for the sweep. Same ordering as
   * `deleteTerminalBefore`: approvals first, because the FK points at the
   * request.
   */
  async deleteById(id: number): Promise<number> {
    await this.db('platform_approvals').where({ request_id: id }).del();
    return this.db('platform_requests').where({ id }).del();
  }

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

  async setSecretName(id: number, name: string): Promise<void> {
    await this.db('platform_requests')
      .where({ id })
      .update({ secret_name: name, updated_at: new Date().toISOString() });
  }

  /**
   * A platform-wide setting, or undefined when never set.
   *
   * Values are text because the table is generic; each caller owns its own
   * parsing. `maintenance` stores 'true'/'false' and treats anything else,
   * including absence, as off — a malformed row must fail open rather than
   * locking the platform in maintenance with no way to read the switch.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const row = await this.db('platform_settings').where({ key }).first();
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db('platform_settings')
      .insert({ key, value })
      .onConflict('key')
      .merge();
  }
}

function assemble(row: RequestRow, approvals: ApprovalRow[]): Request {
  return {
    id: row.id,
    kind: row.kind as RequestKind,
    resourceType: row.resource_type,
    resourceName: row.resource_name,
    resourceNames: row.resource_names
      ? (JSON.parse(row.resource_names) as string[])
      : undefined,
    params: JSON.parse(row.params),
    state: row.state as RequestState,
    policy: JSON.parse(row.policy) as ApprovalPolicy,
    requester: row.requester,
    ownerGroup: row.owner_group ?? undefined,
    approvals: approvals.map(a => ({
      approver: a.approver,
      decision: a.decision as Approval['decision'],
      note: a.note ?? undefined,
      at: toIso(a.created_at),
    })),
    argoSubmit: row.argo_submit
      ? (JSON.parse(row.argo_submit) as ArgoSubmitSpec)
      : undefined,
    resultOutput: row.result_output ?? undefined,
    resultRef: row.result_ref ?? undefined,
    workflowName: row.workflow_name ?? undefined,
    workflowNamespace: row.workflow_namespace ?? undefined,
    workflowPhase: row.workflow_phase ?? undefined,
    suspendedNodes: row.suspended_nodes
      ? (JSON.parse(row.suspended_nodes) as SuspendedNode[])
      : undefined,
    error: row.error ?? undefined,
    secretSpec: row.secret_spec
      ? (JSON.parse(row.secret_spec) as SecretFieldSpec[])
      : undefined,
    secretName: row.secret_name ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
