'use strict';

// Lightweight process supervisor: restart the API after an unexpected exit.
// For production deployments, a service manager (PM2/systemd/Windows Service)
// is still preferred because it also starts the process after machine reboot.
const { spawn } = require('node:child_process');

let child;
let stopping = false;
let restartDelay = 1000;
let restartTimer;

function start() {
  if (stopping) return;
  child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    if (code === 0) {
      console.log('[supervisor] API exited normally; not restarting.');
      return;
    }
    console.error(`[supervisor] API stopped (code=${code}, signal=${signal || 'none'}). Restarting in ${restartDelay / 1000}s...`);
    restartTimer = setTimeout(start, restartDelay);
    restartDelay = Math.min(restartDelay * 2, 30000);
  });
  child.once('spawn', () => { restartDelay = 1000; });
}
function shutdown(signal) {
  stopping = true;
  clearTimeout(restartTimer);
  if (child && !child.killed) child.kill(signal);
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
start();
