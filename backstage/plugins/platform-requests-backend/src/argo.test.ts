import { mockServices } from '@backstage/backend-test-utils';
import { ArgoClient, resolveTemplate, resolveMap, ResolveCtx } from './argo';

const ctx: ResolveCtx = {
  requestId: 42,
  resourceName: 'my-bucket',
  resourceType: 'demo-resource',
  requester: 'alice',
  params: { region: 'eu-west-1', size: 10 },
};

describe('resolveTemplate', () => {
  it('resolves every token', () => {
    expect(resolveTemplate('<< requestId >>', ctx)).toBe('42');
    expect(resolveTemplate('<< resourceName >>', ctx)).toBe('my-bucket');
    expect(resolveTemplate('<< resourceType >>', ctx)).toBe('demo-resource');
    expect(resolveTemplate('<< requester >>', ctx)).toBe('alice');
    expect(resolveTemplate('<< paramsJson >>', ctx)).toBe(
      JSON.stringify(ctx.params),
    );
    expect(resolveTemplate('<< params.region >>', ctx)).toBe('eu-west-1');
    expect(resolveTemplate('<< params.size >>', ctx)).toBe('10');
  });

  it('is whitespace-tolerant and handles multiple/embedded tokens', () => {
    expect(resolveTemplate('<<requester>>', ctx)).toBe('alice');
    expect(resolveTemplate('ns-<< resourceType >>-<< requestId >>', ctx)).toBe(
      'ns-demo-resource-42',
    );
  });

  it('resolves resourceData (full JSON + field); empty/absent -> {}', () => {
    const withData: ResolveCtx = {
      ...ctx,
      resourceData: { engine: 'postgres', size: 'large' },
    };
    expect(resolveTemplate('<< resourceData >>', withData)).toBe(
      JSON.stringify(withData.resourceData),
    );
    expect(resolveTemplate('<< resourceData.engine >>', withData)).toBe(
      'postgres',
    );
    // absent -> empty JSON object
    expect(resolveTemplate('<< resourceData >>', ctx)).toBe('{}');
    expect(resolveTemplate('<< resourceData.nope >>', withData)).toBe('');
  });

  it('resolves resourcePath / resourceDataPath (empty when absent)', () => {
    const withPaths: ResolveCtx = {
      ...ctx,
      resourcePath: 'resources/my-bucket.yaml',
      resourceDataPath: 'resources/my-bucket-data.json',
    };
    expect(resolveTemplate('<< resourcePath >>', withPaths)).toBe(
      'resources/my-bucket.yaml',
    );
    expect(resolveTemplate('<< resourceDataPath >>', withPaths)).toBe(
      'resources/my-bucket-data.json',
    );
    expect(resolveTemplate('<< resourcePath >>', ctx)).toBe('');
  });

  it('resolves missing params and unknown tokens to empty string', () => {
    expect(resolveTemplate('<< params.nope >>', ctx)).toBe('');
    expect(resolveTemplate('<< bogus >>', ctx)).toBe('');
    expect(resolveTemplate('plain', ctx)).toBe('plain');
  });

  it('resolveMap resolves all values', () => {
    expect(resolveMap({ a: '<< requester >>', b: 'x' }, ctx)).toEqual({
      a: 'alice',
      b: 'x',
    });
    expect(resolveMap(undefined, ctx)).toEqual({});
  });
});

describe('ArgoClient.submitSpec', () => {
  const cfg = {
    baseUrl: 'http://argo',
    namespace: 'argo',
    defaultTemplate: 'demo-resource',
  };
  const client = () => new ArgoClient(cfg, mockServices.logger.mock());

  const okResponse = () =>
    ({ ok: true, json: async () => ({ metadata: { name: 'wf-1' } }) } as Response);

  afterEach(() => jest.restoreAllMocks());

  it('default (no spec): resourceType template, request param, request-id label', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    const res = await client().submitSpec(undefined, ctx);
    expect(res).toEqual({ name: 'wf-1', namespace: 'argo' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://argo/api/v1/workflows/argo/submit');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      namespace: 'argo',
      resourceKind: 'WorkflowTemplate',
      resourceName: 'demo-resource',
    });
    expect(body.submitOptions.parameters).toEqual([
      `request=${JSON.stringify(ctx.params)}`,
    ]);
    expect(body.submitOptions.labels).toBe('platform.io/request-id=42');
    expect(body.submitOptions.annotations).toBeUndefined();
  });

  it('custom spec: templates values, request-id label always merged in', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    const { namespace } = await client().submitSpec(
      {
        namespace: 'team-<< requester >>',
        workflowTemplate: 'tpl',
        entrypoint: 'create',
        serviceAccount: 'sa',
        parameters: { region: '<< params.region >>' },
        labels: { 'platform.io/request-id': 'SHOULD-LOSE', owner: '<< requester >>' },
        annotations: { note: 'for << resourceName >>' },
      },
      ctx,
    );
    expect(namespace).toBe('team-alice');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://argo/api/v1/workflows/team-alice/submit');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resourceName).toBe('tpl');
    expect(body.submitOptions.entryPoint).toBe('create');
    expect(body.submitOptions.serviceAccount).toBe('sa');
    expect(body.submitOptions.parameters).toEqual(['region=eu-west-1']);
    // request-id keeps its original key position but wins on value (42, not SHOULD-LOSE).
    expect(body.submitOptions.labels).toBe(
      'platform.io/request-id=42,owner=alice',
    );
    expect(body.submitOptions.annotations).toBe('note=for my-bucket');
  });

  it('falls back to defaultTemplate only when workflowTemplate not pinned', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'x' } as Response)
      .mockResolvedValueOnce(okResponse());
    // ctx.resourceType 'demo-resource' equals defaultTemplate, so use a type that differs.
    await client().submitSpec(undefined, { ...ctx, resourceType: 'unknown-type' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    );
    expect(second.resourceName).toBe('demo-resource');
  });

  it('does NOT fall back when workflowTemplate is pinned; throws on non-OK', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' } as Response);
    await expect(
      client().submitSpec({ workflowTemplate: 'pinned' }, ctx),
    ).rejects.toThrow('argo submit failed: 500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('statusFor reads phase, message and output parameters', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            metadata: { name: 'wf-1' },
            status: {
              phase: 'Succeeded',
              outputs: {
                parameters: [
                  { name: 'resource-ref', value: 'my-bucket' },
                  { name: 'other', value: '42' },
                ],
              },
            },
          },
        ],
      }),
    } as Response);
    const s = await client().statusFor(42, 'argo');
    expect(s.phase).toBe('Succeeded');
    expect(s.outputs).toEqual({ 'resource-ref': 'my-bucket', other: '42' });
  });
});
