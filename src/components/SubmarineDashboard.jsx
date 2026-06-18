import React, { useState, useEffect, useRef } from 'react';
import TopNavBar from './TopNavBar';
import TelemetryPanel from './TelemetryPanel';
import ControlPanel from './ControlPanel';
import MainCenterView from './MainCenterView';

const SubmarineDashboard = () => {

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
  const [driveMode, setDriveMode] = useState('stopped'); // 'forward', 'reverse', 'stopped'
  const [keyHint, setKeyHint] = useState('Use ↑ ↓ ← → and Spacebar');
  const [lastCommand, setLastCommand] = useState('None');
  const [lastReceived, setLastReceived] = useState('None');

  // Connectivity State
  const [ipAddress, setIpAddress] = useState('10.76.18.98'); // Change to your ESP32's IP
  const [cameraUrl, setCameraUrl] = useState('http://10.73.115.219:8080/video'); // IP Webcam URL
  const [isUsbConnected, setIsUsbConnected] = useState(false);

  // Refs for persistent connection state
  const serialWriterRef = useRef(null);
  const serialPortRef = useRef(null);

  // --- TWO-WAY USB WEB SERIAL HANDLER ---
  const connectUsb = async () => {
    try {
      // Disconnect Logic
      if (isUsbConnected) {
        if (serialPortRef.current) {
          await serialPortRef.current.close();
        }
        setIsUsbConnected(false);
        serialWriterRef.current = null;
        return;
      }

      // Connect Logic
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      // Native USB ESP32 boards require DTR to be asserted to receive serial data
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });

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

      // 3. Background Listening Loop (Runs continuously while connected)
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break; // Port was closed

          buffer += value;
          const lines = buffer.split('\n');

          // Keep the last incomplete chunk in the buffer for the next loop
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            // Look for our temperature tags
            if (line.startsWith("Water Temp:") || line.startsWith("TMP:") || line.startsWith("TEMP OF THE MAIN BOARD:")) {
              let tempStr = "";
              if (line.includes("TMP:")) tempStr = line.split("TMP:")[1];
              else if (line.includes("Water Temp:")) tempStr = line.split("Water Temp:")[1];
              else tempStr = line.split("TEMP OF THE MAIN BOARD:")[1].replace(" °C", "");

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
                  if(parts.length === 2) {
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
                if (!isNaN(p)) setPitch(p);
                if (!isNaN(r)) setRoll(r);
                if (!isNaN(y)) setHeading(y);
              }
            } else if (line.startsWith("MPU9250 - Pitch:")) {
              const match = line.match(/MPU9250 - Pitch:\s*([\d\.-]+)°\s*\|\s*Roll:\s*([\d\.-]+)°\s*\|\s*Yaw:\s*([\d\.-]+)°(?:\s*\|\s*Accel\(g\):\s*([\d\.-]+),([\d\.-]+),([\d\.-]+))?/);
              if (match) {
                const p = parseFloat(match[1]);
                const r = parseFloat(match[2]);
                const y = parseFloat(match[3]);
                if (!isNaN(p)) setPitch(p);
                if (!isNaN(r)) setRoll(r);
                if (!isNaN(y)) setHeading(y);

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
      }

    } catch (err) {
      console.error('USB Connect error:', err);
      alert('USB Connection Failed: ' + err.message);
    }
  };

  // --- CORE API TRANSMISSION WRAPPER ---
  // Dual-routes to USB Serial OR WiFi Fetch based on connection status
  const sendCommand = async (endpoint, serialPayload) => {
    console.log(`[USB OUT] Target: ${endpoint} | Payload: ${serialPayload}`);
    setLastCommand(serialPayload);
    try {
      if (isUsbConnected && serialWriterRef.current) {
        await serialWriterRef.current.write(serialPayload + '\r\n');
      } else {
        await fetch(`http://${ipAddress}${endpoint}`, { mode: 'no-cors', cache: 'no-store' });
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
            .then(res => {
                if (!res.ok) throw new Error("Network response was not ok");
                return res.json();
            })
            .then(data => {
                if (data) {
                    if (typeof data.pitch === 'number' && !isNaN(data.pitch)) setPitch(data.pitch);
                    if (typeof data.roll === 'number' && !isNaN(data.roll)) setRoll(data.roll);
                    if (typeof data.yaw === 'number' && !isNaN(data.yaw)) setHeading(data.yaw);
                }
            })
            .catch(err => console.warn("IMU Fetch Error (WiFi):", err.message));

        // 2. Ping and Temp every 2 seconds
        if (tickCount % 2 === 0) {
            // Ping the main route to check signal
            fetch(`http://${ipAddress}/`, { mode: 'no-cors' })
                .then(() => setSignalStrength(100))
                .catch(() => setSignalStrength(0));

            // Fetch Real Temperature Data
            fetch(`http://${ipAddress}/temp`, { signal: AbortSignal.timeout(1500) })
                .then(res => {
                    if (!res.ok) throw new Error("Network response was not ok");
                    return res.text();
                })
                .then(data => {
                    const parsedTemp = parseFloat(data);
                    if (!isNaN(parsedTemp)) {
                        setTemp(parsedTemp);
                    }
                })
                .catch(err => console.warn("Temp Fetch Error (WiFi):", err.message));
        }

    }, 1000);
    return () => clearInterval(pingInterval);
  }, [isUsbConnected, ipAddress]);

  // --- KEYBOARD CONTROLLER ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore text input fields, but allow range sliders
      if (['TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

      switch(e.key.toLowerCase()) {
        case 'w':
            e.preventDefault();
            setDriveMode('forward');
            setThrottleLimit(prev => Math.min(Number(prev) + 2, 50));
            setKeyHint('Moving Forward (Speed Up)');
            break;
        case 's':
            e.preventDefault();
            setThrottleLimit(prev => {
                const newLimit = Math.max(Number(prev) - 2, 0);
                if (newLimit === 0) setDriveMode('stopped');
                return newLimit;
            });
            setKeyHint('Moving Forward (Speed Down)');
            break;
        case 'a':
            e.preventDefault();
            setFrontFinAngle(prev => Math.max(Number(prev) - 10, -30));
            setRearFinX(prev=> Math.min(Number(prev) + 10, 30))
            setKeyHint('Steering Left');
            break;
        case 'd':
            e.preventDefault();
            setFrontFinAngle(prev => Math.min(Number(prev) + 10, 30));
            setRearFinX(prev=> Math.max(Number(prev) - 10, -30))
            setKeyHint('Steering Right');
            break;
        case 'arrowup':
            e.preventDefault();
            setRearFinY(prev => Math.min(Number(prev) + 5, 45));
            setKeyHint('Empennage Pitch Up');
            break;
        case 'arrowdown':
            e.preventDefault();
            setRearFinY(prev => Math.max(Number(prev) - 5, -45));
            setKeyHint('Empennage Pitch Down');
            break;
        case 'arrowleft':
            e.preventDefault();
            setRearFinX(prev => Math.max(Number(prev) - 5, -45));
            setKeyHint('Empennage Yaw Left');
            break;
        case 'arrowright':
            e.preventDefault();
            setRearFinX(prev => Math.min(Number(prev) + 5, 45));
            setKeyHint('Empennage Yaw Right');
            break;
        case ' ': // Spacebar
            e.preventDefault();
            setDriveMode('stopped');
            setThrottleLimit(0);
            setFrontFinAngle(0);
            setRearFinX(0);
            setRearFinY(0);
            setKeyHint('SYSTEM STOPPED');
            break;
        default:
            break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- ACTUATOR TRANSMITTERS ---

  // Drive Mode (Forward / Stop / Reverse)
  useEffect(() => {
      let serialStr = 'STOP';
      if (driveMode === 'forward') serialStr = 'DIR:FWD';
      else if (driveMode === 'reverse') serialStr = 'DIR:REV';
      sendCommand(`/action?dir=${driveMode}`, serialStr);
  }, [driveMode]);

  // Speed (PWM ranges 0-255)
  useEffect(() => {
      if (driveMode === 'stopped') return;
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
        // Add some noise to sensors to make UI look alive
        setSignalStrength(prev => Math.min(100, Math.max(0, prev + (Math.random() - 0.5) * 5)));
        setHeading(prev => (prev + (Math.random() - 0.5) * 2) % 360);
        setPitch(prev => prev + (Math.random() - 0.5) * 1);
        setRoll(prev => prev + (Math.random() - 0.5) * 1);

        // Minor fluctuations in telemetry
        setDepth(prev => Math.max(0, prev + (Math.random() - 0.5) * 0.1));

        let targetRpm = driveMode === 'stopped' ? 0 : Math.max(0, throttleLimit * 210); // Max 21000 RPM
        let targetSpeed = driveMode === 'stopped' ? 0 : (throttleLimit / 100) * 7.5; // max 7.5 knots
        let targetAmps = driveMode === 'stopped' ? 0 : (throttleLimit / 100) * 12;

        setRpm(prev => prev + (targetRpm - prev) * 0.2 + (driveMode !== 'stopped' ? (Math.random() - 0.5) * 50 : 0));
        setAmps(prev => prev + (targetAmps - prev) * 0.2 + (Math.random() - 0.5) * 0.5);
        setSpeedKnots(prev => prev + (targetSpeed - prev) * 0.1 + (Math.random() - 0.5) * 0.2);

        // Slowly drain battery
        setBatteryVolt(prev => Math.max(9.0, prev - 0.001));

    }, 1000);

    return () => clearInterval(interval);
  }, [throttleLimit, driveMode]);

  // Derive battery percentage from voltage (12.6V = 100%, 10.5V = 0%)
  const batteryPct = Math.round(Math.max(0, Math.min(100, ((batteryVolt - 10.5) / (12.6 - 10.5)) * 100)));

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
        ipAddress={ipAddress} setIpAddress={setIpAddress}
        cameraUrl={cameraUrl} setCameraUrl={setCameraUrl}
        isUsbConnected={isUsbConnected} connectUsb={connectUsb}
      />

      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">

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
        />

        <ControlPanel
            throttleLimit={throttleLimit} setThrottleLimit={setThrottleLimit}
            frontFinAngle={frontFinAngle} setFrontFinAngle={setFrontFinAngle}
            rearFinX={rearFinX} setRearFinX={setRearFinX}
            rearFinY={rearFinY} setRearFinY={setRearFinY}
            ballastActive={ballastActive} setBallastActive={setBallastActive}
            driveMode={driveMode} setDriveMode={setDriveMode}
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

    </div>
  );
};

export default SubmarineDashboard;
