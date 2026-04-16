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

  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [heading, setHeading] = useState(45);

  // Control Actuators State
  const [throttleLimit, setThrottleLimit] = useState(0);
  const [frontFinAngle, setFrontFinAngle] = useState(0); // Center is 0 (mapped to 97 later)
  const [rearFinX, setRearFinX] = useState(0);
  const [rearFinY, setRearFinY] = useState(0);
  const [ballastActive, setBallastActive] = useState(false);
  const [driveMode, setDriveMode] = useState('stopped'); // 'forward', 'reverse', 'stopped'
  const [keyHint, setKeyHint] = useState('Use ↑ ↓ ← → and Spacebar');

  // Connectivity State
  const [ipAddress, setIpAddress] = useState('10.200.136.98'); // Change to your ESP32's IP
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
            if (line.startsWith("Water Temp:") || line.startsWith("TMP:")) {
              const tempStr = line.includes("TMP:") ? line.split("TMP:")[1] : line.split("Water Temp:")[1];
              const parsedTemp = parseFloat(tempStr);
              if (!isNaN(parsedTemp)) {
                setTemp(parsedTemp); // Updates the React UI instantly
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
    }
  };

  // --- CORE API TRANSMISSION WRAPPER ---
  // Dual-routes to USB Serial OR WiFi Fetch based on connection status
  const sendCommand = async (endpoint, serialPayload) => {
    try {
      if (isUsbConnected && serialWriterRef.current) {
        await serialWriterRef.current.write(serialPayload + '\n');
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
    const pingInterval = setInterval(() => {
        if (isUsbConnected) return; // If on USB, the reader loop handles everything. Do not ping WiFi.

        // 1. Ping the main route to check signal
        fetch(`http://${ipAddress}/`, { mode: 'no-cors' })
            .then(() => setSignalStrength(100))
            .catch(() => setSignalStrength(0));

        // 2. Fetch Real Temperature Data (Notice NO 'no-cors' here, and added timeout)
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

    }, 2000);
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
            setThrottleLimit(prev => Math.min(Number(prev) + 10, 100));
            setKeyHint('Moving Forward (Speed Up)');
            break;
        case 's':
            e.preventDefault();
            setThrottleLimit(prev => {
                const newLimit = Math.max(Number(prev) - 10, 0);
                if (newLimit === 0) setDriveMode('stopped');
                return newLimit;
            });
            setKeyHint('Moving Forward (Speed Down)');
            break;
        case 'a':
            e.preventDefault();
            setFrontFinAngle(prev => Math.max(Number(prev) - 15, -45));
            setKeyHint('Steering Left');
            break;
        case 'd':
            e.preventDefault();
            setFrontFinAngle(prev => Math.min(Number(prev) + 15, 45));
            setKeyHint('Steering Right');
            break;
        case 'arrowup':
            e.preventDefault();
            setRearFinY(prev => Math.min(Number(prev) + 15, 45));
            setKeyHint('Empennage Pitch Up');
            break;
        case 'arrowdown':
            e.preventDefault();
            setRearFinY(prev => Math.max(Number(prev) - 15, -45));
            setKeyHint('Empennage Pitch Down');
            break;
        case 'arrowleft':
            e.preventDefault();
            setRearFinX(prev => Math.max(Number(prev) - 15, -45));
            setKeyHint('Empennage Yaw Left');
            break;
        case 'arrowright':
            e.preventDefault();
            setRearFinX(prev => Math.min(Number(prev) + 15, 45));
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

  // Drive Mode (Forward / Stop)
  useEffect(() => {
      let serialStr = 'STOP';
      if (driveMode === 'forward') serialStr = 'DIR:FWD';
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
    <div className="flex flex-col min-h-screen lg:h-[calc(100vh-40px)] w-full bg-zinc-950 font-sans text-zinc-100 lg:overflow-hidden overflow-y-auto relative">

      <TopNavBar
        signalStrength={signalStrength}
        batteryVolt={batteryVolt}
        batteryPct={batteryPct}
        isLeaking={isLeaking}
        ipAddress={ipAddress} setIpAddress={setIpAddress}
        isUsbConnected={isUsbConnected} connectUsb={connectUsb}
      />

      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden">

        <TelemetryPanel
            depth={depth}
            amps={amps}
            rpm={rpm}
            temp={temp}
        />

        <MainCenterView
            pitch={pitch}
            roll={roll}
            heading={heading}
            speedKnots={speedKnots}
            frontFinAngle={frontFinAngle}
            rearFinX={rearFinX}
            rearFinY={rearFinY}
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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-zinc-900/80 backdrop-blur border border-zinc-700 text-xs rounded-full z-50 shadow-xl max-w-[90vw] overflow-x-auto whitespace-nowrap">
          <span className="px-2 py-1 text-zinc-500 font-bold uppercase tracking-widest hidden sm:block">Dev Test:</span>
          <button onClick={toggleLeak} className="bg-red-900 hover:bg-red-700 px-3 py-1 rounded text-white font-bold transition">Toggle Leak</button>
          <button onClick={spikeAmps} className="bg-amber-900 hover:bg-amber-700 px-3 py-1 rounded text-white font-bold transition">Spike Amps</button>
          <button onClick={diveDeep} className="bg-blue-900 hover:bg-blue-700 px-3 py-1 rounded text-white font-bold transition">Dive &gt; 10m</button>
      </div>

      {/* Keyboard Hint Overlay */}
      <div className="fixed bottom-16 lg:bottom-4 left-1/2 lg:left-4 -translate-x-1/2 lg:translate-x-0 flex gap-2 p-3 bg-zinc-900/80 backdrop-blur border border-zinc-700 text-sm text-cyan-400 font-mono rounded-lg z-50 shadow-xl opacity-80 pointer-events-none">
          {keyHint}
      </div>

    </div>
  );
};

export default SubmarineDashboard;
