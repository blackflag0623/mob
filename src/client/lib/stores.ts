import { writable, derived } from 'svelte/store';
import type { InstanceInfo } from './types.js';
import { WsClient } from './ws-client.js';

export const wsClient = new WsClient();
export const instances = writable<Map<string, InstanceInfo>>(new Map());
export const selectedInstanceId = writable<string | null>(null);
export const wsConnected = writable(false);
export const showLaunchDialog = writable(false);

export const selectedInstance = derived(
  [instances, selectedInstanceId],
  ([$instances, $id]) => ($id ? $instances.get($id) ?? null : null)
);

export const sortedInstances = derived(instances, ($instances) => {
  return Array.from($instances.values()).sort((a, b) => {
    // Active instances first
    const stateOrder: Record<string, number> = { launching: 0, running: 1, waiting: 2, idle: 3, stale: 4, stopped: 5 };
    const aOrder = stateOrder[a.state] ?? 5;
    const bOrder = stateOrder[b.state] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.lastUpdated - a.lastUpdated;
  });
});

// Wire up WebSocket to stores
wsClient.setConnectionHandler((connected) => {
  wsConnected.set(connected);
});

wsClient.onMessage((msg) => {
  switch (msg.type) {
    case 'snapshot':
      instances.set(new Map(msg.payload.instances.map((i) => [i.id, i])));
      break;
    case 'instance:update':
      instances.update((map) => {
        map.set(msg.payload.id, msg.payload);
        return new Map(map);
      });
      break;
    case 'instance:remove':
      instances.update((map) => {
        map.delete(msg.payload.instanceId);
        return new Map(map);
      });
      selectedInstanceId.update((id) =>
        id === msg.payload.instanceId ? null : id
      );
      break;
    case 'instance:select':
      selectedInstanceId.set(msg.payload.instanceId);
      break;
  }

  // terminal:scrollback and terminal:output are handled by TerminalPanel via onMessage
});

// Connect on load
wsClient.connect();
