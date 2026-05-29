import React from 'react';
import { Volume2, Zap, Radio } from 'lucide-react';

const RadarControls = ({
  range = 6,
  onRangeChange = () => {},
  gain = 1.0,
  onGainChange = () => {},
  mode = 'SEARCH',
  onModeChange = () => {},
  amps = 0
}) => {
  const rangePresets = [2, 4, 6, 10, 20, 50];

  return (
    <div className="flex flex-col gap-3 bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-3 text-xs">
      {/* Mode Selection */}
      <div className="flex flex-col gap-2 border-b border-white/10 pb-2">
        <label className="text-white/80 font-bold uppercase tracking-widest text-[10px]">
          <Radio size={12} className="inline mr-1" /> Operating Mode
        </label>
        <div className="flex gap-1">
          {['SEARCH', 'TRACK', 'STABILIZED'].map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex-1 py-1 px-2 rounded border text-[9px] font-mono font-bold transition-all ${
                mode === m
                  ? 'bg-white/20 border-white/50 text-white shadow-lg shadow-white/20'
                  : 'bg-black/40 border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Range Control */}
      <div className="flex flex-col gap-2 border-b border-white/10 pb-2">
        <div className="flex justify-between items-center">
          <label className="text-white/80 font-bold uppercase tracking-widest text-[10px]">
            <Volume2 size={12} className="inline mr-1" /> Range
          </label>
          <span className="bg-black/60 text-white/90 px-2 py-0.5 rounded border border-white/30 font-mono text-[9px] font-bold">
            {range} NM
          </span>
        </div>
        <input
          type="range"
          min="2"
          max="50"
          step="0.5"
          value={range}
          onChange={(e) => onRangeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/10 rounded accent-white"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.4) ${((range-2)/(50-2))*100}%, rgba(255,255,255,0.1) ${((range-2)/(50-2))*100}%, rgba(255,255,255,0.1) 100%)`
          }}
        />
        <div className="grid grid-cols-6 gap-1">
          {rangePresets.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`py-1 px-1 rounded border text-[8px] font-mono font-bold transition-all ${
                Math.abs(range - r) < 0.5
                  ? 'bg-white/30 border-white/60 text-white'
                  : 'bg-black/40 border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Gain Control */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-white/80 font-bold uppercase tracking-widest text-[10px]">
            <Zap size={12} className="inline mr-1" /> Gain
          </label>
          <span className="bg-black/60 text-white/90 px-2 py-0.5 rounded border border-white/30 font-mono text-[9px] font-bold">
            {gain.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.05"
          value={gain}
          onChange={(e) => onGainChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/10 rounded accent-white"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.4) ${((gain-0.1)/(2.0-0.1))*100}%, rgba(255,255,255,0.1) ${((gain-0.1)/(2.0-0.1))*100}%, rgba(255,255,255,0.1) 100%)`
          }}
        />
      </div>

      {/* Status Indicators */}
      <div className="flex gap-2 bg-black/40 p-2 rounded border border-white/10">
        <div className="flex-1">
          <div className="text-[8px] text-white/60 uppercase tracking-widest font-bold">Sonar</div>
          <div className={`text-[10px] font-mono font-bold ${amps > 15 ? 'text-white' : 'text-white/80'}`}>
            {amps > 0 ? 'ACTIVE' : 'STANDBY'}
          </div>
        </div>
        <div className="w-px bg-white/20"></div>
        <div className="flex-1">
          <div className="text-[8px] text-white/60 uppercase tracking-widest font-bold">Signal</div>
          <div className="text-[10px] font-mono font-bold text-white/90">GOOD</div>
        </div>
      </div>
    </div>
  );
};

export default RadarControls;
