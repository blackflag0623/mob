import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { InstanceManager } from './instance-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [http]`, ...args);
}

export function createApp(instanceManager: InstanceManager): express.Application {
  const app = express();
  app.use(express.json());

  // Request logging for API routes
  app.use('/api', (req, _res, next) => {
    log(`${req.method} ${req.originalUrl}`);
    next();
  });

  // Serve static frontend in production (only if built)
  const clientDir = path.join(__dirname, '..', 'client');
  const indexHtml = path.join(clientDir, 'index.html');
  const hasBuiltClient = fs.existsSync(indexHtml);

  if (hasBuiltClient) {
    app.use(express.static(clientDir));
  }

  // Directory autocomplete for launch dialog
  app.get('/api/completions/dirs', (req, res) => {
    const partial = (req.query.q as string) || '';
    if (!partial) {
      res.json([]);
      return;
    }

    // Expand ~ to home dir
    const expanded = partial.startsWith('~')
      ? path.join(process.env.HOME || '/root', partial.slice(1))
      : partial;

    const dir = expanded.endsWith('/') ? expanded : path.dirname(expanded);
    const prefix = expanded.endsWith('/') ? '' : path.basename(expanded);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const matches = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .slice(0, 20)
        .map((e) => {
          const full = path.join(dir, e.name);
          // Re-collapse home dir to ~
          const home = process.env.HOME || '/root';
          const display = full.startsWith(home) ? '~' + full.slice(home.length) : full;
          return { path: full, display: display + '/' };
        });
      res.json(matches);
    } catch {
      res.json([]);
    }
  });

  // Hook endpoint — receives status updates from hook scripts
  app.post('/api/hook', (req, res) => {
    const data = req.body;
    if (!data || !data.id) {
      res.status(400).json({ error: 'Missing instance id' });
      return;
    }
    data.lastUpdated = data.lastUpdated || Date.now();
    instanceManager.handleHookUpdate(data);
    res.json({ ok: true });
  });

  // REST: list instances
  app.get('/api/instances', (_req, res) => {
    res.json(instanceManager.getAll());
  });

  // REST: get single instance
  app.get('/api/instances/:id', (req, res) => {
    const info = instanceManager.get(req.params.id);
    if (!info) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(info);
  });

  // Fallback to index.html for SPA routing (production only)
  if (hasBuiltClient) {
    app.get('*', (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  return app;
}
