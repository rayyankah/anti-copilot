import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import { WebSocketServer } from 'ws';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import { AgentRuntime } from './agent/AgentRuntime';
import { TelemetryFrame } from '../shared/types';

// ─── Load .env from project root ───
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('[Launcher] Loaded .env from', envPath);
} else {
  console.warn('[Launcher] No .env found at', envPath);
}

// ─── Configuration ───
const SPLASH_WIDTH = 500;
const SPLASH_HEIGHT = 320;
const BRAIN_PORT = 3000;
const WS_PORT = 9009;
const EXTENSION_ID = 'anti-copilot.anti-copilot-sensor';

// The Gremlin brain is hosted on Vercel. Override with ANTI_COPILOT_BRAIN_URL
// (or run a local brain with ANTI_COPILOT_LOCAL_BRAIN=1, see BrainClient).
const BACKEND_URL = (process.env.ANTI_COPILOT_BRAIN_URL || 'https://vercel-brain-zeta.vercel.app').replace(/\/$/, '');

// Gremlin-flavored lines shown on the splash while we wait for the backend.
const CONNECTING_MESSAGES = [
  'Waking the gremlin...',
  'Bribing the cloud...',
  'Sharpening fresh insults...',
  'Negotiating with the backend...',
  'Loading your worst habits...',
  'Reading your code (and judging it)...',
  'Almost ready to ruin your day...',
];

// ─── Window references ───
let splashWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;
let brainProcess: ChildProcess | null = null;
let splashAnimationDone = false;
let brainReady = false;
let hasTransitioned = false;

// ─── Agent Runtime ───
const agentRuntime = new AgentRuntime(BRAIN_PORT, log);

