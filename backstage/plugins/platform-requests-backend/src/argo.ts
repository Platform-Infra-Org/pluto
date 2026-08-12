import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  ArgoSubmitSpec,
  SuspendedNode,
} from '@internal/plugin-platform-common';
import { paramsToArgo } from './paramsToArgo';

/** Values available to `<< token >>` templating in an ArgoSubmitSpec. */
export interface ResolveCtx {
  requestId: number;
  resourceName: string;
  resourceType: string;
  requester: string;
  /**
   * The owning service team (`<< ownerGroup >>`), resolved at creation from the
   * `spec.owner` of the Template for this resourceType — the same value the
   * approval gate is enforced on, so a workflow that labels or notifies by
   * owner names the team that actually approved it.
   *
   * Absent when no owning template was found, which is the case that makes a
   * request admin-only. It then resolves to '' like any other missing token: a
   * workflow that cannot act without an owner should fail on the empty string
   * rather than proceed with one it invented.
   */
  ownerGroup?: string;
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
  /**
   * Name of the per-request Kubernetes Secret (`<< secretName >>`), so the
   * WorkflowTemplate can `secretKeyRef` it. Pre-generated before submit.
   */
  secretName?: string;
  /**
   * The whole catalog entity for the resource, as the catalog parsed it —
   * `<< entityJson >>` for all of it, `<< entity.<path> >>` for one field.
   * Absent for CREATE, which has no entity yet.
   *
   * This is the escape hatch for anything the named tokens do not cover
   * (`spec.system`, `spec.type`, a `platform.io/*` annotation), so a template
   * needing one more field of the entity does not need a backend change.
   */
  entity?: Record<string, unknown>;
  /**
   * Every resource a bulk request acts on (`<< resourcesJson >>`), resolved at
   * submit time. Absent for a single-resource request.
   *
   * `data` is a nested **object**, not a JSON string. This was verified against
   * a live Argo rather than reasoned about, because the intuition points the
   * wrong way: substituting `{{item.data}}` happens inside a JSON string
   * context, so a *string* field has its quotes escaped and arrives as
   * `{\"region\":\"eu\"}` — which no consumer can pipe to `jq`. An object field
   * is serialized properly and arrives as clean JSON.
   */
  resources?: Array<{
    name: string;
    path: string;
    dataPath: string;
    data: Record<string, unknown>;
    /** The resource's own `spec.owner`; '' when it has none. */
    owner: string;
  }>;
}

/**
 * Walk a dotted path into a parsed object. Absent -> undefined.
 *
 * Longest key first at every level, because catalog keys contain dots
 * themselves: `metadata.annotations.platform.io/resource-data` has to find the
 * key `platform.io/resource-data`, not an object called `platform`. A plain
 * `split('.')` walk resolves every annotation to '' — silently, which is the
 * worst way for a template to be wrong.
 */
