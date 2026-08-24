import {
  BackstageCredentials,
  HttpAuthService,
  LoggerService,
  PermissionsService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  isDeletable,
  Request as PlatformRequest,
  RequestState,
  SuspendedNode,
} from '@internal/plugin-platform-common';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod/v3';
import {
  requestApprovePermission,
  requestCreatePermission,
  requestDeletePermission,
  uploadCreatePermission,
} from './permissions';
// Type-only: plugin.ts imports createRouter from here, and a type import is
// erased at compile time, so the cycle never exists at runtime.
import type { ReconcileOutcome } from './plugin';
import { applyDecision, mayResumeNode } from './stateMachine';
import { actorIdOf, mayStopWorkflow } from '@internal/plugin-platform-common';
import { RequestsStore } from './store';
import { Cipher } from './crypto';
import { filterSuppliedOutputs } from './suspend';
import { presignUpload, UploadConfig, validateUpload } from './uploads';

/**
 * Resolves the acting user's admin flag + raw group memberships (from their
 * catalog ownership), for per-team approval decisions and list scoping.
 */
export type PrincipalResolver = (
  credentials: BackstageCredentials,
) => Promise<{ isAdmin: boolean; groups: string[] }>;

/**
 * Admin-ness for a user named by ref rather than held as a credential — the
 * only way to answer for a service-principal submission, where the acting
 * credential is the Scaffolder's, not the human's. See maintenance.ts.
 */
export type AdminLookup = (userRef: string) => Promise<boolean>;

export interface RouterOptions {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  store: RequestsStore;
  /** Optional so the router stays constructible from tests without a config fixture. Backs `platform.uploads`. */
  config?: RootConfigService;
  /**
   * Optional so the router stays constructible from tests with three lines of
   * fakes. Only the delete route uses it, and there it is the point: the row is
   * about to stop existing, so this log is the only surviving record of who
   * removed it.
   */
  logger?: LoggerService;
  /** Resolves the acting user's roles + groups (per-team approval). */
  principalResolver?: PrincipalResolver;
  /** Resolves admin-ness for a named requester (maintenance-mode gate). */
  adminLookup?: AdminLookup;
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
  /** Stop a running workflow (the approver refused the gate). */
  stopWorkflow?: (
    name: string,
    opts: { namespace?: string; message?: string },
  ) => Promise<void>;
  /**
   * Re-read Argo and mirror the workflow's phase onto the request — the same
   * step the poller runs, shared so the two cannot drift (see plugin.ts).
   */
  reconcileRequest?: (request: PlatformRequest) => Promise<ReconcileOutcome>;
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
  // One of these two is required — a request must say what it acts on. The
  // refine below is the only place that is enforced.
  resourceName: z.string().optional(),
  resourceNames: z.array(z.string().min(1)).min(1).optional(),
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
}).refine(d => Boolean(d.resourceName) || Boolean(d.resourceNames?.length), {
  message: 'resourceName or resourceNames is required',
});

const decisionSchema = z.object({ note: z.string().optional() });

const presignSchema = z.object({
  filename: z.string().min(1),
  size: z.number().int().positive(),
  contentType: z.string().min(1),
});

/**
 * Stopping, optionally from one gate.
 *
 * Argo cannot stop a single node — `/stop` ends the run — so refusing a gate
 * and abandoning the request are one operation reached from two places, and
 * `nodeId` is which. Present: the caller is refusing that step, and the step's
 * own approver group decides. Absent: the caller is abandoning the request, and
 * the request-level gate decides.
 */
const stopSchema = z.object({
  nodeId: z.string().min(1).optional(),
  note: z.string().optional(),
});

const resumeSchema = z.object({
  nodeId: z.string().min(1),
  note: z.string().optional(),
  /** Values for outputs the step declared as `supplied`; anything else is dropped. */
  parameters: z.record(z.string()).optional(),
});

