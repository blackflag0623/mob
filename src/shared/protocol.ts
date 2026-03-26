// Client → Server messages
export type ClientMessage =
  | { type: 'sync' }
  | { type: 'launch'; payload: LaunchPayload }
  | { type: 'kill'; payload: { instanceId: string } }
  | { type: 'terminal:subscribe'; payload: { instanceId: string } }
  | { type: 'terminal:unsubscribe'; payload: { instanceId: string } }
  | { type: 'terminal:input'; payload: { instanceId: string; data: string } }
  | { type: 'terminal:resize'; payload: { instanceId: string; cols: number; rows: number } };

export interface LaunchPayload {
  name: string;
  autoName?: boolean;
  cwd: string;
  model?: string;
  permissionMode?: string;
}

// Server → Client messages
export type ServerMessage =
  | { type: 'snapshot'; payload: { instances: InstanceInfo[] } }
  | { type: 'instance:update'; payload: InstanceInfo }
  | { type: 'instance:remove'; payload: { instanceId: string } }
  | { type: 'terminal:output'; payload: { instanceId: string; data: string } }
  | { type: 'terminal:exit'; payload: { instanceId: string; exitCode: number } }
  | { type: 'error'; payload: { message: string; context?: string } };

export interface InstanceInfo {
  id: string;
  name: string;
  managed: boolean;
  cwd: string;
  gitBranch?: string;
  state: InstanceState;
  ticket?: string;
  subtask?: string;
  progress?: number;
  currentTool?: string;
  lastUpdated: number;
  model?: string;
  permissionMode?: string;
}

export type InstanceState = 'running' | 'idle' | 'waiting' | 'stopped' | 'stale';
