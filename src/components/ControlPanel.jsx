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
  // No custom pointer tracking needed; using a native range input overlay.

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 lg:w-64 xl:w-72 w-full bg-black p-3 sm:p-4 lg:border-l lg:border-t-0 border-t border-white/20 text-white shrink-0 lg:h-full lg:overflow-y-auto overflow-y-auto control-panel-gap control-panel-padding">

      <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-widest border-b border-white/20 pb-2 control-panel-header">
        Actuators & Controls
      </div>

      {/* Drive Mode Selector */}
      <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
        <button
            onClick={() => setDriveMode('forward')}
            className={`flex-1 py-2 text-sm font-bold rounded transition-colors control-panel-btn ${driveMode === 'forward' ? 'bg-white text-black' : 'text-white/50 hover:bg-white/10'}`}
        >
            FORWARD
        </button>
        <button
            onClick={() => setDriveMode('stopped')}
            className={`flex-1 py-2 text-sm font-bold rounded transition-colors control-panel-btn ${driveMode === 'stopped' ? 'bg-white text-black' : 'text-white/50 hover:bg-white/10'}`}
        >
            STOP
        </button>
      </div>

      {/* Master Throttle Limiter - Airplane Style */}
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center justify-between text-sm font-semibold opacity-70">
           <div className="flex items-center gap-2">
                 <SlidersHorizontal size={16} />
                 THROTTLE
           </div>
           <span className="font-mono text-white text-lg">{throttleLimit}%</span>
        </div>

        <div className="flex items-center justify-center py-1 sm:py-2 md:py-3 control-panel-throttle-wrapper">
            <div className="relative h-96 w-28 bg-white/5 border border-white/20 rounded-full flex justify-center py-4 shadow-inner control-panel-throttle">

                {/* INVISIBLE NATIVE RANGE INPUT OVERLAY */}
                <input
                    type="range"
                    min="0" max="100" step="5"
                    value={throttleLimit}
                    onChange={(e) => setThrottleLimit(parseInt(e.target.value))}
                    className="absolute z-30 opacity-0 cursor-ns-resize control-panel-throttle-input"
                />

                {/* Vertical slider track (Visual Only) */}
                <div className="relative w-4 h-full bg-white/10 border border-white/20 rounded-full pointer-events-none shadow-inner">
                    <div className="absolute bottom-0 w-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all rounded-b-full" style={{ height: `${throttleLimit}%` }} />

                    {/* Custom Handle Thumb Overlay */}
                    <div
                        className="absolute w-32 h-12 throttle-handle left-1/2 -translate-x-1/2 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md border-y-2 border-x border-t-zinc-100 border-b-zinc-600 border-x-zinc-400 shadow-[0_10px_20px_rgba(0,0,0,0.5),_inset_0_2px_4px_rgba(255,255,255,0.8)] transition-all duration-75 flex items-center justify-center flex-col gap-[4px] z-20"
                        style={{ bottom: `calc(${throttleLimit}% - var(--throttle-handle-offset, 1.5rem))` }}
                    >
                        <div className="w-16 h-[3px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)] pointer-events-none"></div>
                        <div className="w-16 h-[3px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)] pointer-events-none"></div>
                        <div className="w-16 h-[3px] bg-zinc-500 rounded-full shadow-[0_1px_0_rgba(255,255,255,0.7)] pointer-events-none"></div>
                    </div>
                </div>

                {/* Markers */}
                <div className="absolute left-1/2 translate-x-10 h-[calc(100%-2rem)] top-4 flex flex-col justify-between text-[11px] font-mono text-white/50 font-bold pointer-events-none">
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
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center justify-between text-sm font-semibold opacity-70">
           <div className="flex items-center gap-2">
                <Move3d size={16} />
                BOW PLANES (FRONT)
           </div>
           <span className="font-mono text-white">{frontFinAngle}°</span>
        </div>
        <div className="text-xs text-white/50 italic mb-1">Use A/D Keys</div>
        <input
            type="range"
            min="-45" max="45" step="1"
            value={frontFinAngle}
            onChange={(e) => setFrontFinAngle(parseInt(e.target.value))}
            className="w-full accent-white cursor-pointer"
        />
        <div className="flex justify-between text-xs text-white/50 font-mono">
            <span>DIVE (-45°)</span>
            <span>RISE (45°)</span>
        </div>
      </div>

      {/* Rear Fins (Empennage) - Keyboard Control */}
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2 opacity-70 control-panel-card-title">
            <Move3d size={16} />
            EMPENNAGE (REAR)
        </div>

        <div className="flex justify-between gap-4 text-xs font-mono font-bold text-white bg-white/10 border border-white/20 p-2 rounded control-panel-readout">
            <span>X (YAW): {rearFinX}°</span>
            <span>Y (PITCH): {rearFinY}°</span>
        </div>
        <div className="text-[10px] text-white/50 font-mono mt-1 text-center bg-white/5 py-1 rounded border border-white/10 control-panel-hint">Use Arrow Keys (↑↓←→)</div>
      </div>

      {/* Ballast / Pump Control */}
      {/* <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg mt-auto">
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
      </div> */}

    </div>
  );
};

export default ControlPanel;
