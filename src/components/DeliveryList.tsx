import React, { useState } from 'react';
import { Delivery, DeliveryStatus, ZoneId, RatesConfig, LocationPoint, RouteLeg } from '../types';
import { ZONE_RULES, getZoneRules } from '../utils/zonePay';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  Navigation,
  Phone,
  Compass,
  MessageSquare,
  RotateCcw,
  Flag,
} from 'lucide-react';

interface DeliveryListProps {
  deliveries: Delivery[];
  activeDeliveryId: string | null;
  onSelectDelivery: (id: string) => void;
  onStatusChange: (id: string, status: DeliveryStatus) => void;
  onDeleteDelivery: (id: string) => void;
  onClearAllDeliveries?: () => void;
  onOpenAddModal: () => void;
  onOpenDirections?: (deliveryId?: string) => void;
  onOpenNavigationApp?: (destination: LocationPoint, name?: string, address?: string) => void;
  onOpenContactPatient?: (delivery: Delivery) => void;
  zoneFilter: ZoneId | 'ALL';
  ratesConfig?: RatesConfig;
  returnLeg?: RouteLeg;
  includeRoundTrip?: boolean;
}

export const DeliveryList: React.FC<DeliveryListProps> = ({
  deliveries,
  activeDeliveryId,
  onSelectDelivery,
  onStatusChange,
  onDeleteDelivery,
  onClearAllDeliveries,
  onOpenAddModal,
  onOpenDirections,
  onOpenNavigationApp,
  onOpenContactPatient,
  zoneFilter,
  ratesConfig,
  returnLeg,
  includeRoundTrip,
}) => {
  const [statusTab, setStatusTab] = useState<'ALL' | 'ACTIVE' | 'DELIVERED' | 'STAT'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  const currentRules = getZoneRules(ratesConfig);

  // Filter deliveries
  const filteredDeliveries = deliveries.filter((d) => {
    // Zone filter
    if (zoneFilter !== 'ALL' && d.zone !== zoneFilter) return false;

    // Status filter
    if (statusTab === 'ACTIVE' && d.status === 'delivered') return false;
    if (statusTab === 'DELIVERED' && d.status !== 'delivered') return false;
    if (statusTab === 'STAT' && !d.isStat) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        d.patientName.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        d.rxNumber.toLowerCase().includes(q) ||
        d.medicationName.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full text-slate-900 dark:text-slate-100 transition-colors">
      {/* List Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
              <span>Medication Delivery Route</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {deliveries.length} stop{deliveries.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sequence sorted for minimal driving & immediate STAT emergency prioritization
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {deliveries.length > 0 && onOpenDirections && (
              <button
                type="button"
                onClick={() => onOpenDirections()}
                className="px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors flex items-center gap-1"
                title="View turn-by-turn street directions"
              >
                <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden sm:inline">Directions</span>
              </button>
            )}

            {deliveries.length > 0 && onClearAllDeliveries && (
              <button
                type="button"
                onClick={() => {
                  if (!isConfirmingClear) {
                    setIsConfirmingClear(true);
                    setTimeout(() => setIsConfirmingClear(false), 3500);
                  } else {
                    onClearAllDeliveries();
                    setIsConfirmingClear(false);
                  }
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  isConfirmingClear
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900'
                }`}
                title="Clear entire delivery route"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isConfirmingClear ? 'Confirm Wipe?' : 'Clear'}
                </span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1 shrink-0"
            >
              <span>+ Add Stop</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search address, patient, or Rx#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm sm:text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-teal-600 focus:bg-white dark:focus:bg-slate-800 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs pb-0.5">
            {[
              { id: 'ALL', label: 'All Stops' },
              { id: 'ACTIVE', label: 'In Progress' },
              { id: 'DELIVERED', label: 'Delivered' },
              { id: 'STAT', label: 'STAT Only' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusTab(tab.id as any)}
                className={`px-3 py-1.5 sm:py-1 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap min-h-[34px] sm:min-h-0 flex items-center active:scale-95 ${
                  statusTab === tab.id
                    ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deliveries Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-transparent max-h-[640px]">
        {deliveries.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl my-2 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full mb-2">
              <MapPin className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Destinations on Route</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-3">
              All delivery stops have been cleared. Add destination addresses to generate an optimized delivery route and calculate zone pay.
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>+ Add Delivery Destination</span>
            </button>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-medium">No deliveries found matching current filters</p>
          </div>
        ) : (
          filteredDeliveries.map((delivery) => {
            const isSelected = activeDeliveryId === delivery.id;
            const isDelivered = delivery.status === 'delivered';
            const rule = currentRules.find((r) => r.id === delivery.zone);

            return (
              <div
                key={delivery.id}
                onClick={() => onSelectDelivery(delivery.id)}
                className={`rounded-xl border transition-all p-3 cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/40 ring-2 ring-teal-500/20 shadow-sm'
                    : isDelivered
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 opacity-80 hover:opacity-100'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                }`}
              >
                {/* Zone Ribbon Tag */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded text-white shadow-xs"
                      style={{ backgroundColor: rule?.color || '#3b82f6' }}
                    >
                      Stop #{delivery.sequence}
                    </span>

                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded border"
                      style={{
                        color: rule?.borderColor,
                        borderColor: rule?.borderColor,
                        backgroundColor: rule?.bgColor,
                      }}
                    >
                      {delivery.zone} ({delivery.distanceFromHubMiles} mi)
                    </span>

                    {delivery.isStat && (
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-600 text-white animate-pulse">
                        STAT EMERGENCY
                      </span>
                    )}

                    {delivery.tempControlled && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 flex items-center gap-0.5 border border-sky-200 dark:border-sky-800">
                        <span>Chilled 2-8°C</span>
                      </span>
                    )}

                    {delivery.signatureRequired && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Sig. Required
                      </span>
                    )}
                  </div>

                  {/* Calculated Pay and Delete Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase tracking-wider">Stop Pay</span>
                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                        ${delivery.pay.toFixed(2)}
                      </span>
                      {delivery.surcharge !== undefined && delivery.surcharge > 0 && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            delivery.surchargeReason?.toLowerCase().includes('weekend') ||
                            delivery.surcharge === (ratesConfig?.weekendSurcharge.rate ?? 2)
                              ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                          title={delivery.surchargeReason || 'Time differential surcharge'}
                        >
                          +${delivery.surcharge.toFixed(2)} {delivery.surchargeReason ? delivery.surchargeReason.replace(' Surcharge', '') : 'Differential'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDelivery(delivery.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                      title={`Remove "${delivery.address}" from route`}
                      aria-label="Remove destination"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Patient & Medication Details */}
                <div className="mb-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{delivery.patientName}</h4>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{delivery.rxNumber}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{delivery.address}, {delivery.city} {delivery.zip}</span>
                  </div>

                  <div className="mt-1.5 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Rx: </span>
                    <span className="text-slate-700 dark:text-slate-300">{delivery.medicationName}</span>
                  </div>
                </div>

                {/* Special Instructions if present */}
                {delivery.specialInstructions && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-850/60 p-1.5 rounded mb-2 font-normal italic">
                    Note: {delivery.specialInstructions}
                  </p>
                )}

                {/* Timing, ETA & Actions Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>
                      {isDelivered ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Delivered at {delivery.deliveredAt || '10:45 AM'}
                        </span>
                      ) : (
                        <span>
                          ETA: <strong className="text-slate-900 dark:text-slate-100">{delivery.eta || 'Calculating...'}</strong>
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap justify-end">
                    {/* 1-Tap GPS Voice Navigation */}
                    {onOpenNavigationApp && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNavigationApp(
                            delivery.coordinates,
                            delivery.patientName,
                            delivery.address
                          );
                        }}
                        className="px-2 sm:px-2.5 py-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1 min-h-[32px] active:scale-95 cursor-pointer"
                        title="Open in Google Maps, Apple Maps, or Waze"
                      >
                        <Compass className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>GPS</span>
                      </button>
                    )}

                    {/* Patient Voice Call & SMS Shortcut */}
                    {onOpenContactPatient ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenContactPatient(delivery);
                        }}
                        className="px-2 sm:px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/80 dark:border-sky-800 rounded-lg transition-colors flex items-center gap-1 min-h-[32px] active:scale-95 cursor-pointer"
                        title="Call patient or send pre-filled ETA SMS"
                      >
                        <Phone className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                        <span>Contact</span>
                      </button>
                    ) : delivery.phone ? (
                      <a
                        href={`tel:${delivery.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 sm:px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/80 dark:border-sky-800 rounded-lg transition-colors flex items-center gap-1 min-h-[32px]"
                        title={`Call patient: ${delivery.phone}`}
                      >
                        <Phone className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                        <span>Call</span>
                      </a>
                    ) : null}

                    {onOpenDirections && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDirections(delivery.id);
                        }}
                        className="px-2 sm:px-2.5 py-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 rounded-lg transition-colors flex items-center gap-1 min-h-[32px] active:scale-95 cursor-pointer"
                        title="View turn-by-turn directions to this stop"
                      >
                        <Navigation className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span>Directions</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDelivery(delivery.id);
                      }}
                      className="p-1.5 sm:px-2 sm:py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors flex items-center gap-1 min-h-[32px] cursor-pointer"
                      title="Remove this location"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>

                    {isDelivered ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(delivery.id, 'pending');
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline min-h-[32px] cursor-pointer"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(delivery.id, 'delivered');
                        }}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-xs flex items-center gap-1.5 transition-colors min-h-[34px] active:scale-95 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivered</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Round Trip Return Leg Banner */}
        {includeRoundTrip && returnLeg && deliveries.length > 0 && (
          <div className="p-3.5 rounded-xl border border-dashed border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/30 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400 shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-white block truncate">
                  Final Leg: {returnLeg.toName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {returnLeg.distanceMiles} mi return drive • ~{returnLeg.durationMinutes} min
                </span>
              </div>
            </div>

            {onOpenNavigationApp && returnLeg.toCoords && (
              <button
                type="button"
                onClick={() => onOpenNavigationApp(returnLeg.toCoords!, returnLeg.toName)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer"
                title="Launch GPS turn-by-turn navigation back to base"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>GPS to Base</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
