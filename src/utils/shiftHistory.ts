import { DailyShiftRecord } from '../types';

/**
 * Returns the last 7 shifts of earnings history for the driver.
 * Days -6 through -1 represent past completed daily shifts.
 * Day 0 represents the current active shift with live data.
 */
export function generateLast7ShiftsHistory(params: {
  currentTotalPay: number;
  currentCompletedPay: number;
  currentBasePay: number;
  currentSurcharges: number;
  currentStopsCount: number;
  currentMiles: number;
}): DailyShiftRecord[] {
  const {
    currentTotalPay,
    currentCompletedPay,
    currentBasePay,
    currentSurcharges,
    currentStopsCount,
    currentMiles,
  } = params;

  // Realistic baseline profiles for the previous 6 shifts
  const pastShiftsTemplate = [
    { dayOffset: 6, stops: 7, miles: 53.4, base: 74, surcharges: 4, total: 78 },
    { dayOffset: 5, stops: 9, miles: 69.2, base: 96, surcharges: 6, total: 102 },
    { dayOffset: 4, stops: 8, miles: 58.7, base: 84, surcharges: 5, total: 89 },
    { dayOffset: 3, stops: 11, miles: 84.1, base: 122, surcharges: 11, total: 133 },
    { dayOffset: 2, stops: 6, miles: 46.5, base: 66, surcharges: 12, total: 78 },
    { dayOffset: 1, stops: 8, miles: 62.0, base: 88, surcharges: 14, total: 102 },
  ];

  const now = new Date();

  const history: DailyShiftRecord[] = pastShiftsTemplate
    .slice()
    .reverse()
    .map((item, index) => {
      const shiftDate = new Date(now);
      shiftDate.setDate(shiftDate.getDate() - item.dayOffset);

      const dayName = shiftDate.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = shiftDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      const fullDate = shiftDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });

      return {
        id: `shift-hist-${index}-${shiftDate.toISOString().slice(0, 10)}`,
        dateLabel: `${dayName} ${monthDay}`,
        fullDate,
        dayName,
        totalPay: item.total,
        basePay: item.base,
        surcharges: item.surcharges,
        completedPay: item.total,
        stopsCount: item.stops,
        totalMiles: item.miles,
        isCurrentShift: false,
      };
    });

  // Current active shift (Day 0)
  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'short' });
  const currentMonthDay = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  const currentFullDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  history.push({
    id: `shift-current-${now.toISOString().slice(0, 10)}`,
    dateLabel: `Today (${currentDayName})`,
    fullDate: `${currentFullDate} (Current Shift)`,
    dayName: 'Today',
    totalPay: Math.round(currentTotalPay * 100) / 100,
    basePay: Math.round(currentBasePay * 100) / 100,
    surcharges: Math.round(currentSurcharges * 100) / 100,
    completedPay: Math.round(currentCompletedPay * 100) / 100,
    stopsCount: currentStopsCount,
    totalMiles: Math.round(currentMiles * 10) / 10,
    isCurrentShift: true,
  });

  return history;
}
