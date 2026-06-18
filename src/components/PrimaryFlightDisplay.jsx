import { useState, useEffect, useRef } from "react";

const W = 588;
const H = 420;

// Horizon Y position (water/bottom boundary)
const HORIZON_Y = 270;
// Sonar cone apex
const APEX_X = W / 2;
const APEX_Y = 12;

function SonarDisplay({
  heading: propHeading,
  depth: propDepth,
  hideControls = true
}) {
  const canvasRef = useRef(null);

  const isDemo = propHeading === undefined && propDepth === undefined;

  const [demoHeading, setDemoHeading] = useState(41);
  const [demoDepth, setDemoDepth] = useState(2.6);
  const [demoVertSpeed, setDemoVertSpeed] = useState(0.0);

  const heading = isDemo ? demoHeading : propHeading;
  const depth = isDemo ? demoDepth : propDepth;

  const lastDepthRef = useRef(depth);
  const lastTimeRef = useRef(Date.now());
  const [calculatedVertSpeed, setCalculatedVertSpeed] = useState(0.0);

  useEffect(() => {
    if (isDemo) return;
    const now = Date.now();
    const dt = (now - lastTimeRef.current) / 1000 / 60; // minutes
    if (dt > 0.005) { // at least 300ms
      const dDepth = depth - lastDepthRef.current;
      const calculatedSpeed = dDepth / dt;
      if (Math.abs(calculatedSpeed) < 100) {
        setCalculatedVertSpeed(prev => prev + (calculatedSpeed - prev) * 0.15);
      }
      lastDepthRef.current = depth;
      lastTimeRef.current = now;
    }
  }, [depth, isDemo]);

  const vertSpeed = isDemo ? demoVertSpeed : calculatedVertSpeed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    draw(ctx);
  });

  function draw(ctx) {
    ctx.clearRect(0, 0, W, H);

    // ── Background ──────────────────────────────────────────────
    // Sky/water area (dark blue gradient)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    skyGrad.addColorStop(0, "#0a1628");
    skyGrad.addColorStop(0.5, "#0d2a5e");
    skyGrad.addColorStop(1, "#1145a0");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    // Bottom/sediment area
    const sedGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, H - 32);
    sedGrad.addColorStop(0, "#2a1a08");
    sedGrad.addColorStop(1, "#1a0f04");
    ctx.fillStyle = sedGrad;
    ctx.fillRect(0, HORIZON_Y, W, H - 32 - HORIZON_Y);

    // Bottom bar background
    ctx.fillStyle = "#0a0e18";
    ctx.fillRect(0, H - 32, W, 32);

    // ── Sonar Cone Glow ──────────────────────────────────────────
    // Bright central glow around apex
    const coneGlow = ctx.createRadialGradient(APEX_X, APEX_Y + 20, 10, APEX_X, APEX_Y + 60, 160);
    coneGlow.addColorStop(0, "rgba(180,220,255,0.35)");
    coneGlow.addColorStop(0.4, "rgba(80,160,255,0.12)");
    coneGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = coneGlow;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    // ── Sonar Cone Tick Marks ────────────────────────────────────
    // Radiating lines from apex (like clock hands, upper half)
    ctx.save();
    ctx.strokeStyle = "rgba(200,230,255,0.75)";
    ctx.lineWidth = 1.2;

    // angles from -90° (pointing down) spreading outward
    // We draw ticks at specific angles, centered on downward
    const tickAngles = [-70, -55, -40, -25, -10, 0, 10, 25, 40, 55, 70]; // degrees from vertical
    const shortLen = 22;
    const longLen = 38;

    tickAngles.forEach((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const isCenter = deg === 0;
      const isMajor = Math.abs(deg) % 25 === 0 || isCenter;
      const len = isCenter ? longLen + 10 : isMajor ? longLen : shortLen;

      // start from apex going outward
      const startDist = 8;
      const x1 = APEX_X + Math.sin(rad) * startDist;
      const y1 = APEX_Y + Math.cos(rad) * startDist;
      const x2 = APEX_X + Math.sin(rad) * (startDist + len);
      const y2 = APEX_Y + Math.cos(rad) * (startDist + len);

      ctx.lineWidth = isCenter ? 2 : 1.2;
      ctx.strokeStyle = isCenter
        ? "rgba(255,255,255,0.9)"
        : "rgba(180,215,255,0.65)";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    ctx.restore();

    // ── Horizontal Depth Scale Lines (water column) ──────────────
    // Lines at 10m and 20m with labels on both sides
    const depthScaleWater = [
      { label: "20", y: HORIZON_Y * 0.25 },
      { label: "10", y: HORIZON_Y * 0.6 },
    ];

    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillStyle = "rgba(180,210,255,0.85)";
    ctx.textAlign = "center";

    depthScaleWater.forEach(({ label, y }) => {
      // Left line segment
      ctx.strokeStyle = "rgba(180,210,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(220, y);
      ctx.stroke();
      // Right line segment
      ctx.beginPath();
      ctx.moveTo(368, y);
      ctx.lineTo(458, y);
      ctx.stroke();
      // Left label
      ctx.fillText(label, 105, y + 5);
      // Right label
      ctx.fillText(label, 483, y + 5);
    });

    // ── Horizontal Depth Scale Lines (sediment) ──────────────────
    const sedimentTop = HORIZON_Y + 10;
    const sedimentBot = H - 38;
    const sedimentH = sedimentBot - sedimentTop;

    const depthScaleSed = [
      { label: "10", y: sedimentTop + sedimentH * 0.38 },
      { label: "20", y: sedimentTop + sedimentH * 0.78 },
    ];

    depthScaleSed.forEach(({ label, y }) => {
      ctx.strokeStyle = "rgba(160,130,90,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(220, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(368, y);
      ctx.lineTo(458, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(180,155,110,0.85)";
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.fillText(label, 105, y + 5);
      ctx.fillText(label, 483, y + 5);
    });

    // ── Bottom Contour Wave ──────────────────────────────────────
    // Yellow wavy bottom line with subtle undulation
    const wavePoints = [];
    const waveSegments = 120;
    for (let i = 0; i <= waveSegments; i++) {
      const x = (i / waveSegments) * W;
      // Small bump in the center, otherwise near-flat
      const distFromCenter = Math.abs(x - W / 2) / (W / 2);
      const bump = distFromCenter < 0.25 ? Math.sin((distFromCenter / 0.25) * Math.PI) * 10 : 0;
      const noise = Math.sin(i * 0.7) * 1.5 + Math.sin(i * 1.3) * 0.8;
      wavePoints.push({ x, y: HORIZON_Y + bump + noise });
    }

    // Fill below the wave with sediment color gradient
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y + 20);
    wavePoints.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(W, HORIZON_Y + 20);
    ctx.closePath();
    const waveFill = ctx.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 20);
    waveFill.addColorStop(0, "#3a2510");
    waveFill.addColorStop(1, "#2a1a08");
    ctx.fillStyle = waveFill;
    ctx.fill();

    // Draw the yellow bottom line
    ctx.beginPath();
    ctx.moveTo(wavePoints[0].x, wavePoints[0].y);
    wavePoints.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#d4a800";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── Two Green Dots at Horizon Sides ──────────────────────────
    ctx.fillStyle = "#00ff44";
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(72, HORIZON_Y + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - 100, HORIZON_Y + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── TT Markers (right side at horizon) ───────────────────────
    ctx.fillStyle = "rgba(200,200,200,0.85)";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText("TT", W - 97, HORIZON_Y + 6);

    // ── Left Depth Bar (green vertical scale) ────────────────────
    drawDepthBar(ctx);

    // ── Right Vert Speed Bar ──────────────────────────────────────
    drawVertSpeedBar(ctx, vertSpeed);

    // ── Depth Value Badge (left) ──────────────────────────────────
    drawBadge(ctx, depth.toFixed(1), 14, 96, "#111", "#fff", true);

    // ── Vert Speed Badge (right) ──────────────────────────────────
    drawBadge(ctx, vertSpeed.toFixed(1), W - 68, 261, "#111", "#fff", false);

    // ── Apex Triangle ────────────────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(APEX_X, APEX_Y + 5);
    ctx.lineTo(APEX_X - 10, APEX_Y - 8);
    ctx.lineTo(APEX_X + 10, APEX_Y - 8);
    ctx.closePath();
    ctx.fill();

    // ── Column Headers ────────────────────────────────────────────
    ctx.fillStyle = "rgba(180,210,255,0.8)";
    ctx.font = "11px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText("DEPTH (m)", 6, 14);
    ctx.textAlign = "right";
    ctx.fillText("VERT SPEED", W - 4, 14);
    ctx.fillText("(m/min)", W - 4, 26);

    // ── Compass Strip ────────────────────────────────────────────
    drawCompass(ctx, heading);
  }

  function drawDepthBar(ctx) {
    // Green vertical bar on the left side
    const barX = 44;
    const barTop = 20;
    const barBot = H - 38;
    const barH = barBot - barTop;

    // Scale marks: 0 at top, -50 at bottom
    ctx.strokeStyle = "rgba(180,210,255,0.5)";
    ctx.lineWidth = 1;
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = "rgba(180,210,255,0.75)";
    ctx.textAlign = "right";

    const depthTicks = [0, 10, 20, 30, 40, 50];
    depthTicks.forEach((d) => {
      const y = barTop + (d / 50) * barH;
      ctx.beginPath();
      ctx.moveTo(barX - 5, y);
      ctx.lineTo(barX + 5, y);
      ctx.stroke();
      ctx.fillText(`-${d === 0 ? "0" : d}`, barX - 7, y + 4);
    });

    // Minor ticks every 5m
    for (let d = 5; d <= 45; d += 10) {
      const y = barTop + (d / 50) * barH;
      ctx.beginPath();
      ctx.moveTo(barX - 3, y);
      ctx.lineTo(barX + 3, y);
      ctx.stroke();
    }

    // Green bar
    ctx.strokeStyle = "#00cc44";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(barX + 8, barTop);
    ctx.lineTo(barX + 8, barBot);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawVertSpeedBar(ctx, speed) {
    const barX = W - 44;
    const barMid = (H - 38) / 2 + 20; // middle = 0 m/min
    const barTop = 20;
    const barBot = H - 38;
    const halfH = (barBot - barTop) / 2;

    ctx.strokeStyle = "rgba(180,210,255,0.5)";
    ctx.lineWidth = 1;
    ctx.font = "10px 'Courier New', monospace";
    ctx.fillStyle = "rgba(180,210,255,0.75)";
    ctx.textAlign = "left";

    const speedTicks = [20, 10, 0, -10, -20];
    speedTicks.forEach((s) => {
      const y = barMid - (s / 20) * halfH;
      ctx.beginPath();
      ctx.moveTo(barX - 5, y);
      ctx.lineTo(barX + 5, y);
      ctx.stroke();
      if (s !== 0) ctx.fillText(`${s > 0 ? "" : ""}${s}`, barX + 7, y + 4);
      else ctx.fillText("0", barX + 7, y + 4);
    });

    // Minor ticks
    for (const s of [15, 5, -5, -15]) {
      const y = barMid - (s / 20) * halfH;
      ctx.beginPath();
      ctx.moveTo(barX - 3, y);
      ctx.lineTo(barX + 3, y);
      ctx.stroke();
    }

    // Green bar
    ctx.strokeStyle = "#00cc44";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00ff44";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(barX - 8, barTop);
    ctx.lineTo(barX - 8, barBot);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Speed indicator line
    const clampedSpeed = Math.max(-20, Math.min(20, speed));
    const indicatorY = barMid - (clampedSpeed / 20) * halfH;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX - 14, indicatorY);
    ctx.lineTo(barX - 2, indicatorY);
    ctx.stroke();
  }

  function drawBadge(ctx, text, x, y, bg, fg, leftSide) {
    const w = 58;
    const h = 26;
    // Arrow badge pointing left or right
    ctx.fillStyle = bg;
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;

    if (leftSide) {
      // Rectangle with left-pointing arrow
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 8 + w, y);
      ctx.lineTo(x + 8 + w, y + h);
      ctx.lineTo(x + 8, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
    } else {
      // Rectangle with right-pointing arrow
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w + 8, y + h / 2);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, x + (leftSide ? 8 : 0) + w / 2, y + h / 2 + 5);
  }

  function drawCompass(ctx, hdg) {
    const barY = H - 32;
    const barH = 32;
    const cx = W / 2;

    // Background already drawn
    ctx.fillStyle = "rgba(10,14,24,0.95)";
    ctx.fillRect(0, barY, W, barH);

    // Compass ticks and labels
    // Show ±60° around current heading
    const range = 80;
    const degPerPx = W / (range * 2); // pixels per degree

    const compassLabels = {
      0: "N", 30: "030", 60: "060", 90: "E",
      120: "120", 150: "150", 180: "S",
      210: "210", 240: "240", 270: "W",
      300: "300", 330: "330", 360: "N",
    };

    ctx.save();
    ctx.rect(0, barY, W, barH);
    ctx.clip();

    for (let d = -180; d <= 540; d += 5) {
      const norm = ((d % 360) + 360) % 360;
      const diff = d - hdg;
      const x = cx + diff * degPerPx;

      if (x < -20 || x > W + 20) continue;

      const isMajor = norm % 30 === 0;
      const isMid = norm % 10 === 0 && !isMajor;

      ctx.strokeStyle = "rgba(180,210,255,0.7)";
      ctx.lineWidth = isMajor ? 1.5 : 1;

      const tickH = isMajor ? 10 : isMid ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(x, barY + 4);
      ctx.lineTo(x, barY + 4 + tickH);
      ctx.stroke();

      if (isMajor) {
        const label = compassLabels[norm] || `${norm}`;
        ctx.fillStyle = "rgba(180,210,255,0.85)";
        ctx.font = "10px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, x, barY + barH - 4);
      }
    }

    ctx.restore();

    // Center heading box
    const boxW = 52;
    const boxH = 22;
    ctx.fillStyle = "#1a2040";
    ctx.strokeStyle = "#aabbdd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(cx - boxW / 2, barY + 5, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${String(hdg).padStart(3, "0")}°`, cx, barY + 5 + boxH / 2 + 5);

    // Center tick arrow (top)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx, barY - 1);
    ctx.lineTo(cx - 6, barY + 6);
    ctx.lineTo(cx + 6, barY + 6);
    ctx.closePath();
    ctx.fill();

    // Left / Right arrows + N E labels
    ctx.fillStyle = "rgba(180,210,255,0.85)";
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText("◄", 8, barY + barH / 2 + 5);
    ctx.textAlign = "right";
    ctx.fillText("►", W - 8, barY + barH / 2 + 5);
  }

  // Simulate slight drift for demo
  useEffect(() => {
    if (!isDemo) return;
    const id = setInterval(() => {
      setDemoHeading((h) => (h + (Math.random() - 0.5) * 0.1 + 360) % 360);
    }, 100);
    return () => clearInterval(id);
  }, [isDemo]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div
        style={{
          position: "relative",
          border: "2px solid #1a2a4a",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 0 40px rgba(0,80,200,0.3)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e18",
        }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Controls - only shown in demo mode or when explicitly allowed */}
      {!hideControls && isDemo && (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 24,
            color: "#aaccff",
            fontSize: 13,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Heading (°)
            <input
              type="range"
              min={0}
              max={359}
              value={demoHeading}
              onChange={(e) => setDemoHeading(Number(e.target.value))}
              style={{ accentColor: "#00aaff" }}
            />
            <span style={{ textAlign: "center" }}>{demoHeading.toFixed(0)}°</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Depth (m)
            <input
              type="range"
              min={0}
              max={50}
              step={0.1}
              value={demoDepth}
              onChange={(e) => setDemoDepth(Number(e.target.value))}
              style={{ accentColor: "#00aaff" }}
            />
            <span style={{ textAlign: "center" }}>{demoDepth.toFixed(1)} m</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            Vert Speed (m/min)
            <input
              type="range"
              min={-20}
              max={20}
              step={0.1}
              value={demoVertSpeed}
              onChange={(e) => setDemoVertSpeed(Number(e.target.value))}
              style={{ accentColor: "#00aaff" }}
            />
            <span style={{ textAlign: "center" }}>{demoVertSpeed.toFixed(1)} m/min</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default SonarDisplay;