import React, { useState, useEffect } from 'react';
import { RatesConfig, ZoneId } from '../types';
import { DEFAULT_RATES_CONFIG, formatMinutesTo12Hour, parseMinutesFromTimeString } from '../utils/zonePay';
import {
  DollarSign,
  Clock,
  Calendar,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface RateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ratesConfig: RatesConfig;
  onSaveRates: (newConfig: RatesConfig) => void;
}

export const RateEditorModal: React.FC<RateEditorModalProps> = ({
  isOpen,
  onClose,
  ratesConfig,
  onSaveRates,
}) => {
  // Local state initialized from current ratesConfig
  const [formData, setFormData] = useState<RatesConfig>(ratesConfig);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync state whenever modal opens or external rates change
  useEffect(() => {
    if (isOpen) {
      setFormData(ratesConfig);
      setSaveSuccess(false);
      setValidationError(null);
    }
  }, [isOpen, ratesConfig]);

  if (!isOpen) return null;

  const handleZonePayChange = (zone: ZoneId, valueStr: string) => {
    const val = parseFloat(valueStr);
    setFormData((prev) => {
      if (zone === 'STAT') {
        return {
          ...prev,
          zones: {
            ...prev.zones,
            STAT: { pay: isNaN(val) ? 0 : Math.max(0, val) },
          },
        };
      }
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zone]: {
            ...prev.zones[zone],
            pay: isNaN(val) ? 0 : Math.max(0, val),
          },
        },
      };
    });
  };

  const handleZoneMaxMilesChange = (
    zone: 'Zone 1' | 'Zone 2' | 'Zone 3' | 'Zone 4',
    valueStr: string
  ) => {
    const val = parseInt(valueStr, 10);
    setFormData((prev) => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zone]: {
          ...prev.zones[zone],
          maxMiles: isNaN(val) ? 0 : Math.max(1, val),
        },
      },
    }));
  };

  const handleResetToDefaults = () => {
    setFormData(DEFAULT_RATES_CONFIG);
    setValidationError(null);
    setSaveSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic sanity checks
    if (
      formData.zones['Zone 1'].pay < 0 ||
      formData.zones['Zone 2'].pay < 0 ||
      formData.zones['Zone 3'].pay < 0 ||
      formData.zones['Zone 4'].pay < 0 ||
      formData.zones['Zone 5'].pay < 0 ||
      formData.zones.STAT.pay < 0
    ) {
      setValidationError('Zone pay rates cannot be negative values.');
      return;
    }

    if (formData.afterHourSurcharge.rate < 0 || formData.weekendSurcharge.rate < 0) {
      setValidationError('Surcharge rates cannot be negative values.');
      return;
    }

    setValidationError(null);
    onSaveRates(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  // Live preview scenario calculation
  const previewZone2Pay = formData.zones['Zone 2'].pay;
  const previewWeekendRate = formData.weekendSurcharge.enabled ? formData.weekendSurcharge.rate : 0;
  const previewWeekendTotal = previewZone2Pay + previewWeekendRate;

  const weekendMins = parseMinutesFromTimeString(formData.weekendSurcharge.cutoffTime) ?? 960;
  const eveningMins = parseMinutesFromTimeString(formData.afterHourSurcharge.cutoffTime) ?? 1080;

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-lg text-white leading-tight">
                Edit Zone Pay & Surcharge Rates
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px] sm:max-w-none">
                Adjust base driver zone rates, after-hour cutoff, and weekend rates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Rates updated successfully! Recalculating delivery route...</span>
            </div>
          )}

          {/* Section 1: Base Zone Rates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Distance Zone Pay Rates</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Base compensation awarded per stop according to driving radius from dispatch depot
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Zone 1 */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Zone 1
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    {formData.zones['Zone 1'].minMiles} - {formData.zones['Zone 1'].maxMiles} mi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones['Zone 1'].pay}
                      onChange={(e) => handleZonePayChange('Zone 1', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Zone 2 */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Zone 2
                  </span>
                  <span className="text-[11px] text-blue-700 font-medium">
                    {formData.zones['Zone 2'].minMiles} - {formData.zones['Zone 2'].maxMiles} mi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones['Zone 2'].pay}
                      onChange={(e) => handleZonePayChange('Zone 2', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Zone 3 */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Zone 3
                  </span>
                  <span className="text-[11px] text-purple-700 font-medium">
                    {formData.zones['Zone 3'].minMiles} - {formData.zones['Zone 3'].maxMiles} mi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones['Zone 3'].pay}
                      onChange={(e) => handleZonePayChange('Zone 3', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Zone 4 */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Zone 4
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">
                    {formData.zones['Zone 4'].minMiles} - {formData.zones['Zone 4'].maxMiles} mi
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones['Zone 4'].pay}
                      onChange={(e) => handleZonePayChange('Zone 4', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Zone 5 */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Zone 5
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">
                    {formData.zones['Zone 5'].minMiles}+ mi (Long Distance)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones['Zone 5'].pay}
                      onChange={(e) => handleZonePayChange('Zone 5', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* STAT Urgent */}
              <div className="p-3 bg-red-50/70 rounded-xl border border-red-300/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    STAT Urgent
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-200 text-red-800 px-1.5 py-0.5 rounded">
                    Emergency
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.zones.STAT.pay}
                      onChange={(e) => handleZonePayChange('STAT', e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shift Differential Surcharges */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>After-Hour & Weekend Shift Differentials</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Added automatically on top of base zone pay when delivery takes place during evening or weekend hours
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* After-Hour / Evening Differential Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      Evening / After-Hours
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.afterHourSurcharge.enabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          afterHourSurcharge: {
                            ...prev.afterHourSurcharge,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Bonus Pay / Stop:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-semibold text-slate-500">
                        +$
                      </span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.afterHourSurcharge.rate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setFormData((prev) => ({
                            ...prev,
                            afterHourSurcharge: {
                              ...prev.afterHourSurcharge,
                              rate: isNaN(val) ? 0 : Math.max(0, val),
                            },
                          }));
                        }}
                        disabled={!formData.afterHourSurcharge.enabled}
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Start Cutoff Time:
                    </label>
                    <input
                      type="time"
                      value={formData.afterHourSurcharge.cutoffTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          afterHourSurcharge: {
                            ...prev.afterHourSurcharge,
                            cutoffTime: e.target.value,
                          },
                        }))
                      }
                      disabled={!formData.afterHourSurcharge.enabled}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-snug">
                  {formData.afterHourSurcharge.enabled ? (
                    <>
                      Drivers receive an extra{' '}
                      <strong className="text-slate-800">
                        +${formData.afterHourSurcharge.rate.toFixed(2)}
                      </strong>{' '}
                      on every stop delivered after{' '}
                      <strong className="text-slate-800">{formatMinutesTo12Hour(eveningMins)}</strong>.
                    </>
                  ) : (
                    <span className="text-slate-400 italic">Evening surcharge is currently disabled.</span>
                  )}
                </p>
              </div>

              {/* Weekend Differential Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      Weekend Rate (Sat & Sun)
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.weekendSurcharge.enabled}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          weekendSurcharge: {
                            ...prev.weekendSurcharge,
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Bonus Pay / Stop:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-semibold text-slate-500">
                        +$
                      </span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={formData.weekendSurcharge.rate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setFormData((prev) => ({
                            ...prev,
                            weekendSurcharge: {
                              ...prev.weekendSurcharge,
                              rate: isNaN(val) ? 0 : Math.max(0, val),
                            },
                          }));
                        }}
                        disabled={!formData.weekendSurcharge.enabled}
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Start Cutoff Time:
                    </label>
                    <input
                      type="time"
                      value={formData.weekendSurcharge.cutoffTime}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          weekendSurcharge: {
                            ...prev.weekendSurcharge,
                            cutoffTime: e.target.value,
                          },
                        }))
                      }
                      disabled={!formData.weekendSurcharge.enabled}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-snug">
                  {formData.weekendSurcharge.enabled ? (
                    <>
                      Drivers receive an extra{' '}
                      <strong className="text-slate-800">
                        +${formData.weekendSurcharge.rate.toFixed(2)}
                      </strong>{' '}
                      on Sat/Sun deliveries completed after{' '}
                      <strong className="text-slate-800">{formatMinutesTo12Hour(weekendMins)}</strong>.
                    </>
                  ) : (
                    <span className="text-slate-400 italic">Weekend surcharge is currently disabled.</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Live Preview Helper */}
          <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl text-xs space-y-1">
            <div className="font-bold text-teal-950 flex items-center gap-1.5">
              <span>Simulation Example Calculation</span>
            </div>
            <p className="text-teal-800">
              A 22-mile stop delivered on Saturday after {formatMinutesTo12Hour(weekendMins)} will earn:{' '}
              <strong className="text-teal-950">Zone 2 (${previewZone2Pay.toFixed(2)})</strong> +{' '}
              <strong className="text-teal-950">Weekend (+${previewWeekendRate.toFixed(2)})</strong> ={' '}
              <strong className="text-emerald-800 text-sm font-extrabold">
                ${previewWeekendTotal.toFixed(2)}
              </strong>
            </p>
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Restore Contract Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Rates & Recalculate</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
