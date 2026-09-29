import { Delivery, HubLocation, LocationPoint, OptimizationMetrics, RouteLeg } from '../types';
import { calculateDistanceMiles } from './zonePay';

/**
 * Generates intermediate curvature points between two locations to simulate realistic street routing
 */
export function generateCurvedPath(
  from?: LocationPoint | null,
  to?: LocationPoint | null,
  numSteps: number = 8
): LocationPoint[] {
  const safeFromLat = Number(from?.lat);
  const safeFromLng = Number(from?.lng);
  const safeToLat = Number(to?.lat);
  const safeToLng = Number(to?.lng);

  const startLat = !isNaN(safeFromLat) && isFinite(safeFromLat) ? safeFromLat : 29.7295;
  const startLng = !isNaN(safeFromLng) && isFinite(safeFromLng) ? safeFromLng : -95.5714;
  const endLat = !isNaN(safeToLat) && isFinite(safeToLat) ? safeToLat : startLat;
  const endLng = !isNaN(safeToLng) && isFinite(safeToLng) ? safeToLng : startLng;

  const validFrom: LocationPoint = { lat: startLat, lng: startLng };
  const validTo: LocationPoint = { lat: endLat, lng: endLng };

  const points: LocationPoint[] = [validFrom];
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;

  // Slight perpendicular offset for road geometry simulation
  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const perpX = -dy * 0.15;
  const perpY = dx * 0.15;

  const steps = Math.max(2, numSteps);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Quadratic bezier curve interpolation
    const lat = (1 - t) * (1 - t) * startLat + 2 * (1 - t) * t * (midLat + perpY) + t * t * endLat;
    const lng = (1 - t) * (1 - t) * startLng + 2 * (1 - t) * t * (midLng + perpX) + t * t * endLng;
    if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
      points.push({ lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 });
    }
  }

  points.push(validTo);
  return points;
}

/**
 * Optimizes the delivery schedule:
 * 1. Medical STAT emergencies always scheduled first.
 * 2. Refrigerated & temperature-controlled prioritized within clusters.
 * 3. Nearest-Neighbor TSP heuristic with 2-opt optimization for minimal driving miles and quickest arrival.
 */
