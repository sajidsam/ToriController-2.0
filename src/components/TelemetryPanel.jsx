import React from 'react';
import { Waves, Zap, Gauge, Thermometer } from 'lucide-react';

const TelemetryPanel = ({ depth, amps, rpm, temp, tempError, lat, lng, sats }) => {

  // Warnings
  const highAmps = amps > 15; // Motor Stall Risk
  const highRpm = rpm > 8000; // Cavitation Risk
  const highTemp = temp > 50; // Overheating
  const deepDepth = depth > 10; // Depth Warning

  return (
    <div className="flex flex-col lg:w-64 w-full bg-black p-4 lg:border-r lg:border-b-0 border-b border-white/20 text-white shrink-0 lg:h-full lg:overflow-y-auto">

      <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-widest border-b border-white/20 pb-2">
        Telemetry Data
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
      {/* Depth Gauge */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${deepDepth ? 'bg-white text-black animate-pulse border-white' : 'bg-white/5 border-white/10 text-white'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-70">
            <Waves size={16} className={deepDepth ? 'animate-bounce' : ''} />
            DEPTH (m)
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {depth.toFixed(1)}
            <span className="text-lg opacity-50 ml-1">m</span>
        </div>
        {deepDepth && <div className="text-xs font-bold uppercase">MAX DEPTH WARNING</div>}
      </div>

      {/* ESC Current (Amps) */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${highAmps ? 'bg-white text-black border-white animate-pulse' : 'bg-white/5 border-white/10 text-white'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-70">
            <Zap size={16} />
            ESC CURRENT
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {amps.toFixed(1)}
            <span className="text-lg opacity-50 ml-1">A</span>
        </div>
        {highAmps && <div className="text-xs font-bold uppercase">STALL RISK</div>}
      </div>

      {/* Motor RPM */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${highRpm ? 'bg-white text-black border-white animate-pulse' : 'bg-white/5 border-white/10 text-white'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-70">
            <Gauge size={16} className={highRpm ? 'animate-[spin_0.5s_linear_infinite]' : 'animate-[spin_3s_linear_infinite]'} />
            MOTOR RPM
        </div>
        <div className="text-3xl font-mono font-bold tracking-tighter">
            {Math.floor(rpm)}
            <span className="text-lg opacity-50 ml-1">rpm</span>
        </div>
        {highRpm && <div className="text-xs font-bold uppercase">CAVITATION RISK</div>}
      </div>

      {/* GPS Location */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors ${sats === -2 ? 'bg-white text-black border-white animate-pulse' : 'bg-white/5 border-white/10 text-white'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-70">
            GPS LOCATION
        </div>
        {sats === -2 ? (
            <div className="text-xs font-bold mt-2 uppercase">WIRING ERROR<br/>Check RX/TX pins</div>
        ) : (
            <>
                <div className="text-sm font-mono font-bold tracking-tighter opacity-90">
                    LAT: {lat === 0 ? "Wait..." : lat.toFixed(6)}
                </div>
                <div className="text-sm font-mono font-bold tracking-tighter opacity-90">
                    LNG: {lng === 0 ? "Wait..." : lng.toFixed(6)}
                </div>
                <div className="text-xs font-bold mt-1 opacity-50">
                    SATS: {sats === -1 ? "?" : sats} {sats === 0 ? "(NO FIX)" : ""}
                </div>
            </>
        )}
      </div>

      {/* Internal Temperature */}
      <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-colors relative overflow-hidden ${tempError || highTemp ? 'bg-white text-black border-white animate-pulse' : 'bg-white/5 border-white/10 text-white'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1 opacity-70">
            <Thermometer size={16} />
            INTERNAL TEMP
        </div>
        <div className={`text-3xl font-mono font-bold tracking-tighter ${tempError ? 'opacity-30' : ''}`}>
            {temp.toFixed(1)}
            <span className="text-lg opacity-50 ml-1">°C</span>
        </div>
        {highTemp && !tempError && <div className="text-xs font-bold uppercase">OVERHEATING</div>}

        {/* Error Overlay */}
        {tempError && (
             <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center border border-white p-2 text-center rounded-lg">
                 <span className="text-[10px] font-bold text-black uppercase tracking-widest break-words w-full line-clamp-2 leading-tight">Error: {tempError}</span>
             </div>
        )}
      </div>

      </div>

    </div>
  );
};

export default TelemetryPanel;
