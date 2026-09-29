import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { DailyShiftRecord } from '../types';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  Award,
  BarChart2,
  CheckCircle2,
} from 'lucide-react';

interface DailyEarningsTrendChartProps {
  shifts: DailyShiftRecord[];
}

export const DailyEarningsTrendChart: React.FC<DailyEarningsTrendChartProps> = ({ shifts }) => {
  const [chartMode, setChartMode] = useState<'trend' | 'breakdown' | 'volume'>('trend');

  // Compute aggregate statistics across the 7 shifts
  const total7ShiftsPay = shifts.reduce((sum, s) => sum + s.totalPay, 0);
  const total7ShiftsStops = shifts.reduce((sum, s) => sum + s.stopsCount, 0);
  const averageDailyPay = shifts.length > 0 ? total7ShiftsPay / shifts.length : 0;
  const highestShift = shifts.reduce(
    (max, s) => (s.totalPay > max.totalPay ? s : max),
    shifts[0] || { totalPay: 0, dateLabel: '' }
  );

  const currentShift = shifts.find((s) => s.isCurrentShift) || shifts[shifts.length - 1];
  const diffFromAvg = currentShift
    ? ((currentShift.totalPay - averageDailyPay) / (averageDailyPay || 1)) * 100
    : 0;

  // Custom formatted tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: DailyShiftRecord = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs min-w-[190px]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-slate-200">{data.fullDate}</span>
            {data.isCurrentShift && (
              <span className="bg-teal-500/20 text-teal-300 font-bold text-[10px] px-1.5 py-0.5 rounded border border-teal-500/40">
                ACTIVE
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Gross Shift Pay:</span>
              <span className="font-extrabold text-emerald-400 font-mono text-sm">
                ${data.totalPay.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Base Zone Pay:</span>
              <span className="font-medium text-slate-200 font-mono">
                ${data.basePay.toFixed(2)}
              </span>
            </div>
            {data.surcharges > 0 && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-amber-400">Surcharges:</span>
                <span className="font-medium text-amber-300 font-mono">
                  +${data.surcharges.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800 text-slate-400">
              <span>Deliveries / Miles:</span>
              <span className="text-slate-200 font-medium">
                {data.stopsCount} stops • {data.totalMiles.toFixed(1)} mi
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>Avg Rate / Stop:</span>
              <span className="text-teal-300 font-semibold">
                ${data.stopsCount > 0 ? (data.totalPay / data.stopsCount).toFixed(2) : '0.00'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-3.5 print:border-slate-300 print:bg-white print:p-2 print:break-inside-avoid text-slate-900 dark:text-slate-100 transition-colors">
      {/* Chart Section Header with View Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wider">
              7-Day Daily Earnings Trend
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Daily settlement progression across the last 7 driver shifts
            </p>
          </div>
        </div>

        {/* View Toggle Tabs (Hidden in Print) */}
        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold print:hidden">
          <button
            type="button"
            id="chart-tab-trend"
            onClick={() => setChartMode('trend')}
            className={`px-2.5 py-1 rounded-md transition-all text-[11px] flex items-center gap-1 ${
              chartMode === 'trend'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span>Trend Curve</span>
          </button>
          <button
            type="button"
            id="chart-tab-breakdown"
            onClick={() => setChartMode('breakdown')}
            className={`px-2.5 py-1 rounded-md transition-all text-[11px] flex items-center gap-1 ${
              chartMode === 'breakdown'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Pay Breakdown</span>
          </button>
          <button
            type="button"
            id="chart-tab-volume"
            onClick={() => setChartMode('volume')}
            className={`px-2.5 py-1 rounded-md transition-all text-[11px] flex items-center gap-1 ${
              chartMode === 'volume'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Stops & Miles</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 shadow-xs">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold block">7-Shift Gross</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
            ${total7ShiftsPay.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{total7ShiftsStops} total stops</span>
        </div>

        <div className="bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 shadow-xs">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold block">Daily Average</span>
          <span className="text-base font-extrabold text-teal-700 dark:text-teal-400 font-mono">
            ${averageDailyPay.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">per shift</span>
        </div>

        <div className="bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 shadow-xs">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold block">Peak Shift</span>
          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
            ${highestShift.totalPay.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">{highestShift.dateLabel}</span>
        </div>

        <div className="bg-white dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 shadow-xs">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold block">Today vs Average</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-base font-extrabold font-mono ${
                diffFromAvg >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {diffFromAvg >= 0 ? `+${diffFromAvg.toFixed(1)}%` : `${diffFromAvg.toFixed(1)}%`}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
            {diffFromAvg >= 0 ? 'Above 7-day average' : 'Below 7-day average'}
          </span>
        </div>
      </div>

      {/* Visual Chart Canvas */}
      <div className="bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-750 p-3 pt-4">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'trend' ? (
              <AreaChart data={shifts} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={averageDailyPay}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `7-Day Avg ($${averageDailyPay.toFixed(0)})`,
                    position: 'insideTopRight',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalPay"
                  name="Gross Shift Pay"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#earningsGradient)"
                  dot={{ r: 4, fill: '#0d9488', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : chartMode === 'breakdown' ? (
              <BarChart data={shifts} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="basePay" name="Base Zone Pay" stackId="pay" fill="#0d9488" radius={[0, 0, 0, 0]} />
                <Bar dataKey="surcharges" name="Surcharges" stackId="pay" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={shifts} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `${val}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `${val}m`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="stopsCount" name="Stops Delivered" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="totalMiles" name="Total Mileage" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Chart Legend / Footnote */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span>
              <span>Total Pay</span>
            </span>
            {chartMode === 'breakdown' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span>Differentials (Evening/Weekend)</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
              <span>7-Shift Benchmark Average (${averageDailyPay.toFixed(2)})</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Shift #7 highlights active batch in real time
          </span>
        </div>
      </div>
    </div>
  );
};
