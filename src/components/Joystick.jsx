import React, { useRef, useState, useEffect, useCallback } from 'react';

const Joystick = ({ x, y, onChange }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const maxVal = 45; // Corresponds to the -45 to 45 range

  // Dimensions
  const containerSize = 150;
  const knobSize = 50;
  const radius = (containerSize - knobSize) / 2;

  // Rate-limiting for onChange to prevent overloading the ESP32 API
  const lastUpdateRef = useRef(0);

  // Handle position update
  const updatePosition = useCallback((clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // Constrain to circle
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > radius) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * radius;
      deltaY = Math.sin(angle) * radius;
    }

    // Map to -45 to 45
    const mappedX = Math.round((deltaX / radius) * maxVal);
    const mappedY = Math.round(-(deltaY / radius) * maxVal);

    const safeX = Math.max(-maxVal, Math.min(maxVal, mappedX));
    const safeY = Math.max(-maxVal, Math.min(maxVal, mappedY));

    // Throttle calls to maximum 10 times a second (100ms) unless returning perfectly to center
    const now = Date.now();
    if (now - lastUpdateRef.current > 100 || (safeX === 0 && safeY === 0)) {
        onChange(safeX, safeY);
        lastUpdateRef.current = now;
    }
  }, [onChange, radius, maxVal]);

  // Mouse / Touch Handlers
  const handleStart = (e) => {
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updatePosition(clientX, clientY);
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updatePosition(clientX, clientY);
  };

  const handleEnd = () => {
    setIsDragging(false);
    onChange(0, 0); // Spring back to center
  };

  // Keyboard Handlers
  useEffect(() => {
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    // Keyboard state tracking (allows diagonal movement)
    let kx = 0;
    let ky = 0;
    let animationFrame;

    const processKeys = () => {
        let newX = 0;
        let newY = 0;
        if (keys.ArrowUp) newY += maxVal;
        if (keys.ArrowDown) newY -= maxVal;
        if (keys.ArrowRight) newX += maxVal;
        if (keys.ArrowLeft) newX -= maxVal;

        // Normalize diagonals to max distance
        if (newX !== 0 && newY !== 0) {
            newX = Math.round(newX * 0.707); // sin(45deg)
            newY = Math.round(newY * 0.707);
        }

        if (newX !== kx || newY !== ky) {
            kx = newX;
            ky = newY;
            if (!isDragging) onChange(kx, ky);
        }
        animationFrame = requestAnimationFrame(processKeys);
    };

    const handleKeyDown = (e) => {
      if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
      }
    };

    const handleKeyUp = (e) => {
      if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
        if (!isDragging && Object.values(keys).every(v => !v)) {
            onChange(0, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    animationFrame = requestAnimationFrame(processKeys);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [onChange, isDragging, maxVal]);

  // Visual position reverse-mapping
  const visualX = (x / maxVal) * radius;
  const visualY = -(y / maxVal) * radius; // Invert back for screen coords

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-2">
        <div
        ref={containerRef}
        style={{ width: containerSize, height: containerSize }}
        className="rounded-full bg-zinc-950 border-2 border-zinc-700 shadow-inner relative flex shadow-black/50 touch-none"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        >
            {/* Guidelines */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-800 -translate-y-1/2 pointer-events-none" />
            <div className="absolute left-1/2 top-0 h-full w-[1px] bg-zinc-800 -translate-x-1/2 pointer-events-none" />

            {/* Knob */}
            <div
                className="absolute rounded-full bg-gradient-to-br from-purple-500 to-purple-800 shadow-lg border border-purple-400 cursor-grab transform transition-transform duration-75 active:cursor-grabbing hover:scale-105"
                style={{
                width: knobSize,
                height: knobSize,
                left: `calc(50% - ${knobSize / 2}px)`,
                top: `calc(50% - ${knobSize / 2}px)`,
                transform: `translate(${visualX}px, ${visualY}px) ${isDragging ? 'scale(0.95)' : ''}`
                }}
            />
        </div>

        <div className="flex gap-4 text-xs font-mono font-bold text-zinc-500">
            <span className="bg-zinc-900 px-2 py-1 rounded">X: {x.toString().padStart(3, ' ')}°</span>
            <span className="bg-zinc-900 px-2 py-1 rounded">Y: {y.toString().padStart(3, ' ')}°</span>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono text-center">Use Arrow Keys or Touch to steer</div>
    </div>
  );
};

export default Joystick;
