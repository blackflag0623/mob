import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from './util/logger.js';

const log = createLogger('update');

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..');

function getCurrentVersion(): string {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'));
  return pkg.version;
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

let cached: { current: string; latest: string } | null | undefined;

export async function checkForUpdate(): Promise<{ current: string; latest: string } | null> {
  if (cached !== undefined) return cached;
  try {
    const current = getCurrentVersion();
    const res = await fetch('https://registry.npmjs.org/mob-coordinator', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      cached = null;
      return null;
    }
    const data = await res.json();
    const latest = data['dist-tags']?.latest;
    if (!latest || !isNewer(latest, current)) {
      cached = null;
      return null;
    }
    cached = { current, latest };
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function performUpdate(latest: string): { success: boolean; error?: string } {
  try {
    log.info(`Installing mob-coordinator@${latest}...`);
    execSync(`npm install -g mob-coordinator@${latest}`, {
      timeout: 60_000,
      stdio: 'pipe',
    });
    log.info('Update installed successfully');
    return { success: true };
  } catch (err: any) {
    const error = err.stderr?.toString() || err.message || 'Unknown error';
    log.error('Update failed:', error);
    return { success: false, error };
  }
}
