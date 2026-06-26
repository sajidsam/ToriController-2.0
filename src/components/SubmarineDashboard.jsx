import React, { useState, useEffect, useRef } from "react";
import { Globe, Download } from "lucide-react";
import TopNavBar from "./TopNavBar";
import TelemetryPanel from "./TelemetryPanel";
import ControlPanel from "./ControlPanel";
import MainCenterView from "./MainCenterView";

// Simple 1D Kalman Filter for smoothing sensor fluctuations
class KalmanFilter {
  constructor(q = 0.02, r = 0.5, isAngle = false) {
    this.q = q; // Process noise covariance
    this.r = r; // Measurement noise covariance
    this.isAngle = isAngle;
    this.p = 1.0; // Estimation error covariance
    this.x = null; // Value estimate (initialized on first update)
  }

  update(z) {
    if (this.x === null) {
      this.x = z;
      return this.x;
    }

    // Prediction Update
    const pPred = this.p + this.q;

    // Measurement Update
    const k = pPred / (pPred + this.r);

    let diff;
    if (this.isAngle) {
      diff = z - this.x;
      diff = (diff + 180) % 360;
      if (diff < 0) diff += 360;
      diff -= 180;
    } else {
      diff = z - this.x;
    }

    this.x = this.x + k * diff;

    if (this.isAngle) {
      this.x = (this.x + 360) % 360;
    }

    this.p = (1 - k) * pPred;
    return this.x;
  }
}

