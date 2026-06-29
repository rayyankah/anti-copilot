import * as vscode from 'vscode';

export class ThemeController {
  private originalTheme: string | undefined;

  /**
   * Forces VS Code to switch to a blinding light theme.
   * Used as punishment for the Triple Error trigger.
   */
  async forceLightMode(): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    const currentTheme = config.get<string>('colorTheme');
    
    if (currentTheme !== 'Default Light Modern') {
      this.originalTheme = currentTheme;
    }

    await config.update(
      'colorTheme',
      'Default Light Modern',
      vscode.ConfigurationTarget.Global
    );
  }

  /**
   * Randomly changes the theme to something jarring for a short duration.
   */
  async sabotageTheme(durationMs: number = 20000): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    const currentTheme = config.get<string>('colorTheme');
    
    if (currentTheme !== 'Abyss' && currentTheme !== 'Default High Contrast') {
      this.originalTheme = currentTheme;
    }

    const badThemes = ['Abyss', 'Default High Contrast', 'Red', 'Quiet Light'];
    const randomTheme = badThemes[Math.floor(Math.random() * badThemes.length)];

    await config.update(
      'colorTheme',
      randomTheme,
      vscode.ConfigurationTarget.Global
    );

    setTimeout(() => {
      this.restoreTheme();
    }, durationMs);
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
