import React, { useState, useEffect, useRef, useMemo } from "react";

function PrimaryFlightDisplay({
  heading: propHeading,
  depth: propDepth,
  pitch: propPitch,
  roll: propRoll,
  temp: propTemp,
}) {
  /* ── Demo / live mode ─────────────────────────────────────── */
  const isDemo = propHeading === undefined && propDepth === undefined;

  const [demoH, setDemoH] = useState(41);
  const [demoD, setDemoD] = useState(2.6);
  const [demoP, setDemoP] = useState(0.0);
  const [demoR, setDemoR] = useState(0.0);
  const [demoT, setDemoT] = useState(22.4);

  useEffect(() => {
    if (!isDemo) return;
    const id = setInterval(() => {
      setDemoH(h => (h + (Math.random() - 0.5) * 0.2 + 360) % 360);
      setDemoP(() => Math.sin(Date.now() / 2800) * 10);
      setDemoR(() => Math.cos(Date.now() / 3200) * 14);
      setDemoD(d => Math.max(0, d + Math.sin(Date.now() / 5000) * 0.025));
      setDemoT(t => Math.min(60, Math.max(14, t + (Math.random() - 0.5) * 0.05)));
    }, 80);
    return () => clearInterval(id);
  }, [isDemo]);

  const heading = isDemo ? demoH : (propHeading ?? 0);
  const depth = isDemo ? demoD : (propDepth ?? 0);
  const pitch = isDemo ? demoP : (propPitch ?? 0);
  const roll = isDemo ? demoR : (propRoll ?? 0);
  const temp = isDemo ? demoT : (propTemp ?? 0);

  /* ── Vertical speed ───────────────────────────────────────── */
  const lastDRef = useRef(depth);
  const lastTRef = useRef(Date.now());
  const [vertSpeed, setVertSpeed] = useState(0);
  useEffect(() => {
    if (isDemo) return;
    const now = Date.now();
    const dt = (now - lastTRef.current) / 1000 / 60;
    if (dt > 0.005) {
      const spd = (depth - lastDRef.current) / dt;
      if (Math.abs(spd) < 100) setVertSpeed(p => p + (spd - p) * 0.15);
      lastDRef.current = depth;
      lastTRef.current = now;
    }
  }, [depth, isDemo]);

  /* ── Derived values ───────────────────────────────────────── */
  const normalizedHdg = ((Math.round(heading) % 360) + 360) % 360;
  const pitchPx = Math.max(-30, Math.min(30, pitch)) * 3;
  const clampedRoll = Math.max(-60, Math.min(60, roll));
  const tempWarning = temp > 50;

  /* ── Compass tape ticks ───────────────────────────────────── */
  const compassTicks = useMemo(() => {
    const range = 60, ticks = [];
    const s = Math.floor((heading - range) / 5) * 5;
    const e = Math.ceil((heading + range) / 5) * 5;
    for (let h = s; h <= e; h++) {
      const n = ((h % 360) + 360) % 360;
      const off = ((h - heading) / (range * 2)) * 100 + 50;
      if (off < -2 || off > 102) continue;
      const maj = n % 30 === 0, mid = n % 10 === 0 && !maj;
      let label = maj
        ? n === 0 ? "N" : n === 90 ? "E" : n === 180 ? "S" : n === 270 ? "W"
          : String(n).padStart(3, "0")
        : "";
      ticks.push({ n, off, maj, mid, label });
    }
    return ticks;
  }, [heading]);

  /* ── Depth tape ticks ─────────────────────────────────────── */
  const depthTicks = useMemo(() => {
    const ticks = [];
    const s = Math.max(0, Math.floor(depth - 10));
    const e = Math.floor(depth + 10);
    for (let d = s; d <= e; d++) {
      const pct = 100 - (((d - depth) / 20) * 100 + 50);
      if (pct >= 0 && pct <= 100) ticks.push({ val: d, pct });
    }
    return ticks;
  }, [depth]);

  /* ── Vert speed tape ticks ────────────────────────────────── */
  const vsTicks = useMemo(() => {
    const ticks = [];
    for (let s = -20; s <= 20; s += 2) {
      const pct = 100 - (((s - vertSpeed) / 28) * 100 + 50);
      if (pct >= 0 && pct <= 100) ticks.push({ val: s, pct });
    }
    return ticks;
  }, [vertSpeed]);

  const pitchLadder = [-20, -15, -10, -5, 5, 10, 15, 20];

  /* ── Shared white color tokens ────────────────────────────── */
  const W70 = "rgba(255,255,255,0.88)";
  const W45 = "rgba(255,255,255,0.68)";
  const W25 = "rgba(255,255,255,0.45)";
  const W12 = "rgba(255,255,255,0.25)";
  const W06 = "rgba(255,255,255,0.12)";
  const BG = "rgba(10,12,16,0.98)";

  return (
    <div
      className="w-full h-full flex flex-col select-none relative pfd-container"
      style={{
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        background: "linear-gradient(180deg, #0c0e13 0%, #080a0e 100%)",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        @keyframes pfd-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .pfd-scanlines {
          background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px);
        }
        .pfd-tape {
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .pfd-badge {
          background: rgba(0,0,0,0.8);
          border: 1.5px solid rgba(255,255,255,0.55);
          box-shadow: 0 0 8px rgba(255,255,255,0.08);
        }
        .pfd-badge-warn {
          border-color: rgba(239,68,68,0.9) !important;
          box-shadow: 0 0 10px rgba(239,68,68,0.4) !important;
          animation: pfd-pulse 1s ease-in-out infinite;
        }
        .pfd-readout {
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.15);
        }
        .pfd-sep-h { border-bottom: 1px solid rgba(255,255,255,0.10); }
        .pfd-sep-t { border-top:    1px solid rgba(255,255,255,0.10); }
      `}</style>

      {/* Subtle scanlines */}
      <div className="pfd-scanlines absolute inset-0 pointer-events-none z-50" />

      {/* ── HEADER: PFD label ─── */}
      <div className="pfd-sep-h shrink-0 flex items-center justify-between px-3 py-1.5">
        <span style={{ fontSize: "9px", fontWeight: "700", letterSpacing: "0.22em", color: W45 }}>
          PRIMARY FLIGHT DISPLAY
        </span>
      </div>

      {/* ── MAIN ROW: Depth tape | Horizon | VS tape ─────────── */}
      <div className="flex-1 flex items-stretch min-h-0 px-2 py-2 gap-2">

        {/* ── LEFT: Depth tape ──────────────────────────────── */}
        <div className="pfd-tape flex flex-col relative shrink-0 rounded-md overflow-hidden" style={{ width: "50px" }}>
          <div style={{ fontSize: "7px", fontWeight: "700", letterSpacing: "0.15em", color: W45, textAlign: "center", padding: "3px 0", borderBottom: `1px solid ${W12}` }}>
            DEPTH
          </div>
          <div className="flex-1 relative overflow-hidden">
            {/* fade top/bottom */}
            <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.85) 100%)" }} />
            {/* center line */}
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: "50%", height: "1px", background: W45 }} />
            {depthTicks.map((tick, i) => {
              const maj = tick.val % 5 === 0;
              return (
                <div key={i} className="absolute right-0 flex items-center" style={{ top: `${tick.pct}%`, transform: "translateY(-50%)" }}>
                  {maj && (
                    <span style={{ fontSize: "8px", fontWeight: "700", color: W70, marginRight: "3px", width: "24px", textAlign: "right", lineHeight: 1 }}>
                      {tick.val}
                    </span>
                  )}
                  <div style={{ height: "1px", width: maj ? "9px" : "5px", background: maj ? W70 : W25 }} />
                </div>
              );
            })}
            <div style={{ position: "absolute", bottom: "3px", left: 0, right: 0, textAlign: "center", fontSize: "7px", color: W25, fontWeight: "700", zIndex: 30 }}>m</div>
          </div>
          {/* Depth value */}
          <div className="pfd-badge text-center mx-1 mb-1 py-0.5 rounded-sm" style={{ fontSize: "11px", fontWeight: "900", color: "#fff" }}>
            {depth.toFixed(1)}
          </div>
        </div>

        {/* ── CENTER: Artificial Horizon ────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 min-w-0">
          <div
            className="pfd-horizon-ball relative shrink-0 rounded-full overflow-hidden"
            style={{
              boxShadow: "0 0 0 2px rgba(255,255,255,0.18), 0 0 24px rgba(0,0,0,0.8), inset 0 0 32px rgba(0,0,0,0.5)",
              background: "#000",
            }}
          >
            <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ overflow: "hidden" }}>
              <defs>
                <clipPath id="pfd-clip"><circle cx="100" cy="100" r="99" /></clipPath>
                <linearGradient id="pfd-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d1f3c" />
                  <stop offset="100%" stopColor="#163358" />
                </linearGradient>
                <linearGradient id="pfd-gnd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2a1505" />
                  <stop offset="100%" stopColor="#140a02" />
                </linearGradient>
                <radialGradient id="pfd-vig" cx="50%" cy="50%" r="50%">
                  <stop offset="55%" stopColor="transparent" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
                </radialGradient>
              </defs>

              {/* Rotating group */}
              <g clipPath="url(#pfd-clip)" transform={`rotate(${-clampedRoll}, 100, 100) translate(0, ${pitchPx})`}>
                <rect x="-300" y="-300" width="800" height="400" fill="url(#pfd-sky)" />
                <line x1="-300" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
                <rect x="-300" y="100" width="800" height="400" fill="url(#pfd-gnd)" />

                {/* Pitch ladder */}
                {pitchLadder.map(deg => {
                  const y = 100 - deg * 3;
                  const isMaj = Math.abs(deg) % 10 === 0;
                  const wHalf = isMaj ? 32 : 20;
                  const col = deg > 0 ? "rgba(120,180,255,0.75)" : "rgba(210,130,60,0.75)";
                  const tcol = deg > 0 ? "rgba(140,200,255,0.9)" : "rgba(240,160,80,0.9)";
                  return (
                    <g key={deg}>
                      <line x1={100 - wHalf} y1={y} x2={100 + wHalf} y2={y} stroke={col} strokeWidth="1" />
                      <line x1={100 - wHalf} y1={y} x2={100 - wHalf} y2={y + (deg > 0 ? 5 : -5)} stroke={col} strokeWidth="0.8" />
                      <line x1={100 + wHalf} y1={y} x2={100 + wHalf} y2={y + (deg > 0 ? 5 : -5)} stroke={col} strokeWidth="0.8" />
                      {isMaj && (
                        <>
                          <text x={100 - wHalf - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill={tcol} fontFamily="monospace" fontWeight="700">{Math.abs(deg)}</text>
                          <text x={100 + wHalf + 5} y={y + 3.5} textAnchor="start" fontSize="9" fill={tcol} fontFamily="monospace" fontWeight="700">{Math.abs(deg)}</text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Vignette */}
              <circle cx="100" cy="100" r="100" fill="url(#pfd-vig)" clipPath="url(#pfd-clip)" />

              {/* Roll scale arc (fixed frame) */}
              <path d="M 36 100 A 64 64 0 0 1 164 100" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="2 5" />
              {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map(ang => {
                const rad = ((ang - 90) * Math.PI) / 180;
                const r1 = 64;
                const r2 = ang === 0 ? 54 : Math.abs(ang) % 30 === 0 ? 58 : 61;
                return (
                  <line key={ang}
                    x1={100 + r1 * Math.cos(rad)} y1={100 + r1 * Math.sin(rad)}
                    x2={100 + r2 * Math.cos(rad)} y2={100 + r2 * Math.sin(rad)}
                    stroke={ang === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)"}
                    strokeWidth={ang === 0 ? "1.5" : "0.8"}
                  />
                );
              })}

              {/* Roll pointer (rotates) */}
              <polygon
                points="100,37 96,45 104,45"
                fill="#fff"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="0.5"
                style={{
                  transform: `rotate(${clampedRoll}deg)`,
                  transformOrigin: "100px 100px",
                  transition: "transform 100ms ease-out",
                  filter: "drop-shadow(0 0 3px rgba(255,255,255,0.6))",
                }}
              />

              {/* Fixed reticle */}
              {/* Bank indicator notch */}
              <polygon points="100,163 96,157 104,157" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
              {/* Left wing */}
              <line x1="58" y1="100" x2="80" y2="100" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="58" y1="100" x2="58" y2="107" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              {/* Right wing */}
              <line x1="120" y1="100" x2="142" y2="100" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="142" y1="100" x2="142" y2="107" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              {/* Center */}
              <circle cx="100" cy="100" r="2.5" fill="#fff" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))" }} />
              <circle cx="100" cy="100" r="5.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />

              {/* Outer bezel */}
              <circle cx="100" cy="100" r="99" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* ── VERTICAL TELEMETRY INFO ──────────────────────── */}
        <div className="flex flex-col justify-center shrink-0" style={{ gap: "var(--pfd-telemetry-gap)", width: "var(--pfd-telemetry-width)" }}>
          {[
            { label: "PITCH", val: `${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}°` },
            { label: "ROLL", val: `${roll >= 0 ? "+" : ""}${roll.toFixed(1)}°` },
            { label: "YAW", val: `${String(normalizedHdg).padStart(3, "0")}°` },
            { label: "TEMP", val: `${temp.toFixed(1)}°C`, warn: tempWarning },
          ].map(item => (
            <div key={item.label} className="pfd-readout flex flex-col justify-center px-1.5 py-1 rounded" style={{ minHeight: "0" }}>
              <span style={{ fontSize: "var(--pfd-lbl-font-size)", color: W45, letterSpacing: "0.1em", fontWeight: "700", lineHeight: "1" }}>
                {item.label}
              </span>
              <span style={{
                fontSize: "var(--pfd-val-font-size)", fontWeight: "900", letterSpacing: "0.02em",
                color: item.warn ? "#f87171" : "#fff",
                textShadow: item.warn
                  ? "0 0 8px rgba(239,68,68,0.8)"
                  : "0 0 6px rgba(255,255,255,0.25)",
                lineHeight: "1.2",
                marginTop: "2px"
              }}>
                {item.val}
              </span>
            </div>
          ))}
        </div>

        {/* ── RIGHT: Vertical Speed tape ────────────────────── */}
        <div className="pfd-tape flex flex-col relative shrink-0 rounded-md overflow-hidden" style={{ width: "50px" }}>
          <div style={{ fontSize: "7px", fontWeight: "700", letterSpacing: "0.15em", color: W45, textAlign: "center", padding: "3px 0", borderBottom: `1px solid ${W12}`, whiteSpace: "nowrap" }}>
            V/SPD
          </div>
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.85) 100%)" }} />
            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: "50%", height: "1px", background: W45 }} />
            {vsTicks.map((tick, i) => {
              const maj = tick.val % 10 === 0;
              return (
                <div key={i} className="absolute left-0 flex items-center" style={{ top: `${tick.pct}%`, transform: "translateY(-50%)" }}>
                  <div style={{ height: "1px", width: maj ? "9px" : "5px", background: maj ? W70 : W25 }} />
                  {maj && (
                    <span style={{ fontSize: "8px", fontWeight: "700", color: tick.val === 0 ? "#fff" : W70, marginLeft: "3px", lineHeight: 1 }}>
                      {tick.val > 0 ? "+" : ""}{tick.val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* VS value */}
          <div
            className={`pfd-badge text-center mx-1 mb-1 py-0.5 rounded-sm flex items-center justify-center gap-0.5 ${Math.abs(vertSpeed) > 2 ? "pfd-badge-warn" : ""}`}
            style={{ fontSize: "10px", fontWeight: "900", color: vertSpeed > 0 ? "#86efac" : vertSpeed < 0 ? "#fca5a5" : "#fff" }}
          >
            <span style={{ fontSize: "7px" }}>{vertSpeed > 0 ? "▲" : vertSpeed < 0 ? "▼" : "●"}</span>
            {Math.abs(vertSpeed).toFixed(1)}
          </div>
        </div>
      </div>

      {/* ── COMPASS TAPE ──────────────────────────────────────── */}
      <div className="pfd-sep-t shrink-0">
        <div className="relative mx-2 mb-2" style={{ height: "44px" }}>
          {/* edge fades */}
          <div className="absolute inset-0 pointer-events-none z-20" style={{ background: "linear-gradient(to right, rgba(8,10,14,1) 0%, transparent 14%, transparent 86%, rgba(8,10,14,1) 100%)" }} />

          <div className="absolute inset-0 overflow-hidden">
            {compassTicks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${tick.off}%`, transform: "translateX(-50%)", paddingTop: "3px" }}
              >
                <div style={{
                  width: tick.maj ? "1.5px" : tick.mid ? "1px" : "0.5px",
                  height: tick.maj ? "12px" : tick.mid ? "7px" : "4px",
                  background: tick.maj ? W70 : tick.mid ? W45 : W25,
                }} />
                {tick.maj && (
                  <span style={{ fontSize: "8px", fontWeight: "700", color: W70, marginTop: "2px", letterSpacing: "0.04em", lineHeight: 1 }}>
                    {tick.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Center readout */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none">
            <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid rgba(255,255,255,0.7)` }} />
            <div
              className="pfd-badge flex items-center gap-1 px-3 py-0.5 rounded-sm font-bold"
              style={{ fontSize: "13px", color: "#fff", letterSpacing: "0.12em" }}
            >
              {String(normalizedHdg).padStart(3, "0")}°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrimaryFlightDisplay;