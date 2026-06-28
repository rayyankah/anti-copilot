import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('antiCopilotDebug', {
  /**
   * Receive log entries from the main process.
   * { timestamp: number, source: string, level: string, message: string }
   */
  onLogEntry: (callback: (entry: { timestamp: number; source: string; level: string; message: string }) => void) => {
    ipcRenderer.on('debug-log', (_event, entry) => callback(entry));
  },
});
