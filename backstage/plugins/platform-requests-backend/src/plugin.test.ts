import {
  mockServices,
  startTestBackend,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import request from 'supertest';
import { platformRequestsPlugin } from './plugin';

jest.setTimeout(60_000);

describe('platformRequestsPlugin', () => {
  const databases = TestDatabases.create({ disableDocker: true });

  it('creates and reads a request end-to-end', async () => {
    const knex = await databases.init('SQLITE_3');

    const { server } = await startTestBackend({
      features: [
        platformRequestsPlugin,
        mockServices.database.factory({ knex }),
        mockServices.permissions.factory({ result: AuthorizeResult.ALLOW }),
        catalogServiceMock.factory({ entities: [] }),
      ],
    });

    const createRes = await request(server)
      .post('/api/platform-requests/requests')
      .send({ kind: 'CREATE', resourceType: 'bucket', resourceName: 'data' });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      state: 'PENDING_APPROVAL',
      policy: { mode: 'SINGLE' },
    });

    await request(server)
      .get(`/api/platform-requests/requests/${createRes.body.id}`)
      .expect(200);

    const listRes = await request(server).get(
      '/api/platform-requests/requests',
    );
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });
});
