import { writable, derived, get } from 'svelte/store';
import type { InstanceInfo, LaunchConflicts, FileEntry, ClientMessage } from './types.js';
import type { Settings } from '../../shared/settings.js';
import { DEFAULT_SETTINGS } from '../../shared/settings.js';
import { pool } from './endpoint-pool.js';
import { endpoints, selectedLaunchEndpoint, LOCAL_ENDPOINT_ID } from './endpoints.js';
import { loadSettings } from './settings-client.js';
import { requestNotificationPermission, checkWaitingNotification, clearInstanceState } from './notifications.js';

// Facade so existing call sites `wsClient.send(...)` keep working,
// now routing to the right endpoint based on payload.instanceId.
export const wsClient = {
  send(msg: ClientMessage) { pool.send(msg); },
  sendTo(endpointId: string, msg: ClientMessage) { pool.send(msg, endpointId); },
  onMessage(handler: (msg: any) => void): () => void {
    return pool.onMessage((msg) => handler(msg));
  },
};
export const instances = writable<Map<string, InstanceInfo>>(new Map());
const _storedInstanceId = sessionStorage.getItem('mob:selectedInstanceId');
export const selectedInstanceId = writable<string | null>(_storedInstanceId);
selectedInstanceId.subscribe((id) => {
  if (id) sessionStorage.setItem('mob:selectedInstanceId', id);
  else sessionStorage.removeItem('mob:selectedInstanceId');
});
// Per-endpoint connection state; aggregated `wsConnected` = any connected
export const endpointConnections = writable<Record<string, boolean>>({});
export const wsConnected = derived(endpointConnections, ($c) => Object.values($c).some(Boolean));
export const showLaunchDialog = writable(false);
export const showSettingsDialog = writable(false);
export const settings = writable<Settings>(structuredClone(DEFAULT_SETTINGS));
export const sidebarCollapsed = writable(false);
export const errors = writable<Array<{ message: string; context?: string; timestamp: number }>>([]);
export const updateAvailable = writable<{ current: string; latest: string } | null>(null);
export const updateStatus = writable<'idle' | 'installing' | 'success' | 'failed'>('idle');
export const updateError = writable<string | null>(null);
export const launchConflicts = writable<LaunchConflicts | null>(null);
export const serverVersion = writable<string>('');

// File explorer state
export const activeMainTab = writable<'terminal' | 'files'>('terminal');
export const fileTreeCache = writable<Map<string, FileEntry[]>>(new Map());
export const selectedFile = writable<{ instanceId: string; path: string } | null>(null);
export const fileContent = writable<{ path: string; content: string; language?: string } | null>(null);
export const expandedDirs = writable<Set<string>>(new Set());
export const fileTreeLoading = writable(false);
export const fileContentLoading = writable(false);
export const fileChanged = writable<{ instanceId: string; filePath: string } | null>(null);

// Reset file explorer when instance changes
selectedInstanceId.subscribe(() => {
  selectedFile.set(null);
  fileContent.set(null);
  expandedDirs.set(new Set());
  fileTreeCache.set(new Map());
});

export const selectedInstance = derived(
  [instances, selectedInstanceId],
  ([$instances, $id]) => ($id ? $instances.get($id) ?? null : null)
);

