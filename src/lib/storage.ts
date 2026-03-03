import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.S3_REGION || "eu-central-2",
  endpoint:
    process.env.S3_ENDPOINT || "https://eu-central-2.storage.impossibleapi.net",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // Povinné pro S3-compatible storage
});

const BUCKET_PUBLIC = process.env.S3_BUCKET_PUBLIC || "singers-universe-public";
const BUCKET_PRIVATE =
  process.env.S3_BUCKET_PRIVATE || "singers-universe-private";
const S3_ENDPOINT_RESOLVED =
  process.env.S3_ENDPOINT || "https://eu-central-2.storage.impossibleapi.net";

type MediaBucket = "public" | "private";

const STORAGE_URL = new URL(S3_ENDPOINT_RESOLVED);

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function isStorageHost(hostname: string): boolean {
  return hostname.endsWith(".storage.impossibleapi.net");
}

function getBucketName(bucket: MediaBucket): string {
  return bucket === "public" ? BUCKET_PUBLIC : BUCKET_PRIVATE;
}

function getDefaultPublicBaseUrl(): string {
  return `${STORAGE_URL.protocol}//${BUCKET_PUBLIC}.${STORAGE_URL.host}`;
}

function normalizePublicBaseUrl(rawValue?: string): string {
  if (!rawValue?.trim()) return getDefaultPublicBaseUrl();

  try {
    const parsed = new URL(rawValue);
    const path = trimSlashes(parsed.pathname);

    // Backward compatibility for old path-style value:
    // https://<endpoint>/<public-bucket> -> https://<public-bucket>.<endpoint>
    if (
      parsed.host === STORAGE_URL.host &&
      (path === BUCKET_PUBLIC || path.startsWith(`${BUCKET_PUBLIC}/`))
    ) {
      return getDefaultPublicBaseUrl();
    }

    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return getDefaultPublicBaseUrl();
  }
}

const PUBLIC_BASE_URL = normalizePublicBaseUrl(process.env.PUBLIC_STORAGE_BASE_URL);

function parseMediaReference(
  rawValue: string,
  defaultBucket?: MediaBucket,
): { bucket: MediaBucket; objectKey: string } | null {
  const value = rawValue.trim();
  if (!value) return null;

  if (value.startsWith("public://")) {
    const objectKey = trimSlashes(value.replace(/^public:\/\//, ""));
    return objectKey ? { bucket: "public", objectKey } : null;
  }
  if (value.startsWith("private://")) {
    const objectKey = trimSlashes(value.replace(/^private:\/\//, ""));
    return objectKey ? { bucket: "private", objectKey } : null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      const path = trimSlashes(parsed.pathname);

      if (!isStorageHost(parsed.hostname)) return null;

      const publicHostPrefix = `${BUCKET_PUBLIC}.`;
      const privateHostPrefix = `${BUCKET_PRIVATE}.`;

      if (parsed.hostname.startsWith(publicHostPrefix)) {
        return path ? { bucket: "public", objectKey: path } : null;
      }

      if (parsed.hostname.startsWith(privateHostPrefix)) {
        return path ? { bucket: "private", objectKey: path } : null;
      }

      const [bucketName, ...rest] = path.split("/").filter(Boolean);
      if (!bucketName || rest.length === 0) return null;

      const objectKey = rest.join("/");
      if (bucketName === BUCKET_PUBLIC) return { bucket: "public", objectKey };
      if (bucketName === BUCKET_PRIVATE) return { bucket: "private", objectKey };
      return null;
    } catch {
      return null;
    }
  }

  if (!defaultBucket) return null;
  const objectKey = trimSlashes(value);
  if (!objectKey) return null;
  return { bucket: defaultBucket, objectKey };
}

export function toMediaReference(value: string, defaultBucket: MediaBucket = "public"): string {
  const parsed = parseMediaReference(value, defaultBucket);
  if (!parsed) return value.trim();
  return `${parsed.bucket}://${parsed.objectKey}`;
}

export async function resolveMediaPreviewUrl(
  value: string,
  defaultBucket: MediaBucket = "public",
): Promise<string | null> {
  const parsed = parseMediaReference(value, defaultBucket);
  if (!parsed) return value.trim() || null;

  const signed = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: getBucketName(parsed.bucket),
      Key: parsed.objectKey,
    }),
    { expiresIn: 900 },
  );

  return signed;
}

/**
 * Nahraje obrázek přímo z bufferu do public bucketu.
 * Vrátí canonical media reference (public://...).
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  return uploadMediaBuffer({
    key,
    buffer,
    contentType,
    bucket: "public",
  });
}

export async function uploadMediaBuffer(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
  bucket: MediaBucket;
}): Promise<string> {
  const normalizedKey = trimSlashes(params.key);
  const bucketName =
    params.bucket === "private" ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: normalizedKey,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );
  return `${params.bucket}://${normalizedKey}`;
}

/**
 * Vrátí presigned PUT URL pro přímý upload z browseru do private bucketu.
 * Expiruje za 15 minut.
 */
export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  isPrivate = false,
): Promise<string> {
  const bucket = isPrivate ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  const normalizedKey = trimSlashes(key);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minut
}

/**
 * Smaže soubor ze storage.
 */
export async function deleteFile(
  key: string,
  isPrivate = false,
): Promise<void> {
  const bucket = isPrivate ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: trimSlashes(key) }));
}

/**
 * Sestaví veřejnou URL pro soubor v public bucketu.
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_BASE_URL}/${trimSlashes(key)}`;
}
