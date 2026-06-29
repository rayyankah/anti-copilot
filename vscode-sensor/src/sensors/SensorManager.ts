import * as vscode from 'vscode';
import { WebSocketClient } from '../transport/WebSocketClient';
import { ThemeController } from './ThemeController';
import { FontController } from './FontController';
import { CursorController } from './CursorController';
import { DeveloperIdentity } from '../identity';

/**
 * SensorManager — Stripped to a thin MCP tool handler.
 * 
 * No analysis. No decisions. No HTTP calls. No timers.
 * It only provides data when asked (via MCP tools) and
 * delegates the telemetry firehose to TelemetryStream.
 */
export class SensorManager {
  private disposables: vscode.Disposable[] = [];
  private isRunning = false;
  private statusBarItem: vscode.StatusBarItem;

  constructor(
    private wsClient: WebSocketClient,
    private themeController: ThemeController,
    private fontController: FontController,
    private cursorController: CursorController,
    private identity: DeveloperIdentity
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.text = '$(eye) Anti-Copilot: Ready';
    this.statusBarItem.tooltip = 'Anti-Copilot is monitoring your work';
    this.statusBarItem.show();
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusBarItem.text = '$(eye) Anti-Copilot: Watching...';
    console.log('[Anti-Copilot Sensor] Sensors active (telemetry mode).');
  }

  stop(): void {
    this.isRunning = false;
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.statusBarItem.hide();
  }

  // ─── MCP Tool Handlers (called by AgentRuntime via MCP) ───

  getActiveFile(): { path: string; language: string; content: string; lineCount: number } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    const doc = editor.document;
    return {
      path: doc.fileName,
      language: doc.languageId,
      content: doc.getText(),
      lineCount: doc.lineCount,
    };
  }

  getCursorPosition(): { line: number; column: number; surroundingCode: string } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    const pos = editor.selection.active;
    const doc = editor.document;
    const startLine = Math.max(0, pos.line - 10);
    const endLine = Math.min(doc.lineCount - 1, pos.line + 10);
    const surroundingCode = doc.getText(new vscode.Range(startLine, 0, endLine, 1000));
    return { line: pos.line, column: pos.character, surroundingCode };
  }

  getDiagnostics(): { errors: Array<{ message: string; line: number; severity: string }> } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { errors: [] };
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
    return {
      errors: diagnostics.map(d => ({
        message: d.message,
        line: d.range.start.line,
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
      })),
    };
  }

  getAllDiagnostics(): { totalErrors: number; totalWarnings: number; fileCount: number } {
    const allDiags = vscode.languages.getDiagnostics();
    let totalErrors = 0;
    let totalWarnings = 0;
    for (const [, diags] of allDiags) {
      for (const d of diags) {
        if (d.severity === vscode.DiagnosticSeverity.Error) totalErrors++;
        else if (d.severity === vscode.DiagnosticSeverity.Warning) totalWarnings++;
      }
    }
    return { totalErrors, totalWarnings, fileCount: allDiags.length };
  }

  getOpenFiles(): { files: Array<{ path: string; language: string; isDirty: boolean }> } {
    const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
    const files = tabs
      .filter(t => t.input && (t.input as any).uri)
      .map(t => {
        const uri = (t.input as any).uri as vscode.Uri;
        return {
          path: uri.fsPath,
          language: '',
          isDirty: t.isDirty || false,
        };
      });
    return { files };
  }

  getSelectedCode(): { code: string; startLine: number; endLine: number } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) return null;
    return {
      code: editor.document.getText(editor.selection),
      startLine: editor.selection.start.line,
      endLine: editor.selection.end.line,
    };
  }

  async getProjectStructure(): Promise<{ tree: string }> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return { tree: '(no workspace)' };
    const root = folders[0].uri;
    try {
      const entries = await vscode.workspace.fs.readDirectory(root);
      const tree = entries
        .slice(0, 50)
        .map(([name, type]) => `${type === vscode.FileType.Directory ? '📁' : '📄'} ${name}`)
        .join('\n');
      return { tree };
    } catch {
      return { tree: '(unable to read)' };
    }
  }

  // ─── Theme Control (still needed for agent actions) ───

  async forceLightMode(): Promise<void> {
    await this.themeController.forceLightMode();
  }

  async restoreTheme(): Promise<void> {
    await this.themeController.restoreTheme();
  }

  async sabotageTheme(): Promise<void> {
    await this.themeController.sabotageTheme();
  }

  async invisibleFontPrank(): Promise<void> {
    await this.fontController.invisibleFontPrank();
  }

  async cursorAttack(): Promise<void> {
    await this.cursorController.cursorAttack();
  }

  async flashStrobe(count: number = 6): Promise<void> {
    let isLight = false;
    for (let i = 0; i < count; i++) {
      if (isLight) {
        await this.themeController.restoreTheme();
      } else {
        await this.themeController.forceLightMode();
      }
      isLight = !isLight;
      await new Promise(r => setTimeout(r, 150));
    }
    await this.themeController.restoreTheme();
  }

}
