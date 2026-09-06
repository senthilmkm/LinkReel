import { Storage } from '@google-cloud/storage';
import { ENV } from '../config/env';
import fs from 'fs';
import path from 'path';

export const storage = new Storage({
  projectId: ENV.GCP_PROJECT_ID,
});

export async function uploadLocalFileToGcs(
  localFilePath: string,
  destinationPath: string,
  isPublic: boolean = false
): Promise<string> {
  const bucketName = isPublic ? ENV.GCS_PUBLIC_BUCKET : ENV.GCS_TEMP_BUCKET;
  const bucket = storage.bucket(bucketName);

  const ext = path.extname(localFilePath).toLowerCase();
  const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mpeg' : ext === '.png' ? 'image/png' : undefined;

  await bucket.upload(localFilePath, {
    destination: destinationPath,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
  });

  if (isPublic) {
    return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
  }

  // Generate 7-day signed URL for temporary assets
  const [signedUrl] = await bucket.file(destinationPath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

export async function uploadBufferToGcs(
  buffer: Buffer,
  destinationPath: string,
  contentType: string,
  isPublic: boolean = false
): Promise<string> {
  const bucketName = isPublic ? ENV.GCS_PUBLIC_BUCKET : ENV.GCS_TEMP_BUCKET;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destinationPath);

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  if (isPublic) {
    return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
  }

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}

const UPLOAD_PATH_RE = /^uploads\/[A-Za-z0-9][A-Za-z0-9._/-]{2,180}$/;

export function assertSafeUploadPath(objectPath: string): string {
  const trimmed = String(objectPath || '').trim();
  if (!UPLOAD_PATH_RE.test(trimmed) || trimmed.includes('..')) {
    throw new Error('INVALID_UPLOAD_PATH');
  }
  return trimmed;
}

export async function createSignedUploadUrl(
  objectPath: string,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<{ uploadUrl: string; objectPath: string }> {
  const safe = assertSafeUploadPath(objectPath);
  const [uploadUrl] = await storage.bucket(ENV.GCS_TEMP_BUCKET).file(safe).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });
  return { uploadUrl, objectPath: safe };
}

export async function downloadGcsObjectToFile(objectPath: string, destPath: string): Promise<void> {
  const safe = assertSafeUploadPath(objectPath);
  await storage.bucket(ENV.GCS_TEMP_BUCKET).file(safe).download({ destination: destPath });
}
