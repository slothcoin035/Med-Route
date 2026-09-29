import React, { useState } from 'react';
import { Delivery, HubLocation, LocationPoint, RouteLeg, RouteStep } from '../types';
import { generateGoogleMapsNavigationUrl } from '../utils/streetRouting';
import {
  X,
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  Flag,
  Clock,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  Milestone,
  Compass,
} from 'lucide-react';

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hub: HubLocation;
  deliveries: Delivery[];
  legs: RouteLeg[];
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  activeDeliveryId: string | null;
  onSelectDelivery: (id: string) => void;
  onOpenNavigationApp?: (destination: LocationPoint, name?: string, address?: string) => void;
}

export const DirectionsModal: React.FC<DirectionsModalProps> = ({
  isOpen,
  onClose,
  hub,
  deliveries,
  legs,
  totalDistanceMiles,
  totalDurationMinutes,
  activeDeliveryId,
  onSelectDelivery,
  onOpenNavigationApp,
}) => {
  const [expandedLegIndex, setExpandedLegIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  // Render turn maneuver icon based on instruction type
  const getManeuverIcon = (step: RouteStep) => {
    const type = step.maneuverType.toLowerCase();
    const mod = (step.maneuverModifier || '').toLowerCase();

    if (type === 'arrive') {
      return <Flag className="w-4 h-4 text-rose-500 shrink-0" />;
    }
    if (type === 'depart') {
      return <Navigation className="w-4 h-4 text-teal-500 shrink-0" />;
    }
    if (mod.includes('left')) {
      return <CornerUpLeft className="w-4 h-4 text-sky-600 shrink-0" />;
    }
    if (mod.includes('right')) {
      return <CornerUpRight className="w-4 h-4 text-sky-600 shrink-0" />;
    }
    if (mod.includes('uturn')) {
      return <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    return <ArrowUp className="w-4 h-4 text-slate-600 shrink-0" />;
  };

  // Generate Google Maps link for the current active leg or whole route
  const currentLeg =
    legs.find((l) => l.targetDeliveryId === activeDeliveryId) || legs[0];

  const handleLaunchGoogleMaps = (leg?: RouteLeg) => {
    let url = '';
    if (leg && leg.fromCoords && leg.toCoords) {
      url = generateGoogleMapsNavigationUrl(leg.fromCoords, leg.toCoords);
    } else if (deliveries.length > 0) {
      const origin = hub.coordinates;
      const lastStop = deliveries[deliveries.length - 1].coordinates;
      const waypoints = deliveries.slice(0, -1).map((d) => d.coordinates);
      url = generateGoogleMapsNavigationUrl(origin, lastStop, waypoints);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight flex items-center gap-2">
                <span>Turn-by-Turn Street Directions</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">
                  Street Routing
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real turn maneuvers along streets from {hub.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Stats Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Milestone className="w-4 h-4 text-teal-600" />
              <span>
                Total Distance: <strong>{totalDistanceMiles} mi</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>
                Est. Drive Time: <strong>{totalDurationMinutes} min</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>
                Stops: <strong>{deliveries.length}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenNavigationApp && deliveries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const target = deliveries.find((d) => d.id === activeDeliveryId) || deliveries[0];
                  if (target) {
                    onOpenNavigationApp(target.coordinates, target.patientName, target.address);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Launch in Google Maps, Apple Maps, or Waze"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Open in GPS</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleLaunchGoogleMaps()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
              <span>Full Route (Google)</span>
            </button>
          </div>
        </div>

        {/* Directions Legs Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {legs.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No route legs available</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Add destination stops to the route to calculate street driving directions.
              </p>
            </div>
          ) : (
            legs.map((leg, legIdx) => {
              const isExpanded = expandedLegIndex === legIdx;
              const isTargetActive = leg.targetDeliveryId === activeDeliveryId;
              const matchedDelivery = deliveries.find((d) => d.id === leg.targetDeliveryId);

              return (
                <div
                  key={`leg-${legIdx}`}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isTargetActive
                      ? 'border-teal-500 bg-teal-50/20 ring-1 ring-teal-500/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Leg Header Accordion */}
                  <div
                    onClick={() => setExpandedLegIndex(isExpanded ? null : legIdx)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {legIdx + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {legIdx === 0
                              ? `Starting Hub → Stop #1: ${leg.toName}`
                              : `Stop #${legIdx} → Stop #${legIdx + 1}: ${leg.toName}`}
                          </h4>
                          {matchedDelivery?.isStat && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-600 text-white">
                              STAT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {leg.distanceMiles} miles • ~{leg.durationMinutes} min drive •{' '}
                          {leg.steps?.length || 0} street maneuvers
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {onOpenNavigationApp && leg.toCoords ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNavigationApp(leg.toCoords!, leg.toName);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open this destination in GPS App (Google Maps, Apple Maps, Waze)"
                        >
                          <Compass className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLaunchGoogleMaps(leg);
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Navigate this leg in Google Maps"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Turn-by-Turn Steps List */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                      {(leg.steps || []).map((step, sIdx) => {
                        const isArrive = step.maneuverType.toLowerCase() === 'arrive';

                        return (
                          <div
                            key={`step-${legIdx}-${sIdx}`}
                            className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                              isArrive
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-white border border-slate-200/80'
                            }`}
                          >
                            <div className="mt-0.5">{getManeuverIcon(step)}</div>

                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs ${
                                  isArrive
                                    ? 'font-bold text-emerald-900'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {step.instruction}
                              </p>
                              {step.streetName && !isArrive && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  on {step.streetName}
                                </p>
                              )}
                            </div>

                            {step.distanceMiles > 0 && (
                              <span className="text-[11px] font-bold text-slate-600 shrink-0">
                                {step.distanceMiles < 0.1
                                  ? `${Math.round(step.distanceMiles * 5280)} ft`
                                  : `${step.distanceMiles} mi`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Powered by OpenStreetMap real street routing data
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close Directions
          </button>
        </div>
      </div>
    </div>
  );
};
