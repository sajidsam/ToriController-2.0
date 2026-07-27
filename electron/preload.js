const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("minimize"),
  maximize: () => ipcRenderer.send("maximize"),
  close: () => ipcRenderer.send("close"),
  platform: process.platform,
  openExternal: (url) => ipcRenderer.send("open-external", url),
  scanWifi: () => ipcRenderer.invoke("scan-wifi"),
  connectSerial: () => ipcRenderer.invoke("connect-serial"),
  disconnectSerial: () => ipcRenderer.invoke("disconnect-serial"),
  sendSerial: (data) => ipcRenderer.send("send-serial", data),
  onImuData: (callback) => ipcRenderer.on("imu-data", (event, data) => callback(data)),
  onSerialStatus: (callback) => ipcRenderer.on("serial-status", (event, status) => callback(status)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