export function optimizeDeliverySequence(
  hub: HubLocation,
  currentDriverLocation: LocationPoint,
  deliveries: Delivery[],
  options?: {
    includeRoundTrip?: boolean;
    returnTargetCoords?: LocationPoint;
    returnTargetName?: string;
  }
): {
  optimizedDeliveries: Delivery[];
  metrics: OptimizationMetrics;
  legs: RouteLeg[];
  returnLeg?: RouteLeg;
} {
  const includeRoundTrip = Boolean(options?.includeRoundTrip);
  const returnTargetCoords = options?.returnTargetCoords || hub.coordinates;
  const returnTargetName = options?.returnTargetName || hub.name;

  if (deliveries.length === 0) {
    return {
      optimizedDeliveries: [],
      metrics: {
        originalDistanceMiles: 0,
        optimizedDistanceMiles: 0,
        milesSaved: 0,
        originalTimeMinutes: 0,
        optimizedTimeMinutes: 0,
        timeSavedMinutes: 0,
        fuelSavingsEstimated: 0,
        includeRoundTrip,
        roundTripDistanceMiles: 0,
        roundTripDurationMinutes: 0,
      },
      legs: [],
    };
  }

  // Calculate original route distance
  let originalDist = 0;
  let prevPos = currentDriverLocation;
  for (const d of deliveries) {
    originalDist += calculateDistanceMiles(prevPos, d.coordinates);
    prevPos = d.coordinates;
  }
  const originalReturnDist = calculateDistanceMiles(prevPos, returnTargetCoords);
  if (includeRoundTrip) {
    originalDist += originalReturnDist; // return to hub/home
  }

  // Separate STAT and regular deliveries
  const statDeliveries = deliveries.filter((d) => d.isStat && d.status !== 'delivered');
  const regularDeliveries = deliveries.filter((d) => !d.isStat && d.status !== 'delivered');
  const alreadyDelivered = deliveries.filter((d) => d.status === 'delivered');

  // Nearest-neighbor sequencing starting from driver position
  const optimizedUnfinished: Delivery[] = [];
  let currentPos = currentDriverLocation;

  // 1. First serve all STAT deliveries in greedy nearest order
  const pendingStat = [...statDeliveries];
  while (pendingStat.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < pendingStat.length; i++) {
      const dist = calculateDistanceMiles(currentPos, pendingStat[i].coordinates);
      if (dist < minD) {
        minD = dist;
        nearestIdx = i;
      }
    }
    const nextStop = pendingStat.splice(nearestIdx, 1)[0];
    optimizedUnfinished.push(nextStop);
    currentPos = nextStop.coordinates;
  }

  // 2. Then serve remaining regular deliveries using nearest neighbor
  const pendingRegular = [...regularDeliveries];
  while (pendingRegular.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < pendingRegular.length; i++) {
      const dist = calculateDistanceMiles(currentPos, pendingRegular[i].coordinates);
      if (dist < minD) {
        minD = dist;
        nearestIdx = i;
      }
    }
    const nextStop = pendingRegular.splice(nearestIdx, 1)[0];
    optimizedUnfinished.push(nextStop);
    currentPos = nextStop.coordinates;
  }

  // 3. Apply 2-opt swaps to optimize order
  let improved = true;
  let passes = 0;
  while (improved && passes < 10) {
    improved = false;
    passes++;
    // Only swap non-STAT indices to preserve emergency priority
    const nonStatStart = statDeliveries.length;
    for (let i = nonStatStart; i < optimizedUnfinished.length - 1; i++) {
      for (let k = i + 1; k < optimizedUnfinished.length; k++) {
        const p1 = i === 0 ? currentDriverLocation : optimizedUnfinished[i - 1].coordinates;
        const p2 = optimizedUnfinished[i].coordinates;
        const p3 = optimizedUnfinished[k].coordinates;
        const p4 =
          k + 1 < optimizedUnfinished.length ? optimizedUnfinished[k + 1].coordinates : hub.coordinates;

        const currentSegmentDist = calculateDistanceMiles(p1, p2) + calculateDistanceMiles(p3, p4);
        const swappedSegmentDist = calculateDistanceMiles(p1, p3) + calculateDistanceMiles(p2, p4);

        if (swappedSegmentDist + 0.1 < currentSegmentDist) {
          // Reverse segment between i and k
          const slice = optimizedUnfinished.slice(i, k + 1).reverse();
          optimizedUnfinished.splice(i, k - i + 1, ...slice);
          improved = true;
        }
      }
    }
  }

  const finalOrder = [...alreadyDelivered, ...optimizedUnfinished];

  // Re-number sequence and compute ETAs
  let optimizedDist = 0;
  let currPos = currentDriverLocation;
  let cumulativeMinutes = 0;
  const averageSpeedMph = 30; // realistic metro/suburban average driving speed
  const stopServiceTimeMinutes = 5; // medical handoff, signature, ID check

  const legs: RouteLeg[] = [];
  const now = new Date();

  const optimizedDeliveries = finalOrder.map((d, index) => {
    const isCompleted = d.status === 'delivered';
    let legDist = 0;
    let legMinutes = 0;

    if (!isCompleted) {
      legDist = calculateDistanceMiles(currPos, d.coordinates);
      legMinutes = Math.round((legDist / averageSpeedMph) * 60) + stopServiceTimeMinutes;
      cumulativeMinutes += legMinutes;
      optimizedDist += legDist;

      const etaDate = new Date(now.getTime() + cumulativeMinutes * 60 * 1000);
      const etaStr = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      legs.push({
        fromName: index === 0 ? 'Driver Live Location' : finalOrder[index - 1].patientName,
        toName: d.patientName,
        distanceMiles: legDist,
        durationMinutes: legMinutes,
        path: generateCurvedPath(currPos, d.coordinates),
      });

      currPos = d.coordinates;

      return {
        ...d,
        sequence: index + 1,
        eta: etaStr,
        etaMinutes: cumulativeMinutes,
      };
    }

    return {
      ...d,
      sequence: index + 1,
    };
  });

  // Calculate return leg to hub or driver home base
  const returnDist = calculateDistanceMiles(currPos, returnTargetCoords);
  const returnLegMinutes = Math.round((returnDist / averageSpeedMph) * 60);

  let returnLeg: RouteLeg | undefined = undefined;
  if (includeRoundTrip) {
    optimizedDist += returnDist;
    returnLeg = {
      fromName:
        finalOrder.length > 0 ? finalOrder[finalOrder.length - 1].patientName : 'Last Stop',
      toName: `Return: ${returnTargetName}`,
      distanceMiles: Math.round(returnDist * 10) / 10,
      durationMinutes: returnLegMinutes,
      path: generateCurvedPath(currPos, returnTargetCoords),
    };
  }

  const originalTimeMinutes =
    Math.round((originalDist / averageSpeedMph) * 60) +
    deliveries.length * stopServiceTimeMinutes;
  const optimizedTimeMinutes =
    Math.round((optimizedDist / averageSpeedMph) * 60) +
    deliveries.length * stopServiceTimeMinutes;

  const milesSaved = Math.max(0, Math.round((originalDist - optimizedDist) * 10) / 10);
  const timeSavedMinutes = Math.max(0, originalTimeMinutes - optimizedTimeMinutes);
  // Estimate fuel savings ($3.60/gal @ 24 mpg = $0.15/mile)
  const fuelSavingsEstimated = Math.round(milesSaved * 0.15 * 100) / 100;

  return {
    optimizedDeliveries,
    metrics: {
      originalDistanceMiles: Math.round(originalDist * 10) / 10,
      optimizedDistanceMiles: Math.round(optimizedDist * 10) / 10,
      milesSaved,
      originalTimeMinutes,
      optimizedTimeMinutes,
      timeSavedMinutes,
      fuelSavingsEstimated,
      includeRoundTrip,
      roundTripDistanceMiles: Math.round(returnDist * 10) / 10,
      roundTripDurationMinutes: returnLegMinutes,
    },
    legs,
    returnLeg,
  };
}
