const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

// Allow local HTTPS connections with self-signed/invalid SSL certificates (common in local IP cameras)
app.commandLine.appendSwitch('ignore-certificate-errors');

let win;

function createWindow() {
  const isMac = process.platform === "darwin";
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    titleBarStyle: isMac ? "hidden" : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 10 } : undefined,
    icon: path.join(__dirname, "../assets/toriLogo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Enable cross-origin requests to local IP cameras and APIs
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
    console.log("AVAILABLE SERIAL PORTS:", portList);
    
    if (portList && portList.length > 0) {
      // First try to match common MCU vendor IDs
      let selectedPort = portList.find(port => 
          (port.vendorId && (
            port.vendorId.toLowerCase() === '10c4' || 
            port.vendorId.toLowerCase() === '1a86' || 
            port.vendorId.toLowerCase() === '0403' || 
            port.vendorId.toLowerCase() === '303a' ||
            port.vendorId.toLowerCase() === '10c4'
          ))
      );
      
      // If no vendor ID matches, prioritize ports with 'usb' in the name (avoids Bluetooth ports on Mac)
      if (!selectedPort) {
        selectedPort = portList.find(port => port.portName && port.portName.toLowerCase().includes('usb'));
      }
      
      // Fallback to the first port if nothing else matches
      if (!selectedPort) {
        selectedPort = portList[0];
      }
      
      console.log("AUTO-SELECTED PORT:", selectedPort.portName, "VendorID:", selectedPort.vendorId);
      callback(selectedPort.portId);
    } else {
      console.log("No serial ports found!");
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
  if (process.platform === "darwin") {
    win.setFullScreen(!win.isFullScreen());
  } else {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.on("close", () => win.close());

ipcMain.on("open-external", (event, url) => {
  shell.openExternal(url);
});

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
