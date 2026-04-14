import os from 'os';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

export function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

export function getShellArgs(shell: string): string[] {
  if (shell.includes('powershell') || shell.includes('pwsh')) {
    return ['-NoLogo'];
  }
  return [];
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function getMobDir(): string {
  return path.join(os.homedir(), '.mob');
}

export function getInstancesDir(): string {
  return path.join(getMobDir(), 'instances');
}

export function getSessionsDir(): string {
  return path.join(getMobDir(), 'sessions');
}

export function getScrollbackDir(): string {
  return path.join(getMobDir(), 'scrollback');
}

/** Resolve ~, MSYS paths, and normalize a path for comparison. */
export function resolvePath(p: string): string {
  let resolved = p;
  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = os.homedir() + resolved.slice(1);
  }
  // Convert MSYS/Git Bash paths (/e/Development → E:\Development)
  if (process.platform === 'win32') {
    const msysMatch = resolved.match(/^\/([a-zA-Z])(\/.*)?$/);
    if (msysMatch) {
      resolved = msysMatch[1].toUpperCase() + ':' + (msysMatch[2] || '\\').replace(/\//g, '\\');
    }
  }
  return path.resolve(resolved);
}

export function getGitRemoteUrl(cwd: string): string | undefined {
  try {
    let resolved = cwd;
    if (resolved.startsWith('~/') || resolved === '~') {
      resolved = os.homedir() + resolved.slice(1);
    }
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: resolved,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getGitRoot(cwd: string): string | undefined {
  try {
    let resolved = cwd;
    if (resolved.startsWith('~/') || resolved === '~') {
      resolved = os.homedir() + resolved.slice(1);
    }
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: resolved,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export function getGitBranch(cwd: string): string | undefined {
  try {
    let resolved = cwd;
    if (resolved.startsWith('~/') || resolved === '~') {
      resolved = os.homedir() + resolved.slice(1);
    }
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: resolved,
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}
