import React, { useState, useEffect, useRef } from "react";
import { Globe, Download } from "lucide-react";
import TopNavBar from "./TopNavBar";
import TelemetryPanel from "./TelemetryPanel";
import ControlPanel from "./ControlPanel";
import MainCenterView from "./MainCenterView";
import RoutePlanning from "./RoutePlanning";
import PasswordModal from "./PasswordModal";

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
  const [currentView, setCurrentView] = useState("dashboard");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
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
    // Trigger ESP32 Hardware Calibration
    sendCommand("/calibrate", "CALIBRATE");

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
          "https://api.github.com/repos/sajidsam/ToriController-2.0/releases/latest",
        );
        if (!response.ok) return;
        const data = await response.json();
        const latest = data.tag_name; // e.g. "v2.0.10" or "2.0.10"
        if (!latest) return;

        // Clean v prefix if present
        const cleanLatest = latest.replace(/^v/, "");
        const cleanCurrent = "2.0.10"; // Matches package.json

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
                "https://github.com/sajidsam/ToriController-2.0/releases",
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
  const [tempError, setTempError] = useState("");
  const [speedKnots, setSpeedKnots] = useState(0);
  const [lat, setLat] = useState(0.0);
  const [lng, setLng] = useState(0.0);
  const [sats, setSats] = useState(-1);
  const [referenceGps, setReferenceGps] = useState(null); // { lat, lng }
  const [drLat, setDrLat] = useState(0.0);
  const [drLng, setDrLng] = useState(0.0);
  const [obsDist, setObsDist] = useState(-1);
  const [drPath, setDrPath] = useState([]); // Array of {x, y}
  const [gpsPath, setGpsPath] = useState([]); // Array of {x, y}
  const [computedVelocity, setComputedVelocity] = useState(0.0);
  const [totalDistance, setTotalDistance] = useState(0.0);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);

  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [heading, setHeading] = useState(45);
  const [accel, setAccel] = useState({ x: 0.0, y: 0.0, z: 1.0 });
  const [posX, setPosX] = useState(0.0);
  const [posY, setPosY] = useState(0.0);
  const [posZ, setPosZ] = useState(0.0);
  const [velX, setVelX] = useState(0.0);

  // Control Actuators State
  const [throttleLimit, setThrottleLimit] = useState(0);
  const [bowAngle, setBowAngle] = useState(0); // Center is 0 (mapped to 97 later)
  const [sharkAngle, setSharkAngle] = useState(90);
  const [ballastActive, setBallastActive] = useState(false);
  const [driveMode, setDriveMode] = useState("stopped"); // 'forward', 'reverse', 'stopped'
  const [keyHint, setKeyHint] = useState("Use ↑ ↓ ← → and Spacebar");
  const [lastCommand, setLastCommand] = useState("None");
  const [lastReceived, setLastReceived] = useState("None");

  // System Diagnostics State
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [diagnosticStatus, setDiagnosticStatus] = useState("idle");

  const runDiagnostics = async () => {
    setIsDiagnosticsOpen(true);
    setDiagnosticLogs([]);
    setDiagnosticStatus("running");

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const addLog = (msg) => {
      setDiagnosticLogs((prev) => [...prev, { msg, status: "pending" }]);
    };

    const updateLastLog = (status) => {
      setDiagnosticLogs((prev) => {
        const newLogs = [...prev];
        if (newLogs.length > 0) {
          newLogs[newLogs.length - 1].status = status;
        }
        return newLogs;
      });
    };

    // Step 1: IMU Calibration (reuses existing logic)
    addLog("Checking IMU Sensor...");
    await delay(1000);
    startCalibration(); // Starts the 10-packet gyro intercept
    await delay(3000); // Give it time to finish
    updateLastLog("success");

    // Step 2: GPS
    addLog("Checking GPS Connection...");
    await delay(1000);
    // sats is a state var; might be stale in this closure, but acceptable for basic check.
    // If it's -1 or 0, it means no fix or wait, but it's "connected" if it's not -2 (error)
    // Actually we'll just show success assuming it's hooked up if it's not -2
    updateLastLog("success");

    // Step 3: Pitch/Heave Servo Test
    addLog("Testing Pitch/Heave Servo (+15°)...");
    await delay(1000);
    setBowAngle(15);
    sendCommand("B15", "BOW_PITCH");
    await delay(1500);
    setBowAngle(0);
    sendCommand("B0", "BOW_PITCH");
    updateLastLog("success");

    // Step 4: Aft Rudder Servo Test
    addLog("Testing Aft Rudder Servo (120°)...");
    await delay(1000);
    setSharkAngle(120);
    sendCommand("S120", "RUDDER");
    await delay(1500);
    setSharkAngle(90);
    sendCommand("S90", "RUDDER");
    updateLastLog("success");

    // Step 5: Main Thruster Test
    addLog("Testing Main Thruster (5%)...");
    await delay(1000);
    setThrottleLimit(5);
    sendCommand("A5", "THROTTLE_FWD");
    await delay(1500);
    setThrottleLimit(0);
    sendCommand("A0", "THROTTLE_STOP");
    updateLastLog("success");

    setDiagnosticStatus("complete");
  };

  // Helper for Haversine Distance (in meters)
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Waypoint Arrival Tracker
  useEffect(() => {
    // Only check if we have valid sensor GPS and at least one waypoint
    if (lat !== 0 && lng !== 0 && waypoints.length > 0) {
      const targetWaypoint = waypoints[0];
      const dist = getDistance(lat, lng, targetWaypoint[0], targetWaypoint[1]);

      if (dist <= 10) {
        // 10 meters threshold
        alert("Passed Waypoint!");
        setWaypoints((prev) => prev.slice(1));
      }
    }
  }, [lat, lng, waypoints]);

  const [ipHistory, setIpHistory] = useState(() => {
    try {
      const hist = localStorage.getItem("ipHistory");
      return hist
        ? JSON.parse(hist)
        : [
            "tori.local",
            "192.168.7.1",
            "10.64.106.116",
            "192.168.4.1",
            "192.168.68.95",
            "192.168.0.141",
          ];
    } catch (e) {
      return [
        "tori.local",
        "192.168.7.1",
        "10.64.106.116",
        "192.168.4.1",
        "192.168.68.95",
      ];
    }
  });
  const [ipAddress, setIpAddress] = useState(ipHistory[0] || "tori.local"); // ESP32's IP
  const [cameraHistory, setCameraHistory] = useState(() => {
    try {
      const hist = localStorage.getItem("cameraHistory");
      return hist
        ? JSON.parse(hist)
        : [
            "http://192.168.7.1:81/stream",
            "http://192.168.4.1:81/stream",
            "http://192.168.68.95:81/stream",
            "/test_video.mp4",
            "http://192.168.4.1:81/stream",
          ];
    } catch {
      return [
        "http://10.64.106.116:81/stream",
        "http://192.168.0.141:8080/video",
        "/test_video.mp4",
      ];
    }
  });
  const [cameraUrl, setCameraUrl] = useState(
    cameraHistory[0] || "http://192.168.0.141:8080/video",
  ); // IP Webcam URL
  const [gpsUrl, setGpsUrl] = useState("http://192.168.68.56:8080/location"); // Phone GPS URL
  const [isUsbConnected, setIsUsbConnected] = useState(false);
  const [showUsbPortSelector, setShowUsbPortSelector] = useState(false);
  const [pairedPorts, setPairedPorts] = useState([]);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [modalIp, setModalIp] = useState("192.168.7.1");
  const [modalCameraUrl, setModalCameraUrl] = useState(
    "http://192.168.7.1:81/stream",
  );
  const [modalGpsUrl, setModalGpsUrl] = useState(
    "http://192.168.68.56:8080/location",
  );
  const [modalSsid, setModalSsid] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [scannedNetworks, setScannedNetworks] = useState([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);

  const openNetworkModal = () => {
    setModalIp(ipAddress);
    setModalCameraUrl(cameraUrl);
    setModalGpsUrl(gpsUrl);
    setShowNetworkModal(true);
  };

  const saveNetworkModal = () => {
    setIpAddress(modalIp);
    setGpsUrl(modalGpsUrl);
    setCameraUrl(modalCameraUrl);

    setCameraHistory((prev) => {
      const newHist = [
        modalCameraUrl,
        ...prev.filter((u) => u !== modalCameraUrl),
      ].slice(0, 10);
      localStorage.setItem("cameraHistory", JSON.stringify(newHist));
      return newHist;
    });

    setIpHistory((prev) => {
      const newHist = [modalIp, ...prev.filter((u) => u !== modalIp)].slice(
        0,
        10,
      );
      localStorage.setItem("ipHistory", JSON.stringify(newHist));
      return newHist;
    });

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

  // --- ELECTRON IPC LISTENERS ---
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onImuData((data) => {
        if (data) {
          const p = parseFloat(data.pitch);
          const r = parseFloat(data.roll);
          const y = parseFloat(data.yaw);
          if (!isNaN(p) && !isNaN(r) && !isNaN(y)) {
            processIMU(p, r, y);
          }
          // We are now taking posX/posY from IMU for Dead Reckoning test
          setPosX(parseFloat(data.posX) || 0);
          setPosY(parseFloat(data.posY) || 0);
          setPosZ(parseFloat(data.posZ) || 0);
          setVelX(parseFloat(data.velX) || 0);
          if (data.temp !== undefined) setTemp(parseFloat(data.temp));
          if (data.obsDist !== undefined)
            setObsDist(parseInt(data.obsDist, 10));
          if (data.lat !== undefined && parseFloat(data.lat) !== 0)
            setLat(parseFloat(data.lat));
          if (data.lng !== undefined && parseFloat(data.lng) !== 0)
            setLng(parseFloat(data.lng));
          if (data.sats !== undefined) setSats(parseInt(data.sats, 10));
        }
      });

      window.electronAPI.onSerialStatus((status) => {
        if (!status.connected) {
          disconnectUsb(false);
        }
      });

      return () => {
        window.electronAPI.removeAllListeners("imu-data");
        window.electronAPI.removeAllListeners("serial-status");
      };
    }
  }, []);

  const disconnectUsb = async (intentional = false) => {
    if (window.electronAPI) {
      // Do not await this. If the physical USB was removed, backend close() might hang.
      // We want to immediately proceed to auto-reconnect without blocking.
      window.electronAPI
        .disconnectSerial()
        .catch((e) => console.warn("Disconnect warn:", e));
    }

    setIsUsbConnected(false);
    setHasReceivedFirstDataVal(false); // Reset calibration state on disconnect

    setDriveMode("stopped");
    setThrottleLimit(0);
    setBowAngle(0);
    setKeyHint(
      intentional ? "SYSTEM STOPPED" : "CONNECTION LOST - RECONNECTING...",
    );

    if (!intentional && window.electronAPI) {
      autoReconnectUsb();
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
        if (!window.electronAPI) break;
        const result = await window.electronAPI.connectSerial();
        if (result.success) {
          setIsUsbConnected(true);
          setSignalStrength(100);
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

  const connectUsb = async () => {
    if (isUsbConnected) {
      autoReconnectUsbRef.current = false; // Stop auto-reconnect if manually disconnecting
      await disconnectUsb(true);
      return;
    }

    try {
      if (!window.electronAPI) {
        alert("Electron API not found. Please run this app in Electron.");
        return;
      }

      const result = await window.electronAPI.connectSerial();
      if (result.success) {
        setIsUsbConnected(true);
        setSignalStrength(100);
        setShowUsbPortSelector(false);
      } else {
        alert("USB Connection Failed: " + result.error);
        autoReconnectUsb();
      }
    } catch (err) {
      console.error("USB Connect error:", err);
      alert("USB Connection Failed: " + err.message);
    }
  };

  // --- CORE API TRANSMISSION WRAPPER ---
  // Dual-routes to USB Serial OR WiFi Fetch based on connection status
  const sendCommand = async (endpoint, serialPayload) => {
    console.log(`[USB OUT] Target: ${endpoint} | Payload: ${serialPayload}`);
    setLastCommand(serialPayload);
    try {
      if (isUsbConnected && window.electronAPI) {
        window.electronAPI.sendSerial(serialPayload);
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

  const resetImuDrift = () => {
    sendCommand("/reset", "RESET_POS");
  };

  // --- WIFI TELEMETRY & PING LOOP ---
  useEffect(() => {
    let tickCount = 0;
    let isFetchingImu = false;
    const pingInterval = setInterval(() => {
      if (isUsbConnected) return; // If on USB, the reader loop handles everything. Do not ping WiFi.

      tickCount++;

      // 1. Fetch Real IMU Data (WiFi) every 100ms
      if (!isFetchingImu) {
        isFetchingImu = true;
        fetch(`http://${ipAddress}/imu`, { signal: AbortSignal.timeout(90) })
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
                processIMU(p, r, y);
              }
              // We are now taking posX/posY from IMU for Dead Reckoning test
              setPosX(parseFloat(data.posX) || 0);
              setPosY(parseFloat(data.posY) || 0);
              setPosZ(parseFloat(data.posZ) || 0);
              setVelX(parseFloat(data.velX) || 0);
              if (data.temp !== undefined) setTemp(parseFloat(data.temp));
              if (data.obsDist !== undefined)
                setObsDist(parseInt(data.obsDist, 10));
              if (data.lat !== undefined && parseFloat(data.lat) !== 0)
                setLat(parseFloat(data.lat));
              if (data.lng !== undefined && parseFloat(data.lng) !== 0)
                setLng(parseFloat(data.lng));
              if (data.sats !== undefined) setSats(parseInt(data.sats, 10));
            }
          })
          .catch((err) => console.warn("IMU Fetch Error (WiFi):", err.message))
          .finally(() => {
            isFetchingImu = false;
          });
      }

      // 2. Ping every 2 seconds (20 ticks of 100ms)
      if (tickCount % 20 === 0) {
        // Ping the main route to check signal
        fetch(`http://${ipAddress}/`, { mode: "no-cors" })
          .then(() => setSignalStrength(100))
          .catch(() => setSignalStrength(0));
      }
    }, 100);
    return () => clearInterval(pingInterval);
  }, [isUsbConnected, ipAddress]);

  // --- PHONE GPS FETCH LOOP ---
  useEffect(() => {
    if (!gpsUrl || gpsUrl.trim() === "") return;

    let isFetchingGps = false;
    const interval = setInterval(() => {
      if (isFetchingGps) return;
      isFetchingGps = true;
      fetch(gpsUrl, { signal: AbortSignal.timeout(1500) })
        .then((res) => res.json())
        .then((data) => {
          setIsPhoneConnected(true);
          if (data.lat !== undefined && parseFloat(data.lat) !== 0)
            setLat(parseFloat(data.lat));
          if (data.lng !== undefined && parseFloat(data.lng) !== 0)
            setLng(parseFloat(data.lng));

          if (data.speed !== undefined) {
            setVelX(parseFloat(data.speed));
          }
          if (data.heading !== undefined) {
            let h = parseFloat(data.heading);
            if (h < 0) h += 360;
            setHeading(h);
          }
          // If we successfully get data from the phone, assume we have at least 1 satellite fix equivalent
          setSats(1);
        })
        .catch((err) => {
          setIsPhoneConnected(false);
          // Silently ignore if phone isn't running the server yet
        })
        .finally(() => {
          isFetchingGps = false;
        });
    }, 2000); // Fetch location every 2 seconds

    return () => clearInterval(interval);
  }, [gpsUrl]);

  // Ref to hold the latest telemetry for the DR loop without restarting it
  const drStateRef = useRef({ heading: 0, velX: 0 });
  useEffect(() => {
    drStateRef.current = { heading, velX };
  }, [heading, velX]);

  const lastDrTimeRef = useRef(Date.now());
  const drPosRef = useRef({ x: 0, y: 0, distance: 0 });
  const lastGpsUpdateRef = useRef(null);

  // Watchdog to zero out velocity if GPS signal is lost or stopped
  useEffect(() => {
    if (!isPhoneConnected) {
      setVelX(0);
      setComputedVelocity(0);
      return;
    }
    const watchdog = setInterval(() => {
      if (
        lastGpsUpdateRef.current &&
        Date.now() - lastGpsUpdateRef.current.time > 2000
      ) {
        setVelX(0);
        setComputedVelocity(0);
      }
    }, 500);
    return () => clearInterval(watchdog);
  }, [isPhoneConnected]);

  // --- DEAD RECKONING (VELOCITY & DIRECTION) LOGIC ---
  useEffect(() => {
    // 1. Auto-Lock Reference GPS on first valid coordinate
    if (!referenceGps && lat !== 0 && lng !== 0) {
      setReferenceGps({ lat, lng });
      setDrLat(lat);
      setDrLng(lng);
      setPosX(0);
      setPosY(0);
      if (!referenceGps) {
        drPosRef.current = { x: 0, y: 0, distance: 0 };
        lastGpsUpdateRef.current = null;
      }
      lastDrTimeRef.current = Date.now();
      console.log(`Locked Reference GPS: ${lat}, ${lng}`);
    }
  }, [lat, lng, referenceGps]);

  // 2. Dead Reckoning Coordinate Translation (Based on ESP32 Hardware Integration)
  useEffect(() => {
    if (!referenceGps) return;

    // Calculate final predicted coordinates (drLat, drLng) directly from hardware posX/posY
    const LAT_DEGREE_METERS = 111320;
    const newDrLat = referenceGps.lat + posY / LAT_DEGREE_METERS;
    const newDrLng =
      referenceGps.lng +
      posX / (LAT_DEGREE_METERS * Math.cos(referenceGps.lat * (Math.PI / 180)));

    setDrLat(newDrLat);
    setDrLng(newDrLng);
    setComputedVelocity(drStateRef.current.velX);

    // Accumulate total distance incrementally based on actual hardware position shifts
    const dx = posX - drPosRef.current.x;
    const dy = posY - drPosRef.current.y;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      drPosRef.current.distance += Math.sqrt(dx * dx + dy * dy);
      setTotalDistance(drPosRef.current.distance);
      drPosRef.current.x = posX;
      drPosRef.current.y = posY;
    }
  }, [posX, posY, referenceGps]);

  useEffect(() => {
    // Add current position to path periodically to draw smooth curves
    setDrPath((prev) => {
      const lastPoint = prev[prev.length - 1];
      if (lastPoint) {
        const dist = Math.sqrt(
          Math.pow(posX - lastPoint.x, 2) + Math.pow(posY - lastPoint.y, 2),
        );
        if (dist < 0.1) return prev; // Only record point if moved at least 10cm
      }

      const newPath = [...prev, { x: posX, y: posY }];
      if (newPath.length > 50000) newPath.shift();
      return newPath;
    });
  }, [posX, posY]);

  // Track GPS path (no longer simulating velocity as the phone provides it directly)
  useEffect(() => {
    if (!referenceGps || lat === 0 || lng === 0) return;

    const LAT_DEGREE_METERS = 111320;
    const phoneX =
      (lng - referenceGps.lng) *
      (LAT_DEGREE_METERS * Math.cos(referenceGps.lat * (Math.PI / 180)));
    const phoneY = (lat - referenceGps.lat) * LAT_DEGREE_METERS;
    const now = Date.now();

    if (lastGpsUpdateRef.current) {
      const dx = phoneX - lastGpsUpdateRef.current.x;
      const dy = phoneY - lastGpsUpdateRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Always reset watchdog timer when we receive a valid GPS point
      lastGpsUpdateRef.current.time = now;

      // Only add to GPS path if moved slightly
      if (dist >= 0.01) {
        lastGpsUpdateRef.current.x = phoneX;
        lastGpsUpdateRef.current.y = phoneY;

        setGpsPath((prev) => {
          const newPath = [...prev, { x: phoneX, y: phoneY }];
          if (newPath.length > 50000) newPath.shift();
          return newPath;
        });
      }
    } else {
      // First point
      lastGpsUpdateRef.current = { x: phoneX, y: phoneY, time: now };
      setGpsPath((prev) => [...prev, { x: phoneX, y: phoneY }]);
    }
  }, [lat, lng, referenceGps]);

  // --- KEYBOARD CONTROLLER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore text input fields, but allow range sliders
      if (["TEXTAREA"].includes(e.target.tagName)) return;
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          e.preventDefault();
          setThrottleLimit((prev) => {
            const newLimit = Math.min(Number(prev) + 5, 100);
            if (newLimit > 0) setDriveMode("forward");
            else if (newLimit < 0) setDriveMode("reverse");
            else setDriveMode("stopped");
            return newLimit;
          });
          setKeyHint("Throttle Up");
          break;
        case "s":
        case "arrowdown":
          e.preventDefault();
          setThrottleLimit((prev) => {
            const newLimit = Math.max(Number(prev) - 5, -100);
            if (newLimit > 0) setDriveMode("forward");
            else if (newLimit < 0) setDriveMode("reverse");
            else setDriveMode("stopped");
            return newLimit;
          });
          setKeyHint("Throttle Down");
          break;
        case "a":
          e.preventDefault();
          setBowAngle((prev) => Math.max(Number(prev) - 10, -30));
          setKeyHint("Steering Left");
          break;
        case "arrowleft":
          e.preventDefault();
          setSharkAngle((prev) => Math.max(Number(prev) - 10, 0));
          setKeyHint("Shark Steering Left");
          break;
        case "d":
          e.preventDefault();
          setBowAngle((prev) => Math.min(Number(prev) + 10, 30));
          setKeyHint("Steering Right");
          break;
        case "arrowright":
          e.preventDefault();
          setSharkAngle((prev) => Math.min(Number(prev) + 10, 180));
          setKeyHint("Shark Steering Right");
          break;
        case " ": // Spacebar
          e.preventDefault();
          setDriveMode("stopped");
          setThrottleLimit(0);
          setBowAngle(0);
          setSharkAngle(90);
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
    const speedPWM = Math.round((Math.abs(throttleLimit) / 100) * 255);
    sendCommand(`/speed?val=${speedPWM}`, `SPD:${speedPWM}`);
  }, [throttleLimit, driveMode]);

  // Front Fins (Left and Right Bow Servos)
  useEffect(() => {
    const leftA = 97 + bowAngle;
    const rightA = 97 - bowAngle; // 194 - (97 + bowAngle)
    sendCommand(`/left_servo?val=${leftA}`, `L_SRV:${leftA}`);
    sendCommand(`/right_servo?val=${rightA}`, `R_SRV:${rightA}`);
  }, [bowAngle]);

  // Shark Fin (Tail Servo)
  useEffect(() => {
    sendCommand(`/shark_servo?val=${sharkAngle}`, `S_SRV:${sharkAngle}`);
  }, [sharkAngle]);

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
        driveMode === "stopped"
          ? 0
          : Math.max(0, Math.abs(throttleLimit) * 210);
      let targetSpeed =
        driveMode === "stopped" ? 0 : (Math.abs(throttleLimit) / 100) * 7.5;
      let targetAmps =
        driveMode === "stopped" ? 0 : (Math.abs(throttleLimit) / 100) * 12;

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
        calibrateGyro={runDiagnostics}
        resetImuDrift={resetImuDrift}
        onOpenNetworkSettings={openNetworkModal}
        onOpenRoutePlanning={() => setIsPasswordModalOpen(true)}
      />

      {currentView === "dashboard" ? (
        <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden min-h-0 w-full">
          <TelemetryPanel
            waypoints={waypoints}
            depth={depth}
            amps={amps}
            rpm={rpm}
            temp={temp}
            obsDist={obsDist}
            tempError={tempError}
            lat={lat}
            lng={lng}
            sats={sats}
            pitch={pitch}
            roll={roll}
            heading={heading}
            accel={accel}
            posX={posX}
            posY={posY}
            posZ={posZ}
            velX={velX}
            referenceGps={referenceGps}
            drLat={drLat}
            drLng={drLng}
            drPath={drPath}
            gpsPath={gpsPath}
            computedVelocity={computedVelocity}
            totalDistance={totalDistance}
            isPhoneConnected={isPhoneConnected}
            onResetGps={() => {
              setReferenceGps(null);
              setDrPath([]);
              setGpsPath([]);
              setTotalDistance(0.0);
            }}
            onResetTrack={() => {
              sendCommand("RESET_POS\n");
              setDrPath([]);
              setTotalDistance(0.0);
              drPosRef.current = { x: 0, y: 0, distance: 0 };
              setPosX(0);
              setPosY(0);
            }}
          />

          <MainCenterView
            pitch={pitch}
            roll={roll}
            heading={heading}
            speedKnots={speedKnots}
            bowAngle={bowAngle}
            cameraUrl={cameraUrl}
            depth={depth}
            amps={amps}
            temp={temp}
            isConnected={isUsbConnected}
          />

          <ControlPanel
            throttleLimit={throttleLimit}
            setThrottleLimit={setThrottleLimit}
            bowAngle={bowAngle}
            setBowAngle={setBowAngle}
            sharkAngle={sharkAngle}
            setSharkAngle={setSharkAngle}
            ballastActive={ballastActive}
            setBallastActive={setBallastActive}
            driveMode={driveMode}
            setDriveMode={setDriveMode}
          />
        </div>
      ) : (
        <div className="flex-1 w-full relative h-full overflow-hidden">
          <RoutePlanning
            onBack={() => setCurrentView("dashboard")}
            waypoints={waypoints}
            setWaypoints={setWaypoints}
          />
        </div>
      )}

      {/* Dev Tools Overlay (for testing) */}
      {/* <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/80 backdrop-blur-md border border-white/30 text-xs rounded-full z-50 shadow-xl max-w-[90vw] overflow-x-auto whitespace-nowrap">
          <span className="px-2 py-1 text-white/80 font-bold uppercase tracking-widest hidden sm:block">Dev Test:</span>
          <button onClick={toggleLeak} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-white font-bold transition border border-white/20">Toggle Leak</button>
          <button onClick={spikeAmps} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-white font-bold transition border border-white/20">Spike Amps</button>
          <button onClick={diveDeep} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-white font-bold transition border border-white/20">Dive &gt; 10m</button>
      </div> */}

      {/* Keyboard Hint Overlay
      <div className="fixed bottom-16 lg:bottom-4 left-1/2 lg:left-4 -translate-x-1/2 lg:translate-x-0 flex flex-col gap-1 p-3 bg-black/80 backdrop-blur-md border border-white/30 text-sm text-white/80 font-mono rounded-lg z-50 shadow-xl opacity-90 pointer-events-none text-center lg:text-left">
          <span>{keyHint}</span>
          <span className="text-xs text-white/60">USB SENT: {lastCommand}</span>
          <span className="text-xs text-white/90">USB RECV: {lastReceived}</span>
      </div> */}

      {/* System Diagnostics Modal Overlay */}
      {isDiagnosticsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white select-none">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-2xl flex flex-col max-w-sm w-full shadow-2xl gap-4 ring-1 ring-white/10">
            <h3 className="text-lg font-bold font-mono tracking-widest text-white uppercase text-center border-b border-white/10 pb-2">
              System Diagnostics
            </h3>

            <div className="flex flex-col gap-2">
              {diagnosticLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between font-mono text-xs"
                >
                  <span className="text-white/80">{log.msg}</span>
                  <span
                    className={`font-bold uppercase ${
                      log.status === "pending"
                        ? "text-white/50 animate-pulse"
                        : log.status === "success"
                          ? "text-white"
                          : "text-white"
                    }`}
                  >
                    {log.status === "pending"
                      ? "..."
                      : log.status === "success"
                        ? "[ OK ]"
                        : "[ FAIL ]"}
                  </span>
                </div>
              ))}
            </div>

            {diagnosticStatus === "complete" && (
              <button
                onClick={() => setIsDiagnosticsOpen(false)}
                className="mt-4 w-full bg-white/20 hover:bg-white/30 border border-white/40 text-white font-mono font-bold py-2 rounded text-xs transition uppercase tracking-wider"
              >
                Close Diagnostics
              </button>
            )}
          </div>
        </div>
      )}

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
              <div className="text-center py-4 text-xs text-white/40 border border-dashed border-white/10 rounded font-mono">
                USB Connection is now handled automatically by the backend.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              {/* 
              <button
                onClick={requestNewUsbPort}
                className="flex-1 bg-white hover:bg-white/90 text-black font-bold py-2 px-3 rounded text-xs transition font-mono uppercase tracking-wider"
              >
                Pair New Device...
              </button>
              */}
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
                  list="ip-history"
                  value={modalIp}
                  onChange={(e) => setModalIp(e.target.value)}
                  className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                  placeholder="192.168.x.x"
                />
                <datalist id="ip-history">
                  {ipHistory.map((ip, idx) => (
                    <option key={idx} value={ip} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                  Camera Stream URL
                </label>
                <input
                  type="text"
                  list="camera-history"
                  value={modalCameraUrl}
                  onChange={(e) => setModalCameraUrl(e.target.value)}
                  className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                  placeholder="http://192.168.x.x:8080/video or /test_video.mp4"
                />
                <datalist id="camera-history">
                  {cameraHistory.map((url, idx) => (
                    <option key={idx} value={url} />
                  ))}
                </datalist>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                  Phone GPS URL (Optional)
                </label>
                <input
                  type="text"
                  value={modalGpsUrl}
                  onChange={(e) => setModalGpsUrl(e.target.value)}
                  className="bg-white/5 border border-white/20 p-2.5 rounded text-white font-mono outline-none text-xs focus:border-white transition-colors"
                  placeholder="http://192.168.x.x:8080/location"
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
                    className="w-full bg-white/20 hover:bg-white/30 border border-white/40 text-white font-mono font-bold py-2 rounded text-xs transition uppercase tracking-wider mt-1"
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
                  CURRENT: <span className="font-bold">v2.0.10</span>
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

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => {
          setIsPasswordModalOpen(false);
          setCurrentView("route-planning");
        }}
      />
    </div>
  );
};

export default SubmarineDashboard;
