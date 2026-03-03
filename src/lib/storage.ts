import {
  S3Client,
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
const PUBLIC_BASE_URL =
  process.env.PUBLIC_STORAGE_BASE_URL ||
  `${process.env.S3_ENDPOINT}/${BUCKET_PUBLIC}`;

/**
 * Nahraje obrázek přímo z bufferu do public bucketu.
 * Vrátí veřejnou URL.
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_PUBLIC,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return `${PUBLIC_BASE_URL}/${key}`;
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
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
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
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Sestaví veřejnou URL pro soubor v public bucketu.
 */
export function getPublicUrl(key: string): string {
  return `${PUBLIC_BASE_URL}/${key}`;
}
