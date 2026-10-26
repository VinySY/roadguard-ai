import fs from 'fs';
import { join, normalize, relative, sep } from 'path';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export function isAllowedEvidenceMime(mime: string, includeVideo = false): boolean {
  const normalized = (mime || '').toLowerCase();
  return includeVideo
    ? ALLOWED_VIDEO_TYPES.includes(normalized) || ALLOWED_IMAGE_TYPES.includes(normalized)
    : ALLOWED_IMAGE_TYPES.includes(normalized);
}

export function safeOriginalFilename(originalName: string, fallback = 'upload.jpg'): string {
  const cleaned = (originalName || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned || fallback;
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function saveUploadBuffer(
  uploadsRoot: string,
  subdirectory: string,
  buffer: Buffer,
  originalName: string
): { relativePath: string; publicUrl: string; filename: string } {
  const dir = join(uploadsRoot, subdirectory);
  ensureDir(dir);
  const filename = `${Date.now()}_${safeOriginalFilename(originalName)}`;
  const diskPath = join(dir, filename);
  fs.writeFileSync(diskPath, buffer);
  const relativePath = `uploads/${subdirectory}/${filename}`.replace(/\\/g, '/');
  return {
    relativePath,
    publicUrl: toPublicUploadUrl(relativePath)!,
    filename,
  };
}

export function toPublicUploadUrl(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const value = String(storedPath).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('/api/')) return value;
  if (value.startsWith('blob:') || value.startsWith('data:')) return null;

  const cleaned = value.replace(/^\/+/, '').replace(/\\/g, '/');
  if (cleaned.startsWith('uploads/')) {
    return `/api/${cleaned}`;
  }
  return `/api/uploads/${cleaned}`;
}

/**
 * Returns true if the resolved path stays inside the uploads root.
 */
export function isPathInsideUploads(uploadsRoot: string, candidatePath: string): boolean {
  const resolved = normalize(candidatePath);
  const root = normalize(uploadsRoot);
  const rel = relative(root, resolved);
  return Boolean(rel) && !rel.startsWith('..') && !rel.startsWith(`..${sep}`) && rel !== '..';
}
