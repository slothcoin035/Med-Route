import React, { useState, useRef, useEffect } from 'react';
import { Delivery, DriverState, HubLocation, ZoneBreakdownSummary, TripScheduleConfig, RatesConfig } from '../types';
import { formatMinutesTo12Hour, parseMinutesFromTimeString } from '../utils/zonePay';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  DollarSign,
  FileText,
  Moon,
  Sun,
  ChevronDown,
  FileSpreadsheet,
  FileCode,
  Check,
  MapPin,
} from 'lucide-react';
import {
  downloadShiftSummaryCSV,
  downloadShiftSummaryPDF,
  downloadShiftSummaryTXT,
  ShiftExportParams,
} from '../utils/exportShiftSummary';
import { generateLast7ShiftsHistory } from '../utils/shiftHistory';
import { DailyEarningsTrendChart } from './DailyEarningsTrendChart';

interface PayReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverState;
  hub: HubLocation;
  deliveries: Delivery[];
  summary: ZoneBreakdownSummary[];
  totalPay: number;
  completedPay: number;
  totalMiles: number;
  basePayTotal?: number;
  surchargesTotal?: number;
  eveningSurchargeCount?: number;
  eveningSurchargeTotal?: number;
  weekendSurchargeCount?: number;
  weekendSurchargeTotal?: number;
  scheduleConfig?: TripScheduleConfig;
  ratesConfig?: RatesConfig;
}

