import React, { useState, useEffect } from 'react';
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
  const [temp, setTemp] = useState(38.5);
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

  // Connectivity State
  const [ipAddress, setIpAddress] = useState('192.168.0.140');
  const [isUsbConnected, setIsUsbConnected] = useState(false);
  const serialWriterRef = React.useRef(null);
  const serialPortRef = React.useRef(null);

  // USB Web Serial Connection Handler
  const connectUsb = async () => {
    try {
      if (isUsbConnected) {
        if (serialPortRef.current) {
          await serialPortRef.current.close();
        }
        setIsUsbConnected(false);
        serialWriterRef.current = null;
        return;
      }

      // Request a port (Electron handles this natively via the main.cjs patch)
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      serialWriterRef.current = writer;
      serialPortRef.current = port;
      setIsUsbConnected(true);
      setSignalStrength(100);
    } catch (err) {
      console.error('USB Connect error:', err);
    }
  };

  // Core API transmission wrapper (Dual-routes to USB Serial OR WiFi Fetch)
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

  // Signal ping interval (only ping if using WiFi)
  useEffect(() => {
    const pingInterval = setInterval(() => {
        if (isUsbConnected) return; // Ignore pinging if on USB
        console.log(ipAddress);

        fetch(`http://${ipAddress}/`, { mode: 'no-cors' }).then(() => setSignalStrength(100)).catch(() => setSignalStrength(0));
    }, 2000);
    return () => clearInterval(pingInterval);
  }, []);

  // Transmit: Drive Mode (Forward / Reverse / Stop)
  useEffect(() => {
      let serialStr = 'STOP';
      if (driveMode === 'forward') serialStr = 'DIR:FWD';
      if (driveMode === 'reverse') serialStr = 'DIR:REV';
      sendCommand(`/action?dir=${driveMode}`, serialStr);
  }, [driveMode]);

  // Transmit: Speed (PWM ranges 0-255)
  useEffect(() => {
      if (driveMode === 'stopped') return;
      const speedPWM = Math.round((throttleLimit / 100) * 255);
      sendCommand(`/speed?val=${speedPWM}`, `SPD:${speedPWM}`);
  }, [throttleLimit, driveMode]);

  // Transmit: Front Fin (Bow Planes)
  useEffect(() => {
      const angle = 97 + frontFinAngle;
      sendCommand(`/servo?target=front&val=${angle}`, `F_SRV:${angle}`);
  }, [frontFinAngle]);

  // Transmit: Back Fin (Rudder)
  useEffect(() => {
      const angle = 97 + rearFinX;
      sendCommand(`/servo?target=back&val=${angle}`, `B_SRV:${angle}`);
  }, [rearFinX]);

  // Simulation Effect
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

        setTemp(prev => Math.max(20, Math.min(80, prev + (throttleLimit > 80 ? 0.2 : -0.1))));

        // Slowly drain battery
        setBatteryVolt(prev => Math.max(9.0, prev - 0.001));

    }, 1000);

    return () => clearInterval(interval);
  }, [throttleLimit]);

  // Derive battery percentage from voltage
  // rough map: 12.6V = 100%, 10.5V = 0%
  const batteryPct = Math.round(Math.max(0, Math.min(100, ((batteryVolt - 10.5) / (12.6 - 10.5)) * 100)));

  // Dev tools to manually trigger warnings for testing
  const toggleLeak = () => setIsLeaking(!isLeaking);
  const spikeAmps = () => setAmps(16);
  const diveDeep = () => setDepth(12);

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] w-full bg-zinc-950 font-sans text-zinc-100 overflow-hidden">

      <TopNavBar
        signalStrength={signalStrength}
        batteryVolt={batteryVolt}
        batteryPct={batteryPct}
        isLeaking={isLeaking}
        ipAddress={ipAddress} setIpAddress={setIpAddress}
        isUsbConnected={isUsbConnected} connectUsb={connectUsb}
      />

      <div className="flex flex-1 overflow-hidden">

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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-zinc-900/80 backdrop-blur border border-zinc-700 text-xs rounded-full z-50">
          <span className="px-2 py-1 text-zinc-500 font-bold uppercase tracking-widest hidden sm:block">Dev Test:</span>
          <button onClick={toggleLeak} className="bg-red-900 hover:bg-red-700 px-3 py-1 rounded text-white font-bold transition">Toggle Leak</button>
          <button onClick={spikeAmps} className="bg-amber-900 hover:bg-amber-700 px-3 py-1 rounded text-white font-bold transition">Spike Amps</button>
          <button onClick={diveDeep} className="bg-blue-900 hover:bg-blue-700 px-3 py-1 rounded text-white font-bold transition">Dive &gt; 10m</button>
      </div>

    </div>
  );
};

export default SubmarineDashboard;
