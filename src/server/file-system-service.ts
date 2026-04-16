import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import type { InstanceManager } from './instance-manager.js';
import type { FileEntry } from '../shared/protocol.js';

const IGNORED = new Set([
  'node_modules', '.git', '.svn', '.hg', '.DS_Store',
  '__pycache__', '.idea', '.vscode', 'dist', '.next',
  '.nuxt', 'coverage', '.cache', '.parcel-cache',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type FileChangeHandler = (instanceId: string, filePath: string) => void;

interface WatchEntry {
  watcher: ReturnType<typeof chokidar.watch>;
  refCount: number;
  instanceId: string;
  filePath: string;
}

export class FileSystemService {
  private watchers = new Map<string, WatchEntry>(); // keyed by absolute path
  private changeHandlers = new Set<FileChangeHandler>();

  constructor(private instanceManager: InstanceManager) {}

  onFileChange(handler: FileChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  watchFile(instanceId: string, filePath: string): void {
    const instance = this.instanceManager.get(instanceId);
    if (!instance) return;

    const absPath = path.resolve(instance.cwd, filePath);
    const existing = this.watchers.get(absPath);
    if (existing) {
      existing.refCount++;
      return;
    }

    const watcher = chokidar.watch(absPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on('change', () => {
      for (const handler of this.changeHandlers) {
        handler(instanceId, filePath);
      }
    });

    this.watchers.set(absPath, { watcher, refCount: 1, instanceId, filePath });
  }

  unwatchFile(instanceId: string, filePath: string): void {
    const instance = this.instanceManager.get(instanceId);
    if (!instance) {
      // Instance may have been removed — scan watchers by instanceId + filePath
      for (const [absPath, entry] of this.watchers) {
        if (entry.instanceId === instanceId && entry.filePath === filePath) {
          entry.refCount--;
          if (entry.refCount <= 0) {
            entry.watcher.close();
            this.watchers.delete(absPath);
          }
          return;
        }
      }
      return;
    }

    const absPath = path.resolve(instance.cwd, filePath);
    const entry = this.watchers.get(absPath);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      entry.watcher.close();
      this.watchers.delete(absPath);
    }
  }

  unwatchAll(): void {
    for (const entry of this.watchers.values()) {
      entry.watcher.close();
    }
    this.watchers.clear();
  }

  async getFileTree(instanceId: string, relativePath = ''): Promise<FileEntry[]> {
    const instance = this.instanceManager.get(instanceId);
    if (!instance) throw new Error('Instance not found');

    const basePath = path.resolve(instance.cwd);
    const targetPath = path.resolve(basePath, relativePath);

    if (!this.isWithinCwd(basePath, targetPath)) {
      throw new Error('Path outside working directory');
    }

    const dirents = await fs.readdir(targetPath, { withFileTypes: true });
    const entries: FileEntry[] = [];

    for (const d of dirents) {
      if (d.name.startsWith('.') || IGNORED.has(d.name)) continue;

      const fullPath = path.join(targetPath, d.name);
      const rel = path.relative(basePath, fullPath).replace(/\\/g, '/');

      try {
        const stats = await fs.stat(fullPath);
        entries.push({
          name: d.name,
          path: rel,
          type: d.isDirectory() ? 'directory' : 'file',
          size: d.isFile() ? stats.size : undefined,
          mtime: stats.mtimeMs,
        });
      } catch {
        // Skip entries we can't stat (permission errors, etc.)
      }
    }

    return entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readFileContent(instanceId: string, filePath: string): Promise<{ content: string; language?: string }> {
    const instance = this.instanceManager.get(instanceId);
    if (!instance) throw new Error('Instance not found');

    const basePath = path.resolve(instance.cwd);
    const targetPath = path.resolve(basePath, filePath);

    if (!this.isWithinCwd(basePath, targetPath)) {
      throw new Error('Path outside working directory');
    }

    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) throw new Error('Not a file');
    if (stats.size > MAX_FILE_SIZE) throw new Error('File too large (max 5MB)');

    const content = await fs.readFile(targetPath, 'utf-8');
    return { content, language: this.detectLanguage(filePath) };
  }

  private isWithinCwd(cwd: string, target: string): boolean {
    const resolved = path.resolve(target);
    const base = path.resolve(cwd);
    return resolved === base || resolved.startsWith(base + path.sep);
  }

  private detectLanguage(filePath: string): string | undefined {
    const map: Record<string, string> = {
      '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
      '.ts': 'typescript', '.mts': 'typescript',
      '.jsx': 'javascript', '.tsx': 'typescript',
      '.py': 'python', '.java': 'java', '.go': 'go',
      '.rs': 'rust', '.cpp': 'cpp', '.c': 'c', '.h': 'c',
      '.css': 'css', '.scss': 'scss', '.less': 'less',
      '.html': 'html', '.htm': 'html', '.svelte': 'html',
      '.json': 'json', '.md': 'markdown',
      '.yml': 'yaml', '.yaml': 'yaml',
      '.sh': 'bash', '.bash': 'bash',
      '.sql': 'sql', '.rb': 'ruby', '.php': 'php',
      '.swift': 'swift', '.kt': 'kotlin',
      '.toml': 'toml', '.xml': 'xml',
    };
    return map[path.extname(filePath).toLowerCase()];
  }
}
