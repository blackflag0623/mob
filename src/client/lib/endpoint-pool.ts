import type { ClientMessage, ServerMessage } from './types.js';
import { WsClient } from './ws-client.js';
import { endpoints, endpointWsUrl, nsId, parseNsId, LOCAL_ENDPOINT_ID, type Endpoint } from './endpoints.js';
import { get } from 'svelte/store';

type RouteableMessage = Extract<ClientMessage, { payload: { instanceId: string } }>;

/** Messages that target a specific instance — routed to that instance's endpoint. */
function instanceIdOf(msg: ClientMessage): string | null {
  if ('payload' in msg && msg.payload && typeof msg.payload === 'object' && 'instanceId' in msg.payload) {
    return (msg as RouteableMessage).payload.instanceId;
  }
  return null;
}

/** Strip namespace prefix from outgoing instanceId so the server sees its raw id. */
function stripNs<M extends ClientMessage>(msg: M, rawId: string): M {
  if (!('payload' in msg) || !msg.payload) return msg;
  const payload: any = msg.payload;
  if (!('instanceId' in payload)) return msg;
  return { ...msg, payload: { ...payload, instanceId: rawId } } as M;
}

/** Add namespace prefix to incoming instance ids so client-side ids are globally unique. */
function namespaceServerMsg(msg: ServerMessage, endpointId: string): ServerMessage {
  switch (msg.type) {
    case 'snapshot':
      return {
        ...msg,
        payload: {
          ...msg.payload,
          instances: msg.payload.instances.map((i) => ({
            ...i,
            id: nsId(endpointId, i.id),
            previousInstanceId: i.previousInstanceId ? nsId(endpointId, i.previousInstanceId) : undefined,
            endpointId,
          })),
        },
      } as ServerMessage;
    case 'instance:update':
      return {
        ...msg,
        payload: {
          ...msg.payload,
          id: nsId(endpointId, msg.payload.id),
          previousInstanceId: msg.payload.previousInstanceId ? nsId(endpointId, msg.payload.previousInstanceId) : undefined,
          endpointId,
        },
      } as ServerMessage;
    case 'instance:remove':
    case 'instance:select':
    case 'terminal:output':
    case 'terminal:scrollback':
    case 'terminal:exit':
    case 'files:changed':
      return {
        ...msg,
        payload: {
          ...msg.payload,
          instanceId: nsId(endpointId, msg.payload.instanceId),
        },
      } as ServerMessage;
    case 'launch:conflicts':
      return {
        ...msg,
        payload: {
          ...msg.payload,
          sameDirInstances: msg.payload.sameDirInstances.map((i) => ({ ...i, id: nsId(endpointId, i.id) })),
          sameBranchInstances: msg.payload.sameBranchInstances.map((i) => ({ ...i, id: nsId(endpointId, i.id) })),
        },
      } as ServerMessage;
    default:
      return msg;
  }
}

type MessageHandler = (msg: ServerMessage, endpointId: string) => void;
type ConnectionHandler = (endpointId: string, connected: boolean) => void;

export class EndpointPool {
  private clients = new Map<string, WsClient>();
  private connected = new Map<string, boolean>();
  private msgHandlers = new Set<MessageHandler>();
  private connHandlers = new Set<ConnectionHandler>();
  private launchEndpoint: string = LOCAL_ENDPOINT_ID;

  start(): void {
    // Ensure a client per endpoint, react to endpoint list changes
    endpoints.subscribe((list) => this.sync(list));
  }

  /** Endpoint to use for non-instance-targeted messages (launch, launch:check, update:check). */
  setLaunchEndpoint(id: string): void {
    this.launchEndpoint = id;
  }

  private sync(list: Endpoint[]): void {
    const wanted = new Set(list.map((e) => e.id));
    // Remove clients for deleted endpoints
    for (const [id, client] of this.clients) {
      if (!wanted.has(id)) {
        client.disconnect();
        this.clients.delete(id);
        this.connected.delete(id);
        for (const h of this.connHandlers) h(id, false);
      }
    }
    // Add/refresh clients
    for (const ep of list) {
      const existing = this.clients.get(ep.id);
      const url = endpointWsUrl(ep.id);
      if (existing && (existing as any).url === url) continue;
      if (existing) existing.disconnect();
      const client = new WsClient(url);
      client.setConnectionHandler((connected) => {
        this.connected.set(ep.id, connected);
        for (const h of this.connHandlers) h(ep.id, connected);
      });
      client.onMessage((msg) => {
        const wrapped = namespaceServerMsg(msg, ep.id);
        for (const h of this.msgHandlers) h(wrapped, ep.id);
      });
      client.connect();
      this.clients.set(ep.id, client);
    }
  }

  send(msg: ClientMessage, explicitEndpoint?: string): void {
    const targetId = instanceIdOf(msg);
    let endpointId: string;
    let outgoing = msg;
    if (targetId) {
      const { endpointId: epId, rawId } = parseNsId(targetId);
      endpointId = epId;
      outgoing = stripNs(msg, rawId);
    } else {
      endpointId = explicitEndpoint || this.launchEndpoint;
    }
    const client = this.clients.get(endpointId);
    if (!client) {
      console.warn(`[mob-pool] No client for endpoint "${endpointId}"`);
      return;
    }
    client.send(outgoing);
  }

  onMessage(handler: MessageHandler): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connHandlers.add(handler);
    return () => this.connHandlers.delete(handler);
  }

  isConnected(endpointId: string): boolean {
    return this.connected.get(endpointId) ?? false;
  }

  /** True if at least one endpoint is currently connected. */
  anyConnected(): boolean {
    for (const v of this.connected.values()) if (v) return true;
    return false;
  }
}

export const pool = new EndpointPool();
