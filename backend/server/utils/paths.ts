import fs from 'fs';
import { join, dirname, resolve } from 'path';

/**
 * Resolves the backend project root directory reliably whether executing
 * directly from TypeScript via tsx or from compiled JavaScript in dist/.
 */
export function getProjectRoot(fromDir: string): string {
  let current = fromDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(join(current, 'package.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

/**
 * Directory used for persisted media (inspection images, report evidence and
 * videos). Defaults to `<projectRoot>/uploads`; set UPLOAD_ROOT (or MEDIA_ROOT)
 * to a mounted persistent volume in production so media survives restarts and
 * redeploys. Stored relative paths remain `uploads/<bucket>/<file>` and are
 * served from `/api/uploads/...` regardless of where the volume is mounted.
 */
export function getUploadsRoot(projectRoot: string): string {
  const configured = (process.env.UPLOAD_ROOT || process.env.MEDIA_ROOT || '').trim();
  return configured ? resolve(configured) : join(projectRoot, 'uploads');
}
