import { Delivery, DriverState, HubLocation, TripScheduleConfig } from '../types';
import { calculateDistanceMiles, evaluateStopPay } from '../utils/zonePay';

export const CENTRAL_HUB: HubLocation = {
  id: 'hub-houston-central',
  name: 'Houston Hub',
  address: '800 W Sam Houston Pkwy S, Houston, TX 77042',
  coordinates: { lat: 29.7295, lng: -95.5714 },
};

export const INITIAL_DRIVER: DriverState = {
  id: 'drv-804',
  name: 'Marcus Vance',
  phone: '(713) 555-0194',
  vehicle: 'Toyota Prius (Hybrid / Insulated Cooler Trunk)',
  licensePlate: 'TX-MED-492',
  address: '1042 Westheimer Rd, Houston, TX 77006',
  addressCoordinates: { lat: 29.7431, lng: -95.3922 },
  currentLocation: { lat: 29.7295, lng: -95.5714 }, // Starts at Houston Hub
  heading: 45,
  speedMph: 0,
  isSimulating: false,
  simSpeedMultiplier: 1,
  useDeviceGps: false,
  activeDeliveryId: null,
};

// Generate realistic deliveries across zones
interface RawDeliverySeed {
  id: string;
  rxNumber: string;
  patientName: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  medicationName: string;
  category: Delivery['category'];
  tempControlled: boolean;
  signatureRequired: boolean;
  specialInstructions?: string;
  scheduledTimeWindow: string;
  isStat: boolean;
}

