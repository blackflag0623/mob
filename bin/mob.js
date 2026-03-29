#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const subcommand = process.argv[2];

if (subcommand === 'install-hooks') {
  const { installHooks } = await import(join(root, 'dist', 'server', 'server', 'hooks.js'));
  installHooks(root);
} else if (subcommand === 'uninstall-hooks') {
  const { uninstallHooks } = await import(join(root, 'dist', 'server', 'server', 'hooks.js'));
  uninstallHooks();
} else {
  const serverEntry = join(root, 'dist', 'server', 'server', 'index.js');
  const RESTART_EXIT_CODE = 75;

  function startServer(isRestart = false) {
    const startTime = Date.now();
    const env = { ...process.env };
    if (process.argv.includes('--no-hooks')) {
      env.MOB_NO_HOOKS = '1';
    }

    const child = spawn(process.execPath, [serverEntry], {
      cwd: root,
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      if (code === RESTART_EXIT_CODE) {
        console.log('Update installed, restarting server...');
        startServer(true);
      } else if (isRestart && code !== 0 && Date.now() - startTime < 5000) {
        console.error(`Server crashed after update (exit ${code}). Try: npm i -g mob-coordinator`);
        process.exit(code ?? 1);
      } else {
        process.exit(code ?? 0);
      }
    });

    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  }

  startServer();
}
