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

**Shared** (`src/shared/`) — WebSocket protocol types (`protocol.ts`), user settings schema (`settings.ts`), and constants (`constants.ts`). Imported by both server and client.

**Server** (`src/server/`) — Node.js backend (Express + ws + @lydell/node-pty + chokidar):
- `index.ts` bootstraps everything: SettingsManager → PtyManager → DiscoveryService → SessionStore → InstanceManager → UpdateChecker → Express app → WS server.
- `instance-manager.ts` is the central orchestrator (large: ~680 lines). It owns a `Map<id, InstanceInfo>` unifying managed (PTY-spawned) and discovered (external hook-reported) instances, and currently also hosts: auto-naming from first subtask, Jira status polling, git branch refresh, terminal-tail state fallback (`terminal-state-detector.ts`), teardown command management, resume lifecycle, PTY event subscription, and the per-instance WebSocket subscriber map (this last one is a layering leak — see Known Structural Notes).
- `pty-manager.ts` spawns a shell via node-pty, injects `MOB_INSTANCE_ID` env var, then waits for the shell prompt (regex match against a tail buffer, with a 5s timeout fallback) before writing the `claude` command. Emits `data` / `exit`.
- `discovery.ts` watches `~/.mob/instances/*.json` with chokidar for external Claude instances reporting via hook scripts.
- `ws-server.ts` routes WebSocket messages (single large switch), manages broadcast with per-connection backpressure (2 MB threshold) and 16 ms per-instance output batching. Terminal output only goes to clients subscribed for that instance.
- `express-app.ts` serves REST API (`/api/instances` incl. `PATCH /api/instances/:id`, `/api/hook`, `/api/completions/dirs`, `/api/browse-dir`, `/api/platform`, `/api/settings`, `/api/instances/:id/files[/content]`) and static frontend in production.
- `file-system-service.ts` provides file tree listing and content reading for the file explorer — path traversal protection, 5 MB size limit, chokidar-based file watching (ref-counted per viewer) that pushes `files:changed` via WebSocket for live content updates.
- `scrollback-buffer.ts` persists per-instance scrollback to disk (atomic tmp-rename writes, byte-level cap) so reconnecting clients and reopened sessions can replay output.
- `session-store.ts` persists managed instance metadata under `~/.mob/sessions/` with atomic writes, enabling resume after server restart.
- `settings-manager.ts` loads/saves user settings from disk and emits change events.
- `update-checker.ts` polls npm for `mob-coordinator` updates; the client can trigger `update:install` which runs `npm i -g` and exits.
- `terminal-state-detector.ts` inspects recent terminal output as a fallback when hook signals go silent beyond `HOOK_SILENCE_THRESHOLD_MS`.
- `hooks.ts` installs/uninstalls mob hooks into `~/.claude/settings.json`.

**Client** (`src/client/`) — Svelte 5 app (running in Svelte 4 legacy compat) with xterm.js:
- `lib/endpoint-pool.ts` manages connections to **one or more** mob server endpoints. Each instance id is namespaced as `ep::rawId` so one portal can aggregate multiple servers. Messages and WS lifecycle are fanned in here before reaching stores.
- `lib/endpoints.ts` holds the endpoint list (persisted in localStorage).
- `lib/stores.ts` holds reactive state wired to the endpoint pool — `instances` Map auto-updates from server messages. Also currently does WS dispatch and module-level side effects (pool start, settings load) — see Known Structural Notes.
- `lib/ws-client.ts` is a single-endpoint WebSocket client used by the pool, with exponential-backoff reconnect.
- `lib/settings-client.ts` / `lib/rest.ts` / `lib/notifications.ts` / `lib/wallpaper.ts` / `lib/shortcuts.ts` are small focused helpers.
- Components use Svelte 4 legacy syntax (`on:click`, `export let`, `$:`, `$store`). The `compatibility.componentApi: 4` flag is set in `svelte.config.js`.
- `TerminalPanel.svelte` caches xterm Terminal instances per-instance for fast switching, with LRU eviction capped by `settings.general.maxCachedTerminals`. Refreshes the viewport on tab `visibilitychange` to recover from background-tab throttling, and hides xterm's own cursor while a TUI owns the alt-screen buffer.
- `Dashboard.svelte` provides Terminal/Files tab switching. TerminalPanel stays mounted (CSS hidden) when switching to Files to preserve xterm state.
- `FileExplorerPanel.svelte` is the file browser: left tree panel + right content viewer. `FileTree.svelte` uses `svelte:self` for recursive rendering with lazy-loaded subdirectories. `FileViewer.svelte` displays file content with Shiki syntax highlighting (VS Code TextMate grammars, github-dark theme, languages loaded on demand via WASM).