/** `user:default/admin` -> `admin`. */
/** Defined in platform-common, because the suspend panel compares against it. */
const actorId = actorIdOf;

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { httpAuth, permissions, store } = options;
  const principalResolver: PrincipalResolver =
    options.principalResolver ?? (async () => ({ isAdmin: false, groups: [] }));
  const adminLookup: AdminLookup = options.adminLookup ?? (async () => false);
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

    // Maintenance mode. Keyed on the resolved requester, not on the credential:
    // the Scaffolder posts as a service and names the human in `requester`, so
    // a credential-keyed check would see a service principal, call every
    // submission non-admin, and block admins too. Admins are never gated —
    // being able to file during maintenance is the point of being able to turn
    // it on. This sits before secret encryption below: a refused request must
    // not pay for encrypting values it will never store, and — if no cipher is
    // configured — must not blow up with a 500 instead of a clean 503.
    if ((await store.getSetting('maintenance')) === 'true') {
      if (!(await adminLookup(requester))) {
        res.status(503).json({
          error: 'Platform maintenance is on — new requests are paused.',
        });
        return;
      }
    }

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

    // A batch stores the joined names as its resourceName: every list, search
    // and notification renders that one string, so joining keeps them all
    // working without a branch, and searching a member name still finds it.
    const resourceName = data.resourceName ?? data.resourceNames!.join(', ');

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
      resourceName,
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
    // Demo coordinate hierarchy for the cascading DynamicSelect, in the shape
    // the real config API returns: space -> network -> region -> island, with
    // the island's environments as the leaf. Served from here rather than as a
    // file under packages/app/public/, because everything in that folder is
    // copied into dist and served publicly by EVERY deployment — a demo
    // fixture would have shipped to production. This route is demo data that
    // already exists, and it sits behind the same auth as its neighbours.
    'coordinate-tree': {
      coordinates: {
        aurora: {
          core: {
            'eu-west': {
              mgmt: ['dev', 'staging', 'prod'],
              paris: ['prod'],
              dublin: ['dev', 'prod'],
            },
            'us-east': { ashburn: ['dev', 'staging'], reston: ['prod'] },
          },
          edge: {
            'eu-north': { stockholm: ['dev'] },
            'ap-south': { mumbai: ['dev', 'prod'] },
          },
        },
        borealis: {
          core: { 'eu-central': { frankfurt: ['staging', 'prod'], munich: ['dev'] } },
          // One region, one island: the branch that shows auto-select filling
          // the rest of the chain from a single pick.
          lab: { 'eu-west': { cork: ['sandbox'] } },
        },
      },
      projects: ['checkout', 'payments', 'search'],
    },
  };
  // Demo data in a production binary, so it is opt-in rather than opt-out.
  // Answering 404 with the reason beats registering nothing: a developer whose
  // DynamicSelect example returns "could not load options" gets told which key
  // turns it on, instead of a bare Express 404 that looks like a typo.
  const demoOptions =
    options.config?.getOptionalBoolean('platform.demoOptions') ?? false;
  router.get('/options/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    if (!demoOptions) {
      res.status(404).json({
        error:
          'demo option sets are disabled; set platform.demoOptions: true to serve them',
      });
      return;
    }
    res.json(OPTION_SETS[req.params.name] ?? []);
  });

  // Mints a presigned S3 PUT for the PlatformFile scaffolder field. Bytes go
  // browser -> S3 directly; credentials never reach the browser.
  router.post('/uploads/presign', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    // Per-object size and extension are capped by platform.uploads, but
    // nothing caps object count — authorize the same way every other
    // mutating route here does, so this isn't unbounded for any signed-in user.
    const [authz] = await permissions.authorize(
      [{ permission: uploadCreatePermission }],
      { credentials },
    );
    if (authz.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Not allowed to request uploads');
    }
    const raw = options.config?.getOptionalConfig('platform.uploads');
    if (!raw) {
      // Fail loudly rather than 500ing somewhere inside the AWS SDK: an
      // unconfigured deployment is a deployment decision, not a bug.
      res.status(501).json({ error: 'platform.uploads is not configured' });
      return;
    }
    const uploads: UploadConfig = {
      bucket: raw.getString('bucket'),
      region: raw.getString('region'),
      endpoint: raw.getOptionalString('endpoint'),
      keyPrefix: raw.getString('keyPrefix'),
      maxBytes: raw.getNumber('maxBytes'),
      allowedExtensions: raw.getStringArray('allowedExtensions'),
      urlTtlSeconds: raw.getNumber('urlTtlSeconds'),
    };
    const input = presignSchema.parse(req.body);
    const rejection = validateUpload(input, uploads);
    if (rejection) {
      res.status(400).json({ error: rejection });
      return;
    }
    const requester = actorId(credentials.principal.userEntityRef);
    res.json(await presignUpload(input, uploads, requester));
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
      res.json(await store.list({ state }));
      return;
    }

    const actor = actorId(credentials.principal.userEntityRef);
    const { isAdmin, groups } = await principalResolver(credentials);
    const mine = req.query.mine === '1' || req.query.mine === 'true';
    const scope = req.query.scope;

    if (mine) {
      // The caller's own requests.
      res.json(await store.list({ state, requester: actor }));
    } else if (scope === 'approval') {
      // Requests the caller may approve: admin → all; else their teams' only.
      res.json(
        await store.list(isAdmin ? { state } : { state, ownerGroups: groups }),
      );
    } else {
      // Default: admin → all; else own + their teams' requests.
      res.json(
        await store.list(
          isAdmin
            ? { state }
            : { state, visibleTo: { requester: actor, ownerGroups: groups } },
        ),
      );
    }
  });

  router.get('/requests/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const found = await store.get(Number(req.params.id));
    if (!found) throw new NotFoundError(`No request ${req.params.id}`);
    res.json(found);
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
      suspendedNodes: found.suspendedNodes ?? [],
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
        try {
          await submitWorkflow((await store.get(request.id))!);
          await store.setState(request.id, 'IN_PROGRESS');
        } catch (e) {
          // Submitting is the last thing that can fail before a workflow
          // exists, and the decision is already recorded by this point. Leaving
          // the request APPROVED would claim it was accepted and is on its way
          // when nothing was ever submitted — a state it can never leave,
          // because the poller only advances requests that have a workflow.
          // Record why and fail it, the same shape the poller uses for a
          // workflow that fails later.
          const message = e instanceof Error ? e.message : String(e);
          await store.setWorkflow(request.id, { error: message });
          await store.setState(request.id, 'FAILED');
        }
      } else if (nextState === 'REJECTED') {
        // No Workflow, no Secret was ever created — just drop the held blob.
        await store.clearSecretEnc(request.id);
      }

      const resolved = (await store.get(request.id))!;
      if (options.onDecided) await options.onDecided(resolved);
      res.json(resolved);
    };

  /**
   * Release a suspend step the workflow is waiting on.
   *
   * The gate is per *step*, not per request (`mayResumeNode`): a suspend
   * template that annotates `platform.io/approver-group` belongs to that team,
   * and the request's owning team is then not sufficient for it. Unannotated
   * steps keep the original rule — whoever may approve the request may resume.
   *
   * The request is re-read from Argo first — the stored list is a cache, and two
   * approvers on the same page is the normal case, not the edge one. The group
   * is read off that live node for the same reason.
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
        request: await store.get(request.id),
      });
      return;
    }

    // The gate, decided against the LIVE node and not the stored cache: the
    // approver group is a property of the step, and a template edit must not be
    // raceable by holding a stale page open.
    const { isAdmin, groups } = await principalResolver(credentials);
    const gate = mayResumeNode({
      isAdmin,
      groups,
      ownerGroup: request.ownerGroup,
      approverGroup: node.approverGroup,
    });
    if (!gate.allowed) throw new NotAllowedError(gate.reason);

    const { accepted, rejected, missing, invalid } = filterSuppliedOutputs(
      node,
      parsed.data.parameters,
    );
    // Refuse the whole resume rather than release the step with half an answer:
    // the step cannot be suspended again once it is running.
    if (invalid.length > 0) {
      throw new InputError(
        invalid
          .map(i => `${i.name} must be one of: ${i.allowed.join(', ')}`)
          .join('; '),
      );
    }
    if (missing.length > 0) {
      throw new InputError(
        `This step requires an answer for: ${missing.join(', ')}`,
      );
    }
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
      request: await store.get(request.id),
    });
  });

  /**
   * Refuse the gate: stop the workflow instead of releasing it.
   *
   * `/stop` and not `/terminate`, so the workflow's own onExit handlers run and
   * clean up whatever it already created. The request is left to the poller,
   * which sees the workflow fail and moves it to FAILED — one place decides
   * what a stopped workflow means.
   */
  router.post('/requests/:id/stop', async (req, res) => {
    const parsed = stopSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new InputError(parsed.error.toString());
    const { credentials, actor } = await actorOf(req);

    const [authz] = await permissions.authorize(
      [{ permission: requestApprovePermission }],
      { credentials },
    );
    if (authz.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Not allowed to stop workflows');
    }

    const request = await store.get(Number(req.params.id));
    if (!request) throw new NotFoundError(`No request ${req.params.id}`);
    if (!request.workflowName) {
      throw new InputError(`Request ${request.id} has no workflow`);
    }

    const { isAdmin, groups } = await principalResolver(credentials);
    const { nodeId } = parsed.data;

    if (nodeId) {
      // Refusing one gate. The step's own team decides, exactly as it does for
      // resume — a team that may release a step may also refuse it, and the
      // owning team is no more entitled here than it is there. Read live from
      // Argo rather than from the stored cache, for the same reason resume
      // does: the cache can be a poll behind a template edit.
      if (!options.suspendedNodesFor) {
        throw new InputError('Argo resume is not configured');
      }
      const live = await options.suspendedNodesFor(
        request.workflowName,
        request.workflowNamespace,
      );
      const node = live.find(n => n.id === nodeId);
      if (!node) {
        res.json({ stopped: false, reason: 'That step is no longer suspended.' });
        return;
      }
      const gate = mayResumeNode({
        isAdmin,
        groups,
        ownerGroup: request.ownerGroup,
        approverGroup: node.approverGroup,
      });
      if (!gate.allowed) throw new NotAllowedError(gate.reason);
    } else {
      // Abandoning the request. Wider than a gate on purpose: whoever asked for
      // this should be able to withdraw it without finding an approver.
      const gate = mayStopWorkflow({
        isAdmin,
        groups,
        actor,
        ownerGroup: request.ownerGroup,
        requester: request.requester,
      });
      if (!gate.allowed) throw new NotAllowedError(gate.reason);
    }

    if (!options.stopWorkflow) throw new InputError('Argo stop is not configured');

    const reason = parsed.data.note
      ? `stopped by ${actor}: ${parsed.data.note}`
      : `stopped by ${actor}`;
    await options.stopWorkflow(request.workflowName, {
      namespace: request.workflowNamespace,
      message: reason,
    });

    // Recorded as a rejection, because that is what refusing a gate is.
    await store.addApproval(request.id, {
      approver: actor,
      decision: 'reject',
      note: [`stopped the workflow`, parsed.data.note].filter(Boolean).join(' — '),
      at: new Date().toISOString(),
    });
    await store.setWorkflow(request.id, {
      suspendedNodes: [],
      error: reason,
    });

    res.json({ stopped: true, request: await store.get(request.id) });
  });

  /**
   * Re-check a FAILED request against Argo, on demand.
   *
   * An operator may have retried (same workflow) or resubmitted (a new one
   * carrying the same request-id label) outside the platform; nothing polls a
   * FAILED request, so without this the request stays failed forever while its
   * workflow runs. This only ever *reads* Argo and mirrors what it already
   * says — it never calls Argo's `/retry` or `/resubmit`. Restarting a workflow
   * is a cluster operation the platform deliberately does not offer, and
   * router.test.ts asserts on the fetch URLs so that cannot rot.
   */
  router.post('/requests/:id/refresh', async (req, res) => {
    // The same gate as GET /requests/:id: whoever may see the request may
    // re-check it. It grants no new power — the outcome is a function of
    // Argo's state, not of the caller.
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const request = await store.get(Number(req.params.id));
    if (!request) throw new NotFoundError(`No request ${req.params.id}`);

    // Only from FAILED. This is not a general-purpose "sync everything"
    // button: the poller already owns every non-terminal state.
    if (request.state !== 'FAILED') {
      res.json({ request, changed: false, reason: 'not-failed' });
      return;
    }
    if (!options.reconcileRequest) {
      // Argo is not wired (unit tests, a stripped deployment). Nothing to
      // re-read, so the request is exactly as failed as it was.
      res.json({ request, changed: false, reason: 'still-failed' });
      return;
    }

    const outcome = await options.reconcileRequest(request);
    if (outcome.state === 'IN_PROGRESS') {
      // A request showing IN_PROGRESS beside the previous run's failure reason
      // is worse than either state alone. `setWorkflow` writes only the keys it
      // is given, so '' is how the column is emptied; the DTO renders `error`
      // on truthiness, so an empty one shows nothing.
      await store.setWorkflow(request.id, { error: '' });
    }

    // Re-read: reconcileRequest wrote the new state, phase and possibly a new
    // workflowName (the resubmit case) straight to the store, so the row read
    // above is already stale.
    res.json({
      request: await store.get(request.id),
      changed: outcome.changed,
      reason: outcome.reason,
    });
  });

  /**
   * Destroy a finished request and its approvals, on demand.
   *
   * Retention already deletes these rows on a timer; this is the same act with
   * a person behind it, and it answers to the same rule about *which* rows may
   * go — `isDeletable`, shared with `planRetention` so the button and the sweep
   * cannot disagree. A live request (APPROVED, IN_PROGRESS, AWAITING_INPUT) is
   * refused: its workflow still references it, and the secret sweep reads
   * IN_PROGRESS ids to decide which Secrets are orphaned. PENDING_APPROVAL is
   * refused too — it has a decision ahead of it, not behind it.
   *
   * Authorisation is `/stop`'s, deliberately: the coarse permission, then the
   * same admin-or-owning-team check on the request itself.
   */
  router.delete('/requests/:id', async (req, res) => {
    const { credentials, actor } = await actorOf(req);

    const [authz] = await permissions.authorize(
      [{ permission: requestDeletePermission }],
      { credentials },
    );
    if (authz.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Not allowed to delete requests');
    }

    const request = await store.get(Number(req.params.id));
    if (!request) throw new NotFoundError(`No request ${req.params.id}`);

    const { isAdmin, groups } = await principalResolver(credentials);
    const allowed =
      isAdmin || (!!request.ownerGroup && groups.includes(request.ownerGroup));
    if (!allowed) {
      throw new NotAllowedError(
        'Only the owning service team or an admin can delete this request',
      );
    }

    if (!isDeletable(request.state)) {
      throw new InputError(
        `Request ${request.id} is ${request.state} and cannot be deleted. ` +
          `Stop its workflow or decide it first.`,
      );
    }

    await store.deleteById(request.id);
    // The row and its approvals are gone; this line is the audit trail now.
    options.logger?.info(
      `request ${request.id} (${request.state}, ${request.kind} ` +
        `${request.resourceType}/${request.resourceName}) deleted by ${actor}`,
    );

    res.status(204).end();
  });

  router.post('/requests/:id/approve', decide('approve'));
  router.post('/requests/:id/reject', decide('reject'));

  /**
   * Whether new submissions are being refused.
   *
   * Readable by any authenticated caller because the frontend has to know
   * whether to show the request form or the maintenance page. Writable only by
   * admins — and that check is here, not in the UI, because hiding a switch is
   * not the same as refusing to flip it.
   */
  router.get('/maintenance', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json({ enabled: (await store.getSetting('maintenance')) === 'true' });
  });

  router.put('/maintenance', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { isAdmin } = await principalResolver(credentials);
    if (!isAdmin) throw new NotAllowedError('Only platform admins may change maintenance mode');
    const enabled = Boolean(req.body?.enabled);
    await store.setSetting('maintenance', enabled ? 'true' : 'false');
    res.json({ enabled });
  });

  return router;
}
