import { contentTypeForExtension, uploadKey, validateUpload } from './uploads';

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

describe('contentTypeForExtension', () => {
  it('derives the safe type from a permitted extension, never a caller-supplied one', () => {
    // The extension is the only trustworthy signal — validateUpload has
    // already checked it against the allow-list. Whatever `contentType` a
    // caller sent (e.g. 'text/html', to have a .json file served as a page)
    // plays no part here: this function never reads it.
    expect(contentTypeForExtension('values.json')).toBe('application/json');
    expect(contentTypeForExtension('values.yaml')).toBe('application/yaml');
  });

  it('is case-insensitive, and falls back to a type nothing renders inline', () => {
    expect(contentTypeForExtension('VALUES.JSON')).toBe('application/json');
    expect(contentTypeForExtension('payload.html')).toBe('application/octet-stream');
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
