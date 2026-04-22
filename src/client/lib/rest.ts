import { endpointHttpBase, parseNsId, LOCAL_ENDPOINT_ID } from './endpoints.js';

/** Build an absolute (or same-origin) URL for an endpoint's REST API. */
export function endpointUrl(endpointId: string, path: string): string {
  const base = endpointHttpBase(endpointId);
  return `${base}${path}`;
}

/** Build a URL for an endpoint scoped to a (namespaced) instance id, replacing the namespaced id with the raw one. */
export function instanceUrl(namespacedId: string, suffix: string): string {
  const { endpointId, rawId } = parseNsId(namespacedId);
  const base = endpointHttpBase(endpointId);
  return `${base}/api/instances/${encodeURIComponent(rawId)}${suffix}`;
}

export function localUrl(path: string): string {
  return endpointUrl(LOCAL_ENDPOINT_ID, path);
}
