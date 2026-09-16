const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveFile: (path, name, content) => ipcRenderer.invoke('save-file', path, name, content),
});