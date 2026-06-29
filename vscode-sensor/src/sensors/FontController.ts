import * as vscode from 'vscode';

export class FontController {
  private originalColors: any = undefined;

  /**
   * Temporarily modifies editor.foreground and editor.background to hide text.
   */
  async invisibleFontPrank(durationMs: number = 3000): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    const colorCustomizations = config.get<any>('colorCustomizations') || {};
    
    // Save original if we haven't already
    if (this.originalColors === undefined) {
      this.originalColors = { ...colorCustomizations };
    }

    // Set colors to black
    const prankColors = {
      ...colorCustomizations,
      'editor.foreground': '#000000',
      'editor.background': '#000000',
      'editorLineNumber.foreground': '#000000',
    };

    await config.update(
      'colorCustomizations',
      prankColors,
      vscode.ConfigurationTarget.Workspace
    );

    setTimeout(() => {
      this.restoreFonts();
    }, durationMs);
  }

  /**
   * Restores the user's original color customizations.
   */
  async restoreFonts(): Promise<void> {
    if (this.originalColors === undefined) return;

    const config = vscode.workspace.getConfiguration('workbench');
    
    // If it was empty originally, we can set it to undefined to remove it
    const targetValue = Object.keys(this.originalColors).length === 0 ? undefined : this.originalColors;

    await config.update(
      'colorCustomizations',
      targetValue,
      vscode.ConfigurationTarget.Workspace
    );
    
    this.originalColors = undefined; // Reset state
  }
}
