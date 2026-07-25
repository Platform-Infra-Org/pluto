import { LoggerService } from '@backstage/backend-plugin-api';

export interface ArgoConfig {
  baseUrl: string;
  namespace: string;
  /** WorkflowTemplate used when no per-type template exists (P3 adds per-type). */
  defaultTemplate: string;
}

export interface WorkflowStatus {
  name?: string;
  phase?: string;
  message?: string;
}

/** A node in the workflow DAG, for the status view. */
export interface WorkflowNode {
  id: string;
  name: string;
  type?: string;
  phase?: string;
  children: string[];
}

/**
 * Thin client over the Argo Workflows REST API (argo-server). Submits a
 * WorkflowTemplate labelled with the request id and reads status back by that
 * label — the correlation mechanism for status + completion gating.
 */
export class ArgoClient {
  constructor(
    private readonly cfg: ArgoConfig,
    private readonly logger: LoggerService,
  ) {}

  label(requestId: number): string {
    return `platform.io/request-id=${requestId}`;
  }

  /** Submit the workflow for a request; returns the created workflow name. */
  async submit(
    resourceType: string,
    requestId: number,
    requestJson: string,
  ): Promise<string> {
    const submitWith = (template: string) =>
      fetch(`${this.cfg.baseUrl}/api/v1/workflows/${this.cfg.namespace}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceKind: 'WorkflowTemplate',
          resourceName: template,
          submitOptions: {
            labels: this.label(requestId),
            parameters: [`request=${requestJson}`],
          },
        }),
      });

    let res = await submitWith(resourceType);
    if (!res.ok && resourceType !== this.cfg.defaultTemplate) {
      this.logger.warn(
        `no WorkflowTemplate '${resourceType}' (${res.status}); using default '${this.cfg.defaultTemplate}'`,
      );
      res = await submitWith(this.cfg.defaultTemplate);
    }
    if (!res.ok) {
      throw new Error(`argo submit failed: ${res.status} ${await res.text()}`);
    }
    const wf = (await res.json()) as { metadata?: { name?: string } };
    const name = wf.metadata?.name;
    if (!name) throw new Error('argo submit returned no workflow name');
    return name;
  }

  /** Current status of the workflow for a request (by label), if any. */
  async statusFor(requestId: number): Promise<WorkflowStatus> {
    const sel = encodeURIComponent(this.label(requestId));
    const res = await fetch(
      `${this.cfg.baseUrl}/api/v1/workflows/${this.cfg.namespace}?listOptions.labelSelector=${sel}`,
    );
    if (!res.ok) throw new Error(`argo list failed: ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        metadata?: { name?: string };
        status?: { phase?: string; message?: string };
      }>;
    };
    const wf = data.items?.[0];
    return {
      name: wf?.metadata?.name,
      phase: wf?.status?.phase,
      message: wf?.status?.message,
    };
  }

  /** The workflow's DAG nodes (for the status view). Empty if not found. */
  async nodesFor(workflowName: string): Promise<WorkflowNode[]> {
    const res = await fetch(
      `${this.cfg.baseUrl}/api/v1/workflows/${this.cfg.namespace}/${workflowName}`,
    );
    if (!res.ok) return [];
    const wf = (await res.json()) as {
      status?: {
        nodes?: Record<
          string,
          {
            id: string;
            name?: string;
            displayName?: string;
            type?: string;
            phase?: string;
            children?: string[];
          }
        >;
      };
    };
    const nodes = wf.status?.nodes ?? {};
    return Object.values(nodes).map(n => ({
      id: n.id,
      name: n.displayName || n.name || n.id,
      type: n.type,
      phase: n.phase,
      children: n.children ?? [],
    }));
  }
}
