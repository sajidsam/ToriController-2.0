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
  lat,
  lng,
  sats,
  posX = 0,
  posY = 0,
  posZ = 0,
  velX = 0,
  referenceGps = null,
  drLat = 0,
  drLng = 0,
  drPath = [],
  gpsPath = [],
  computedVelocity = 0,
  totalDistance = 0,
  isPhoneConnected = false,
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

  const downloadMapAsImage = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

    // Ensure xmlns is present for standalone rendering
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Use 2x resolution for better quality
      canvas.width = (svgElement.clientWidth || 800) * 2;
      canvas.height = (svgElement.clientHeight || 400) * 2;
      const ctx = canvas.getContext("2d");

      // Fill background
      ctx.fillStyle = "#0a192f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      // Trigger download
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `DR-Track-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
      a.click();

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Dynamic ViewBox for SVG Map
  let minX = -5,
    maxX = 5,
    minY = -5,
    maxY = 5;
  let phoneX = 0,
    phoneY = 0;

  if (referenceGps && lat && lng) {
    const LAT_DEGREE_METERS = 111320;
    phoneY = (lat - referenceGps.lat) * LAT_DEGREE_METERS;
    phoneX =
      (lng - referenceGps.lng) *
      (LAT_DEGREE_METERS * Math.cos(referenceGps.lat * (Math.PI / 180)));
  }

  if (drPath.length > 0 || gpsPath.length > 0) {
    drPath.forEach((p) => {
      if (p.x < minX) minX = p.x - 2;
      if (p.x > maxX) maxX = p.x + 2;
      if (-p.y < minY) minY = -p.y - 2; // SVG Y is inverted
      if (-p.y > maxY) maxY = -p.y + 2;
    });

    gpsPath.forEach((p) => {
      if (p.x < minX) minX = p.x - 2;
      if (p.x > maxX) maxX = p.x + 2;
      if (-p.y < minY) minY = -p.y - 2; // SVG Y is inverted
      if (-p.y > maxY) maxY = -p.y + 2;
    });

    // Also include phone GPS in bounds if reference is set (even if signal is currently lost)
    if (referenceGps) {
      if (phoneX < minX) minX = phoneX - 2;
      if (phoneX > maxX) maxX = phoneX + 2;
      if (-phoneY < minY) minY = -phoneY - 2;
      if (-phoneY > maxY) maxY = -phoneY + 2;
    }
    // Keep it square
    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height, 10);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    minX = centerX - maxDim / 2;
    maxX = centerX + maxDim / 2;
    minY = centerY - maxDim / 2;
    maxY = centerY + maxDim / 2;
  }

  // Grid lines generation based on dynamic size
  const gridStep = Math.max(1, Math.floor((maxX - minX) / 10));
  const gridLines = [];
  for (let i = Math.floor(minX); i <= Math.ceil(maxX); i += gridStep) {
    gridLines.push(<line key={`gx-${i}`} x1={i} y1={minY} x2={i} y2={maxY} />);
  }
  for (let i = Math.floor(minY); i <= Math.ceil(maxY); i += gridStep) {
    gridLines.push(<line key={`gy-${i}`} x1={minX} y1={i} x2={maxX} y2={i} />);
  }

  return (
    <div className="flex flex-col lg:w-[340px] w-full bg-black p-4 lg:border-r lg:border-b-0 border-b border-white/20 text-white shrink-0 lg:h-full lg:overflow-y-auto">
      <div className="text-xs font-bold text-white mb-2 uppercase tracking-widest border-b border-white/20 pb-2">
        Telemetry Data
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        {/* Internal Temperature */}
        <div
          className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors relative overflow-hidden ${tempError || highTemp ? "bg-white text-black border-white animate-pulse" : "bg-white/5 border-white/10 text-white"}`}
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

        {/* GPS Location */}
        <div
          className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${sats === -2 ? "bg-white text-black border-white animate-pulse" : "bg-white/5 border-white/10 text-white"}`}
        >
          <div className="flex items-center justify-between text-sm font-semibold mb-1 opacity-100">
            <span>GPS LOCATION</span>
            {referenceGps && (
              <button
                onClick={onResetGps}
                className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/50 hover:bg-red-500/40 cursor-pointer"
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
              {referenceGps ? (
                <>
                  <div className="text-[9px] text-white/50 mb-0.5 font-bold tracking-widest uppercase">
                    Starting Location
                  </div>
                  <div className="text-xs font-mono text-white/80 mb-2">
                    {Number(referenceGps.lat).toFixed(6)},{" "}
                    {Number(referenceGps.lng).toFixed(6)}
                  </div>

                  <div className="text-[9px] text-white/50 mb-0.5 font-bold tracking-widest uppercase">
                    Current (End) Location
                  </div>
                  <div className="text-sm font-mono font-bold tracking-tighter text-blue-400">
                    LAT: {Number(drLat || 0).toFixed(6)}
                  </div>
                  <div className="text-sm font-mono font-bold tracking-tighter text-blue-400">
                    LNG: {Number(drLng || 0).toFixed(6)}
                  </div>

                  <div className="text-[9px] font-mono opacity-60 mt-2">
                    ACTUAL GPS: {Number(lat || 0).toFixed(6)},{" "}
                    {Number(lng || 0).toFixed(6)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[9px] text-white/50 mb-0.5 font-bold tracking-widest uppercase mt-1">
                    Current Location
                  </div>
                  <div className="text-sm font-mono font-bold tracking-tighter text-white">
                    LAT: {lat === 0 ? "Wait..." : Number(lat || 0).toFixed(6)}
                  </div>
                  <div className="text-sm font-mono font-bold tracking-tighter text-white">
                    LNG: {lng === 0 ? "Wait..." : Number(lng || 0).toFixed(6)}
                  </div>
                </>
              )}

              <div className="text-xs font-bold mt-1 opacity-85 text-white flex items-center justify-between">
                <span>
                  {sats > 0 ? "SAT FIX" : sats === -1 ? "NO FIX" : "ERROR"}
                </span>
                {referenceGps && (
                  <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[8px] tracking-widest">
                    DR ACTIVE
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* DR Kinematics (Velocity & Distance) */}
        <div className="p-3 rounded-lg border flex flex-col gap-2 transition-colors bg-white/5 border-white/10 text-white relative">
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
              <div className="text-xl font-mono font-bold tracking-tighter text-green-400">
                {Number(computedVelocity || 0).toFixed(2)}
                <span className="text-sm opacity-85 ml-1">m/s</span>
              </div>
            </div>
          </div>

          {/* Velocity Sparkline Graph */}
          <div className="h-[30px] w-full mt-1 border-b border-l border-white/20 relative">
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
                stroke="#4ade80"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Local Tracking Map (Dead Reckoning) */}
        <div
          className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors bg-white/5 border-white/10 text-white relative ${!isPhoneConnected && referenceGps ? "border-red-500/50 bg-red-500/5" : ""}`}
        >
          <div className="flex items-center justify-between text-sm font-semibold mb-2 opacity-100">
            <div className="flex items-center gap-2">
              <Map size={16} />
              LOCAL TRACK
              <button
                onClick={onResetTrack}
                className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/50 hover:bg-red-500/40 cursor-pointer ml-2"
              >
                RESET
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono opacity-50">
                Grid: {gridStep} feet
              </span>
              <button
                onClick={downloadMapAsImage}
                title="Download Graph as Image"
                className="hover:bg-white/10 p-1 rounded transition-colors text-white/70 hover:text-white"
              >
                <Download size={14} />
              </button>
            </div>
          </div>

          {/* Telemetry Overlay */}
          <div className="absolute top-10 left-4 z-10 flex flex-col gap-0.5 pointer-events-none">
            {!isPhoneConnected && referenceGps && (
              <span className="text-[9px] font-mono text-red-500 font-bold bg-black/60 px-1 rounded mt-1">
                PHONE GPS LOST
              </span>
            )}
          </div>

          <div className="relative w-full h-[350px] sm:h-[450px] bg-black/50 rounded overflow-hidden border border-white/10 flex items-center justify-center">
            <svg
              ref={svgRef}
              viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
              className="w-full h-full overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Grid lines */}
              <g
                className="stroke-white/10"
                strokeWidth={(maxX - minX) * 0.005}
              >
                {gridLines}
              </g>

              {/* Axis lines */}
              <line
                x1="0"
                y1={minY}
                x2="0"
                y2={maxY}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={(maxX - minX) * 0.01}
              />
              <line
                x1={minX}
                y1="0"
                x2={maxX}
                y2="0"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={(maxX - minX) * 0.01}
              />

              {/* DR Path Trail (Blue) */}
              {drPath.length > 1 && (
                <polyline
                  points={drPath.map((p) => `${p.x},${-p.y}`).join(" ")}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={(maxX - minX) * 0.015}
                  strokeLinejoin="round"
                />
              )}

              {/* GPS Path Trail (Green Dashed) */}
              {gpsPath.length > 1 && (
                <polyline
                  points={gpsPath.map((p) => `${p.x},${-p.y}`).join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={(maxX - minX) * 0.012}
                  strokeDasharray={`${(maxX - minX) * 0.03},${(maxX - minX) * 0.03}`}
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              )}

              {/* Start Location (Origin) */}
              <circle cx="0" cy="0" r={(maxX - minX) * 0.02} fill="#ef4444" />
              <text
                x={(maxX - minX) * 0.03}
                y={(maxX - minX) * 0.03}
                fill="#ef4444"
                fontSize={(maxX - minX) * 0.04}
                fontWeight="bold"
                dominantBaseline="hanging"
              >
                START
              </text>

              {/* Phone's ACTUAL GPS Location */}
              {referenceGps && (
                <>
                  <circle
                    cx={phoneX}
                    cy={-phoneY}
                    r={(maxX - minX) * 0.02}
                    fill="#10b981"
                    opacity="0.6"
                  />
                  <text
                    x={phoneX + (maxX - minX) * 0.03}
                    y={-phoneY + (maxX - minX) * 0.03}
                    fill="#10b981"
                    fontSize={(maxX - minX) * 0.035}
                    fontWeight="bold"
                    dominantBaseline="hanging"
                    opacity="0.8"
                  >
                    PHONE GPS
                  </text>
                </>
              )}

              {/* Current Position Dot */}
              <circle
                cx={posX}
                cy={-posY}
                r={(maxX - minX) * 0.03}
                fill="#60a5fa"
              />
              <text
                x={posX + (maxX - minX) * 0.04}
                y={-posY}
                fill="#60a5fa"
                fontSize={(maxX - minX) * 0.04}
                fontWeight="bold"
                dominantBaseline="middle"
              >
                CURRENT
              </text>
            </svg>
          </div>
        </div>

        {/* 3D Displacement / Position */}
        <div
          className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors bg-white/5 border-white/10 text-white`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-100">
            <Move3d size={16} />
            3D DISPLACEMENT
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
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
              <span className="text-[10px] text-white/70 font-bold uppercase flex items-center gap-1 text-green-400">
                2D Vel
              </span>
              <span className="text-sm font-mono font-bold text-green-400">
                {computedVelocity.toFixed(2)} m/s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryPanel;
