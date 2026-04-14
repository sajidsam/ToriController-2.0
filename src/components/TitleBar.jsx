import React from "react";

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
    <div className="h-10 w-full flex items-center justify-between bg-zinc-900 text-white select-none px-3">
      
      {/* App Title */}
      <div className="text-sm font-semibold">
        Tori - The Vessel
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
