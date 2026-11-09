import { contextBridge, ipcRenderer } from 'electron';
import type { ChessWakeAPI, Snapshot } from '../src/domain/types';

const api: ChessWakeAPI = {
  getState: () => ipcRenderer.invoke('state:get'),
  saveAlarm: alarm => ipcRenderer.invoke('alarm:save', alarm),
  deleteAlarm: id => ipcRenderer.invoke('alarm:delete', id),
  testAlarm: () => ipcRenderer.invoke('alarm:test'),
  move: (from, to) => ipcRenderer.invoke('alarm:move', from, to),
  syncPuzzles: () => ipcRenderer.invoke('puzzle:sync'),
  emergencyStop: () => ipcRenderer.invoke('alarm:emergency'),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: Snapshot) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  }
};
contextBridge.exposeInMainWorld('chessWake', api);
