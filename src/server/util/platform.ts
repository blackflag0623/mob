import os from 'os';
import path from 'path';
import fs from 'fs';

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
