import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = path.resolve(__dirname, '..', 'hooks', 'mob-status.sh');
const HOOK_SCRIPT_WIN = path.resolve(__dirname, '..', 'hooks', 'mob-status.ps1');

const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'UserPromptSubmit',
  'Notification',
];

function getHookCommand(): string {
  if (process.platform === 'win32') {
    return `powershell -ExecutionPolicy Bypass -File "${HOOK_SCRIPT_WIN}"`;
  }
  return `bash "${HOOK_SCRIPT}"`;
}

function main(): void {
  // Read existing settings
  let settings: Record<string, any> = {};
  const settingsDir = path.dirname(CLAUDE_SETTINGS_PATH);

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
    } catch {
      console.error('Warning: Could not parse existing settings.json, creating new one');
    }
  }

  // Initialize hooks structure
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const hookCommand = getHookCommand();

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    // Check if mob hook already exists
    const existing = settings.hooks[event].find(
      (h: any) => h.type === 'command' && typeof h.command === 'string' && h.command.includes('mob-status')
    );

    if (existing) {
      // Update existing hook
      existing.command = hookCommand;
    } else {
      // Add new hook
      settings.hooks[event].push({
        type: 'command',
        command: hookCommand,
      });
    }
  }

  // Write settings
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log('Mob hooks installed successfully!');
  console.log(`Hook script: ${process.platform === 'win32' ? HOOK_SCRIPT_WIN : HOOK_SCRIPT}`);
  console.log(`Events: ${HOOK_EVENTS.join(', ')}`);
}

main();
