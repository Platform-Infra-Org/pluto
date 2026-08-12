import { createResourceResolver, createSubmitWorkflow } from './provisioning';

const logger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
} as any;
const auth = { getOwnServiceCredentials: async () => ({}) } as any;

const entity = (annotations: Record<string, string>) => ({
  metadata: { name: 'bucket-a', annotations },
  spec: {},
});

describe('resolveResource error reporting', () => {
  it('has no error when the resource legitimately has no data', async () => {
    const { resolveResource } = createResourceResolver({
      catalog: { getEntityByRef: async () => entity({}) } as any,
      urlReader: { readUrl: jest.fn() } as any,
      auth,
      logger,
    });
    const r = await resolveResource('bucket-a');
    expect(r.error).toBeUndefined();
    expect(r.data).toEqual({});
  });

  it('looks the resource up in the configured namespace', async () => {
    const getEntityByRef = jest.fn().mockResolvedValue(entity({}));
    const { resolveResource } = createResourceResolver({
      catalog: { getEntityByRef } as any,
      urlReader: { readUrl: jest.fn() } as any,
      auth,
      logger,
      namespace: 'acme',
    });
    await resolveResource('bucket-a');
    expect(getEntityByRef).toHaveBeenCalledWith(
      'resource:acme/bucket-a',
      expect.anything(),
    );
  });

  it("carries the resource's own spec.owner", async () => {
    const { resolveResource } = createResourceResolver({
      catalog: {
        getEntityByRef: async () => ({
          metadata: { name: 'bucket-a', annotations: {} },
          spec: { owner: 'group:default/payments' },
        }),
      } as any,
      urlReader: { readUrl: jest.fn() } as any,
      auth,
      logger,
    });
    expect((await resolveResource('bucket-a')).owner).toBe(
      'group:default/payments',
    );
  });

  it('has no owner when the resource declares none', async () => {
    const { resolveResource } = createResourceResolver({
      catalog: { getEntityByRef: async () => entity({}) } as any,
      urlReader: { readUrl: jest.fn() } as any,
      auth,
      logger,
    });
    expect((await resolveResource('bucket-a')).owner).toBeUndefined();
  });

  it('reports an error when the entity is missing', async () => {
    const { resolveResource } = createResourceResolver({
      catalog: { getEntityByRef: async () => undefined } as any,
      urlReader: { readUrl: jest.fn() } as any,
      auth,
      logger,
    });
    const r = await resolveResource('gone');
    expect(r.error).toMatch(/not found/i);
  });

  it('reports an error when a declared data ref cannot be read', async () => {
    const { resolveResource } = createResourceResolver({
      catalog: {
        getEntityByRef: async () =>
          entity({
            'backstage.io/managed-by-location':
              'url:http://git/catalog/resources/bucket-a.yaml',
            'platform.io/resource-data': 'dir:./bucket-a-data.json',
          }),
      } as any,
      urlReader: {
        readUrl: async () => {
          throw new Error('404');
        },
      } as any,
      auth,
      logger,
    });
    const r = await resolveResource('bucket-a');
    expect(r.error).toMatch(/unreadable/i);
    expect(r.data).toEqual({});
  });

  it('has no error when a declared ref reads fine', async () => {
    const { resolveResource } = createResourceResolver({
      catalog: {
        getEntityByRef: async () =>
          entity({
            'backstage.io/managed-by-location':
              'url:http://git/catalog/resources/bucket-a.yaml',
            'platform.io/resource-data': 'dir:./bucket-a-data.json',
          }),
      } as any,
      urlReader: {
        readUrl: async () => ({
          buffer: async () => Buffer.from('{"region":"eu-west-1"}'),
        }),
      } as any,
      auth,
      logger,
    });
    const r = await resolveResource('bucket-a');
    expect(r.error).toBeUndefined();
    expect(r.data).toEqual({ region: 'eu-west-1' });
  });
});

/**
 * The batch is refused whole rather than submitted with a hole in it.
 *
 * This is the safety property of bulk delete: `resolveResource` returns
 * `{data: {}}` for a resource it could not read, which is indistinguishable
 * from a resource that legitimately has no data. Submitting anyway means a
 * workflow that decommissions from `data` skips the real teardown for that one
 * resource, removes its files, and reports success — the failure is invisible
 * precisely because it succeeds.
 */
