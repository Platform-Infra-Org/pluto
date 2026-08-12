import { mockServices } from '@backstage/backend-test-utils';
import {
  ArgoClient,
  resolveTemplate,
  resolveMap,
  ResolveCtx,
  suspendedNodesOf,
} from './argo';

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

  it('resolves ownerGroup, and to empty when the request has no owning team', () => {
    expect(
      resolveTemplate('<< ownerGroup >>', {
        ...ctx,
        ownerGroup: 'group:default/team-a',
      }),
    ).toBe('group:default/team-a');
    // No owning template was found — the admin-only case. It must resolve to
    // empty rather than to the string 'undefined', which a workflow would
    // happily label a resource with.
    expect(resolveTemplate('<< ownerGroup >>', ctx)).toBe('');
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

  it('resolves resourcesJson (array; [] when absent)', () => {
    const withResources = {
      requestId: 1,
      resourceName: 'a, b',
      resourceType: 'git-resource',
      requester: 'sam',
      params: {},
      resources: [
        {
          name: 'a',
          path: 'resources/a.yaml',
          dataPath: 'resources/a-data.json',
          data: { region: 'eu-west-1', tags: ['prod'] },
        },
        { name: 'b', path: '', dataPath: '', data: {} },
      ],
    };
    const out = JSON.parse(
      resolveTemplate('<< resourcesJson >>', withResources as any),
    );
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('a');
    // A nested object, NOT a JSON string. Verified against a live Argo:
    // `{{item.data}}` substitutes inside a JSON string context, so a string
    // field arrives escaped (`{\"region\":\"eu\"}`) and cannot be piped to jq,
    // while an object field arrives as clean JSON.
    expect(typeof out[0].data).toBe('object');
    expect(out[0].data.region).toBe('eu-west-1');
    expect(out[0].data.tags).toEqual(['prod']);

    const empty = {
      requestId: 1,
      resourceName: 'a',
      resourceType: 't',
      requester: 'sam',
      params: {},
    };
    expect(resolveTemplate('<< resourcesJson >>', empty as any)).toBe('[]');
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

  it('default (no spec): resourceType template, forwarded params, request-id label', async () => {
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
    // One Argo parameter per request field, and no `request` blob.
    expect(body.submitOptions.parameters).toEqual([
      'region=eu-west-1',
      'size=10',
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
    // Explicit `region` merges over the forwarded one; `size` is forwarded.
    expect(body.submitOptions.parameters).toEqual([
      'region=eu-west-1',
      'size=10',
    ]);
    // request-id keeps its original key position but wins on value (42, not SHOULD-LOSE).
    expect(body.submitOptions.labels).toBe(
      'platform.io/request-id=42,owner=alice',
    );
    expect(body.submitOptions.annotations).toBe('note=for my-bucket');
  });

  it('forwardParams: false sends only the explicit parameters', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await client().submitSpec(
      { forwardParams: false, parameters: { data: '<< paramsJson >>' } },
      ctx,
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.submitOptions.parameters).toEqual([
      `data=${JSON.stringify(ctx.params)}`,
    ]);
  });

  it('an explicit parameter overrides the forwarded one of the same name', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await client().submitSpec({ parameters: { region: 'pinned' } }, ctx);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.submitOptions.parameters).toEqual(['region=pinned', 'size=10']);
  });

  it('coerces mixed param types and drops a null one', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await client().submitSpec(undefined, {
      ...ctx,
      params: {
        name: 'b',
        retentionDays: 30,
        versioning: true,
        tags: ['prod'],
        note: null,
      },
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.submitOptions.parameters).toEqual([
      'name=b',
      'retentionDays=30',
      'versioning=true',
      'tags=["prod"]',
    ]);
  });

  it('throws on a param name Argo would misparse, before any submit', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await expect(
      client().submitSpec(undefined, { ...ctx, params: { 'a=b': 'x' } }),
    ).rejects.toThrow("'a=b'");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no params and no spec: an empty parameter list, not a request blob', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await client().submitSpec(undefined, { ...ctx, params: {} });
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.submitOptions.parameters).toEqual([]);
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

  it('routes through the Backstage proxy (auth injected) when proxyPath is set', async () => {
    const deps = {
      discovery: { getBaseUrl: async () => 'http://backstage/api/proxy' },
      auth: {
        getOwnServiceCredentials: async () => ({}),
        getPluginRequestToken: async () => ({ token: 'svc-token' }),
      },
    } as unknown as import('./argo').ArgoDeps;
    const proxied = new ArgoClient(
      { ...cfg, proxyPath: '/argo-workflows' },
      mockServices.logger.mock(),
      deps,
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());
    await proxied.submitSpec(undefined, ctx);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://backstage/api/proxy/argo-workflows/api/v1/workflows/argo/submit',
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer svc-token',
    });
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

  // A resubmit copies the request-id label onto a new workflow, so two match the
  // selector. Items are supplied oldest-first here — the order Argo does NOT
  // use — so this fails against a plain items[0].
  it('statusFor picks the newest labelled workflow, whatever order it is listed in', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            metadata: { name: 'wf-old', creationTimestamp: '2026-08-11T09:00:00Z' },
            status: { phase: 'Failed', message: 'failing on purpose' },
          },
          {
            metadata: { name: 'wf-new', creationTimestamp: '2026-08-12T09:00:00Z' },
            status: {
              phase: 'Running',
              outputs: { parameters: [{ name: 'resource-ref', value: 'r' }] },
              nodes: {
                s: { id: 's', displayName: 'gate', type: 'Suspend', phase: 'Running' },
              },
            },
          },
        ],
      }),
    } as Response);
    const s = await client().statusFor(42, 'argo');
    expect(s.name).toBe('wf-new');
    expect(s.phase).toBe('Running');
    expect(s.outputs).toEqual({ 'resource-ref': 'r' });
    expect(s.suspendedNodes.map(n => n.name)).toEqual(['gate']);
  });

  // An item with no creationTimestamp must not throw or shadow a good one.
  it('statusFor tolerates a missing creationTimestamp', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { metadata: { name: 'wf-undated' }, status: { phase: 'Failed' } },
          {
            metadata: { name: 'wf-dated', creationTimestamp: '2026-08-12T09:00:00Z' },
            status: { phase: 'Running' },
          },
        ],
      }),
    } as Response);
    const s = await client().statusFor(42, 'argo');
    expect(s.name).toBe('wf-dated');
  });
});

