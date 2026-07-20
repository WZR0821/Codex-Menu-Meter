const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexMeter', {
  getState: () => ipcRenderer.invoke('state:get'),
  refresh: () => ipcRenderer.invoke('state:refresh'),
  setProvider: (provider) => ipcRenderer.invoke('provider:set', provider),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  openRadar: () => ipcRenderer.invoke('app:open-radar'),
  showAppInFolder: () => ipcRenderer.invoke('app:show-in-folder'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:update', listener);
    return () => ipcRenderer.removeListener('state:update', listener);
  },
  onPanelMotion: (callback) => {
    const listener = (_event, motion) => callback(motion);
    ipcRenderer.on('panel:motion', listener);
    return () => ipcRenderer.removeListener('panel:motion', listener);
  },
  onSettings: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings:update', listener);
    return () => ipcRenderer.removeListener('settings:update', listener);
  }
});
