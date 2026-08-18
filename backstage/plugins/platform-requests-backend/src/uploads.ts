import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  keyPrefix: string;
  maxBytes: number;
  allowedExtensions: string[];
  urlTtlSeconds: number;
}

export interface UploadRequest {
  filename: string;
  size: number;
  contentType: string;
}

/**
 * Extension -> the Content-Type S3 stores and later serves the object as.
 * Deliberately not the caller-supplied `contentType`: that value is
 * attacker-controlled (a caller can ask to sign `values.json` as
 * `text/html`), and a bucket that is ever made publicly readable would then
 * serve it as HTML — a stored-XSS vector. Deriving from the *validated*
 * extension instead means the signed Content-Type can only ever be one of
 * these safe values, whatever the caller asked for. Anything outside this
 * map falls back to a type no browser renders inline.
 */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

/** Server-derived Content-Type for a validated filename. Pure. */
export function contentTypeForExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = Object.keys(EXTENSION_CONTENT_TYPES).find(e => lower.endsWith(e));
  return ext ? EXTENSION_CONTENT_TYPES[ext] : 'application/octet-stream';
}

/** The rejection message, or undefined when the upload is allowed. Pure. */
export function validateUpload(
  input: UploadRequest,
  config: UploadConfig,
): string | undefined {
  if (!Number.isInteger(input.size) || input.size <= 0) {
    return 'size must be a positive integer';
  }
  if (input.size > config.maxBytes) {
    return `file is ${input.size} bytes; the limit is ${config.maxBytes}`;
  }
  const lower = input.filename.toLowerCase();
  if (!config.allowedExtensions.some(ext => lower.endsWith(ext.toLowerCase()))) {
    return `extension not allowed; permitted: ${config.allowedExtensions.join(', ')}`;
  }
  return undefined;
}

/**
 * `<prefix>/<requester>/<uuid>/<filename>`. The uuid keeps two uploads of the
 * same name apart and makes a key unguessable; the requester segment is the
 * audit trail; the filename stays last so a human reading the bucket can tell
 * what it is.
 */
export function uploadKey(
  prefix: string,
  requester: string,
  filename: string,
  uuid: string,
): string {
  const base = filename.split('/').pop() ?? 'file';
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${prefix}/${requester}/${uuid}/${safe}`;
}

/**
 * Sign a single PUT of exactly this many bytes.
 *
 * Content-Length is signed, not merely advised: a presigned URL on its own
 * accepts a body of any size, so the cap would be a suggestion. With the
 * length in the signature S3 rejects anything else, and the limit is enforced
 * by S3 rather than by trusting the browser.
 */
export async function presignUpload(
  input: UploadRequest,
  config: UploadConfig,
  requester: string,
): Promise<{
  url: string;
  key: string;
  bucket: string;
  expiresIn: number;
  contentType: string;
}> {
  const key = uploadKey(config.keyPrefix, requester, input.filename, randomUUID());
  // Server-derived, not `input.contentType`: see EXTENSION_CONTENT_TYPES.
  // Content-Type is a signed header (below), so the browser's PUT must send
  // exactly this value — the caller cannot substitute their own and still
  // have the signature verify.
  const contentType = contentTypeForExtension(input.filename);
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: input.size,
    }),
    { expiresIn: config.urlTtlSeconds, signableHeaders: new Set(['content-length', 'content-type']) },
  );
  return { url, key, bucket: config.bucket, expiresIn: config.urlTtlSeconds, contentType };
}
