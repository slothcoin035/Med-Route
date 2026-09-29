import {
  ZoneId,
  ZoneRule,
  LocationPoint,
  Delivery,
  ZoneBreakdownSummary,
  DayOfWeek,
  TripScheduleConfig,
  PayAccumulationResult,
  RatesConfig,
} from '../types';

export const DEFAULT_RATES_CONFIG: RatesConfig = {
  zones: {
    'Zone 1': { pay: 7, minMiles: 0, maxMiles: 15 },
    'Zone 2': { pay: 8, minMiles: 16, maxMiles: 30 },
    'Zone 3': { pay: 9, minMiles: 31, maxMiles: 40 },
    'Zone 4': { pay: 11, minMiles: 41, maxMiles: 60 },
    'Zone 5': { pay: 15, minMiles: 61, maxMiles: null },
    STAT: { pay: 15 },
  },
  afterHourSurcharge: {
    enabled: true,
    rate: 1.0,
    cutoffTime: '18:00', // 6:00 PM
    label: 'Evening / After-Hours',
  },
  weekendSurcharge: {
    enabled: true,
    rate: 2.0,
    cutoffTime: '16:00', // 4:00 PM
    label: 'Weekend Differential',
  },
};

export const RATES_STORAGE_KEY = 'medroute_custom_rates_config';

