import {
  mockServices,
  TestDatabaseId,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { RequestsStore } from './store';

jest.setTimeout(60_000);

describe('RequestsStore', () => {
  // ponytail: SQLite only — docker PG/MySQL made the suite 195s and flaky.
  // The store is portable knex (unsigned FK); point this at PG when it matters.
  const databases = TestDatabases.create({ disableDocker: true });

  async function createStore(databaseId: TestDatabaseId) {
    const knex = await databases.init(databaseId);
    const database = mockServices.database({ knex });
    return RequestsStore.create(database);
  }

  it.each(databases.eachSupportedId())(
    'round-trips create/get/list/approvals/state/workflow, %p',
    async databaseId => {
      const store = await createStore(databaseId);

      const created = await store.create({
        kind: 'CREATE',
        resourceType: 'bucket',
        resourceName: 'data',
        params: { region: 'eu', size: 10 },
        policy: { mode: 'N_OF_M', n: 2 },
        requester: 'alice',
      });

      expect(created.id).toEqual(expect.any(Number));
      expect(created.state).toBe('PENDING_APPROVAL');
      expect(created.params).toEqual({ region: 'eu', size: 10 });
      expect(created.policy).toEqual({ mode: 'N_OF_M', n: 2 });
      expect(created.approvals).toEqual([]);

      const fetched = await store.get(created.id);
      expect(fetched).toEqual(created);

      // defaults when params/policy absent
      const defaulted = await store.create({
        kind: 'DELETE',
        resourceType: 'bucket',
        resourceName: 'gone',
        requester: 'bob',
      });
      expect(defaulted.params).toEqual({});
      expect(defaulted.policy).toEqual({ mode: 'SINGLE' });

      // list + filters
      expect((await store.list()).map(r => r.id)).toEqual([
        created.id,
        defaulted.id,
      ]);
      expect((await store.list({ requester: 'alice' })).map(r => r.id)).toEqual([
        created.id,
      ]);
      expect(
        (await store.list({ state: 'PENDING_APPROVAL' })).length,
      ).toBe(2);

      // approvals append + get returns them
      await store.addApproval(created.id, {
        approver: 'carol',
        decision: 'approve',
        note: 'ok',
        at: '2026-02-02T00:00:00.000Z',
      });
      const withApproval = await store.get(created.id);
      expect(withApproval!.approvals).toEqual([
        {
          approver: 'carol',
          decision: 'approve',
          note: 'ok',
          at: '2026-02-02T00:00:00.000Z',
        },
      ]);

      // setState persists
      await store.setState(created.id, 'APPROVED');
      expect((await store.get(created.id))!.state).toBe('APPROVED');

      // setWorkflow persists
      await store.setWorkflow(created.id, {
        name: 'wf-1',
        phase: 'Running',
      });
      const withWorkflow = await store.get(created.id);
      expect(withWorkflow!.workflowName).toBe('wf-1');
      expect(withWorkflow!.workflowPhase).toBe('Running');

      await store.setWorkflow(created.id, { error: 'boom' });
      expect((await store.get(created.id))!.error).toBe('boom');

      expect(await store.get(9999)).toBeUndefined();
    },
  );
});
