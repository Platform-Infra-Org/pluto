import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  Request as PlatformRequest,
  SuspendedNode,
} from '@internal/plugin-platform-common';
import express from 'express';
import request from 'supertest';
import { RootConfigService } from '@backstage/backend-plugin-api';
import { createRouter, MayDeleteLookup, PrincipalResolver } from './router';
import { RequestsStore } from './store';
import { Cipher, createCipher } from './crypto';
import { ArgoClient } from './argo';
import type { ReconcileOutcome } from './plugin';

jest.setTimeout(60_000);

const NEW_REQUEST = {
  kind: 'CREATE' as const,
  resourceType: 'bucket',
  resourceName: 'data',
  params: { region: 'eu' },
};

const BULK_DELETE_BODY = {
  kind: 'DELETE' as const,
  resourceType: 'git-resource',
  resourceNames: ['bucket-a', 'bucket-b'],
};

const SINGLE_DELETE_BODY = {
  kind: 'DELETE' as const,
  resourceType: 'git-resource',
  resourceName: 'bucket-a',
};

describe('createRouter', () => {
  const databases = TestDatabases.create({ disableDocker: true });

  async function makeApp(opts: {
    result: AuthorizeResult.ALLOW | AuthorizeResult.DENY;
    principalResolver?: PrincipalResolver;
    adminLookup?: (userRef: string) => Promise<boolean>;
    mayDeleteLookup?: MayDeleteLookup;
    ownerResolver?: (resourceType: string) => Promise<string | undefined>;
    submitWorkflow?: jest.Mock<Promise<void>, [PlatformRequest]>;
    cipher?: Cipher;
    secretsEnabled?: boolean;
    reconcileRequest?: jest.Mock<Promise<ReconcileOutcome>, [PlatformRequest]>;
    suspendedNodesFor?: (name: string, ns?: string) => Promise<SuspendedNode[]>;
    resumeNode?: jest.Mock<Promise<void>, [string, string, object]>;
    stopWorkflow?: jest.Mock<Promise<void>, [string, object]>;
    config?: RootConfigService;
  }) {
    const knex = await databases.init('SQLITE_3');
    const store = await RequestsStore.create(mockServices.database({ knex }));
    const router = await createRouter({
      httpAuth: mockServices.httpAuth(),
      permissions: mockServices.permissions({ result: opts.result }),
      store,
      principalResolver: opts.principalResolver,
      adminLookup: opts.adminLookup,
      mayDeleteLookup: opts.mayDeleteLookup,
      ownerResolver: opts.ownerResolver,
      submitWorkflow: opts.submitWorkflow,
      cipher: opts.cipher,
      secretsEnabled: opts.secretsEnabled,
      reconcileRequest: opts.reconcileRequest,
      stopWorkflow: opts.stopWorkflow,
      suspendedNodesFor: opts.suspendedNodesFor,
      resumeNode: opts.resumeNode,
      config: opts.config,
    });
    const app = express();
    app.use(router);
    app.use(mockErrorHandler());
    return { app, store };
  }

  // Act as a user other than the default requester (`user:default/mock`).
  const asAdmin = mockCredentials.user.header('user:default/admin');

  it('creates a request (201, PENDING_APPROVAL, requester = actor)', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
    const res = await request(app).post('/requests').send(NEW_REQUEST);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      state: 'PENDING_APPROVAL',
      requester: 'mock',
      params: { region: 'eu' },
      policy: { mode: 'SINGLE' },
    });
  });

  it('denies approve when permissions deny (403)', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.DENY });
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    // create is also denied here, so seed via allow app instead
    expect(created.status).toBe(403);
  });

  it('approves by an admin -> APPROVED then IN_PROGRESS + submitWorkflow', async () => {
    const submitWorkflow = jest.fn().mockResolvedValue(undefined);
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      // admin bypasses the owning-team gate
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
      submitWorkflow,
    });
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    const id = created.body.id;

    const res = await request(app)
      .post(`/requests/${id}/approve`)
      .set('Authorization', asAdmin)
      .send({ note: 'lgtm' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('IN_PROGRESS');
    expect(submitWorkflow).toHaveBeenCalledTimes(1);
    expect(submitWorkflow.mock.calls[0][0].state).toBe('APPROVED');
    expect(res.body.approvals).toHaveLength(1);
    expect(res.body.approvals[0]).toMatchObject({
      approver: 'admin',
      decision: 'approve',
      note: 'lgtm',
    });
  });

  it('denies a decision by a non-owner non-admin (403)', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    // default user `mock` has no roles/groups and the request has no owner
    // team → only an admin could decide it.
    const res = await request(app)
      .post(`/requests/${created.body.id}/approve`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('an owning-team member approves their own request (200)', async () => {
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      // resolve the request's owner team, and put the actor in it
      ownerResolver: async () => 'group:default/team-a',
      principalResolver: async () => ({
        isAdmin: false,
        groups: ['group:default/team-a'],
      }),
      submitWorkflow: jest.fn().mockResolvedValue(undefined),
    });
    // `mock` is both requester and owning-team member → self-approval allowed
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    const res = await request(app)
      .post(`/requests/${created.body.id}/approve`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('IN_PROGRESS');
  });

  it('rejects a request -> REJECTED', async () => {
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
    });
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    const res = await request(app)
      .post(`/requests/${created.body.id}/reject`)
      .set('Authorization', asAdmin)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('REJECTED');
  });

  describe('DELETE /requests/:id', () => {
    /** A request in REJECTED — the cheapest deletable state to reach. */
    async function seedRejected(app: express.Express) {
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      await request(app)
        .post(`/requests/${created.body.id}/reject`)
        .set('Authorization', asAdmin)
        .send({ note: 'no' });
      return created.body.id as number;
    }

    it('deletes a rejected request, and its approvals, for an admin', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
      });
      const id = await seedRejected(app);
      // The rejection itself is an approval row, so this proves the FK-ordered
      // cascade rather than a vacuous count of zero.
      expect(await store.testOnlyCountApprovals(id)).toBe(1);

      const res = await request(app)
        .delete(`/requests/${id}`)
        .set('Authorization', asAdmin);

      expect(res.status).toBe(204);
      expect(await store.get(id)).toBeUndefined();
      expect(await store.testOnlyCountApprovals(id)).toBe(0);
    });

    it('deletes for a member of the owning service team', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        ownerResolver: async () => 'group:default/team-a',
        principalResolver: async () => ({
          isAdmin: false,
          groups: ['group:default/team-a'],
        }),
      });
      const id = await seedRejected(app);
      const res = await request(app).delete(`/requests/${id}`);
      expect(res.status).toBe(204);
      expect(await store.get(id)).toBeUndefined();
    });

    it('refuses someone in neither the owning team nor admin (403)', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        ownerResolver: async () => 'group:default/team-a',
        // Requests it, so this also covers "the requester alone may not delete".
        principalResolver: async () => ({
          isAdmin: false,
          groups: ['group:default/team-b'],
        }),
      });
      const id = await seedRejected(app);
      const res = await request(app).delete(`/requests/${id}`);
      expect(res.status).toBe(403);
      expect(await store.get(id)).toBeDefined();
    });

    // The one that matters: a live workflow still references its request, and
    // the secret sweep reads IN_PROGRESS ids to decide which Secrets are
    // orphaned. Deleting one here would strand a Secret.
    it('refuses an IN_PROGRESS request (400) and leaves it alone', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
        submitWorkflow: jest.fn().mockResolvedValue(undefined),
      });
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      const id = created.body.id;
      const approved = await request(app)
        .post(`/requests/${id}/approve`)
        .set('Authorization', asAdmin)
        .send({});
      expect(approved.body.state).toBe('IN_PROGRESS');

      const res = await request(app)
        .delete(`/requests/${id}`)
        .set('Authorization', asAdmin);

      expect(res.status).toBe(400);
      expect(await store.get(id)).toBeDefined();
    });

    // EXPIRED is not `isTerminal`, but retention has always deleted it. If this
    // fails, the UI and the retention sweep have gone out of step again.
    it('deletes an EXPIRED request', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
      });
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      const id = created.body.id;
      await store.testOnlySetUpdatedAt(id, '2000-01-01T00:00:00.000Z');
      expect(await store.expireStale('2001-01-01T00:00:00.000Z')).toBe(1);
      expect((await store.get(id))!.state).toBe('EXPIRED');

      const res = await request(app)
        .delete(`/requests/${id}`)
        .set('Authorization', asAdmin);

      expect(res.status).toBe(204);
      expect(await store.get(id)).toBeUndefined();
    });
  });

  it('scopes GET /requests: non-admin sees own + their teams, not others', async () => {
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      ownerResolver: async rt =>
        rt === 'team-a-res' ? 'group:default/team-a' : 'group:default/team-b',
      principalResolver: async () => ({
        isAdmin: false,
        groups: ['group:default/team-a'],
      }),
    });
    // owned by team-a, requested by the acting user (mock)
    await request(app)
      .post('/requests')
      .send({ ...NEW_REQUEST, resourceType: 'team-a-res' });
    // owned by team-b, requested by someone else (service caller on behalf of bob)
    await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...NEW_REQUEST, resourceType: 'team-b-res', requester: 'bob' });

    // default view: own + team-a only (not team-b)
    const all = await request(app).get('/requests');
    expect(all.body.map((r: PlatformRequest) => r.resourceType)).toEqual([
      'team-a-res',
    ]);
    // approval scope: only team-a
    const approval = await request(app).get('/requests?scope=approval');
    expect(approval.body.map((r: PlatformRequest) => r.resourceType)).toEqual([
      'team-a-res',
    ]);
    // mine: only own (mock requested team-a-res)
    const mine = await request(app).get('/requests?mine=1');
    expect(mine.body.map((r: PlatformRequest) => r.resourceType)).toEqual([
      'team-a-res',
    ]);
  });

  it('GET /requests returns all to an admin', async () => {
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      ownerResolver: async () => 'group:default/team-b',
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
    });
    await request(app).post('/requests').send(NEW_REQUEST);
    await request(app)
      .post('/requests')
      .set('Authorization', mockCredentials.service.header())
      .send({ ...NEW_REQUEST, requester: 'bob' });
    const res = await request(app).get('/requests');
    expect(res.body).toHaveLength(2);
  });

  it('returns 404 for a missing request', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
    const res = await request(app).get('/requests/9999');
    expect(res.status).toBe(404);
  });

  it('honors an N_OF_M policy: stays pending until a second distinct approver', async () => {
    // An admin owns the decision here; two distinct approvers are needed.
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
      submitWorkflow: jest.fn().mockResolvedValue(undefined),
    });
    const created = await request(app)
      .post('/requests')
      .send({ ...NEW_REQUEST, policy: { mode: 'N_OF_M', n: 2 } });

    // first approval (as admin) -> still pending
    const first = await request(app)
      .post(`/requests/${created.body.id}/approve`)
      .set('Authorization', asAdmin)
      .send({});
    expect(first.body.state).toBe('PENDING_APPROVAL');

    // second, distinct approver -> APPROVED then IN_PROGRESS
    const second = await request(app)
      .post(`/requests/${created.body.id}/approve`)
      .set('Authorization', mockCredentials.user.header('user:default/other'))
      .send({});
    expect(second.body.state).toBe('IN_PROGRESS');
  });

  describe('many resources per request', () => {
    it('accepts resourceNames and derives resourceName from them', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        mayDeleteLookup: async () => ({ allowed: true, denied: [] }),
      });
      const res = await request(app)
        .post('/requests')
        .send({
          kind: 'DELETE',
          resourceType: 'git-resource',
          resourceNames: ['bucket-a', 'bucket-b'],
        });
      expect(res.status).toBe(201);
      expect(res.body.resourceNames).toEqual(['bucket-a', 'bucket-b']);
      expect(res.body.resourceName).toBe('bucket-a, bucket-b');
    });

    it('rejects a request with neither resourceName nor resourceNames', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
      const res = await request(app)
        .post('/requests')
        .send({ kind: 'DELETE', resourceType: 'git-resource' });
      expect(res.status).toBe(400);
    });

    it('keeps resourceName untouched for a single-resource request', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
      const res = await request(app)
        .post('/requests')
        .send({
          kind: 'DELETE',
          resourceType: 'git-resource',
          resourceName: 'bucket-a',
        });
      expect(res.status).toBe(201);
      expect(res.body.resourceName).toBe('bucket-a');
      expect(res.body.resourceNames).toBeUndefined();
    });
  });

  describe('secret lifecycle', () => {
    const cipher = createCipher(['unit-test-key'])!;
    const withSecret = {
      ...NEW_REQUEST,
      secretSpec: [
        { name: 'dbPassword', source: 'generate' as const },
        { name: 'apiKey', source: 'provided' as const },
      ],
      secretValues: { apiKey: 'super-secret-value' },
    };

    it('stores provided secrets encrypted, never plaintext, and redacts them from the DTO', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        secretsEnabled: true,
        cipher,
      });
      const res = await request(app).post('/requests').send(withSecret);
      expect(res.status).toBe(201);

      // DTO carries the (non-sensitive) spec but no values / secret_enc.
      expect(res.body.secretSpec).toHaveLength(2);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-value');
      expect(res.body.secretValues).toBeUndefined();
      expect(res.body.secret_enc).toBeUndefined();

      // The stored blob decrypts back to the provided value — and is not plaintext.
      const enc = await store.getSecretEnc(res.body.id);
      expect(enc).toBeDefined();
      expect(enc).not.toContain('super-secret-value');
      expect(JSON.parse(cipher.decrypt(enc!))).toEqual({ apiKey: 'super-secret-value' });
    });

    it('rejects a request with a required provided value missing (400)', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        secretsEnabled: true,
        cipher,
      });
      const res = await request(app)
        .post('/requests')
        .send({ ...withSecret, secretValues: {} });
      expect(res.status).toBe(400);
    });

    it('refuses a request needing secrets when secrets are disabled (400)', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        secretsEnabled: false,
      });
      const res = await request(app).post('/requests').send(withSecret);
      expect(res.status).toBe(400);
    });

    it('reject clears the held encrypted blob', async () => {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        secretsEnabled: true,
        cipher,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
      });
      const created = await request(app).post('/requests').send(withSecret);
      expect(await store.getSecretEnc(created.body.id)).toBeDefined();

      await request(app)
        .post(`/requests/${created.body.id}/reject`)
        .set('Authorization', asAdmin)
        .send({});
      expect(await store.getSecretEnc(created.body.id)).toBeUndefined();
    });
  });

  /**
   * A submit that throws must not leave the request looking accepted.
   *
   * Approving is the point of no return: the decision is already recorded, so
   * an exception on the way to Argo used to leave the request sitting in
   * APPROVED forever — a state that claims it was accepted and is running when
   * nothing was ever submitted. The batch-refusal guard throws exactly here.
   */
  it('fails the request, with the reason kept, when the submit throws', async () => {
    const submitWorkflow = jest.fn(async () => {
      throw new Error('cannot resolve 1 of 2 resources: broken (not found)');
    }) as unknown as jest.Mock<Promise<void>, [PlatformRequest]>;
    const { app, store } = await makeApp({
      result: AuthorizeResult.ALLOW,
      principalResolver: async () => ({ isAdmin: true, groups: [] }),
      mayDeleteLookup: async () => ({ allowed: true, denied: [] }),
      submitWorkflow,
    });

    const created = await request(app)
      .post('/requests')
      .send({
        kind: 'DELETE',
        resourceType: 'git-resource',
        resourceNames: ['ok', 'broken'],
      });
    const id = created.body.id;

    await request(app)
      .post(`/requests/${id}/approve`)
      .set('Authorization', asAdmin)
      .send({});

    const after = await store.get(id);
    expect(after!.state).toBe('FAILED');
    expect(after!.error).toMatch(/cannot resolve 1 of 2 resources/);
  });

  /**
   * Re-checking a FAILED request: the endpoint reads Argo through the shared
   * reconcile step and reports what it found. It must never restart anything.
   */
  describe('POST /requests/:id/refresh', () => {
    afterEach(() => jest.restoreAllMocks());

    // A request that ran and failed, with the workflow and reason a real one
    // would carry.
    async function seedFailed(
      app: express.Express,
      store: RequestsStore,
    ): Promise<number> {
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      // Assert the seed worked before using its id. Without this a failed
      // create hands `undefined` to setWorkflow, and the suite reports a knex
      // "undefined binding" from store.ts — a stack trace that names neither
      // this helper nor the reason the create failed.
      expect(created.status).toBe(201);
      const id = created.body.id as number;
      await store.setWorkflow(id, {
        name: 'wf-1',
        namespace: 'argo',
        phase: 'Failed',
        error: 'main step exited with code 1',
      });
      await store.setState(id, 'FAILED');
      return id;
    }

    it('moves a FAILED request back to IN_PROGRESS and clears the old error', async () => {
      const reconcileRequest = jest.fn() as jest.Mock<
        Promise<ReconcileOutcome>,
        [PlatformRequest]
      >;
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        reconcileRequest,
      });
      // Stands in for plugin.ts's reconcileRequest: it writes the new state to
      // the store, exactly as the real one does.
      reconcileRequest.mockImplementation(async r => {
        await store.setState(r.id, 'IN_PROGRESS');
        await store.setWorkflow(r.id, { name: 'wf-2', phase: 'Running' });
        return { state: 'IN_PROGRESS', changed: true, reason: 'moved-to-in-progress' };
      });
      const id = await seedFailed(app, store);

      const res = await request(app).post(`/requests/${id}/refresh`).send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        changed: true,
        reason: 'moved-to-in-progress',
      });
      // Read back after the reconcile, not the stale pre-reconcile row: the new
      // state and the resubmitted workflow's name are both in the response.
      expect(res.body.request.state).toBe('IN_PROGRESS');
      expect(res.body.request.workflowName).toBe('wf-2');
      // IN_PROGRESS beside last run's failure reason is worse than either alone.
      expect(res.body.request.error).toBeFalsy();
      expect((await store.get(id))!.error).toBeFalsy();
    });

    it('leaves a non-FAILED request alone (not-failed, never reconciled)', async () => {
      const reconcileRequest = jest.fn() as jest.Mock<
        Promise<ReconcileOutcome>,
        [PlatformRequest]
      >;
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        reconcileRequest,
      });
      const created = await request(app).post('/requests').send(NEW_REQUEST);

      const res = await request(app)
        .post(`/requests/${created.body.id}/refresh`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: false, reason: 'not-failed' });
      expect(res.body.request.state).toBe('PENDING_APPROVAL');
      expect(reconcileRequest).not.toHaveBeenCalled();
    });

    it('reports workflow-gone and keeps the request FAILED, with its reason', async () => {
      const reconcileRequest = jest.fn(async (_r: PlatformRequest) => ({
        state: 'FAILED' as const,
        changed: false,
        reason: 'workflow-gone' as const,
      })) as jest.Mock<Promise<ReconcileOutcome>, [PlatformRequest]>;
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        reconcileRequest,
      });
      const id = await seedFailed(app, store);

      const res = await request(app).post(`/requests/${id}/refresh`).send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: false, reason: 'workflow-gone' });
      expect(res.body.request.state).toBe('FAILED');
      // Nothing moved, so the reason it failed must still be on screen.
      expect(res.body.request.error).toBe('main step exited with code 1');
    });

    it('refuses a caller who may not see the request', async () => {
      const { app, store } = await makeApp({ result: AuthorizeResult.ALLOW });
      const id = await seedFailed(app, store);
      const res = await request(app)
        .post(`/requests/${id}/refresh`)
        .set('Authorization', mockCredentials.none.header())
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns the request unchanged when Argo is not wired', async () => {
      const { app, store } = await makeApp({ result: AuthorizeResult.ALLOW });
      const id = await seedFailed(app, store);
      const res = await request(app).post(`/requests/${id}/refresh`).send({});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: false, reason: 'still-failed' });
      expect(res.body.request.state).toBe('FAILED');
    });

    /**
     * The constraint the whole feature rests on: this is a re-read, not a
     * retry. Restarting a workflow is a cluster operation the platform does not
     * offer, so the assertion is on the URLs the real ArgoClient issues rather
     * than on any observable behaviour — behaviour can be re-derived, a URL
     * assertion cannot be argued with.
     */
    it('issues no /retry or /resubmit call to Argo', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              metadata: {
                name: 'wf-1',
                creationTimestamp: '2026-08-12T10:00:00Z',
              },
              status: { phase: 'Running' },
            },
          ],
        }),
      } as Response);
      const argo = new ArgoClient(
        { baseUrl: 'http://argo', namespace: 'argo', defaultTemplate: 'demo' },
        mockServices.logger.mock(),
      );
      // The real client, so the URLs below are the ones production issues. The
      // endpoint's entire Argo surface is this one list call.
      const reconcileRequest = jest.fn(async (r: PlatformRequest) => {
        const { phase } = await argo.statusFor(r.id, r.workflowNamespace);
        return {
          state: 'IN_PROGRESS',
          changed: phase === 'Running',
          reason: 'moved-to-in-progress',
        } as ReconcileOutcome;
      }) as jest.Mock<Promise<ReconcileOutcome>, [PlatformRequest]>;

      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        reconcileRequest,
      });
      const id = await seedFailed(app, store);
      const res = await request(app).post(`/requests/${id}/refresh`).send({});
      expect(res.status).toBe(200);

      const urls = fetchMock.mock.calls.map(c => String(c[0]));
      // Vacuously true if nothing was called at all, so prove it did talk to Argo.
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.every(u => !u.includes('/retry') && !u.includes('/resubmit'))).toBe(
        true,
      );
    });

    it('returns no failure reason when a re-check finds the workflow succeeded', async () => {
      // The bug: /refresh only cleared `error` when the outcome was IN_PROGRESS,
      // so a workflow retried in Argo that had already finished came back
      // SUCCEEDED with the previous run's message still attached.
      const reconcileRequest = jest.fn() as jest.Mock<
        Promise<ReconcileOutcome>,
        [PlatformRequest]
      >;
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        reconcileRequest,
      });
      reconcileRequest.mockImplementation(async r => {
        await store.setState(r.id, 'SUCCEEDED');
        return { state: 'SUCCEEDED', changed: true, reason: 'moved-to-succeeded' };
      });
      const id = await seedFailed(app, store);

      const res = await request(app).post(`/requests/${id}/refresh`).send({});
      expect(res.status).toBe(200);
      expect(res.body.request.state).toBe('SUCCEEDED');
      expect(res.body.request.error).toBeUndefined();
    });
  });

  /**
   * Who may release a suspend step, decided per node.
   *
   * The owning team answers an unannotated gate as it always has; a gate that
   * names a team belongs to that team and to admins, and to nobody else — not
   * even the owner. A group that resolves to nothing leaves only admins, which
   * is a deliberate stall and not an accident.
   */
  describe('POST /requests/:id/resume', () => {
    const OWNER = 'group:default/team-a';
    const DBA = 'group:default/dba';
    const FINANCE = 'group:default/finance';

    const gate = (name: string, approverGroup?: string): SuspendedNode => ({
      id: `node-${name}`,
      name,
      templateName: name,
      inputs: [],
      suppliedOutputs: [],
      // Absent, not undefined-valued: the two are the same over HTTP but the
      // fixture should look like what Argo produced.
      ...(approverGroup === undefined ? {} : { approverGroup }),
    });

    async function seedSuspended(
      nodes: SuspendedNode[],
      principal: { isAdmin: boolean; groups: string[] },
    ) {
      const resumeNode = jest.fn(
        async (_wf: string, _nodeId: string, _opts: object) => {},
      );
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        ownerResolver: async () => OWNER,
        principalResolver: async () => principal,
        suspendedNodesFor: async () => nodes,
        resumeNode,
      });
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      expect(created.status).toBe(201);
      expect(created.body.ownerGroup).toBe(OWNER);
      const id = created.body.id as number;
      await store.setWorkflow(id, {
        name: 'wf-1',
        namespace: 'argo',
        suspendedNodes: nodes,
      });
      await store.setState(id, 'AWAITING_INPUT');
      return { app, id, resumeNode };
    }

    const resume = (app: express.Express, id: number, nodeId: string) =>
      request(app).post(`/requests/${id}/resume`).send({ nodeId });

    it('lets the owning team resume a step that names no group', async () => {
      const { app, id, resumeNode } = await seedSuspended([gate('plain')], {
        isAdmin: false,
        groups: [OWNER],
      });
      const res = await resume(app, id, 'node-plain');
      expect(res.status).toBe(200);
      expect(res.body.resumed).toBe(true);
      expect(resumeNode).toHaveBeenCalledWith('wf-1', 'node-plain', expect.anything());
    });

    it('DENIES the owning team a step that names another team', async () => {
      const { app, id, resumeNode } = await seedSuspended([gate('schema', DBA)], {
        isAdmin: false,
        groups: [OWNER],
      });
      const res = await resume(app, id, 'node-schema');
      expect(res.status).toBe(403);
      // The stall has to name the team to chase, or it is a mystery.
      expect(res.body.error.message).toContain(DBA);
      expect(resumeNode).not.toHaveBeenCalled();
    });

    it('lets a member of the named group resume it', async () => {
      const { app, id, resumeNode } = await seedSuspended([gate('schema', DBA)], {
        isAdmin: false,
        groups: [DBA],
      });
      expect((await resume(app, id, 'node-schema')).status).toBe(200);
      expect(resumeNode).toHaveBeenCalled();
    });

    describe('stopping', () => {
      // Argo cannot stop one node -- /stop ends the run -- so refusing a gate
      // and abandoning the request are the same call, told apart by nodeId and
      // gated differently on purpose.
      async function seedStoppable(
        nodes: SuspendedNode[],
        principal: { isAdmin: boolean; groups: string[] },
      ) {
        const stopWorkflow = jest.fn(async (_wf: string, _o: object) => {});
        const { app, store } = await makeApp({
          result: AuthorizeResult.ALLOW,
          ownerResolver: async () => OWNER,
          principalResolver: async () => principal,
          suspendedNodesFor: async () => nodes,
          stopWorkflow,
        });
        const created = await request(app).post('/requests').send(NEW_REQUEST);
        const id = created.body.id as number;
        await store.setWorkflow(id, {
          name: 'wf-1',
          namespace: 'argo',
          suspendedNodes: nodes,
        });
        await store.setState(id, 'AWAITING_INPUT');
        return { app, id, stopWorkflow };
      }

      it('lets the team that owns a gate refuse it', async () => {
        const { app, id, stopWorkflow } = await seedStoppable(
          [gate('cost', FINANCE)],
          { isAdmin: false, groups: [FINANCE] },
        );
        const res = await request(app)
          .post(`/requests/${id}/stop`)
          .send({ nodeId: 'node-cost' });
        expect(res.status).toBe(200);
        expect(stopWorkflow).toHaveBeenCalled();
      });

      it('DENIES the owning team a gate that names another team', async () => {
        // The same exclusion resume enforces: a team locked out of answering a
        // step cannot refuse it either, or the gate means nothing.
        const { app, id, stopWorkflow } = await seedStoppable(
          [gate('cost', FINANCE)],
          { isAdmin: false, groups: [OWNER] },
        );
        const res = await request(app)
          .post(`/requests/${id}/stop`)
          .send({ nodeId: 'node-cost' });
        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain(FINANCE);
        expect(stopWorkflow).not.toHaveBeenCalled();
      });

      it('lets the owning team abandon the whole request', async () => {
        const { app, id, stopWorkflow } = await seedStoppable(
          [gate('cost', FINANCE)],
          { isAdmin: false, groups: [OWNER] },
        );
        // No nodeId: the request-level gate, which the owner passes even though
        // it may answer none of the gates above.
        const res = await request(app).post(`/requests/${id}/stop`).send({});
        expect(res.status).toBe(200);
        expect(stopWorkflow).toHaveBeenCalled();
      });

      it('lets the requester abandon their own request', async () => {
        // Neither an admin nor in the owning team: `mock` filed it.
        const { app, id, stopWorkflow } = await seedStoppable(
          [gate('cost', FINANCE)],
          { isAdmin: false, groups: [] },
        );
        const res = await request(app).post(`/requests/${id}/stop`).send({});
        expect(res.status).toBe(200);
        expect(stopWorkflow).toHaveBeenCalled();
      });

      it('refuses a global stop from someone with no claim on it', async () => {
        const { app, id, stopWorkflow } = await seedStoppable(
          [gate('cost', FINANCE)],
          { isAdmin: false, groups: [FINANCE] },
        );
        // Finance owns a gate, which is not the same as owning the request.
        const res = await request(app)
          .post(`/requests/${id}/stop`)
          .set('authorization', mockCredentials.user.header('user:default/other'))
          .send({});
        expect(res.status).toBe(403);
        expect(stopWorkflow).not.toHaveBeenCalled();
      });

      it('says so when the gate it was asked to refuse is already gone', async () => {
        const { app, id, stopWorkflow } = await seedStoppable([], {
          isAdmin: true,
          groups: [],
        });
        const res = await request(app)
          .post(`/requests/${id}/stop`)
          .send({ nodeId: 'node-gone' });
        expect(res.status).toBe(200);
        expect(res.body.stopped).toBe(false);
        expect(stopWorkflow).not.toHaveBeenCalled();
      });
    });

    it('lets an admin resume it', async () => {
      const { app, id } = await seedSuspended([gate('schema', DBA)], {
        isAdmin: true,
        groups: [],
      });
      expect((await resume(app, id, 'node-schema')).status).toBe(200);
    });

    it('leaves only admins when the group does not resolve', async () => {
      for (const group of ['', 'group:default/typo']) {
        const denied = await seedSuspended([gate('broken', group)], {
          isAdmin: false,
          groups: [OWNER, DBA, FINANCE],
        });
        expect((await resume(denied.app, denied.id, 'node-broken')).status).toBe(403);
        expect(denied.resumeNode).not.toHaveBeenCalled();

        const admin = await seedSuspended([gate('broken', group)], {
          isAdmin: true,
          groups: [],
        });
        expect((await resume(admin.app, admin.id, 'node-broken')).status).toBe(200);
      }
    });

    // The reason this is per node and not per request.
    it('answers two waiting gates by their own teams, on one request', async () => {
      const nodes = [gate('cost', FINANCE), gate('schema', DBA)];

      const finance = await seedSuspended(nodes, {
        isAdmin: false,
        groups: [FINANCE],
      });
      expect((await resume(finance.app, finance.id, 'node-cost')).status).toBe(200);
      expect((await resume(finance.app, finance.id, 'node-schema')).status).toBe(403);

      const dba = await seedSuspended(nodes, { isAdmin: false, groups: [DBA] });
      expect((await resume(dba.app, dba.id, 'node-schema')).status).toBe(200);
      expect((await resume(dba.app, dba.id, 'node-cost')).status).toBe(403);
    });

    // The stored list is a cache; a template edit must not be raceable by
    // holding a stale page open.
    it('gates on the live node, not the cached one', async () => {
      const resumeNode = jest.fn(
        async (_wf: string, _nodeId: string, _opts: object) => {},
      );
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        ownerResolver: async () => OWNER,
        principalResolver: async () => ({ isAdmin: false, groups: [OWNER] }),
        // Live Argo now says the step belongs to the DBAs...
        suspendedNodesFor: async () => [gate('schema', DBA)],
        resumeNode,
      });
      const created = await request(app).post('/requests').send(NEW_REQUEST);
      const id = created.body.id as number;
      // ...while the cache still has it unannotated, i.e. the owner's to answer.
      await store.setWorkflow(id, {
        name: 'wf-1',
        namespace: 'argo',
        suspendedNodes: [gate('schema')],
      });
      await store.setState(id, 'AWAITING_INPUT');

      expect((await resume(app, id, 'node-schema')).status).toBe(403);
      expect(resumeNode).not.toHaveBeenCalled();
    });
  });

  describe('POST /uploads/presign', () => {
    // Presigning is a pure local SigV4 computation — no network call — but the
    // SDK's credential provider chain still needs *something* to sign with.
    // Static test creds, not a real deployment's IAM role/env, so this stays
    // hermetic.
    beforeAll(() => {
      process.env.AWS_ACCESS_KEY_ID ??= 'test-access-key-id';
      process.env.AWS_SECRET_ACCESS_KEY ??= 'test-secret-access-key';
    });

    const UPLOAD_CONFIG = {
      platform: {
        uploads: {
          bucket: 'platform-uploads',
          region: 'eu-west-1',
          endpoint: 'http://localhost:9000',
          keyPrefix: 'scaffolder',
          maxBytes: 1024,
          allowedExtensions: ['.yaml', '.json'],
          urlTtlSeconds: 300,
        },
      },
    };
    const configuredApp = () =>
      makeApp({
        result: AuthorizeResult.ALLOW,
        config: mockServices.rootConfig({ data: UPLOAD_CONFIG }),
      });

    it('refuses an unauthenticated request', async () => {
      const { app } = await configuredApp();
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.none.header())
        .send({ filename: 'values.yaml', size: 10, contentType: 'text/yaml' });
      expect(res.status).toBe(401);
    });

    it('rejects a banned extension with 400 and the message', async () => {
      const { app } = await configuredApp();
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.user.header())
        .send({ filename: 'run.sh', size: 10, contentType: 'text/x-sh' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/extension/i);
    });

    it('signs a valid request: url has the bucket, key is namespaced by requester', async () => {
      const { app } = await configuredApp();
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.user.header())
        .send({ filename: 'values.yaml', size: 10, contentType: 'text/yaml' });
      expect(res.status).toBe(200);
      expect(res.body.url).toContain('platform-uploads');
      expect(res.body.key).toMatch(/^scaffolder\/mock\//);
    });

    it('never signs a caller-supplied Content-Type — it is derived from the extension', async () => {
      const { app } = await configuredApp();
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.user.header())
        // Asks to have a .json file signed (and later served) as HTML.
        .send({ filename: 'values.json', size: 10, contentType: 'text/html' });
      expect(res.status).toBe(200);
      expect(res.body.contentType).toBe('application/json');
      expect(res.body.contentType).not.toBe('text/html');
    });

    it('denies an unauthorized principal (403)', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.DENY,
        config: mockServices.rootConfig({ data: UPLOAD_CONFIG }),
      });
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.user.header())
        .send({ filename: 'values.yaml', size: 10, contentType: 'text/yaml' });
      expect(res.status).toBe(403);
    });

    it('returns 501 when platform.uploads is not configured', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        config: mockServices.rootConfig(),
      });
      const res = await request(app)
        .post('/uploads/presign')
        .set('Authorization', mockCredentials.user.header())
        .send({ filename: 'values.yaml', size: 10, contentType: 'text/yaml' });
      expect(res.status).toBe(501);
    });
  });
  describe('demo option sets', () => {
    // Demo data living in a production binary, so the route is opt-in. The
    // default matters more than the enabled path: an environment that never
    // heard of this key must not serve it.
    it('is off unless the config says otherwise', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        config: mockServices.rootConfig(),
      });
      const res = await request(app).get('/options/regions');
      expect(res.status).toBe(404);
      // The 404 names the key, so a developer whose DynamicSelect example went
      // quiet is told why instead of hunting a typo'd path.
      expect(res.body.error).toMatch(/platform\.demoOptions/);
    });

    it('serves the sets when explicitly enabled', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        config: mockServices.rootConfig({ data: { platform: { demoOptions: true } } }),
      });
      const res = await request(app).get('/options/regions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        'US East (N. Virginia)': 'us-east-1',
        'EU West (Ireland)': 'eu-west-1',
        'AP South (Mumbai)': 'ap-south-1',
      });
    });

    it('serves the coordinate tree the cascading select reads', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        config: mockServices.rootConfig({ data: { platform: { demoOptions: true } } }),
      });
      const res = await request(app).get('/options/coordinate-tree');
      expect(res.status).toBe(200);
      // Shape matters more than the values: nested objects to the island, with
      // the environments as a leaf array. That is what walkTree expects.
      expect(Object.keys(res.body.coordinates)).toEqual(['aurora', 'borealis']);
      expect(res.body.coordinates.borealis.lab['eu-west'].cork).toEqual(['sandbox']);
    });
  });

  describe('maintenance mode', () => {
    it('is off when nothing has been set', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
      const res = await request(app).get('/maintenance').send();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: false });
    });

    it('lets an admin turn it on, and anyone read it', async () => {
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
      });
      const put = await request(app)
        .put('/maintenance')
        .set('Authorization', asAdmin)
        .send({ enabled: true });
      expect(put.status).toBe(200);

      const get = await request(app).get('/maintenance').send();
      expect(get.body).toEqual({ enabled: true });
    });

    it('refuses a non-admin turning it on', async () => {
      // The settings page hides the switch from non-admins, but that is
      // decluttering. This is the actual gate.
      const { app } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: false, groups: [] }),
      });
      const res = await request(app).put('/maintenance').send({ enabled: true });
      expect(res.status).toBe(403);
      expect((await request(app).get('/maintenance').send()).body).toEqual({
        enabled: false,
      });
    });
  });

  describe('the maintenance gate on POST /requests', () => {
    // A stub, so the catalog is not needed: 'boss' is an admin, 'dev' is not.
    const adminLookup = async (ref: string) => ref === 'boss';

    async function maintenanceApp() {
      const { app, store } = await makeApp({
        result: AuthorizeResult.ALLOW,
        principalResolver: async () => ({ isAdmin: true, groups: [] }),
        adminLookup,
      });
      await request(app)
        .put('/maintenance')
        .set('Authorization', asAdmin)
        .send({ enabled: true });
      return { app, store };
    }

    it('refuses a service-principal submission naming a NON-admin requester', async () => {
      // The Scaffolder path, and the whole point of this task. A gate keyed on
      // the credential would see a service principal, call every submission
      // non-admin, and look like it worked — while blocking admins too.
      const { app } = await maintenanceApp();
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...NEW_REQUEST, requester: 'dev' });
      expect(res.status).toBe(503);
    });

    it('allows a service-principal submission naming an ADMIN requester', async () => {
      // The other half of the trap: an admin filing through a template must not
      // be blocked by their own maintenance mode.
      const { app } = await maintenanceApp();
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...NEW_REQUEST, requester: 'boss' });
      expect(res.status).toBe(201);
    });

    it('refuses a DELETE just as it refuses a CREATE', async () => {
      const { app } = await maintenanceApp();
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...NEW_REQUEST, kind: 'DELETE', requester: 'dev' });
      expect(res.status).toBe(503);
    });

    it('lets everything through once maintenance is off', async () => {
      const { app } = await maintenanceApp();
      await request(app)
        .put('/maintenance')
        .set('Authorization', asAdmin)
        .send({ enabled: false });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...NEW_REQUEST, requester: 'dev' });
      expect(res.status).toBe(201);
    });

    it('refuses a non-admin with an unconfigured cipher as 503, not 500', async () => {
      // Pins the ordering: the gate must run before secret encryption, or a
      // request that was always going to be refused pays for encryption first
      // — and, with no cipher configured, throws a 500 instead of a clean 503.
      const { app } = await maintenanceApp();
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({
          ...NEW_REQUEST,
          requester: 'dev',
          secretSpec: [{ name: 'apiKey', source: 'provided' as const }],
          secretValues: { apiKey: 'super-secret-value' },
        });
      expect(res.status).toBe(503);
    });
  });

  describe('bulk delete ownership', () => {
    // 'boss' is an admin; 'dev' service-owns git-resource; 'owner' directly owns
    // the named resources; 'other' is none of the three.
    const adminLookup = async (ref: string) => ref === 'boss';
    // Stubbed at the router boundary on purpose — the rule itself has its own
    // tests in `ownership.test.ts`, where the catalog it reads can be a fixture.
    // It still honours `resourceNames`, so the refusal below is asserted on
    // names the gate actually produced rather than on a constant.
    const mayDeleteLookup = async (
      ref: string,
      type: string,
      names: string[],
    ) => {
      if ((ref === 'dev' && type === 'git-resource') || ref === 'owner') {
        return { allowed: true, denied: [] };
      }
      // 'other' owns bucket-a and nothing else.
      const denied = names.filter(n => n !== 'bucket-a');
      return { allowed: denied.length === 0, denied };
    };

    it('accepts a bulk delete where every name is service-owned', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...BULK_DELETE_BODY, requester: 'dev' });
      expect(res.status).toBe(201);
    });

    it('accepts a bulk delete from a direct owner', async () => {
      // Owners may bulk delete, same as service-owners — one rule for seeing and
      // selecting, so there is no asymmetry to explain.
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...BULK_DELETE_BODY, requester: 'owner' });
      expect(res.status).toBe(201);
    });

    it('refuses the whole request when one name is not service-owned', async () => {
      // Partial success on a Git-writing destructive action is the outcome that
      // is hardest to notice and hardest to undo.
      const { app, store } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...BULK_DELETE_BODY, requester: 'other' });
      expect(res.status).toBe(403);
      expect(await store.list()).toHaveLength(0);   // nothing submitted
    });

    it('names the offending resources in the refusal', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...BULK_DELETE_BODY, requester: 'other' });
      // A user who ticked five boxes needs to know which one stopped it. Every
      // name in the batch is of the same type, so naming the type is not an
      // answer — the assertion has to be on the name that failed, and on the
      // one that did not being left out of the blame.
      expect(res.body.error).toContain('bucket-b');
      expect(res.body.error).not.toContain('bucket-a');
    });

    it('lets an admin bulk delete regardless of service ownership', async () => {
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...BULK_DELETE_BODY, requester: 'boss' });
      expect(res.status).toBe(201);
    });

    it('leaves a single-resource DELETE alone', async () => {
      // This plan does not change who may delete one resource.
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW, adminLookup, mayDeleteLookup });
      const res = await request(app)
        .post('/requests')
        .set('Authorization', mockCredentials.service.header())
        .send({ ...SINGLE_DELETE_BODY, requester: 'other' });
      expect(res.status).toBe(201);
    });
  });

});
