import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { WebSocketServer } from 'ws';

let mainWindow: BrowserWindow | null = null;
let wss: WebSocketServer | null = null;

const OVERLAY_WIDTH = 400;
const OVERLAY_HEIGHT = 300;
const CURSOR_OFFSET = 50;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, load from Vite dev server; in prod, load built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Make window click-through by default
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Track cursor position
  setInterval(() => {
    if (!mainWindow) return;
    const cursorPoint = screen.getCursorScreenPoint();
    mainWindow.setPosition(
      cursorPoint.x + CURSOR_OFFSET,
      cursorPoint.y + CURSOR_OFFSET
    );
  }, 100);
}

function startWebSocketServer(): void {
  wss = new WebSocketServer({ port: 9001 });

  wss.on('connection', (ws) => {
    console.log('[Anti-Copilot] VS Code sensor connected');

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('[Anti-Copilot] Trigger received:', message);

      // Forward trigger to renderer
      if (mainWindow) {
        mainWindow.webContents.send('trigger', message);
      }
    });

    ws.on('close', () => {
      console.log('[Anti-Copilot] VS Code sensor disconnected');
    });
  });

  console.log('[Anti-Copilot] WebSocket server listening on ws://localhost:9001');
}

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();
});

app.on('window-all-closed', () => {
  wss?.close();
  if (process.platform !== 'darwin') app.quit();
});
