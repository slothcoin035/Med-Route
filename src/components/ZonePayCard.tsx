import React, { useState } from 'react';
import { ZoneBreakdownSummary, ZoneId, TripScheduleConfig, DayOfWeek, RatesConfig } from '../types';
import {
  ZONE_RULES,
  getZoneRules,
  evaluateStopPay,
  calculateSurchargeForTime,
  parseMinutesFromTimeString,
  formatMinutesTo12Hour,
} from '../utils/zonePay';
import {
  DollarSign,
  Calculator,
  Clock,
  Moon,
  Sun,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
  Sliders,
  FileText,
} from 'lucide-react';

interface ZonePayCardProps {
  summary: ZoneBreakdownSummary[];
  totalPay: number;
  completedPay: number;
  totalMiles: number;
  totalDeliveries: number;
  completedDeliveries: number;
  basePayTotal?: number;
  surchargesTotal?: number;
  eveningSurchargeCount?: number;
  eveningSurchargeTotal?: number;
  weekendSurchargeCount?: number;
  weekendSurchargeTotal?: number;
  scheduleConfig?: TripScheduleConfig;
  onScheduleConfigChange?: (config: TripScheduleConfig) => void;
  onFilterByZone?: (zone: ZoneId | 'ALL') => void;
  activeFilter?: ZoneId | 'ALL';
  ratesConfig?: RatesConfig;
  onOpenRateEditor?: () => void;
  onOpenShiftSettlement?: () => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const ZonePayCard: React.FC<ZonePayCardProps> = ({
  summary,
  totalPay,
  completedPay,
  totalMiles,
  totalDeliveries,
  completedDeliveries,
  basePayTotal = totalPay,
  surchargesTotal = 0,
  eveningSurchargeCount = 0,
  eveningSurchargeTotal = 0,
  weekendSurchargeCount = 0,
  weekendSurchargeTotal = 0,
  scheduleConfig,
  onScheduleConfigChange,
  onFilterByZone,
  activeFilter = 'ALL',
  ratesConfig,
  onOpenRateEditor,
  onOpenShiftSettlement,
}) => {
  const [calcMiles, setCalcMiles] = useState<string>('24.5');
  const [calcIsStat, setCalcIsStat] = useState<boolean>(false);
  const [showCalculator, setShowCalculator] = useState<boolean>(false);
  const [showScheduleSettings, setShowScheduleSettings] = useState<boolean>(true);

  // Quick estimator output based on current scheduleConfig and ratesConfig
  const numericMiles = parseFloat(calcMiles) || 0;
  const simulatedEstimate = evaluateStopPay(numericMiles, calcIsStat, scheduleConfig, undefined, ratesConfig);

  // Current active surcharge rule summary
  const currentDay = scheduleConfig?.dayOfWeek || 'Sunday';
  const customTimeMinutes = scheduleConfig
    ? parseMinutesFromTimeString(scheduleConfig.customTime) || 1110
    : 1110;
  const activeSurchargeInfo = calculateSurchargeForTime(currentDay, customTimeMinutes, ratesConfig);

  const eveningCutoffMins = ratesConfig
    ? parseMinutesFromTimeString(ratesConfig.afterHourSurcharge.cutoffTime) ?? 1080
    : 1080;
  const eveningCutoffStr = formatMinutesTo12Hour(eveningCutoffMins);
  const eveningRate = ratesConfig ? ratesConfig.afterHourSurcharge.rate : 1.0;

  const weekendCutoffMins = ratesConfig
    ? parseMinutesFromTimeString(ratesConfig.weekendSurcharge.cutoffTime) ?? 960
    : 960;
  const weekendCutoffStr = formatMinutesTo12Hour(weekendCutoffMins);
  const weekendRate = ratesConfig ? ratesConfig.weekendSurcharge.rate : 2.0;

  const currentRules = getZoneRules(ratesConfig);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header with Title and Current Shift Earnings */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold tracking-tight text-white">
                Zone Pay Rate & Shift Earnings
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Distance radius pay + evening & weekend differential rules
            </p>
          </div>

          <div className="flex items-baseline gap-3 text-right bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Projected</span>
              <span className="text-xl font-bold text-emerald-400">${totalPay.toFixed(2)}</span>
            </div>
            <div className="border-l border-slate-700 pl-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Delivered Pay</span>
              <span className="text-xl font-bold text-teal-300">${completedPay.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Quick Shift Metric Bar */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400">Total Route Miles</span>
            <span className="font-semibold text-slate-100">{totalMiles} mi</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Stops Progress</span>
            <span className="font-semibold text-slate-100">
              {completedDeliveries} / {totalDeliveries} done (
              {Math.round((completedDeliveries / (totalDeliveries || 1)) * 100)}%)
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">Avg. Pay / Stop</span>
            <span className="font-semibold text-emerald-400">
              ${totalDeliveries > 0 ? (totalPay / totalDeliveries).toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </div>

      {/* Time-Based Differential Rules Legend & Interactive Shift Simulator */}
      {scheduleConfig && onScheduleConfigChange && (
        <div className="bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-800 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Trip Day & Shift Differential Settings</span>
            </div>
            <button
              type="button"
              onClick={() => setShowScheduleSettings(!showScheduleSettings)}
              className="text-[11px] text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold"
            >
              {showScheduleSettings ? 'Collapse' : 'Adjust Shift'}
            </button>
          </div>

          {showScheduleSettings && (
            <div className="space-y-2.5 pt-1">
              {/* Day of week buttons */}
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Trip Shift Day:
                </span>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = scheduleConfig.dayOfWeek === day;
                    const isDayWeekend = day === 'Saturday' || day === 'Sunday';
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          onScheduleConfigChange({
                            ...scheduleConfig,
                            dayOfWeek: day,
                          })
                        }
                        className={`py-1 text-center rounded text-[11px] font-semibold transition-colors ${
                          isSelected
                            ? isDayWeekend
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                            : isDayWeekend
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift Time Presets & Custom Time */}
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">
                  Trip Time Presets:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onScheduleConfigChange({
                        ...scheduleConfig,
                        timeMode: 'custom_time',
                        customTime: '11:00',
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      scheduleConfig.customTime === '11:00'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    11:00 AM (Daytime)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onScheduleConfigChange({
                        ...scheduleConfig,
                        timeMode: 'custom_time',
                        customTime: '16:30',
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                      scheduleConfig.customTime === '16:30'
                        ? 'bg-purple-700 text-white border-purple-700'
                        : 'bg-white text-purple-800 border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>4:30 PM (Sat/Sun +$2.00)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onScheduleConfigChange({
                        ...scheduleConfig,
                        timeMode: 'custom_time',
                        customTime: '18:30',
                      })
                    }
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                      scheduleConfig.customTime === '18:30'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <Moon className="w-3 h-3 text-amber-300" />
                    <span>6:30 PM (After 6pm +$1.00)</span>
                  </button>

                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[11px] text-slate-500">Custom:</span>
                    <input
                      type="time"
                      value={scheduleConfig.customTime}
                      onChange={(e) =>
                        onScheduleConfigChange({
                          ...scheduleConfig,
                          timeMode: 'custom_time',
                          customTime: e.target.value,
                        })
                      }
                      className="px-1.5 py-0.5 border border-slate-300 rounded bg-white text-slate-800 text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Active Surcharge Status Banner */}
              <div
                className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                  activeSurchargeInfo.surcharge === 2
                    ? 'bg-purple-50 border-purple-200 text-purple-950'
                    : activeSurchargeInfo.surcharge === 1
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {activeSurchargeInfo.surcharge === 2 ? (
                    <Sun className="w-4 h-4 text-purple-600 shrink-0" />
                  ) : activeSurchargeInfo.surcharge === 1 ? (
                    <Moon className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {activeSurchargeInfo.surcharge > 0
                        ? `+$${activeSurchargeInfo.surcharge.toFixed(2)} Surcharge Active`
                        : 'Standard Daytime Zone Rates'}
                    </span>
                    <span className="text-slate-600 ml-1">
                      {activeSurchargeInfo.surcharge === 2
                        ? `(Saturday & Sunday after 4:00 PM: +$2.00 on all ${totalDeliveries} stops)`
                        : activeSurchargeInfo.surcharge === 1
                        ? `(Any trip after 6:00 PM: +$1.00 on all ${totalDeliveries} stops)`
                        : '(No evening or weekend surcharge active)'}
                    </span>
                  </div>
                </div>

                <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-white border border-slate-300">
                  {scheduleConfig.dayOfWeek} @ {scheduleConfig.customTime}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rate Rules Summary Banner */}
      <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-700">
        <div className="flex items-center gap-1.5">
          <Moon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>Evening Rule:</strong> Any trip after {eveningCutoffStr}: <strong className="text-amber-700">+${eveningRate.toFixed(2)} / stop</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>
            <strong>Weekend Rule:</strong> Sat & Sun after {weekendCutoffStr}: <strong className="text-purple-700">+${weekendRate.toFixed(2)} every stop</strong>
          </span>
        </div>
      </div>

      {/* Recreated Table: ZONE BREAKDOWN | ZONE PAY */}
      <div className="p-3 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <span>Rate Sheet Standard</span>
            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">Official</span>
          </span>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {onOpenShiftSettlement && (
              <button
                type="button"
                onClick={onOpenShiftSettlement}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1 shadow-2xs"
                title="View Driver Shift Settlement & Zone Payroll Breakdown in Settings"
              >
                <FileText className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                <span>Shift Settlement</span>
              </button>
            )}
            {onOpenRateEditor && (
              <button
                type="button"
                onClick={onOpenRateEditor}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/70 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 transition-colors flex items-center gap-1 shadow-2xs"
                title="Edit Zone Base Pay, Weekend, and After-Hour Rates"
              >
                <Sliders className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>Edit Rates</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium flex items-center gap-1 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showCalculator ? 'Hide Estimator' : 'Test Miles & Pay'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs bg-white dark:bg-slate-850 text-xs">
          <table className="w-full min-w-[340px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">ZONE BREAKDOWN</th>
                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">DISTANCE</th>
                <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700 text-right">BASE RATE</th>
                <th className="py-2 px-3 text-right bg-teal-50/50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-300">SHIFT ACCUM.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-750">
              {summary.map((row) => {
                const rule = currentRules.find((r) => r.id === row.zone);
                const isSelected = activeFilter === row.zone;

                return (
                  <tr
                    key={row.zone}
                    onClick={() => onFilterByZone && onFilterByZone(isSelected ? 'ALL' : row.zone)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/50 font-medium'
                        : row.count > 0
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        : 'opacity-75 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-750">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: rule?.color || '#64748b' }}
                        />
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</span>
                        {row.zone === 'STAT' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1 py-0.2 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-800">
                            Urgent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300">
                      {row.rangeLabel}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-750 text-right font-bold text-slate-900 dark:text-slate-100">
                      ${row.rate}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {row.count > 0 ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700">
                            {row.count} {row.count === 1 ? 'stop' : 'stops'}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            ${row.subtotal.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/70 font-semibold border-t border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <td colSpan={2} className="py-1.5 px-3">
                  Base Zone Subtotal
                </td>
                <td className="py-1.5 px-3 text-right text-slate-500 dark:text-slate-400 font-normal">
                  {totalDeliveries} Stops
                </td>
                <td className="py-1.5 px-3 text-right text-slate-800 dark:text-slate-100 font-bold">
                  ${basePayTotal.toFixed(2)}
                </td>
              </tr>

              {eveningSurchargeCount > 0 && (
                <tr className="bg-amber-50/70 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 font-medium">
                  <td colSpan={2} className="py-1.5 px-3 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Evening Differential (After 6:00 PM: +$1.00/stop)</span>
                  </td>
                  <td className="py-1.5 px-3 text-right text-amber-700 dark:text-amber-400 font-semibold">
                    {eveningSurchargeCount} {eveningSurchargeCount === 1 ? 'stop' : 'stops'}
                  </td>
                  <td className="py-1.5 px-3 text-right text-amber-800 dark:text-amber-200 font-bold">
                    +${eveningSurchargeTotal.toFixed(2)}
                  </td>
                </tr>
              )}

              {weekendSurchargeCount > 0 && (
                <tr className="bg-purple-50/70 dark:bg-purple-950/40 border-t border-purple-200 dark:border-purple-800/80 text-purple-900 dark:text-purple-300 font-medium">
                  <td colSpan={2} className="py-1.5 px-3 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Weekend Evening (Sat/Sun After 4:00 PM: +$2.00/stop)</span>
                  </td>
                  <td className="py-1.5 px-3 text-right text-purple-700 dark:text-purple-400 font-semibold">
                    {weekendSurchargeCount} {weekendSurchargeCount === 1 ? 'stop' : 'stops'}
                  </td>
                  <td className="py-1.5 px-3 text-right text-purple-800 dark:text-purple-200 font-bold">
                    +${weekendSurchargeTotal.toFixed(2)}
                  </td>
                </tr>
              )}

              <tr className="bg-slate-100 dark:bg-slate-800 font-black border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                <td colSpan={2} className="py-2 px-3 text-xs uppercase tracking-wider">
                  GRAND TOTAL ACCUMULATED PAY
                </td>
                <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400 font-normal">
                  {totalDeliveries} Stops
                </td>
                <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 text-sm">
                  ${totalPay.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Interactive Quick Zone & Pay Calculator */}
      {showCalculator && (
        <div className="p-3 bg-teal-50/50 dark:bg-slate-850/80 border-b border-teal-100 dark:border-slate-800 text-xs animate-in fade-in duration-200">
          <div className="font-semibold text-teal-900 dark:text-teal-300 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>Instant Zone & Pay Estimator</span>
            </div>
            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-normal">
              Based on {scheduleConfig?.dayOfWeek} @ {scheduleConfig?.customTime}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-0.5">Miles from Hub:</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="250"
                value={calcMiles}
                onChange={(e) => setCalcMiles(e.target.value)}
                placeholder="e.g. 24.5"
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:outline-teal-600"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={calcIsStat}
                  onChange={(e) => setCalcIsStat(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-medium text-rose-700 dark:text-rose-400">STAT Emergency Rx</span>
              </label>
            </div>

            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Classification</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{simulatedEstimate.zone}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Base: ${simulatedEstimate.basePay}.00</span>
            </div>

            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-right">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase block">Total Stop Pay</span>
              <div className="flex items-baseline justify-end gap-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ${simulatedEstimate.pay.toFixed(2)}
                </span>
              </div>
              {simulatedEstimate.surcharge > 0 && (
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold block">
                  (+${simulatedEstimate.surcharge.toFixed(2)} surcharge)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter indicator if filtered */}
      {activeFilter !== 'ALL' && (
        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80 text-xs flex items-center justify-between text-amber-900 dark:text-amber-300">
          <span>
            Filtering deliveries by: <strong>{activeFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => onFilterByZone && onFilterByZone('ALL')}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline font-medium"
          >
            Show All
          </button>
        </div>
      )}
    </div>
  );
};
