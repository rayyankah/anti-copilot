import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('antiCopilot', {
  onTrigger: (callback: (trigger: unknown) => void) => {
    ipcRenderer.on('trigger', (_event, data) => callback(data));
  },
  onCursorUpdate: (callback: (event: any, data: {x: number, y: number}) => void) => {
    ipcRenderer.on('cursor-update', (event, data) => callback(event, data));
  },
  setClickThrough: (enabled: boolean) => {
    ipcRenderer.send('set-click-through', enabled);
  },
});
