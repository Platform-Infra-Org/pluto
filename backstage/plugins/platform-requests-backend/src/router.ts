import {
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  Request as PlatformRequest,
  RequestState,
} from '@internal/plugin-platform-common';
import express from 'express';
import Router from 'express-promise-router';
import { z } from 'zod/v3';
import { requestApprovePermission, requestCreatePermission } from './permissions';
import { applyDecision } from './stateMachine';
import { RequestsStore } from './store';

/** Resolves the roles held by an actor (used for RBAC approval policies). */
export type RoleResolver = (actor: string) => Promise<string[]>;

export interface RouterOptions {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  store: RequestsStore;
  /** Resolves roles for RBAC policies. Defaults to none (P2 wires the real one). */
  roleResolver?: RoleResolver;
  /** Called on APPROVED before flipping to IN_PROGRESS. No-op until P2. */
  submitWorkflow?: (request: PlatformRequest) => Promise<void>;
}

const policySchema = z.union([
  z.object({ mode: z.literal('SINGLE') }),
  z.object({ mode: z.literal('N_OF_M'), n: z.number().int().min(1) }),
  z.object({ mode: z.literal('RBAC'), role: z.string() }),
]);

const newRequestSchema = z.object({
  kind: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  resourceType: z.string(),
  resourceName: z.string(),
  params: z.record(z.unknown()).optional(),
  policy: policySchema.optional(),
  // Only honored for service callers (the Scaffolder action creating on behalf
  // of the initiating user); ignored for user callers (requester = the actor).
  requester: z.string().optional(),
});

const decisionSchema = z.object({ note: z.string().optional() });

/** `user:default/admin` -> `admin`. */
function actorId(userEntityRef: string): string {
  return userEntityRef.split('/').pop()!.split(':')[0];
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { httpAuth, permissions, store } = options;
  const roleResolver: RoleResolver = options.roleResolver ?? (async () => []);
  const submitWorkflow =
    options.submitWorkflow ?? (async () => undefined);

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
    const { requester: onBehalf, ...data } = parsed.data;

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
    const created = await store.create({ ...data, requester });
    res.status(201).json(created);
  });

  router.get('/requests', async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user', 'service'],
    });
    const actor =
      credentials.principal.type === 'user'
        ? actorId(credentials.principal.userEntityRef)
        : undefined;
    const state = req.query.state as RequestState | undefined;
    const mine =
      !!actor && (req.query.mine === '1' || req.query.mine === 'true');
    res.json(await store.list({ state, requester: mine ? actor : undefined }));
  });

  router.get('/requests/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const found = await store.get(Number(req.params.id));
    if (!found) throw new NotFoundError(`No request ${req.params.id}`);
    res.json(found);
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

      const roles = await roleResolver(actor);
      const { nextState, approval } = applyDecision(request, actor, decision, {
        note: parsed.data.note,
        approverHasRole: role => roles.includes(role),
      });

      await store.addApproval(request.id, approval);
      await store.setState(request.id, nextState);

      if (nextState === 'APPROVED') {
        await submitWorkflow((await store.get(request.id))!);
        await store.setState(request.id, 'IN_PROGRESS');
      }

      res.json(await store.get(request.id));
    };

  router.post('/requests/:id/approve', decide('approve'));
  router.post('/requests/:id/reject', decide('reject'));

  return router;
}
