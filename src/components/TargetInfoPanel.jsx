import React from 'react';
import { Target, AlertCircle } from 'lucide-react';

const TargetInfoPanel = ({ selectedTarget, targets, mode }) => {
  const target = selectedTarget && targets.find(t => t.name === selectedTarget);

    if (!target || mode === 'SEARCH') {
      return (
        <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-3 text-xs shrink-0">
          <div className="text-white font-bold uppercase tracking-widest text-[10px]">
            <Target size={12} className="inline mr-1" /> Target Info
          </div>
          <div className="flex-1 flex items-center justify-center text-white/80 font-mono text-[11px] py-4">
            SELECT TARGET ON RADAR
          </div>
        </div>
      );
    }

  const cpaDist = Math.hypot(target.x, target.y) * 0.5; // Simplified CPA
  const threatWarning = target.threatLevel > 70;
  const bearing = (Math.atan2(target.x, target.y) * 180 / Math.PI + 360) % 360;

  return (
    <div className="flex flex-col gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-3 text-xs shrink-0">
      {/* Target Header */}
      <div className="flex justify-between items-start border-b border-white/10 pb-2">
        <div>
          <div className="text-white font-bold uppercase tracking-widest text-[10px]">
            <Target size={12} className="inline mr-1" /> {target.name}
          </div>
          <div className={`text-[9px] font-mono uppercase font-bold mt-0.5 ${
            target.classification === 'hostile' ? 'text-white' :
            target.classification === 'friendly' ? 'text-white/85' :
            'text-white/75'
          }`}>
            {target.classification.toUpperCase()}
          </div>
        </div>
        {threatWarning && (
          <div className="flex items-center gap-1 text-white animate-pulse">
            <AlertCircle size={14} />
            <span className="text-[9px] font-bold">HIGH THREAT</span>
          </div>
        )}
      </div>

      {/* Target Position & Motion */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">Bearing</div>
          <div className="text-white/95 font-mono font-bold text-[11px]">{bearing.toFixed(0)}°T</div>
        </div>
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">Range</div>
          <div className="text-white/95 font-mono font-bold text-[11px]">{Math.hypot(target.x, target.y).toFixed(1)}nm</div>
        </div>
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">Speed</div>
          <div className="text-white/95 font-mono font-bold text-[11px]">{target.speed}kt</div>
        </div>
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">Course</div>
          <div className="text-white/95 font-mono font-bold text-[11px]">{target.course.toFixed(0)}°</div>
        </div>
      </div>

      {/* CPA & Threat */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">CPA</div>
          <div className={`font-mono font-bold text-[11px] ${cpaDist < 1 ? 'text-white animate-pulse' : 'text-white/85'}`}>
            {cpaDist.toFixed(2)}nm
          </div>
        </div>
        <div className="bg-black/40 p-1.5 rounded border border-white/10">
          <div className="text-white/80 uppercase tracking-widest font-bold text-[8px]">Threat</div>
          <div className={`font-mono font-bold text-[11px] ${target.threatLevel > 70 ? 'text-white' : 'text-white/85'}`}>
            {target.threatLevel}%
          </div>
        </div>
      </div>

      {/* Threat Level Bar */}
      <div className="flex items-center gap-2">
        <div className="text-[8px] text-white/80 uppercase tracking-widest font-bold">Threat</div>
        <div className="flex-1 h-1.5 bg-black/60 rounded overflow-hidden border border-white/10">
          <div
            className={`h-full transition-all ${target.threatLevel > 70 ? 'bg-white' : target.threatLevel > 40 ? 'bg-white/80' : 'bg-white/60'}`}
            style={{ width: `${Math.min(target.threatLevel, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TargetInfoPanel;
