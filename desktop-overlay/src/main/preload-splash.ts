import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('antiCopilotSplash', {
  /**
   * Receive status updates from the main process launcher sequence.
   * { message: string, level: 'info' | 'success' | 'error' }
   */
  onStatusUpdate: (callback: (status: { message: string; level: string }) => void) => {
    ipcRenderer.on('splash-status', (_event, status) => callback(status));
  },

  /**
   * Signal to the main process that the splash animation has completed.
   */
  splashReady: () => {
    ipcRenderer.send('splash-ready');
  },
});
