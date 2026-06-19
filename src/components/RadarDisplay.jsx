import React, { useEffect, useRef, useCallback } from 'react';

const RadarDisplay = ({
  range = 6,
  gain = 1.0,
  mode = 'SEARCH',
  heading = 0,
  speedKnots = 0,
  depth = 0,
  amps = 0,
  selectedTarget = null,
  onTargetSelect = () => {}
}) => {
  const canvasRef = useRef(null);
  const radarStateRef = useRef({
    sweepAngle: 0,
    targets: [
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
    ]
  });

  const getColorByClassification = (classification) => {
    switch (classification) {
      case 'hostile': return '#ffffff';
      case 'friendly': return '#a1a1aa';
      case 'neutral': return '#71717a';
      default: return '#e4e4e7';
    }
  };

  const drawRadar = useCallback((sweepRad) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 30;

    const state = radarStateRef.current;
    const targets = state.targets;
    const sweepAngle = state.sweepAngle;
    const clutterFactor = Math.max(0, Math.min(1, (depth - 5) / 15)); // Depth-based clutter

    // Clear canvas with dark background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (maxRadius / 4) * i, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Radar screen circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';

    // Range rings with annotations
    const ringDistances = [2, 4, 6, 10, 20, 50];
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (let rNm of ringDistances) {
      if (rNm > range) continue;
      let radiusPx = (rNm / range) * maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radiusPx, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`${rNm}nm`, centerX + radiusPx - 16, centerY - radiusPx + 10);
    }
    ctx.restore();

    // Cardinal directions and bearing lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let ang = 0; ang < 360; ang += 45) {
      let rad = ang * Math.PI / 180;
      let x2 = centerX + Math.sin(rad) * maxRadius;
      let y2 = centerY - Math.cos(rad) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Cardinal direction labels
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - maxRadius - 14);
    ctx.fillText('S', centerX, centerY + maxRadius + 14);
    ctx.textAlign = 'right';
    ctx.fillText('W', centerX - maxRadius - 14, centerY + 4);
    ctx.textAlign = 'left';
    ctx.fillText('E', centerX + maxRadius + 14, centerY + 4);

    // Draw targets
    for (let target of targets) {
      let distNM = Math.hypot(target.x, target.y);
      if (distNM > range) continue;

      let normX = target.x / range;
      let normY = target.y / range;
      let px = centerX + normX * maxRadius;
      let py = centerY - normY * maxRadius;

      if (Math.hypot(px - centerX, py - centerY) > maxRadius) continue;

      let gainFactor = Math.min(2, Math.max(0.3, gain));
      let intensityFactor = target.intensity * (gainFactor * 0.8 + 0.3);
      let visibility = Math.min(1.0, Math.max(0.4, intensityFactor));

      // Bearing line from center to target
      if (mode === 'TRACK' && selectedTarget === target.name) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(px, py);
        ctx.strokeStyle = `rgba(255, 255, 255, ${visibility * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Target symbol
      let targetRadius = Math.max(4, Math.min(10, 6 * visibility));
      let color = getColorByClassification(target.classification);

      ctx.beginPath();
      ctx.arc(px, py, targetRadius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = visibility;
      ctx.fill();

      // Glow effect for threat level
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Target label
      if (mode !== 'SEARCH' || (selectedTarget === target.name)) {
        ctx.font = '10px monospace';
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.fillText(target.name, px + 10, py - 5);
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Own ship (center)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Own ship heading indicator (triangle)
    const shipHeadingRad = (heading * Math.PI) / 180;
    const arrowLen = 15;
    const arrowX = centerX + Math.sin(shipHeadingRad) * arrowLen;
    const arrowY = centerY - Math.cos(shipHeadingRad) * arrowLen;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(centerX - 5, centerY + 8);
    ctx.lineTo(centerX + 5, centerY + 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    // Speed vector
    if (speedKnots > 0.5 && mode === 'STABILIZED') {
      const speedVector = Math.min(speedKnots * 10, maxRadius * 0.3);
      const speedX = centerX + Math.sin(shipHeadingRad) * speedVector;
      const speedY = centerY - Math.cos(shipHeadingRad) * speedVector;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(speedX, speedY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Sweep line (Search/Track modes)
    if (mode === 'SEARCH' || mode === 'TRACK') {
      let sweepRadians = (sweepAngle * Math.PI) / 180;
      let lineEndX = centerX + Math.sin(sweepRadians) * maxRadius;
      let lineEndY = centerY - Math.cos(sweepRadians) * maxRadius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.stroke();

      // Sweep gradient wedge
      let grad = ctx.createLinearGradient(centerX, centerY, lineEndX, lineEndY);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      let angleOffset = 12 * (Math.PI / 180);
      let leftX = centerX + Math.sin(sweepRadians - angleOffset) * maxRadius * 0.9;
      let leftY = centerY - Math.cos(sweepRadians - angleOffset) * maxRadius * 0.9;
      let rightX = centerX + Math.sin(sweepRadians + angleOffset) * maxRadius * 0.9;
      let rightY = centerY - Math.cos(sweepRadians + angleOffset) * maxRadius * 0.9;
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Mode indicator
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(`[${mode}]`, 12, 20);

    // Sonar power indicator
    ctx.fillStyle = amps > 15 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`PWR: ${amps.toFixed(1)}A`, 12, 35);

    // Sea state indicator based on depth
    ctx.fillStyle = clutterFactor > 0.5 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(`DEPTH: ${depth.toFixed(1)}m`, 12, 50);
  }, [range, gain, mode, heading, speedKnots, depth, amps, selectedTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    let isRunning = true;
    let lastFrame = performance.now();

    const radarLoop = (nowMs) => {
      if (!isRunning) return;

      const delta = Math.min(0.05, (nowMs - lastFrame) / 1000);
      if (delta > 0.008) {
        const rotationSpeed = mode === 'SEARCH' ? 0.6 : mode === 'TRACK' ? 0.3 : 0;
        radarStateRef.current.sweepAngle = (radarStateRef.current.sweepAngle + 360 * delta * rotationSpeed) % 360;
        lastFrame = nowMs;
      } else {
        lastFrame = nowMs;
      }

      drawRadar(radarStateRef.current.sweepAngle * Math.PI / 180);
      requestAnimationFrame(radarLoop);
    };

    requestAnimationFrame(radarLoop);

    return () => {
      isRunning = false;
    };
  }, [drawRadar]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      style={{ display: 'block' }}
      onClick={(e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Find closest target to click
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        let closest = null;
        let closestDist = 20;
        for (let target of radarStateRef.current.targets) {
          const px = centerX + (target.x / range) * (Math.min(rect.width, rect.height) / 2 - 30);
          const py = centerY - (target.y / range) * (Math.min(rect.width, rect.height) / 2 - 30);
          const dist = Math.hypot(x - px, y - py);
          if (dist < closestDist) {
            closest = target.name;
            closestDist = dist;
          }
        }
        if (closest) onTargetSelect(closest);
      }}
    />
  );
};

export default RadarDisplay;
