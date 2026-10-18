// Sandboxed renderer: expose only the health acknowledgement, never update/admin APIs.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('CoachDesktop', Object.freeze({
  notifyAppReady: () => ipcRenderer.send('coach:ready'),
}));