// ─── Stable per-machine identity (persisted so the gremlin remembers you) ───
function loadOrCreateIdentity(): { userId: string; username: string } {
  const username = os.userInfo().username || 'developer';
  const idPath = path.join(app.getPath('userData'), 'identity.json');
  try {
    if (fs.existsSync(idPath)) {
      const data = JSON.parse(fs.readFileSync(idPath, 'utf-8'));
      if (data?.userId) return { userId: data.userId, username: data.username || username };
    }
  } catch {
    // Corrupt/missing — regenerate below
  }
  const userId = `${os.hostname()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    fs.writeFileSync(idPath, JSON.stringify({ userId, username }));
  } catch {
    // Non-fatal — identity just won't persist
  }
  return { userId, username };
}

// ─── Centralized Logger ───
function log(source: string, level: string, message: string, skipTerminal = false): void {
  const timestamp = Date.now();
  const prefix = `[${source.toUpperCase()}]`;
  
  if (!skipTerminal) {
    if (level === 'error') {
      console.error(prefix, message);
    } else if (level === 'warn') {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

function updateSplashStatus(message: string, level: string = 'info'): void {
  log('launcher', level, message);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-status', { message, level });
  }
}

// ═══════════════════════════════════════════
// STEP 1: Splash Screen
// ═══════════════════════════════════════════
function createSplashWindow(): void {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  splashWindow = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    x: Math.round((screenW - SPLASH_WIDTH) / 2),
    y: Math.round((screenH - SPLASH_HEIGHT) / 2),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-splash.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    splashWindow.loadURL('http://localhost:5173/splash.html');
  } else {
    splashWindow.loadFile(path.join(__dirname, '../renderer/splash.html'));
  }

  log('launcher', 'info', 'Splash window created');
}

// ═══════════════════════════════════════════
// STEP 2: Check & Install Extension
// ═══════════════════════════════════════════
function checkAndInstallExtension(): void {
  updateSplashStatus('Checking VS Code extension...');
  
  try {
    const result = execSync('code --list-extensions', { encoding: 'utf-8', timeout: 10000 });
    if (result.includes(EXTENSION_ID)) {
      log('launcher', 'info', 'Extension found ✓');
      updateSplashStatus('VS Code extension is already installed');
      return;
    }
  } catch {
    log('launcher', 'warn', 'Could not list extensions, attempting install');
  }

  const vsixDir = path.join(projectRoot, 'vscode-sensor');
  const vsixFiles = fs.existsSync(vsixDir) 
    ? fs.readdirSync(vsixDir).filter(f => f.endsWith('.vsix'))
    : [];

  if (vsixFiles.length > 0) {
    const vsixPath = path.join(vsixDir, vsixFiles[0]);
    try {
      execSync(`code --install-extension "${vsixPath}" --force`, { timeout: 30000 });
      updateSplashStatus('Extension installed ✓', 'success');
    } catch (installErr) {
      log('launcher', 'warn', `Extension install failed: ${installErr}`);
      updateSplashStatus('Extension install failed', 'warn');
    }
  } else {
    updateSplashStatus('No .vsix found — skipping install', 'warn');
  }
}

// ═══════════════════════════════════════════
// STEP 4: Connect to the hosted Gremlin brain
// ═══════════════════════════════════════════
let connectMsgTimer: NodeJS.Timeout | null = null;

function cycleConnectingMessages(): void {
  let i = 0;
  updateSplashStatus(CONNECTING_MESSAGES[0]);
  connectMsgTimer = setInterval(() => {
    i = (i + 1) % CONNECTING_MESSAGES.length;
    if (!brainReady) updateSplashStatus(CONNECTING_MESSAGES[i]);
  }, 1400);
}

function stopConnectingMessages(): void {
  if (connectMsgTimer) {
    clearInterval(connectMsgTimer);
    connectMsgTimer = null;
  }
}

function connectToBackend(attempts: number = 0): void {
  if (brainReady || hasTransitioned) return;
  if (attempts === 0) cycleConnectingMessages();

  // Give up gracefully after ~30s — boot anyway, the runtime keeps retrying.
  if (attempts > 20) {
    stopConnectingMessages();
    log('launcher', 'warn', 'Backend did not respond in time — booting offline; the gremlin will keep trying.');
    updateSplashStatus('Backend slow — booting anyway...', 'warn');
    brainReady = true;
    checkTransitionToOverlay();
    return;
  }

  const transport = BACKEND_URL.startsWith('https') ? https : http;
  let reqFinished = false;

  const req = transport.get(`${BACKEND_URL}/api/commentator`, (res) => {
    if (reqFinished) return;
    reqFinished = true;
    res.resume();
    if (res.statusCode && res.statusCode < 500) {
      stopConnectingMessages();
      log('launcher', 'info', `Backend reachable (status ${res.statusCode}) at ${BACKEND_URL}`);
      updateSplashStatus('Gremlin connected ✓', 'success');
      brainReady = true;
      checkTransitionToOverlay();
    } else {
      retryConnect(attempts);
    }
  });

  req.on('error', () => {
    if (reqFinished) return;
    reqFinished = true;
    retryConnect(attempts);
  });

  req.setTimeout(2500, () => {
    if (reqFinished) return;
    reqFinished = true;
    req.destroy();
    retryConnect(attempts);
  });
}

function retryConnect(attempts: number): void {
  setTimeout(() => connectToBackend(attempts + 1), 1000);
}

function killPort(port: number) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8', timeout: 5000 });
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) {
          log('launcher', 'info', `Killing orphaned process on port ${port} (PID: ${pid})`);
          execSync(`taskkill /pid ${pid} /F`, { stdio: 'ignore', timeout: 5000 });
        }
      }
    }
  } catch {
    // Ignore
  }
}

// ═══════════════════════════════════════════
// STEP 5: Transition to Overlay
// ═══════════════════════════════════════════
function checkTransitionToOverlay(): void {
  if (!splashAnimationDone || !brainReady || hasTransitioned) return;
  hasTransitioned = true;

  updateSplashStatus('Ready.', 'success');

  setTimeout(() => {
    createOverlayWindow();
    startWebSocketServer();

    // Identify the developer (stable across sessions) so the gremlin can load
    // and persist its relationship with them, then start the runtime.
    const identity = loadOrCreateIdentity();
    agentRuntime.setIdentity(identity.userId, identity.username);
    log('launcher', 'info', `Developer identity: ${identity.username} (${identity.userId})`);
    agentRuntime.start();

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    log('launcher', 'info', '🔥 Anti-Copilot is online — Agent Runtime active');

    // Auto-open VS Code
    try {
      log('launcher', 'info', 'Opening VS Code automatically...');
      const child = spawn('code', [projectRoot], {
        detached: true,
        stdio: 'ignore',
        shell: true
      });
      child.unref();
    } catch (err) {
      log('launcher', 'warn', `Failed to auto-open VS Code: ${err}`);
    }
  }, 800);
}

// ═══════════════════════════════════════════
// STEP 6: Create Overlay Window
// ═══════════════════════════════════════════
function createOverlayWindow(): void {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: screenW,
    height: screenH,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  // Cursor tracking
  setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      try {
        const point = screen.getCursorScreenPoint();
        agentRuntime.overlayBridge.sendCursorUpdate(point);
      } catch {
        // Ignore
      }
    }
  }, 16);

  // Connect overlay to agent runtime
  agentRuntime.overlayBridge.setWindow(overlayWindow);
  // No static greeting — the gremlin's opening line is generated by the brain
  // via the intro sequence in AgentRuntime.

  log('launcher', 'info', 'Overlay window created');
}

// ═══════════════════════════════════════════
// WebSocket Server — Telemetry + Action Bridge
// ═══════════════════════════════════════════
function startWebSocketServer(): void {
  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws) => {
    log('sensor', 'info', 'VS Code sensor connected');

    // Wire a channel so the agent can push theme/font attacks into VS Code
    agentRuntime.setSensorSender((msg) => {
      try {
        if (ws.readyState === 1) ws.send(JSON.stringify(msg));
      } catch {
        // sensor went away
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // ─── Telemetry frames → feed into Agent Runtime ───
        if (message.type === 'telemetry') {
          agentRuntime.ingestTelemetry(message as TelemetryFrame);
          return;
        }

        // ─── Code context updates ───
        if (message.type === 'code_context') {
          agentRuntime.updateCodeContext(message);
          return;
        }

        // ─── Diagnostics updates ───
        if (message.type === 'diagnostics') {
          agentRuntime.updateDiagnostics(message);
          return;
        }

        // ─── Debug messages ───
        if (message.type === 'debug') {
          log(message.source || 'sensor', 'debug', message.message, true);
          return;
        }

        // Legacy action messages from the sensor are no longer accepted.
        // The agent brain (AgentRuntime) is the ONLY source of actions.
        // Any { type: 'action' } messages from the sensor are silently ignored.
      } catch (parseErr) {
        log('sensor', 'error', `Failed to parse message: ${parseErr}`);
      }
    });

    ws.on('close', () => {
      log('sensor', 'info', 'VS Code sensor disconnected');
    });
  });

  log('launcher', 'info', `WebSocket server listening on ws://localhost:${WS_PORT}`);
}