## Data Flow

**Instance launch:** Client WS `launch` → InstanceManager creates ID + spawns PTY → emits `instance:update` → WS broadcasts to all clients → client auto-subscribes to terminal output. A `launching → running` transition is scheduled ~3 s after prompt detection if no hook has arrived yet.

**Terminal I/O:** xterm `onData` → WS `terminal:input` → PtyManager writes to PTY stdin → PTY emits data → scrollback buffer append + WS `terminal:output` (batched at 16 ms, backpressure-gated) → only subscribed clients receive it.

**Reconnect / resume:** Persistent instance metadata in `~/.mob/sessions/` lets managed instances be recreated on server start. On WS reconnect the client re-subscribes and the server replays the scrollback via `terminal:scrollback`.

**External instance discovery:** Hook script writes JSON to `~/.mob/instances/{id}.json` and/or POSTs to `/api/hook` → DiscoveryService or Express route → InstanceManager merges into instance map → broadcasts update.

**State fallback:** If hook signals go silent past `HOOK_SILENCE_THRESHOLD_MS`, `terminal-state-detector.ts` infers state (`running` / `waiting`) from the recent PTY tail.

**Multi-endpoint aggregation:** The client's `endpoint-pool.ts` connects to each configured endpoint, namespaces all ids (`ep::rawId`), and merges messages into one store stream. `InstanceInfo.endpointId` on the client is a client-only namespacing field — the server never sets it.

**File browsing:** Client switches to Files tab → REST `GET /api/instances/:id/files?path=` returns directory listing → FileTree renders entries, expands subdirectories lazily. Clicking a file → REST `GET /api/instances/:id/files/content?path=` returns content → FileViewer highlights with Shiki. Client sends WS `files:watch` for the viewed file → server watches with chokidar → on change pushes WS `files:changed` → client re-fetches content.

## Key Design Details

- WebSocket path is `/mob-ws` (not `/ws`) to avoid conflicting with Vite's HMR WebSocket in dev.
- In dev, Vite on :4041 proxies `/api` to :4040 but WS proxy is unreliable — the client detects dev mode (port 4041) and connects WS directly to :4040.
- PTY spawns a shell first (not `claude` directly) so the user's PATH/auth loads and they can Ctrl+C back to a shell. The shell is picked from an allow-list; on Windows we avoid quoting pitfalls in cmd.exe.
- `~` paths from the frontend are expanded server-side via `os.homedir()` in pty-manager.
- Instances with `autoName: true` get renamed when the first `subtask` arrives via hook update.
- Stale detection: instances with no update for 30 s get marked `stale` (checked every 10 s).
- Scrollback and session files are written with tmp-then-rename for atomicity.
- WS edit (`instance:edit`) and REST `PATCH /api/instances/:id` are currently two parallel edit paths — prefer the WS path when adding fields, and keep them in sync.

## Known Structural Notes

These are deliberate trade-offs or tech debt worth knowing before making changes:

- **`InstanceManager` is a god-object** (~680 lines) covering registry + auto-name + Jira + git + state fallback + teardown + WS subscriber map. The `subscribers: Map<string, Set<WebSocket>>` field in particular leaks `ws` into the domain layer — prefer moving new subscription logic into `ws-server.ts`.
- **`ws-server.ts` is one big switch.** New message types should reuse the existing error/send helpers; consider extracting handler modules if the file keeps growing.
- **`stores.ts` is store + dispatcher + bootstrap.** Module-level `pool.start()` and `loadSettings()` run on import; be careful with HMR. Prefer adding new WS dispatch in a dedicated function rather than inline in the module body.
- **Derived stores repeat work.** `sortedInstances` / `groupedInstances` / `visualInstances` / `groupNames` / `selectedInCollapsedGroup` each re-scan the instances Map. If adding another projection, consider building a shared reverse index first.
- **`endpointId` is a client-only field** but currently lives on the shared `InstanceInfo` type — treat server emissions as never populating it.

===========================================
ALWAYS RESPOND USE CHINESE!!!
