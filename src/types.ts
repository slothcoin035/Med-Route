export type ZoneId = 'Zone 1' | 'Zone 2' | 'Zone 3' | 'Zone 4' | 'Zone 5' | 'STAT';

export interface ZoneRule {
  id: ZoneId;
  name: string;
  minMiles: number;
  maxMiles: number | null; // null for 61+ or STAT
  pay: number;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
}

export interface ZoneRateSetting {
  pay: number;
  minMiles: number;
  maxMiles: number | null;
}

export interface SurchargeRateSetting {
  enabled: boolean;
  rate: number;
  cutoffTime: string; // e.g. "18:00" or "16:00" (HH:MM 24hr format)
  label: string;
}

export interface RatesConfig {
  zones: {
    'Zone 1': ZoneRateSetting;
    'Zone 2': ZoneRateSetting;
    'Zone 3': ZoneRateSetting;
    'Zone 4': ZoneRateSetting;
    'Zone 5': ZoneRateSetting;
    STAT: {
      pay: number;
    };
  };
  afterHourSurcharge: SurchargeRateSetting;
  weekendSurcharge: SurchargeRateSetting;
}

export type MedicationCategory = 'Refrigerated' | 'Controlled' | 'Standard' | 'STAT Urgent' | 'Pediatric';

export type DeliveryStatus = 'pending' | 'in_transit' | 'arrived' | 'delivered' | 'failed';

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface Delivery {
  id: string;
  rxNumber: string;
  patientName: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  coordinates: LocationPoint;
  distanceFromHubMiles: number;
  isStat: boolean;
  zone: ZoneId;
  basePay: number;
  surcharge: number;
  surchargeReason?: string;
  pay: number;
  medicationName: string;
  category: MedicationCategory;
  tempControlled: boolean;
  signatureRequired: boolean;
  specialInstructions?: string;
  status: DeliveryStatus;
  scheduledTimeWindow: string;
  eta?: string;
  etaMinutes?: number;
  deliveredAt?: string;
  recipientSignature?: string;
  sequence: number;
}

export interface HubLocation {
  id: string;
  name: string;
  address: string;
  coordinates: LocationPoint;
}

export interface DriverState {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  licensePlate: string;
  address?: string; // Driver / user home address or base location
  addressCoordinates?: LocationPoint; // Geocoded coordinates of driver home/base
  avatarUrl?: string;
  currentLocation: LocationPoint;
  heading: number; // in degrees
  speedMph: number;
  isSimulating: boolean;
  simSpeedMultiplier: number;
  useDeviceGps: boolean;
  activeDeliveryId: string | null;
}

export interface RouteStep {
  instruction: string;
  distanceMiles: number;
  durationSeconds: number;
  streetName: string;
  maneuverType: string;
  maneuverModifier?: string;
  location?: LocationPoint;
}

export interface ScannedAddressResult {
  address: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  patientName?: string;
  rxNumber?: string;
  medicationName?: string;
  isStat?: boolean;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low' | string;
  rawExtractedText?: string;
  miles?: number;
  coordinates?: LocationPoint;
}

export interface RouteLeg {
  legIndex?: number;
  fromName: string;
  toName: string;
  fromCoords?: LocationPoint;
  toCoords?: LocationPoint;
  distanceMiles: number;
  durationMinutes: number;
  path: LocationPoint[];
  steps?: RouteStep[];
  targetDeliveryId?: string;
}

export interface FullRouteData {
  geometry: LocationPoint[];
  distanceMiles: number;
  durationMinutes: number;
  legs: RouteLeg[];
  isLoading?: boolean;
}

export interface OptimizationMetrics {
  originalDistanceMiles: number;
  optimizedDistanceMiles: number;
  milesSaved: number;
  originalTimeMinutes: number;
  optimizedTimeMinutes: number;
  timeSavedMinutes: number;
  fuelSavingsEstimated: number;
  includeRoundTrip?: boolean;
  roundTripDistanceMiles?: number;
  roundTripDurationMinutes?: number;
}

export type NavAppChoice = 'google' | 'apple' | 'waze';

export interface ReturnLegInfo {
  enabled: boolean;
  destinationType: 'hub' | 'driver_home';
  destinationName: string;
  destinationAddress: string;
  coordinates: LocationPoint;
  distanceMiles: number;
  durationMinutes: number;
}

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface TripScheduleConfig {
  dayOfWeek: DayOfWeek;
  timeMode: 'auto_eta' | 'custom_time';
  customTime: string; // e.g. "18:30" (6:30 PM)
}

export interface ZoneBreakdownSummary {
  zone: ZoneId;
  name: string;
  rangeLabel: string;
  rate: number;
  count: number;
  subtotal: number;
}

export interface PayAccumulationResult {
  breakdown: ZoneBreakdownSummary[];
  basePayTotal: number;
  surchargesTotal: number;
  eveningSurchargeCount: number;
  eveningSurchargeTotal: number;
  weekendSurchargeCount: number;
  weekendSurchargeTotal: number;
  totalPay: number;
  completedPay: number;
  totalMiles: number;
  totalDeliveries: number;
  completedDeliveries: number;
}

export interface DailyShiftRecord {
  id: string;
  dateLabel: string;
  fullDate: string;
  dayName: string;
  totalPay: number;
  basePay: number;
  surcharges: number;
  completedPay: number;
  stopsCount: number;
  totalMiles: number;
  isCurrentShift?: boolean;
}

export type ThemeMode = 'day' | 'night';

