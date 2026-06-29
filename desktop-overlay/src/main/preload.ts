import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('antiCopilot', {
  // ─── Existing ───
  onTrigger: (callback: (trigger: unknown) => void) => {
    ipcRenderer.on('trigger', (_event, data) => callback(data));
  },
  onCursorUpdate: (callback: (event: any, data: {x: number, y: number}) => void) => {
    ipcRenderer.on('cursor-update', (event, data) => callback(event, data));
  },
  setClickThrough: (enabled: boolean) => {
    ipcRenderer.send('set-click-through', enabled);
  },

  // ─── New Agent Channels ───
  onRobotStateUpdate: (callback: (state: any) => void) => {
    ipcRenderer.on('robot-state', (_event, state) => callback(state));
  },
  onAgentAction: (callback: (action: any) => void) => {
    ipcRenderer.on('agent-action', (_event, action) => callback(action));
  },

  // ─── Fight-back: user reacts to an attack ───
  sendUserReaction: (reaction: string) => {
    ipcRenderer.send('user-reaction', reaction);
  },

  // ─── App Lifecycle ───
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },
});
