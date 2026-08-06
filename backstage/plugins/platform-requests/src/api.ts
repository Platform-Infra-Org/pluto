import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import {
  NewRequest,
  Request,
  SuspendedNode,
} from '@internal/plugin-platform-common';

export interface WorkflowNode {
  id: string;
  name: string;
  type?: string;
  phase?: string;
  children: string[];
}

export interface WorkflowInfo {
  phase?: string;
  name?: string;
  nodes: WorkflowNode[];
  /** Suspend steps waiting on an approver, with secret values already masked. */
  suspendedNodes?: SuspendedNode[];
}

/** What a resume attempt did. `resumed: false` means someone else got there. */
export interface ResumeResult {
  resumed: boolean;
  reason?: string;
  rejectedParameters?: string[];
  request: Request;
}

/** Client for the platform-requests backend. */
export interface RequestsApi {
  list(opts?: {
    state?: string;
    mine?: boolean;
    scope?: 'approval';
  }): Promise<Request[]>;
  get(id: number): Promise<Request>;
  create(body: NewRequest): Promise<Request>;
  approve(id: number, note?: string): Promise<Request>;
  reject(id: number, note?: string): Promise<Request>;
  getWorkflow(id: number): Promise<WorkflowInfo>;
  /** Release a suspended step, optionally answering what it asked. */
  resume(
    id: number,
    nodeId: string,
    opts?: { note?: string; parameters?: Record<string, string> },
  ): Promise<ResumeResult>;
  /** The resource's resolved data (ref'd file or spec.resourceData). */
  getResourceData(resourceName: string): Promise<Record<string, unknown>>;
}

export const requestsApiRef = createApiRef<RequestsApi>({
  id: 'plugin.platform-requests.api',
});

export class RequestsClient implements RequestsApi {
  constructor(
    private readonly opts: { discoveryApi: DiscoveryApi; fetchApi: FetchApi },
  ) {}

  private async base(): Promise<string> {
    return this.opts.discoveryApi.getBaseUrl('platform-requests');
  }

  private async json<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async list(opts?: {
    state?: string;
    mine?: boolean;
    scope?: 'approval';
  }): Promise<Request[]> {
    const q = new URLSearchParams();
    if (opts?.state) q.set('state', opts.state);
    if (opts?.mine) q.set('mine', '1');
    if (opts?.scope) q.set('scope', opts.scope);
    const url = `${await this.base()}/requests${q.toString() ? `?${q}` : ''}`;
    return this.json(await this.opts.fetchApi.fetch(url));
  }

  async get(id: number): Promise<Request> {
    return this.json(await this.opts.fetchApi.fetch(`${await this.base()}/requests/${id}`));
  }

  async getWorkflow(id: number): Promise<WorkflowInfo> {
    return this.json(
      await this.opts.fetchApi.fetch(`${await this.base()}/requests/${id}/workflow`),
    );
  }

  async getResourceData(
    resourceName: string,
  ): Promise<Record<string, unknown>> {
    return this.json(
      await this.opts.fetchApi.fetch(
        `${await this.base()}/resources/${encodeURIComponent(
          resourceName,
        )}/data`,
      ),
    );
  }

  async create(body: NewRequest): Promise<Request> {
    return this.json(
      await this.opts.fetchApi.fetch(`${await this.base()}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  private async decide(
    id: number,
    decision: 'approve' | 'reject',
    note?: string,
  ): Promise<Request> {
    return this.json(
      await this.opts.fetchApi.fetch(
        `${await this.base()}/requests/${id}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note }),
        },
      ),
    );
  }

  approve(id: number, note?: string) {
    return this.decide(id, 'approve', note);
  }
  reject(id: number, note?: string) {
    return this.decide(id, 'reject', note);
  }

  async resume(
    id: number,
    nodeId: string,
    opts: { note?: string; parameters?: Record<string, string> } = {},
  ): Promise<ResumeResult> {
    return this.json(
      await this.opts.fetchApi.fetch(
        `${await this.base()}/requests/${id}/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId, ...opts }),
        },
      ),
    );
  }
}
