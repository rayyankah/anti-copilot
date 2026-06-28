import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { execSync, spawn, ChildProcess } from 'child_process';
import { WebSocketServer } from 'ws';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as http from 'http';

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
const OVERLAY_WIDTH = 420;
const OVERLAY_HEIGHT = 350;
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

  // Forward to debug window if it exists
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log', { timestamp, source, level, message });
  }
}

// ─── Update splash status ───
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
// STEP 2: Debug Log Window (conditional)
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
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: false,
    title: 'Anti-Copilot Debug Monitor',
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

  debugWindow.on('closed', () => {
    debugWindow = null;
  });

  log('launcher', 'info', `Debug window created (ANTI_COPILOT_DEBUG=${DEBUG_ENABLED})`);
}

// ═══════════════════════════════════════════
// STEP 3: Check & Install VS Code Extension
// ═══════════════════════════════════════════
function checkAndInstallExtension(): boolean {
  updateSplashStatus('Checking VS Code extension...');
  
  try {
    const output = execSync('code --list-extensions', { encoding: 'utf-8', timeout: 10000 });
    const extensions = output.split('\n').map(e => e.trim().toLowerCase());
    
    if (extensions.includes(EXTENSION_ID.toLowerCase())) {
      updateSplashStatus('Extension found ✓', 'success');
      log('launcher', 'info', 'VS Code extension is already installed');
      return true;
    }

    // Extension not installed — try to install from local .vsix
    updateSplashStatus('Installing VS Code extension...');
    const vsixPath = path.join(projectRoot, 'vscode-sensor', `${EXTENSION_ID}.vsix`);
    
    if (fs.existsSync(vsixPath)) {
      execSync(`code --install-extension "${vsixPath}"`, { encoding: 'utf-8', timeout: 30000 });
      updateSplashStatus('Extension installed ✓', 'success');
      log('launcher', 'info', 'VS Code extension installed from .vsix');
      return true;
    }

    // No .vsix found — try to build and install from source
    updateSplashStatus('Building extension from source...');
    const sensorDir = path.join(projectRoot, 'vscode-sensor');
    
    try {
      execSync('npx tsc -p ./', { cwd: sensorDir, encoding: 'utf-8', timeout: 30000 });
      
      // Check if vsce is available to package
      try {
        execSync('npx vsce package --no-dependencies', { cwd: sensorDir, encoding: 'utf-8', timeout: 30000 });
        // Find the generated .vsix
        const files = fs.readdirSync(sensorDir);
        const vsixFile = files.find(f => f.endsWith('.vsix'));
        if (vsixFile) {
          const generatedVsix = path.join(sensorDir, vsixFile);
          execSync(`code --install-extension "${generatedVsix}"`, { encoding: 'utf-8', timeout: 30000 });
          updateSplashStatus('Extension built & installed ✓', 'success');
          log('launcher', 'info', 'VS Code extension built and installed from source');
          return true;
        }
      } catch {
        log('launcher', 'warn', 'vsce package failed — extension compiled but not packaged as .vsix');
      }
    } catch (buildErr) {
      log('launcher', 'warn', `Extension build failed: ${buildErr}`);
    }

    updateSplashStatus('Extension not installed (manual install needed)', 'warn');
    return false;
  } catch (err) {
    log('launcher', 'warn', `Could not check extensions (VS Code CLI not found?): ${err}`);
    updateSplashStatus('Extension check skipped', 'warn');
    return false;
  }
}

