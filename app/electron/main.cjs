const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, exec } = require('child_process');

let mainWindow = null;
let sidecarProcess = null;
let sidecarPort = 8082;
let sidecarLogs = [];
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getAppDataDir() {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
  const dir = path.join(appData, 'InfiniDrive');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Migration fallback: if TGDrive exists and InfiniDrive config doesn't, copy config
  const oldDir = path.join(appData, 'TGDrive');
  const oldConfig = path.join(oldDir, 'config.json');
  const newConfig = path.join(dir, 'config.json');
  if (fs.existsSync(oldConfig) && !fs.existsSync(newConfig)) {
    try {
      fs.copyFileSync(oldConfig, newConfig);
    } catch (e) {}
  }
  return dir;
}

function logSidecar(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  sidecarLogs.push(line);
  if (sidecarLogs.length > 500) sidecarLogs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sidecar:log', line);
  }
}

function startSidecar() {
  const appDataDir = getAppDataDir();
  const runtimeFile = path.join(appDataDir, 'runtime.json');
  
  // Clean old runtime file
  if (fs.existsSync(runtimeFile)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
      if (oldData.pid) {
        killProcessTree(oldData.pid);
      }
      fs.unlinkSync(runtimeFile);
    } catch (e) {
      console.error('Error cleaning old runtime:', e);
    }
  }

  // Look for packaged executable first
  const binDir = path.join(process.resourcesPath || __dirname, 'bin');
  const exePath = path.join(binDir, 'infinidrive_backend.exe');
  const legacyExePath = path.join(binDir, 'tgdrive_backend.exe');
  const localExePath = path.join(__dirname, '..', '..', 'resources', 'bin', 'infinidrive_backend.exe');
  const localLegacyExePath = path.join(__dirname, '..', '..', 'resources', 'bin', 'tgdrive_backend.exe');
  const pythonScript = path.join(__dirname, '..', '..', 'backend', 'run_sidecar.py');

  let cmd = '';
  let args = [];

  if (fs.existsSync(exePath)) {
    logSidecar(`Launching bundled sidecar binary: ${exePath}`);
    cmd = exePath;
    args = [];
  } else if (fs.existsSync(legacyExePath)) {
    logSidecar(`Launching bundled legacy binary: ${legacyExePath}`);
    cmd = legacyExePath;
    args = [];
  } else if (fs.existsSync(localExePath)) {
    logSidecar(`Launching local sidecar binary: ${localExePath}`);
    cmd = localExePath;
    args = [];
  } else if (fs.existsSync(localLegacyExePath)) {
    logSidecar(`Launching local legacy binary: ${localLegacyExePath}`);
    cmd = localLegacyExePath;
    args = [];
  } else {
    logSidecar(`Launching Python backend script: ${pythonScript}`);
    cmd = 'python';
    args = [pythonScript];
  }

  try {
    const spawnOpts = {
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    };
    if (cmd !== 'python' && fs.existsSync(cmd)) {
      spawnOpts.cwd = path.dirname(cmd);
    }
    sidecarProcess = spawn(cmd, args, spawnOpts);

    sidecarProcess.stdout.on('data', (data) => {
      const str = data.toString().trim();
      logSidecar(str);
      // Check if port announced
      const portMatch = str.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (portMatch) {
        sidecarPort = parseInt(portMatch[1], 10);
      }
    });

    sidecarProcess.stderr.on('data', (data) => {
      const str = data.toString().trim();
      logSidecar(`[STDERR] ${str}`);
    });

    sidecarProcess.on('close', (code) => {
      logSidecar(`Sidecar process exited with code ${code}`);
      sidecarProcess = null;
    });

    logSidecar(`Sidecar process spawned with PID: ${sidecarProcess.pid}`);
  } catch (err) {
    logSidecar(`Failed to spawn sidecar: ${err.message}`);
  }
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } catch (e) {}
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch (e) {
    console.error(`Error killing PID ${pid}:`, e);
  }
}

