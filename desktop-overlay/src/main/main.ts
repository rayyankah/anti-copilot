import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { WebSocketServer } from 'ws';

let mainWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;

const OVERLAY_WIDTH = 420;
const OVERLAY_HEIGHT = 350;

function createWindow(): void {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: screenW - OVERLAY_WIDTH - 20,
    y: screenH - OVERLAY_HEIGHT - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Make window click-through by default
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Send a self-test trigger after 3 seconds to prove the overlay works
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      if (mainWindow) {
        console.log('[Anti-Copilot] Sending self-test trigger to renderer...');
        mainWindow.webContents.send('trigger', {
          type: 'action',
          action: 'mock',
          content: '💀 Anti-Copilot is online and watching you code.',
        });
      }
    }, 3000);
  });
}

function startWebSocketServer(): void {
  wss = new WebSocketServer({ port: 9009 });

  wss.on('connection', (ws) => {
    console.log('[Anti-Copilot] VS Code sensor connected');

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('[Anti-Copilot] Trigger received:', message);

      // For block_window, resize to fullscreen
      if (message.action === 'block_window' && mainWindow) {
        const display = screen.getPrimaryDisplay();
        mainWindow.setPosition(0, 0);
        mainWindow.setSize(display.workAreaSize.width, display.workAreaSize.height);
        mainWindow.setIgnoreMouseEvents(false);
        // Restore after 8 seconds
        setTimeout(() => {
          if (!mainWindow) return;
          const { width: screenW, height: screenH } = display.workAreaSize;
          mainWindow.setSize(OVERLAY_WIDTH, OVERLAY_HEIGHT);
          mainWindow.setPosition(screenW - OVERLAY_WIDTH - 20, screenH - OVERLAY_HEIGHT - 20);
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        }, 8000);
      }

      // Forward trigger to renderer
      if (mainWindow) {
        mainWindow.webContents.send('trigger', message);
      }
    });

    ws.on('close', () => {
      console.log('[Anti-Copilot] VS Code sensor disconnected');
    });
  });

  console.log('[Anti-Copilot] WebSocket server listening on ws://localhost:9009');
}

// IPC handlers
ipcMain.on('set-click-through', (_event, enabled: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
});

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
});

app.on('window-all-closed', () => {
  wss?.close();
  if (process.platform !== 'darwin') app.quit();
});
