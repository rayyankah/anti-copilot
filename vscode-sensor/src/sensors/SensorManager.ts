import * as vscode from 'vscode';
import { WebSocketClient } from '../transport/WebSocketClient';
import { TriggerType } from '../types';

export class SensorManager {
  private disposables: vscode.Disposable[] = [];
  private isRunning = false;
  private lastTypingTime = 0;
  private characterCount = 0;
  private pauseTimer: NodeJS.Timeout | null = null;
  private terminalErrors: string[] = [];
  private readonly PAUSE_THRESHOLD_MS = 5000;
  private readonly LARGE_PASTE_THRESHOLD = 50;

  constructor(private wsClient: WebSocketClient) {}

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Monitor text document changes (typing, pasting)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e))
    );

    // Monitor active editor changes (blank file detection)
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((e) => this.onEditorChange(e))
    );

    // Monitor diagnostics (red squiggly lines)
    this.disposables.push(
      vscode.languages.onDidChangeDiagnostics((e) => this.onDiagnosticsChange(e))
    );

    // Monitor terminal output
    this.disposables.push(
      vscode.window.onDidWriteTerminalData?.((e) => this.onTerminalData(e)) 
      ?? { dispose: () => {} }
    );

    console.log('[Anti-Copilot Sensor] All sensors active.');
  }

  stop(): void {
    this.isRunning = false;
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const now = Date.now();
    
    for (const change of event.contentChanges) {
      // Detect large paste
      if (change.text.length > this.LARGE_PASTE_THRESHOLD && change.rangeLength === 0) {
        this.emitTrigger(TriggerType.LargePaste, {
          pastedLength: change.text.length,
          preview: change.text.substring(0, 100),
        });
        return;
      }
    }

    // Track typing for WPM calculation
    this.characterCount += event.contentChanges.reduce(
      (sum, c) => sum + c.text.length, 0
    );
    this.lastTypingTime = now;

    // Reset pause timer
    this.resetPauseTimer();

    // Emit typing trigger periodically
    this.emitTrigger(TriggerType.Code, {
      characterCount: this.characterCount,
      timestamp: now,
    });
  }

  private onEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!editor) return;
    
    const doc = editor.document;
    if (doc.getText().trim().length === 0) {
      this.emitTrigger(TriggerType.BlankSpace, {
        fileName: doc.fileName,
      });
    }
  }

  private onDiagnosticsChange(_event: vscode.DiagnosticChangeEvent): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    const errors = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);

    if (errors.length > 0) {
      this.emitTrigger(TriggerType.TerminalError, {
        errorCount: errors.length,
        errors: errors.map((e) => ({
          message: e.message,
          line: e.range.start.line,
        })),
      });
    }
  }

  private onTerminalData(event: vscode.TerminalDataWriteEvent): void {
    const data = event.data;
    
    // Detect error patterns in terminal output
    const errorPatterns = /error|Error|ERROR|failed|FAILED|exception|Exception/;
    if (errorPatterns.test(data)) {
      this.terminalErrors.push(data.substring(0, 200));

      // Check for Triple Error
      if (this.terminalErrors.length >= 3) {
        const lastThree = this.terminalErrors.slice(-3);
        const allSame = lastThree.every((e) => e === lastThree[0]);
        if (allSame) {
          this.emitTrigger(TriggerType.TripleError, {
            repeatedError: lastThree[0],
          });
          this.terminalErrors = [];
          return;
        }
      }

      this.emitTrigger(TriggerType.TerminalError, {
        terminalOutput: data.substring(0, 200),
      });
    }

    // Detect dirty commit
    if (data.includes('git commit')) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const hasErrors = diagnostics.some(
          (d) => d.severity === vscode.DiagnosticSeverity.Error
        );
        if (hasErrors) {
          this.emitTrigger(TriggerType.DirtyCommit, {
            errorCount: diagnostics.filter(
              (d) => d.severity === vscode.DiagnosticSeverity.Error
            ).length,
          });
        }
      }
    }
  }

  private resetPauseTimer(): void {
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.getText().trim().length > 0) {
        this.emitTrigger(TriggerType.Pause, {
          pauseDurationMs: this.PAUSE_THRESHOLD_MS,
        });
      }
    }, this.PAUSE_THRESHOLD_MS);
  }

  private emitTrigger(type: TriggerType, metadata: Record<string, unknown>): void {
    this.wsClient.send({
      trigger: type,
      timestamp: Date.now(),
      metadata,
    });
  }
}
