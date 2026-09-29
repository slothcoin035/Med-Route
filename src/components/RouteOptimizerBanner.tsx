import React from 'react';
import { OptimizationMetrics } from '../types';
import {
  Sparkles,
  Zap,
  Navigation,
  Clock,
  Fuel,
  CheckCircle2,
  MapPin,
  RotateCcw,
  ExternalLink,
  Compass,
} from 'lucide-react';

interface RouteOptimizerBannerProps {
  metrics: OptimizationMetrics;
  isOptimized: boolean;
  onOptimizeRoute: () => void;
  onOpenDirections?: () => void;
  onOpenNavigationApp?: () => void;
  hubName?: string;
  onEditHub?: () => void;
  includeRoundTrip?: boolean;
  onToggleRoundTrip?: () => void;
  roundTripTargetName?: string;
}

export const RouteOptimizerBanner: React.FC<RouteOptimizerBannerProps> = ({
  metrics,
  isOptimized,
  onOptimizeRoute,
  onOpenDirections,
  onOpenNavigationApp,
  hubName,
  onEditHub,
  includeRoundTrip = false,
  onToggleRoundTrip,
  roundTripTargetName,
}) => {
  return (
    <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white rounded-xl p-3 sm:p-4 border border-teal-800/60 shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Summary info */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1 bg-teal-500/20 text-teal-300 rounded-md border border-teal-500/30">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Smart Route & Schedule Optimizer
            </h3>
            {isOptimized && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Optimized</span>
              </span>
            )}
            {hubName && (
              <button
                type="button"
                onClick={onEditHub}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/90 text-teal-300 border border-teal-500/40 hover:bg-slate-700/90 hover:text-white flex items-center gap-1 transition-colors"
                title="Click to change starting point"
              >
                <MapPin className="w-2.5 h-2.5 text-teal-400" />
                <span className="truncate max-w-[160px]">Start: {hubName}</span>
                <span className="text-[9px] text-teal-400 underline ml-0.5">Edit</span>
              </button>
            )}

            {/* Round-Trip / Return to Hub Toggle */}
            {onToggleRoundTrip && (
              <button
                type="button"
                onClick={onToggleRoundTrip}
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                  includeRoundTrip
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-2xs'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-750'
                }`}
                title={
                  includeRoundTrip
                    ? `Includes return trip back to ${roundTripTargetName || 'Hub'} in mileage`
                    : 'Click to calculate return trip back to Hub / Base'
                }
              >
                <RotateCcw className={`w-2.5 h-2.5 ${includeRoundTrip ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{includeRoundTrip ? 'Round Trip: ON' : 'Round Trip: OFF'}</span>
                {includeRoundTrip && metrics.roundTripDistanceMiles ? (
                  <span className="text-[9px] text-emerald-400 font-mono">
                    (+{metrics.roundTripDistanceMiles} mi)
                  </span>
                ) : null}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Calculates TSP shortest path from starting hub, prioritizes urgent STAT drops first, and minimizes drive time across Zones 1–5.
          </p>
        </div>

        {/* Right: Metrics & Action */}
        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap w-full md:w-auto">
          {/* Efficiency Badges */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700/80 text-xs w-full sm:w-auto">
            <div>
              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                <Navigation className="w-3 h-3 text-teal-400" />
                <span>Total Route</span>
              </div>
              <span className="font-bold text-white text-sm">
                {metrics.optimizedDistanceMiles || metrics.originalDistanceMiles} mi
              </span>
            </div>

            <div className="border-l border-slate-700 pl-2.5 sm:pl-3">
              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Est. Driving</span>
              </div>
              <span className="font-bold text-white text-sm">
                {Math.round((metrics.optimizedTimeMinutes || metrics.originalTimeMinutes) / 60)}h{' '}
                {(metrics.optimizedTimeMinutes || metrics.originalTimeMinutes) % 60}m
              </span>
            </div>

            {metrics.milesSaved > 0 && (
              <div className="border-l border-slate-700 pl-2.5 sm:pl-3">
                <div className="flex items-center gap-1 text-emerald-400 text-[11px]">
                  <Fuel className="w-3 h-3" />
                  <span>Savings</span>
                </div>
                <span className="font-bold text-emerald-400 text-sm">
                  -{metrics.milesSaved} mi (~${metrics.fuelSavingsEstimated})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Launch Native Navigation Button */}
            {onOpenNavigationApp && (
              <button
                type="button"
                onClick={onOpenNavigationApp}
                className="flex-1 sm:flex-initial px-3 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg border border-blue-500 shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer"
                title="Launch Google Maps, Apple Maps, or Waze for voice navigation"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Open GPS</span>
              </button>
            )}

            {/* Directions Button */}
            {onOpenDirections && (
              <button
                onClick={onOpenDirections}
                className="flex-1 sm:flex-initial px-3 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs min-h-[38px] cursor-pointer"
                title="View Turn-by-Turn Street Directions"
              >
                <Navigation className="w-3.5 h-3.5 text-teal-400" />
                <span>Directions</span>
              </button>
            )}

            {/* Trigger Button */}
            <button
              onClick={onOptimizeRoute}
              className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-xs rounded-lg shadow-lg hover:shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[38px] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
              <span>{isOptimized ? 'Re-Optimize' : 'Optimize Schedule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