// ═══════════════════════════════════════════
// STEP 4: Start Brain Server (Next.js)
// ═══════════════════════════════════════════
function startBrainServer(): void {
  updateSplashStatus('Checking for orphaned processes...');

  const killPort = (port: number) => {
    try {
      if (process.platform === 'win32') {
        const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
              log('launcher', 'info', `Killing orphaned process on port ${port} (PID: ${pid})`);
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            }
          }
        }
      } else {
        execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
      }
    } catch (e) {
      // Ignore
    }
  };

  // Kill any existing process on ports
  killPort(BRAIN_PORT);
  killPort(WS_PORT);

  updateSplashStatus('Starting brain server...');

  const brainDir = path.join(projectRoot, 'vercel-brain');
  
  // Check if vercel-brain has node_modules
  if (!fs.existsSync(path.join(brainDir, 'node_modules'))) {
    log('launcher', 'warn', 'vercel-brain/node_modules missing — brain may fail to start');
  }

  // Spawn Next.js dev server with env vars forwarded
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
          log(parsed.source || 'brain', 'debug', parsed.message, true); // skip terminal
          return;
        }
      } catch (e) {
        // Not a structured debug log
      }
      log('brain', 'info', line.trim());
    });
  });

  brainProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      // Next.js prints some info to stderr (like "ready" messages)
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

  // Poll until brain is ready
  pollBrainReady();
}

function pollBrainReady(attempts: number = 0): void {
  if (brainReady || hasTransitioned) return;

  if (attempts > 30) { // 30 * 1s = 30 second timeout
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

  // Small delay for the "Ready" message to be visible
  setTimeout(() => {
    createOverlayWindow();
    startWebSocketServer();

    // Close splash
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    log('launcher', 'info', '🔥 Anti-Copilot is online');

    // Auto-open VS Code if not open
    try {
      log('launcher', 'info', 'Opening VS Code automatically...');
      // Launch detached so it doesn't block, use shell: true for Windows .cmd
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

  // Make window click-through by default
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Cursor following logic
  setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const point = screen.getCursorScreenPoint();
      overlayWindow.webContents.send('cursor-update', point);
    }
  }, 16); // ~60fps cursor tracking

  // Send a self-test trigger after 2 seconds
  overlayWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        log('overlay', 'info', 'Sending self-test trigger');
        overlayWindow.webContents.send('trigger', {
          type: 'action',
          action: 'mock',
          content: 'Anti-Copilot is online and watching you code.',
        });
      }
    }, 2000);
  });

  log('launcher', 'info', 'Overlay window created');
}

// ═══════════════════════════════════════════
// WebSocket Server (for VS Code extension)
// ═══════════════════════════════════════════
function startWebSocketServer(): void {
  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws) => {
    log('sensor', 'info', 'VS Code sensor connected');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'debug') {
          log(message.source || 'sensor', 'debug', message.message, true); // skip terminal
          return;
        }

        log('sensor', 'info', `Trigger: ${message.action} — "${(message.content || '').substring(0, 60)}"`);

        // For block_window, make the window interactable
        if (message.action === 'block_window' && overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.setIgnoreMouseEvents(false);
          setTimeout(() => {
            if (!overlayWindow || overlayWindow.isDestroyed()) return;
            overlayWindow.setIgnoreMouseEvents(true, { forward: true });
          }, 8000);
        }

        // Forward trigger to overlay renderer
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('trigger', message);
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
  log('launcher', 'info', ' ANTI-COPILOT LAUNCHER v0.1.0');
  log('launcher', 'info', `  Debug: ${DEBUG_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  log('launcher', 'info', '═══════════════════════════════════════');

  // Step 1: Show splash
  createSplashWindow();

  // Step 2: Debug window (if enabled)
  createDebugWindow();

  // Step 3: Check/install extension (runs sync, fast)
  // Small delay to let splash render first
  setTimeout(() => {
    checkAndInstallExtension();

    // Step 4: Start brain server (async)
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
  // Kill brain server
  if (brainProcess && !brainProcess.killed) {
    log('launcher', 'info', 'Killing brain server...');
    if (process.platform === 'win32') {
      // On Windows, spawn a taskkill to ensure the whole process tree dies
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

  // Close WebSocket server
  if (wss) {
    wss.close();
    wss = null;
  }
}
