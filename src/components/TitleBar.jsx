import React from "react";
import heroIcon from '../assets/hero.ico';

const TitleBar = () => {
  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <div className="h-10 w-full flex items-center justify-between bg-zinc-900 text-white select-none px-3 border-b border-zinc-800" style={{ appRegion: 'drag' }}>

      {/* App Title & Logo */}
      <div className="flex items-center gap-2">
        <img src={heroIcon} alt="Logo" className="w-5 h-5 pointer-events-none drop-shadow-[0_0_8px_rgba(0,210,255,0.8)]" />
        <span className="text-sm font-bold tracking-wide font-mono text-zinc-200">
          ToriController
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-3">

        <button
          onClick={handleMinimize}
          className="hover:bg-zinc-700 px-2 rounded"
        >
          —
        </button>

        <button
          onClick={handleMaximize}
          className="hover:bg-zinc-700 px-2 rounded"
        >
          ▢
        </button>

        <button
          onClick={handleClose}
          className="hover:bg-red-600 px-2 rounded"
        >
          ✕
        </button>

      </div>
    </div>
  );
};

export default TitleBar;