function stopSidecar() {
  if (sidecarProcess && sidecarProcess.pid) {
    logSidecar(`Stopping sidecar PID ${sidecarProcess.pid}...`);
    killProcessTree(sidecarProcess.pid);
    sidecarProcess = null;
  }
  const runtimeFile = path.join(getAppDataDir(), 'runtime.json');
  if (fs.existsSync(runtimeFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
      if (data.pid) killProcessTree(data.pid);
      fs.unlinkSync(runtimeFile);
    } catch (e) {}
  }
}

function waitForSidecar(callback, maxAttempts = 60) {
  let attempts = 0;
  const check = () => {
    attempts++;
    // Check runtime.json first
    const runtimeFile = path.join(getAppDataDir(), 'runtime.json');
    if (fs.existsSync(runtimeFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
        if (data.port) sidecarPort = data.port;
      } catch (e) {}
    }

    const req = http.get(`http://127.0.0.1:${sidecarPort}/health`, (res) => {
      if (res.statusCode === 200) {
        logSidecar(`Sidecar healthy on port ${sidecarPort}`);
        callback(true, sidecarPort);
      } else {
        if (attempts < maxAttempts) setTimeout(check, 250);
        else callback(false, sidecarPort);
      }
    });

    req.on('error', () => {
      if (attempts < maxAttempts) setTimeout(check, 250);
      else callback(false, sidecarPort);
    });

    req.setTimeout(800, () => {
      req.abort();
    });
  };

  check();
}

const { Notification } = require('electron');
let tray = null;

function createTray() {
  if (tray) return;

  const iconPath = path.join(__dirname, 'icon.png');
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('InfiniDrive â€” Infinite Cloud Storage');

    const updateTrayMenu = () => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show InfiniDrive',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: 'Upload Files...',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('tray:open-upload');
            }
          }
        },
        { type: 'separator' },
        {
          label: `Sidecar Port: ${sidecarPort} (Online)`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Quit InfiniDrive',
          click: () => {
            isQuitting = true;
            stopSidecar();
            app.quit();
          }
        }
      ]);
      tray.setContextMenu(contextMenu);
    };

    updateTrayMenu();

    tray.on('double-click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('Failed to create tray:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0b0e',
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (isDev && !fs.existsSync(distPath)) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:state-changed', { isMaximized: false });
  });

  mainWindow.on('close', () => {
    isQuitting = true;
    stopSidecar();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopSidecar();
    app.exit(0);
  });
}

// IPC Handlers
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:hideToTray', () => {
  isQuitting = true;
  stopSidecar();
  app.exit(0);
});
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
  return mainWindow?.isMaximized();
});
ipcMain.handle('window:close', () => {
  isQuitting = true;
  stopSidecar();
  app.exit(0);
});
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

ipcMain.handle('app:showNotification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    try {
      const notif = new Notification({
        title: title || 'InfiniDrive',
        body: body || '',
        icon: path.join(__dirname, 'icon.png')
      });
      notif.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notif.show();
    } catch (e) {
      console.error('Notification error:', e);
    }
  }
});

ipcMain.handle('dialog:openFiles', async (event, options) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    ...options
  });
  return res.filePaths;
});

ipcMain.handle('dialog:openDirectory', async (event, options) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
    ...options
  });
  return res.filePaths;
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName
  });
  return res.filePath;
});

ipcMain.handle('shell:openExternal', (event, url) => shell.openExternal(url));
ipcMain.handle('shell:showItemInFolder', (event, filePath) => shell.showItemInFolder(filePath));

ipcMain.handle('sidecar:getStatus', () => {
  return {
    running: !!sidecarProcess,
    port: sidecarPort,
    baseUrl: `http://127.0.0.1:${sidecarPort}`,
    logs: sidecarLogs
  };
});

ipcMain.handle('sidecar:restart', async () => {
  stopSidecar();
  await new Promise(r => setTimeout(r, 1000));
  startSidecar();
  return new Promise((resolve) => {
    waitForSidecar((ready, port) => {
      resolve({ ready, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
});

ipcMain.handle('app:getConfigPath', () => {
  return path.join(getAppDataDir(), 'config.json');
});

// App Lifecycle
app.whenReady().then(() => {
  startSidecar();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopSidecar();
});

app.on('window-all-closed', () => {
  stopSidecar();
  app.exit(0);
});

// InfiniDrive Electron main — sidecar lifecycle manager auto-kills backend on app quit