export const sortedInstances = derived(instances, ($instances) => {
  return Array.from($instances.values()).sort((a, b) => {
    // Stable sort: by creation time (oldest first), stopped instances last
    const aStop = a.state === 'stopped' ? 1 : 0;
    const bStop = b.state === 'stopped' ? 1 : 0;
    if (aStop !== bStop) return aStop - bStop;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
});

export interface ProjectGroup {
  project: string;
  instances: InstanceInfo[];
}

// Extract repo name from a git remote URL (e.g. "git@github.com:user/xnow.git" → "xnow")
function repoNameFromUrl(url: string): string | undefined {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match ? match[1] : undefined;
}

export const groupedInstances = derived(sortedInstances, ($sorted) => {
  // Group priority: user-set project > git remote URL (same repo) > git root > directory
  // Case-insensitive keys so "XNOW" and "xnow" merge
  //
  // First pass: build a map from remote URL → display name (first instance's repo name wins)
  const remoteToName = new Map<string, string>();
  for (const instance of $sorted) {
    if (instance.gitRemoteUrl && !remoteToName.has(instance.gitRemoteUrl)) {
      const repoName = repoNameFromUrl(instance.gitRemoteUrl);
      if (repoName) remoteToName.set(instance.gitRemoteUrl, repoName);
    }
  }

  const groups = new Map<string, { name: string; instances: InstanceInfo[] }>();
  for (const instance of $sorted) {
    const cwd = instance.cwd || '';
    const dirName = cwd.split('/').filter(Boolean).pop() || 'Unknown';
    // Derive display name: project > remote repo name > gitRoot dirname > cwd dirname
    const name = instance.project
      || (instance.gitRemoteUrl ? remoteToName.get(instance.gitRemoteUrl) : undefined)
      || (instance.gitRoot ? instance.gitRoot.split('/').filter(Boolean).pop() || dirName : dirName);
    // Always key by display name (lowercased) so all naming sources merge case-insensitively
    const key = name.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { name, instances: [] };
      groups.set(key, group);
    }
    group.instances.push(instance);
  }
  // Sort groups: groups with active instances first, then alphabetically
  return Array.from(groups.values())
    .sort((a, b) => {
      const aHasActive = a.instances.some(i => i.state !== 'stopped') ? 0 : 1;
      const bHasActive = b.instances.some(i => i.state !== 'stopped') ? 0 : 1;
      if (aHasActive !== bHasActive) return aHasActive - bHasActive;
      return a.name.localeCompare(b.name);
    })
    .map(({ name, instances }): ProjectGroup => ({ project: name, instances }));
});

// List of existing group names for autocomplete
export const groupNames = derived(groupedInstances, ($groups) =>
  $groups.map(g => g.project),
);

// Flat list in visual order: when grouped (2+ projects), follows group order; otherwise same as sortedInstances
export const visualInstances = derived([groupedInstances, sortedInstances], ([$grouped, $sorted]) => {
  if ($grouped.length <= 1) return $sorted;
  return $grouped.flatMap(g => g.instances);
});

// Track which project groups are collapsed in the sidebar
export const collapsedGroups = writable<Record<string, boolean>>({});

// Whether the currently selected instance is hidden inside a collapsed project group
export const selectedInCollapsedGroup = derived(
  [selectedInstanceId, groupedInstances, collapsedGroups],
  ([$id, $groups, $collapsed]) => {
    if (!$id || $groups.length <= 1) return false;
    for (const group of $groups) {
      if (group.instances.some(i => i.id === $id)) {
        return !!$collapsed[group.project];
      }
    }
    return false;
  },
);

// Wire pool connection state into per-endpoint store
pool.onConnection((endpointId, connected) => {
  endpointConnections.update((m) => ({ ...m, [endpointId]: connected }));
});

// Track which endpoints we've seen snapshots from (used to remove stale instances on reconnect)
const snapshotEndpoints = new Set<string>();

// Event emitter for instance removal (used by TerminalPanel for cache cleanup)
type InstanceRemoveHandler = (instanceId: string) => void;
const instanceRemoveHandlers = new Set<InstanceRemoveHandler>();
export function onInstanceRemove(handler: InstanceRemoveHandler): () => void {
  instanceRemoveHandlers.add(handler);
  return () => instanceRemoveHandlers.delete(handler);
}

pool.onMessage((msg, endpointId) => {
  switch (msg.type) {
    case 'snapshot': {
      // Replace this endpoint's instances; keep others
      snapshotEndpoints.add(endpointId);
      instances.update((map) => {
        const next = new Map(map);
        // Drop existing instances belonging to this endpoint
        for (const id of Array.from(next.keys())) {
          if (next.get(id)?.endpointId === endpointId) next.delete(id);
        }
        for (const i of msg.payload.instances) next.set(i.id, i);
        return next;
      });
      // Server version comes from the local endpoint; remote versions are ignored for the header
      if (endpointId === LOCAL_ENDPOINT_ID && msg.payload.version) {
        serverVersion.set(msg.payload.version);
      }
      if (endpointId === LOCAL_ENDPOINT_ID && msg.payload.updateAvailable) {
        updateAvailable.set(msg.payload.updateAvailable);
      }
      const currentId = get(selectedInstanceId);
      if (currentId && !get(instances).has(currentId)) {
        selectedInstanceId.set(null);
      }
      break;
    }
    case 'instance:update':
      instances.update((map) => {
        map.set(msg.payload.id, msg.payload);
        return new Map(map);
      });
      if (get(settings).general.notifications) {
        const s = get(settings);
        checkWaitingNotification(msg.payload.id, msg.payload.name, msg.payload.state, s.general.notificationSound);
      }
      break;
    case 'instance:remove':
      instances.update((map) => {
        map.delete(msg.payload.instanceId);
        return new Map(map);
      });
      selectedInstanceId.update((id) => (id === msg.payload.instanceId ? null : id));
      clearInstanceState(msg.payload.instanceId);
      for (const handler of instanceRemoveHandlers) handler(msg.payload.instanceId);
      break;
    case 'instance:select':
      selectedInstanceId.set(msg.payload.instanceId);
      break;
    case 'error':
      errors.update((errs) => [
        ...errs.slice(-19),
        { message: msg.payload.message, context: msg.payload.context, timestamp: Date.now() },
      ]);
      break;
    case 'update:status':
      updateStatus.set(msg.payload.status);
      if (msg.payload.error) updateError.set(msg.payload.error);
      break;
    case 'update:available':
      if (endpointId === LOCAL_ENDPOINT_ID) updateAvailable.set(msg.payload);
      break;
    case 'launch:conflicts':
      launchConflicts.set(msg.payload);
      break;
    case 'files:changed':
      fileChanged.set(msg.payload);
      break;
  }
});

// When an endpoint disconnects, remove its instances from the map
pool.onConnection((endpointId, connected) => {
  if (connected) return;
  if (!snapshotEndpoints.has(endpointId)) return;
  instances.update((map) => {
    const next = new Map(map);
    for (const id of Array.from(next.keys())) {
      if (next.get(id)?.endpointId === endpointId) next.delete(id);
    }
    return next;
  });
});

// Keep pool's launch endpoint in sync with user selection
selectedLaunchEndpoint.subscribe((id) => pool.setLaunchEndpoint(id));

// Start the pool — creates a WsClient per configured endpoint
pool.start();

// Load settings from server
loadSettings()
  .then((s) => {
    settings.set(s);
    sidebarCollapsed.set(s.general.sidebarCollapsed);
    if (s.general.notifications) {
      requestNotificationPermission();
    }
  })
  .catch(() => {
    // Use defaults on failure
  });
