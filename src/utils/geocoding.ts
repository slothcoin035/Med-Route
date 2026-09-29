import { LocationPoint } from '../types';
import { calculateDistanceMiles } from './zonePay';

export interface GeocodeResult {
  coordinates: LocationPoint;
  formattedAddress: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  confidence: 'rooftop' | 'high' | 'medium' | 'approximate';
  score: number;
  provider: 'arcgis' | 'photon' | 'nominatim' | 'fallback';
}

/**
 * Clean up common messy raw address strings (e.g. trailing commas, leading spaces, double spaces)
 */
export function cleanAddressQuery(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '') // remove leading/trailing commas, periods, spaces
    .replace(/\s*,\s*,+/g, ',') // collapse multiple commas
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Multi-provider high-accuracy geocoding function.
 * 1. Primary: ArcGIS World Geocoding Service (high precision rooftop & residential addresses in US)
 * 2. Secondary: Photon / Komoot (OpenStreetMap search)
 * 3. Tertiary: OpenStreetMap Nominatim
 */
export async function geocodeAddress(rawAddress: string): Promise<GeocodeResult | null> {
  const clean = cleanAddressQuery(rawAddress);
  if (!clean || clean.length < 3) return null;

  // 1. Try ArcGIS World Geocoder (most accurate for US street and residential addresses)
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(
      clean
    )}&maxLocations=1&outFields=Match_addr,City,Region,Postal,Addr_type`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        const top = data.candidates[0];
        const score = typeof top.score === 'number' ? top.score : 80;

        if (score >= 70 && top.location && typeof top.location.x === 'number') {
          const lat = Math.round(top.location.y * 100000) / 100000;
          const lng = Math.round(top.location.x * 100000) / 100000;
          const addrType = top.attributes?.Addr_type || '';
          const confidence =
            addrType === 'PointAddress' || addrType === 'SubAddress'
              ? 'rooftop'
              : score >= 90
              ? 'high'
              : 'medium';

          return {
            coordinates: { lat, lng },
            formattedAddress: top.address || top.attributes?.Match_addr || clean,
            city: top.attributes?.City || undefined,
            state: top.attributes?.Region || undefined,
            zip: top.attributes?.Postal || undefined,
            confidence,
            score,
            provider: 'arcgis',
          };
        }
      }
    }
  } catch (err) {
    console.warn('ArcGIS geocoding attempt note:', err);
  }

  // 2. Try Photon (OSM-based search)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=1`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const feat = data.features[0];
        const coords = feat.geometry?.coordinates;
        if (coords && coords.length >= 2) {
          const lng = Math.round(coords[0] * 100000) / 100000;
          const lat = Math.round(coords[1] * 100000) / 100000;
          const props = feat.properties || {};

          const street = [props.housenumber, props.street].filter(Boolean).join(' ');
          const formatted =
            street && props.city
              ? `${street}, ${props.city}, ${props.state || ''} ${props.postcode || ''}`.trim()
              : props.name || clean;

          return {
            coordinates: { lat, lng },
            formattedAddress: formatted,
            city: props.city || undefined,
            state: props.state || undefined,
            zip: props.postcode || undefined,
            confidence: props.housenumber ? 'high' : 'medium',
            score: 85,
            provider: 'photon',
          };
        }
      }
    }
  } catch (err) {
    console.warn('Photon geocoding attempt note:', err);
  }

  // 3. Try OpenStreetMap Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      clean
    )}&limit=1`;
    const res = await fetch(nomUrl, {
      headers: { 'Accept-Language': 'en' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = Math.round(parseFloat(data[0].lat) * 100000) / 100000;
        const lng = Math.round(parseFloat(data[0].lon) * 100000) / 100000;

        return {
          coordinates: { lat, lng },
          formattedAddress: data[0].display_name || clean,
          confidence: 'medium',
          score: 80,
          provider: 'nominatim',
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim geocoding attempt note:', err);
  }

  return null;
}

/**
 * Geocodes an address and computes road-factored distance from the starting hub.
 */
export async function geocodeAddressWithDistance(
  rawAddress: string,
  hubCoordinates: LocationPoint
): Promise<{
  result: GeocodeResult | null;
  distanceMiles: number;
  isExact: boolean;
}> {
  const result = await geocodeAddress(rawAddress);

  if (result) {
    const dist = calculateDistanceMiles(hubCoordinates, result.coordinates);
    return {
      result,
      distanceMiles: dist,
      isExact: true,
    };
  }

  return {
    result: null,
    distanceMiles: 8.0, // sensible default
    isExact: false,
  };
}

/**
 * Parses address string into street, city, state, and 5-digit postal code
 */
export function parseAddressComponents(raw: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  const clean = cleanAddressQuery(raw);
  const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);

  let street = parts[0] || '';
  let city = '';
  let state = '';
  let zip = '';

  // Look for 5-digit zip code in any part
  for (let i = parts.length - 1; i >= 0; i--) {
    const zipMatch = parts[i].match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch && !zip) {
      zip = zipMatch[1];
    }
  }

  if (parts.length >= 4) {
    street = parts[0];
    city = parts[1];
    state = parts[2];
    if (!zip) zip = parts[3].replace(/[^0-9]/g, '').slice(0, 5);
  } else if (parts.length === 3) {
    street = parts[0];
    city = parts[1];
    const lastPart = parts[2];
    const stateMatch = lastPart.replace(/\b\d{5}\b/, '').trim();
    state = stateMatch;
  } else if (parts.length === 2) {
    street = parts[0];
    city = parts[1];
  }

  // Normalize city casing
  if (city) {
    city = city
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return { street, city, state, zip };
}

/**
 * Reverse geocodes a latitude/longitude coordinate into a formatted street address
 */
export async function reverseGeocode(coordinates: LocationPoint): Promise<string | null> {
  const { lat, lng } = coordinates;
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return null;

  // 1. Try ArcGIS reverse geocoder
  try {
    const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lng},${lat}&f=json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.address && data.address.Match_addr) {
        return data.address.Match_addr;
      }
    }
  } catch (e) {
    console.warn('ArcGIS reverse geocode failed, falling back:', e);
  }

  // 2. Fallback to OpenStreetMap Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MedRoute-Courier-App/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {
    console.warn('Nominatim reverse geocode failed:', e);
  }

  return null;
}

