# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev servers (tsx watch + vite HMR on :4041, backend on :4040)
npm run build            # Production build (vite build + tsc for server)
npm start                # Run production server (serves everything on :4040)
npm run install-hooks    # Install Claude Code hooks into ~/.claude/settings.json
npm run uninstall-hooks  # Remove mob hooks from Claude Code settings
```

## Architecture

Mob is a local web dashboard that coordinates multiple Claude Code CLI sessions. It has three layers:

**Shared** (`src/shared/`) — WebSocket protocol types (`protocol.ts`) and constants. Imported by both server and client.

**Server** (`src/server/`) — Node.js backend (Express + ws + @lydell/node-pty + chokidar):
- `index.ts` bootstraps everything: creates PtyManager → DiscoveryService → InstanceManager → Express app → WS server
- `instance-manager.ts` is the central orchestrator. It holds a `Map<id, InstanceInfo>` unifying managed (PTY-spawned) and discovered (external hook-reported) instances. Uses EventEmitter to broadcast state changes.
- `pty-manager.ts` spawns shells via node-pty, injects `MOB_INSTANCE_ID` env var, then writes the `claude` command into the shell after 500ms. Emits `data` and `exit` events.
- `discovery.ts` watches `~/.mob/instances/*.json` with chokidar for external Claude instances reporting via hook scripts.
- `ws-server.ts` routes WebSocket messages and manages per-instance terminal subscriptions (`Map<instanceId, Set<WebSocket>>`). Terminal output only goes to subscribed clients.
- `express-app.ts` serves REST API (`/api/instances`, `/api/hook`, `/api/completions/dirs`) and static frontend in production.

**Client** (`src/client/`) — Svelte 5 app with xterm.js:
- `lib/stores.ts` holds reactive state wired to the WebSocket — `instances` Map auto-updates from server messages.
- `lib/ws-client.ts` connects to `/mob-ws` with exponential backoff reconnect.
- Components use Svelte 4 legacy syntax (`on:click`, `export let`, `$:`, `$store`). The `compatibility.componentApi: 4` flag is set in `svelte.config.js`.
- `TerminalPanel.svelte` caches xterm Terminal instances per-instance for fast switching.

## Data Flow

**Instance launch:** Client WS `launch` → InstanceManager creates ID + spawns PTY → emits `instance:update` → WS broadcasts to all clients → client auto-subscribes to terminal output.

**Terminal I/O:** xterm `onData` → WS `terminal:input` → PtyManager writes to PTY stdin → PTY emits data → WS `terminal:output` → only subscribed clients receive it.

**External instance discovery:** Hook script writes JSON to `~/.mob/instances/{id}.json` and/or POSTs to `/api/hook` → DiscoveryService or Express route → InstanceManager merges into instance map → broadcasts update.

## Key Design Details

- WebSocket path is `/mob-ws` (not `/ws`) to avoid conflicting with Vite's HMR WebSocket in dev.
- In dev, Vite on :4041 proxies `/api` to :4040 but WS proxy is unreliable — the client detects dev mode (port 4041) and connects WS directly to :4040.
- PTY spawns a shell first (not `claude` directly) so the user's PATH/auth loads and they can Ctrl+C back to a shell.
- `~` paths from the frontend are expanded server-side via `os.homedir()` in pty-manager.
- Instances with `autoName: true` get renamed when the first `subtask` arrives via hook update.
- Stale detection: instances with no update for 30s get marked `stale` (checked every 10s).

===========================================
ALWAYS RESPOND USE CHINESE!!!