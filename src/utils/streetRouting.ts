import { FullRouteData, LocationPoint, RouteLeg, RouteStep } from '../types';

// Simple in-memory route cache
const routeCache = new Map<string, FullRouteData>();

/**
 * Format a turn maneuver into clear, human-readable driving instructions
 */
function formatStepInstruction(
  type: string,
  modifier: string | undefined,
  streetName: string,
  isDestination: boolean,
  destName?: string
): string {
  const road = streetName && streetName.trim().length > 0 ? streetName.trim() : 'the road';
  const mod = modifier ? modifier.replace('_', ' ') : '';

  if (type === 'depart') {
    return mod ? `Head ${mod} on ${road}` : `Head out on ${road}`;
  }
  if (type === 'arrive') {
    if (destName) {
      return mod ? `Arrive at ${destName} on the ${mod}` : `Arrive at ${destName}`;
    }
    return mod ? `Arrive at destination on the ${mod}` : 'Arrive at destination';
  }
  if (type === 'turn') {
    if (mod === 'slight left') return `Keep slight left onto ${road}`;
    if (mod === 'slight right') return `Keep slight right onto ${road}`;
    if (mod === 'sharp left') return `Sharp left onto ${road}`;
    if (mod === 'sharp right') return `Sharp right onto ${road}`;
    if (mod === 'left') return `Turn left onto ${road}`;
    if (mod === 'right') return `Turn right onto ${road}`;
    if (mod === 'uturn') return `Make a legal U-turn onto ${road}`;
    return `Turn ${mod} onto ${road}`;
  }
  if (type === 'continue') {
    if (mod === 'uturn') return `Make a U-turn onto ${road}`;
    return `Continue straight on ${road}`;
  }
  if (type === 'new name') {
    return `Continue onto ${road}`;
  }
  if (type === 'fork') {
    return `Keep ${mod || 'right'} at the fork onto ${road}`;
  }
  if (type === 'merge') {
    return `Merge ${mod} onto ${road}`;
  }
  if (type === 'on ramp' || type === 'ramp') {
    return `Take the ramp ${mod ? 'on the ' + mod + ' ' : ''}onto ${road}`;
  }
  if (type === 'off ramp') {
    return `Take the exit ${mod ? 'on the ' + mod + ' ' : ''}onto ${road}`;
  }
  if (type === 'roundabout' || type === 'rotary') {
    return `At the roundabout, take the exit onto ${road}`;
  }
  if (type === 'end of road') {
    return `At the end of the road, turn ${mod || 'right'} onto ${road}`;
  }

  return mod ? `${type.charAt(0).toUpperCase() + type.slice(1)} ${mod} onto ${road}` : `Proceed onto ${road}`;
}

/**
 * Fallback curved route generator if OSRM is unreachable
 */
