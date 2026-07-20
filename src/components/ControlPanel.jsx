import React, { useRef } from "react";
import { SlidersHorizontal, Anchor, Move3d } from "lucide-react";
const ControlPanel = ({
  throttleLimit,
  setThrottleLimit,
  bowAngle,
  setBowAngle,
  sharkAngle,
  setSharkAngle,
  driveMode,
  setDriveMode,
}) => {
  // No custom pointer tracking needed; using a native range input overlay.

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 lg:w-64 xl:w-72 w-full bg-black p-3 sm:p-4 lg:border-l lg:border-t-0 border-t border-white/20 text-white shrink-0 lg:h-full lg:overflow-y-auto overflow-y-auto control-panel-gap control-panel-padding">
      <div className="text-xs font-bold text-white/90 mb-2 uppercase tracking-widest border-b border-white/20 pb-2 control-panel-header">
        Actuators & Controls
      </div>

      {/* Drive Mode Selector */}
      <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
        <button
          onClick={() => { setDriveMode("forward"); setThrottleLimit(50); }}
          className={`flex-1 py-2 text-sm font-bold rounded transition-colors control-panel-btn ${driveMode === "forward" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"}`}
        >
          FWD
        </button>
        <button
          onClick={() => { setDriveMode("stopped"); setThrottleLimit(0); }}
          className={`flex-1 py-2 text-sm font-bold rounded transition-colors control-panel-btn ${driveMode === "stopped" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"}`}
        >
          STOP
        </button>
        <button
          onClick={() => { setDriveMode("reverse"); setThrottleLimit(-50); }}
          className={`flex-1 py-2 text-sm font-bold rounded transition-colors control-panel-btn ${driveMode === "reverse" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"}`}
        >
          REV
        </button>
      </div>

      {/* Master Throttle Limiter - Airplane Style */}
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center justify-between text-sm font-semibold opacity-95">
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
              min="-100"
              max="100"
              step="5"
              value={throttleLimit}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setThrottleLimit(val);
                if (val > 0) setDriveMode("forward");
                else if (val < 0) setDriveMode("reverse");
                else setDriveMode("stopped");
              }}
              className="absolute z-30 opacity-0 cursor-ns-resize control-panel-throttle-input"
            />

            {/* Vertical slider track (Visual Only) */}
            <div className="relative w-4 h-full bg-white/10 border border-white/20 rounded-full pointer-events-none shadow-inner">
              {throttleLimit > 0 && (
                <div
                  className="absolute bottom-1/2 w-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all rounded-t-full"
                  style={{ height: `${throttleLimit / 2}%` }}
                />
              )}
              {throttleLimit < 0 && (
                <div
                  className="absolute top-1/2 w-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all rounded-b-full"
                  style={{ height: `${Math.abs(throttleLimit) / 2}%` }}
                />
              )}

              {/* Custom Handle Thumb Overlay (Airplane Throttle Style) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-20 pointer-events-none transition-all duration-75"
                style={{
                  bottom: `calc(${((throttleLimit + 100) / 200) * 100}% - 24px)`, // 48px height -> center is 24px
                }}
              >
                <div className="w-40 h-12 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-950 rounded-[18px] border-t-2 border-zinc-500 border-b-4 border-b-black shadow-[0_20px_40px_rgba(0,0,0,0.9),_inset_0_4px_10px_rgba(255,255,255,0.2),_inset_0_-4px_10px_rgba(0,0,0,0.9)] flex items-center justify-center relative overflow-hidden">
                  
                  {/* Metallic Left/Right end caps */}
                  <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-zinc-600 to-transparent opacity-40"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-zinc-600 to-transparent opacity-40"></div>

                  {/* Horizontal Ribbed Grip Texture in the center */}
                  <div className="flex flex-col gap-[5px] w-16 z-10 opacity-90">
                    <div className="w-full h-[3px] bg-black rounded-full border-b border-zinc-600/60 shadow-[0_1px_1px_rgba(255,255,255,0.1)]"></div>
                    <div className="w-full h-[3px] bg-black rounded-full border-b border-zinc-600/60 shadow-[0_1px_1px_rgba(255,255,255,0.1)]"></div>
                    <div className="w-full h-[3px] bg-black rounded-full border-b border-zinc-600/60 shadow-[0_1px_1px_rgba(255,255,255,0.1)]"></div>
                    <div className="w-full h-[3px] bg-black rounded-full border-b border-zinc-600/60 shadow-[0_1px_1px_rgba(255,255,255,0.1)]"></div>
                  </div>

                  {/* Throttle Status LED Indicator (FWD/STOP/REV) */}
                  <div className="absolute left-4 flex flex-col items-center gap-[3px]">
                     <div className={`w-1.5 h-1.5 rounded-full border border-black/80 transition-all duration-300 ${
                        throttleLimit > 0 ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-zinc-900"
                     }`}></div>
                     <div className={`w-1.5 h-1.5 rounded-full border border-black/80 transition-all duration-300 ${
                        throttleLimit === 0 ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]" : "bg-zinc-900"
                     }`}></div>
                     <div className={`w-1.5 h-1.5 rounded-full border border-black/80 transition-all duration-300 ${
                        throttleLimit < 0 ? "bg-red-500 shadow-[0_0_8px_#ef4444]" : "bg-zinc-900"
                     }`}></div>
                  </div>

                  {/* Throttle Push Button (Decorative Auto-Throttle style) */}
                  <div className="absolute right-3 w-5 h-7 bg-red-700 rounded-md border-t border-red-500 border-b-2 border-b-black shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center">
                     <div className="w-3 h-4 bg-red-900 rounded-[3px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border-b border-red-500/50"></div>
                  </div>

                </div>
              </div>
            </div>

            {/* Markers and Tick Lines */}
            <div className="absolute left-1/2 translate-x-2 h-[calc(100%-2rem)] top-4 flex flex-col justify-between text-[10px] font-mono text-white/70 font-bold pointer-events-none">
              <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-white/50"></div><span>MAX</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-[1px] bg-white/30"></div><span>75</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-white/50"></div><span>50</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-[1px] bg-white/30"></div><span>25</span></div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-[2px] bg-amber-400/80"></div><span className="text-amber-400">STOP</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-[1px] bg-white/30"></div><span>-25</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-white/50"></div><span>-50</span></div>
              <div className="flex items-center gap-1.5"><div className="w-1.5 h-[1px] bg-white/30"></div><span>-75</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-[2px] bg-white/50"></div><span>MIN</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bow Servo */}
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center justify-between text-sm font-semibold opacity-95">
          <div className="flex items-center gap-2">
            <Move3d size={16} />
            BOW SERVO
          </div>
          <span className="font-mono text-white">{bowAngle}°</span>
        </div>
        <input
          type="range"
          min="-90"
          max="90"
          step="1"
          value={bowAngle}
          onChange={(e) => setBowAngle(parseInt(e.target.value))}
          className="w-full accent-white cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-white/50 font-mono">
          <span>-90°</span>
          <span>90°</span>
        </div>
      </div>

      {/* Shark Servo */}
      <div className="flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg control-panel-card">
        <div className="flex items-center justify-between text-sm font-semibold opacity-95">
          <div className="flex items-center gap-2">
            <Anchor size={16} />
            SHARK SERVO
          </div>
          <span className="font-mono text-white text-cyan-400 font-bold">{sharkAngle}°</span>
        </div>
        <div className="text-[10px] text-white/80 font-mono mt-1 mb-1 text-center bg-white/5 py-1 rounded border border-white/10 control-panel-hint">
          Use Left/Right Arrow Keys
        </div>
        <input
          type="range"
          min="0"
          max="180"
          step="1"
          value={sharkAngle}
          onChange={(e) => setSharkAngle(parseInt(e.target.value))}
          className="w-full accent-cyan-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-white/50 font-mono">
          <span>0°</span>
          <span>180°</span>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
