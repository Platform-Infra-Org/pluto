import {
  BackstageCredentials,
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  Request as PlatformRequest,
  RequestState,
  SuspendedNode,
} from '@internal/plugin-platform-common';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod/v3';
import { requestApprovePermission, requestCreatePermission } from './permissions';
import { applyDecision } from './stateMachine';
import { RequestsStore } from './store';
import { Cipher } from './crypto';
import { maskSuspendInputs, filterSuppliedOutputs } from './suspend';

/**
 * Resolves the acting user's admin flag + raw group memberships (from their
 * catalog ownership), for per-team approval decisions and list scoping.
 */
export type PrincipalResolver = (
  credentials: BackstageCredentials,
) => Promise<{ isAdmin: boolean; groups: string[] }>;

export interface RouterOptions {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  store: RequestsStore;
  /** Resolves the acting user's roles + groups (per-team approval). */
  principalResolver?: PrincipalResolver;
  /** Resolves the owning service team (group ref) for a resourceType. */
  ownerResolver?: (resourceType: string) => Promise<string | undefined>;
  /** Resolves per-verb Argo submit config for UPDATE/DELETE (from the template). */
  verbConfigResolver?: (
    resourceType: string,
    kind: string,
  ) => Promise<{ argoSubmit?: unknown; resultOutput?: string } | undefined>;
  /** Resolves a resource's data (from its ref'd file or spec.resourceData). */
  resourceDataFor?: (
    resourceName: string,
  ) => Promise<Record<string, unknown>>;
  /** Called on APPROVED before flipping to IN_PROGRESS. No-op until P2. */
  submitWorkflow?: (request: PlatformRequest) => Promise<void>;
  /** Envelope cipher for user-provided secrets; absent when no key is configured. */
  cipher?: Cipher;
  /** Whether platform.secrets is enabled (gates requests that need a Secret). */
  secretsEnabled?: boolean;
  /** Called after a request is created (for approver notifications). */
  onCreated?: (request: PlatformRequest) => Promise<void>;
  /** Called after an approve/reject decision resolves (for requester alerts). */
  onDecided?: (request: PlatformRequest) => Promise<void>;
  /** Resolve a workflow's DAG nodes for the status view. */
  workflowNodesFor?: (name: string, namespace?: string) => Promise<
    { id: string; name: string; type?: string; phase?: string; children: string[] }[]
  >;
  /** Read the suspend steps currently waiting, straight from Argo. */
  suspendedNodesFor?: (
    name: string,
    namespace?: string,
  ) => Promise<SuspendedNode[]>;
  /** Release one suspended node, optionally supplying its declared outputs. */
  resumeNode?: (
    name: string,
    nodeId: string,
    opts: { namespace?: string; outputParameters?: Record<string, string> },
  ) => Promise<void>;
}

const policySchema = z.union([
  z.object({ mode: z.literal('SINGLE') }),
  z.object({ mode: z.literal('N_OF_M'), n: z.number().int().min(1) }),
]);

