# mob

A local web dashboard for coordinating multiple Claude Code CLI sessions. Launch, monitor, and switch between Claude instances working across different projects — all from a single browser tab.

## Features

- **Launch and manage** multiple Claude Code sessions from a web UI
- **Live terminal** view with full I/O for each session (xterm.js)
- **Session persistence** — sessions survive server restarts and can be resumed
- **Auto-naming** — sessions are named based on the first prompt you send Claude
- **Hook integration** — external Claude instances report status via hook scripts
- **Git branch tracking** — see which branch each session is on, auto-refreshed
- **Keyboard shortcuts** — cycle sessions, jump by number, clipboard support
- **Visual indicators** — pulsing "Needs Input" badge when Claude is waiting for you

## Prerequisites

- **Node.js** 18+ (tested with 20.x)
- **Claude Code CLI** installed and authenticated (`claude` command available in your terminal)
- **git** (for branch detection)

## Quick Start

```bash
git clone https://github.com/nickelbob/mob.git
cd mob
npm install
```

If you see errors about missing native modules, run:

```bash
npm run setup
```

This detects your platform and installs the correct native binaries for node-pty and rollup. It also runs automatically before `npm run dev` and `npm run build`.

### Install Claude Code Hooks

To enable status reporting (state, branch, auto-naming) from Claude instances launched by mob:

```bash
npm run install-hooks
```

This adds hook entries to `~/.claude/settings.json` that report instance status back to the dashboard.

### Run

**Development** (hot-reload):

```bash
npm run dev
```

Opens the backend on `http://localhost:4040` and the Vite dev server on `http://localhost:4041`. Use port 4041 during development.

**Production**:

```bash
npm run build
npm start
```

Everything is served from `http://localhost:4040`.

## Usage

### Launching Instances

1. Click **+ Launch Instance** (or press **Alt+N**)
2. Type or paste a working directory path (autocomplete suggests as you type)
3. Optionally set a name, model, and permission mode
4. Click **Launch** (or press **Ctrl+Enter**)

The instance spawns a shell, loads your environment, and starts Claude Code in the specified directory.

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Alt+N** | Open launch dialog |
| **Alt+Up/Down** | Cycle through sessions |
| **Ctrl+1-9** | Jump to session by position |
| **Ctrl+C** | Copy selected text (or send interrupt if no selection) |
| **Ctrl+V** | Paste from clipboard into terminal |
| **Ctrl+Enter** | Launch instance (in launch dialog) |
| **Escape** | Close launch dialog |

### Session States

| State | Meaning |
|---|---|
| **Running** | Claude is working (using tools, generating response) |
| **Needs Input** | Claude is waiting for your input (permission prompt, question) |
| **Idle** | User just submitted a prompt, Claude is about to process |
| **Stale** | No activity for 30+ seconds |
| **Stopped** | Session ended (can be resumed) |

### External Instances

Claude Code sessions started outside of mob (e.g., directly in a terminal) will appear in the dashboard as "external" instances if the hooks are installed. They show status, branch, and state but don't provide terminal I/O.

## Architecture

Three layers:

- **Shared** (`src/shared/`) — WebSocket protocol types and constants
- **Server** (`src/server/`) — Node.js backend: Express + ws + node-pty + chokidar
- **Client** (`src/client/`) — Svelte 5 app with xterm.js

See `CLAUDE.md` for detailed architecture documentation.

## Uninstalling Hooks

```bash
npm run uninstall-hooks
```

## Troubleshooting

### Missing native modules after `npm install`

npm has a [known bug](https://github.com/npm/cli/issues/4828) with optional platform-specific dependencies. Run `npm run setup` to auto-detect and install the correct ones. If that doesn't work:

```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
npm run setup
```

### Port 4040 already in use

Another instance of mob (or another process) is using the port. Kill it or set a custom port:

```bash
MOB_PORT=4050 npm run dev
```

### Hooks not reporting status

1. Make sure hooks are installed: `npm run install-hooks`
2. Check `~/.claude/settings.json` has entries for `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, and `Notification`
3. On Windows, ensure PowerShell can run the hook script (execution policy)
