export type { InstanceState, InstanceEditPayload, LaunchConflicts, LaunchPayload, ClientMessage, ServerMessage, FileEntry } from '../../shared/protocol.js';
import type { InstanceInfo as ServerInstanceInfo } from '../../shared/protocol.js';

/** Client-side instance record. Extends the server's InstanceInfo with the
 *  endpoint namespacing field populated by `endpoint-pool.ts`. */
export interface InstanceInfo extends ServerInstanceInfo {
  /** Which mob endpoint this instance lives on — populated client-side by the pool. */
  endpointId?: string;
}
