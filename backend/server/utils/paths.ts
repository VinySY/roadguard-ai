import fs from 'fs';
import { join, dirname } from 'path';

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
