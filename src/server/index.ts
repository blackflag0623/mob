import http from 'http';
import { createApp } from './express-app.js';
import { createWsServer } from './ws-server.js';
import { InstanceManager } from './instance-manager.js';
import { PtyManager } from './pty-manager.js';
import { DiscoveryService } from './discovery.js';
import { ensureDir, getMobDir, getInstancesDir } from './util/platform.js';
import { DEFAULT_PORT } from '../shared/constants.js';

const port = parseInt(process.env.MOB_PORT || '', 10) || DEFAULT_PORT;

// Ensure directories exist
ensureDir(getMobDir());
ensureDir(getInstancesDir());

const ptyManager = new PtyManager();
const discovery = new DiscoveryService();
const instanceManager = new InstanceManager(ptyManager, discovery);

const app = createApp(instanceManager);
const server = http.createServer(app);
createWsServer(server, instanceManager, ptyManager);

discovery.start();
instanceManager.startStaleCheck();

server.listen(port, '0.0.0.0', () => {
  console.log(`Mob dashboard running at http://localhost:${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}/mob-ws`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  instanceManager.stop();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  instanceManager.stop();
  server.close();
  process.exit(0);
});
