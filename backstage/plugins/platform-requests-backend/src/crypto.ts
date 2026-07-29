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
export interface Cipher {
  /** AES-256-GCM. Returns `iv:tag:ciphertext`, all base64. */
  encrypt(plaintext: string): string;
  decrypt(blob: string): string;
}

class AesGcmCipher implements Cipher {
  // 32-byte key derived from the config secret (any length in, 256 bits out).
  private readonly key: Buffer;
  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
    return `${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
  }
  decrypt(blob: string): string {
    const [iv, tag, ct] = blob.split(':');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  }
}

/** Cipher used when no encryption key is configured — provided secrets fail fast. */
export const NO_CIPHER: Cipher = {
  encrypt() {
    throw new Error(
      'a request supplies a provided secret but platform.secrets.encryptionKey is unset',
    );
  },
  decrypt() {
    throw new Error('platform.secrets.encryptionKey is unset');
  },
};

export function createCipher(secret: string | undefined): Cipher {
  return secret ? new AesGcmCipher(secret) : NO_CIPHER;
}

/** Mint a fresh generated secret value. */
export function generateSecret(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url');
}
