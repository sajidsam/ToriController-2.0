import React, { useState, useCallback } from 'react';
import RadarDisplay from './RadarDisplay';
import RadarControls from './RadarControls';
import TargetInfoPanel from './TargetInfoPanel';

const AdvancedRadarNavigation = ({
  heading = 0,
  speedKnots = 0,
  depth = 0,
  amps = 0,
  pitch = 0,
  roll = 0
}) => {
  const [range, setRange] = useState(6);
  const [gain, setGain] = useState(1.0);
  const [mode, setMode] = useState('SEARCH');
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Mock targets - in real app would come from sonar data
  const targets = [
    { x: 2.3, y: 1.7, intensity: 0.92, classification: 'hostile', size: 1.0, name: 'TGT-001', speed: 8, course: 45, threatLevel: 85 },
    { x: -1.8, y: 3.2, intensity: 0.88, classification: 'friendly', size: 0.9, name: 'TGT-002', speed: 5, course: 200, threatLevel: 20 },
    { x: 4.2, y: -1.5, intensity: 0.76, classification: 'hostile', size: 0.95, name: 'TGT-003', speed: 12, course: 120, threatLevel: 72 },
    { x: -2.5, y: -2.7, intensity: 0.7, classification: 'neutral', size: 0.8, name: 'TGT-004', speed: 3, course: 90, threatLevel: 35 },
    { x: 0.8, y: 5.3, intensity: 0.65, classification: 'hostile', size: 0.7, name: 'TGT-005', speed: 15, course: 270, threatLevel: 95 },
    { x: 5.5, y: 2.1, intensity: 0.85, classification: 'friendly', size: 0.9, name: 'TGT-006', speed: 2, course: 0, threatLevel: 15 },
    { x: -4.2, y: 1.2, intensity: 0.78, classification: 'hostile', size: 0.88, name: 'TGT-007', speed: 10, course: 315, threatLevel: 68 },
    { x: 3.5, y: -3.9, intensity: 0.62, classification: 'neutral', size: 0.7, name: 'TGT-008', speed: 6, course: 180, threatLevel: 40 },
    { x: -3.3, y: -4.1, intensity: 0.69, classification: 'hostile', size: 0.82, name: 'TGT-009', speed: 20, course: 135, threatLevel: 90 },
    { x: 1.2, y: -1.3, intensity: 0.94, classification: 'hostile', size: 1.05, name: 'TGT-010', speed: 7, course: 225, threatLevel: 88 },
    { x: -0.9, y: -0.4, intensity: 0.9, classification: 'friendly', size: 0.9, name: 'TGT-011', speed: 4, course: 30, threatLevel: 10 },
    { x: -5.0, y: -0.8, intensity: 0.74, classification: 'hostile', size: 0.85, name: 'TGT-012', speed: 14, course: 60, threatLevel: 80 },
    { x: 2.8, y: 4.5, intensity: 0.68, classification: 'neutral', size: 0.75, name: 'TGT-013', speed: 5, course: 150, threatLevel: 25 }
  ];

  const handleTargetSelect = useCallback((targetName) => {
    setSelectedTarget(selectedTarget === targetName ? null : targetName);
  }, [selectedTarget]);

  return (
    <div className="flex flex-col gap-2 bg-gradient-to-b from-black/40 to-black/60 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-full lg:w-[280px] xl:w-[340px] shrink-0 lg:h-full lg:max-h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 bg-black/60 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <div className="text-white/80 text-xs font-bold uppercase tracking-widest font-mono">TACTICAL RADAR</div>
          <div className="text-white/50 text-[10px] font-mono mt-0.5">SONAR ACTIVE</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse"></div>
          <span className="text-white/80 text-[10px] font-mono font-bold">{Math.floor(heading).toString().padStart(3, '0')}°</span>
        </div>
      </div>

      {/* Main Radar Display */}
      <div className="px-3 pt-3 w-full flex-1 min-h-[120px] radar-display-container">
        <div className="w-full h-full rounded border border-white/20 overflow-hidden bg-black">
          <RadarDisplay
            range={range}
            gain={gain}
            mode={mode}
            heading={heading}
            speedKnots={speedKnots}
            depth={depth}
            amps={amps}
            selectedTarget={selectedTarget}
            onTargetSelect={handleTargetSelect}
          />
        </div>
      </div>

      {/* Controls & Info Panels */}
      <div className="px-3 pb-3 flex flex-col gap-2 shrink-0 radar-container">
        {/* Controls */}
        <RadarControls
          range={range}
          onRangeChange={setRange}
          gain={gain}
          onGainChange={setGain}
          mode={mode}
          onModeChange={setMode}
          amps={amps}
        />

        {/* Target Info Panel */}
        <TargetInfoPanel
          selectedTarget={selectedTarget}
          targets={targets}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default AdvancedRadarNavigation;
