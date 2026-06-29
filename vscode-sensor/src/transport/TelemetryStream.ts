import * as vscode from 'vscode';
import { WebSocketClient } from './WebSocketClient';
import type { TelemetryFrame } from '../types';

/**
 * TelemetryStream — Raw nerve firehose.
 *
 * Streams raw KST/ERR/TXT deltas over WebSocket on every keystroke and error
 * change. Also streams code context (file, cursor, surrounding code) and
 * structured diagnostics on a throttled cadence so the agent brain always
 * knows WHAT the developer is looking at.
 */
export class TelemetryStream {
  private lastKeystrokeTime = 0;
  private disposables: vscode.Disposable[] = [];

  // Throttle code context to avoid flooding the WS
  private lastContextSendTime = 0;
  private readonly CONTEXT_THROTTLE_MS = 3000;
  private lastSentFilePath = '';

  constructor(private ws: WebSocketClient) {}

  start(): void {
    // Stream keystroke deltas
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e))
    );

    // Stream error count changes from diagnostics
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics(() => {
        this.emitCurrentState();
        this.emitDiagnostics();
      })
    );

    // Stream code context when the active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.emitCodeContext())
    );

    // Stream code context when cursor moves (throttled)
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => this.emitCodeContext())
    );

    // Keep the active file fresh even while the developer is just reading/idle,
    // so the gremlin can always pull real code to mock.
    const ctxTimer = setInterval(() => this.emitCodeContext(), 5000);
    this.disposables.push({ dispose: () => clearInterval(ctxTimer) });
    this.emitCodeContext(); // send once right away

    console.error('[TelemetryStream] Streaming started (diagnostics + context mode)');
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

    // Also send context on edits (throttled)
    this.emitCodeContext();
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

  // ─── Code Context Emitter (throttled) ───

  private emitCodeContext(): void {
    const now = Date.now();
    if (now - this.lastContextSendTime < this.CONTEXT_THROTTLE_MS) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const doc = editor.document;
    const pos = editor.selection.active;
    const filePath = doc.fileName;

    // Send the whole file when it's small; otherwise a generous window around the
    // cursor. More code = more specific material for the gremlin to mock.
    let surroundingCode: string;
    if (doc.lineCount <= 200) {
      surroundingCode = doc.getText();
    } else {
      const startLine = Math.max(0, pos.line - 30);
      const endLine = Math.min(doc.lineCount - 1, pos.line + 30);
      surroundingCode = doc.getText(
        new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length)
      );
    }
    // Cap payload size
    if (surroundingCode.length > 6000) surroundingCode = surroundingCode.slice(0, 6000);

    this.lastContextSendTime = now;
    this.lastSentFilePath = filePath;

    this.ws.send({
      type: 'code_context',
      filePath,
      language: doc.languageId,
      cursorLine: pos.line,
      surroundingCode,
    });
  }

  // ─── Diagnostics Emitter ───

  private emitDiagnostics(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
      .slice(0, 10)
      .map((d) => ({
        message: d.message,
        line: d.range.start.line,
      }));

    this.ws.send({
      type: 'diagnostics',
      errors,
    });
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
