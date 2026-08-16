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
  let dir;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Roaming');
    dir = path.join(appData, 'InfiniDrive');
  } else if (process.platform === 'darwin') {
    dir = path.join(process.env.HOME || '/tmp', 'Library', 'Application Support', 'InfiniDrive');
  } else {
    // Linux / BSD: Use XDG_CONFIG_HOME standard (~/.config/infinidrive)
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '/tmp', '.config');
    dir = path.join(xdgConfig, 'infinidrive');
    const legacyDotDir = path.join(process.env.HOME || '/tmp', '.infinidrive');
    if (!fs.existsSync(dir) && fs.existsSync(legacyDotDir)) {
      return legacyDotDir;
    }
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Windows Migration fallback: if TGDrive exists and InfiniDrive config doesn't, copy config
  if (process.platform === 'win32' && process.env.APPDATA) {
    const oldDir = path.join(process.env.APPDATA, 'TGDrive');
    const oldConfig = path.join(oldDir, 'config.json');
    const newConfig = path.join(dir, 'config.json');
    if (fs.existsSync(oldConfig) && !fs.existsSync(newConfig)) {
      try {
        fs.copyFileSync(oldConfig, newConfig);
      } catch (e) {}
    }
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

function findPythonCommand() {
  const possibleVenvs = [
    path.join(__dirname, '..', '..', 'backend', 'venv', 'bin', 'python'),
    path.join(__dirname, '..', '..', 'backend', 'venv', 'bin', 'python3'),
    path.join(__dirname, '..', '..', 'backend', '.venv', 'bin', 'python'),
    path.join(__dirname, '..', '..', 'backend', 'venv', 'Scripts', 'python.exe'),
    path.join(__dirname, '..', '..', 'backend', '.venv', 'Scripts', 'python.exe'),
  ];

  for (const venvPy of possibleVenvs) {
    if (fs.existsSync(venvPy)) {
      return venvPy;
    }
  }

  if (process.platform !== 'win32') {
    return 'python3';
  }
  return 'python';
}

function startSidecar() {
  const appDataDir = getAppDataDir();
  const runtimeFile = path.join(appDataDir, 'runtime.json');
  
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

  const binDir = path.join(process.resourcesPath || __dirname, 'bin');
  const exeName = process.platform === 'win32' ? 'infinidrive_backend.exe' : 'infinidrive_backend';
  const legacyExeName = process.platform === 'win32' ? 'tgdrive_backend.exe' : 'tgdrive_backend';

  const exePath = path.join(binDir, exeName);
  const legacyExePath = path.join(binDir, legacyExeName);
  const localExePath = path.join(__dirname, '..', '..', 'resources', 'bin', exeName);
  const localLegacyExePath = path.join(__dirname, '..', '..', 'resources', 'bin', legacyExeName);
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
    const pyCmd = findPythonCommand();
    logSidecar(`Launching Python backend script via [${pyCmd}]: ${pythonScript}`);
    cmd = pyCmd;
    args = [pythonScript];
  }

  try {
    const spawnOpts = {
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    };
    if (cmd !== 'python' && cmd !== 'python3' && fs.existsSync(cmd)) {
      spawnOpts.cwd = path.dirname(cmd);
    }
    sidecarProcess = spawn(cmd, args, spawnOpts);

    sidecarProcess.stdout.on('data', (data) => {
      const str = data.toString().trim();
      logSidecar(str);
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
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        try { process.kill(pid, 'SIGKILL'); } catch (e2) {}
      }
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

    req.setTimeout(500, () => {
      req.destroy();
      if (attempts < maxAttempts) setTimeout(check, 250);
      else callback(false, sidecarPort);
    });
  };
  check();
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    backgroundColor: '#0a0d14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      // Clean quit
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control IPC handlers
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:isMaximized', (event) => {
  event.returnValue = mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('app:getPort', () => sidecarPort);

ipcMain.handle('app:getLogs', () => sidecarLogs);

ipcMain.handle('app:restartSidecar', async () => {
  stopSidecar();
  startSidecar();
  return new Promise((resolve) => {
    waitForSidecar((ok, port) => {
      resolve({ success: ok, port });
    });
  });
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths;
});

// App lifecycle
app.whenReady().then(() => {
  startSidecar();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  stopSidecar();
});

app.on('will-quit', () => {
  stopSidecar();
});

app.on('window-all-closed', () => {
  stopSidecar();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
