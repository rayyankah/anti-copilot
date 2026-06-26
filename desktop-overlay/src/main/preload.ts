import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('antiCopilot', {
  onTrigger: (callback: (trigger: unknown) => void) => {
    ipcRenderer.on('trigger', (_event, data) => callback(data));
  },
  setClickThrough: (enabled: boolean) => {
    ipcRenderer.send('set-click-through', enabled);
  },
});