describe('submitWorkflow resource resolution', () => {
  // Params are declared so the assertions below can read the resolve context
  // (the second argument) — a zero-arg mock types `calls[0][1]` as absent.
  const submitSpec = jest.fn(async (_spec?: unknown, _ctx?: unknown) => ({
    name: 'wf-1',
    namespace: 'argo',
    uid: 'u1',
  }));
  const deps = () => ({
    argo: { submitSpec } as any,
    store: { setWorkflow: jest.fn() } as any,
    logger,
    resolveResource: jest.fn(async (n: string) =>
      n === 'broken'
        ? { data: {}, error: "resource 'broken' not found in the catalog" }
        : {
            data: { region: 'eu-west-1', tags: ['prod'] },
            resourcePath: `resources/${n}.yaml`,
            dataPath: `resources/${n}-data.json`,
            owner: `group:default/${n === 'bucket-b' ? 'search' : 'payments'}`,
          },
    ),
  });

  const request = (over: Record<string, unknown> = {}) =>
    ({
      id: 1,
      kind: 'DELETE',
      resourceType: 'git-resource',
      resourceName: 'bucket-a',
      params: {},
      requester: 'sam',
      ...over,
    }) as any;

  beforeEach(() => submitSpec.mockClear());

  it('refuses a batch when any resource fails to resolve, and submits nothing', async () => {
    const submit = createSubmitWorkflow(deps());
    await expect(
      submit(
        request({
          resourceName: 'bucket-a, broken',
          resourceNames: ['bucket-a', 'broken'],
        }),
      ),
    ).rejects.toThrow(/cannot resolve 1 of 2 resources[\s\S]*broken/);
    expect(submitSpec).not.toHaveBeenCalled();
  });

  it('passes the owning team into the submit context', async () => {
    const submit = createSubmitWorkflow(deps());
    await submit(request({ ownerGroup: 'group:default/team-a' }));
    expect((submitSpec.mock.calls[0][1] as any).ownerGroup).toBe(
      'group:default/team-a',
    );
  });

  /**
   * The point of resolving single and bulk through one path: a template can use
   * `<< resourcesJson >>` for both, instead of every workflow existing twice —
   * once for the delete button's four scalars and once for the batch's array.
   */
  it('gives a single-resource request a one-element resources array', async () => {
    const submit = createSubmitWorkflow(deps());
    await submit(request({ resourceName: 'bucket-a' }));
    const ctx = submitSpec.mock.calls[0][1] as any;
    expect(ctx.resources).toEqual([
      {
        name: 'bucket-a',
        path: 'resources/bucket-a.yaml',
        dataPath: 'resources/bucket-a-data.json',
        data: { region: 'eu-west-1', tags: ['prod'] },
        owner: 'group:default/payments',
      },
    ]);
  });

  it('still populates the scalar tokens, so verb-update needs no migration', async () => {
    const submit = createSubmitWorkflow(deps());
    await submit(request({ resourceName: 'bucket-a' }));
    const ctx = submitSpec.mock.calls[0][1] as any;
    expect(ctx.resourceData).toEqual({ region: 'eu-west-1', tags: ['prod'] });
    expect(ctx.resourcePath).toBe('resources/bucket-a.yaml');
    expect(ctx.resourceDataPath).toBe('resources/bucket-a-data.json');
  });

  it('passes each resource as an object, with data as a nested object', async () => {
    const submit = createSubmitWorkflow(deps());
    await submit(
      request({
        resourceName: 'bucket-a, bucket-b',
        resourceNames: ['bucket-a', 'bucket-b'],
      }),
    );
    const ctx = submitSpec.mock.calls[0][1] as any;
    expect(ctx.resources).toHaveLength(2);
    expect(ctx.resources[0]).toEqual({
      name: 'bucket-a',
      path: 'resources/bucket-a.yaml',
      dataPath: 'resources/bucket-a-data.json',
      data: { region: 'eu-west-1', tags: ['prod'] },
      owner: 'group:default/payments',
    });
    // A batch can span owners, which is the reason this is per-resource rather
    // than one value on the request.
    expect(ctx.resources[1].owner).toBe('group:default/search');
    // Not a JSON string: Argo escapes a string field's quotes when it
    // substitutes {{item.data}}, an object it serialises cleanly.
    expect(typeof ctx.resources[0].data).toBe('object');
  });

  it('refuses a single-resource delete whose resource cannot be resolved', async () => {
    const submit = createSubmitWorkflow(deps());
    await expect(submit(request({ resourceName: 'broken' }))).rejects.toThrow(
      /not found in the catalog/,
    );
    expect(submitSpec).not.toHaveBeenCalled();
  });

  it('never resolves for CREATE, which has no resource yet', async () => {
    const d = deps();
    const submit = createSubmitWorkflow(d);
    await submit(request({ kind: 'CREATE', resourceName: 'brand-new' }));
    expect(d.resolveResource).not.toHaveBeenCalled();
    expect(submitSpec).toHaveBeenCalled();
    expect((submitSpec.mock.calls[0][1] as any).resources).toBeUndefined();
  });
});
