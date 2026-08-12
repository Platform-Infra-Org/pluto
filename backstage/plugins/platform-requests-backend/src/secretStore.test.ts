import { mockServices } from '@backstage/backend-test-utils';
import { RequestState } from '@internal/plugin-platform-common';
import { CoreV1Api, V1Secret } from '@kubernetes/client-node';
import { KubernetesSecretStore } from './secretStore';
import { SECRET_ACTIVE_STATES } from './plugin';

const logger = mockServices.logger.mock();

function mockApi(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    createNamespacedSecret: jest.fn().mockResolvedValue({}),
    deleteNamespacedSecret: jest.fn().mockResolvedValue({}),
    listNamespacedSecret: jest.fn().mockResolvedValue({ items: [] }),
    ...overrides,
  } as unknown as CoreV1Api & Record<string, jest.Mock>;
}

describe('KubernetesSecretStore', () => {
  const NS = 'argo';

  it('create: one Secret per request, owned by the Workflow, no plaintext in metadata', async () => {
    const api = mockApi();
    const store = new KubernetesSecretStore(api, NS, logger, () => 1_700_000_000_000);
    const name = store.newName(42);
    expect(name).toMatch(/^platform-req-42-/);
    const ref = await store.create({
      name,
      requestId: 42,
      data: { dbPassword: 's3cr3t', apiKey: 'abc' },
      owner: { name: 'git-ops-xyz', uid: 'uid-123' },
    });

    expect(ref).toEqual({ name, keys: ['dbPassword', 'apiKey'] });
    const body: V1Secret = (api as any).createNamespacedSecret.mock.calls[0][0].body;
    // values only in stringData (which K8s encodes), never in labels/annotations/name
    expect(body.stringData).toEqual({ dbPassword: 's3cr3t', apiKey: 'abc' });
    expect(JSON.stringify(body.metadata)).not.toContain('s3cr3t');
    // ownerReference ties it to the Workflow with blockOwnerDeletion
    expect(body.metadata?.ownerReferences).toEqual([
      expect.objectContaining({
        kind: 'Workflow',
        name: 'git-ops-xyz',
        uid: 'uid-123',
        blockOwnerDeletion: true,
      }),
    ]);
    expect(body.metadata?.labels).toMatchObject({
      'platform.io/request-id': '42',
      'platform.io/managed-by': 'platform-requests',
    });
  });

  it('create: keep=true adds the keep label so the sweep leaves it alone', async () => {
    const api = mockApi();
    const store = new KubernetesSecretStore(api, NS, logger);
    await store.create({ name: 'platform-req-1-aa', requestId: 1, data: { x: 'y' }, owner: { name: 'w', uid: 'u' }, keep: true });
    const body: V1Secret = (api as any).createNamespacedSecret.mock.calls[0][0].body;
    expect(body.metadata?.labels?.['platform.io/keep']).toBe('true');
  });

  it('delete: idempotent — a 404 is swallowed, other errors propagate', async () => {
    const notFound = mockApi({
      deleteNamespacedSecret: jest.fn().mockRejectedValue({ code: 404 }),
    });
    await expect(
      new KubernetesSecretStore(notFound, NS, logger).delete('gone'),
    ).resolves.toBeUndefined();

    const boom = mockApi({
      deleteNamespacedSecret: jest.fn().mockRejectedValue({ code: 500 }),
    });
    await expect(
      new KubernetesSecretStore(boom, NS, logger).delete('x'),
    ).rejects.toBeTruthy();
  });

  it('sweep: deletes orphaned (inactive request) + expired, keeps active + labelled-keep', async () => {
    const now = 1_700_000_000_000;
    const secret = (name: string, reqId: string, ageMs: number, keep = false): V1Secret => ({
      metadata: {
        name,
        labels: {
          'platform.io/managed-by': 'platform-requests',
          'platform.io/request-id': reqId,
          ...(keep ? { 'platform.io/keep': 'true' } : {}),
        },
        annotations: { 'platform.io/created-at': new Date(now - ageMs).toISOString() },
      },
    });
    const api = mockApi({
      listNamespacedSecret: jest.fn().mockResolvedValue({
        items: [
          secret('active', '10', 60_000), // request still active -> keep
          secret('orphan', '11', 60_000), // request not active -> delete
          secret('old', '12', 48 * 3600_000), // active but expired -> delete
          secret('kept', '13', 48 * 3600_000, true), // keep label -> ignore
        ],
      }),
    });
    const store = new KubernetesSecretStore(api, NS, logger, () => now);

    const deleted = await store.sweep({
      activeRequestIds: new Set([10, 12]),
      maxAgeMs: 24 * 3600_000,
    });

    expect(deleted).toBe(2);
    const deletedNames = (api as any).deleteNamespacedSecret.mock.calls.map((c: any[]) => c[0].name).sort();
    expect(deletedNames).toEqual(['old', 'orphan']);
  });
});

describe('the sweep active set', () => {
  // The states the poller's sweep task feeds into activeRequestIds, and one
  // request in each: a Secret survives iff its request's state is in the set.
  const requests: { id: number; state: RequestState }[] = [
    { id: 1, state: 'IN_PROGRESS' },
    { id: 2, state: 'AWAITING_INPUT' },
    { id: 3, state: 'FAILED' },
    { id: 4, state: 'SUCCEEDED' },
    { id: 5, state: 'REJECTED' },
    { id: 6, state: 'EXPIRED' },
  ];
  const now = 1_700_000_000_000;
  const maxAgeMs = 24 * 3600_000;

  // Built exactly as plugin.ts's sweep task builds it.
  const activeRequestIds = new Set(
    requests
      .filter(r => SECRET_ACTIVE_STATES.includes(r.state))
      .map(r => r.id),
  );

  const sweepWithAge = async (ageMs: number) => {
    const api = mockApi({
      listNamespacedSecret: jest.fn().mockResolvedValue({
        items: requests.map(r => ({
          metadata: {
            name: `secret-${r.state}`,
            labels: {
              'platform.io/managed-by': 'platform-requests',
              'platform.io/request-id': String(r.id),
            },
            annotations: {
              'platform.io/created-at': new Date(now - ageMs).toISOString(),
            },
          },
        })),
      }),
    });
    const store = new KubernetesSecretStore(api, 'argo', logger, () => now);
    await store.sweep({ activeRequestIds, maxAgeMs });
    return (api as any).deleteNamespacedSecret.mock.calls
      .map((c: any[]) => c[0].name)
      .sort();
  };

  it('keeps the Secret of a request whose workflow may still need it', async () => {
    // AWAITING_INPUT: suspended at a gate, the resumed step still mounts it.
    // FAILED: the workflow may still exist and be retried by an operator.
    expect(await sweepWithAge(60_000)).toEqual([
      'secret-EXPIRED',
      'secret-REJECTED',
      'secret-SUCCEEDED',
    ]);
  });

  it('still sweeps on age, whatever the state — the backstop is untouched', async () => {
    expect(await sweepWithAge(48 * 3600_000)).toEqual([
      'secret-AWAITING_INPUT',
      'secret-EXPIRED',
      'secret-FAILED',
      'secret-IN_PROGRESS',
      'secret-REJECTED',
      'secret-SUCCEEDED',
    ]);
  });
});