function createFallbackRoute(
  origin: LocationPoint,
  originName: string,
  stops: Array<{ id: string; name: string; address: string; coordinates: LocationPoint }>
): FullRouteData {
  const safeOrigin = {
    lat: Number(origin?.lat) || 29.7295,
    lng: Number(origin?.lng) || -95.5714,
  };

  const allWaypoints = [
    { name: originName, coords: safeOrigin, id: 'start' },
    ...stops.map((s) => ({
      name: `${s.name} (${s.address})`,
      coords: {
        lat: Number(s.coordinates?.lat) || safeOrigin.lat,
        lng: Number(s.coordinates?.lng) || safeOrigin.lng,
      },
      id: s.id,
    })),
  ];

  const fullGeometry: LocationPoint[] = [];
  const legs: RouteLeg[] = [];
  let totalDistanceMiles = 0;
  let totalDurationMinutes = 0;

  for (let i = 0; i < allWaypoints.length - 1; i++) {
    const from = allWaypoints[i];
    const to = allWaypoints[i + 1];

    // Compute approximate mileage
    const dLat = ((to.coords.lat - from.coords.lat) * Math.PI) / 180;
    const dLng = ((to.coords.lng - from.coords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((from.coords.lat * Math.PI) / 180) *
        Math.cos((to.coords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const directMiles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const legMiles = Math.round(directMiles * 1.25 * 10) / 10;
    const legMinutes = Math.round(legMiles * 2.1);

    totalDistanceMiles += legMiles;
    totalDurationMinutes += legMinutes;

    // Generate intermediate path
    const legPath: LocationPoint[] = [];
    const stepsCount = 12;
    for (let s = 0; s <= stepsCount; s++) {
      const t = s / stepsCount;
      const lat = from.coords.lat + (to.coords.lat - from.coords.lat) * t;
      const lng = from.coords.lng + (to.coords.lng - from.coords.lng) * t;
      if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
        const roundedPt = { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
        legPath.push(roundedPt);
        if (i === 0 || s > 0) {
          fullGeometry.push(roundedPt);
        }
      }
    }

    const steps: RouteStep[] = [
      {
        instruction: `Depart from ${from.name}`,
        distanceMiles: Math.round((legMiles * 0.2) * 10) / 10,
        durationSeconds: Math.round(legMinutes * 60 * 0.2),
        streetName: 'Main Road',
        maneuverType: 'depart',
      },
      {
        instruction: `Continue straight toward ${to.name}`,
        distanceMiles: Math.round((legMiles * 0.7) * 10) / 10,
        durationSeconds: Math.round(legMinutes * 60 * 0.7),
        streetName: 'Parkway / Avenue',
        maneuverType: 'continue',
      },
      {
        instruction: `Arrive at Stop: ${to.name}`,
        distanceMiles: 0.1,
        durationSeconds: 30,
        streetName: to.name,
        maneuverType: 'arrive',
      },
    ];

    legs.push({
      legIndex: i,
      fromName: from.name,
      toName: to.name,
      fromCoords: from.coords,
      toCoords: to.coords,
      distanceMiles: legMiles,
      durationMinutes: legMinutes,
      path: legPath,
      steps,
      targetDeliveryId: to.id !== 'start' ? to.id : undefined,
    });
  }

  return {
    geometry: fullGeometry,
    distanceMiles: Math.round(totalDistanceMiles * 10) / 10,
    durationMinutes: totalDurationMinutes,
    legs,
  };
}

/**
 * Fetch real street route geometry and turn-by-turn navigation directions from OSRM
 */
export async function fetchStreetRoute(
  origin: LocationPoint,
  originName: string,
  stops: Array<{ id: string; name: string; address: string; coordinates: LocationPoint }>
): Promise<FullRouteData> {
  if (!origin || stops.length === 0) {
    return {
      geometry: origin ? [origin] : [],
      distanceMiles: 0,
      durationMinutes: 0,
      legs: [],
    };
  }

  // Build cache key
  const cacheKey = [
    `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`,
    ...stops.map((s) => `${s.coordinates.lat.toFixed(4)},${s.coordinates.lng.toFixed(4)}`),
  ].join('|');

  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Build coordinate string for OSRM: lng,lat;lng,lat...
    const coordsQuery = [
      `${origin.lng},${origin.lat}`,
      ...stops.map((s) => `${s.coordinates.lng},${s.coordinates.lat}`),
    ].join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM routing failed: status ${res.status}`);
    }

    const data = await res.json();
    if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no routes');
    }

    const route = data.routes[0];

    // 1. Parse high-resolution street geometry: [lng, lat] -> { lat, lng }
    const fullGeometry: LocationPoint[] = (route.geometry?.coordinates || [])
      .map((coord: [number, number]) => ({
        lat: Number(coord[1]),
        lng: Number(coord[0]),
      }))
      .filter(
        (pt: LocationPoint) =>
          !isNaN(pt.lat) && !isNaN(pt.lng) && isFinite(pt.lat) && isFinite(pt.lng)
      );

    // 2. Parse legs and turn-by-turn steps
    const legs: RouteLeg[] = [];
    const allWaypoints = [
      { name: originName, coords: origin, id: 'start' },
      ...stops.map((s) => ({ name: `${s.name} (${s.address})`, coords: s.coordinates, id: s.id })),
    ];

    if (route.legs && Array.isArray(route.legs)) {
      route.legs.forEach((legData: any, idx: number) => {
        const fromWp = allWaypoints[idx] || { name: `Stop #${idx}`, coords: origin, id: 'start' };
        const toWp = allWaypoints[idx + 1] || { name: `Stop #${idx + 1}`, coords: origin, id: 'end' };

        const legMiles = Math.round((legData.distance / 1609.34) * 10) / 10;
        const legMinutes = Math.round(legData.duration / 60);

        // Parse turn-by-turn steps for this leg
        const steps: RouteStep[] = (legData.steps || []).map((s: any, stepIdx: number) => {
          const maneuver = s.maneuver || {};
          const isLastStep = stepIdx === (legData.steps.length - 1);
          const instruction = formatStepInstruction(
            maneuver.type,
            maneuver.modifier,
            s.name,
            isLastStep,
            toWp.name
          );

          const stepDistanceMiles = Math.round((s.distance / 1609.34) * 100) / 100;

          return {
            instruction,
            distanceMiles: stepDistanceMiles,
            durationSeconds: Math.round(s.duration || 0),
            streetName: s.name || '',
            maneuverType: maneuver.type || 'turn',
            maneuverModifier: maneuver.modifier || '',
            location: maneuver.location
              ? { lat: maneuver.location[1], lng: maneuver.location[0] }
              : undefined,
          };
        });

        legs.push({
          legIndex: idx,
          fromName: fromWp.name,
          toName: toWp.name,
          fromCoords: fromWp.coords,
          toCoords: toWp.coords,
          distanceMiles: legMiles,
          durationMinutes: Math.max(1, legMinutes),
          path: [], // can be derived from geometry
          steps,
          targetDeliveryId: toWp.id !== 'start' ? toWp.id : undefined,
        });
      });
    }

    const totalDistanceMiles = Math.round((route.distance / 1609.34) * 10) / 10;
    const totalDurationMinutes = Math.round(route.duration / 60);

    const result: FullRouteData = {
      geometry: fullGeometry,
      distanceMiles: totalDistanceMiles,
      durationMinutes: totalDurationMinutes,
      legs,
    };

    // Store in cache
    routeCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('OSRM street routing unavailable, using roadway fallback:', err);
    return createFallbackRoute(origin, originName, stops);
  }
}

/**
 * Generate a direct Google Maps Navigation URL for the driver's device
 */
export function generateGoogleMapsNavigationUrl(
  origin: LocationPoint,
  destination: LocationPoint,
  intermediateWaypoints?: LocationPoint[]
): string {
  const originStr = `${origin.lat},${origin.lng}`;
  const destStr = `${destination.lat},${destination.lng}`;

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originStr
  )}&destination=${encodeURIComponent(destStr)}&travelmode=driving`;

  if (intermediateWaypoints && intermediateWaypoints.length > 0) {
    const waypointsStr = intermediateWaypoints
      .map((wp) => `${wp.lat},${wp.lng}`)
      .join('|');
    url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
  }

  return url;
}
