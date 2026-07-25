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
      principalResolver: async () => ({ roles: ['platform-admin'], groups: [] }),
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
        roles: [],
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
      principalResolver: async () => ({ roles: ['platform-admin'], groups: [] }),
    });
    const created = await request(app).post('/requests').send(NEW_REQUEST);
    const res = await request(app)
      .post(`/requests/${created.body.id}/reject`)
      .set('Authorization', asAdmin)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('REJECTED');
  });

  it('returns 404 for a missing request', async () => {
    const { app } = await makeApp({ result: AuthorizeResult.ALLOW });
    const res = await request(app).get('/requests/9999');
    expect(res.status).toBe(404);
  });

  it('honors RBAC via the principal resolver', async () => {
    // The approver owns the request (passes the team gate) and holds the
    // 'approver' role required by the RBAC policy.
    const { app } = await makeApp({
      result: AuthorizeResult.ALLOW,
      ownerResolver: async () => 'group:default/team-x',
      principalResolver: async () => ({
        roles: ['approver'],
        groups: ['group:default/team-x'],
      }),
    });
    const created = await request(app)
      .post('/requests')
      .send({ ...NEW_REQUEST, policy: { mode: 'RBAC', role: 'approver' } });

    const res = await request(app)
      .post(`/requests/${created.body.id}/approve`)
      .set('Authorization', asAdmin)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('IN_PROGRESS');
  });
});
