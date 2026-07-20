import React, { useRef } from "react";
import { Map, Download } from "lucide-react";

const LocalTrackMap = ({
  referenceGps,
  lat,
  lng,
  posX,
  posY,
  drPath = [],
  gpsPath = [],
  isPhoneConnected = false,
  onResetTrack = () => {},
}) => {
  const svgRef = useRef(null);

  const downloadMapAsImage = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgElement);

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
      canvas.width = (svgElement.clientWidth || 800) * 2;
      canvas.height = (svgElement.clientHeight || 400) * 2;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#0a192f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `DR-Track-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`;
      a.click();

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

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
      if (-p.y < minY) minY = -p.y - 2;
      if (-p.y > maxY) maxY = -p.y + 2;
    });

    gpsPath.forEach((p) => {
      if (p.x < minX) minX = p.x - 2;
      if (p.x > maxX) maxX = p.x + 2;
      if (-p.y < minY) minY = -p.y - 2;
      if (-p.y > maxY) maxY = -p.y + 2;
    });

    if (referenceGps) {
      if (phoneX < minX) minX = phoneX - 2;
      if (phoneX > maxX) maxX = phoneX + 2;
      if (-phoneY < minY) minY = -phoneY - 2;
      if (-phoneY > maxY) maxY = -phoneY + 2;
    }

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

  const gridStep = Math.max(1, Math.floor((maxX - minX) / 10));
  const gridLines = [];
  for (let i = Math.floor(minX); i <= Math.ceil(maxX); i += gridStep) {
    gridLines.push(<line key={`gx-${i}`} x1={i} y1={minY} x2={i} y2={maxY} />);
  }
  for (let i = Math.floor(minY); i <= Math.ceil(maxY); i += gridStep) {
    gridLines.push(<line key={`gy-${i}`} x1={minX} y1={i} x2={maxX} y2={i} />);
  }

  return (
    <div
      className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors bg-white/5 border-white/10 text-white relative w-full h-full min-h-[300px] ${!isPhoneConnected && referenceGps ? "border-red-500/50 bg-red-500/5" : ""}`}
    >
      <div className="flex items-center justify-between text-sm font-semibold mb-2 opacity-100 z-50">
        <div className="flex items-center gap-2">
          <Map size={16} />
          LOCAL TRACK
          <button
            onClick={onResetTrack}
            className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/50 hover:bg-red-500/40 cursor-pointer ml-2 z-50"
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
            className="hover:bg-white/10 p-1 rounded transition-colors text-white/70 hover:text-white z-50 cursor-pointer"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <div className="absolute top-10 left-4 z-50 flex flex-col gap-0.5 pointer-events-none">
        {!isPhoneConnected && referenceGps && (
          <span className="text-[9px] font-mono text-red-500 font-bold bg-black/60 px-1 rounded mt-1">
            PHONE GPS LOST
          </span>
        )}
      </div>

      <div className="absolute inset-0 top-10 flex items-center justify-center p-2 pt-0 z-0 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g className="stroke-white/10" strokeWidth={(maxX - minX) * 0.005}>
            {gridLines}
          </g>

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

          {drPath.length > 1 && (
            <polyline
              points={drPath.map((p) => `${p.x},${-p.y}`).join(" ")}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={(maxX - minX) * 0.015}
              strokeLinejoin="round"
            />
          )}

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
  );
};

export default LocalTrackMap;
