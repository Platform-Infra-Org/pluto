import { LoggerService } from '@backstage/backend-plugin-api';
import { ArgoSubmitSpec } from '@internal/plugin-platform-common';

/** Values available to `<< token >>` templating in an ArgoSubmitSpec. */
export interface ResolveCtx {
  requestId: number;
  resourceName: string;
  resourceType: string;
  requester: string;
  params: Record<string, unknown>;
  /**
   * The resource's data JSON (for update/delete): the resolved
   * `platform.io/resource-data` annotation, else `spec.resourceData`, else `{}`.
   * Available as `<< resourceData >>` (full JSON) and `<< resourceData.field >>`.
   */
  resourceData?: Record<string, unknown>;
  /** Repo path of the resource's catalog file (`<< resourcePath >>`). */
  resourcePath?: string;
  /** Repo path of the resource's data file, from its ref (`<< resourceDataPath >>`). */
  resourceDataPath?: string;
}

/**
 * Resolve `<< token >>` occurrences in a string. Tokens: requestId,
 * resourceName, resourceType, requester, paramsJson, params.<field>.
 * Unknown tokens and missing params resolve to ''. Pure.
 *
 * The `<< >>` delimiter is deliberately distinct from Scaffolder's `${{ }}`,
 * so these tokens pass through the template's nunjucks render untouched and
 * are resolved here, at submit time, against the request's runtime context.
 */
export function resolveTemplate(str: string, ctx: ResolveCtx): string {
  return str.replace(/<<\s*([\w.]+)\s*>>/g, (_m, token: string) => {
    switch (token) {
      case 'requestId':
        return String(ctx.requestId);
      case 'resourceName':
        return ctx.resourceName;
      case 'resourceType':
        return ctx.resourceType;
      case 'requester':
        return ctx.requester;
      case 'paramsJson':
        return JSON.stringify(ctx.params ?? {});
      case 'resourceData':
        // Absent or empty resource data resolves to an empty JSON object.
        return JSON.stringify(ctx.resourceData ?? {});
      case 'resourcePath':
        return ctx.resourcePath ?? '';
      case 'resourceDataPath':
        return ctx.resourceDataPath ?? '';
      default: {
        if (token.startsWith('params.')) {
          const v = ctx.params?.[token.slice('params.'.length)];
          return v == null ? '' : String(v);
        }
        if (token.startsWith('resourceData.')) {
          const v = ctx.resourceData?.[token.slice('resourceData.'.length)];
          return v == null ? '' : String(v);
        }
        return '';
      }
    }
  });
}

/** Resolve every value of a string map. Pure. */
export function resolveMap(
  map: Record<string, string> | undefined,
  ctx: ResolveCtx,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    out[k] = resolveTemplate(v, ctx);
  }
  return out;
}

