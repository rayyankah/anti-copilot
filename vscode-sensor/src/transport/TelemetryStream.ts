import * as vscode from 'vscode';
import { WebSocketClient } from './WebSocketClient';
import type { TelemetryFrame } from '../types';

/**
 * TelemetryStream — Raw nerve firehose.
 *
 * Streams raw KST/ERR/TXT deltas over WebSocket on every keystroke and error
 * change. Errors are read from the active editor's diagnostics (the squiggly
 * underlines / Problems panel). Zero analysis. Zero decisions.
 */
export class TelemetryStream {
  private lastKeystrokeTime = 0;
  private disposables: vscode.Disposable[] = [];

  constructor(private ws: WebSocketClient) {}

  start(): void {
    // Stream keystroke deltas
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e))
    );

    // Stream error count changes from diagnostics
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics(() => this.emitCurrentState())
    );

    console.error('[TelemetryStream] Streaming started (diagnostics mode)');
  }

  stop(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();
    const kst = this.lastKeystrokeTime > 0 ? now - this.lastKeystrokeTime : 0;
    this.lastKeystrokeTime = now;

    let txtDelta = 0;
    for (const change of event.contentChanges) {
      txtDelta += change.text.length - change.rangeLength;
    }

    this.emitFrame(kst, txtDelta);
  }

  private emitCurrentState(): void {
    const now = Date.now();
    const kst = this.lastKeystrokeTime > 0 ? now - this.lastKeystrokeTime : 0;
    this.emitFrame(kst, 0);
  }

  private emitFrame(kst: number, txt: number): void {
    const frame: TelemetryFrame = {
      type: 'telemetry',
      kst,
      err: this.getCurrentErrors(),
      txt,
      timestamp: Date.now(),
    };
    this.ws.send(frame as unknown as Record<string, unknown>);
  }

  private getCurrentErrors(): { count: number; messages: string[] } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { count: 0, messages: [] };

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
    return {
      count: errors.length,
      messages: errors.slice(0, 5).map((e) => e.message),
    };
  }
}
