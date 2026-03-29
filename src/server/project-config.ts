import fs from 'fs';
import path from 'path';
import { createLogger } from './util/logger.js';

const log = createLogger('project-config');

export interface ProjectConfig {
  setup?: string[];
  teardown?: string[];
  defaults?: {
    model?: string;
    permissionMode?: string;
    autoName?: boolean;
  };
}

const MAX_COMMANDS = 10;
const MAX_COMMAND_LENGTH = 500;

function validateCommands(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const commands: string[] = [];
  for (const item of arr.slice(0, MAX_COMMANDS)) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_COMMAND_LENGTH) continue;
    commands.push(trimmed);
  }
  return commands.length > 0 ? commands : undefined;
}

/**
 * Load .mob/config.json from a project directory.
 * Returns null if not found or invalid.
 *
 * Setup/teardown commands are written into the PTY (visible to the user),
 * not executed silently. Validation caps array length and command length
 * as defense-in-depth.
 */
export function loadProjectConfig(cwd: string): ProjectConfig | null {
  const configPath = path.join(cwd, '.mob', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);

    const config: ProjectConfig = {};

    config.setup = validateCommands(parsed.setup);
    config.teardown = validateCommands(parsed.teardown);

    if (parsed.defaults && typeof parsed.defaults === 'object') {
      config.defaults = {};
      if (typeof parsed.defaults.model === 'string') config.defaults.model = parsed.defaults.model;
      if (typeof parsed.defaults.permissionMode === 'string') config.defaults.permissionMode = parsed.defaults.permissionMode;
      if (typeof parsed.defaults.autoName === 'boolean') config.defaults.autoName = parsed.defaults.autoName;
    }

    log.info(`Loaded project config from ${configPath}`);
    return config;
  } catch {
    return null;
  }
}
