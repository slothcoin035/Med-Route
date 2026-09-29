import { LocationPoint, NavAppChoice } from '../types';
import { calculateDistanceMiles } from './zonePay';

const PREFERRED_NAV_KEY = 'medroute_preferred_nav_app';
const ROUND_TRIP_KEY = 'medroute_include_roundtrip';
const ROUND_TRIP_TARGET_KEY = 'medroute_roundtrip_target'; // 'hub' | 'driver_home'

/**
 * Returns driver's stored preferred navigation app, defaulting to Google Maps.
 */
export function getPreferredNavApp(): NavAppChoice {
  if (typeof window === 'undefined') return 'google';
  try {
    const saved = localStorage.getItem(PREFERRED_NAV_KEY);
    if (saved === 'google' || saved === 'apple' || saved === 'waze') {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'google';
}

/**
 * Saves driver's preferred navigation app.
 */
export function setPreferredNavApp(app: NavAppChoice): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERRED_NAV_KEY, app);
  } catch (err) {
    console.warn('Failed to save preferred navigation app:', err);
  }
}

/**
 * Formats direct GPS navigation deep links for Google Maps, Apple Maps, or Waze.
 */
export function getNavigationAppUrl(
  app: NavAppChoice,
  destination: LocationPoint,
  options?: {
    origin?: LocationPoint;
    address?: string;
  }
): string {
  const { lat, lng } = destination;

  switch (app) {
    case 'apple': {
      // Apple Maps deep link URL scheme
      const queryParam = options?.address ? `&q=${encodeURIComponent(options.address)}` : '';
      const saddrParam = options?.origin ? `&saddr=${options.origin.lat},${options.origin.lng}` : '';
      return `https://maps.apple.com/?daddr=${lat},${lng}${saddrParam}${queryParam}&dirflg=d`;
    }

    case 'waze': {
      // Waze deep link
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }

    case 'google':
    default: {
      // Google Maps universal turn-by-turn directions link
      const originParam = options?.origin ? `&origin=${options.origin.lat},${options.origin.lng}` : '';
      const destParam = `${lat},${lng}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        destParam
      )}${originParam}&travelmode=driving`;
    }
  }
}

/**
 * Opens navigation in a new window/app tab.
 */
export function openInNavigationApp(
  app: NavAppChoice,
  destination: LocationPoint,
  options?: {
    origin?: LocationPoint;
    address?: string;
  }
): void {
  const url = getNavigationAppUrl(app, destination, options);
  if (typeof window === 'undefined') return;

  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = url;
  }
}

/**
 * Mobile-safe phone dialer launcher
 */
export function openPhoneDialer(phone: string): void {
  if (typeof window === 'undefined') return;
  const url = getTelUrl(phone);
  try {
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = url;
  }
}

/**
 * Mobile-safe SMS messenger launcher with pre-filled message
 */
export function openSmsApp(phone: string, message: string): void {
  if (typeof window === 'undefined') return;
  const url = getSmsUrl(phone, message);
  try {
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = url;
  }
}

/**
 * Tactile haptic feedback for mobile touches and vehicle phone mounts
 */
export function triggerHapticFeedback(type: 'tap' | 'success' | 'warning' = 'tap'): void {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'success') {
        navigator.vibrate([40, 40, 80]);
      } else if (type === 'warning') {
        navigator.vibrate([80, 50, 80]);
      } else {
        navigator.vibrate(30);
      }
    } catch {
      // Haptics not allowed or unsupported
    }
  }
}

/**
 * Formats phone string for clickable tel: links
 */
export function cleanPhoneNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits || raw;
}

export function getTelUrl(phone: string): string {
  const clean = cleanPhoneNumber(phone);
  return `tel:${clean}`;
}

/**
 * Courier SMS message templates designed specifically for pharmacy deliveries
 */
export interface CourierSmsData {
  patientName: string;
  medicationName: string;
  address: string;
  eta?: string;
  driverName?: string;
}

export interface SmsTemplateOption {
  id: 'eta' | 'arrived' | 'gate' | 'signature' | 'custom';
  label: string;
  description: string;
  generateText: (data: CourierSmsData) => string;
}

