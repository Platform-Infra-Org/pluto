import { paramsToArgo } from './paramsToArgo';

describe('paramsToArgo', () => {
  it('passes strings through and stringifies scalars', () => {
    expect(
      paramsToArgo({ region: 'eu-west-1', replicas: 3, versioning: true, zero: 0, off: false }),
    ).toEqual({
      region: 'eu-west-1',
      replicas: '3',
      versioning: 'true',
      zero: '0',
      off: 'false',
    });
  });

  it('JSON-encodes objects and arrays', () => {
    expect(
      paramsToArgo({ tags: ['prod', 'eu'], lifecycle: { expireAfterDays: 90 } }),
    ).toEqual({
      tags: '["prod","eu"]',
      lifecycle: '{"expireAfterDays":90}',
    });
  });

  it('skips null and undefined rather than sending an empty string', () => {
    expect(paramsToArgo({ a: 'x', b: null, c: undefined })).toEqual({ a: 'x' });
  });

  it('keeps an empty string, which is a deliberate value', () => {
    expect(paramsToArgo({ note: '' })).toEqual({ note: '' });
  });

  it('throws, naming the parameter, on a name Argo would misparse', () => {
    expect(() => paramsToArgo({ 'a=b': 'x' })).toThrow("'a=b'");
    expect(() => paramsToArgo({ 'a b': 'x' })).toThrow("'a b'");
    expect(() => paramsToArgo({ 'a\nb': 'x' })).toThrow('a\nb');
  });

  it('rejects an invalid name even when its value would be skipped', () => {
    expect(() => paramsToArgo({ 'a=b': null })).toThrow("'a=b'");
  });

  it('is empty for no params', () => {
    expect(paramsToArgo({})).toEqual({});
  });
});
