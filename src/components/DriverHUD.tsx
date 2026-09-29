import React from 'react';
import { Delivery, DriverState, LocationPoint } from '../types';
import { getPreferredNavApp, getNavAppName } from '../utils/navigationShortcuts';
import {
  Play,
  Pause,
  FastForward,
  Navigation,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Activity,
  Camera,
  Edit3,
  Phone,
  MessageSquare,
  ExternalLink,
  Car,
  Home,
  Gauge,
} from 'lucide-react';

interface DriverHUDProps {
  driver: DriverState;
  nextDelivery: Delivery | null;
  completedCount: number;
  totalCount: number;
  onToggleSimulation: () => void;
  onSetSimSpeed: (speed: number) => void;
  onToggleDeviceGps: () => void;
  onDeliverActive: () => void;
  onOpenDirections?: () => void;
  onOpenNavigationApp?: (destination: LocationPoint, name?: string, address?: string) => void;
  onOpenContactPatient?: (delivery: Delivery) => void;
  upcomingManeuver?: string;
  onOpenEditProfile?: () => void;
  onOpenDriveMode?: () => void;
  onReturnToBase?: () => void;
}

export const DriverHUD: React.FC<DriverHUDProps> = ({
  driver,
  nextDelivery,
  completedCount,
  totalCount,
  onToggleSimulation,
  onSetSimSpeed,
  onToggleDeviceGps,
  onDeliverActive,
  onOpenDirections,
  onOpenNavigationApp,
  onOpenContactPatient,
  upcomingManeuver,
  onOpenEditProfile,
  onOpenDriveMode,
  onReturnToBase,
}) => {
  const preferredNavApp = getPreferredNavApp();
  const navAppName = getNavAppName(preferredNavApp);
  return (
    <div className="bg-slate-900 text-white rounded-xl border border-slate-800 shadow-md p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Driver Identity & Active Status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="driver-hud-avatar-btn"
            onClick={onOpenEditProfile}
            className="relative group focus:outline-none focus:ring-2 focus:ring-teal-400 rounded-full"
            title="Click to edit driver profile & photo from device"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-teal-600/30 border-2 border-teal-500 flex items-center justify-center font-bold text-white text-sm shadow">
              {driver.avatarUrl ? (
                <img
                  src={driver.avatarUrl}
                  alt={driver.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                driver.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
              )}
            </div>

            {/* Quick Camera Overlay on Hover */}
            <div className="absolute inset-0 bg-slate-950/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-teal-300">
              <Camera className="w-4 h-4" />
            </div>

            {driver.isSimulating ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse" />
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-100 text-sm">{driver.name}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {driver.vehicle}
              </span>
              {onOpenEditProfile && (
                <button
                  type="button"
                  id="driver-hud-edit-btn"
                  onClick={onOpenEditProfile}
                  className="text-[10px] text-slate-400 hover:text-teal-300 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800"
                  title="Edit driver info & upload photo"
                >
                  <Edit3 className="w-3 h-3 text-teal-400" />
                  <span>Edit Profile</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                <span>Plate: {driver.licensePlate}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Speed: <strong className="text-white">{driver.speedMph} mph</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Next Target Stop & Real-Time ETA */}
        {nextDelivery ? (
          <div className="flex-1 max-w-xl bg-slate-800/80 rounded-xl p-2.5 sm:p-3 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">
                    Next Stop #{nextDelivery.sequence}
                  </span>
                  {nextDelivery.isStat && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-500 text-white animate-pulse">
                      STAT
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                    {nextDelivery.zone} (${nextDelivery.pay})
                  </span>
                </div>

                {/* Arrival time on mobile in top-right */}
                <div className="sm:hidden text-right whitespace-nowrap">
                  <span className="text-[11px] font-black text-teal-300">
                    {nextDelivery.eta || 'Calculating...'}
                  </span>
                </div>
              </div>

              <p className="font-bold text-white text-xs sm:text-sm truncate mt-1">
                {nextDelivery.patientName} — {nextDelivery.address}
              </p>
              {upcomingManeuver ? (
                <p className="text-[11px] text-teal-300 flex items-center gap-1 truncate mt-0.5 font-medium">
                  <Navigation className="w-3 h-3 text-teal-400 shrink-0" />
                  <span>{upcomingManeuver}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 truncate">
                  Rx: {nextDelivery.medicationName} ({nextDelivery.distanceFromHubMiles} mi from hub)
                </p>
              )}
            </div>

            {/* Desktop Arrival Block */}
            <div className="hidden sm:block text-right whitespace-nowrap pl-2 border-l border-slate-700">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Est. Arrival</span>
              <span className="text-base sm:text-lg font-black text-teal-300">
                {nextDelivery.eta || 'Calculating...'}
              </span>
              <div className="text-[10px] text-slate-400">
                {nextDelivery.distanceFromHubMiles} mi from hub
              </div>
            </div>

            {/* Action Buttons: In-vehicle Driver Shortcuts */}
            <div className="flex items-center gap-1.5 sm:gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-750 flex-wrap">
              {onOpenDriveMode && (
                <button
                  type="button"
                  id="driver-hud-car-mode-btn"
                  onClick={onOpenDriveMode}
                  className="flex-1 sm:flex-initial px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer border border-teal-400/30"
                  title="Open In-Vehicle Fullscreen Drive Mode Cockpit [M]"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Car Mode</span>
                  <span className="hidden sm:inline-block px-1 py-0.2 rounded bg-black/30 font-mono text-[9px]">M</span>
                </button>
              )}

              {onOpenNavigationApp && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenNavigationApp(
                      nextDelivery.coordinates,
                      nextDelivery.patientName,
                      nextDelivery.address
                    )
                  }
                  className="flex-1 sm:flex-initial px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer"
                  title={`Open Turn-by-Turn GPS Voice Navigation (${navAppName}) [G]`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{navAppName.replace(' Maps', '')}</span>
                </button>
              )}

              {onOpenContactPatient && (
                <button
                  type="button"
                  onClick={() => onOpenContactPatient(nextDelivery)}
                  className="flex-1 sm:flex-initial px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white border border-slate-700 font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer"
                  title="Call or Text Patient with pre-filled pharmacy ETA [C/T]"
                >
                  <Phone className="w-3.5 h-3.5 text-sky-400" />
                  <span>Contact</span>
                </button>
              )}

              {onOpenDirections && (
                <button
                  type="button"
                  onClick={onOpenDirections}
                  className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700 font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer"
                  title="View Turn-by-Turn Driving Directions [D]"
                >
                  <Navigation className="w-3.5 h-3.5 text-teal-400" />
                  <span>Directions</span>
                </button>
              )}

              <button
                onClick={onDeliverActive}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] active:scale-95 cursor-pointer"
                title="Mark stop as delivered [SPACE]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Delivered</span>
              </button>
            </div>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex-1 max-w-md bg-slate-800/80 rounded-lg p-2.5 border border-slate-700 text-slate-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-teal-400" />
              <span>Route is empty. Click <strong>+ Add Stop</strong> to add locations.</span>
            </div>
            <span className="font-semibold text-slate-400">Route Empty</span>
          </div>
        ) : (
          <div className="flex-1 max-w-md bg-emerald-950/40 rounded-lg p-2.5 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>All scheduled deliveries for this route are completed!</span>
            </div>
            {onReturnToBase && (
              <button
                type="button"
                onClick={onReturnToBase}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1 active:scale-95 cursor-pointer"
                title="Navigate back to Base or Home in GPS [H]"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return Base</span>
              </button>
            )}
          </div>
        )}

        {/* Real-time Simulator & GPS Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0">
          <button
            onClick={onToggleSimulation}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all shadow min-h-[38px] active:scale-95 cursor-pointer ${
              driver.isSimulating
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            {driver.isSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Driver</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Drive</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            {/* Speed Multiplier */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSetSimSpeed(spd)}
                  className={`px-2 py-1.5 rounded font-semibold text-[11px] transition-colors min-w-[28px] ${
                    driver.simSpeedMultiplier === spd
                      ? 'bg-teal-500 text-slate-900 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Simulation speed ${spd}x`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Device GPS Toggle */}
            <button
              onClick={onToggleDeviceGps}
              className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 min-h-[38px] active:scale-95 cursor-pointer ${
                driver.useDeviceGps
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Use device hardware GPS position"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">GPS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
