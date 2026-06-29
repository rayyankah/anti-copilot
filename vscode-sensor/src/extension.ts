import * as vscode from 'vscode';
import { SensorManager } from './sensors/SensorManager';
import { WebSocketClient } from './transport/WebSocketClient';
import { TelemetryStream } from './transport/TelemetryStream';
import { getOrCreateIdentity } from './identity';
import { ThemeController } from './sensors/ThemeController';
import { FontController } from './sensors/FontController';
import { CursorController } from './sensors/CursorController';
import { exec } from 'child_process';
import WebSocket from 'ws';

let sensorManager: SensorManager | null = null;
let wsClient: WebSocketClient | null = null;
let themeController: ThemeController | null = null;
let fontController: FontController | null = null;
let cursorController: CursorController | null = null;
let telemetryStream: TelemetryStream | null = null;

/**
 * Check if the Electron overlay is already running by probing the WebSocket port.
 */
function isOverlayRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const testWs = new WebSocket('ws://localhost:9009');
    const timeout = setTimeout(() => {
      testWs.close();
      resolve(false);
    }, 2000);

    testWs.on('open', () => {
      clearTimeout(timeout);
      testWs.close();
      resolve(true);
    });

    testWs.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

/**
 * Attempt to auto-launch the Anti-Copilot Electron app.
 */
async function tryAutoLaunch(): Promise<void> {
  const config = vscode.workspace.getConfiguration('antiCopilot');
  const projectPath = config.get<string>('projectPath');

  if (!projectPath) {
    console.log('[Anti-Copilot Sensor] No projectPath configured — skipping auto-launch');
    return;
  }

  const isRunning = await isOverlayRunning();
  if (isRunning) {
    console.log('[Anti-Copilot Sensor] Overlay already running');
    return;
  }

  console.log('[Anti-Copilot Sensor] Overlay not detected — auto-launching from:', projectPath);
  vscode.window.showInformationMessage('🤖 Anti-Copilot: Launching overlay...');

  const isWindows = process.platform === 'win32';
  const cmd = isWindows
    ? `cd /d "${projectPath}" && npm start`
    : `cd "${projectPath}" && npm start`;

  exec(cmd, { windowsHide: true }, (err) => {
    if (err) {
      console.error('[Anti-Copilot Sensor] Auto-launch failed:', err.message);
    }
  });
}

export function activate(context: vscode.ExtensionContext): void {
  console.log('[Anti-Copilot Sensor] Activating...');

  const identity = getOrCreateIdentity(context);
  console.log(`[Anti-Copilot Sensor] Developer Identity: ${identity.username} (${identity.uuid})`);

  // WebSocket for telemetry firehose + action forwarding
  wsClient = new WebSocketClient('ws://localhost:9009');
  themeController = new ThemeController();
  fontController = new FontController();
  cursorController = new CursorController();
  sensorManager = new SensorManager(wsClient, themeController, fontController, cursorController, identity);

  // ─── Incoming action router ───
  // The agent brain sends attacks back to VS Code through the same WebSocket.
  // This is the ONLY way physical IDE attacks execute.
  wsClient.onMessage((msg) => {
    if (msg.type !== 'action' || !msg.action) return;
    console.log(`[Anti-Copilot Sensor] Executing attack: ${msg.action}`);
    switch (msg.action) {
      case 'theme_sabotage':
        sensorManager?.sabotageTheme();
        break;
      case 'font_attack':
        sensorManager?.invisibleFontPrank();
        break;
      case 'cursor_attack':
        sensorManager?.cursorAttack();
        break;
      case 'flash_theme_strobe':
        sensorManager?.flashStrobe();
        break;
      case 'force_light_mode':
      case 'flash_light_mode':
        sensorManager?.forceLightMode();
        break;
      default:
        console.log(`[Anti-Copilot Sensor] Unknown action: ${msg.action}`);
    }
  });

  // Start raw telemetry stream
  telemetryStream = new TelemetryStream(wsClient);
  telemetryStream.start();

  // Register commands
  const activateCmd = vscode.commands.registerCommand('antiCopilot.activate', () => {
    sensorManager?.start();
    telemetryStream?.start();
    vscode.window.showInformationMessage(`🤖 Anti-Copilot is now watching you, ${identity.username}.`);
  });

  const deactivateCmd = vscode.commands.registerCommand('antiCopilot.deactivate', () => {
    sensorManager?.stop();
    telemetryStream?.stop();
    vscode.window.showInformationMessage('Anti-Copilot sensor deactivated.');
  });

  context.subscriptions.push(activateCmd, deactivateCmd);

  // Auto-start
  sensorManager.start();

  // Attempt auto-launch of the Electron overlay app
  tryAutoLaunch();
}

export function deactivate(): void {
  sensorManager?.stop();
  telemetryStream?.stop();
  wsClient?.disconnect();
}
