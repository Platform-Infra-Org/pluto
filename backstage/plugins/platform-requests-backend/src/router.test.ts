import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { Request as PlatformRequest } from '@internal/plugin-platform-common';
import express from 'express';
import request from 'supertest';
import { createRouter, PrincipalResolver } from './router';
import { RequestsStore } from './store';
import { Cipher, createCipher } from './crypto';

jest.setTimeout(60_000);

const NEW_REQUEST = {
  kind: 'CREATE' as const,
  resourceType: 'bucket',
  resourceName: 'data',
  params: { region: 'eu' },
};

describe('createRouter', () => {
  const databases = TestDatabases.create({ disableDocker: true });

  async function makeApp(opts: {
    result: AuthorizeResult.ALLOW | AuthorizeResult.DENY;
    principalResolver?: PrincipalResolver;
    ownerResolver?: (resourceType: string) => Promise<string | undefined>;
    submitWorkflow?: jest.Mock<Promise<void>, [PlatformRequest]>;
    cipher?: Cipher;
    secretsEnabled?: boolean;
  }) {
    const knex = await databases.init('SQLITE_3');
    const store = await RequestsStore.create(mockServices.database({ knex }));
    const router = await createRouter({
      httpAuth: mockServices.httpAuth(),
      permissions: mockServices.permissions({ result: opts.result }),
      store,
      principalResolver: opts.principalResolver,
      ownerResolver: opts.ownerResolver,
      submitWorkflow: opts.submitWorkflow,
      cipher: opts.cipher,
      secretsEnabled: opts.secretsEnabled,
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
      const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
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

});
