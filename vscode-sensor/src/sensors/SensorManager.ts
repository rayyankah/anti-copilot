import * as vscode from 'vscode';
import { WebSocketClient } from '../transport/WebSocketClient';
import { TriggerType, ActionType } from '../types';
import { ThemeController } from './ThemeController';
import { DeveloperIdentity } from '../identity';

export class SensorManager {
  private disposables: vscode.Disposable[] = [];
  private isRunning = false;
  private lastTypingTime = 0;
  private characterCount = 0;
  private keystrokeTimestamps: number[] = []; // Sliding window for WPM
  private pauseTimer: NodeJS.Timeout | null = null;
  private codeDebounceTimer: NodeJS.Timeout | null = null;
  private terminalErrors: string[] = [];
  private readonly PAUSE_THRESHOLD_MS = 5000;
  private readonly LARGE_PASTE_THRESHOLD = 50;
  private readonly CODE_DEBOUNCE_MS = 10000; // Only fire code trigger once per 10 seconds
  private readonly WPM_WINDOW_MS = 60000; // 60-second sliding window for WPM

  constructor(
    private wsClient: WebSocketClient,
    private themeController: ThemeController,
    private identity: DeveloperIdentity
  ) {}

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

    // Monitor terminal output (proposed API, may not exist in all VS Code versions)
    try {
      const terminalApi = (vscode.window as any).onDidWriteTerminalData;
      if (terminalApi) {
        this.disposables.push(
          terminalApi((e: any) => this.onTerminalData(e))
        );
      }
    } catch {
      console.log('[Anti-Copilot Sensor] Terminal monitoring not available.');
    }

    console.log('[Anti-Copilot Sensor] All sensors active.');
  }

  stop(): void {
    this.isRunning = false;
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    if (this.codeDebounceTimer) clearTimeout(this.codeDebounceTimer);
  }

  private getApiUrl(): string {
    const config = vscode.workspace.getConfiguration('antiCopilot');
    return config.get<string>('apiUrl') || 'http://localhost:3000';
  }

  /**
   * Calculates Words Per Minute using a sliding window.
   * Counts characters typed in the last 60 seconds, converts to WPM (avg 5 chars/word).
   */
  private calculateWPM(): number {
    const now = Date.now();
    const cutoff = now - this.WPM_WINDOW_MS;
    // Prune old timestamps
    this.keystrokeTimestamps = this.keystrokeTimestamps.filter(t => t > cutoff);
    const charsInWindow = this.keystrokeTimestamps.length;
    // WPM = (chars / 5) / (window_seconds / 60)
    const windowSeconds = Math.min((now - (this.keystrokeTimestamps[0] || now)) / 1000, 60);
    if (windowSeconds < 1) return 0;
    return Math.round((charsInWindow / 5) / (windowSeconds / 60));
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
    const charsTyped = event.contentChanges.reduce((sum, c) => sum + c.text.length, 0);
    this.characterCount += charsTyped;
    for (let i = 0; i < charsTyped; i++) {
      this.keystrokeTimestamps.push(now);
    }
    this.lastTypingTime = now;

    // Reset pause timer
    this.resetPauseTimer();

    // Debounced code trigger — only fire once per CODE_DEBOUNCE_MS
    if (!this.codeDebounceTimer) {
      this.codeDebounceTimer = setTimeout(() => {
        this.codeDebounceTimer = null;
        const wpm = this.calculateWPM();
        this.emitTrigger(TriggerType.Code, {
          characterCount: this.characterCount,
          wpm,
          timestamp: Date.now(),
        });
      }, this.CODE_DEBOUNCE_MS);
    }
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

  private onTerminalData(event: { terminal: vscode.Terminal; data: string }): void {
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

  private async emitTrigger(type: TriggerType, metadata: Record<string, unknown>): Promise<void> {
    const apiUrl = this.getApiUrl();
    const payload = {
      userId: this.identity.uuid,
      username: this.identity.username,
      trigger: type,
      timestamp: Date.now(),
      metadata,
    };

    try {
      // Send telemetry to Vercel Brain
      const response = await fetch(`${apiUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const actionResponse = await response.json() as { action: ActionType, content: string, mediaUrl?: string, duration?: number };
      console.log('[Anti-Copilot Sensor] Received Action:', actionResponse.action);

      // Handle specific IDE actions directly, or forward visual actions to overlay
      if (actionResponse.action === ActionType.ForceLightMode) {
        await this.themeController.forceLightMode();
        // Forward to overlay to show text as well
        this.wsClient.send({ ...actionResponse, type: 'action' });
      } else {
        // Forward visual action to overlay
        this.wsClient.send({ ...actionResponse, type: 'action' });
      }

    } catch (err) {
      console.error('[Anti-Copilot Sensor] Failed to communicate with Vercel Brain:', err);
    }
  }
}

