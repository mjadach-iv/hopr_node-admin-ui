import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopApi, DesktopInfo, UpdateState } from './shared';

// Exposed to the renderer as window.desktop, see src/utils/desktop.ts

const info = ipcRenderer.sendSync('desktop:info') as DesktopInfo;

const api: DesktopApi = {
  ...info,
  updates: {
    getState: () => ipcRenderer.invoke('updates:state'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    openReleasePage: () => ipcRenderer.invoke('updates:openReleasePage'),
    onState: (callback) => {
      const listener = (_event: IpcRendererEvent, state: UpdateState) => callback(state);
      ipcRenderer.on('updates:state', listener);
      return () => {
        ipcRenderer.removeListener('updates:state', listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('desktop', api);
