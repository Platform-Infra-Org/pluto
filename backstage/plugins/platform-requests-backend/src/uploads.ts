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
): Promise<{ url: string; key: string; bucket: string; expiresIn: number }> {
  const key = uploadKey(config.keyPrefix, requester, input.filename, randomUUID());
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
    }),
    { expiresIn: config.urlTtlSeconds, signableHeaders: new Set(['content-length', 'content-type']) },
  );
  return { url, key, bucket: config.bucket, expiresIn: config.urlTtlSeconds };
}