const newRequestSchema = z.object({
  kind: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  resourceType: z.string(),
  resourceName: z.string(),
  params: z.record(z.unknown()).optional(),
  policy: policySchema.optional(),
  // Loose: the spec is validated/normalized when building the Argo submit body.
  argoSubmit: z.record(z.any()).optional(),
  // Argo output parameter to read on success (created resource ref/URL).
  resultOutput: z.string().optional(),
  // Secret fields to materialise at approval (see SecretFieldSpec).
  secretSpec: z
    .array(
      z.object({
        name: z.string(),
        source: z.enum(['generate', 'provided']),
        length: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  // Plaintext values for `provided` secret fields. Encrypted the instant they
  // arrive and never persisted in the clear; dropped from the stored request.
  secretValues: z.record(z.string()).optional(),
  // Only honored for service callers (the Scaffolder action creating on behalf
  // of the initiating user); ignored for user callers (requester = the actor).
  requester: z.string().optional(),
});

const decisionSchema = z.object({ note: z.string().optional() });

const resumeSchema = z.object({
  nodeId: z.string().min(1),
  note: z.string().optional(),
  /** Values for outputs the step declared as `supplied`; anything else is dropped. */
  parameters: z.record(z.string()).optional(),
});

/**
 * Every request that leaves the backend goes through here.
 *
 * Suspend-step inputs are workflow-authored and can carry a credential, and the
 * approval panel is the one screen a human is certainly reading. Masking at the
 * point of use was the first attempt and it leaked immediately: the panel reads
 * the request DTO while only the /workflow endpoint had been masked. There is
 * one trust boundary, so there is one redaction.
 */
function toClient(request: PlatformRequest): PlatformRequest {
  if (!request.suspendedNodes?.length) return request;
  return {
    ...request,
    suspendedNodes: maskSuspendInputs(request.suspendedNodes, request.secretSpec),
  };
}

/** `user:default/admin` -> `admin`. */
function actorId(userEntityRef: string): string {
  return userEntityRef.split('/').pop()!.split(':')[0];
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { httpAuth, permissions, store } = options;
  const principalResolver: PrincipalResolver =
    options.principalResolver ?? (async () => ({ isAdmin: false, groups: [] }));
  const submitWorkflow =
    options.submitWorkflow ?? (async () => undefined);
  const cipher: Cipher | undefined = options.cipher;

  const router = Router();
  router.use(express.json());

  // User identity for approval/creation; throws for non-user callers.
  const actorOf = async (req: express.Request) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    return { credentials, actor: actorId(credentials.principal.userEntityRef) };
  };

  router.post('/requests', async (req, res) => {
    const parsed = newRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new InputError(parsed.error.toString());
    const { requester: onBehalf, secretValues, ...data } = parsed.data;

    // A request that needs a Secret is only accepted when secrets are enabled —
    // fail at submit, not silently at approval.
    if (data.secretSpec?.length && options.secretsEnabled === false) {
      throw new InputError(
        'this request requires secrets but platform.secrets is disabled',
      );
    }
    // Encrypt provided values immediately; plaintext is never stored, and
    // `secretValues` is dropped from the persisted request entirely.
    let secretEnc: string | undefined;
    const provided = (data.secretSpec ?? []).filter(f => f.source === 'provided');
    if (provided.length) {
      const values: Record<string, string> = {};
      for (const f of provided) {
        const v = secretValues?.[f.name];
        if (v === undefined) {
          throw new InputError(`missing value for provided secret '${f.name}'`);
        }
        values[f.name] = v;
      }
      if (!cipher) {
        throw new Error(
          'a request supplies a provided secret but platform.secrets.encryptionKey is unset',
        );
      }
      secretEnc = cipher.encrypt(JSON.stringify(values));
    }

    // Service callers (the Scaffolder action) create on behalf of a named user;
    // user callers create for themselves and must hold the create permission.
    const credentials = await httpAuth.credentials(req, {
      allow: ['user', 'service'],
    });
    let requester: string;
    if (credentials.principal.type === 'service') {
      if (!onBehalf) {
        throw new InputError('service callers must set `requester`');
      }
      requester = onBehalf;
    } else {
      requester = actorId(credentials.principal.userEntityRef);
      const [decision] = await permissions.authorize(
        [{ permission: requestCreatePermission }],
        { credentials },
      );
      if (decision.result !== AuthorizeResult.ALLOW) {
        throw new NotAllowedError('Not allowed to create requests');
      }
    }
    // The owning service team = the owner of the Template for this resourceType.
    const ownerGroup = options.ownerResolver
      ? await options.ownerResolver(data.resourceType)
      : undefined;

    // UPDATE/DELETE with no explicit argoSubmit → resolve the template's per-verb
    // workflow config (so edit/delete hit their own workflow, not create's).
    let argoSubmit: Record<string, unknown> | undefined = data.argoSubmit;
    let resultOutput: string | undefined = data.resultOutput;
    if (
      !argoSubmit &&
      (data.kind === 'UPDATE' || data.kind === 'DELETE') &&
      options.verbConfigResolver
    ) {
      const vc = await options.verbConfigResolver(data.resourceType, data.kind);
      if (vc?.argoSubmit) {
        argoSubmit = vc.argoSubmit as Record<string, unknown>;
      }
      if (vc?.resultOutput) resultOutput = vc.resultOutput;
    }

    const created = await store.create({
      ...data,
      argoSubmit,
      resultOutput,
      requester,
      ownerGroup,
      secretEnc,
    });
    if (options.onCreated) await options.onCreated(created);
    res.status(201).json(created);
  });

  // Demo options endpoint for DynamicSelect fields (map for regions, list for
  // sizes) — shows both response shapes a choice box can consume.
  const OPTION_SETS: Record<string, unknown> = {
    regions: {
      'US East (N. Virginia)': 'us-east-1',
      'EU West (Ireland)': 'eu-west-1',
      'AP South (Mumbai)': 'ap-south-1',
    },
    sizes: ['small', 'medium', 'large'],
  };
  router.get('/options/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json(OPTION_SETS[req.params.name] ?? []);
  });

  // Resolved resource data (ref'd file or spec.resourceData) for the tab + edit.
  router.get('/resources/:name/data', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const data = options.resourceDataFor
      ? await options.resourceDataFor(req.params.name)
      : {};
    res.json(data);
  });

  router.get('/requests', async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user', 'service'],
    });
    const state = req.query.state as RequestState | undefined;

    // Service callers (internal) see everything.
    if (credentials.principal.type !== 'user') {
      res.json((await store.list({ state })).map(toClient));
      return;
    }

    const actor = actorId(credentials.principal.userEntityRef);
    const { isAdmin, groups } = await principalResolver(credentials);
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    const scope = req.query.scope;

    if (mine) {
      // The caller's own requests.
      res.json((await store.list({ state, requester: actor })).map(toClient));
    } else if (scope === 'approval') {
      // Requests the caller may approve: admin → all; else their teams' only.
      res.json(
        (
          await store.list(isAdmin ? { state } : { state, ownerGroups: groups })
        ).map(toClient),
      );
    } else {
      // Default: admin → all; else own + their teams' requests.
      res.json(
        (
          await store.list(
            isAdmin
              ? { state }
              : { state, visibleTo: { requester: actor, ownerGroups: groups } },
          )
        ).map(toClient),
      );
    }
  });

  router.get('/requests/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const found = await store.get(Number(req.params.id));
    if (!found) throw new NotFoundError(`No request ${req.params.id}`);
    res.json(toClient(found));
  });

  // The request's workflow DAG (for the status view).
  router.get('/requests/:id/workflow', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const found = await store.get(Number(req.params.id));
    if (!found) throw new NotFoundError(`No request ${req.params.id}`);
    const nodes =
      found.workflowName && options.workflowNodesFor
        ? await options.workflowNodesFor(
            found.workflowName,
            found.workflowNamespace,
          )
        : [];
    res.json({
      phase: found.workflowPhase,
      name: found.workflowName,
      nodes,
      // Masked here, not in the client: the browser must never receive a value
      // it is not allowed to show.
      suspendedNodes: maskSuspendInputs(
        found.suspendedNodes ?? [],
        found.secretSpec,
      ),
    });
  });

  const decide =
    (decision: 'approve' | 'reject') =>
    async (req: express.Request, res: express.Response) => {
      const parsed = decisionSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new InputError(parsed.error.toString());
      const { credentials, actor } = await actorOf(req);

      const [authz] = await permissions.authorize(
        [{ permission: requestApprovePermission }],
        { credentials },
      );
      if (authz.result !== AuthorizeResult.ALLOW) {
        throw new NotAllowedError('Not allowed to approve or reject requests');
      }

      const request = await store.get(Number(req.params.id));
      if (!request) throw new NotFoundError(`No request ${req.params.id}`);

      const { isAdmin, groups } = await principalResolver(credentials);
      const groupSet = new Set(groups);
      const { nextState, approval } = applyDecision(request, actor, decision, {
        note: parsed.data.note,
        isAdmin,
        approverInGroup: group => groupSet.has(group),
      });

      await store.addApproval(request.id, approval);
      await store.setState(request.id, nextState);

      if (nextState === 'APPROVED') {
        await submitWorkflow((await store.get(request.id))!);
        await store.setState(request.id, 'IN_PROGRESS');
      } else if (nextState === 'REJECTED') {
        // No Workflow, no Secret was ever created — just drop the held blob.
        await store.clearSecretEnc(request.id);
      }

      const resolved = (await store.get(request.id))!;
      if (options.onDecided) await options.onDecided(resolved);
      res.json(toClient(resolved));
    };

  /**
   * Release a suspend step the workflow is waiting on.
   *
   * Same gate as approving the request itself: whoever may approve may resume.
   * The request is re-read from Argo first — the stored list is a cache, and two
   * approvers on the same page is the normal case, not the edge one.
   */
  router.post('/requests/:id/resume', async (req, res) => {
    const parsed = resumeSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new InputError(parsed.error.toString());
    const { credentials, actor } = await actorOf(req);

    const [authz] = await permissions.authorize(
      [{ permission: requestApprovePermission }],
      { credentials },
    );
    if (authz.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Not allowed to resume workflows');
    }

    const request = await store.get(Number(req.params.id));
    if (!request) throw new NotFoundError(`No request ${req.params.id}`);
    if (!request.workflowName) {
      throw new InputError(`Request ${request.id} has no workflow`);
    }

    // The owning-team gate, the same one applyDecision enforces for approvals.
    const { isAdmin, groups } = await principalResolver(credentials);
    const allowed =
      isAdmin || (!!request.ownerGroup && groups.includes(request.ownerGroup));
    if (!allowed) {
      throw new NotAllowedError(
        'Only the owning service team or an admin can resume this workflow',
      );
    }

    if (!options.resumeNode || !options.suspendedNodesFor) {
      throw new InputError('Argo resume is not configured');
    }

    // Live read: the node may have been released since the page rendered.
    const live = await options.suspendedNodesFor(
      request.workflowName,
      request.workflowNamespace,
    );
    const node = live.find(n => n.id === parsed.data.nodeId);
    if (!node) {
      // Somebody else got there first, which is the outcome the caller wanted.
      await store.setWorkflow(request.id, { suspendedNodes: live });
      if (live.length === 0 && request.state === 'AWAITING_INPUT') {
        await store.setState(request.id, 'IN_PROGRESS');
      }
      res.json({
        resumed: false,
        reason: 'That step is no longer suspended.',
        request: toClient((await store.get(request.id))!),
      });
      return;
    }

    const { accepted, rejected } = filterSuppliedOutputs(
      node,
      parsed.data.parameters,
    );
    await options.resumeNode(request.workflowName, node.id, {
      namespace: request.workflowNamespace,
      outputParameters: accepted,
    });

    // The decision is auditable in the same trail as the first approval: it is
    // the same kind of act, on the same request, by the same people.
    await store.addApproval(request.id, {
      approver: actor,
      decision: 'approve',
      note: [
        `resumed step "${node.name}"`,
        parsed.data.note,
        Object.keys(accepted).length
          ? `supplied: ${Object.keys(accepted).join(', ')}`
          : undefined,
      ]
        .filter(Boolean)
        .join(' — '),
      at: new Date().toISOString(),
    });

    const remaining = live.filter(n => n.id !== node.id);
    await store.setWorkflow(request.id, { suspendedNodes: remaining });
    if (remaining.length === 0) await store.setState(request.id, 'IN_PROGRESS');

    res.json({
      resumed: true,
      rejectedParameters: rejected,
      request: toClient((await store.get(request.id))!),
    });
  });

  router.post('/requests/:id/approve', decide('approve'));
  router.post('/requests/:id/reject', decide('reject'));

  return router;
}
