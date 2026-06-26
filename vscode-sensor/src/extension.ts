import * as vscode from 'vscode';
import { SensorManager } from './sensors/SensorManager';
import { WebSocketClient } from './transport/WebSocketClient';

let sensorManager: SensorManager | null = null;
let wsClient: WebSocketClient | null = null;

export function activate(context: vscode.ExtensionContext): void {
  console.log('[Anti-Copilot Sensor] Activating...');

  wsClient = new WebSocketClient('ws://localhost:9001');
  sensorManager = new SensorManager(wsClient);

  // Register commands
  const activateCmd = vscode.commands.registerCommand('antiCopilot.activate', () => {
    sensorManager?.start();
    vscode.window.showInformationMessage('💀 Anti-Copilot is now watching you.');
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
