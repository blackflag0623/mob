import { writable, get } from 'svelte/store';

export interface Endpoint {
  id: string;
  name: string;
  baseUrl: string; // empty string = same origin as the page
}

const STORAGE_KEY = 'mob:endpoints';
const SELECTED_LAUNCH_KEY = 'mob:launchEndpoint';

export const LOCAL_ENDPOINT_ID = 'local';

function loadEndpoints(): Endpoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [defaultLocal()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultLocal()];
    // Always ensure local exists at index 0
    const hasLocal = parsed.some((e: Endpoint) => e.id === LOCAL_ENDPOINT_ID);
    return hasLocal ? parsed : [defaultLocal(), ...parsed];
  } catch {
    return [defaultLocal()];
  }
}

function defaultLocal(): Endpoint {
  return { id: LOCAL_ENDPOINT_ID, name: 'Local', baseUrl: '' };
}

export const endpoints = writable<Endpoint[]>(loadEndpoints());

endpoints.subscribe((list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota / private mode */ }
});

export const selectedLaunchEndpoint = writable<string>(
  localStorage.getItem(SELECTED_LAUNCH_KEY) || LOCAL_ENDPOINT_ID,
);
selectedLaunchEndpoint.subscribe((id) => {
  try { localStorage.setItem(SELECTED_LAUNCH_KEY, id); } catch { /* ignore */ }
});

/** Compose a namespaced instance id "endpointId::rawId". */
export function nsId(endpointId: string, rawId: string): string {
  return `${endpointId}::${rawId}`;
}

/** Parse a namespaced id; falls back to local for legacy ids. */
export function parseNsId(id: string): { endpointId: string; rawId: string } {
  const idx = id.indexOf('::');
  if (idx === -1) return { endpointId: LOCAL_ENDPOINT_ID, rawId: id };
  return { endpointId: id.slice(0, idx), rawId: id.slice(idx + 2) };
}

export function getEndpoint(endpointId: string): Endpoint | undefined {
  return get(endpoints).find((e) => e.id === endpointId);
}

/** Resolve baseUrl for fetch (empty string = same origin). */
export function endpointHttpBase(endpointId: string): string {
  const ep = getEndpoint(endpointId);
  if (!ep) return '';
  return ep.baseUrl.replace(/\/+$/, '');
}

/** Build a WebSocket URL for an endpoint. */
export function endpointWsUrl(endpointId: string): string {
  const ep = getEndpoint(endpointId);
  if (!ep || !ep.baseUrl) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/mob-ws`;
  }
  // Convert http(s):// to ws(s)://
  const url = ep.baseUrl.replace(/\/+$/, '');
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}/mob-ws`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}/mob-ws`;
  // Bare host:port
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url}/mob-ws`;
}

/** Generate a stable id for a new endpoint based on baseUrl. */
export function makeEndpointId(): string {
  return `ep_${Math.random().toString(36).slice(2, 10)}`;
}