const SEED_DELIVERIES: RawDeliverySeed[] = [
  {
    id: 'del-01',
    rxNumber: 'RX-98201',
    patientName: 'Eleanor Davis',
    phone: '(713) 555-3810',
    address: '9600 Westheimer Rd',
    city: 'Houston',
    zip: '77063',
    lat: 29.7392,
    lng: -95.5342,
    medicationName: 'Lantus SoloStar (Insulin Glargine)',
    category: 'Refrigerated',
    tempControlled: true,
    signatureRequired: true,
    specialInstructions: 'Ring doorbell, verify temperature indicator on sealed cold pouch.',
    scheduledTimeWindow: '10:00 AM - 12:00 PM',
    isStat: false,
  },
  {
    id: 'del-02',
    rxNumber: 'RX-44109',
    patientName: 'Robert Alvarez',
    phone: '(713) 555-8912',
    address: '5085 Westheimer Rd',
    city: 'Houston',
    zip: '77056',
    lat: 29.7398,
    lng: -95.4636,
    medicationName: 'Amoxicillin / Clavulanate 875mg',
    category: 'Standard',
    tempControlled: false,
    signatureRequired: true,
    specialInstructions: 'Leave with resident or front porch lockbox (Code: 4421).',
    scheduledTimeWindow: '10:30 AM - 12:30 PM',
    isStat: false,
  },
  {
    id: 'del-03',
    rxNumber: 'RX-88491-EMERGENCY',
    patientName: 'Claire Henderson (Pediatric)',
    phone: '(713) 555-9031',
    address: '6565 Fannin St',
    city: 'Houston',
    zip: '77030',
    lat: 29.7108,
    lng: -95.3995,
    medicationName: 'STAT EpiPen Jr 0.15mg Auto-Injector & Albuterol',
    category: 'STAT Urgent',
    tempControlled: false,
    signatureRequired: true,
    specialInstructions: 'EMERGENCY STAT: Urgent respiratory distress dispatch. Deliver immediately.',
    scheduledTimeWindow: 'ASAP / STAT Urgent',
    isStat: true, // STAT pay = $15
  },
  {
    id: 'del-04',
    rxNumber: 'RX-77312',
    patientName: 'Gerald Montgomery',
    phone: '(713) 555-4729',
    address: '245 W 19th St',
    city: 'Houston',
    zip: '77008',
    lat: 29.8028,
    lng: -95.4052,
    medicationName: 'Humira (Adalimumab 40mg/0.8ml)',
    category: 'Refrigerated',
    tempControlled: true,
    signatureRequired: true,
    specialInstructions: 'Gate code #9081. Patient waiting in lobby apt 402.',
    scheduledTimeWindow: '11:00 AM - 01:00 PM',
    isStat: false,
  },
  {
    id: 'del-05',
    rxNumber: 'RX-31950',
    patientName: 'Patricia Wu',
    phone: '(281) 555-7182',
    address: '23900 Katy Fwy',
    city: 'Katy',
    zip: '77494',
    lat: 29.7856,
    lng: -95.7654,
    medicationName: 'Eliquis (Apixaban) 5mg & Metformin',
    category: 'Standard',
    tempControlled: false,
    signatureRequired: false,
    specialInstructions: 'Hand deliver to patient or daughter Brenda.',
    scheduledTimeWindow: '11:30 AM - 01:30 PM',
    isStat: false,
  },
  {
    id: 'del-06',
    rxNumber: 'RX-62104',
    patientName: 'Dorothy Zimmerman',
    phone: '(281) 555-6430',
    address: '16655 Southwest Fwy',
    city: 'Sugar Land',
    zip: '77479',
    lat: 29.5886,
    lng: -95.6267,
    medicationName: 'Chemo Infusion Hydration Protocol Pack',
    category: 'Controlled',
    tempControlled: true,
    signatureRequired: true,
    specialInstructions: 'Home hospice patient. Must sign chain of custody form.',
    scheduledTimeWindow: '12:00 PM - 02:00 PM',
    isStat: false,
  },
  {
    id: 'del-07',
    rxNumber: 'RX-55914',
    patientName: 'Harold Jenkins',
    phone: '(936) 555-1290',
    address: '17200 St Lukes Way',
    city: 'The Woodlands',
    zip: '77384',
    lat: 30.1983,
    lng: -95.4526,
    medicationName: 'Wegovy & Continuous Glucose Monitor Sensors',
    category: 'Refrigerated',
    tempControlled: true,
    signatureRequired: false,
    specialInstructions: 'Cooler box on front porch.',
    scheduledTimeWindow: '01:00 PM - 03:00 PM',
    isStat: false,
  },
  {
    id: 'del-08',
    rxNumber: 'RX-10294',
    patientName: 'Eugene Campbell',
    phone: '(936) 555-8321',
    address: '110 Memorial Hospital Dr',
    city: 'Huntsville',
    zip: '77340',
    lat: 30.7092,
    lng: -95.5562,
    medicationName: 'Enbrel SureClick & Special Infusion Kit',
    category: 'Refrigerated',
    tempControlled: true,
    signatureRequired: true,
    specialInstructions: 'Zone 5 extended delivery. Clinical delivery window requested.',
    scheduledTimeWindow: '02:00 PM - 04:30 PM',
    isStat: false,
  },
];

export function getInitialDeliveries(scheduleConfig?: TripScheduleConfig): Delivery[] {
  return SEED_DELIVERIES.map((seed, index) => {
    const coords = { lat: seed.lat, lng: seed.lng };
    const distMiles = calculateDistanceMiles(CENTRAL_HUB.coordinates, coords);
    const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
      distMiles,
      seed.isStat,
      scheduleConfig,
      seed.scheduledTimeWindow
    );

    return {
      id: seed.id,
      rxNumber: seed.rxNumber,
      patientName: seed.patientName,
      phone: seed.phone,
      address: seed.address,
      city: seed.city,
      zip: seed.zip,
      coordinates: coords,
      distanceFromHubMiles: distMiles,
      isStat: seed.isStat,
      zone,
      basePay,
      surcharge,
      surchargeReason,
      pay,
      medicationName: seed.medicationName,
      category: seed.category,
      tempControlled: seed.tempControlled,
      signatureRequired: seed.signatureRequired,
      specialInstructions: seed.specialInstructions,
      status: 'pending',
      scheduledTimeWindow: seed.scheduledTimeWindow,
      sequence: index + 1,
    };
  });
}
