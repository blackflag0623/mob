import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function main(): void {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log('No Claude settings found, nothing to uninstall.');
    return;
  }

  let settings: Record<string, any>;
  try {
    settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
  } catch {
    console.error('Could not parse settings.json');
    process.exit(1);
  }

  if (!settings.hooks) {
    console.log('No hooks found in settings.');
    return;
  }

  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    if (Array.isArray(settings.hooks[event])) {
      const before = settings.hooks[event].length;
      settings.hooks[event] = settings.hooks[event].filter(
        (h: any) => !(h.type === 'command' && typeof h.command === 'string' && h.command.includes('mob-status'))
      );
      removed += before - settings.hooks[event].length;

      // Clean up empty arrays
      if (settings.hooks[event].length === 0) {
        delete settings.hooks[event];
      }
    }
  }

  // Clean up empty hooks object
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log(`Removed ${removed} mob hook(s) from Claude settings.`);
}

main();
