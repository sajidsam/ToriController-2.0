import React, { useRef } from 'react';
import { SlidersHorizontal, Anchor, Move3d } from 'lucide-react';
const ControlPanel = ({
    throttleLimit, setThrottleLimit,
    frontFinAngle, setFrontFinAngle,
    rearFinX, setRearFinX,
    rearFinY, setRearFinY,
    ballastActive, setBallastActive,
    driveMode, setDriveMode
}) => {
  const trackRef = useRef(null);

  const handlePointer = (e) => {
      // Only drag if mouse button is down, or if it's touch
      if (e.type !== 'pointerdown' && e.buttons !== 1) return;
      if (!trackRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = trackRef.current.getBoundingClientRect();
      const clientY = e.clientY;
      let pct = ((rect.bottom - clientY) / rect.height) * 100;
      pct = Math.max(0, Math.min(100, Math.round(pct / 5) * 5));
      setThrottleLimit(pct);
  };

  return (
    <div className="flex flex-col gap-5 lg:w-72 w-full bg-zinc-950 p-4 lg:border-l lg:border-t-0 border-t border-zinc-800 text-zinc-300 shrink-0 lg:h-full lg:overflow-y-auto">

      <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest border-b border-zinc-800 pb-2">
        Actuators & Controls
      </div>

      {/* Drive Mode Selector */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
        <button
            onClick={() => setDriveMode('forward')}
            className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${driveMode === 'forward' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
        >
            FORWARD
        </button>
        <button
            onClick={() => setDriveMode('stopped')}
            className={`flex-1 py-2 text-sm font-bold rounded transition-colors ${driveMode === 'stopped' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
        >
            STOP
        </button>
      </div>

      {/* Master Throttle Limiter - Airplane Style */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
        <div className="flex items-center justify-between text-sm font-semibold">
           <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-blue-500" />
                THROTTLE
           </div>
           <span className="font-mono text-blue-400 text-lg">{throttleLimit}%</span>
        </div>

        <div className="flex items-center justify-center py-6">
            <div
                className="relative h-48 w-16 bg-zinc-950 border border-zinc-800 rounded-full flex justify-center py-4 shadow-inner cursor-ns-resize touch-none"
                ref={trackRef}
                onPointerDown={handlePointer}
                onPointerMove={handlePointer}
            >
                {/* Vertical slider track */}
                <div className="relative w-2 h-full bg-black rounded-full pointer-events-none">
                    <div className="absolute bottom-0 w-full bg-blue-600/50 transition-all pointer-events-none rounded-b-full" style={{ height: `${throttleLimit}%` }} />
                    
                    {/* Custom Handle Thumb Overlay */}
                    <div
                        className="absolute w-28 h-10 left-1/2 -translate-x-1/2 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md border-y-2 border-x border-t-zinc-100 border-b-zinc-600 border-x-zinc-400 shadow-[0_10px_20px_rgba(0,0,0,0.5),_inset_0_2px_4px_rgba(255,255,255,0.8)] pointer-events-none transition-all duration-75 flex items-center justify-center flex-col gap-[3px] z-20"
                        style={{ bottom: `calc(${throttleLimit}% - 1.25rem)` }}
                    >
                        <div className="w-12 h-[2px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)]"></div>
                        <div className="w-12 h-[2px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)]"></div>
                        <div className="w-12 h-[2px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)]"></div>
                    </div>
                </div>

                {/* Markers */}
                <div className="absolute left-1/2 translate-x-6 h-[calc(100%-2rem)] top-4 flex flex-col justify-between text-[10px] font-mono text-zinc-500 font-bold pointer-events-none">
                    <span>MAX</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>MIN</span>
                </div>
            </div>
        </div>
      </div>

      {/* Front Fins (Bow Planes) */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg">
        <div className="flex items-center justify-between text-sm font-semibold">
           <div className="flex items-center gap-2">
                <Move3d size={16} className="text-emerald-500" />
                BOW PLANES (FRONT)
           </div>
           <span className="font-mono text-emerald-400">{frontFinAngle}°</span>
        </div>
        <div className="text-xs text-zinc-500 italic mb-1">Use A/D Keys</div>
        <input
            type="range"
            min="-45" max="45" step="1"
            value={frontFinAngle}
            onChange={(e) => setFrontFinAngle(parseInt(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600 font-mono">
            <span>DIVE (-45°)</span>
            <span>RISE (45°)</span>
        </div>
      </div>

      {/* Rear Fins (Empennage) - Keyboard Control */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Move3d size={16} className="text-purple-500" />
            EMPENNAGE (REAR)
        </div>

        <div className="flex justify-between gap-4 text-xs font-mono font-bold text-zinc-400 bg-zinc-950 p-2 rounded">
            <span>X (YAW): {rearFinX}°</span>
            <span>Y (PITCH): {rearFinY}°</span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono mt-1 text-center bg-zinc-950/50 py-1 rounded border border-zinc-800">Use Arrow Keys (↑↓←→)</div>
      </div>

      {/* Ballast / Pump Control */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg mt-auto">
        <div className="flex items-center justify-between text-sm font-semibold">
           <div className="flex items-center gap-2">
                <Anchor size={16} className={ballastActive ? 'text-cyan-400 animate-pulse' : 'text-zinc-600'} />
                BALLAST PUMP
           </div>
           <span className={`font-mono text-xs px-2 py-1 rounded ${ballastActive ? 'bg-cyan-900 text-cyan-300' : 'bg-zinc-800 text-zinc-500'}`}>
                {ballastActive ? 'ACTIVE (FILLING)' : 'IDLE'}
           </span>
        </div>
        <button
            onClick={() => setBallastActive(!ballastActive)}
            className={`w-full py-2 rounded font-bold transition-colors ${ballastActive ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
        >
            {ballastActive ? 'STOP PUMP' : 'ENGAGE PUMP'}
        </button>
      </div>

    </div>
  );
};

export default ControlPanel;