/** Render a map as Argo's `k1=v1,k2=v2` submitOptions string. */
function kvString(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

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
  /** The workflow's global output parameters (name -> value), if any. */
  outputs?: Record<string, string>;
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

  /**
   * Submit the workflow for a request from an optional per-request spec.
   * `spec` undefined = today's default (resourceType template, cfg.namespace,
   * `request` param, request-id label). Returns the created workflow name and
   * the namespace it landed in.
   */
  async submitSpec(
    spec: ArgoSubmitSpec | undefined,
    ctx: ResolveCtx,
  ): Promise<{ name: string; namespace: string }> {
    const namespace =
      (spec?.namespace && resolveTemplate(spec.namespace, ctx)) ||
      this.cfg.namespace;
    const resourceKind = spec?.resourceKind ?? 'WorkflowTemplate';
    const resourceName =
      (spec?.workflowTemplate && resolveTemplate(spec.workflowTemplate, ctx)) ||
      ctx.resourceType;

    const parameters = Object.entries(
      resolveMap(spec?.parameters ?? { request: '<< paramsJson >>' }, ctx),
    ).map(([k, v]) => `${k}=${v}`);

    // request-id label always wins (correlation key for status/completion).
    const labels = {
      ...resolveMap(spec?.labels, ctx),
      'platform.io/request-id': String(ctx.requestId),
    };
    const annotations = resolveMap(spec?.annotations, ctx);

    const submitOptions: Record<string, unknown> = {
      labels: kvString(labels),
      parameters,
    };
    if (spec?.entrypoint) {
      submitOptions.entryPoint = resolveTemplate(spec.entrypoint, ctx);
    }
    if (spec?.serviceAccount) {
      submitOptions.serviceAccount = resolveTemplate(spec.serviceAccount, ctx);
    }
    if (spec?.generateName) {
      submitOptions.generateName = resolveTemplate(spec.generateName, ctx);
    }
    if (Object.keys(annotations).length) {
      submitOptions.annotations = kvString(annotations);
    }

    const submitWith = (template: string) =>
      fetch(`${this.cfg.baseUrl}/api/v1/workflows/${namespace}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace,
          resourceKind,
          resourceName: template,
          submitOptions,
        }),
      });

    let res = await submitWith(resourceName);
    // Fallback to the default template ONLY when the caller did not pin a
    // workflowTemplate (preserves today's per-type-with-fallback behavior).
    if (
      !res.ok &&
      !spec?.workflowTemplate &&
      resourceName !== this.cfg.defaultTemplate
    ) {
      this.logger.warn(
        `no WorkflowTemplate '${resourceName}' (${res.status}); using default '${this.cfg.defaultTemplate}'`,
      );
      res = await submitWith(this.cfg.defaultTemplate);
    }
    if (!res.ok) {
      throw new Error(`argo submit failed: ${res.status} ${await res.text()}`);
    }
    const wf = (await res.json()) as { metadata?: { name?: string } };
    const name = wf.metadata?.name;
    if (!name) throw new Error('argo submit returned no workflow name');
    return { name, namespace };
  }

  /** Current status of the workflow for a request (by label), if any. */
  async statusFor(
    requestId: number,
    namespace: string = this.cfg.namespace,
  ): Promise<WorkflowStatus> {
    const sel = encodeURIComponent(this.label(requestId));
    const res = await fetch(
      `${this.cfg.baseUrl}/api/v1/workflows/${namespace}?listOptions.labelSelector=${sel}`,
    );
    if (!res.ok) throw new Error(`argo list failed: ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        metadata?: { name?: string };
        status?: {
          phase?: string;
          message?: string;
          outputs?: { parameters?: Array<{ name?: string; value?: string }> };
        };
      }>;
    };
    const wf = data.items?.[0];
    const outputs: Record<string, string> = {};
    for (const p of wf?.status?.outputs?.parameters ?? []) {
      if (p.name != null && p.value != null) outputs[p.name] = p.value;
    }
    return {
      name: wf?.metadata?.name,
      phase: wf?.status?.phase,
      message: wf?.status?.message,
      outputs,
    };
  }

  /**
   * All output parameters of a finished workflow (name -> value). The contract
   * is that a workflow exposes result values as **global** outputs (an output
   * parameter with `globalName`), which land in `status.outputs.parameters`.
   * We also scan node outputs as a forgiving fallback for workflows that omit
   * `globalName` (global wins on collision).
   */
  async outputsFor(
    workflowName: string,
    namespace: string = this.cfg.namespace,
  ): Promise<Record<string, string>> {
    const res = await fetch(
      `${this.cfg.baseUrl}/api/v1/workflows/${namespace}/${workflowName}`,
    );
    if (!res.ok) return {};
    const wf = (await res.json()) as {
      status?: {
        outputs?: { parameters?: Array<{ name?: string; value?: string }> };
        nodes?: Record<
          string,
          { outputs?: { parameters?: Array<{ name?: string; value?: string }> } }
        >;
      };
    };
    const out: Record<string, string> = {};
    const add = (
      params?: Array<{ name?: string; value?: string }>,
    ): void => {
      for (const p of params ?? []) {
        if (p.name != null && p.value != null) out[p.name] = p.value;
      }
    };
    for (const n of Object.values(wf.status?.nodes ?? {})) {
      add(n.outputs?.parameters);
    }
    add(wf.status?.outputs?.parameters); // global wins on collision
    return out;
  }

  /** The workflow's DAG nodes (for the status view). Empty if not found. */
  async nodesFor(
    workflowName: string,
    namespace: string = this.cfg.namespace,
  ): Promise<WorkflowNode[]> {
    const res = await fetch(
      `${this.cfg.baseUrl}/api/v1/workflows/${namespace}/${workflowName}`,
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
