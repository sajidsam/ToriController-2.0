const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const wifi = require("node-wifi");

// Initialize node-wifi
wifi.init({
  iface: null // network interface, choose a random one if null
});

// Allow local HTTPS connections with self-signed/invalid SSL certificates (common in local IP cameras)
app.commandLine.appendSwitch('ignore-certificate-errors');

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

  // Remove Web Serial API session overrides since we are migrating to Node.js serialport
  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'geolocation') return true;
    return true;
  });

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'geolocation') return callback(true);
    callback(true);
  });
}

let serialPortInstance = null;
let serialParser = null;

try {
  // Setup SerialPort integration
  // The user must run: npm install serialport @serialport/parser-readline
  const { SerialPort } = require('serialport');
  const { ReadlineParser } = require('@serialport/parser-readline');

  ipcMain.handle("connect-serial", async () => {
    try {
      const ports = await SerialPort.list();
      console.log("AVAILABLE SERIAL PORTS:", ports);
      
      if (!ports || ports.length === 0) {
        return { success: false, error: "No serial ports found!" };
      }

      let selectedPort = ports.find(port => 
        (port.vendorId && (
          port.vendorId.toLowerCase() === '10c4' || 
          port.vendorId.toLowerCase() === '1a86' || 
          port.vendorId.toLowerCase() === '0403' || 
          port.vendorId.toLowerCase() === '303a'
        ))
      );
      
      if (!selectedPort) {
        selectedPort = ports.find(port => port.path && port.path.toLowerCase().includes('usb'));
      }
      
      if (!selectedPort) {
        selectedPort = ports[0];
      }
      
      console.log("AUTO-SELECTED PORT:", selectedPort.path);

      if (serialPortInstance && serialPortInstance.isOpen) {
        try {
          serialPortInstance.close();
        } catch (e) {
          console.warn("Failed to close existing port", e);
        }
      }

      return new Promise((resolve, reject) => {
        serialPortInstance = new SerialPort({ path: selectedPort.path, baudRate: 115200 }, (err) => {
          if (err) {
            console.error("Error opening port:", err);
            return resolve({ success: false, error: err.message });
          }

          // Force DTR/RTS for ESP32
          serialPortInstance.set({ dtr: true, rts: true }, (setErr) => {
             if (setErr) console.warn("Failed to set DTR/RTS", setErr);
          });

          serialParser = serialPortInstance.pipe(new ReadlineParser({ delimiter: '\n' }));

          serialParser.on('data', (line) => {
            line = line.trim();
            if (line.startsWith("DATA:")) {
              try {
                const jsonData = JSON.parse(line.substring(5));
                if (win && !win.isDestroyed()) {
                  win.webContents.send("imu-data", jsonData);
                }
              } catch (e) {
                console.error("Failed to parse IMU JSON (dropped frame):", e.message);
              }
            }
          });

          serialPortInstance.on('error', (err) => {
             console.error("Serial port error:", err);
             if (win && !win.isDestroyed()) {
               win.webContents.send("serial-status", { connected: false });
             }
          });

          serialPortInstance.on('close', () => {
             if (win && !win.isDestroyed()) {
               win.webContents.send("serial-status", { connected: false });
             }
          });

          resolve({ success: true, path: selectedPort.path });
        });
      });

    } catch (err) {
      console.error("Serial connection error:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("disconnect-serial", async () => {
    if (serialPortInstance && serialPortInstance.isOpen) {
      try {
        serialPortInstance.close();
      } catch (e) {
        console.warn("Error closing serial port:", e);
      }
    }
    return { success: true };
  });

  ipcMain.on("send-serial", (event, data) => {
    if (serialPortInstance && serialPortInstance.isOpen) {
      serialPortInstance.write(data + "\r\n");
    }
  });

} catch (err) {
  console.error("Failed to initialize SerialPort. Ensure 'serialport' is installed.", err);
  ipcMain.handle("connect-serial", async () => {
    return { success: false, error: "SerialPort library is missing in backend. Run npm install serialport @serialport/parser-readline" };
  });
  ipcMain.handle("disconnect-serial", async () => { return { success: true }; });
  ipcMain.on("send-serial", () => {});
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

const { exec } = require("child_process");

ipcMain.handle("scan-wifi", async () => {
  try {
    if (process.platform === "darwin") {
      // macOS Sonoma/Sequoia removed 'airport', so we parse system_profiler
      return await new Promise((resolve) => {
        exec("system_profiler SPAirPortDataType", (err, stdout) => {
          if (err) {
            console.error("system_profiler error:", err);
            return resolve([]);
          }
          
          const networks = [];
          const lines = stdout.split('\n');
          let currentNetwork = null;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for SSID (typically 12 spaces indentation ending in colon)
            const ssidMatch = line.match(/^ {12}([^:]+):$/);
            if (ssidMatch && !line.includes("Current Network Information:") && !line.includes("Other Local Wi-Fi Networks:")) {
              if (currentNetwork) networks.push(currentNetwork);
              currentNetwork = { ssid: ssidMatch[1].trim(), signal_level: -99 };
            } else if (currentNetwork) {
              const signalMatch = line.match(/^\s+Signal \/ Noise: (-?\d+) dBm/);
              if (signalMatch) {
                currentNetwork.signal_level = parseInt(signalMatch[1], 10);
              }
              // Stop parsing networks when we hit another section (less indentation)
              if (line.match(/^ {0,10}\w/)) {
                if (currentNetwork) networks.push(currentNetwork);
                currentNetwork = null;
              }
            }
          }
          if (currentNetwork) networks.push(currentNetwork);
          
          resolve(networks);
        });
      });
    } else {
      // Windows / Linux
      return await wifi.scan();
    }
  } catch (error) {
    console.error("Wifi scan failed", error);
    return [];
  }
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