const SubmarineDashboard = () => {
  // Kalman Filters for IMU/gyro smoothing
  const pitchFilterRef = useRef(new KalmanFilter(0.02, 0.5, false));
  const rollFilterRef = useRef(new KalmanFilter(0.02, 0.5, false));
  const headingFilterRef = useRef(new KalmanFilter(0.02, 0.5, true));

  // --- IMU GYRO CALIBRATION STATES & REFS ---
  const [hasReceivedFirstData, setHasReceivedFirstData] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationTimeLeft, setCalibrationTimeLeft] = useState(10);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [pitchOffset, setPitchOffset] = useState(0);
  const [rollOffset, setRollOffset] = useState(0);
  const [headingOffset, setHeadingOffset] = useState(0);

  // Persistent Refs to prevent stale closures in async reader loops
  const hasReceivedFirstDataRef = useRef(false);
  const isCalibratingRef = useRef(false);
  const isCalibratedRef = useRef(false);
  const pitchOffsetRef = useRef(0);
  const rollOffsetRef = useRef(0);
  const headingOffsetRef = useRef(0);

  const calibrationDataRef = useRef({
    sumPitch: 0,
    sumRoll: 0,
    headingStartX: 0,
    headingStartY: 0,
    count: 0,
  });

  const setIsCalibratingVal = (val) => {
    isCalibratingRef.current = val;
    setIsCalibrating(val);
  };
  const setIsCalibratedVal = (val) => {
    isCalibratedRef.current = val;
    setIsCalibrated(val);
  };
  const setPitchOffsetVal = (val) => {
    pitchOffsetRef.current = val;
    setPitchOffset(val);
  };
  const setRollOffsetVal = (val) => {
    rollOffsetRef.current = val;
    setRollOffset(val);
  };
  const setHeadingOffsetVal = (val) => {
    headingOffsetRef.current = val;
    setHeadingOffset(val);
  };
  const setHasReceivedFirstDataVal = (val) => {
    hasReceivedFirstDataRef.current = val;
    setHasReceivedFirstData(val);
  };

  const startCalibration = () => {
    setIsCalibratingVal(true);
    setIsCalibratedVal(false);
    calibrationDataRef.current = {
      sumPitch: 0,
      sumRoll: 0,
      headingStartX: 0,
      headingStartY: 0,
      count: 0,
    };
    console.log("IMU Calibration started. Intercepting next 10 packets...");
  };

  // --- CI/CD AUTO-UPDATE NOTIFIER ---
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [releaseUrl, setReleaseUrl] = useState("");

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/sifat-99/ToriController-2.0/releases/latest",
        );
        if (!response.ok) return;
        const data = await response.json();
        const latest = data.tag_name; // e.g. "v2.0.2" or "2.0.2"
        if (!latest) return;

        // Clean v prefix if present
        const cleanLatest = latest.replace(/^v/, "");
        const cleanCurrent = "2.0.1"; // Matches package.json

        if (cleanLatest !== cleanCurrent) {
          const latestParts = cleanLatest.split(".").map(Number);
          const currentParts = cleanCurrent.split(".").map(Number);

          let isNewer = false;
          for (let i = 0; i < 3; i++) {
            const lPart = latestParts[i] || 0;
            const cPart = currentParts[i] || 0;
            if (lPart > cPart) {
              isNewer = true;
              break;
            } else if (lPart < cPart) {
              break;
            }
          }

          if (isNewer) {
            setLatestVersion(latest);
            setReleaseUrl(
              data.html_url ||
                "https://github.com/sifat-99/ToriController-2.0/releases",
            );
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        console.warn("Failed to check for updates:", err);
      }
    };

    // Check after 2 seconds to not block main thread startup rendering
    const timer = setTimeout(checkUpdate, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isCalibrating) return;

    const timer = setInterval(() => {
      setCalibrationTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          const data = calibrationDataRef.current;
          if (data.count > 0) {
            const avgPitch = data.sumPitch / data.count;
            const avgRoll = data.sumRoll / data.count;
            const avgX = data.headingStartX / data.count;
            const avgY = data.headingStartY / data.count;
            let avgHeading = (Math.atan2(avgY, avgX) * 180) / Math.PI;
            avgHeading = (avgHeading + 360) % 360;

            setPitchOffsetVal(avgPitch);
            setRollOffsetVal(avgRoll);
            setHeadingOffsetVal(avgHeading);
            setIsCalibratedVal(true);
            console.log(
              `IMU Calibrated. Offsets -> Pitch: ${avgPitch.toFixed(2)}, Roll: ${avgRoll.toFixed(2)}, Heading: ${avgHeading.toFixed(2)}`,
            );
          } else {
            setPitchOffsetVal(0);
            setRollOffsetVal(0);
            setHeadingOffsetVal(0);
          }
          setIsCalibratingVal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCalibrating]);

  const processIMU = (rawPitch, rawRoll, rawHeading) => {
    if (!hasReceivedFirstDataRef.current) {
      setHasReceivedFirstDataVal(true);
    }

    const filteredP = pitchFilterRef.current.update(-rawPitch);
    const filteredR = rollFilterRef.current.update(rawRoll);
    const filteredH = headingFilterRef.current.update(rawHeading);

    if (isCalibratingRef.current) {
      calibrationDataRef.current.sumPitch += filteredP;
      calibrationDataRef.current.sumRoll += filteredR;
      const rad = (filteredH * Math.PI) / 180;
      calibrationDataRef.current.headingStartX += Math.cos(rad);
      calibrationDataRef.current.headingStartY += Math.sin(rad);
      calibrationDataRef.current.count += 1;

      // Show raw filtered values during packet interception
      setPitch(filteredP);
      setRoll(filteredR);
      setHeading(filteredH);

      if (calibrationDataRef.current.count >= 10) {
        const data = calibrationDataRef.current;
        const avgPitch = data.sumPitch / data.count;
        const avgRoll = data.sumRoll / data.count;
        const avgX = data.headingStartX / data.count;
        const avgY = data.headingStartY / data.count;
        let avgHeading = (Math.atan2(avgY, avgX) * 180) / Math.PI;
        avgHeading = (avgHeading + 360) % 360;

        setPitchOffsetVal(avgPitch);
        setRollOffsetVal(avgRoll);
        setHeadingOffsetVal(avgHeading);
        setIsCalibratedVal(true);
        setIsCalibratingVal(false);
        console.log(
          `IMU Calibrated. Offsets -> Pitch: ${avgPitch.toFixed(2)}, Roll: ${avgRoll.toFixed(2)}, Yaw: ${avgHeading.toFixed(2)}`,
        );
      }
    } else if (isCalibratedRef.current) {
      // Subtraction offset math to show zero-relative values (+/-)
      setPitch(filteredP - pitchOffsetRef.current);
      setRoll(filteredR - rollOffsetRef.current);
      const diffHeading = (filteredH - headingOffsetRef.current + 360) % 360;
      setHeading(diffHeading);
    } else {
      setPitch(filteredP);
      setRoll(filteredR);
      setHeading(filteredH);
    }
  };

  // Mock State for Telemetry & Nav (would be replaced by actual WebSockets/Serial)
  const [signalStrength, setSignalStrength] = useState(85);
  const [batteryVolt, setBatteryVolt] = useState(12.4);
  const [isLeaking, setIsLeaking] = useState(false);

  const [depth, setDepth] = useState(2.5);
  const [amps, setAmps] = useState(3.2);
  const [rpm, setRpm] = useState(1200);
  const [temp, setTemp] = useState(0.0);
  const [speedKnots, setSpeedKnots] = useState(0);
  const [lat, setLat] = useState(0.0);
  const [lng, setLng] = useState(0.0);
  const [sats, setSats] = useState(-1);

  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [heading, setHeading] = useState(45);
  const [accel, setAccel] = useState({ x: 0.0, y: 0.0, z: 1.0 });

  // Control Actuators State
  const [throttleLimit, setThrottleLimit] = useState(0);
  const [frontFinAngle, setFrontFinAngle] = useState(0); // Center is 0 (mapped to 97 later)
  const [rearFinX, setRearFinX] = useState(0);
  const [rearFinY, setRearFinY] = useState(0);
  const [ballastActive, setBallastActive] = useState(false);
  const [driveMode, setDriveMode] = useState("stopped"); // 'forward', 'reverse', 'stopped'
  const [keyHint, setKeyHint] = useState("Use ↑ ↓ ← → and Spacebar");
  const [lastCommand, setLastCommand] = useState("None");
  const [lastReceived, setLastReceived] = useState("None");

  // Connectivity State
  const [ipAddress, setIpAddress] = useState("10.76.18.98"); // Change to your ESP32's IP
  const [cameraUrl, setCameraUrl] = useState("http://10.73.115.219:8080/video"); // IP Webcam URL
  const [isUsbConnected, setIsUsbConnected] = useState(false);
  const [showUsbPortSelector, setShowUsbPortSelector] = useState(false);
  const [pairedPorts, setPairedPorts] = useState([]);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [modalIp, setModalIp] = useState("192.168.4.1");
  const [modalCameraUrl, setModalCameraUrl] = useState(
    "http://192.168.4.1:81/stream",
  );
  const [modalSsid, setModalSsid] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [scannedNetworks, setScannedNetworks] = useState([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);

  const openNetworkModal = () => {
    setModalIp(ipAddress);
    setModalCameraUrl(cameraUrl);
    setShowNetworkModal(true);
  };

  const saveNetworkModal = () => {
    setIpAddress(modalIp);
    setCameraUrl(modalCameraUrl);
    setShowNetworkModal(false);
  };

  const scanHostWifi = async () => {
    if (!window.electronAPI || !window.electronAPI.scanWifi) {
      alert("Native Wi-Fi scanning requires the Electron host.");
      return;
    }
    
    setIsScanningWifi(true);
    setScannedNetworks([]);
    try {
      const networks = await window.electronAPI.scanWifi();
      
      // Filter out duplicate SSIDs (node-wifi often returns multiple BSSIDs for the same SSID)
      const uniqueNetworks = [];
      const seenSsids = new Set();
      
      // Sort by signal_level (rssi-equivalent in node-wifi) descending
      networks.sort((a, b) => (b.signal_level || 0) - (a.signal_level || 0));
      
      for (const net of networks) {
        if (net.ssid && !seenSsids.has(net.ssid)) {
          seenSsids.add(net.ssid);
          uniqueNetworks.push({ ssid: net.ssid, rssi: net.signal_level });
        }
      }
      
      setScannedNetworks(uniqueNetworks);
      if (uniqueNetworks.length > 0 && !modalSsid) {
        setModalSsid(uniqueNetworks[0].ssid);
      }
    } catch (err) {
      console.error("Native Wi-Fi scan failed:", err);
      alert("Failed to scan for Wi-Fi networks natively.");
    } finally {
      setIsScanningWifi(false);
    }
  };

  const handleWifiProvisioning = () => {
    if (!modalSsid || !modalPassword) {
      alert("Please enter both SSID and Password");
      return;
    }
    const payload = `WIFI:${modalSsid}:${modalPassword}`;
    sendCommand("ESP32", payload);
  };

  // Refs for persistent connection state
  const serialWriterRef = useRef(null);
  const serialPortRef = useRef(null);

  // Helper to translate USB vendor/product IDs to user-friendly labels
  const getUsbDeviceName = (info) => {
    if (!info) return "Unknown Serial Port";
    const vid = info.usbVendorId;
    const pid = info.usbProductId;

    if (!vid) return "Standard Serial Port";

    let vendorName = `USB Device (VID: 0x${vid.toString(16).toUpperCase()})`;
    if (vid === 0x1a86) vendorName = "CH340 USB-to-Serial";
    else if (vid === 0x10c4) vendorName = "CP210x USB-to-UART";
    else if (vid === 0x0403) vendorName = "FTDI USB-to-Serial";
    else if (vid === 0x303a) vendorName = "Espressif ESP32 USB-Serial";
    else if (vid === 0x2341) vendorName = "Arduino USB Device";

    if (pid) {
      return `${vendorName} (PID: 0x${pid.toString(16).toUpperCase()})`;
    }
    return vendorName;
  };

  const disconnectUsb = async (intentional = false) => {
    try {
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
    } catch (err) {
      console.warn("Error closing port:", err);
    } finally {
      setIsUsbConnected(false);
      serialWriterRef.current = null;
      serialPortRef.current = null;
      setHasReceivedFirstDataVal(false); // Reset calibration state on disconnect

      // Stop all submarine movement for safety
      setDriveMode("stopped");
      setThrottleLimit(0);
      setFrontFinAngle(0);
      setRearFinX(0);
      setRearFinY(0);
      setKeyHint(
        intentional ? "SYSTEM STOPPED" : "CONNECTION LOST - RECONNECTING...",
      );

      if (!intentional && navigator.serial) {
        autoReconnectUsb();
      }
    }
  };

  const autoReconnectUsbRef = useRef(false);

  const autoReconnectUsb = async () => {
    if (autoReconnectUsbRef.current) return;
    autoReconnectUsbRef.current = true;

    console.log("Attempting auto-reconnect...");

    // Loop every 2 seconds until connected or user manually intervenes
    while (autoReconnectUsbRef.current) {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports && ports.length > 0) {
          const port = ports[0];
          await startPortConnection(port, true);
          console.log("Auto-reconnect successful!");
          autoReconnectUsbRef.current = false;
          setKeyHint("RECONNECTED SUCCESSFULLY");
          break; // Exit loop on success
        }
      } catch (err) {
        console.warn("Auto-reconnect attempt failed:", err);
      }

      // Wait 2 seconds before next attempt
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    autoReconnectUsbRef.current = false;
  };

  const startPortConnection = async (port, isAutoReconnect = false) => {
    try {
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;

      // Native USB ESP32 boards require DTR to be asserted to receive serial data
      // Some generic boards do not support this and will throw an error, so we catch and ignore it
      try {
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
      } catch (err) {
        console.warn("setSignals not supported on this port:", err.message);
      }

      // 1. Setup Writer (To send commands TO submarine)
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      serialWriterRef.current = writer;

      // 2. Setup Reader (To receive telemetry FROM submarine)
      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      setIsUsbConnected(true);
      setSignalStrength(100);

      // Close selector modal
      setShowUsbPortSelector(false);

      // 3. Background Listening Loop (Runs continuously while connected)
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break; // Port was closed

          buffer += value;
          const lines = buffer.split("\n");

          // Keep the last incomplete chunk in the buffer for the next loop
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            // Look for our temperature tags
            if (
              line.startsWith("Water Temp:") ||
              line.startsWith("TMP:") ||
              line.startsWith("TEMP OF THE MAIN BOARD:")
            ) {
              let tempStr = "";
              if (line.includes("TMP:")) tempStr = line.split("TMP:")[1];
              else if (line.includes("Water Temp:"))
                tempStr = line.split("Water Temp:")[1];
              else
                tempStr = line
                  .split("TEMP OF THE MAIN BOARD:")[1]
                  .replace(" °C", "");

              const parsedTemp = parseFloat(tempStr);
              if (!isNaN(parsedTemp)) {
                setTemp(parsedTemp); // Updates the React UI instantly
              }
            } else if (line.startsWith("ACK:")) {
              setLastReceived(line);
            } else if (line.startsWith("GPS: ")) {
              const gpsStr = line.replace("GPS: ", "").trim();
              if (gpsStr === "WIRING_ERROR") {
                setSats(-2); // Special code for wiring error
              } else {
                const parts = gpsStr.split(",");
                if (parts.length === 2) {
                  setLat(parseFloat(parts[0]));
                  setLng(parseFloat(parts[1]));
                }
              }
            } else if (line.startsWith("GPS_SAT: ")) {
              setSats(parseInt(line.replace("GPS_SAT: ", "").trim()));
            } else if (line.startsWith("IMU:")) {
              const imuStr = line.replace("IMU:", "").trim();
              const parts = imuStr.split(",");
              if (parts.length === 3) {
                const p = parseFloat(parts[0]);
                const r = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                if (!isNaN(p) && !isNaN(r) && !isNaN(y)) {
                  processIMU(r, p, y);
                }
              }
            } else if (line.startsWith("MPU9250 - Pitch:")) {
              const match = line.match(
                /MPU9250 - Pitch:\s*([\d\.-]+)°\s*\|\s*Roll:\s*([\d\.-]+)°\s*\|\s*Yaw:\s*([\d\.-]+)°(?:\s*\|\s*Accel\(g\):\s*([\d\.-]+),([\d\.-]+),([\d\.-]+))?/,
              );
              if (match) {
                const p = parseFloat(match[1]);
                const r = parseFloat(match[2]);
                const y = parseFloat(match[3]);
                if (!isNaN(p) && !isNaN(r) && !isNaN(y)) {
                  processIMU(r, p, y);
                }

                if (match[4] && match[5] && match[6]) {
                  const ax = parseFloat(match[4]);
                  const ay = parseFloat(match[5]);
                  const az = parseFloat(match[6]);
                  if (!isNaN(ax) && !isNaN(ay) && !isNaN(az)) {
                    setAccel({ x: ax, y: ay, z: az });
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Serial Read Disconnected or Error:", err);
      } finally {
        reader.releaseLock();
        disconnectUsb(false); // Unintentional disconnect triggers auto-reconnect
      }
    } catch (err) {
      console.error("USB Connect error:", err);
      if (!isAutoReconnect) {
        alert("USB Connection Failed: " + err.message);
      }
      throw err; // Re-throw so autoReconnectUsb loop knows it failed
    }
  };

  const connectUsb = async () => {
    if (isUsbConnected) {
      autoReconnectUsbRef.current = false; // Stop auto-reconnect if manually disconnecting
      await disconnectUsb(true);
      return;
    }

    try {
      if (!navigator.serial) {
        alert(
          "Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.",
        );
        return;
      }

      // Fetch previously paired ports
      const ports = await navigator.serial.getPorts();
      setPairedPorts(ports);
      setShowUsbPortSelector(true);
    } catch (err) {
      console.error("Error listing serial ports:", err);
      requestNewUsbPort();
    }
  };

  const requestNewUsbPort = async () => {
    try {
      const port = await navigator.serial.requestPort();
      await startPortConnection(port);
    } catch (err) {
      console.warn("User cancelled port selection:", err);
    }
  };

  // --- CORE API TRANSMISSION WRAPPER ---
  // Dual-routes to USB Serial OR WiFi Fetch based on connection status
  const sendCommand = async (endpoint, serialPayload) => {
    console.log(`[USB OUT] Target: ${endpoint} | Payload: ${serialPayload}`);
    setLastCommand(serialPayload);
    try {
      if (isUsbConnected && serialWriterRef.current) {
        await serialWriterRef.current.write(serialPayload + "\r\n");
      } else {
        await fetch(`http://${ipAddress}${endpoint}`, {
          mode: "no-cors",
          cache: "no-store",
        });
      }
      setSignalStrength(100);
    } catch (err) {
      setSignalStrength(0);
    }
  };

  // --- WIFI TELEMETRY & PING LOOP ---
  useEffect(() => {
    let tickCount = 0;
    const pingInterval = setInterval(() => {
      if (isUsbConnected) return; // If on USB, the reader loop handles everything. Do not ping WiFi.

      tickCount++;

      // 1. Fetch Real IMU Data (WiFi) every 1 second
      fetch(`http://${ipAddress}/imu`, { signal: AbortSignal.timeout(800) })
        .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then((data) => {
          if (data) {
            const p = parseFloat(data.pitch);
            const r = parseFloat(data.roll);
            const y = parseFloat(data.yaw);
            if (!isNaN(p) && !isNaN(r) && !isNaN(y)) {
              processIMU(r, p, y);
            }
          }
        })
        .catch((err) => console.warn("IMU Fetch Error (WiFi):", err.message));

      // 2. Ping and Temp every 2 seconds
      if (tickCount % 2 === 0) {
        // Ping the main route to check signal
        fetch(`http://${ipAddress}/`, { mode: "no-cors" })
          .then(() => setSignalStrength(100))
          .catch(() => setSignalStrength(0));

        // Fetch Real Temperature Data
        fetch(`http://${ipAddress}/temp`, { signal: AbortSignal.timeout(1500) })
          .then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.text();
          })
          .then((data) => {
            const parsedTemp = parseFloat(data);
            if (!isNaN(parsedTemp)) {
              setTemp(parsedTemp);
            }
          })
          .catch((err) =>
            console.warn("Temp Fetch Error (WiFi):", err.message),
          );
      }
    }, 1000);
    return () => clearInterval(pingInterval);
  }, [isUsbConnected, ipAddress]);

  // --- KEYBOARD CONTROLLER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore text input fields, but allow range sliders
      if (["TEXTAREA"].includes(e.target.tagName)) return;
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;

      switch (e.key.toLowerCase()) {
        case "w":
          e.preventDefault();
          setDriveMode("forward");
          setThrottleLimit((prev) => Math.min(Number(prev) + 2, 100));
          setKeyHint("Moving Forward (Speed Up)");
          break;
        case "s":
          e.preventDefault();
          setThrottleLimit((prev) => {
            const newLimit = Math.max(Number(prev) - 2, 0);
            if (newLimit === 0) setDriveMode("stopped");
            return newLimit;
          });
          setKeyHint("Moving Forward (Speed Down)");
          break;
        case "a":
          e.preventDefault();
          setFrontFinAngle((prev) => Math.max(Number(prev) - 10, -30));
          setRearFinX((prev) => Math.min(Number(prev) + 10, 30));
          setKeyHint("Steering Left");
          break;
        case "d":
          e.preventDefault();
          setFrontFinAngle((prev) => Math.min(Number(prev) + 10, 30));
          setRearFinX((prev) => Math.max(Number(prev) - 10, -30));
          setKeyHint("Steering Right");
          break;
        case "arrowup":
          e.preventDefault();
          setRearFinY((prev) => Math.min(Number(prev) + 5, 45));
          setKeyHint("Empennage Pitch Up");
          break;
        case "arrowdown":
          e.preventDefault();
          setRearFinY((prev) => Math.max(Number(prev) - 5, -45));
          setKeyHint("Empennage Pitch Down");
          break;
        case "arrowleft":
          e.preventDefault();
          setRearFinX((prev) => Math.max(Number(prev) - 5, -45));
          setKeyHint("Empennage Yaw Left");
          break;
        case "arrowright":
          e.preventDefault();
          setRearFinX((prev) => Math.min(Number(prev) + 5, 45));
          setKeyHint("Empennage Yaw Right");
          break;
        case " ": // Spacebar
          e.preventDefault();
          setDriveMode("stopped");
          setThrottleLimit(0);
          setFrontFinAngle(0);
          setRearFinX(0);
          setRearFinY(0);
          setKeyHint("SYSTEM STOPPED");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- ACTUATOR TRANSMITTERS ---

  // Drive Mode (Forward / Stop / Reverse)
  useEffect(() => {
    let serialStr = "STOP";
    if (driveMode === "forward") serialStr = "DIR:FWD";
    else if (driveMode === "reverse") serialStr = "DIR:REV";
    sendCommand(`/action?dir=${driveMode}`, serialStr);
  }, [driveMode]);

  // Speed (PWM ranges 0-255)
  useEffect(() => {
    if (driveMode === "stopped") return;
    const speedPWM = Math.round((throttleLimit / 100) * 255);
    const timer = setTimeout(() => {
      sendCommand(`/speed?val=${speedPWM}`, `SPD:${speedPWM}`);
    }, 50); // 50ms debounce
    return () => clearTimeout(timer);
  }, [throttleLimit, driveMode]);

  // Front Fin (Bow Planes)
  useEffect(() => {
    const angle = 97 + frontFinAngle;
    const timer = setTimeout(() => {
      sendCommand(`/servo?target=front&val=${angle}`, `F_SRV:${angle}`);
    }, 50); // 50ms debounce
    return () => clearTimeout(timer);
  }, [frontFinAngle]);

  // Back Fin (Rudder)
  useEffect(() => {
    const angle = 97 + rearFinX;
    const timer = setTimeout(() => {
      sendCommand(`/servo?target=back&val=${angle}`, `B_SRV:${angle}`);
    }, 50); // 50ms debounce
    return () => clearTimeout(timer);
  }, [rearFinX]);

  // --- UI SIMULATION EFFECT (Adds "life" to the dashboard) ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Only animate IMU noise when device is connected
      if (isUsbConnected) {
        setSignalStrength((prev) =>
          Math.min(100, Math.max(0, prev + (Math.random() - 0.5) * 5)),
        );
        if (!isCalibrating) {
          setHeading((prev) => (prev + (Math.random() - 0.5) * 2) % 360);
          setPitch((prev) => prev + (Math.random() - 0.5) * 1);
          setRoll((prev) => prev + (Math.random() - 0.5) * 1);
        }
        setDepth((prev) => Math.max(0, prev + (Math.random() - 0.5) * 0.1));
      }

      let targetRpm =
        driveMode === "stopped" ? 0 : Math.max(0, throttleLimit * 210);
      let targetSpeed =
        driveMode === "stopped" ? 0 : (throttleLimit / 100) * 7.5;
      let targetAmps = driveMode === "stopped" ? 0 : (throttleLimit / 100) * 12;

      setRpm(
        (prev) =>
          prev +
          (targetRpm - prev) * 0.2 +
          (driveMode !== "stopped" ? (Math.random() - 0.5) * 50 : 0),
      );
      setAmps(
        (prev) =>
          prev + (targetAmps - prev) * 0.2 + (Math.random() - 0.5) * 0.5,
      );
      setSpeedKnots(
        (prev) =>
          prev + (targetSpeed - prev) * 0.1 + (Math.random() - 0.5) * 0.2,
      );

      // Slowly drain battery
      setBatteryVolt((prev) => Math.max(9.0, prev - 0.001));
    }, 1000);

    return () => clearInterval(interval);
  }, [throttleLimit, driveMode, isCalibrating, isUsbConnected]);

  // Derive battery percentage from voltage (12.6V = 100%, 10.5V = 0%)
  const batteryPct = Math.round(
    Math.max(0, Math.min(100, ((batteryVolt - 10.5) / (12.6 - 10.5)) * 100)),
  );

  // Dev tools to manually trigger warnings for testing
  const toggleLeak = () => setIsLeaking(!isLeaking);
  const spikeAmps = () => setAmps(16);
  const diveDeep = () => setDepth(12);

  return (
    <div className="flex flex-col flex-1 w-full lg:overflow-hidden overflow-y-auto relative bg-transparent">
      <TopNavBar
        signalStrength={signalStrength}
        batteryVolt={batteryVolt}
        batteryPct={batteryPct}
        isLeaking={isLeaking}
        isUsbConnected={isUsbConnected}
        connectUsb={connectUsb}
        calibrateGyro={startCalibration}
        onOpenNetworkSettings={openNetworkModal}
      />

      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden min-h-0 w-full">
        {/* <TelemetryPanel
            depth={depth}
            amps={amps}
            rpm={rpm}
            temp={temp}
            lat={lat}
            lng={lng}
            sats={sats}
            pitch={pitch}
            roll={roll}
            heading={heading}
            accel={accel}
        /> */}

        <MainCenterView
          pitch={pitch}
          roll={roll}
          heading={heading}
          speedKnots={speedKnots}
          frontFinAngle={frontFinAngle}
          rearFinX={rearFinX}
          rearFinY={rearFinY}
          cameraUrl={cameraUrl}
          depth={depth}
          amps={amps}
          temp={temp}
          isConnected={isUsbConnected}
        />

        <ControlPanel
          throttleLimit={throttleLimit}
          setThrottleLimit={setThrottleLimit}
          frontFinAngle={frontFinAngle}
          setFrontFinAngle={setFrontFinAngle}
          rearFinX={rearFinX}
          setRearFinX={setRearFinX}
          rearFinY={rearFinY}
          setRearFinY={setRearFinY}
          ballastActive={ballastActive}
          setBallastActive={setBallastActive}
          driveMode={driveMode}
          setDriveMode={setDriveMode}
        />
      </div>

      {/* Dev Tools Overlay (for testing) */}
      {/* <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-cyan-950/60 backdrop-blur-md border border-cyan-800/50 text-xs rounded-full z-50 shadow-xl max-w-[90vw] overflow-x-auto whitespace-nowrap">
          <span className="px-2 py-1 text-cyan-200 font-bold uppercase tracking-widest hidden sm:block">Dev Test:</span>
          <button onClick={toggleLeak} className="bg-red-900 hover:bg-red-700 px-3 py-1 rounded text-white font-bold transition">Toggle Leak</button>
          <button onClick={spikeAmps} className="bg-amber-900 hover:bg-amber-700 px-3 py-1 rounded text-white font-bold transition">Spike Amps</button>
          <button onClick={diveDeep} className="bg-blue-900 hover:bg-blue-700 px-3 py-1 rounded text-white font-bold transition">Dive &gt; 10m</button>
      </div> */}

      {/* Keyboard Hint Overlay
      <div className="fixed bottom-16 lg:bottom-4 left-1/2 lg:left-4 -translate-x-1/2 lg:translate-x-0 flex flex-col gap-1 p-3 bg-cyan-950/60 backdrop-blur-md border border-cyan-800/50 text-sm text-cyan-100 font-mono rounded-lg z-50 shadow-xl opacity-90 pointer-events-none text-center lg:text-left">
          <span>{keyHint}</span>
          <span className="text-xs text-cyan-300">USB SENT: {lastCommand}</span>
          <span className="text-xs text-emerald-300">USB RECV: {lastReceived}</span>
      </div> */}

      {/* IMU Calibration Modal Overlay */}
      {isCalibrating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white select-none">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-2xl flex flex-col items-center justify-center max-w-sm w-full shadow-2xl text-center gap-4 ring-1 ring-white/10">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-t-white border-r-white/20 border-b-white/20 border-l-white animate-spin"></div>
              <span className="text-xl font-bold font-mono text-white z-10">
                {calibrationDataRef.current.count}/10
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold font-mono tracking-widest text-white uppercase animate-pulse">
                IMU Calibration
              </h3>
              <p className="text-xs text-white/80">
                Hold submarine level in the flat 0° reference position.
              </p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 p-3 rounded font-mono text-xs text-left text-white/80 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span>RAW PITCH:</span>
                <span className="text-white font-bold">
                  {pitch > 0 ? "+" : ""}
                  {pitch.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>RAW ROLL:</span>
                <span className="text-white font-bold">
                  {roll > 0 ? "+" : ""}
                  {roll.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>RAW YAW:</span>
                <span className="text-white font-bold">
                  {heading.toFixed(0)}°
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USB Port Selection Dialog Modal */}
      {showUsbPortSelector && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center text-white select-none">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-2xl flex flex-col max-w-md w-full shadow-2xl gap-4 ring-1 ring-white/10 mx-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold font-mono tracking-widest text-white uppercase">
                Select USB Serial Port
              </h3>
              <p className="text-xs text-white/80">
                Choose a previously approved device or authorize a new one.
              </p>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {pairedPorts.length > 0 ? (
                pairedPorts.map((port, idx) => {
                  const info = port.getInfo();
                  const name = getUsbDeviceName(info);
                  return (
                    <button
                      key={idx}
                      onClick={() => startPortConnection(port)}
                      className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/40 p-2.5 rounded font-mono text-xs transition flex justify-between items-center group"
                    >
                      <span className="truncate pr-2 group-hover:text-white">
                        {name}
                      </span>
                      <span className="text-[10px] text-white font-bold bg-white/20 border border-white/30 px-1.5 py-0.5 rounded shrink-0">
                        CONNECT
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-white/70 border border-dashed border-white/10 rounded font-mono">
                  No previously authorized USB ports found.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <button
                onClick={requestNewUsbPort}
                className="flex-1 bg-white hover:bg-white/90 text-black font-bold py-2 px-3 rounded text-xs transition font-mono uppercase tracking-wider"
              >
                Pair New Device...
              </button>
              <button
                onClick={() => setShowUsbPortSelector(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3 rounded text-xs transition font-mono uppercase tracking-wider border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network Configuration Modal Overlay */}
      {showNetworkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center text-white select-none">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-2xl flex flex-col max-w-md w-full shadow-2xl gap-4 ring-1 ring-white/10 mx-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold font-mono tracking-widest text-white uppercase border-b border-white/20 pb-2 flex items-center gap-2">
                NETWORK CONFIG
              </h3>
              <p className="text-[11px] text-white/80 mt-1">
                Configure ESP32 controller connection and video source stream
                links.
              </p>
            </div>

            <div className="flex flex-col gap-3 font-mono text-xs text-left">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                  ESP32 IP Address
                </label>
                <input
                  type="text"
                  value={modalIp}
                  onChange={(e) => setModalIp(e.target.value)}
                  className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                  placeholder="192.168.x.x"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                  Camera Stream URL
                </label>
                <input
                  type="text"
                  value={modalCameraUrl}
                  onChange={(e) => setModalCameraUrl(e.target.value)}
                  className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                  placeholder="http://192.168.x.x:8080/video"
                />
              </div>

              <div className="border-t border-white/10 my-1 pt-3">
                <h4 className="text-[10px] text-white/80 font-bold uppercase tracking-wider mb-2">
                  Wi-Fi Provisioning (Over USB)
                </h4>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {scannedNetworks.length > 0 ? (
                      <select
                        value={modalSsid}
                        onChange={(e) => setModalSsid(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                      >
                        {scannedNetworks.map((net, idx) => (
                          <option
                            key={idx}
                            value={net.ssid}
                            className="bg-zinc-900 text-white"
                          >
                            {net.ssid} ({net.rssi}dBm)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={modalSsid}
                        onChange={(e) => setModalSsid(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                        placeholder="SSID (Network Name)"
                      />
                    )}
                    <button
                      onClick={scanHostWifi}
                      disabled={isScanningWifi}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded text-xs font-bold uppercase transition-colors disabled:opacity-50"
                    >
                      {isScanningWifi ? "..." : "Scan Networks"}
                    </button>
                  </div>
                  <input
                    type="password"
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                    placeholder="Password"
                  />
                  <button
                    onClick={handleWifiProvisioning}
                    className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-mono font-bold py-2 rounded text-xs transition uppercase tracking-wider mt-1"
                  >
                    Connect ESP32
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <button
                onClick={saveNetworkModal}
                className="flex-1 bg-white text-black hover:bg-white/90 font-mono font-bold py-2 px-3 rounded text-xs transition uppercase tracking-wider"
              >
                Save Config
              </button>
              <button
                onClick={() => setShowNetworkModal(false)}
                className="flex-1 bg-transparent border border-white/20 text-white hover:bg-white/10 font-mono font-bold py-2 px-3 rounded text-xs transition uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Available Modal Overlay */}
      {updateAvailable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center text-white select-none">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-2xl flex flex-col max-w-sm w-full shadow-2xl text-center gap-4 ring-1 ring-white/10 mx-4">
            <div className="relative w-16 h-16 flex items-center justify-center mx-auto bg-white/5 rounded-full border border-white/20">
              <Download size={28} className="text-white animate-bounce" />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold font-mono tracking-widest text-white uppercase border-b border-white/10 pb-2">
                UPDATE AVAILABLE
              </h3>
              <p className="text-xs text-white/80 mt-2">
                A new version of ToriController is available.
              </p>
              <div className="flex justify-center gap-4 text-[11px] font-mono mt-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded">
                <span>
                  CURRENT: <span className="font-bold">v2.0.1</span>
                </span>
                <span className="text-white/40">|</span>
                <span>
                  LATEST: <span className="font-bold">{latestVersion}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(releaseUrl);
                  } else {
                    window.open(releaseUrl, "_blank");
                  }
                  setUpdateAvailable(false);
                }}
                className="w-full bg-white text-black hover:bg-white/90 font-mono font-bold py-2.5 px-3 rounded text-xs transition uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <Download size={14} /> Download Update
              </button>
              <button
                onClick={() => setUpdateAvailable(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-mono font-bold py-2 px-3 rounded text-xs transition uppercase tracking-wider border border-white/10"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmarineDashboard;