describe('suspendedNodesOf', () => {
  // Shaped like a real status.nodes map, including the trap: a suspended node
  // reports phase Running, exactly like a busy container step.
  const nodes = {
    a: { id: 'a', displayName: 'provision', type: 'Pod', phase: 'Running' },
    b: {
      id: 'b',
      displayName: 'approve-plan',
      type: 'Suspend',
      phase: 'Running',
      templateName: 'approve',
      message: 'Review the plan',
      inputs: {
        parameters: [
          { name: 'plan', value: '3 to add, 0 to destroy' },
          { name: 'cost', value: '$41/mo' },
        ],
      },
      outputs: {
        parameters: [
          {
            name: 'decision',
            description: 'Go or no-go',
            enum: ['approve', 'reject'],
            valueFrom: { supplied: {} },
          },
          { name: 'ticket', default: 'none', valueFrom: { supplied: {} } },
          { name: 'computed', value: 'not-supplied' },
        ],
      },
    },
    c: { id: 'c', displayName: 'earlier-gate', type: 'Suspend', phase: 'Succeeded' },
  };

  it('finds a suspend node that is waiting', () => {
    const found = suspendedNodesOf(nodes);
    expect(found.map(n => n.id)).toEqual(['b']);
    expect(found[0].name).toBe('approve-plan');
    expect(found[0].message).toBe('Review the plan');
  });

  it('ignores a suspend node that has already been resumed', () => {
    // Succeeded, not Running — it was released earlier in the run.
    expect(suspendedNodesOf(nodes).some(n => n.id === 'c')).toBe(false);
  });

  it('ignores a running step that is not a suspend', () => {
    expect(suspendedNodesOf(nodes).some(n => n.id === 'a')).toBe(false);
  });

  it('carries the inputs the approver has to read', () => {
    expect(suspendedNodesOf(nodes)[0].inputs).toEqual([
      { name: 'plan', value: '3 to add, 0 to destroy' },
      { name: 'cost', value: '$41/mo' },
    ]);
  });

  it('offers only the outputs the step asked to be supplied', () => {
    // `computed` has a value and no `supplied`, so Argo would reject setting it.
    expect(suspendedNodesOf(nodes)[0].suppliedOutputs.map(o => o.name)).toEqual([
      'decision',
      'ticket',
    ]);
  });

  it('reads the field description and choices off the step itself', () => {
    const [decision] = suspendedNodesOf(nodes)[0].suppliedOutputs;
    expect(decision.description).toBe('Go or no-go');
    expect(decision.enum).toEqual(['approve', 'reject']);
  });

  it('treats a declared default as "answer optional"', () => {
    // Argo resumes without a value when the parameter has a default, so the
    // absence of one is the workflow author saying the answer is required.
    const [decision, ticket] = suspendedNodesOf(nodes)[0].suppliedOutputs;
    expect(decision.required).toBe(true);
    expect(ticket).toEqual({ name: 'ticket', default: 'none', required: false });
  });

  it('is empty for a workflow with no nodes at all', () => {
    expect(suspendedNodesOf(undefined)).toEqual([]);
  });
});
