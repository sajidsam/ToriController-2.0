import React from "react";
import heroIcon from '../assets/hero.ico';

const TitleBar = () => {
  const platform = window.electronAPI?.platform || "win32"; // default to win32 if not in electron
  const isMac = platform === "darwin";

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const macControls = (
    <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
      <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center group focus:outline-none">
         <span className="opacity-0 group-hover:opacity-100 text-[8px] leading-none text-red-900 font-bold mb-[1px]">x</span>
      </button>
      <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center group focus:outline-none">
         <span className="opacity-0 group-hover:opacity-100 text-[8px] leading-none text-yellow-900 font-bold mb-[1px]">-</span>
      </button>
      <button onClick={handleMaximize} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center group focus:outline-none">
         <span className="opacity-0 group-hover:opacity-100 text-[8px] leading-none text-green-900 font-bold mb-[1px]">+</span>
      </button>
    </div>
  );

  const winControls = (
    <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
      <button onClick={handleMinimize} className="hover:bg-white/20 px-4 h-full flex items-center justify-center text-xs focus:outline-none transition-colors">
        —
      </button>
      <button onClick={handleMaximize} className="hover:bg-white/20 px-4 h-full flex items-center justify-center text-xs focus:outline-none transition-colors">
        ▢
      </button>
      <button onClick={handleClose} className="hover:bg-red-600 px-4 h-full flex items-center justify-center text-xs hover:text-white focus:outline-none transition-colors">
        ✕
      </button>
    </div>
  );

  return (
    <div className="h-9 w-full flex items-center justify-between bg-black text-white select-none border-b border-white/20 relative" style={{ WebkitAppRegion: 'drag' }}>

      {isMac && <div className="pl-4">{macControls}</div>}

      {/* App Title & Logo */}
      <div className={`flex items-center gap-2 ${isMac ? 'absolute left-1/2 -translate-x-1/2' : 'pl-3'}`}>
        <img src={heroIcon} alt="Logo" className="w-4 h-4 pointer-events-none drop-shadow-none grayscale" />
        <span className="text-xs font-bold tracking-widest uppercase font-mono text-white">
          ToriController
        </span>
      </div>

      {!isMac && <div className="ml-auto h-full">{winControls}</div>}
      {isMac && <div className="pr-4"></div>} {/* Spacer for symmetry on Mac if needed */}
    </div>
  );
};

export default TitleBar;
