import React from 'react';
import { Waves, Zap, Gauge, Thermometer } from 'lucide-react';

const TelemetryPanel = ({ depth, amps, rpm, temp }) => {

  // Warnings
  const highAmps = amps > 15; // Motor Stall Risk
  const highRpm = rpm > 8000; // Cavitation Risk
  const highTemp = temp > 50; // Overheating
  const deepDepth = depth > 10; // Depth Warning

  return (
    <div className="flex flex-col gap-3 w-64 bg-zinc-950 p-4 border-r border-zinc-800 text-zinc-300 shrink-0 h-full overflow-y-auto">

      <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-widest border-b border-zinc-800 pb-2">
        Telemetry Data
      </div>

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
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${highTemp ? 'bg-red-950/30 border-red-900/50 text-red-400' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-semibold mb-1">
            <Thermometer size={16} className={highTemp ? 'text-red-500 animate-pulse' : 'text-orange-500'} />
            INTERNAL TEMP
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {temp.toFixed(1)}
            <span className="text-lg text-zinc-600 ml-1">°C</span>
        </div>
        {highTemp && <div className="text-xs font-bold text-red-500">OVERHEATING</div>}
      </div>

    </div>
  );
};

export default TelemetryPanel;
