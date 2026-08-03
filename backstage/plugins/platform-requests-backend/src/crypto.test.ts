import { createCipher, generateSecret } from './crypto';

/** createCipher returns undefined only when no key is configured. */
const cipherOf = (...keys: string[]) => createCipher(keys)!;

describe('crypto', () => {
  it('round-trips through AES-256-GCM', () => {
    const c = cipherOf('some-config-key');
    const blob = c.encrypt('super-secret-value');
    expect(blob).not.toContain('super-secret-value'); // ciphertext, not plaintext
    expect(blob.split(':')).toHaveLength(3); // iv:tag:ciphertext
    expect(c.decrypt(blob)).toBe('super-secret-value');
  });

  it('produces a fresh iv each time (same plaintext -> different blob)', () => {
    const c = cipherOf('k');
    expect(c.encrypt('x')).not.toBe(c.encrypt('x'));
  });

  it('fails to decrypt a tampered blob (auth tag)', () => {
    const c = cipherOf('k');
    const [iv, tag, ct] = c.encrypt('hello').split(':');
    const tampered = `${iv}:${tag}:${Buffer.from('evil').toString('base64')}`;
    expect(() => c.decrypt(tampered)).toThrow();
    void ct;
  });

  it('cannot decrypt across different keys', () => {
    const blob = cipherOf('key-a').encrypt('hello');
    expect(() => cipherOf('key-b').decrypt(blob)).toThrow();
  });

  it('returns undefined when no key is configured', () => {
    expect(createCipher([])).toBeUndefined();
    expect(createCipher([''])).toBeUndefined();
  });

  describe('key rotation', () => {
    it('still decrypts blobs written under a previous key', () => {
      const blob = cipherOf('old-key').encrypt('held-secret');
      // New key prepended, old one kept.
      expect(cipherOf('new-key', 'old-key').decrypt(blob)).toBe('held-secret');
    });

    it('encrypts under the first key only', () => {
      const blob = cipherOf('new-key', 'old-key').encrypt('fresh-secret');
      expect(cipherOf('new-key').decrypt(blob)).toBe('fresh-secret');
      expect(() => cipherOf('old-key').decrypt(blob)).toThrow();
    });

    it('names rotation when every key fails', () => {
      const blob = cipherOf('old-key').encrypt('held-secret');
      // The old key was replaced instead of kept.
      expect(() => cipherOf('new-key').decrypt(blob)).toThrow(/rotated/);
    });
  });

  it('generateSecret is random and url-safe with the requested entropy', () => {
    expect(generateSecret()).not.toBe(generateSecret());
    expect(generateSecret(24)).toMatch(/^[A-Za-z0-9_-]+$/);
    // 24 bytes -> 32 base64url chars.
    expect(generateSecret(24)).toHaveLength(32);
  });
});
