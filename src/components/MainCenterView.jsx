import React from 'react';
import { CameraOff, Navigation, Crosshair, FastForward, Move3d } from 'lucide-react';

const MainCenterView = ({ pitch = 0, roll = 0, heading = 0, speedKnots = 0, frontFinAngle = 0, rearFinX = 0, rearFinY = 0 }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black p-4 relative overflow-hidden h-full gap-4">

        {/* Mock Camera Feed Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#001122] to-[#000a14] opacity-50 z-0"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-black z-0 pointer-events-none"></div>

        {/* Camera Feed Placeholder box */}
        <div className="relative z-10 w-full max-w-4xl aspect-video bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center ring-1 ring-white/5 backdrop-blur-sm">
            <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">REC</span>
                <span className="bg-black/50 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur">CAM 1: FRONT</span>
            </div>

            <div className="text-zinc-700 flex flex-col items-center gap-2">
                <CameraOff size={48} className="opacity-50" />
                <span className="text-sm font-mono tracking-widest font-bold opacity-50">NO SIGNAL DETECTED</span>
                <span className="text-xs font-mono opacity-30">Awaiting WebRTC Stream</span>
            </div>

            {/* Center Crosshair Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <Crosshair size={120} className="text-green-500/20" strokeWidth={1} />
            </div>
        </div>

        {/* Attitude and Compass Overlay underneath camera */}
        <div className="relative z-10 flex gap-8 w-full max-w-4xl justify-center mt-4">

            {/* Artificial Horizon (Textual & Basic Visual for now) */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-4 rounded-xl flex-1 flex items-center gap-6 shadow-xl">
                <div className="flex flex-col gap-1 items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800 min-w-[80px]">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Pitch</span>
                    <span className="text-2xl font-mono text-cyan-400 font-bold flex items-center gap-1">
                        {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}°
                    </span>
                </div>
                <div className="flex-1 max-w-[200px] h-1 bg-zinc-800 rounded relative shadow-inner overflow-hidden mx-auto">
                     {/* Pitch line representation */}
                     <div
                        className="absolute h-[20px] w-[50px] bg-cyan-500/50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ transform: `translate(-50%, -50%) rotate(${pitch}deg)`}}
                      />
                      <div className="absolute w-full h-[1px] bg-cyan-400/50 top-1/2 -translate-y-1/2" style={{ transform: `translateY(${pitch}px)`}} />
                </div>
                <div className="flex flex-col gap-1 items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800 min-w-[80px]">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Roll</span>
                    <span className="text-2xl font-mono text-cyan-400 font-bold flex items-center gap-1">
                        {roll > 0 ? '+' : ''}{roll.toFixed(1)}°
                    </span>
                </div>
            </div>

            {/* Speed Indicator */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-4 rounded-xl flex items-center justify-between shadow-xl gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-zinc-700 bg-zinc-950 flex items-center justify-center">
                    <FastForward size={18} className="text-emerald-500" />
                </div>
                <div className="flex flex-col gap-1 text-right">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Speed</span>
                    <span className="text-3xl font-mono text-emerald-400 font-bold">{speedKnots.toFixed(1)}<span className="text-sm ml-1 text-zinc-500">kt</span></span>
                </div>
            </div>

            {/* Compass Heading */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-4 rounded-xl flex items-center justify-between shadow-xl gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Heading</span>
                    <span className="text-3xl font-mono text-yellow-500 font-bold">{Math.floor(heading).toString().padStart(3, '0')}°</span>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-zinc-700 bg-zinc-950 flex items-center justify-center relative shadow-inner">
                    <Navigation
                        size={20}
                        className="text-yellow-500 transition-transform duration-300"
                        style={{ transform: `rotate(${heading}deg)` }}
                    />
                    <div className="absolute top-0 text-[8px] font-bold text-zinc-600 -mt-3">N</div>
                </div>
            </div>

            {/* Live Fin Deflection Readout */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700 p-3 rounded-xl flex flex-col justify-center shadow-xl gap-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest border-b border-zinc-800 pb-1 mb-1 flex items-center gap-1">
                    <Move3d size={10} /> Control Surfaces
                </span>
                <div className="flex justify-between gap-4 text-xs font-mono">
                    <span className="text-zinc-400">BOW:</span>
                    <span className={`${frontFinAngle === 0 ? 'text-zinc-500' : 'text-cyan-400 font-bold'}`}>{frontFinAngle > 0 ? '+' : ''}{frontFinAngle}°</span>
                </div>
                <div className="flex justify-between gap-4 text-xs font-mono">
                    <span className="text-zinc-400">YAW:</span>
                    <span className={`${rearFinX === 0 ? 'text-zinc-500' : 'text-purple-400 font-bold'}`}>{rearFinX > 0 ? '+' : ''}{rearFinX}°</span>
                </div>
                <div className="flex justify-between gap-4 text-xs font-mono">
                    <span className="text-zinc-400">PTCH:</span>
                    <span className={`${rearFinY === 0 ? 'text-zinc-500' : 'text-purple-400 font-bold'}`}>{rearFinY > 0 ? '+' : ''}{rearFinY}°</span>
                </div>
            </div>

        </div>
    </div>
  );
};

export default MainCenterView;
