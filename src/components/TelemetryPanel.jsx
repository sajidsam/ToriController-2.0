import React from 'react';
import { Waves, Zap, Gauge, Thermometer } from 'lucide-react';

const TelemetryPanel = ({ depth, amps, rpm, temp, tempError }) => {

  // Warnings
  const highAmps = amps > 15; // Motor Stall Risk
  const highRpm = rpm > 8000; // Cavitation Risk
  const highTemp = temp > 50; // Overheating
  const deepDepth = depth > 10; // Depth Warning

  return (
    <div className="flex flex-col lg:w-64 w-full bg-zinc-950 p-4 lg:border-r lg:border-b-0 border-b border-zinc-800 text-zinc-300 shrink-0 lg:h-full lg:overflow-y-auto">

      <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest border-b border-zinc-800 pb-2">
        Telemetry Data
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
      {/* Depth Gauge */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${deepDepth ? 'bg-red-950/30 border-red-900/50 text-red-400' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-semibold mb-1">
            <Waves size={16} className={deepDepth ? 'text-red-500 animate-bounce' : 'text-blue-500'} />
            DEPTH (m)
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {depth.toFixed(1)}
            <span className="text-lg text-zinc-600 ml-1">m</span>
        </div>
        {deepDepth && <div className="text-xs font-bold text-red-500 animate-pulse">MAX DEPTH WARNING</div>}
      </div>

      {/* ESC Current (Amps) */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${highAmps ? 'bg-orange-950/30 border-orange-900/50 text-orange-400' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-semibold mb-1">
            <Zap size={16} className={highAmps ? 'text-orange-500 animate-pulse' : 'text-yellow-500'} />
            ESC CURRENT
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {amps.toFixed(1)}
            <span className="text-lg text-zinc-600 ml-1">A</span>
        </div>
        {highAmps && <div className="text-xs font-bold text-orange-500">STALL RISK</div>}
      </div>

      {/* Motor RPM */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${highRpm ? 'bg-orange-950/30 border-orange-900/50 text-orange-400' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-semibold mb-1">
            <Gauge size={16} className={highRpm ? 'text-orange-500 animate-[spin_0.5s_linear_infinite]' : 'text-emerald-500 animate-[spin_3s_linear_infinite]'} />
            MOTOR RPM
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {Math.floor(rpm)}
            <span className="text-lg text-zinc-600 ml-1">rpm</span>
        </div>
        {highRpm && <div className="text-xs font-bold text-orange-500">CAVITATION RISK</div>}
      </div>

      {/* Internal Temperature */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors relative overflow-hidden ${tempError ? 'bg-rose-950/20 border-rose-900/40' : (highTemp ? 'bg-red-950/30 border-red-900/50 text-red-400' : 'bg-zinc-900 border-zinc-800')}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-semibold mb-1">
            <Thermometer size={16} className={highTemp ? 'text-red-500 animate-pulse' : 'text-orange-500'} />
            INTERNAL TEMP
        </div>
        <div className={`text-3xl font-mono font-bold tracking-tighter ${tempError ? 'opacity-30' : ''}`}>
            {temp.toFixed(1)}
            <span className="text-lg text-zinc-600 ml-1">°C</span>
        </div>
        {highTemp && !tempError && <div className="text-xs font-bold text-red-500">OVERHEATING</div>}

        {/* Error Overlay */}
        {tempError && (
             <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center border border-red-900/50 p-2 text-center rounded-lg">
                 <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest break-words w-full line-clamp-2 leading-tight">Error: {tempError}</span>
             </div>
        )}
      </div>

      </div>

    </div>
  );
};

export default TelemetryPanel;
