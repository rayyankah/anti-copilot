import * as vscode from 'vscode';
import { SensorManager } from './sensors/SensorManager';
import { WebSocketClient } from './transport/WebSocketClient';
import { getOrCreateIdentity } from './identity';
import { ThemeController } from './sensors/ThemeController';
import { exec } from 'child_process';
import WebSocket from 'ws';

let sensorManager: SensorManager | null = null;
let wsClient: WebSocketClient | null = null;
let themeController: ThemeController | null = null;

/**
 * Check if the Electron overlay is already running by probing the WebSocket port.
 * Returns true if connected, false otherwise.
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
  vscode.window.showInformationMessage('💀 Anti-Copilot: Launching overlay...');

  // Spawn the Electron app in detached mode so it outlives VS Code if needed
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

  wsClient = new WebSocketClient('ws://localhost:9009');
  themeController = new ThemeController();
  sensorManager = new SensorManager(wsClient, themeController, identity);

  // Register commands
  const activateCmd = vscode.commands.registerCommand('antiCopilot.activate', () => {
    sensorManager?.start();
    vscode.window.showInformationMessage(`💀 Anti-Copilot is now watching you, ${identity.username}.`);
  });

  const deactivateCmd = vscode.commands.registerCommand('antiCopilot.deactivate', () => {
    sensorManager?.stop();
    vscode.window.showInformationMessage('Anti-Copilot sensor deactivated.');
  });

  context.subscriptions.push(activateCmd, deactivateCmd);

  // Auto-start sensors
  sensorManager.start();

  // Attempt auto-launch of the Electron overlay app
  tryAutoLaunch();
}

export function deactivate(): void {
  sensorManager?.stop();
  wsClient?.disconnect();
}
