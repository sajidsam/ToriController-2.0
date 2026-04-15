const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    icon: path.join(__dirname, "../assets/toriLogo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;

 if (isDev) {
  win.loadURL("http://localhost:5173");
} else {
  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

  // Allow Web Serial API permission without blocking
  win.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      // For simplicity, auto-select the first available connected MCU (usually CP210x or CH340)
      const selectedPort = portList.find(port => 
          (port.vendorId === '10c4' || port.vendorId === '1a86' || port.vendorId === '0403' || port.vendorId === '303a')
      ) || portList[0];
      callback(selectedPort.portId);
    } else {
      callback(''); // Cancel if no ports
    }
  });

  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'serial') return true;
    return true;
  });

  win.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') return true;
    return true;
  });
}

// IPC handlers
ipcMain.on("minimize", () => win.minimize());

ipcMain.on("maximize", () => {
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on("close", () => win.close());

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
