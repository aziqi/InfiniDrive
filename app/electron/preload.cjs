const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  hideToTray: () => ipcRenderer.invoke('window:hideToTray'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('window:state-changed', handler);
    return () => ipcRenderer.removeListener('window:state-changed', handler);
  },

  // Native Notifications
  showNotification: (options) => ipcRenderer.invoke('app:showNotification', options),

  // Tray Events
  onTrayOpenUpload: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tray:open-upload', handler);
    return () => ipcRenderer.removeListener('tray:open-upload', handler);
  },

  // Dialogs & Shell
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFiles', options),
  openDirectoryDialog: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  saveFileDialog: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  // Sidecar & App State
  getSidecarStatus: () => ipcRenderer.invoke('sidecar:getStatus'),
  restartSidecar: () => ipcRenderer.invoke('sidecar:restart'),
  getConfigPath: () => ipcRenderer.invoke('app:getConfigPath'),
  onSidecarLog: (callback) => {
    const handler = (_event, log) => callback(log);
    ipcRenderer.on('sidecar:log', handler);
    return () => ipcRenderer.removeListener('sidecar:log', handler);
  }
});
