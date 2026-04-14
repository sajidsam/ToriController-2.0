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
  win.loadFile(path.join(process.resourcesPath, "app.asar", "dist", "index.html"));
}
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
