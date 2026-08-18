import { uploadKey, validateUpload } from './uploads';

const CONFIG = {
  bucket: 'platform-uploads',
  region: 'eu-west-1',
  keyPrefix: 'scaffolder',
  maxBytes: 1024,
  allowedExtensions: ['.yaml', '.json'],
  urlTtlSeconds: 300,
};

describe('validateUpload', () => {
  const ok = { filename: 'values.yaml', size: 10, contentType: 'text/yaml' };

  it('accepts a permitted file', () => {
    expect(validateUpload(ok, CONFIG)).toBeUndefined();
  });

  it('rejects an extension that is not allowed', () => {
    expect(validateUpload({ ...ok, filename: 'run.sh' }, CONFIG)).toMatch(
      /extension/i,
    );
  });

  it('rejects a file over the cap', () => {
    expect(validateUpload({ ...ok, size: 1025 }, CONFIG)).toMatch(/1024/);
  });

  it('rejects a non-positive size, which would sign an unusable URL', () => {
    expect(validateUpload({ ...ok, size: 0 }, CONFIG)).toMatch(/size/i);
  });

  it('is case-insensitive about the extension', () => {
    expect(validateUpload({ ...ok, filename: 'VALUES.YAML' }, CONFIG)).toBeUndefined();
  });
});

describe('uploadKey', () => {
  it('namespaces by prefix, requester and a uuid', () => {
    expect(uploadKey('scaffolder', 'ada', 'values.yaml', 'uuid-1')).toBe(
      'scaffolder/ada/uuid-1/values.yaml',
    );
  });

  it('strips path separators and traversal out of the filename', () => {
    expect(uploadKey('p', 'ada', '../../etc/passwd', 'u')).toBe('p/ada/u/passwd');
  });

  it('replaces characters that would need escaping in a URL', () => {
    expect(uploadKey('p', 'ada', 'my values (1).yaml', 'u')).toBe(
      'p/ada/u/my-values-1-.yaml',
    );
  });
});
