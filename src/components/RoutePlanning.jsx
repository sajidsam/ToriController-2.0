import React, { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  useMapEvents,
  Polyline,
  CircleMarker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, LocateFixed, Trash2, Map, X } from "lucide-react";
import L from "leaflet";

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const RoutePlanning = ({ onBack, waypoints, setWaypoints }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isCheckingWater, setIsCheckingWater] = useState(false);
  const [allowGround, setAllowGround] = useState(false);

  const MapClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        if (isCheckingWater) return;
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (!allowGround) {
          setIsCheckingWater(true);
          try {
            const res = await fetch(
              `https://is-on-water.balbona.me/api/v1/get/${lat}/${lng}`,
            );
            const data = await res.json();

            if (data && data.isWater) {
              setWaypoints((prev) => [...prev, [lat, lng]]);
            } else {
              alert(
                "Warning: Waypoints can only be placed on water or rivers!\n(Turn on 'GROUND' to bypass this)",
              );
            }
          } catch (err) {
            console.error("Water check failed:", err);
            alert(
              "Failed to verify if location is water. Please check internet connection.",
            );
          } finally {
            setIsCheckingWater(false);
          }
        } else {
          setWaypoints((prev) => [...prev, [lat, lng]]);
        }
      },
    });
    return null;
  };

  // Default center roughly around Bangladesh (Bay of Bengal)
  const defaultCenter = [23.685, 90.3563];

  const locateUser = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const loc = [latitude, longitude];
          setUserLocation(loc);
          if (mapInstance) {
            mapInstance.flyTo(loc, 13);
          }
        },
        (error) => {
          console.error("Geolocation failed:", error);

          let platformInstructions = "";
          const ua = navigator.userAgent;

          if (ua.includes("Mac")) {
            platformInstructions =
              "Mac: Go to System Settings > Privacy & Security > Location Services and allow 'Electron' or 'Terminal'.";
          } else if (ua.includes("Win")) {
            platformInstructions =
              "Windows: Go to Settings > Privacy & security > Location and turn on 'Location services' and 'Let desktop apps access your location'.";
          } else if (ua.includes("iPad") || ua.includes("iPhone")) {
            platformInstructions =
              "iPad/iPhone: Go to Settings > Privacy & Security > Location Services and allow access for this app or browser.";
          } else {
            platformInstructions =
              "Please check your device's location permissions.";
          }

          alert(
            "Location Access Denied or Unavailable.\n\n" +
              platformInstructions +
              "\n\n" +
              "Error: " +
              error.message,
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      alert("Geolocation is not supported by this app.");
    }
  };

  const deleteWaypoint = (index) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += L.latLng(waypoints[i]).distanceTo(
      L.latLng(waypoints[i + 1]),
    );
  }
  const totalDistDisplay =
    totalDistance > 1000
      ? (totalDistance / 1000).toFixed(2) + " km"
      : Math.round(totalDistance) + " m";

  return (
    <div className="flex flex-col h-full w-full bg-black relative">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-black border-b border-white/20 p-2 sm:p-4 text-white z-[400] relative shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors text-sm font-bold"
          >
            <ArrowLeft size={16} />
            BACK TO DASHBOARD
          </button>
          <h1 className="text-lg font-bold tracking-widest uppercase hidden sm:block">
            Route Planning
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllowGround(!allowGround)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded transition-colors text-sm font-bold shadow-lg ${allowGround ? "bg-white/20 hover:bg-white/30 border-white/50 text-white" : "bg-white/5 hover:bg-white/10 border-white/20 text-white/70"}`}
            title="Toggle Ground Marking"
          >
            <Map size={16} />
            <span className="hidden sm:inline">
              {allowGround ? "GROUND: ON" : "GROUND: OFF"}
            </span>
          </button>

          {waypoints.length > 0 && (
            <button
              onClick={() => setWaypoints([])}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/20 border border-white/30 rounded transition-colors text-sm font-bold shadow-lg text-white"
            >
              <Trash2 size={16} className="text-white/80" />
              <span className="hidden sm:inline">CLEAR ROUTE</span>
            </button>
          )}

          <button
            onClick={locateUser}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/20 border border-white/30 rounded transition-colors text-sm font-bold shadow-lg text-white"
          >
            <LocateFixed size={16} className="text-white/80" />
            <span className="hidden sm:inline">MY LOCATION</span>
          </button>
        </div>
      </div>

      <style>{`
        .leaflet-container {
          cursor: crosshair !important;
        }
      `}</style>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Map Container */}
        <div className="flex-1 relative z-0">
          <MapContainer
            center={defaultCenter}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
            ref={setMapInstance}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                />
              </LayersControl.BaseLayer>

              <LayersControl.Overlay checked name="OpenSeaMap (Marine Routes)">
                <TileLayer
                  url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
                  attribution='Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
                />
              </LayersControl.Overlay>
            </LayersControl>

            {/* User Location Marker */}
            {userLocation && (
              <Marker position={userLocation}>
                <Popup>Your Current Location</Popup>
              </Marker>
            )}

            {/* Marker Example */}
            {!userLocation && waypoints.length === 0 && (
              <Marker position={defaultCenter}>
                <Popup>
                  Tori Base <br /> Expected Origin
                </Popup>
              </Marker>
            )}

            <MapClickHandler />

            {waypoints.length > 0 && (
              <Polyline
                positions={waypoints}
                color="red"
                weight={3}
                dashArray="5, 10"
              />
            )}

            {waypoints.map((wp, idx) => {
              if (idx === waypoints.length - 1) return null;
              const nextWp = waypoints[idx + 1];

              // Calculate bearing for arrow
              const startLat = (wp[0] * Math.PI) / 180;
              const startLng = (wp[1] * Math.PI) / 180;
              const endLat = (nextWp[0] * Math.PI) / 180;
              const endLng = (nextWp[1] * Math.PI) / 180;
              const dLng = endLng - startLng;
              const y = Math.sin(dLng) * Math.cos(endLat);
              const x =
                Math.cos(startLat) * Math.sin(endLat) -
                Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
              const brng = (Math.atan2(y, x) * 180) / Math.PI;
              const bearing = (brng + 360) % 360;

              const p1 = L.latLng(wp[0], wp[1]);
              const p2 = L.latLng(nextWp[0], nextWp[1]);
              const distMeters = p1.distanceTo(p2);
              const distDisplay =
                distMeters > 1000
                  ? (distMeters / 1000).toFixed(2) + " km"
                  : Math.round(distMeters) + " m";

              const midPoint = [
                (wp[0] + nextWp[0]) / 2,
                (wp[1] + nextWp[1]) / 2,
              ];
              const arrowIcon = L.divIcon({
                html: `
                <div style="position: relative;">
                  <div style="position: absolute; left: -8px; top: -8px; transform: rotate(${bearing}deg); font-size: 16px; text-shadow: 0 0 2px white; color: red;">⬆</div>
                  <div style="position: absolute; left: 10px; top: -10px; background: rgba(255,255,255,0.9); color: black; font-size: 11px; font-weight: bold; padding: 2px 4px; border-radius: 4px; border: 1px solid red; white-space: nowrap;">${distDisplay}</div>
                </div>`,
                className: "custom-arrow-icon",
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              });
              return (
                <Marker
                  key={`arrow-${idx}`}
                  position={midPoint}
                  icon={arrowIcon}
                />
              );
            })}

            {waypoints.map((wp, idx) => {
              const label = String.fromCharCode(65 + idx); // A, B, C...
              const icon = L.divIcon({
                html: `<div style="background: red; color: white; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);">${label}</div>`,
                className: "custom-waypoint-icon",
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });
              return (
                <Marker key={idx} position={wp} icon={icon}>
                  <Popup>Waypoint {label}</Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Route Plan Table Sidebar */}
        {waypoints.length > 0 && (
          <div className="w-80 bg-[#0a0a0a] border-l border-white/10 flex flex-col z-[400] text-white shadow-2xl relative">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <div className="text-sm font-bold text-white uppercase tracking-widest">
                Route Plan
              </div>
              <div className="text-xs text-gray-300 font-mono bg-white/10 px-2 py-1 rounded border border-white/20">
                Total: {totalDistDisplay}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {waypoints.map((wp, idx) => {
                const label = String.fromCharCode(65 + idx);
                let distFromPrev = "";
                if (idx > 0) {
                  const p1 = L.latLng(
                    waypoints[idx - 1][0],
                    waypoints[idx - 1][1],
                  );
                  const p2 = L.latLng(wp[0], wp[1]);
                  const d = p1.distanceTo(p2);
                  distFromPrev =
                    d > 1000
                      ? (d / 1000).toFixed(2) + " km"
                      : Math.round(d) + " m";
                }

                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-white/5 p-3 rounded-lg hover:bg-white/10 transition-colors group border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold border border-gray-400 shadow-sm shrink-0">
                        {label}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-gray-300 font-mono leading-tight">
                          {wp[0].toFixed(4)}
                          <br />
                          {wp[1].toFixed(4)}
                        </span>
                        {idx > 0 && (
                          <span className="text-[10px] text-gray-500 font-medium mt-1 bg-black/40 px-1.5 py-0.5 rounded w-max">
                            +{distFromPrev}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWaypoint(idx);
                      }}
                      className="text-white/50 hover:text-white p-2 rounded-md hover:bg-white/10 transition-all shrink-0"
                      title="Remove Waypoint"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutePlanning;