function pick(obj: unknown, path: string): unknown {
  if (!path) return obj;
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  const parts = path.split('.');
  for (let i = parts.length; i > 0; i--) {
    const key = parts.slice(0, i).join('.');
    if (key in rec) {
      const v = pick(rec[key], parts.slice(i).join('.'));
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

/**
 * Resolve `<< token >>` occurrences in a string. Tokens: requestId,
 * resourceName, resourceType, requester, ownerGroup, paramsJson,
 * params.<field>, entity.<path>. Unknown tokens and missing params resolve to
 * ''. Pure.
 *
 * The `<< >>` delimiter is deliberately distinct from Scaffolder's `${{ }}`,
 * so these tokens pass through the template's nunjucks render untouched and
 * are resolved here, at submit time, against the request's runtime context.
 *
 * The token charset allows `/` and `-` so annotation keys are reachable
 * (`<< entity.metadata.annotations.platform.io/resource-data >>`).
 */
export function resolveTemplate(str: string, ctx: ResolveCtx): string {
  return str.replace(/<<\s*([\w./-]+)\s*>>/g, (_m, token: string) => {
    switch (token) {
      case 'requestId':
        return String(ctx.requestId);
      case 'resourceName':
        return ctx.resourceName;
      case 'resourceType':
        return ctx.resourceType;
      case 'requester':
        return ctx.requester;
      case 'ownerGroup':
        return ctx.ownerGroup ?? '';
      case 'paramsJson':
        return JSON.stringify(ctx.params ?? {});
      case 'resourceData':
        // Absent or empty resource data resolves to an empty JSON object.
        return JSON.stringify(ctx.resourceData ?? {});
      case 'resourcesJson':
        return JSON.stringify(ctx.resources ?? []);
      case 'resourcePath':
        return ctx.resourcePath ?? '';
      case 'resourceDataPath':
        return ctx.resourceDataPath ?? '';
      case 'secretName':
        return ctx.secretName ?? '';
      case 'entityJson':
        return JSON.stringify(ctx.entity ?? {});
      default: {
        if (token.startsWith('params.')) {
          const v = ctx.params?.[token.slice('params.'.length)];
          return v === null || v === undefined ? '' : String(v);
        }
        if (token.startsWith('resourceData.')) {
          const v = ctx.resourceData?.[token.slice('resourceData.'.length)];
          return v === null || v === undefined ? '' : String(v);
        }
        if (token.startsWith('entity.')) {
          const v = pick(ctx.entity, token.slice('entity.'.length));
          if (v === null || v === undefined) return '';
          // A sub-object renders as JSON, not `[object Object]`, so
          // `<< entity.metadata.annotations >>` is usable as a workflow
          // parameter. The older `params.`/`resourceData.` tokens keep
          // `String()` — a template relying on an array rendering as `a,b`
          // must not change shape under it.
          return typeof v === 'object' ? JSON.stringify(v) : String(v);
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
  /**
   * If set, Argo REST calls go through the Backstage proxy at this path (e.g.
   * `/argo-workflows`) instead of `baseUrl` directly. The proxy endpoint
   * (`proxy.endpoints.<proxyPath>`) targets the real argo-server and injects
   * auth (token/mTLS) server-side — so credentials never live in this plugin.
   * Leave unset for a direct, unauthenticated dev argo-server.
   */
  proxyPath?: string;
}

/** Services the ArgoClient needs to reach argo-server through the proxy. */
export interface ArgoDeps {
  discovery: DiscoveryService;
  auth: AuthService;
}

export interface WorkflowStatus {
  name?: string;
  phase?: string;
  message?: string;
  /** The workflow's global output parameters (name -> value), if any. */
  outputs?: Record<string, string>;
  /** Suspend steps currently waiting. Empty when none are. */
  suspendedNodes: SuspendedNode[];
}

/** The subset of an Argo status node this plugin reads. */
export interface ArgoStatusNode {
  id: string;
  name?: string;
  displayName?: string;
  type?: string;
  phase?: string;
  message?: string;
  templateName?: string;
  children?: string[];
  inputs?: { parameters?: Array<{ name?: string; value?: string }> };
  outputs?: {
    parameters?: Array<{
      name?: string;
      value?: string;
      default?: string;
      description?: string;
      enum?: string[];
      valueFrom?: { supplied?: unknown };
    }>;
  };
}

/**
 * The suspend steps that are currently waiting.
 *
 * Argo has no "Suspended" phase: a waiting suspend node reports
 * `type: 'Suspend'` with `phase: 'Running'`, the same phase a busy container
 * step reports. Detection is the pair or nothing.
 *
 * A supplied output with a `default` can be resumed without an answer; one
 * without a default cannot. That is Argo's own semantics, so `required` is read
 * off the workflow rather than configured anywhere in this platform.
 */
export function suspendedNodesOf(
  nodes: Record<string, ArgoStatusNode> | undefined,
): SuspendedNode[] {
  return Object.values(nodes ?? {})
    .filter(n => n.type === 'Suspend' && n.phase === 'Running')
    .map(n => ({
      id: n.id,
      name: n.displayName || n.name || n.id,
      templateName: n.templateName,
      message: n.message,
      inputs: (n.inputs?.parameters ?? [])
        .filter(pp => pp.name !== undefined)
        .map(pp => ({ name: pp.name as string, value: pp.value })),
      // Only outputs the step declared as `valueFrom: supplied: {}` may be set
      // on resume. Argo rejects anything else, and offering a field the API
      // refuses is worse than offering none.
      suppliedOutputs: (n.outputs?.parameters ?? [])
        .filter(pp => pp.name !== undefined && pp.valueFrom?.supplied !== undefined)
        .map(pp => ({
          name: pp.name as string,
          description: pp.description,
          // Argo parameters carry enum/description/default of their own, so the
          // form is described by the workflow rather than configured here.
          enum: pp.enum?.length ? pp.enum : undefined,
          default: pp.default,
          required: pp.default === undefined,
        })),
    }));
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
    private readonly deps?: ArgoDeps,
  ) {}

  label(requestId: number): string {
    return `platform.io/request-id=${requestId}`;
  }

  /**
   * Base URL + headers for an argo-server call. With `proxyPath` set, routes
   * through the Backstage proxy (which injects the upstream Argo auth) using a
   * service token; otherwise hits `baseUrl` directly (dev).
   */
  private async endpoint(): Promise<{
    base: string;
    headers: Record<string, string>;
  }> {
    if (this.cfg.proxyPath && this.deps) {
      const proxyBase = await this.deps.discovery.getBaseUrl('proxy');
      const { token } = await this.deps.auth.getPluginRequestToken({
        onBehalfOf: await this.deps.auth.getOwnServiceCredentials(),
        targetPluginId: 'proxy',
      });
      return {
        base: `${proxyBase}${this.cfg.proxyPath}`,
        headers: { Authorization: `Bearer ${token}` },
      };
    }
    return { base: this.cfg.baseUrl, headers: {} };
  }

  /**
   * Submit the workflow for a request from an optional per-request spec.
   * `spec` undefined = the resourceType template in cfg.namespace, every
   * request param forwarded as its own Argo parameter, request-id label.
   * Returns the created workflow name and the namespace it landed in.
   */
  async submitSpec(
    spec: ArgoSubmitSpec | undefined,
    ctx: ResolveCtx,
  ): Promise<{ name: string; namespace: string; uid?: string }> {
    const namespace =
      (spec?.namespace && resolveTemplate(spec.namespace, ctx)) ||
      this.cfg.namespace;
    const resourceKind = spec?.resourceKind ?? 'WorkflowTemplate';
    const resourceName =
      (spec?.workflowTemplate && resolveTemplate(spec.workflowTemplate, ctx)) ||
      ctx.resourceType;

    // Forwarded request params first, explicit `parameters` last: naming a
    // parameter in the spec overrides the forwarded value of the same name.
    // There is no implicit `request` blob any more — a template declares the
    // fields it reads, and one it does not declare is Argo's to reject.
    const auto =
      spec?.forwardParams === false ? {} : paramsToArgo(ctx.params ?? {});
    const parameters = Object.entries({
      ...auto,
      ...resolveMap(spec?.parameters, ctx),
    }).map(([k, v]) => `${k}=${v}`);

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

    const { base, headers } = await this.endpoint();
    const submitWith = (template: string) =>
      fetch(`${base}/api/v1/workflows/${namespace}/submit`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
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
    const wf = (await res.json()) as {
      metadata?: { name?: string; uid?: string };
    };
    const name = wf.metadata?.name;
    if (!name) throw new Error('argo submit returned no workflow name');
    return { name, namespace, uid: wf.metadata?.uid };
  }

  /** Current status of the workflow for a request (by label), if any. */
  async statusFor(
    requestId: number,
    namespace: string = this.cfg.namespace,
  ): Promise<WorkflowStatus> {
    const sel = encodeURIComponent(this.label(requestId));
    const { base, headers } = await this.endpoint();
    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}?listOptions.labelSelector=${sel}`,
      { headers },
    );
    if (!res.ok) throw new Error(`argo list failed: ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        metadata?: { name?: string; creationTimestamp?: string };
        status?: {
          phase?: string;
          message?: string;
          outputs?: { parameters?: Array<{ name?: string; value?: string }> };
          nodes?: Record<string, ArgoStatusNode>;
        };
      }>;
    };
    // A resubmit creates a NEW workflow and copies the request-id label, so more
    // than one item can match the selector. The newest is the live one. Argo
    // happens to list newest-first, but that is its default ordering and not a
    // documented contract, so sort instead of trusting it. RFC3339 timestamps
    // compare correctly as strings; a missing one sorts last rather than
    // throwing, since a malformed item must not hide a good one.
    const wf = [...(data.items ?? [])].sort((a, b) =>
      (b.metadata?.creationTimestamp ?? '').localeCompare(
        a.metadata?.creationTimestamp ?? '',
      ),
    )[0];
    const outputs: Record<string, string> = {};
    for (const p of wf?.status?.outputs?.parameters ?? []) {
      if (p.name !== undefined && p.value !== undefined) outputs[p.name] = p.value;
    }
    return {
      name: wf?.metadata?.name,
      phase: wf?.status?.phase,
      message: wf?.status?.message,
      outputs,
      // The list response already carries status.nodes, so noticing a suspend
      // step costs no extra request — it was being parsed away.
      suspendedNodes: suspendedNodesOf(wf?.status?.nodes),
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
    const { base, headers } = await this.endpoint();
    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}/${workflowName}`,
      { headers },
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
        if (p.name !== undefined && p.value !== undefined) out[p.name] = p.value;
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
    const { base, headers } = await this.endpoint();
    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}/${workflowName}`,
      { headers },
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

  /** Suspend steps waiting in a named workflow, read fresh. */
  async suspendedNodesFor(
    workflowName: string,
    namespace: string = this.cfg.namespace,
  ): Promise<SuspendedNode[]> {
    const { base, headers } = await this.endpoint();
    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}/${workflowName}`,
      { headers },
    );
    if (!res.ok) return [];
    const wf = (await res.json()) as {
      status?: { nodes?: Record<string, ArgoStatusNode> };
    };
    return suspendedNodesOf(wf.status?.nodes);
  }

  /**
   * Stop the workflow: the approver refused the gate.
   *
   * `/stop` rather than `/terminate` — it lets `onExit` handlers run, which is
   * how a workflow cleans up what it already created. Terminate would leave
   * half-provisioned resources behind with nothing to tidy them.
   */
  async stopWorkflow(
    workflowName: string,
    opts: { namespace?: string; message?: string } = {},
  ): Promise<void> {
    const namespace = opts.namespace ?? this.cfg.namespace;
    const { base, headers } = await this.endpoint();
    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}/${workflowName}/stop`,
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace,
          name: workflowName,
          message: opts.message,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`argo stop failed: ${res.status} ${await res.text()}`);
    }
    this.logger.info(`stopped ${workflowName}: ${opts.message ?? 'no reason given'}`);
  }

  /**
   * Release one suspended node, optionally answering the questions it asked.
   *
   * Two calls, in this order and not the other one. `/set` supplies the values
   * the step declared as `valueFrom: supplied: {}`; `/resume` releases it. If
   * `/set` fails we stop, leaving the node suspended and retryable. Resuming
   * first and failing to set would let the workflow continue without the
   * answer, which nothing downstream can undo.
   *
   * The selector is `id=` and never `displayName=`: a suspend step inside a
   * loop produces several nodes sharing a display name, and releasing the wrong
   * iteration fails silently.
   */
  async resumeNode(
    workflowName: string,
    nodeId: string,
    opts: {
      namespace?: string;
      outputParameters?: Record<string, string>;
    } = {},
  ): Promise<void> {
    const namespace = opts.namespace ?? this.cfg.namespace;
    const { base, headers } = await this.endpoint();
    const json = { ...headers, 'Content-Type': 'application/json' };
    const nodeFieldSelector = `id=${nodeId}`;

    const supplied = Object.entries(opts.outputParameters ?? {});
    if (supplied.length > 0) {
      const res = await fetch(
        `${base}/api/v1/workflows/${namespace}/${workflowName}/set`,
        {
          method: 'PUT',
          headers: json,
          body: JSON.stringify({
            namespace,
            name: workflowName,
            nodeFieldSelector,
            // A JSON object encoded as a string, not the CLI's k=v form:
            // argo-server JSON-parses this field, and `decision=x` fails with
            // "invalid character 'd' looking for beginning of value".
            outputParameters: JSON.stringify(Object.fromEntries(supplied)),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(
          `argo set outputs failed: ${res.status} ${await res.text()}`,
        );
      }
    }

    const res = await fetch(
      `${base}/api/v1/workflows/${namespace}/${workflowName}/resume`,
      {
        method: 'PUT',
        headers: json,
        body: JSON.stringify({ namespace, name: workflowName, nodeFieldSelector }),
      },
    );
    if (!res.ok) {
      throw new Error(`argo resume failed: ${res.status} ${await res.text()}`);
    }
    this.logger.info(
      `resumed ${workflowName} node ${nodeId}${
        supplied.length ? ` with ${supplied.length} supplied output(s)` : ''
      }`,
    );
  }
}
