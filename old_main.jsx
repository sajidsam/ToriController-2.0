import React, { memo, useEffect, useRef, useState } from 'react';

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import RadarNavigation from './AdvancedRadarNavigation';
import PrimaryFlightDisplay from './PrimaryFlightDisplay';
import DblScreen from './DblScreen';

const MainCenterView = ({ pitch = 0, roll = 0, heading = 0, speedKnots = 0, frontFinAngle = 0, rearFinX = 0, rearFinY = 0, cameraUrl, depth = 0, amps = 0, temp = 0 }) => {

    const cacheBuster = React.useMemo(() => Date.now(), []);

    const imgRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [detectedObjects, setDetectedObjects] = useState([]);
    const [aiStatus, setAiStatus] = useState("LOADING");
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const requestRef = useRef();

    useEffect(() => {
        // Load the COCO-SSD model
        const loadModel = async () => {
            try {
                await tf.ready();
                const loadedModel = await cocoSsd.load();
                setModel(loadedModel);
                setAiStatus("SEARCHING");
                console.log("COCO-SSD model loaded successfully.");
            } catch (e) {
                console.error("Failed to load COCO-SSD model", e);
                setAiStatus("ERROR: " + e.message);
            }
        };
        loadModel();
    }, []);

    // Use a ref to hold the latest detect function so HMR doesn't trap the old loop
    const detectRef = useRef();

    detectRef.current = async () => {
        if (!model || !imgRef.current || !canvasRef.current) return;

        const nw = imgRef.current.naturalWidth;
        const nh = imgRef.current.naturalHeight;
        if (nw === 0 || nh === 0) {
            setAiStatus("NO VIDEO SIGNAL");
            return;
        }

        const cw = canvasRef.current.clientWidth;
        const ch = canvasRef.current.clientHeight;

        if (canvasRef.current.width !== cw || canvasRef.current.height !== ch) {
            canvasRef.current.width = cw;
            canvasRef.current.height = ch;
        }

        const ctx = canvasRef.current.getContext('2d');
        // Clear canvas at the START so we don't get frozen boxes if an error occurs
        ctx.clearRect(0, 0, cw, ch);

        if (!isAiEnabled) {
            if (aiStatus !== "DISABLED") {
                setAiStatus("DISABLED");
                setDetectedObjects([]);
            }
            return; // Skip detection if disabled
        }

        const offCanvas = document.createElement('canvas');
        offCanvas.width = cw;
        offCanvas.height = ch;
        const offCtx = offCanvas.getContext('2d');

        const scale = Math.min(cw / nw, ch / nh);
        const rw = nw * scale;
        const rh = nh * scale;
        const ox = (cw - rw) / 2;
        const oy = (ch - rh) / 2;

        offCtx.drawImage(imgRef.current, ox, oy, rw, rh);

        try {
            // Lowered minimum score to 0.4 (40%) to make it easier to detect things
            const predictions = await model.detect(offCanvas, 20, 0.4);

            if (predictions.length > 0) {
                setAiStatus("TRACKING");
            } else {
                setAiStatus("SEARCHING");
            }

            predictions.forEach(prediction => {
                const [x, y, width, height] = prediction.bbox;
                const text = `${prediction.class} (${(prediction.score * 100).toFixed(0)}%)`;
                const isHighAccuracy = prediction.score > 0.75;
                const color = isHighAccuracy ? '#ef4444' : '#22c55e'; // red-500 or green-500

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                ctx.font = 'bold 14px monospace';
                const textWidth = ctx.measureText(text).width;
                ctx.fillStyle = color;
                ctx.fillRect(x, y > 22 ? y - 22 : 0, textWidth + 8, 22);

                ctx.fillStyle = '#000000';
                ctx.fillText(text, x + 4, y > 22 ? y - 6 : 15);
            });

            const classScores = {};
            predictions.forEach(p => {
                if (!classScores[p.class] || p.score > classScores[p.class]) {
                    classScores[p.class] = p.score;
                }
            });
            const uniqueClassesWithScores = Object.entries(classScores).map(([cls, score]) => ({ class: cls, score })).sort((a, b) => a.class.localeCompare(b.class));
            setDetectedObjects(prev => {
                const newStr = uniqueClassesWithScores.map(c => `${c.class}:${c.score > 0.75}`).join(',');
                const oldStr = (prev || []).map(c => `${c.class}:${c.score > 0.75}`).join(',');
                if (newStr !== oldStr) return uniqueClassesWithScores;
                return prev;
            });
        } catch (e) {
            if (e.name === 'SecurityError') {
                setAiStatus("CORS BLOCKED");
            } else {
                setAiStatus("ERROR: " + e.message);
                console.error("Detection error:", e);
            }
        }
    };

    useEffect(() => {
        let isRunning = true;
        const loop = async () => {
            if (!isRunning) return;
            if (detectRef.current) {
                await detectRef.current();
            }
            if (isRunning) {
                // Throttle detection to ~4 times a second (250ms) to free up the CPU
                // and event loop, preventing serial connection loss on low-end PCs
                setTimeout(() => {
                    if (isRunning) {
                        requestRef.current = requestAnimationFrame(loop);
                    }
                }, 250);
            }
        };

        if (model) {
            loop();
        }

        return () => {
            isRunning = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [model]);

    return (
        <div className="lg:flex-1 flex-initial shrink-0 lg:shrink flex flex-col items-stretch justify-center bg-transparent p-2 md:p-4 relative overflow-hidden lg:h-full min-h-[900px] lg:min-h-0 gap-2 md:gap-4 w-full">

            {/* Layout Container: Flat CSS Grid */}
            <div className="main-center-grid flex-1">

                {/* 1. Primary Flight Display */}
                <div className="relative z-10 bg-black/60 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col items-stretch ring-1 ring-white/10 backdrop-blur-sm min-h-[220px] sm:min-h-[300px] lg:min-h-0 grid-area-pfd">
                    <PrimaryFlightDisplay heading={heading} depth={depth} pitch={pitch} roll={roll} temp={temp} />
                </div>

                {/* 2. Camera Feed */}
                <div
                    className="relative z-10 bg-black/60 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col items-stretch ring-1 ring-white/10 backdrop-blur-sm min-h-[220px] sm:min-h-[300px] lg:min-h-0 grid-area-camera"
                    style={{ perspective: '1000px' }}
                >
                    <div className="absolute top-4 left-4 flex gap-2 z-40">
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">LIVE</span>
                        <span className="bg-black/50 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur border border-amber-900/50 text-amber-500 hidden sm:inline">LIVE: 3D SIMULATION</span>
                        <button 
                            onClick={() => setIsAiEnabled(prev => !prev)}
                            className={`text-[10px] font-mono px-2 py-1 rounded backdrop-blur border cursor-pointer hover:opacity-80 transition-opacity ${
                                !isAiEnabled ? 'bg-gray-500/20 text-gray-400 border-gray-500/50' :
                                aiStatus === "TRACKING" ? 'bg-green-500/20 text-green-400 border-green-500/50' : 
                                aiStatus === "SEARCHING" ? 'bg-white/15 text-white/80 border-white/30' : 
                                'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                            }`}
                        >
                            AI: {!isAiEnabled ? "OFF (CLICK TO ENABLE)" : aiStatus}
                        </button>
                    </div>

                    {!isImageLoaded && (
                        <div className="text-white/85 flex flex-col items-center gap-2 absolute z-0 mt-32 w-full text-center select-none pointer-events-none">
                            <span className="text-xs font-mono tracking-widest font-bold opacity-80">NO VIDEO SIGNAL - FALLBACK TO HUD</span>
                        </div>
                    )}

                    {/* Live Camera Feed */}
                    <img
                        ref={imgRef}
                        crossOrigin="anonymous"
                        src={(() => {
                            if (!cameraUrl) return "http://10.73.115.219/video";
                            let trimmed = cameraUrl.trim();
                            if (!/^https?:\/\//i.test(trimmed)) {
                                trimmed = "http://" + trimmed;
                            }
                            try {
                                const parsed = new URL(trimmed);
                                if (parsed.pathname === "/" || parsed.pathname === "") {
                                    parsed.pathname = "/video";
                                }
                                return parsed.toString();
                            } catch (e) {
                                return trimmed;
                            }
                        })()}
                        alt=""
                        onLoad={(e) => {
                            setIsImageLoaded(true);
                            e.target.style.display = "block";
                        }}
                        onError={(e) => {
                            setIsImageLoaded(false);
                            e.target.style.display = "none";
                        }}
                        className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none text-transparent"
                    />

                    {/* Object Detection Overlay */}
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full z-20 pointer-events-none"
                    />

                    {/* Center Crosshair Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-40 mix-blend-screen">
                        {/* Detected Objects List */}
                        <div className="absolute top-[65%] flex flex-wrap justify-center gap-2 max-w-[80%]">
                            {detectedObjects.map((obj, i) => {
                                const isHigh = obj.score > 0.75;
                                return (
                                    <span key={i} className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider backdrop-blur-sm ${isHigh
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                                        : 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                                        }`}>
                                        TARGET: {obj.class}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 4. DBL (Digital Bottom Link) Screen */}
                <div className="relative z-10 bg-black/60 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col items-stretch ring-1 ring-white/10 backdrop-blur-sm min-h-[220px] sm:min-h-[300px] lg:min-h-0 grid-area-dbl">
                    <DblScreen depth={depth} speedKnots={speedKnots} heading={heading} temp={temp} />
                </div>

                {/* 3. Navigation Radar (Right Column) */}
                <div className="grid-area-radar lg:h-full lg:max-h-full min-h-0 flex flex-col">
                    <RadarNavigation
                        heading={heading}
                        speedKnots={speedKnots}
                        depth={depth}
                        amps={amps}
                        pitch={pitch}
                        roll={roll}
                    />
                </div>

            </div>
        </div>
    );
};

export default MainCenterView;
