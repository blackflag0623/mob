import { EventEmitter } from 'events';
import { PtyManager } from './pty-manager.js';
import { DiscoveryService } from './discovery.js';
import type { InstanceInfo, InstanceState, LaunchPayload } from '../shared/protocol.js';
import type { InstanceStatusFile, ManagedInstance } from './types.js';
import { generateInstanceId } from './util/id.js';
import { STALE_THRESHOLD_MS } from '../shared/constants.js';

export class InstanceManager extends EventEmitter {
  private instances = new Map<string, InstanceInfo>();
  private managedIds = new Set<string>();
  private autoNameIds = new Set<string>();
  private ptyManager: PtyManager;
  private discovery: DiscoveryService;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  public subscribers = new Map<string, Set<import('ws').WebSocket>>();

  constructor(ptyManager: PtyManager, discovery: DiscoveryService) {
    super();
    this.ptyManager = ptyManager;
    this.discovery = discovery;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.discovery.on('update', (status: InstanceStatusFile, filePath: string) => {
      const existing = this.instances.get(status.id);
      const info: InstanceInfo = {
        id: status.id,
        name: existing?.name || status.id,
        managed: this.managedIds.has(status.id),
        cwd: status.cwd,
        gitBranch: status.gitBranch,
        state: status.state,
        ticket: status.ticket,
        subtask: status.subtask,
        progress: status.progress,
        currentTool: status.currentTool,
        lastUpdated: status.lastUpdated,
        model: status.model || existing?.model,
      };
      this.instances.set(status.id, info);
      this.emit('update', info);
    });

    this.discovery.on('remove', (id: string) => {
      if (this.instances.has(id) && !this.managedIds.has(id)) {
        this.instances.delete(id);
        this.emit('remove', id);
      }
    });

    this.ptyManager.on('exit', (instanceId: string, exitCode: number) => {
      const info = this.instances.get(instanceId);
      if (info) {
        info.state = 'stopped';
        info.lastUpdated = Date.now();
        this.emit('update', info);
      }
      this.emit('pty:exit', instanceId, exitCode);
    });
  }

  launch(payload: LaunchPayload): InstanceInfo {
    const id = generateInstanceId();
    const dirName = payload.cwd.split('/').filter(Boolean).pop() || 'instance';
    const info: InstanceInfo = {
      id,
      name: payload.autoName ? dirName : (payload.name || id),
      managed: true,
      cwd: payload.cwd,
      state: 'running',
      lastUpdated: Date.now(),
      model: payload.model,
      permissionMode: payload.permissionMode,
    };

    this.instances.set(id, info);
    this.managedIds.add(id);
    if (payload.autoName) this.autoNameIds.add(id);
    this.subscribers.set(id, new Set());

    try {
      this.ptyManager.spawn(id, payload.cwd, {
        model: payload.model,
        permissionMode: payload.permissionMode,
      });
    } catch (err) {
      info.state = 'stopped';
      this.emit('update', info);
      return info;
    }

    this.emit('update', info);
    return info;
  }

  kill(instanceId: string): void {
    this.ptyManager.kill(instanceId);
    this.managedIds.delete(instanceId);
    const info = this.instances.get(instanceId);
    if (info) {
      info.state = 'stopped';
      info.lastUpdated = Date.now();
      this.emit('update', info);
    }
  }

  remove(instanceId: string): void {
    this.instances.delete(instanceId);
    this.managedIds.delete(instanceId);
    this.subscribers.delete(instanceId);
    this.emit('remove', instanceId);
  }

  handleHookUpdate(data: InstanceStatusFile): void {
    const existing = this.instances.get(data.id);
    // Auto-name: if the instance has autoName enabled and hook provides a subtask, use it
    let name = existing?.name || data.id;
    if (this.autoNameIds.has(data.id) && data.subtask) {
      name = data.subtask;
      this.autoNameIds.delete(data.id);
    }
    const info: InstanceInfo = {
      id: data.id,
      name,
      managed: this.managedIds.has(data.id),
      cwd: data.cwd,
      gitBranch: data.gitBranch,
      state: data.state,
      ticket: data.ticket,
      subtask: data.subtask,
      progress: data.progress,
      currentTool: data.currentTool,
      lastUpdated: data.lastUpdated,
      model: data.model || existing?.model,
    };
    this.instances.set(data.id, info);
    this.emit('update', info);
  }

  getAll(): InstanceInfo[] {
    return Array.from(this.instances.values());
  }

  get(id: string): InstanceInfo | undefined {
    return this.instances.get(id);
  }

  isManaged(id: string): boolean {
    return this.managedIds.has(id);
  }

  startStaleCheck(): void {
    this.staleTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, info] of this.instances) {
        if (info.state !== 'stopped' && info.state !== 'stale') {
          if (now - info.lastUpdated > STALE_THRESHOLD_MS) {
            info.state = 'stale';
            this.emit('update', info);
          }
        }
      }
    }, 10_000);
  }

  stop(): void {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.discovery.stop();
  }
}