export function loadSavedRatesConfig(): RatesConfig {
  try {
    const raw = localStorage.getItem(RATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.zones && parsed.afterHourSurcharge && parsed.weekendSurcharge) {
        return {
          ...DEFAULT_RATES_CONFIG,
          ...parsed,
          zones: {
            ...DEFAULT_RATES_CONFIG.zones,
            ...parsed.zones,
          },
          afterHourSurcharge: {
            ...DEFAULT_RATES_CONFIG.afterHourSurcharge,
            ...parsed.afterHourSurcharge,
          },
          weekendSurcharge: {
            ...DEFAULT_RATES_CONFIG.weekendSurcharge,
            ...parsed.weekendSurcharge,
          },
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load rates from localStorage:', e);
  }
  return DEFAULT_RATES_CONFIG;
}

export function saveSavedRatesConfig(config: RatesConfig): void {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save rates to localStorage:', e);
  }
}

export function resetSavedRatesConfig(): RatesConfig {
  try {
    localStorage.removeItem(RATES_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to reset rates in localStorage:', e);
  }
  return DEFAULT_RATES_CONFIG;
}

export function getZoneRules(ratesConfig?: RatesConfig): ZoneRule[] {
  const cfg = ratesConfig || loadSavedRatesConfig();
  const z = cfg.zones;

  return [
    {
      id: 'Zone 1',
      name: 'Zone 1',
      minMiles: z['Zone 1'].minMiles,
      maxMiles: z['Zone 1'].maxMiles,
      pay: z['Zone 1'].pay,
      color: '#10b981', // emerald
      borderColor: '#059669',
      bgColor: '#ecfdf5',
      description: `${z['Zone 1'].minMiles} - ${z['Zone 1'].maxMiles} mi`,
    },
    {
      id: 'Zone 2',
      name: 'Zone 2',
      minMiles: z['Zone 2'].minMiles,
      maxMiles: z['Zone 2'].maxMiles,
      pay: z['Zone 2'].pay,
      color: '#3b82f6', // blue
      borderColor: '#2563eb',
      bgColor: '#eff6ff',
      description: `${z['Zone 2'].minMiles} - ${z['Zone 2'].maxMiles} mi`,
    },
    {
      id: 'Zone 3',
      name: 'Zone 3',
      minMiles: z['Zone 3'].minMiles,
      maxMiles: z['Zone 3'].maxMiles,
      pay: z['Zone 3'].pay,
      color: '#8b5cf6', // purple
      borderColor: '#7c3aed',
      bgColor: '#f5f3ff',
      description: `${z['Zone 3'].minMiles} - ${z['Zone 3'].maxMiles} mi`,
    },
    {
      id: 'Zone 4',
      name: 'Zone 4',
      minMiles: z['Zone 4'].minMiles,
      maxMiles: z['Zone 4'].maxMiles,
      pay: z['Zone 4'].pay,
      color: '#f59e0b', // amber
      borderColor: '#d97706',
      bgColor: '#fffbeb',
      description: `${z['Zone 4'].minMiles} - ${z['Zone 4'].maxMiles} mi`,
    },
    {
      id: 'Zone 5',
      name: 'Zone 5',
      minMiles: z['Zone 5'].minMiles,
      maxMiles: z['Zone 5'].maxMiles,
      pay: z['Zone 5'].pay,
      color: '#ef4444', // red
      borderColor: '#dc2626',
      bgColor: '#fef2f2',
      description: `${z['Zone 5'].minMiles}+ mi`,
    },
    {
      id: 'STAT',
      name: 'STAT Emergency',
      minMiles: 0,
      maxMiles: null,
      pay: z.STAT.pay,
      color: '#e11d48', // rose
      borderColor: '#be123c',
      bgColor: '#fff1f2',
      description: 'Distance N/A (Urgent Rx)',
    },
  ];
}

export const ZONE_RULES: ZoneRule[] = getZoneRules(DEFAULT_RATES_CONFIG);

/**
 * Calculates great-circle Haversine distance in miles between two coordinates,
 * with standard 1.25x road-routing factor for realistic street distance.
 */
export function calculateDistanceMiles(
  from?: LocationPoint | null,
  to?: LocationPoint | null,
  includeRoadRoutingFactor: boolean = true
): number {
  if (!from || !to) return 5.0;
  const fromLat = Number(from.lat);
  const fromLng = Number(from.lng);
  const toLat = Number(to.lat);
  const toLng = Number(to.lng);

  if (
    isNaN(fromLat) ||
    isNaN(fromLng) ||
    isNaN(toLat) ||
    isNaN(toLng) ||
    !isFinite(fromLat) ||
    !isFinite(fromLng) ||
    !isFinite(toLat) ||
    !isFinite(toLng)
  ) {
    return 5.0;
  }

  const R = 3958.8; // Radius of the Earth in miles
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const directDistance = R * c;

  const total = includeRoadRoutingFactor ? directDistance * 1.22 : directDistance;
  return Math.round(total * 10) / 10;
}

/**
 * Helper to get current day of week
 */
export function getCurrentDayOfWeek(): DayOfWeek {
  const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

/**
 * Parses time string (e.g. "06:15 PM", "18:30", "4:00 PM") into minutes from midnight (0 - 1439).
 */
export function parseMinutesFromTimeString(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split('-');
  const primary = parts[0].trim();

  const isPM = /pm/i.test(primary);
  const isAM = /am/i.test(primary);
  const match = primary.match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function formatMinutesTo12Hour(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${period}`;
}

export interface SurchargeCalculation {
  surcharge: number;
  reason?: string;
  type: 'NONE' | 'EVENING' | 'WEEKEND_EVENING';
}

/**
 * Calculates time-based stop surcharges:
 * - Configurable after-hour differential (default +$1.00 after 6:00 PM)
 * - Configurable weekend differential (default +$2.00 on Sat/Sun after 4:00 PM)
 */
export function calculateSurchargeForTime(
  dayOfWeek: DayOfWeek,
  minutesFromMidnight: number,
  ratesConfig?: RatesConfig
): SurchargeCalculation {
  const cfg = ratesConfig || loadSavedRatesConfig();
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

  const weekendCutoff = parseMinutesFromTimeString(cfg.weekendSurcharge.cutoffTime) ?? 960; // 4:00 PM default
  const afterHourCutoff = parseMinutesFromTimeString(cfg.afterHourSurcharge.cutoffTime) ?? 1080; // 6:00 PM default

  // Weekend surcharge rule
  if (isWeekend && cfg.weekendSurcharge.enabled && minutesFromMidnight >= weekendCutoff) {
    const formattedCutoff = formatMinutesTo12Hour(weekendCutoff);
    return {
      surcharge: cfg.weekendSurcharge.rate,
      reason: `Weekend After ${formattedCutoff} (+$${cfg.weekendSurcharge.rate.toFixed(2)})`,
      type: 'WEEKEND_EVENING',
    };
  }

  // Evening / After-hour surcharge rule
  if (cfg.afterHourSurcharge.enabled && minutesFromMidnight >= afterHourCutoff) {
    const formattedCutoff = formatMinutesTo12Hour(afterHourCutoff);
    return {
      surcharge: cfg.afterHourSurcharge.rate,
      reason: `Evening After ${formattedCutoff} (+$${cfg.afterHourSurcharge.rate.toFixed(2)})`,
      type: 'EVENING',
    };
  }

  return {
    surcharge: 0,
    reason: undefined,
    type: 'NONE',
  };
}

/**
 * Determines zone classification and base driver compensation using dynamic RatesConfig:
 * Zone 1, Zone 2, Zone 3, Zone 4, Zone 5, and STAT
 */
export function determineZoneAndPay(
  distanceMiles: number,
  isStat: boolean,
  ratesConfig?: RatesConfig
): { zone: ZoneId; pay: number; rule: ZoneRule } {
  const safeMiles = typeof distanceMiles === 'number' && !isNaN(distanceMiles) && isFinite(distanceMiles)
    ? Math.max(0, distanceMiles)
    : 5.0;

  const rules = getZoneRules(ratesConfig);
  if (isStat) {
    const statRule = rules.find((r) => r.id === 'STAT')!;
    return { zone: 'STAT', pay: statRule.pay, rule: statRule };
  }

  const z1 = rules.find((r) => r.id === 'Zone 1')!;
  const z2 = rules.find((r) => r.id === 'Zone 2')!;
  const z3 = rules.find((r) => r.id === 'Zone 3')!;
  const z4 = rules.find((r) => r.id === 'Zone 4')!;
  const z5 = rules.find((r) => r.id === 'Zone 5')!;

  let matchedRule: ZoneRule;

  if (safeMiles <= (z1.maxMiles ?? 15)) {
    matchedRule = z1;
  } else if (safeMiles <= (z2.maxMiles ?? 30)) {
    matchedRule = z2;
  } else if (safeMiles <= (z3.maxMiles ?? 40)) {
    matchedRule = z3;
  } else if (safeMiles <= (z4.maxMiles ?? 60)) {
    matchedRule = z4;
  } else {
    matchedRule = z5;
  }

  return {
    zone: matchedRule.id,
    pay: matchedRule.pay,
    rule: matchedRule,
  };
}

/**
 * Complete stop pay evaluator including distance base pay + time differential surcharges:
 * Evaluates with configured zone rates and surcharges
 */
export function evaluateStopPay(
  distanceMiles: number,
  isStat: boolean,
  scheduleConfig?: TripScheduleConfig,
  stopEtaOrTime?: string,
  ratesConfig?: RatesConfig
): {
  zone: ZoneId;
  basePay: number;
  surcharge: number;
  surchargeReason?: string;
  pay: number;
  rule: ZoneRule;
} {
  const { zone, pay: basePay, rule } = determineZoneAndPay(distanceMiles, isStat, ratesConfig);

  const dayOfWeek = scheduleConfig?.dayOfWeek || getCurrentDayOfWeek();
  let minutesFromMidnight: number | null = null;

  if (scheduleConfig?.timeMode === 'custom_time') {
    minutesFromMidnight = parseMinutesFromTimeString(scheduleConfig.customTime);
  } else if (stopEtaOrTime) {
    minutesFromMidnight = parseMinutesFromTimeString(stopEtaOrTime);
  }

  // If time is not specified, evaluate using current clock time
  if (minutesFromMidnight === null) {
    const now = new Date();
    minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
  }

  const { surcharge, reason } = calculateSurchargeForTime(dayOfWeek, minutesFromMidnight, ratesConfig);

  return {
    zone,
    basePay,
    surcharge,
    surchargeReason: reason,
    pay: basePay + surcharge,
    rule,
  };
}

/**
 * Calculates accumulated driver pay breakdown across all zones with itemized surcharges
 */
export function calculateZoneAccumulation(
  deliveries: Delivery[],
  ratesConfig?: RatesConfig
): PayAccumulationResult {
  const rules = getZoneRules(ratesConfig);
  const cfg = ratesConfig || loadSavedRatesConfig();

  const counts: Record<ZoneId, number> = {
    'Zone 1': 0,
    'Zone 2': 0,
    'Zone 3': 0,
    'Zone 4': 0,
    'Zone 5': 0,
    STAT: 0,
  };

  let totalPay = 0;
  let completedPay = 0;
  let basePayTotal = 0;
  let surchargesTotal = 0;
  let eveningSurchargeCount = 0;
  let eveningSurchargeTotal = 0;
  let weekendSurchargeCount = 0;
  let weekendSurchargeTotal = 0;
  let totalMiles = 0;
  let completedDeliveries = 0;

  for (const d of deliveries) {
    counts[d.zone] = (counts[d.zone] || 0) + 1;

    const base = d.basePay !== undefined ? d.basePay : d.pay;
    const sur = d.surcharge || 0;
    const total = d.pay;

    basePayTotal += base;
    surchargesTotal += sur;
    totalPay += total;
    totalMiles += d.distanceFromHubMiles;

    if (d.surchargeReason?.includes('Weekend')) {
      weekendSurchargeCount++;
      weekendSurchargeTotal += sur;
    } else if (d.surchargeReason?.includes('Evening') || d.surchargeReason?.includes('After')) {
      eveningSurchargeCount++;
      eveningSurchargeTotal += sur;
    } else if (sur > 0) {
      if (sur === cfg.weekendSurcharge.rate) {
        weekendSurchargeCount++;
        weekendSurchargeTotal += sur;
      } else {
        eveningSurchargeCount++;
        eveningSurchargeTotal += sur;
      }
    }

    if (d.status === 'delivered') {
      completedDeliveries++;
      completedPay += total;
    }
  }

  const breakdown: ZoneBreakdownSummary[] = rules.map((rule) => {
    const count = counts[rule.id] || 0;
    return {
      zone: rule.id,
      name: rule.name,
      rangeLabel: rule.description,
      rate: rule.pay,
      count,
      subtotal: count * rule.pay,
    };
  });

  return {
    breakdown,
    basePayTotal,
    surchargesTotal,
    eveningSurchargeCount,
    eveningSurchargeTotal,
    weekendSurchargeCount,
    weekendSurchargeTotal,
    totalPay,
    completedPay,
    totalMiles: Math.round(totalMiles * 10) / 10,
    totalDeliveries: deliveries.length,
    completedDeliveries,
  };
}