export const COURIER_SMS_TEMPLATES: SmsTemplateOption[] = [
  {
    id: 'eta',
    label: 'En Route ETA',
    description: 'Notify patient you are on the way with ETA',
    generateText: (d) =>
      `Hello ${d.patientName}, this is your pharmacy delivery courier${
        d.driverName ? ` (${d.driverName})` : ''
      }. I am en route with your prescription (${d.medicationName})${
        d.eta ? ` and expect to arrive around ${d.eta}` : ''
      }.`,
  },
  {
    id: 'arrived',
    label: 'Arrived Outside',
    description: 'Alert patient that you are parked outside',
    generateText: (d) =>
      `Hello ${d.patientName}, your pharmacy delivery courier has arrived outside ${
        d.address
      } with your prescription. Please meet me or let me know if there are specific delivery instructions.`,
  },
  {
    id: 'gate',
    label: 'Gate / Access Code',
    description: 'Request building entry or community gate code',
    generateText: (d) =>
      `Hello ${d.patientName}, this is your pharmacy delivery courier outside. I need a gate or building access code to complete your prescription delivery. Thank you!`,
  },
  {
    id: 'signature',
    label: 'Signature Required',
    description: 'Remind recipient that an adult signature is needed',
    generateText: (d) =>
      `Hello ${d.patientName}, your pharmacy courier is arriving shortly with ${d.medicationName}. An adult signature is required upon delivery to release this medication.`,
  },
  {
    id: 'custom',
    label: 'Custom Message',
    description: 'Personalized message text',
    generateText: (d) =>
      `Hello ${d.patientName}, this is your pharmacy delivery courier regarding your prescription delivery to ${d.address}.`,
  },
];

/**
 * Cross-platform SMS URL generator (works on iOS, Android, and desktop)
 */
export function getSmsUrl(phone: string, message: string): string {
  const clean = cleanPhoneNumber(phone);
  // ?&body= works across both iOS Safari (which requires &body= or ;body= depending on iOS version)
  // and Android/standards (which use ?body=)
  return `sms:${clean}?&body=${encodeURIComponent(message)}`;
}

/**
 * Round trip preferences
 */
export function getSavedRoundTripPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ROUND_TRIP_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveRoundTripPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROUND_TRIP_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to save round-trip preference:', err);
  }
}

export function getSavedRoundTripTarget(): 'hub' | 'driver_home' {
  if (typeof window === 'undefined') return 'hub';
  try {
    const val = localStorage.getItem(ROUND_TRIP_TARGET_KEY);
    return val === 'driver_home' ? 'driver_home' : 'hub';
  } catch {
    return 'hub';
  }
}

export function saveRoundTripTarget(target: 'hub' | 'driver_home'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROUND_TRIP_TARGET_KEY, target);
  } catch (err) {
    console.warn('Failed to save round-trip target:', err);
  }
}

/**
 * Calculates estimated return leg distance and drive time
 */
export function calculateReturnLegMetrics(
  lastStopCoords: LocationPoint,
  returnTargetCoords: LocationPoint
): { distanceMiles: number; durationMinutes: number } {
  const distanceMiles = calculateDistanceMiles(lastStopCoords, returnTargetCoords);
  // Estimate driving time at ~28 mph average suburban/urban speed plus 3 min buffer
  const durationMinutes = Math.max(2, Math.round((distanceMiles / 28) * 60) + 2);
  return { distanceMiles, durationMinutes };
}

const VOICE_GUIDANCE_KEY = 'medroute_voice_guidance_enabled';

export function getVoiceGuidancePref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(VOICE_GUIDANCE_KEY);
    return val !== 'false'; // default to true
  } catch {
    return true;
  }
}

export function saveVoiceGuidancePref(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_GUIDANCE_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to save voice guidance preference:', err);
  }
}

/**
 * Synthesizes an audible sound chime using Web Audio API (no external asset downloads required)
 */
export function playInVehicleChime(type: 'arrival' | 'stat' | 'delivered' | 'action' = 'arrival'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'stat') {
      // Urgent double tone for emergency STAT delivery
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(880, now + 0.24); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'delivered') {
      // Positive ascending chime for delivery completed
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.24); // C6
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Pleasant two-tone chime for maneuver or arrival
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // AudioContext might be restricted by browser before user interaction
  }
}

/**
 * Text-to-speech voice announcer for eyes-on-the-road driver navigation
 */
export function speakDriverGuidance(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis unavailable:', err);
  }
}

/**
 * Launches the driver's preferred navigation app in 1 direct click
 */
export function launchPreferredNavApp(
  destination: LocationPoint,
  options?: {
    origin?: LocationPoint;
    address?: string;
  }
): NavAppChoice {
  const app = getPreferredNavApp();
  openInNavigationApp(app, destination, options);
  return app;
}

export function getNavAppName(app: NavAppChoice): string {
  switch (app) {
    case 'apple':
      return 'Apple Maps';
    case 'waze':
      return 'Waze';
    case 'google':
    default:
      return 'Google Maps';
  }
}