// ═══════════════════════════════════════════
// IPC Handlers
// ═══════════════════════════════════════════
ipcMain.on('set-click-through', (_event, enabled: boolean) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
});

ipcMain.on('splash-ready', () => {
  log('launcher', 'info', 'Splash animation complete');
  splashAnimationDone = true;
  checkTransitionToOverlay();
});

// Fight-back: user clicked a reaction button on an attack
ipcMain.on('user-reaction', (_event, reaction: string) => {
  const valid = ['shut_up', 'youre_right', 'apologize', 'destroy'];
  if (valid.includes(reaction)) {
    agentRuntime.handleUserReaction(reaction as never);
  }
});

ipcMain.on('quit-app', () => {
  log('launcher', 'info', 'Quit requested from overlay');
  cleanup();
  app.quit();
});

// ═══════════════════════════════════════════
// App Lifecycle
// ═══════════════════════════════════════════
app.whenReady().then(async () => {
  log('launcher', 'info', '═══════════════════════════════════════');
  log('launcher', 'info', ' GREMLIN (ANTI-COPILOT) v0.2.0');
  log('launcher', 'info', ` Brain: ${BACKEND_URL}`);
  log('launcher', 'info', '═══════════════════════════════════════');

  createSplashWindow();

  setTimeout(() => {
    killPort(WS_PORT); // clear any stale overlay socket
    checkAndInstallExtension();
    connectToBackend();
  }, 500);
});

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanup();
});

process.on('SIGINT', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  if (process.platform !== 'darwin') app.quit();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

function cleanup(): void {
  // Stop agent runtime
  agentRuntime.stop();

  // Kill brain server
  if (brainProcess && !brainProcess.killed) {
    log('launcher', 'info', 'Killing brain server...');
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${brainProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        brainProcess.kill('SIGTERM');
      }
    } else {
      brainProcess.kill('SIGTERM');
    }
    brainProcess = null;
  }

  if (wss) {
    wss.close();
    wss = null;
  }

  // Fallback: kill anything listening on the ports we manage
  killPort(BRAIN_PORT);
  killPort(WS_PORT);
}
