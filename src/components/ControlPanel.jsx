import React from 'react';
import { SlidersHorizontal, Anchor, Move3d } from 'lucide-react';
import Joystick from './Joystick';

const ControlPanel = ({ 
    throttleLimit, setThrottleLimit,
    frontFinAngle, setFrontFinAngle,
    rearFinX, setRearFinX,
    rearFinY, setRearFinY,
    ballastActive, setBallastActive,
    driveMode, setDriveMode
}) => {
  return (
    <div className="flex flex-col gap-5 w-72 bg-zinc-950 p-4 border-l border-zinc-800 text-zinc-300 shrink-0 h-full overflow-y-auto">
      
      <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest border-b border-zinc-800 pb-2">
        Actuators & Controls
      </div>

      {/* Drive Mode Selector */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-1">
        <button 
            onClick={() => setDriveMode('forward')}
            className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${driveMode === 'forward' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
        >
            FWD
        </button>
        <button 
            onClick={() => setDriveMode('stopped')}
            className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${driveMode === 'stopped' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
        >
            STOP
        </button>
        <button 
            onClick={() => setDriveMode('reverse')}
            className={`flex-1 py-1 text-xs font-bold rounded transition-colors ${driveMode === 'reverse' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}`}
        >
            REV
        </button>
      </div>

      {/* Master Throttle Limiter */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg">
        <div className="flex items-center justify-between text-sm font-semibold">
           <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-blue-500" />
                THROTTLE LIMIT
           </div>
           <span className="font-mono text-blue-400">{throttleLimit}%</span>
        </div>
        <input 
            type="range" 
            min="0" max="100" step="10" 
            value={throttleLimit} 
            onChange={(e) => setThrottleLimit(parseInt(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600 font-mono">
            <span>0%</span>
            <span>RS-775 LIMITER</span>
            <span>100%</span>
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

      {/* Rear Fins (Empennage) - Joystick Control */}
      <div className="flex flex-col gap-2 p-3 bg-zinc-900 border border-border-zinc-800 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Move3d size={16} className="text-purple-500" />
            EMPENNAGE (REAR)
        </div>
        
        <Joystick 
            x={rearFinX} 
            y={rearFinY} 
            onChange={(newX, newY) => {
                setRearFinX(newX);
                setRearFinY(newY);
            }} 
        />
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
