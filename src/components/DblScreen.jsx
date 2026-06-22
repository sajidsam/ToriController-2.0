import React, { useEffect, useRef, useState } from "react";
import { Link2, Radio, Server, Activity, ArrowDown } from "lucide-react";

function DblScreen({ depth = 0, speedKnots = 0, heading = 0, temp = 0 }) {
  const canvasRef = useRef(null);
  const [altitude, setAltitude] = useState(15.4);
  const [linkQuality, setLinkQuality] = useState(98);
  const [dbm, setDbm] = useState(-62);
  const terrainPointsRef = useRef(
    Array.from(
      { length: 40 },
      (_, i) => 80 + Math.sin(i * 0.3) * 15 + Math.cos(i * 0.7) * 8,
    ),
  );

  // Update mock bottom altitude and terrain scrolling
  useEffect(() => {
    const interval = setInterval(() => {
      const baseAlti = Math.max(0.5, 30 - depth);
      const noise = (Math.random() - 0.5) * 0.15;
      setAltitude(parseFloat((baseAlti + noise).toFixed(2)));

      setLinkQuality((q) =>
        Math.max(85, Math.min(100, q + (Math.random() - 0.5) * 2)),
      );
      setDbm((d) =>
        Math.max(-80, Math.min(-50, d + (Math.random() - 0.5) * 3)),
      );

      const points = terrainPointsRef.current;
      points.shift();
      const lastPoint = points[points.length - 1];
      const nextPoint = Math.max(
        40,
        Math.min(
          130,
          lastPoint +
            (Math.random() - 0.5) * 6 +
            Math.sin(Date.now() / 2000) * 2,
        ),
      );
      points.push(nextPoint);
    }, 100);

    return () => clearInterval(interval);
  }, [depth]);

  // Render rolling bottom profile on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = (canvas.width = canvas.clientWidth);
    const height = (canvas.height = canvas.clientHeight);

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const points = terrainPointsRef.current;
    const step = width / (points.length - 1);

    // Draw bottom terrain fill (Monochrome)
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo(i * step, height - (points[i] * height) / 160);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Draw bottom terrain line (Monochrome)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const px = i * step;
      const py = height - (points[i] * height) / 160;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Submarine indicator (floating at fixed vertical center-left)
    const subX = width * 0.25;
    const subY = height * 0.35;

    // Pulse sensor beam to bottom (Monochrome)
    const terrainHeightAtSub =
      height - (points[Math.floor(points.length * 0.25)] * height) / 160;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(subX, subY);
    ctx.lineTo(subX, terrainHeightAtSub);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw submarine dot / pilot symbol (Monochrome)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(subX, subY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Highlight outer glow (Monochrome)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(subX, subY, 8 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [altitude]);

  return (
    <div
      className="w-full h-full flex flex-col select-none relative p-3 text-white"
      style={{ fontFamily: "'Share Tech Mono', monospace" }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-2">
        <span className="text-[10px] font-bold tracking-widest text-white flex items-center gap-1">
          <Radio size={12} className="animate-pulse" /> DBL PILOT SCREEN
        </span>
        <span className="text-[8px] bg-white/20 text-white border border-white/40 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
          Link: Active
        </span>
      </div>

      {/* BODY GRID */}
      <div className="flex-1 flex flex-col gap-2.5 min-h-0">
        {/* ALTITUDE & LINK METRICS */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <div className="bg-white/5 border border-white/10 rounded p-1.5 flex flex-col items-center">
            <span className="text-[6.5px] text-white/80 tracking-wider uppercase font-bold flex items-center gap-0.5">
              <ArrowDown size={8} /> Altitude
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
              {altitude.toFixed(1)}m
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded p-1.5 flex flex-col items-center">
            <span className="text-[6.5px] text-white/80 tracking-wider uppercase font-bold flex items-center gap-0.5">
              <Link2 size={8} /> Signal
            </span>
            <span className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
              {dbm.toFixed(0)}dB
            </span>
          </div>
        </div>

        {/* BOTTOM PROFILE TERRAIN */}
        <div className="flex-1 min-h-[90px] border border-white/15 bg-black/60 rounded overflow-hidden relative flex flex-col">
          <div className="absolute top-1 left-2 text-[5.5px] text-white/60 font-bold uppercase tracking-widest z-10">
            Bottom Topography profile
          </div>
          <canvas ref={canvasRef} className="flex-1 w-full h-full" />
        </div>

        {/* LOG SYSTEM METRICS */}
        <div className="bg-white/5 border border-white/10 rounded p-2 flex flex-col gap-1.5 shrink-0">
          <span className="text-[6px] text-white/70 tracking-wider uppercase font-bold border-b border-white/10 pb-0.5 flex items-center gap-1">
            <Activity size={8} /> Telemetry Logger
          </span>

          <div className="flex justify-between items-center text-[7.5px] font-mono leading-none">
            <span className="text-white/80 font-bold">LINK QUALITY</span>
            <span className="text-white font-bold">
              {linkQuality.toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-[7.5px] font-mono leading-none">
            <span className="text-white/80 font-bold">RATE LIMIT</span>
            <span className="text-white font-bold">42 kbps</span>
          </div>
          <div className="flex justify-between items-center text-[7.5px] font-mono leading-none">
            <span className="text-white/80 font-bold">TEMP ALARM</span>
            <span className="text-white font-bold">
              {temp > 50 ? "WARNING" : "NORMAL"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DblScreen;
