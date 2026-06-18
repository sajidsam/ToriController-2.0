import React, { memo, useEffect, useRef, useState } from 'react';
import { CameraOff, Navigation, Crosshair, FastForward, Move3d } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import RadarNavigation from './AdvancedRadarNavigation';
import PrimaryFlightDisplay from './PrimaryFlightDisplay'

const MainCenterView = ({ pitch = 0, roll = 0, heading = 0, speedKnots = 0, frontFinAngle = 0, rearFinX = 0, rearFinY = 0, cameraUrl, depth = 0, amps = 0 }) => {

    const cacheBuster = React.useMemo(() => Date.now(), []);

    const imgRef = useRef(null);
    const canvasRef = useRef(null);
    const [model, setModel] = useState(null);
    const [detectedObjects, setDetectedObjects] = useState([]);
    const [aiStatus, setAiStatus] = useState("LOADING");
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

        const offCanvas = document.createElement('canvas');
        offCanvas.width = cw;
        offCanvas.height = ch;
        const offCtx = offCanvas.getContext('2d');

        const scale = Math.max(cw / nw, ch / nh);
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
                requestRef.current = requestAnimationFrame(loop);
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
        <div className="flex-1 flex flex-col items-center justify-center bg-transparent p-2 md:p-4 relative overflow-hidden h-full max-h-screen gap-2 md:gap-4">

            {/* Layout Container */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full max-w-full 2xl:max-w-7xl justify-center items-stretch flex-1 min-h-0">

                {/* Left Column: Camera + Attitude Overlays */}
                <div className="flex flex-col gap-2 md:gap-4 flex-1 min-h-0 min-w-0">

                    {/* Camera and PFD Row */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 flex-1 min-h-0">
                        {/* Primary Flight Display */}
                        <div className="relative z-10 flex-1 bg-black/60 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center ring-1 ring-white/10 backdrop-blur-sm min-h-0">
                            <PrimaryFlightDisplay heading={heading} depth={depth} pitch={pitch} roll={roll} />
                        </div>

                        {/* Camera Feed */}
                        <div
                            className="relative z-10 flex-1 bg-black/60 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center ring-1 ring-white/10 backdrop-blur-sm min-h-0"
                            style={{ perspective: '1000px' }}
                        >
                            <div className="absolute top-4 left-4 flex gap-2 z-40">
                                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">LIVE</span>
                                <span className="bg-black/50 text-white text-[10px] font-mono px-2 py-1 rounded backdrop-blur border border-amber-900/50 text-amber-500">LIVE: 3D SIMULATION</span>
                                <span className={`text-[10px] font-mono px-2 py-1 rounded backdrop-blur border ${aiStatus === "TRACKING" ? 'bg-green-500/20 text-green-400 border-green-500/50' : aiStatus === "SEARCHING" ? 'bg-white/10 text-white/50 border-white/20' : 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'}`}>
                                    AI: {aiStatus}
                                </span>
                            </div>

                            <div className="text-white/50 flex flex-col items-center gap-2 absolute z-0 mt-32">
                                <span className="text-xs font-mono tracking-widest font-bold opacity-50">NO VIDEO SIGNAL - FALLBACK TO HUD</span>
                            </div>

                            {/* Live Camera Feed */}
                            <img
                                ref={imgRef}
                                crossOrigin="anonymous"
                                src={cameraUrl || "http://10.73.115.219/"}
                                alt=""
                                onError={(e) => {
                                    e.target.style.display = "none";
                                }}
                                className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none text-transparent"
                            />

                            {/* Object Detection Overlay */}
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full z-20 pointer-events-none"
                            />


                            {/* Center Crosshair Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-40 mix-blend-screen">
                                {/* <Crosshair size={250} className="text-white/20" strokeWidth={0.5} /> */}


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
                    </div>

                   
                    {/* Attitude and Compass Overlay underneath camera */}
                    <div className="relative z-10 flex flex-wrap gap-2 lg:gap-4 w-full justify-center shrink-0">

                        {/* Artificial Horizon (Textual & Basic Visual for now) */}
                        <div className="bg-black/60 backdrop-blur-md border border-white/20 p-4 rounded-xl w-[280px] shrink-0 flex items-center justify-between gap-4 shadow-xl">
                            <div className="flex flex-col gap-1 items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10 flex-1">
                                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Pitch</span>
                                <span className="text-2xl font-mono text-white font-bold drop-shadow-sm text-center">
                                    {pitch > 0 ? '+' : ''}{pitch.toFixed(1)}°
                                </span>
                            </div>
                            {/* <div className="flex-1 max-w-[200px] h-1 bg-white/20 rounded relative shadow-inner overflow-hidden mx-auto">
                     <div
                        className="absolute h-[20px] w-[50px] bg-white/80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                        style={{ transform: `translate(-50%, -50%) rotate(${pitch}deg)`}}
                      />
                      <div className="absolute w-full h-[1px] bg-white/50 top-1/2 -translate-y-1/2" style={{ transform: `translateY(${pitch}px)`}} />
                </div> */}
                            <div className="flex flex-col gap-1 items-center bg-white/5 p-3 rounded-lg border border-white/10 flex-1">
                                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Roll</span>
                                <span className="text-2xl font-mono text-white font-bold drop-shadow-sm text-center">
                                    {roll > 0 ? '+' : ''}{roll.toFixed(1)}°
                                </span>
                            </div>
                        </div>

                        {/* Speed Indicator */}
                        <div className="bg-black/60 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center justify-between shadow-xl gap-4 w-[180px] shrink-0">
                            <div className="w-10 h-10 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center shrink-0">
                                <FastForward size={18} className="text-white" />
                            </div>
                            <div className="flex flex-col gap-1 text-right flex-1">
                                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Speed</span>
                                <span className="text-3xl font-mono text-white font-bold drop-shadow-sm">{speedKnots.toFixed(1)}<span className="text-sm ml-1 text-white/50">kt</span></span>
                            </div>
                        </div>

                        {/* Compass Heading */}
                        <div className="bg-black/60 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center justify-between shadow-xl gap-4 w-[180px] shrink-0">
                            <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Heading</span>
                                <span className="text-3xl font-mono text-white font-bold drop-shadow-sm">{Math.floor(heading).toString().padStart(3, '0')}°</span>
                            </div>
                            <div className="w-12 h-12 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center relative shadow-inner shrink-0">
                                <Navigation
                                    size={20}
                                    className="text-white transition-transform duration-300"
                                    style={{ transform: `rotate(${heading}deg)` }}
                                />
                                <div className="absolute top-0 text-[8px] font-bold text-white/50 -mt-3 drop-shadow-sm">N</div>
                            </div>
                        </div>

                        {/* Live Fin Deflection Readout */}
                        <div className="bg-black/60 backdrop-blur-md border border-white/20 p-3 rounded-xl flex flex-col justify-center shadow-xl gap-1 w-[180px] shrink-0">
                            <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest border-b border-white/20 pb-1 mb-1 flex items-center gap-1 drop-shadow-sm">
                                <Move3d size={10} /> Control Surfaces
                            </span>
                            <div className="flex justify-between gap-4 text-xs font-mono">
                                <span className="text-white/50">BOW:</span>
                                <span className={`${frontFinAngle === 0 ? 'text-white/50' : 'text-white font-bold'} w-10 text-right`}>{frontFinAngle > 0 ? '+' : ''}{frontFinAngle}°</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs font-mono">
                                <span className="text-white/50">YAW:</span>
                                <span className={`${rearFinX === 0 ? 'text-white/50' : 'text-white font-bold'} w-10 text-right`}>{rearFinX > 0 ? '+' : ''}{rearFinX}°</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs font-mono">
                                <span className="text-white/50">PTCH:</span>
                                <span className={`${rearFinY === 0 ? 'text-white/50' : 'text-white font-bold'} w-10 text-right`}>{rearFinY > 0 ? '+' : ''}{rearFinY}°</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Navigation Radar (Right Column) */}
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
    );
};

export default MainCenterView;
