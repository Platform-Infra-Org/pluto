import { randomBytes } from 'crypto';
import {
  CoreV1Api,
  KubeConfig,
  V1OwnerReference,
  V1Secret,
} from '@kubernetes/client-node';
import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';

// Labels/annotations we stamp on every request Secret so the sweep can find and
// reason about them without reading their contents.
const L_REQUEST_ID = 'platform.io/request-id';
const L_MANAGED = 'platform.io/managed-by';
const L_KEEP = 'platform.io/keep'; // resource-owned secrets opt out of the sweep
const A_CREATED_AT = 'platform.io/created-at';
const MANAGED_BY = 'platform-requests';

/** The Argo Workflow that owns a request's Secret (for the ownerReference). */
export interface OwnerWorkflow {
  name: string;
  uid: string;
  /** @default argoproj.io/v1alpha1 */
  apiVersion?: string;
  /** @default Workflow */
  kind?: string;
}

export interface SecretRef {
  name: string;
  keys: string[];
}

/**
 * Stores a request's secret values as a Kubernetes Secret, one per request,
 * owned by the request's Argo Workflow. See docs/SECRETS-LIFECYCLE.md.
 */
export interface SecretStore {
  readonly enabled: boolean;

  /**
   * An unguessable Secret name for a request. Generated *before* the Workflow is
   * submitted so it can be passed as a workflow parameter (the WorkflowTemplate
   * secretKeyRefs it), then handed back to {@link create} once the Workflow —
   * the Secret's owner — exists.
   */
  newName(requestId: number): string;

  /**
   * Create the request's Secret, owned by its Workflow (so Argo's ttlStrategy
   * cascade-deletes it). Returns the name + the keys stored.
   */
  create(opts: {
    name: string;
    requestId: number;
    data: Record<string, string>;
    owner: OwnerWorkflow;
    /** Resource-owned secret that should outlive the workflow (skips the sweep). */
    keep?: boolean;
  }): Promise<SecretRef>;

  /** Delete a Secret by name. Idempotent — a missing Secret is not an error. */
  delete(name: string): Promise<void>;

  /**
   * Safety net: delete managed request Secrets whose request is no longer active
   * (not in `activeRequestIds`) or that are older than `maxAgeMs`. Secrets
   * labelled keep are left alone. Returns how many were deleted.
   */
  sweep(opts: { activeRequestIds: Set<number>; maxAgeMs: number }): Promise<number>;
}

function statusCode(e: unknown): number | undefined {
  const any = e as {
    code?: unknown;
    statusCode?: unknown;
    response?: { statusCode?: unknown };
    body?: { code?: unknown };
  };
  const c =
    any?.code ?? any?.statusCode ?? any?.response?.statusCode ?? any?.body?.code;
  return typeof c === 'number' ? c : undefined;
}

/** Kubernetes-backed store: one Secret per request, owned by its Workflow. */
export class KubernetesSecretStore implements SecretStore {
  readonly enabled = true;

  constructor(
    private readonly api: CoreV1Api,
    private readonly namespace: string,
    private readonly logger: LoggerService,
    // Injectable clock for tests.
    private readonly now: () => number = () => Date.now(),
  ) {}

  newName(requestId: number): string {
    // Unguessable name; correlation is via the request-id label, not the name.
    return `platform-req-${requestId}-${randomBytes(6).toString('hex')}`;
  }

  async create(opts: {
    name: string;
    requestId: number;
    data: Record<string, string>;
    owner: OwnerWorkflow;
    keep?: boolean;
  }): Promise<SecretRef> {
    const { name, requestId, data, owner, keep } = opts;
    const ownerReference: V1OwnerReference = {
      apiVersion: owner.apiVersion ?? 'argoproj.io/v1alpha1',
      kind: owner.kind ?? 'Workflow',
      name: owner.name,
      uid: owner.uid,
      blockOwnerDeletion: true,
      controller: false,
    };
    const body: V1Secret = {
      metadata: {
        name,
        namespace: this.namespace,
        labels: {
          [L_REQUEST_ID]: String(requestId),
          [L_MANAGED]: MANAGED_BY,
          ...(keep ? { [L_KEEP]: 'true' } : {}),
        },
        annotations: { [A_CREATED_AT]: new Date(this.now()).toISOString() },
        ownerReferences: [ownerReference],
      },
      type: 'Opaque',
      // stringData: plaintext in, Kubernetes base64-encodes at rest.
      stringData: data,
    };
    await this.api.createNamespacedSecret({ namespace: this.namespace, body });
    this.logger.info(
      `created request Secret ${this.namespace}/${name} (request ${requestId}, ${
        Object.keys(data).length
      } key(s), owner Workflow ${owner.name})`,
    );
    return { name, keys: Object.keys(data) };
  }

  async delete(name: string): Promise<void> {
    try {
      await this.api.deleteNamespacedSecret({ name, namespace: this.namespace });
      this.logger.info(`deleted request Secret ${this.namespace}/${name}`);
    } catch (e) {
      if (statusCode(e) === 404) return; // already gone — idempotent
      throw e;
    }
  }

  async sweep(opts: {
    activeRequestIds: Set<number>;
    maxAgeMs: number;
  }): Promise<number> {
    const { activeRequestIds, maxAgeMs } = opts;
    const list = await this.api.listNamespacedSecret({
      namespace: this.namespace,
      labelSelector: `${L_MANAGED}=${MANAGED_BY}`,
    });
    let deleted = 0;
    for (const s of list.items ?? []) {
      const name = s.metadata?.name;
      if (!name) continue;
      if (s.metadata?.labels?.[L_KEEP] === 'true') continue; // resource-owned
      const reqId = Number(s.metadata?.labels?.[L_REQUEST_ID]);
      const createdAt = Date.parse(
        s.metadata?.annotations?.[A_CREATED_AT] ?? '',
      );
      const tooOld =
        Number.isFinite(createdAt) && this.now() - createdAt > maxAgeMs;
      const orphaned = Number.isFinite(reqId) && !activeRequestIds.has(reqId);
      if (tooOld || orphaned) {
        await this.delete(name);
        deleted++;
      }
    }
    if (deleted) {
      this.logger.info(`secret sweep deleted ${deleted} orphaned/expired Secret(s)`);
    }
    return deleted;
  }
}

/** No-op store used when platform.secrets is disabled. */
export class DisabledSecretStore implements SecretStore {
  readonly enabled = false;
  newName(requestId: number): string {
    return `platform-req-${requestId}`;
  }
  async create(): Promise<SecretRef> {
    throw new Error(
      'platform.secrets.enabled is false, but a request requires a secret — ' +
        'enable and configure platform.secrets',
    );
  }
  async delete(): Promise<void> {
    /* no-op */
  }
  async sweep(): Promise<number> {
    return 0;
  }
}

/** Build a SecretStore from config: Kubernetes-backed if enabled, else disabled. */
export function createSecretStore(opts: {
  config: RootConfigService;
  logger: LoggerService;
}): SecretStore {
  const { config, logger } = opts;
  if (!(config.getOptionalBoolean('platform.secrets.enabled') ?? false)) {
    return new DisabledSecretStore();
  }
  const namespace =
    config.getOptionalString('platform.secrets.namespace') ?? 'argo';
  const kc = new KubeConfig();
  kc.loadFromDefault(); // in-cluster SA token, or local kubeconfig in dev
  const api = kc.makeApiClient(CoreV1Api);
  logger.info(
    `platform secrets enabled: per-request Secrets in namespace '${namespace}'`,
  );
  return new KubernetesSecretStore(api, namespace, logger);
}
