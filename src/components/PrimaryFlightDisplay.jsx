import React, { useState, useEffect, useRef } from "react";
import { Compass, Waves, ArrowUpRight, ArrowDownRight, Activity, Thermometer } from "lucide-react";

function PrimaryFlightDisplay({
  heading: propHeading,
  depth: propDepth,
  pitch: propPitch,
  roll: propRoll,
  temp: propTemp,
  hideControls = true
}) {
  const isDemo = propHeading === undefined && propDepth === undefined;

  const [demoHeading, setDemoHeading] = useState(41);
  const [demoDepth, setDemoDepth] = useState(2.6);
  const [demoPitch, setDemoPitch] = useState(0.0);
  const [demoRoll, setDemoRoll] = useState(0.0);
  const [demoTemp, setDemoTemp] = useState(24.5);

  const [bubbles, setBubbles] = useState([]);
  useEffect(() => {
    const initialBubbles = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 3.5 + 1.5,
      speed: Math.random() * 4 + 3,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.4 + 0.15,
      drift: (Math.random() - 0.5) * 30
    }));
    setBubbles(initialBubbles);
  }, []);

  const heading = isDemo ? demoHeading : propHeading;
  const depth = isDemo ? demoDepth : propDepth;
  const pitch = isDemo ? demoPitch : (propPitch || 0.0);
  const roll = isDemo ? demoRoll : (propRoll || 0.0);
  const temp = isDemo ? demoTemp : (propTemp || 0.0);

  // Calculate vertical speed (m/min)
  const lastDepthRef = useRef(depth);
  const lastTimeRef = useRef(Date.now());
  const [calculatedVertSpeed, setCalculatedVertSpeed] = useState(0.0);

  useEffect(() => {
    if (isDemo) return;
    const now = Date.now();
    const dt = (now - lastTimeRef.current) / 1000 / 60; // minutes
    if (dt > 0.005) { // at least 300ms
      const dDepth = depth - lastDepthRef.current;
      const calculatedSpeed = dDepth / dt;
      if (Math.abs(calculatedSpeed) < 100) {
        setCalculatedVertSpeed(prev => prev + (calculatedSpeed - prev) * 0.15);
      }
      lastDepthRef.current = depth;
      lastTimeRef.current = now;
    }
  }, [depth, isDemo]);

  const vertSpeed = isDemo ? 0.0 : calculatedVertSpeed;

  // Simulate drift in demo mode
  useEffect(() => {
    if (!isDemo) return;
    const id = setInterval(() => {
      setDemoHeading((h) => (h + (Math.random() - 0.5) * 0.15 + 360) % 360);
      setDemoPitch(() => Math.sin(Date.now() / 2500) * 12.0);
      setDemoRoll(() => Math.cos(Date.now() / 3000) * 15.0);
      setDemoDepth((d) => Math.max(0, d + Math.sin(Date.now() / 5000) * 0.02));
      setDemoTemp((t) => Math.min(60, Math.max(15, t + (Math.random() - 0.5) * 0.04)));
    }, 100);
    return () => clearInterval(id);
  }, [isDemo]);

  // Compass layout calculation (scale ranges ±60 degrees around current heading)
  const compassRange = 60;
  const headingTicks = [];
  const startHdg = Math.floor((heading - compassRange) / 5) * 5;
  const endHdg = Math.ceil((heading + compassRange) / 5) * 5;

  for (let h = startHdg; h <= endHdg; h++) {
    const normHdg = ((h % 360) + 360) % 360;
    const isMajor = normHdg % 30 === 0;
    const isMid = normHdg % 10 === 0 && !isMajor;
    
    // Calculate percentage offset on screen
    const offsetPct = ((h - heading) / (compassRange * 2)) * 100 + 50;
    
    let label = "";
    if (isMajor) {
      if (normHdg === 0) label = "N";
      else if (normHdg === 90) label = "E";
      else if (normHdg === 180) label = "S";
      else if (normHdg === 270) label = "W";
      else label = String(normHdg).padStart(3, "0");
    }

    if (offsetPct >= 0 && offsetPct <= 100) {
      headingTicks.push({
        heading: normHdg,
        offsetPct,
        isMajor,
        isMid,
        label
      });
    }
  }

  // Depth scale calculation (vertical tape, current depth centered or highlighted)
  const depthTicks = [];
  const startDepth = Math.max(0, Math.floor(depth - 8));
  const endDepth = Math.floor(depth + 8);
  for (let d = startDepth; d <= endDepth; d++) {
    const offsetPct = ((d - depth) / 16) * 100 + 50; // center is 50%
    if (offsetPct >= 0 && offsetPct <= 100) {
      depthTicks.push({
        val: d,
        offsetPct: 100 - offsetPct // inverse for vertical axis (high values at bottom)
      });
    }
  }

  // Vert speed scale calculations (-20 to 20)
  const speedTicks = [];
  for (let s = -20; s <= 20; s += 2) {
    const offsetPct = ((s - vertSpeed) / 24) * 100 + 50; // center is 50%
    if (offsetPct >= 0 && offsetPct <= 100) {
      speedTicks.push({
        val: s,
        offsetPct: 100 - offsetPct
      });
    }
  }

  const normalizedHdg = ((Math.round(heading) % 360) + 360) % 360;

  return (
    <div className="w-full h-full flex flex-col justify-between select-none relative font-mono text-cyan-400 p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md rounded-xl border border-cyan-800/30 overflow-hidden shadow-[inset_0_0_20px_rgba(6,182,212,0.15)] shadow-cyan-950/20 pfd-container">
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          15% {
            opacity: var(--bubble-opacity);
          }
          85% {
            opacity: var(--bubble-opacity);
          }
          100% {
            transform: translateY(-200px) translateX(var(--bubble-drift));
            opacity: 0;
          }
        }
      `}</style>
      
      {/* Title */}
      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest border-b border-cyan-800/30 pb-2 mb-2 gap-2 flex-wrap">
        <span className="flex items-center gap-1.5"><Activity size={12} className="animate-pulse" /> PFD DISPLAY</span>
        <span className="text-cyan-500/70 font-mono flex flex-wrap items-center gap-3">
          <span>ROLL: {roll.toFixed(1)}°</span>
          <span>PITCH: {pitch.toFixed(1)}°</span>
          <span className="flex items-center gap-1">
            <Thermometer size={10} className={temp > 50 ? "text-red-400 animate-bounce" : "text-cyan-400"} />
            TEMP: <span className={temp > 50 ? "text-red-400 font-bold" : "text-cyan-400"}>{temp.toFixed(1)}°C</span>
          </span>
        </span>
      </div>

      {/* Main HUD Row */}
      <div className="flex-1 flex justify-between items-stretch min-h-0 relative py-2 gap-4">
        
        {/* Left Column: Depth Tape */}
        <div className="w-14 flex items-stretch relative border-r border-cyan-800/20 pr-2 select-none">
          <div className="absolute top-0 bottom-0 right-1 w-[2px] bg-cyan-800/30" />
          <div className="flex-1 relative overflow-hidden">
            {depthTicks.map((tick, i) => (
              <div 
                key={i} 
                className="absolute right-0 flex items-center transition-all duration-75"
                style={{ top: `${tick.offsetPct}%`, transform: 'translateY(-50%)' }}
              >
                <span className="text-[9px] mr-1.5 opacity-60 font-bold">{tick.val}m</span>
                <div className={`h-[1px] bg-cyan-400 ${tick.val % 5 === 0 ? 'w-3' : 'w-1.5'}`} />
              </div>
            ))}
          </div>
          {/* Depth Badge */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center bg-cyan-950 border-2 border-cyan-400 text-white rounded px-1.5 py-0.5 shadow-lg shadow-cyan-950 font-bold text-xs">
            <Waves size={10} className="mr-1 text-cyan-400 animate-bounce" />
            {depth.toFixed(1)}
          </div>
        </div>

        {/* Center Column: Gyro/Horizon Ball */}
        <div className="flex-1 flex items-center justify-center relative min-h-0 min-w-0">
          <div className="relative w-44 h-44 pfd-horizon-ball shrink-0 rounded-full border border-cyan-500/30 bg-cyan-950/20 overflow-hidden flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.1)]">
            
            {/* Horizon Disc (Rotates and Pitches) */}
            <div 
              className="absolute w-[250%] h-[250%] transition-transform duration-100 ease-out"
              style={{
                transform: `rotate(${-roll}deg) translateY(${pitch * 2.5}px)`
              }}
            >
              {/* Sky / Water Column */}
              <div className="h-1/2 w-full bg-gradient-to-t from-cyan-600/20 to-cyan-950/10 border-b border-cyan-400/80 relative flex items-end justify-center">
                {/* Sky Pitch Lines */}
                <div className="absolute bottom-6 flex flex-col items-center gap-6 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold">10</span>
                    <div className="w-10 h-[1px] bg-cyan-400" />
                    <span className="text-[8px] font-bold">10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold">20</span>
                    <div className="w-14 h-[1px] bg-cyan-400" />
                    <span className="text-[8px] font-bold">20</span>
                  </div>
                </div>
              </div>

              {/* Ground / Seabed */}
              <div className="h-1/2 w-full bg-gradient-to-b from-amber-950/20 to-amber-950/5 relative flex items-start justify-center">
                {/* Ground Pitch Lines */}
                <div className="absolute top-6 flex flex-col items-center gap-6 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-amber-500 font-bold">10</span>
                    <div className="w-10 h-[1px] bg-amber-500/80 dashed" strokeDasharray="2" />
                    <span className="text-[8px] text-amber-500 font-bold">10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-amber-500 font-bold">20</span>
                    <div className="w-14 h-[1px] bg-amber-500/80 dashed" strokeDasharray="2" />
                    <span className="text-[8px] text-amber-500 font-bold">20</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Static Reticle (Submarine indicator) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              {/* Left wing */}
              <div className="w-10 h-[2px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              {/* Center dot */}
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] mx-2 border border-white" />
              {/* Right wing */}
              <div className="w-10 h-[2px] bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
            </div>

            {/* Roll Degree Markers (Arch around top) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40 text-cyan-400" viewBox="0 0 100 100">
              <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1,4" />
              <path d="M 50 15 L 50 12" stroke="currentColor" strokeWidth="1.5" />
              <path d="M 32.5 20 L 34 22.5" stroke="currentColor" strokeWidth="1" />
              <path d="M 67.5 20 L 66 22.5" stroke="currentColor" strokeWidth="1" />
              {/* Roll pointer */}
              <polygon 
                points="50,16 47,20 53,20" 
                fill="#22d3ee" 
                style={{ 
                  transform: `rotate(${roll}deg)`, 
                  transformOrigin: '50px 50px',
                  transition: 'transform 100ms ease-out'
                }} 
              />
            </svg>

            {/* God Rays / Light Shafts */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25 mix-blend-screen z-[2]">
              <div className="absolute top-0 left-[20%] w-[12%] h-[120%] bg-gradient-to-b from-cyan-300/30 via-cyan-400/5 to-transparent origin-top rotate-[-15deg] blur-[2px]" />
              <div className="absolute top-0 left-[45%] w-[18%] h-[120%] bg-gradient-to-b from-cyan-300/40 via-cyan-400/10 to-transparent origin-top rotate-[-5deg] blur-[3px]" />
              <div className="absolute top-0 left-[70%] w-[10%] h-[120%] bg-gradient-to-b from-cyan-300/30 via-cyan-400/5 to-transparent origin-top rotate-[10deg] blur-[2px]" />
            </div>

            {/* Underwater Bubbles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-[3]">
              {bubbles.map((b) => (
                <div
                  key={b.id}
                  className="absolute rounded-full bg-cyan-300/30 border border-white/10"
                  style={{
                    left: `${b.x}%`,
                    bottom: `-10px`,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    animation: `floatUp ${b.speed}s linear infinite`,
                    animationDelay: `${b.delay}s`,
                    '--bubble-opacity': b.opacity,
                    '--bubble-drift': `${b.drift}px`
                  }}
                />
              ))}
            </div>

            {/* Subtle Water Ripple Grid Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.06),_transparent_70%)] animate-pulse pointer-events-none z-[1]" />
          </div>
        </div>

        {/* Right Column: Vertical Speed Tape */}
        <div className="w-14 flex items-stretch relative border-l border-cyan-800/20 pl-2 select-none">
          <div className="absolute top-0 bottom-0 left-1 w-[2px] bg-cyan-800/30" />
          <div className="flex-1 relative overflow-hidden">
            {speedTicks.map((tick, i) => (
              <div 
                key={i} 
                className="absolute left-0 flex items-center transition-all duration-75"
                style={{ top: `${tick.offsetPct}%`, transform: 'translateY(-50%)' }}
              >
                <div className={`h-[1px] bg-cyan-400 ${tick.val % 10 === 0 ? 'w-3' : 'w-1.5'}`} />
                <span className="text-[9px] ml-1.5 opacity-60 font-bold">{tick.val > 0 ? '+' : ''}{tick.val}</span>
              </div>
            ))}
          </div>
          {/* Speed Badge */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center bg-cyan-950 border-2 border-cyan-400 text-white rounded px-1.5 py-0.5 shadow-lg shadow-cyan-950 font-bold text-xs">
            {vertSpeed >= 0 ? (
              <ArrowUpRight size={10} className="mr-1 text-green-400" />
            ) : (
              <ArrowDownRight size={10} className="mr-1 text-red-400" />
            )}
            {vertSpeed.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Sliding Compass at the bottom */}
      <div className="h-10 sm:h-14 border-t border-cyan-800/30 mt-1 sm:mt-2 pt-1 sm:pt-2 flex flex-col items-center justify-between min-h-0 relative select-none">
        
        {/* Sliding compass container */}
        <div className="w-full h-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 z-10 pointer-events-none" />
          <div className="w-full h-full relative">
            {headingTicks.map((tick, i) => (
              <div 
                key={i}
                className="absolute top-0 flex flex-col items-center transition-all duration-75"
                style={{ left: `${tick.offsetPct}%`, transform: 'translateX(-50%)' }}
              >
                <span className={`text-[9px] font-bold mb-1 ${tick.isMajor ? 'text-cyan-300' : 'text-cyan-500/50'}`}>
                  {tick.label || '·'}
                </span>
                <div className={`w-[1px] bg-cyan-400 ${tick.isMajor ? 'h-3' : 'h-1.5'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Center Heading Indicator & digital readout */}
        <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 flex flex-col items-center z-20 pointer-events-none">
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-cyan-400 mb-0.5" />
          <div className="bg-cyan-950 border border-cyan-400 text-cyan-300 px-2.5 py-0.5 rounded text-[11px] font-bold shadow-md shadow-cyan-950/50 flex items-center gap-1.5">
            <Compass size={11} className="text-cyan-400" />
            {String(normalizedHdg).padStart(3, "0")}°
          </div>
        </div>
      </div>

      {/* Controls (demo mode only) */}
      {!hideControls && isDemo && (
        <div className="mt-3 pt-3 border-t border-cyan-800/20 flex flex-wrap gap-4 justify-center text-[10px] text-cyan-500/80 bg-cyan-950/20 p-2 rounded-lg">
          <label className="flex flex-col gap-1">
            Heading
            <input
              type="range"
              min={0}
              max={359}
              value={demoHeading}
              onChange={(e) => setDemoHeading(Number(e.target.value))}
              className="accent-cyan-500 w-24 h-1 bg-cyan-950 rounded"
            />
          </label>
          <label className="flex flex-col gap-1">
            Depth
            <input
              type="range"
              min={0}
              max={50}
              step={0.1}
              value={demoDepth}
              onChange={(e) => setDemoDepth(Number(e.target.value))}
              className="accent-cyan-500 w-24 h-1 bg-cyan-950 rounded"
            />
          </label>
          <label className="flex flex-col gap-1">
            Pitch
            <input
              type="range"
              min={-30}
              max={30}
              step={0.5}
              value={demoPitch}
              onChange={(e) => setDemoPitch(Number(e.target.value))}
              className="accent-cyan-500 w-24 h-1 bg-cyan-950 rounded"
            />
          </label>
          <label className="flex flex-col gap-1">
            Roll
            <input
              type="range"
              min={-45}
              max={45}
              step={0.5}
              value={demoRoll}
              onChange={(e) => setDemoRoll(Number(e.target.value))}
              className="accent-cyan-500 w-24 h-1 bg-cyan-950 rounded"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default PrimaryFlightDisplay;