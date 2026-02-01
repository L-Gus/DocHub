const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let rustProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (rustProcess) rustProcess.kill();
  });
}

app.on('ready', () => {
  createWindow();
  startRustBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function startRustBackend() {
  const rustPath = path.join(__dirname, '../../core-backend/target/release/dochub-backend.exe');
  rustProcess = spawn(rustPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

  rustProcess.stdout.on('data', (data) => {
    const response = JSON.parse(data.toString());
    mainWindow.webContents.send('from-rust', response);
  });

  rustProcess.stderr.on('data', (data) => {
    console.error('Rust error:', data.toString());
  });
}

ipcMain.on('to-rust', (event, arg) => {
  if (rustProcess) {
    rustProcess.stdin.write(JSON.stringify(arg) + '\n');
  }
});
