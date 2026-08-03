import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Envelope encryption for *user-provided* secrets held between submit and
 * approval. Provided values are encrypted the instant they reach the backend
 * and only decrypted (in memory) when written into the request's Kubernetes
 * Secret at approval — plaintext never touches the DB. Generated secrets skip
 * this path entirely (minted straight into the Secret at approval).
 */
export type Cipher = {
  /** AES-256-GCM under the first configured key. Returns `iv:tag:ciphertext`, all base64. */
  encrypt(plaintext: string): string;
  /** Tries every configured key, so blobs written before a rotation still open. */
  decrypt(blob: string): string;
};

/** 32-byte key from a config secret of any length. */
const deriveKey = (secret: string) =>
  createHash('sha256').update(secret).digest();

/**
 * Build the cipher from the configured key(s), or `undefined` when none is set —
 * callers reject requests carrying provided secrets rather than storing
 * plaintext (see router.ts and plugin.ts).
 *
 * Rotation: prepend the new key. The first key encrypts everything from then on,
 * and the old keys keep opening blobs written before the change, so no
 * re-encryption is needed. Drop an old key once no pending request still holds a
 * blob from its era — the encrypted blob is cleared at approval or reject.
 */
export function createCipher(secrets: string[]): Cipher | undefined {
  const keys = secrets.filter(s => s.length > 0).map(deriveKey);
  if (keys.length === 0) return undefined;

  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', keys[0], iv);
      const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
      return `${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
    },

    decrypt(blob: string): string {
      const [iv, tag, ct] = blob.split(':');
      for (const key of keys) {
        try {
          const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
          d.setAuthTag(Buffer.from(tag, 'base64'));
          return Buffer.concat([
            d.update(Buffer.from(ct, 'base64')),
            d.final(),
          ]).toString('utf8');
        } catch {
          // Wrong key for this blob (or a tampered blob) — try the next one.
        }
      }
      // Every key failed. By far the likeliest cause is a key that was replaced
      // instead of prepended, so say that rather than surfacing a bare auth-tag
      // error from the crypto layer.
      throw new Error(
        `cannot decrypt a stored secret with any of the ${keys.length} configured ` +
          'key(s) — platform.secrets.encryptionKey was most likely rotated without ' +
          'keeping the previous key in the list (the blob is otherwise corrupt)',
      );
    },
  };
}

/** Mint a fresh generated secret value. */
export function generateSecret(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url');
}
