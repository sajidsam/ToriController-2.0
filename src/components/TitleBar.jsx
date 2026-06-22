import React from "react";
import heroIcon from '../assets/hero.ico';

const TitleBar = () => {
  const platform = window.electronAPI?.platform || "win32"; // default to win32 if not in electron
  const isMac = platform === "darwin";

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();



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

      {isMac && <div className="w-[75px]" />}

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
