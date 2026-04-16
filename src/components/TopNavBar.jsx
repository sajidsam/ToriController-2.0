import React from 'react';
import { Wifi, WifiOff, Battery, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, AlertTriangle, ShieldCheck, Usb, Globe } from 'lucide-react';

const TopNavBar = ({ signalStrength, batteryVolt, batteryPct, isLeaking, ipAddress, setIpAddress, isUsbConnected, connectUsb }) => {
  return (
    <div className="flex justify-between items-center bg-zinc-900 border-b border-zinc-800 p-2 text-zinc-300 select-none">

      {/* Signal / Connectivity Controls */}
      <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-800/50">

        {/* Signal Icon */}
        <div className="flex items-center gap-2" title={isUsbConnected ? "Connected via USB Serial" : "Connected via WiFi HTTP"}>
            {isUsbConnected ? (
                <Usb className="text-blue-400" size={20} />
            ) : signalStrength > 70 ? (
                <Wifi className="text-green-500" size={20} />
            ) : signalStrength > 30 ? (
                <Wifi className="text-yellow-500" size={20} />
            ) : (
                <WifiOff className="text-red-500" size={20} />
            )}

            <span className={`font-mono font-bold hidden sm:block ${isUsbConnected ? 'text-blue-400' : signalStrength > 70 ? 'text-green-500' : signalStrength > 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                {isUsbConnected ? 'USB SERIAL' : `${signalStrength}% SIGNAL`}
            </span>
        </div>

        {/* Dynamic Controls (Swap between IP and USB Connect mode) */}
        <div className="flex items-center gap-2 border-l border-zinc-700 pl-2 ml-2">
            {!isUsbConnected && (
                <div className="flex items-center bg-zinc-900 rounded border border-zinc-700 px-2 py-1">
                    <Globe size={14} className="text-zinc-500 mr-2" />
                    <input
                        type="text"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        className="bg-transparent border-none text-xs text-zinc-300 font-mono outline-none w-28 placeholder-zinc-600"
                        placeholder="192.168.x.x"
                    />
                </div>
            )}
            <button
                onClick={connectUsb}
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${isUsbConnected ? 'bg-blue-600 hover:bg-red-600 text-white' : 'bg-zinc-700 hover:bg-blue-600 text-zinc-300'}`}
            >
                <Usb size={14} />
                {isUsbConnected ? 'DISCONNECT' : 'CONNECT USB'}
            </button>
        </div>
      </div>

      {/* Critical Leak Detection */}
      {isLeaking ? (
        <div className="flex-1 mx-4 animate-pulse">
            <div className="bg-red-600 text-white font-bold text-center py-1 rounded border-2 border-red-500 flex justify-center items-center gap-2">
                <AlertTriangle size={20} />
                CRITICAL: WATER INGRESS DETECTED
                <AlertTriangle size={20} />
            </div>
        </div>
      ) : (
        <div className="flex-1 mx-4">
            <div className="bg-zinc-800 text-green-500/50 font-bold text-center py-1 rounded flex justify-center items-center gap-2 border border-zinc-700">
                <ShieldCheck size={18} />
                <span className="text-sm">HULL INTEGRITY SECURE</span>
            </div>
        </div>
      )}

      {/* Main Power */}
      <div className="flex items-center gap-3 px-4 py-1 rounded bg-zinc-800/50">
        <div className="flex flex-col items-end">
            <span className="text-xs text-zinc-500 font-bold">12V SYSTEM</span>
            <span className={`font-mono font-bold ${batteryPct <= 20 ? 'text-red-500' : 'text-zinc-100'}`}>
            {batteryVolt.toFixed(1)}V / {batteryPct}%
            </span>
        </div>
        {batteryPct > 80 ? <BatteryFull className="text-green-500" size={24} /> :
         batteryPct > 40 ? <BatteryMedium className="text-yellow-500" size={24} /> :
         batteryPct > 20 ? <BatteryLow className="text-orange-500" size={24} /> :
         <BatteryWarning className="text-red-500 animate-pulse" size={24} />}
      </div>

    </div>
  );
};

export default TopNavBar;
