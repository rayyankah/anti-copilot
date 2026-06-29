import * as vscode from 'vscode';
import { WebSocketClient } from './WebSocketClient';
import type { TelemetryFrame } from '../types';

/**
 * TelemetryStream — Raw nerve firehose.
 * 
 * Streams raw KST/ERR/TXT deltas over WebSocket on every keystroke,
 * error change, and paste event. Zero analysis. Zero decisions.
 */
export class TelemetryStream {
  private lastKeystrokeTime = 0;
  private lastLineLength = 0;
  private disposables: vscode.Disposable[] = [];

  constructor(private ws: WebSocketClient) {}

  start(): void {
    // Stream keystroke deltas
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e))
    );

    // Stream error count changes
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics(() => this.emitCurrentState())
    );

    console.error('[TelemetryStream] Streaming started');
  }

  stop(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();
    const kst = this.lastKeystrokeTime > 0 ? now - this.lastKeystrokeTime : 0;
    this.lastKeystrokeTime = now;

    // Calculate text delta (how many chars changed)
    let txtDelta = 0;
    for (const change of event.contentChanges) {
      txtDelta += change.text.length - change.rangeLength;
    }

    // Get current error state
    const err = this.getCurrentErrors();

    const frame: TelemetryFrame = {
      type: 'telemetry',
      kst,
      err,
      txt: txtDelta,
      timestamp: now,
    };

    this.ws.send(frame as unknown as Record<string, unknown>);
  }

  private emitCurrentState(): void {
    const now = Date.now();
    const kst = this.lastKeystrokeTime > 0 ? now - this.lastKeystrokeTime : 0;
    const err = this.getCurrentErrors();

    const frame: TelemetryFrame = {
      type: 'telemetry',
      kst,
      err,
      txt: 0,
      timestamp: now,
    };

    this.ws.send(frame as unknown as Record<string, unknown>);
  }

  private getCurrentErrors(): { count: number; messages: string[] } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { count: 0, messages: [] };

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
    return {
      count: errors.length,
      messages: errors.slice(0, 5).map(e => e.message),
    };
  }
}
