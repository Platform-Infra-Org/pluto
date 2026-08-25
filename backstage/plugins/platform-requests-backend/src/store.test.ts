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

      // argoSubmit round-trips, and setWorkflow persists the namespace.
      const withSpec = await store.create({
        kind: 'CREATE',
        resourceType: 'demo',
        resourceName: 'thing',
        argoSubmit: {
          namespace: 'team-a',
          workflowTemplate: 'tpl',
          parameters: { request: '${{ paramsJson }}' },
          labels: { owner: '${{ requester }}' },
        },
        requester: 'dave',
      });
      expect(withSpec.argoSubmit).toEqual({
        namespace: 'team-a',
        workflowTemplate: 'tpl',
        parameters: { request: '${{ paramsJson }}' },
        labels: { owner: '${{ requester }}' },
      });
      // absent argoSubmit stays undefined
      expect(created.argoSubmit).toBeUndefined();

      await store.setWorkflow(withSpec.id, { name: 'wf-9', namespace: 'team-a' });
      const routed = await store.get(withSpec.id);
      expect(routed!.workflowName).toBe('wf-9');
      expect(routed!.workflowNamespace).toBe('team-a');

      expect(await store.get(9999)).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'expires stale pending requests and clears their held secret, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const old = await store.create({
        kind: 'CREATE',
        resourceType: 'postgres',
        resourceName: 'old',
        params: {},
        policy: { mode: 'SINGLE' },
        requester: 'user:default/sam',
        secretEnc: 'cipher-text',
      });
      const fresh = await store.create({
        kind: 'CREATE',
        resourceType: 'postgres',
        resourceName: 'fresh',
        params: {},
        policy: { mode: 'SINGLE' },
        requester: 'user:default/sam',
      });

      await store.testOnlySetUpdatedAt(old.id, '2020-01-01T00:00:00.000Z');

      expect(await store.expireStale('2026-01-01T00:00:00.000Z')).toBe(1);
      expect((await store.get(old.id))!.state).toBe('EXPIRED');
      expect((await store.get(fresh.id))!.state).toBe('PENDING_APPROVAL');
      // The held secret must not outlive the decision.
      expect(await store.getSecretEnc(old.id)).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'deletes terminal requests with their approvals, and nothing else, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const rejected = await store.create({
        kind: 'CREATE',
        resourceType: 'postgres',
        resourceName: 'gone',
        params: {},
        policy: { mode: 'SINGLE' },
        requester: 'user:default/sam',
      });
      await store.addApproval(rejected.id, {
        approver: 'user:default/admin',
        decision: 'reject',
        at: new Date().toISOString(),
      });
      await store.setState(rejected.id, 'REJECTED');
      await store.testOnlySetUpdatedAt(rejected.id, '2020-01-01T00:00:00.000Z');

      const inProgress = await store.create({
        kind: 'CREATE',
        resourceType: 'postgres',
        resourceName: 'live',
        params: {},
        policy: { mode: 'SINGLE' },
        requester: 'user:default/sam',
      });
      await store.setState(inProgress.id, 'IN_PROGRESS');
      await store.testOnlySetUpdatedAt(
        inProgress.id,
        '2020-01-01T00:00:00.000Z',
      );

      expect(
        await store.deleteTerminalBefore(
          'REJECTED',
          '2026-01-01T00:00:00.000Z',
          500,
        ),
      ).toBe(1);
      expect(await store.get(rejected.id)).toBeUndefined();
      // Same age, different state: untouched.
      expect((await store.get(inProgress.id))!.state).toBe('IN_PROGRESS');
      // The approval went with it.
      expect(await store.testOnlyCountApprovals(rejected.id)).toBe(0);
    },
  );

  it.each(databases.eachSupportedId())(
    'honours the batch limit, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      for (let i = 0; i < 5; i++) {
        const r = await store.create({
          kind: 'CREATE',
          resourceType: 'postgres',
          resourceName: `r${i}`,
          params: {},
          policy: { mode: 'SINGLE' },
          requester: 'user:default/sam',
        });
        await store.setState(r.id, 'REJECTED');
        await store.testOnlySetUpdatedAt(r.id, '2020-01-01T00:00:00.000Z');
      }
      expect(
        await store.deleteTerminalBefore(
          'REJECTED',
          '2026-01-01T00:00:00.000Z',
          2,
        ),
      ).toBe(2);
      expect(
        await store.deleteTerminalBefore(
          'REJECTED',
          '2026-01-01T00:00:00.000Z',
          500,
        ),
      ).toBe(3);
    },
  );

  it.each(databases.eachSupportedId())(
    'clears the failure reason when a request succeeds, %p',
    async databaseId => {
      // A retried workflow reaches SUCCEEDED straight from FAILED. Leaving the
      // old reason on the row is not a UI problem — the API served it too.
      const store = await createStore(databaseId);
      const r = await store.create({
        kind: 'CREATE',
        resourceType: 'bucket',
        resourceName: 'data',
        requester: 'alice',
      });

      await store.setWorkflow(r.id, { error: 'boom' });
      await store.setState(r.id, 'FAILED');
      expect((await store.get(r.id))?.error).toBe('boom');

      await store.setState(r.id, 'SUCCEEDED');
      expect((await store.get(r.id))?.error).toBeUndefined();
    },
  );

  it.each(databases.eachSupportedId())(
    'round-trips a setting and reports absent as undefined, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      expect(await store.getSetting('maintenance')).toBeUndefined();
      await store.setSetting('maintenance', 'true');
      expect(await store.getSetting('maintenance')).toBe('true');
      await store.setSetting('maintenance', 'false');
      expect(await store.getSetting('maintenance')).toBe('false');
    },
  );

  it.each(databases.eachSupportedId())(
    'leaves the failure reason alone on every other transition, %p',
    async databaseId => {
      const store = await createStore(databaseId);
      const r = await store.create({
        kind: 'CREATE',
        resourceType: 'bucket',
        resourceName: 'data',
        requester: 'alice',
      });

      await store.setWorkflow(r.id, { error: 'boom' });
      await store.setState(r.id, 'FAILED');
      await store.setState(r.id, 'IN_PROGRESS');
      expect((await store.get(r.id))?.error).toBe('boom');
    },
  );
});
