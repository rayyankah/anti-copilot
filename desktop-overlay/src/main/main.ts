import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import { WebSocketServer } from 'ws';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as http from 'http';
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
const DEBUG_WIDTH = 700;
const DEBUG_HEIGHT = 450;
const BRAIN_PORT = 3000;
const WS_PORT = 9009;
const EXTENSION_ID = 'anti-copilot.anti-copilot-sensor';
const DEBUG_ENABLED = (process.env.ANTI_COPILOT_DEBUG || 'false').toLowerCase() === 'true';

// ─── Window references ───
let splashWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let debugWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;
let brainProcess: ChildProcess | null = null;
let splashAnimationDone = false;
let brainReady = false;
let hasTransitioned = false;

// ─── Agent Runtime ───
const agentRuntime = new AgentRuntime(BRAIN_PORT, log);

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

  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log', { timestamp, source, level, message });
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
// STEP 2: Debug Window
// ═══════════════════════════════════════════
function createDebugWindow(): void {
  if (!DEBUG_ENABLED) return;

  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;

  debugWindow = new BrowserWindow({
    width: DEBUG_WIDTH,
    height: DEBUG_HEIGHT,
    x: screenW - DEBUG_WIDTH - 20,
    y: 20,
    frame: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    title: 'Anti-Copilot Debug',
    webPreferences: {
      preload: path.join(__dirname, 'preload-debug.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    debugWindow.loadURL('http://localhost:5173/debug.html');
  } else {
    debugWindow.loadFile(path.join(__dirname, '../renderer/debug.html'));
  }

  log('launcher', 'info', 'Debug window created (ANTI_COPILOT_DEBUG=true)');
}

// ═══════════════════════════════════════════
// STEP 3: Check & Install Extension
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
// STEP 4: Start Brain Server
// ═══════════════════════════════════════════
function startBrainServer(): void {
  const killPort = (port: number) => {
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
  };

  killPort(BRAIN_PORT);
  killPort(WS_PORT);

  updateSplashStatus('Starting brain server...');

  const brainDir = path.join(projectRoot, 'vercel-brain');
  
  if (!fs.existsSync(path.join(brainDir, 'node_modules'))) {
    log('launcher', 'warn', 'vercel-brain/node_modules missing — brain may fail to start');
  }

  const isWindows = process.platform === 'win32';
  brainProcess = spawn(
    isWindows ? 'npx.cmd' : 'npx',
    ['next', 'dev', '-H', '127.0.0.1', '--port', String(BRAIN_PORT)],
    {
      cwd: brainDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    }
  );

  brainProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.type === 'debug') {
          log(parsed.source || 'brain', 'debug', parsed.message, true);
          return;
        }
      } catch {
        // Not structured
      }
      log('brain', 'info', line.trim());
    });
  });

  brainProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      if (line.includes('Ready') || line.includes('ready') || line.includes('started')) {
        log('brain', 'info', line.trim());
      } else {
        log('brain', 'warn', line.trim());
      }
    });
  });

  brainProcess.on('error', (err) => {
    log('brain', 'error', `Failed to start: ${err.message}`);
    updateSplashStatus('Brain server failed to start', 'error');
  });

  brainProcess.on('exit', (code) => {
    log('brain', 'warn', `Brain server exited with code ${code}`);
    brainProcess = null;
  });

  pollBrainReady();
}

function pollBrainReady(attempts: number = 0): void {
  if (brainReady || hasTransitioned) return;

  if (attempts > 30) {
    log('launcher', 'warn', 'Brain server did not respond in time — continuing anyway');
    updateSplashStatus('Brain timeout — continuing...', 'warn');
    brainReady = true;
    checkTransitionToOverlay();
    return;
  }

  let reqFinished = false;

  const req = http.get(`http://localhost:${BRAIN_PORT}`, (res) => {
    if (reqFinished) return;
    reqFinished = true;
    if (res.statusCode && res.statusCode < 500) {
      log('launcher', 'info', `Brain server ready (status ${res.statusCode})`);
      updateSplashStatus('Brain server ready ✓', 'success');
      brainReady = true;
      checkTransitionToOverlay();
    } else {
      retryPoll(attempts);
    }
  });

  req.on('error', () => {
    if (reqFinished) return;
    reqFinished = true;
    retryPoll(attempts);
  });

  req.setTimeout(2000, () => {
    if (reqFinished) return;
    reqFinished = true;
    req.destroy();
    retryPoll(attempts);
  });
}

function retryPoll(attempts: number): void {
  setTimeout(() => pollBrainReady(attempts + 1), 1000);
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

    // Start the Agent Runtime
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

  // Send initial self-test after load
  overlayWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        log('overlay', 'info', 'Sending agent self-test');
        overlayWindow.webContents.send('trigger', {
          type: 'action',
          action: 'mock',
          content: 'Anti-Copilot Agent Runtime is online. I am watching.',
          avatarEmotion: 'smug',
        });
      }
    }, 2000);
  });

  log('launcher', 'info', 'Overlay window created');
}

// ═══════════════════════════════════════════
// WebSocket Server — Telemetry + Action Bridge
// ═══════════════════════════════════════════
function startWebSocketServer(): void {
  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws) => {
    log('sensor', 'info', 'VS Code sensor connected');

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

        // ─── Legacy action messages (backwards compat) ───
        if (message.type === 'action' || message.action) {
          log('sensor', 'info', `Legacy trigger: ${message.action} — "${(message.content || '').substring(0, 60)}"`);

          if (message.action === 'block_window' && overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.setIgnoreMouseEvents(false);
            setTimeout(() => {
              if (!overlayWindow || overlayWindow.isDestroyed()) return;
              overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            }, 8000);
          }

          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('trigger', message);
          }
        }
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

// ═══════════════════════════════════════════
// App Lifecycle
// ═══════════════════════════════════════════
app.whenReady().then(async () => {
  log('launcher', 'info', '═══════════════════════════════════════');
  log('launcher', 'info', ' ANTI-COPILOT AGENT v0.2.0');
  log('launcher', 'info', `  Debug: ${DEBUG_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  log('launcher', 'info', '═══════════════════════════════════════');

  createSplashWindow();
  createDebugWindow();

  setTimeout(() => {
    checkAndInstallExtension();
    startBrainServer();
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
}
