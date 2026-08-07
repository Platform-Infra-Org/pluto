import { createResourceResolver } from './provisioning';

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
