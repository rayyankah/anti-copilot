import { BrowserWindow } from 'electron';
import { AgentDecision, RobotState } from '../../shared/types';

/**
 * OverlayBridge — Clean IPC bridge between AgentRuntime and React overlay.
 * Replaces scattered webContents.send() calls throughout main.ts.
 */
export class OverlayBridge {
  private overlayWindow: BrowserWindow | null = null;

  setWindow(window: BrowserWindow): void {
    this.overlayWindow = window;
  }

  /**
   * Dispatch an agent action to the overlay renderer.
   */
  dispatchAction(decision: AgentDecision): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    this.overlayWindow.webContents.send('trigger', {
      type: 'action',
      action: decision.action,
      content: decision.content,
      avatarEmotion: decision.avatarEmotion,
      persona: decision.persona,
    });
  }

  /**
   * Update the robot's visual state (idle animations, emotion face).
   */
  updateRobotState(state: RobotState): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    this.overlayWindow.webContents.send('robot-state', state);
  }

  /**
   * Set whether the overlay window captures mouse clicks.
   */
  setClickThrough(enabled: boolean): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    this.overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }

  /**
   * Block mouse for a duration (for screen-blocking actions).
   */
  blockMouseFor(durationMs: number): void {
    this.setClickThrough(false);
    setTimeout(() => this.setClickThrough(true), durationMs);
  }

  /**
   * Send cursor position to the overlay.
   */
  sendCursorUpdate(point: { x: number; y: number }): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    try {
      this.overlayWindow.webContents.send('cursor-update', point);
    } catch {
      // Ignore disposed frame errors during reloads
    }
  }
}