export const PayReceiptModal: React.FC<PayReceiptModalProps> = ({
  isOpen,
  onClose,
  driver,
  hub,
  deliveries,
  summary,
  totalPay,
  completedPay,
  totalMiles,
  basePayTotal = totalPay,
  surchargesTotal = 0,
  eveningSurchargeCount = 0,
  eveningSurchargeTotal = 0,
  weekendSurchargeCount = 0,
  weekendSurchargeTotal = 0,
  scheduleConfig,
  ratesConfig,
}) => {
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    if (isDownloadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDownloadMenuOpen]);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (downloadNotification) {
      const timer = setTimeout(() => {
        setDownloadNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [downloadNotification]);

  // Handle Escape key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shiftsHistory = generateLast7ShiftsHistory({
    currentTotalPay: totalPay,
    currentCompletedPay: completedPay,
    currentBasePay: basePayTotal,
    currentSurcharges: surchargesTotal,
    currentStopsCount: deliveries.length,
    currentMiles: totalMiles,
  });

  const exportParams: ShiftExportParams = {
    driver,
    hub,
    deliveries,
    summary,
    totalPay,
    completedPay,
    totalMiles,
    basePayTotal,
    surchargesTotal,
    eveningSurchargeCount,
    eveningSurchargeTotal,
    weekendSurchargeCount,
    weekendSurchargeTotal,
    scheduleConfig,
  };

  const handleDownload = (format: 'csv' | 'pdf' | 'txt') => {
    setIsDownloadMenuOpen(false);
    try {
      if (format === 'csv') {
        downloadShiftSummaryCSV(exportParams);
        setDownloadNotification('Shift summary downloaded as CSV (.csv)');
      } else if (format === 'pdf') {
        downloadShiftSummaryPDF(exportParams);
        setDownloadNotification('Shift summary downloaded as PDF (.pdf)');
      } else if (format === 'txt') {
        downloadShiftSummaryTXT(exportParams);
        setDownloadNotification('Shift summary downloaded as Text (.txt)');
      }
    } catch (err) {
      console.error(`Error generating ${format} summary:`, err);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Printing unavailable in current environment:', err);
    }
  };

  const completedDeliveriesCount = deliveries.filter((d) => d.status === 'delivered').length;

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

  return (
    <div
      className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-6 overflow-y-auto print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-2 sm:my-8 overflow-hidden print:border-none print:shadow-none print:m-0 animate-in fade-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sticky so Close button and export actions are always reachable */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between print:hidden gap-2 sm:gap-3 border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400 shrink-0" />
            <h3 className="font-bold text-xs sm:text-base truncate">
              Shift Settlement & Zone Pay
            </h3>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Download Shift Summary Button with Format Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="download-shift-summary-btn"
                onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold flex items-center gap-1 sm:gap-1.5 text-xs transition-colors shadow-xs"
                title="Download Shift Summary (CSV, PDF, or Text)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download Summary</span>
                <span className="sm:hidden">Export</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDownloadMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 text-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Select Summary Format
                  </div>

                  <button
                    type="button"
                    id="download-summary-csv"
                    onClick={() => handleDownload('csv')}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-start gap-2.5 transition-colors group"
                  >
                    <div className="p-1.5 rounded bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>CSV Spreadsheet</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          .csv
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Structured data with shift metrics, zone rates & deliveries
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="download-summary-pdf"
                    onClick={() => handleDownload('pdf')}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-start gap-2.5 transition-colors group"
                  >
                    <div className="p-1.5 rounded bg-rose-50 text-rose-700 group-hover:bg-rose-100 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Official PDF Report</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                          .pdf
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Formal printable settlement report with signatures
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="download-summary-txt"
                    onClick={() => handleDownload('txt')}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-start gap-2.5 transition-colors group"
                  >
                    <div className="p-1.5 rounded bg-blue-50 text-blue-700 group-hover:bg-blue-100 shrink-0 mt-0.5">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <span>Plain Text Slip</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                          .txt
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Monospace summary for logs, email, or messaging
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors flex items-center gap-1 text-xs"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Download Success Notification Banner */}
        {downloadNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center justify-between animate-in fade-in duration-150 print:hidden">
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-200" />
              <span>{downloadNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadNotification(null)}
              className="text-emerald-200 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Printable Settlement Statement */}
        <div className="p-6 text-xs text-slate-800 space-y-5 print:p-0">
          {/* Slip Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div className="flex items-center gap-3.5">
              <img
                src="/app-icon.png"
                alt="MedRoute"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
              />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-slate-900 text-white rounded">
                  Medication Delivery Manifest & Zone Payroll
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">MedRoute Logistics</h2>
                <p className="text-slate-500 text-xs">{hub.name}</p>
                <p className="text-slate-500 text-xs">{hub.address}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[11px] block">Date: {new Date().toLocaleDateString()}</span>
              <span className="text-slate-400 text-[11px] block">Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="font-mono text-slate-700 text-[11px] block mt-1">Batch: #{Date.now().toString().slice(-6)}</span>
            </div>
          </div>

          {/* Driver details */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-teal-500/50 shrink-0 bg-slate-900 flex items-center justify-center font-bold text-teal-300 text-xs shadow-xs">
              {driver.avatarUrl ? (
                <img src={driver.avatarUrl} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                driver.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 min-w-0">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Driver Name</span>
                <span className="font-bold text-slate-900 truncate block">{driver.name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Vehicle</span>
                <span className="font-semibold text-slate-800 truncate block">{driver.vehicle}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">License Plate</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">{driver.licensePlate}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Mileage</span>
                <span className="font-bold text-slate-900 block">{totalMiles} miles</span>
              </div>
            </div>

            {driver.address && (
              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center gap-1.5 text-xs text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-bold text-slate-500 text-[10px] uppercase">Driver Base:</span>
                <span className="font-medium text-slate-800 truncate">{driver.address}</span>
              </div>
            )}
          </div>

          {/* Shift Status Summary Bar */}
          <div className="bg-slate-100/70 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Stops Delivered</span>
                <span className="font-bold text-slate-900">
                  {completedDeliveriesCount} of {deliveries.length} (
                  {deliveries.length > 0 ? Math.round((completedDeliveriesCount / deliveries.length) * 100) : 0}%)
                </span>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Shift Timing</span>
                <span className="font-bold text-slate-800">
                  {scheduleConfig?.dayOfWeek || 'Shift'} @ {scheduleConfig?.customTime || 'Daytime'}
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-3 text-right">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Delivered Pay</span>
                <span className="font-bold text-teal-700">${completedPay.toFixed(2)}</span>
              </div>
              <div className="border-l border-slate-300 pl-3">
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Total Projected</span>
                <span className="font-extrabold text-emerald-700">${totalPay.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Zone Pay Breakdown (Replicating Paper Rate Structure) */}
          <div>
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider mb-2">
              Zone Breakdown & Shift Pay Calculation
            </h4>
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-3 border-r border-slate-300">Zone Breakdown</th>
                    <th className="py-1.5 px-3 border-r border-slate-300">Distance Range</th>
                    <th className="py-1.5 px-3 border-r border-slate-300 text-right">Zone Pay</th>
                    <th className="py-1.5 px-3 border-r border-slate-300 text-center">Stops</th>
                    <th className="py-1.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary.map((row) => (
                    <tr key={row.zone} className={row.count > 0 ? 'bg-white font-medium' : 'bg-slate-50 text-slate-400'}>
                      <td className="py-1.5 px-3 border-r border-slate-200">{row.name}</td>
                      <td className="py-1.5 px-3 border-r border-slate-200">{row.rangeLabel}</td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono">${row.rate}.00</td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-center font-bold">
                        {row.count}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                        ${row.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t border-slate-300 text-slate-700">
                    <td colSpan={3} className="py-1.5 px-3">
                      Base Zone Subtotal
                    </td>
                    <td className="py-1.5 px-3 text-center">{deliveries.length}</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 font-bold">
                      ${basePayTotal.toFixed(2)}
                    </td>
                  </tr>

                  {eveningSurchargeCount > 0 && (
                    <tr className="bg-amber-50/60 font-medium border-t border-amber-200 text-amber-900">
                      <td colSpan={3} className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-amber-600" />
                          <span>Evening Differential (After {eveningCutoffStr}: +${eveningRate.toFixed(2)}/stop)</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold">{eveningSurchargeCount}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-amber-800">
                        +${eveningSurchargeTotal.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  {weekendSurchargeCount > 0 && (
                    <tr className="bg-purple-50/60 font-medium border-t border-purple-200 text-purple-900">
                      <td colSpan={3} className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-purple-600" />
                          <span>Weekend Evening Differential (Sat/Sun After {weekendCutoffStr}: +${weekendRate.toFixed(2)}/stop)</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold">{weekendSurchargeCount}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-purple-800">
                        +${weekendSurchargeTotal.toFixed(2)}
                      </td>
                    </tr>
                  )}

                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-slate-900 text-sm">
                    <td colSpan={3} className="py-2 px-3">
                      GRAND TOTAL ACCUMULATED PAY
                    </td>
                    <td className="py-2 px-3 text-center">{deliveries.length} Stops</td>
                    <td className="py-2 px-3 text-right text-emerald-700">
                      ${totalPay.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 7-Day Daily Earnings Trends Chart (recharts) */}
          <DailyEarningsTrendChart shifts={shiftsHistory} />

          {/* Itemized Stop Manifest */}
          <div>
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider mb-2">
              Itemized Medication Drop Log
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-1 px-2">#</th>
                    <th className="py-1 px-2">Rx Number</th>
                    <th className="py-1 px-2">Patient</th>
                    <th className="py-1 px-2">Zone</th>
                    <th className="py-1 px-2 text-right">Dist.</th>
                    <th className="py-1 px-2 text-right">Base</th>
                    <th className="py-1 px-2 text-right">Surcharge</th>
                    <th className="py-1 px-2 text-right">Net Pay</th>
                    <th className="py-1 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map((d) => {
                    const base = d.basePay !== undefined ? d.basePay : d.pay;
                    const sur = d.surcharge || 0;
                    return (
                      <tr key={d.id}>
                        <td className="py-1 px-2 font-bold">{d.sequence}</td>
                        <td className="py-1 px-2 font-mono text-slate-600">{d.rxNumber}</td>
                        <td className="py-1 px-2 font-semibold">{d.patientName}</td>
                        <td className="py-1 px-2">{d.zone}</td>
                        <td className="py-1 px-2 text-right text-slate-600">{d.distanceFromHubMiles} mi</td>
                        <td className="py-1 px-2 text-right text-slate-600">${base.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right text-slate-600">
                          {sur > 0 ? (
                            <span className="font-bold text-amber-700">
                              +${sur.toFixed(2)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-emerald-700">${d.pay.toFixed(2)}</td>
                        <td className="py-1 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              d.status === 'delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.status === 'delivered' ? 'DELIVERED' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dedicated Download Completed Shifts Summary Action Panel (Not printed) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print:hidden space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-teal-600" />
                  <span>Download Completed Shift Summary</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Export shift metrics, zone payroll breakdown, and delivery records
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                3 formats available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {/* CSV Option */}
              <button
                type="button"
                id="quick-download-csv-btn"
                onClick={() => handleDownload('csv')}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 text-left transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-800 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV File</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    .csv
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">
                  For Excel, Google Sheets, or accountant imports
                </span>
              </button>

              {/* PDF Option */}
              <button
                type="button"
                id="quick-download-pdf-btn"
                onClick={() => handleDownload('pdf')}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-rose-400 hover:bg-rose-50/40 text-left transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 group-hover:text-rose-800 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    <span>PDF Report</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                    .pdf
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Official printable settlement statement
                </span>
              </button>

              {/* Text File Option */}
              <button
                type="button"
                id="quick-download-txt-btn"
                onClick={() => handleDownload('txt')}
                className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 text-left transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 group-hover:text-blue-800 flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Text File</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                    .txt
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 leading-tight">
                  Plain text formatted ASCII receipt for logs
                </span>
              </button>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-[11px] text-slate-600">
            <div>
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span className="font-semibold block">Driver Signature & Date</span>
              <span className="text-slate-400 text-[10px]">{driver.name}</span>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 mb-1"></div>
              <span className="font-semibold block">Pharmacy Dispatcher Approval</span>
              <span className="text-slate-400 text-[10px]">Supervisor / Shift Lead</span>
            </div>
          </div>

          {/* Bottom Modal Actions (Not printed) */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 print:hidden">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Shift statement verified for {driver.name}</span>
            </div>
            <button
              type="button"
              id="bottom-close-receipt-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

