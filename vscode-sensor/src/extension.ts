import * as vscode from 'vscode';
import { SensorManager } from './sensors/SensorManager';
import { WebSocketClient } from './transport/WebSocketClient';
import { getOrCreateIdentity } from './identity';
import { ThemeController } from './sensors/ThemeController';

let sensorManager: SensorManager | null = null;
let wsClient: WebSocketClient | null = null;
let themeController: ThemeController | null = null;

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

  // Auto-start
  sensorManager.start();
}

export function deactivate(): void {
  sensorManager?.stop();
  wsClient?.disconnect();
}
