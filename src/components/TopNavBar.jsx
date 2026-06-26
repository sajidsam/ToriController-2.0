import {
  Wifi,
  WifiOff,
  Battery,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  AlertTriangle,
  ShieldCheck,
  Usb,
  Globe,
  Camera,
  Compass,
  Settings,
} from "lucide-react";

const TopNavBar = ({
  signalStrength,
  batteryVolt,
  batteryPct,
  isLeaking,
  isUsbConnected,
  connectUsb,
  calibrateGyro,
  onOpenNetworkSettings,
}) => {
  return (
    <div className="flex justify-between items-center bg-black border-b border-white/20 p-1.5 sm:p-2 text-white select-none">
      {/* Signal / Connectivity Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded bg-white/5">
        {/* Signal Icon */}
        <div
          className="flex items-center gap-1.5 sm:gap-2"
          title={
            isUsbConnected
              ? "Connected via USB Serial"
              : "Connected via WiFi HTTP"
          }
        >
          {isUsbConnected ? (
            <Usb className="text-white" size={18} />
          ) : signalStrength > 70 ? (
            <Wifi className="text-white" size={18} />
          ) : signalStrength > 30 ? (
            <Wifi className="text-white/90" size={18} />
          ) : (
            <WifiOff className="text-white/80" size={18} />
          )}

          <span
            className={`font-mono font-bold text-xs hidden md:block ${isUsbConnected ? "text-white" : signalStrength > 70 ? "text-white" : signalStrength > 30 ? "text-white/90" : "text-white/80"}`}
          >
            {isUsbConnected
              ? "USB SERIAL"
              : `${Math.round(signalStrength)}% SIGNAL`}
          </span>
        </div>

        {/* Dynamic Controls (Swap between IP and USB Connect mode) */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-l border-white/20 pl-1.5 sm:pl-2 ml-1.5 sm:ml-2">
          <button
            onClick={onOpenNetworkSettings}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 py-1 rounded transition-colors bg-transparent border border-white/50 text-white hover:bg-white/10"
            title="Configure Network & Camera Settings"
          >
            <Settings size={14} />
            <span>CONFIG</span>
          </button>
          <button
            onClick={connectUsb}
            className={`flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 py-1 rounded transition-colors ${isUsbConnected ? "bg-white text-black hover:bg-white/80" : "bg-transparent border border-white/50 text-white hover:bg-white/10"}`}
          >
            <Usb size={14} />
            <span className="hidden sm:inline">
              {isUsbConnected ? "DISCONNECT" : "CONNECT USB"}
            </span>
          </button>
          {(isUsbConnected || signalStrength > 0) && (
            <button
              onClick={calibrateGyro}
              className="flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2 py-1 rounded transition-colors bg-transparent border border-white/50 text-white hover:bg-white/10"
              title="Calibrate Gyroscope"
            >
              <Compass size={14} />
              <span className="hidden sm:inline">CALIBRATE</span>
            </button>
          )}
        </div>
      </div>

      {/* Critical Leak Detection */}
      {isLeaking ? (
        <div className="flex-1 mx-2 sm:mx-4 animate-pulse">
          <div className="bg-white text-black font-bold text-center py-1 rounded border-2 border-white flex justify-center items-center gap-2">
            <AlertTriangle size={18} />
            <span className="text-xs sm:text-sm">
              CRITICAL: WATER INGRESS DETECTED
            </span>
            <AlertTriangle size={18} />
          </div>
        </div>
      ) : (
        <div className="flex-1 mx-2 sm:mx-4">
          <div className="bg-transparent text-white font-bold text-center py-1 rounded flex justify-center items-center gap-2 border border-white/10 md:border-transparent lg:border-white/10">
            <ShieldCheck size={18} />
            <span className="text-sm tracking-widest uppercase hidden xl:inline">
              HULL INTEGRITY SECURE
            </span>
            <span className="text-xs tracking-widest uppercase hidden lg:inline xl:hidden">
              HULL SECURE
            </span>
          </div>
        </div>
      )}

      {/* Main Power */}
      <div className="flex items-center gap-1.5 sm:gap-3 px-1.5 sm:px-4 py-1 rounded bg-white/5">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-white/85 font-bold tracking-wider hidden sm:block">
            12V SYSTEM
          </span>
          <span
            className={`font-mono text-xs sm:text-sm font-bold ${batteryPct <= 20 ? "text-white animate-pulse" : "text-white"}`}
          >
            {batteryVolt.toFixed(1)}V / {batteryPct}%
          </span>
        </div>
        {batteryPct > 80 ? (
          <BatteryFull className="text-white" size={20} />
        ) : batteryPct > 40 ? (
          <BatteryMedium className="text-white/90" size={20} />
        ) : batteryPct > 20 ? (
          <BatteryLow className="text-white/75" size={20} />
        ) : (
          <BatteryWarning className="text-white animate-pulse" size={20} />
        )}
      </div>
    </div>
  );
};

export default TopNavBar;
