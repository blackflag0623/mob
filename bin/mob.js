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

  function startServer() {
    const child = spawn(process.execPath, [serverEntry], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env },
    });

    child.on('exit', (code) => {
      if (code === RESTART_EXIT_CODE) {
        console.log('Update installed, restarting server...');
        startServer();
      } else {
        process.exit(code ?? 0);
      }
    });

    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  }

  startServer();
}
