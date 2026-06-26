import * as vscode from 'vscode';

export class ThemeController {
  private originalTheme: string | undefined;

  /**
   * Forces VS Code to switch to a blinding light theme.
   * Used as punishment for the Triple Error trigger.
   */
  async forceLightMode(): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    this.originalTheme = config.get<string>('colorTheme');

    await config.update(
      'colorTheme',
      'Default Light Modern',
      vscode.ConfigurationTarget.Global
    );
  }

  /**
   * Restores the user's original theme.
   */
  async restoreTheme(): Promise<void> {
    if (!this.originalTheme) return;

    const config = vscode.workspace.getConfiguration('workbench');
    await config.update(
      'colorTheme',
      this.originalTheme,
      vscode.ConfigurationTarget.Global
    );
  }
}
