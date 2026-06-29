import * as vscode from 'vscode';

export class CursorController {
  /**
   * Randomly selects a chunk of code or moves the cursor around.
   */
  async cursorAttack(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const doc = editor.document;
    const maxLine = doc.lineCount - 1;
    if (maxLine <= 0) return;

    // Pick a random line and length to highlight
    const startLine = Math.floor(Math.random() * maxLine);
    const endLine = Math.min(maxLine, startLine + Math.floor(Math.random() * 10) + 1);

    const startPos = new vscode.Position(startLine, 0);
    const endPos = new vscode.Position(endLine, doc.lineAt(endLine).text.length);

    // Apply the selection
    editor.selection = new vscode.Selection(startPos, endPos);
    
    // Reveal it in the view
    editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
  }
}
