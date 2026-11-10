const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexMeter', {
  getState: () => ipcRenderer.invoke('state:get'),
  refresh: () => ipcRenderer.invoke('state:refresh'),
  setProvider: (provider) => ipcRenderer.invoke('provider:set', provider),
  reconnectClaude: () => ipcRenderer.invoke('claude:reconnect'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  openMobile: () => ipcRenderer.invoke('mobile:open'),
  copyMobileLink: () => ipcRenderer.invoke('mobile:copy-link'),
  rotateMobileToken: () => ipcRenderer.invoke('mobile:rotate-token'),
  getMobileQr: () => ipcRenderer.invoke('mobile:get-qr'),
  refreshTailscaleStatus: () => ipcRenderer.invoke('mobile:tailscale-status'),
  configureTailscale: () => ipcRenderer.invoke('mobile:tailscale-configure'),
  installTailscale: () => ipcRenderer.invoke('mobile:tailscale-install'),
  configureCloudSync: (options) => ipcRenderer.invoke('cloud-sync:configure', options),
  pushCloudSync: () => ipcRenderer.invoke('cloud-sync:push'),
  getCloudSyncQr: () => ipcRenderer.invoke('cloud-sync:get-qr'),
  copyCloudSyncLink: () => ipcRenderer.invoke('cloud-sync:copy-link'),
  copyCloudSyncRecovery: () => ipcRenderer.invoke('cloud-sync:copy-recovery'),
  openCloudSync: () => ipcRenderer.invoke('cloud-sync:open'),
  resetCloudSync: () => ipcRenderer.invoke('cloud-sync:reset'),
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
  markPanelReady: (height) => ipcRenderer.send('panel:renderer-ready', height),
  reportPanelHeight: (height) => ipcRenderer.send('panel:content-height', height),
  onSettings: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings:update', listener);
    return () => ipcRenderer.removeListener('settings:update', listener);
  }
});
