import { createCipher, generateSecret, NO_CIPHER } from './crypto';

describe('crypto', () => {
  it('round-trips through AES-256-GCM', () => {
    const c = createCipher('some-config-key');
    const blob = c.encrypt('super-secret-value');
    expect(blob).not.toContain('super-secret-value'); // ciphertext, not plaintext
    expect(blob.split(':')).toHaveLength(3); // iv:tag:ciphertext
    expect(c.decrypt(blob)).toBe('super-secret-value');
  });

  it('produces a fresh iv each time (same plaintext -> different blob)', () => {
    const c = createCipher('k');
    expect(c.encrypt('x')).not.toBe(c.encrypt('x'));
  });

  it('fails to decrypt a tampered blob (auth tag)', () => {
    const c = createCipher('k');
    const [iv, tag, ct] = c.encrypt('hello').split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('evil').toString('base64')}`;
    expect(() => c.decrypt(tampered)).toThrow();
    void ct;
  });

  it('cannot decrypt across different keys', () => {
    const blob = createCipher('key-a').encrypt('hello');
    expect(() => createCipher('key-b').decrypt(blob)).toThrow();
  });

  it('NO_CIPHER (no key configured) throws on use', () => {
    expect(createCipher(undefined)).toBe(NO_CIPHER);
    expect(() => NO_CIPHER.encrypt('x')).toThrow(/encryptionKey/);
  });

  it('generateSecret is random and url-safe with the requested entropy', () => {
    expect(generateSecret()).not.toBe(generateSecret());
    expect(generateSecret(24)).toMatch(/^[A-Za-z0-9_-]+$/);
    // 24 bytes -> 32 base64url chars.
    expect(generateSecret(24)).toHaveLength(32);
  });
});
