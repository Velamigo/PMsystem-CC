const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU acceleration if hardware is old/buggy (optional, helps compatibility)
// app.disableHardwareAcceleration();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "ProTrack Project Manager",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // Security best practice
      webSecurity: false // Allow loading local resources if needed
    },
    autoHideMenuBar: true, // Look like a modern app
  });

  // Check if we are in development mode
  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC Handler: Select Folder
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择备份文件夹'
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // IPC Handler: Save File (Auto Backup)
  ipcMain.handle('save-file', async (event, folderPath, fileName, content) => {
    try {
      if (!fs.existsSync(folderPath)) {
        return false;
      }
      const fullPath = path.join(folderPath, fileName);
      fs.writeFileSync(fullPath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error('Electron save failed:', error);
      return false;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});