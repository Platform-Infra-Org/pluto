import {
  DatabaseService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { Knex } from 'knex';
import {
  Approval,
  ApprovalPolicy,
  NewRequest,
  Request,
  RequestKind,
  RequestState,
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
  params: string;
  state: string;
  policy: string;
  requester: string;
  workflow_name: string | null;
  workflow_phase: string | null;
  error: string | null;
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

  async create(input: NewRequest & { requester: string }): Promise<Request> {
    const now = new Date().toISOString();
    const [row] = await this.db('platform_requests')
      .insert({
        kind: input.kind,
        resource_type: input.resourceType,
        resource_name: input.resourceName,
        params: JSON.stringify(input.params ?? {}),
        state: 'PENDING_APPROVAL',
        policy: JSON.stringify(input.policy ?? { mode: 'SINGLE' }),
        requester: input.requester,
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
    requester?: string;
  }): Promise<Request[]> {
    let q = this.db<RequestRow>('platform_requests');
    if (filter?.state) q = q.where('state', filter.state);
    if (filter?.requester) q = q.where('requester', filter.requester);
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

  async setState(id: number, state: RequestState): Promise<void> {
    await this.db('platform_requests')
      .where({ id })
      .update({ state, updated_at: new Date().toISOString() });
  }

  async setWorkflow(
    id: number,
    patch: { name?: string; phase?: string; error?: string },
  ): Promise<void> {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) update.workflow_name = patch.name;
    if (patch.phase !== undefined) update.workflow_phase = patch.phase;
    if (patch.error !== undefined) update.error = patch.error;
    await this.db('platform_requests').where({ id }).update(update);
  }
}

function assemble(row: RequestRow, approvals: ApprovalRow[]): Request {
  return {
    id: row.id,
    kind: row.kind as RequestKind,
    resourceType: row.resource_type,
    resourceName: row.resource_name,
    params: JSON.parse(row.params),
    state: row.state as RequestState,
    policy: JSON.parse(row.policy) as ApprovalPolicy,
    requester: row.requester,
    approvals: approvals.map(a => ({
      approver: a.approver,
      decision: a.decision as Approval['decision'],
      note: a.note ?? undefined,
      at: toIso(a.created_at),
    })),
    workflowName: row.workflow_name ?? undefined,
    workflowPhase: row.workflow_phase ?? undefined,
    error: row.error ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}
