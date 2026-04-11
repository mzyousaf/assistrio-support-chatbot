import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type UploadVisibility = 'public' | 'private';

export type UploadParams = {
  visibility: UploadVisibility;
  prefix: string;
  originalName: string;
  contentType: string;
  body: Buffer;
  cacheControl?: string;
};

export type UploadResult = {
  bucket: string;
  key: string;
  url: string;
  visibility: UploadVisibility;
};

const MAX_FILENAME_LENGTH = 80;

function getEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function getClient(): S3Client {
  const region = getEnv('AWS_REGION');
  const accessKeyId = getEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('AWS_SECRET_ACCESS_KEY');
  if (!region) throw new Error('AWS_REGION is required');
  if (!accessKeyId || !secretAccessKey) throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucket(visibility: UploadVisibility): string {
  const name = visibility === 'public' ? getEnv('S3_PUBLIC_BUCKET') : getEnv('S3_PRIVATE_BUCKET');
  if (!name) throw new Error(`S3_${visibility === 'public' ? 'PUBLIC' : 'PRIVATE'}_BUCKET is required`);
  return name;
}

/** Public bucket name (trial onboarding knowledge uploads use {@link uploadPublic}). */
export function getS3PublicBucketOrThrow(): string {
  return getBucket('public');
}

/**
 * Sanitize filename: keep [a-zA-Z0-9._-], replace spaces with '-', limit to 80 chars.
 */
export function sanitizeFileName(name: string): string {
  const out = name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return out.slice(0, MAX_FILENAME_LENGTH) || 'file';
}

/**
 * Build S3 key: `${prefix}/${YYYY}/${MM}/${uuid}-${sanitizedName}`
 */
export function buildKey(prefix: string, originalName: string): string {
  const now = new Date();
  const YYYY = now.getUTCFullYear().toString();
  const MM = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const sanitized = sanitizeFileName(originalName);
  const base = sanitized || 'file';
  return `${prefix.replace(/\/+/g, '/').replace(/^\//, '')}/${YYYY}/${MM}/${randomUUID()}-${base}`;
}

/**
 * Standard S3 public URL (bucket must allow public read or use CloudFront).
 */
export function getPublicUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key.replace(/^\/+/, '')}`;
}

const DEFAULT_SIGNED_EXPIRES = 3600;

/**
 * Signed GET URL for private object (default expiry 3600 seconds).
 */
export async function getSignedGetUrl(
  bucket: string,
  key: string,
  expiresSeconds: number = DEFAULT_SIGNED_EXPIRES,
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresSeconds });
}

/**
 * Download object body from S3 as Buffer.
 */
export async function getObjectBody(bucket: string, key: string): Promise<Buffer> {
  const client = getClient();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body;
  if (!body) throw new Error('S3 object body empty');
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Single shared S3 upload. Uses S3_PUBLIC_BUCKET or S3_PRIVATE_BUCKET by visibility.
 * Returns public URL for public, signed GET URL for private.
 * Used by: uploadPublicAvatar (avatars), uploadPrivateDoc (bot documents).
 */
export async function uploadToS3(params: UploadParams): Promise<UploadResult> {
  const { visibility, prefix, originalName, contentType, body, cacheControl } = params;
  const bucket = getBucket(visibility);
  const region = getEnv('AWS_REGION');
  if (!region) throw new Error('AWS_REGION is required');

  const key = buildKey(prefix, originalName);
  const client = getClient();

  const cacheControlHeader =
    cacheControl ?? (visibility === 'public' ? 'public, max-age=31536000, immutable' : undefined);

  // Only set ACL when explicitly enabled; many buckets have Block Public Access and reject public-read.
  const usePublicAcl =
    visibility === 'public' &&
    /^(1|true|yes)$/i.test(getEnv('S3_PUBLIC_ACL'));

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(cacheControlHeader ? { CacheControl: cacheControlHeader } : {}),
        ...(usePublicAcl ? { ACL: 'public-read' as const } : {}),
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`S3 upload failed: ${msg}`);
  }

  const url =
    visibility === 'public'
      ? getPublicUrl(bucket, region, key)
      : await getSignedGetUrl(bucket, key, DEFAULT_SIGNED_EXPIRES);

  return { bucket, key, url, visibility };
}

/**
 * Upload any file to the public bucket under a given prefix.
 * Used for both images and documents (single public upload).
 */
export async function uploadPublic(params: {
  prefix: string;
  body: Buffer;
  originalName: string;
  contentType: string;
  cacheControl?: string;
}): Promise<UploadResult> {
  return uploadToS3({
    visibility: 'public',
    prefix: params.prefix,
    originalName: params.originalName,
    contentType: params.contentType,
    body: params.body,
    cacheControl: params.cacheControl,
  });
}
