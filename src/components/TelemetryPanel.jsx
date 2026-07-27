import React, { useRef, useState, useEffect } from "react";
import {
  Waves,
  Zap,
  Gauge,
  Thermometer,
  Move3d,
  Activity,
  Map,
  Download,
} from "lucide-react";

const TelemetryPanel = ({
  depth,
  amps,
  rpm,
  temp,
  tempError,
  obsDist = -1,
  lat,
  lng,
  imuLat,
  imuLng,
  sats,
  posX = 0,
  posY = 0,
  posZ = 0,
  velX = 0,
  velY = 0,
  velZ = 0,
  accel = { x: 0, y: 0, z: 0 },
  gyro = { x: 0, y: 0, z: 0 },
  mag = { x: 0, y: 0, z: 0 },
  calState = 0,
  referenceGps = null,
  drLat = 0,
  drLng = 0,
  drPath = [],
  gpsPath = [],
  computedVelocity = 0,
  totalDistance = 0,
  isPhoneConnected = false,
  waypoints = [],
  onResetGps = () => {},
  onResetTrack = () => {},
}) => {
  // Warnings
  const highAmps = amps > 15; // Motor Stall Risk
  const highRpm = rpm > 8000; // Cavitation Risk
  const highTemp = temp > 50; // Overheating
  const deepDepth = depth > 10; // Depth Warning

  const svgRef = useRef(null);

  // Velocity Sparkline History
  const [velHistory, setVelHistory] = useState(Array(50).fill(0));
  useEffect(() => {
    const interval = setInterval(() => {
      setVelHistory((prev) => [...prev.slice(1), computedVelocity]);
    }, 200);
    return () => clearInterval(interval);
  }, [computedVelocity]);

  const maxVel = Math.max(0.5, ...velHistory);
  const sparklinePoints = velHistory
    .map((v, i) => {
      const x = (i / (velHistory.length - 1)) * 100;
      const y = 30 - (v / maxVel) * 30;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col lg:w-[340px] w-full bg-black p-2 sm:p-3 lg:border-r lg:border-b-0 border-b border-white/20 text-white shrink-0 lg:h-full lg:overflow-y-auto">
      <div className="text-xs font-bold text-white mb-1.5 uppercase tracking-widest border-b border-white/20 pb-1.5">
        Telemetry Data
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
        {/* Internal Temperature */}
        <div
          className={`p-2 rounded-lg border flex flex-col gap-0.5 transition-colors relative overflow-hidden ${tempError || highTemp ? "bg-white text-black border-white animate-pulse" : "bg-white/5 border-white/10 text-white"}`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-100">
            <Thermometer size={16} />
            INTERNAL TEMP
          </div>
          <div
            className={`text-3xl font-mono font-bold tracking-tighter ${tempError ? "opacity-40" : ""}`}
          >
            {temp.toFixed(1)}
            <span className="text-lg opacity-85 ml-1">°C</span>
          </div>
          {highTemp && !tempError && (
            <div className="text-xs font-bold uppercase">OVERHEATING</div>
          )}

          {/* Error Overlay */}
          {tempError && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center border border-white p-2 text-center rounded-lg">
              <span className="text-[10px] font-bold text-black uppercase tracking-widest break-words w-full line-clamp-2 leading-tight">
                Error: {tempError}
              </span>
            </div>
          )}
        </div>

        {/* Obstacle Distance */}
        {/* <div
          className={`p-2 rounded-lg border flex flex-col gap-0.5 transition-colors ${obsDist > 0 && obsDist < 100 ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse" : "bg-white/5 border-white/10 text-white"}`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-100">
            <Activity size={16} />
            SONAR DISTANCE
          </div>
          <div className="text-3xl font-mono font-bold tracking-tighter">
            {obsDist > 0 ? obsDist : "--"}
            <span className="text-lg opacity-85 ml-1">cm</span>
          </div>
          {obsDist > 0 && obsDist < 100 && (
            <div className="text-xs font-bold uppercase mt-1">
              OBSTACLE DETECTED
            </div>
          )}
        </div> */}

        {/* GPS Location */}
        <div
          className={`p-2 rounded-lg border flex flex-col gap-0.5 transition-colors ${sats === -2 ? "bg-white text-black border-white animate-pulse" : "bg-white/5 border-white/10 text-white"}`}
        >
          <div className="flex items-center justify-between text-sm font-semibold mb-1 opacity-100">
            <span>GPS LOCATION</span>
            {referenceGps && (
              <button
                onClick={onResetGps}
                className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded border border-white/30 hover:bg-white/20 cursor-pointer transition-colors"
              >
                RESET DR
              </button>
            )}
          </div>
          {sats === -2 ? (
            <div className="text-xs font-bold mt-2 uppercase">
              WIRING ERROR
              <br />
              Check RX/TX pins
            </div>
          ) : (
            <>
              <div className="text-[9px] text-white/50 mb-0.5 font-bold tracking-widest uppercase mt-1">
                Starting Point
              </div>
              <div className="text-sm font-mono font-bold tracking-tighter text-white/80 mb-2">
                {waypoints && waypoints.length > 0
                  ? `${Number(waypoints[0][0]).toFixed(6)}, ${Number(waypoints[0][1]).toFixed(6)}`
                  : "NOT SET"}
              </div>

              <div className="text-[9px] text-white/50 mb-0.5 font-bold tracking-widest uppercase">
                Current Location
              </div>
              <div className="text-sm font-mono font-bold tracking-tighter text-white">
                LAT: {lat === 0 ? "Wait..." : Number(lat || 0).toFixed(6)}
              </div>
              <div className="text-sm font-mono font-bold tracking-tighter text-white">
                LNG: {lng === 0 ? "Wait..." : Number(lng || 0).toFixed(6)}
              </div>

              {referenceGps && (
                <>
                  <div className="text-[9px] font-mono opacity-50 mt-2 text-white">
                    DR LAT: {Number(drLat || 0).toFixed(6)}
                  </div>
                  <div className="text-[9px] font-mono opacity-50 text-white">
                    DR LNG: {Number(drLng || 0).toFixed(6)}
                  </div>
                </>
              )}

              <div className="text-xs font-bold mt-2 opacity-85 text-white flex items-center justify-between">
                <span>
                  {sats > 0 ? "SAT FIX" : sats === -1 ? "NO FIX" : "ERROR"}
                </span>
                {referenceGps && (
                  <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-[8px] tracking-widest">
                    DR ACTIVE
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* DR Kinematics (Velocity & Distance) */}
        <div className="p-2 rounded-lg border flex flex-col gap-1 transition-colors bg-white/5 border-white/10 text-white relative">
          <div className="flex items-center gap-2 text-sm font-semibold opacity-100">
            <Activity size={16} />
            KINEMATICS
          </div>

          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                Total Dist
              </span>
              <div className="text-xl font-mono font-bold tracking-tighter">
                {Number(totalDistance || 0).toFixed(2)}
                <span className="text-sm opacity-85 ml-1">m</span>
              </div>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                Velocity
              </span>
              <div className="text-xl font-mono font-bold tracking-tighter text-white">
                {Number(computedVelocity || 0).toFixed(2)}
                <span className="text-sm opacity-85 ml-1">m/s</span>
              </div>
            </div>
          </div>

          {/* Velocity Sparkline Graph */}
          <div className="h-[20px] w-full mt-0.5 border-b border-l border-white/20 relative">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              className="overflow-visible"
            >
              <polyline
                points={sparklinePoints}
                fill="none"
                stroke="#ffffffff"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* 3D Displacement / Position */}
        <div
          className={`p-2 rounded-lg border flex flex-col gap-0.5 transition-colors bg-white/5 border-white/10 text-white`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold mb-0.5 opacity-100">
            <Move3d size={16} />
            3D DISPLACEMENT
          </div>
          <div className="grid grid-cols-2 gap-1 mt-0.5">
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase">
                X-Axis
              </span>
              <span className="text-sm font-mono font-bold">
                {posX.toFixed(2)} m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase">
                Y-Axis
              </span>
              <span className="text-sm font-mono font-bold">
                {posY.toFixed(2)} m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase">
                Z-Axis
              </span>
              <span className="text-sm font-mono font-bold">
                {posZ.toFixed(2)} m
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase flex items-center gap-1 text-white">
                Vel X
              </span>
              <span className="text-sm font-mono font-bold text-white">
                {velX.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase flex items-center gap-1 text-white">
                Vel Y
              </span>
              <span className="text-sm font-mono font-bold text-white">
                {velY.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase flex items-center gap-1 text-white">
                Vel Z
              </span>
              <span className="text-sm font-mono font-bold text-white">
                {velZ.toFixed(2)} m/s
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-white/70 font-bold uppercase flex items-center gap-1 text-white">
                Cal State
              </span>
              <span className="text-sm font-mono font-bold text-white">
                {calState === 0
                  ? "Normal"
                  : calState === 1
                    ? "Acc/Gyro"
                    : calState === 2
                      ? "Mag"
                      : "Zeroing"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryPanel;
