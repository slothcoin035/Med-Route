// Pre-rendered sample medical prescription and delivery labels for one-click testing
export interface SampleLabel {
  id: string;
  title: string;
  badge: string;
  address: string;
  city: string;
  zip: string;
  patientName: string;
  rxNumber: string;
  medicationName: string;
  isStat: boolean;
  notes: string;
  dataUrl: string;
}

// Function to generate realistic SVG data URI for a medical delivery label
function createLabelSvgDataUrl(opts: {
  pharmacy: string;
  rxNumber: string;
  patientName: string;
  address: string;
  medication: string;
  isStat: boolean;
  notes: string;
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Label Container -->
  <rect x="10" y="10" width="620" height="400" rx="14" fill="url(#bg)" stroke="#cbd5e1" stroke-width="2"/>

  <!-- Pharmacy Header -->
  <rect x="10" y="10" width="620" height="60" rx="14" fill="#0f172a"/>
  <rect x="10" y="55" width="620" height="15" fill="#0f172a"/>
  <text x="30" y="46" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#38bdf8">✚ ${opts.pharmacy}</text>
  <text x="500" y="46" font-family="monospace" font-size="14" font-weight="700" fill="#94a3b8">DISPATCH</text>

  <!-- STAT Banner if applicable -->
  ${
    opts.isStat
      ? `<rect x="30" y="85" width="580" height="34" rx="6" fill="#be123c"/>
         <text x="320" y="108" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">⚠ PRIORITY DISPATCH / STAT URGENT ⚠</text>`
      : `<rect x="30" y="85" width="580" height="28" rx="6" fill="#e2e8f0"/>
         <text x="45" y="104" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" fill="#475569">STANDARD PRESCRIBED HOME DELIVERY</text>`
  }

  <!-- Barcode Simulation -->
  <g transform="translate(30, 132)">
    <rect x="0" y="0" width="4" height="42" fill="#1e293b"/>
    <rect x="7" y="0" width="2" height="42" fill="#1e293b"/>
    <rect x="12" y="0" width="6" height="42" fill="#1e293b"/>
    <rect x="22" y="0" width="2" height="42" fill="#1e293b"/>
    <rect x="28" y="0" width="4" height="42" fill="#1e293b"/>
    <rect x="36" y="0" width="8" height="42" fill="#1e293b"/>
    <rect x="48" y="0" width="3" height="42" fill="#1e293b"/>
    <rect x="55" y="0" width="5" height="42" fill="#1e293b"/>
    <rect x="64" y="0" width="2" height="42" fill="#1e293b"/>
    <rect x="70" y="0" width="7" height="42" fill="#1e293b"/>
    <rect x="81" y="0" width="3" height="42" fill="#1e293b"/>
    <rect x="88" y="0" width="5" height="42" fill="#1e293b"/>
    <rect x="97" y="0" width="2" height="42" fill="#1e293b"/>
    <rect x="103" y="0" width="6" height="42" fill="#1e293b"/>
    <rect x="113" y="0" width="4" height="42" fill="#1e293b"/>
    <rect x="121" y="0" width="2" height="42" fill="#1e293b"/>
    <rect x="127" y="0" width="5" height="42" fill="#1e293b"/>
    <rect x="136" y="0" width="3" height="42" fill="#1e293b"/>
    <text x="70" y="55" font-family="monospace" font-size="11" fill="#64748b" text-anchor="middle">*${opts.rxNumber}*</text>
  </g>

  <!-- Prescription & Patient Box -->
  <text x="210" y="148" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" fill="#64748b">RX NUMBER</text>
  <text x="210" y="168" font-family="monospace" font-size="17" font-weight="800" fill="#0f172a">${opts.rxNumber}</text>

  <text x="390" y="148" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" fill="#64748b">PATIENT / RECIPIENT</text>
  <text x="390" y="168" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" font-weight="800" fill="#0f172a">${opts.patientName}</text>

  <!-- Divider -->
  <line x1="30" y1="195" x2="610" y2="195" stroke="#e2e8f0" stroke-width="2"/>

  <!-- DELIVER TO DESTINATION SECTION -->
  <rect x="30" y="210" width="580" height="120" rx="10" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="50" y="235" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="800" fill="#0284c7" letter-spacing="1">▼ DELIVER TO DESTINATION ADDRESS:</text>
  <text x="50" y="270" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="900" fill="#0f172a">${opts.address}</text>

  <!-- Medication & Special Notes Footer -->
  <text x="50" y="312" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="700" fill="#334155">MED: ${opts.medication}</text>
  <text x="360" y="312" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" fill="#64748b">NOTE: ${opts.notes}</text>

  <!-- Footer Verification Stamp -->
  <text x="30" y="365" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" fill="#94a3b8">Houston Medical Courier Dispatch Verification Stamp • Scan on Delivery</text>
  <text x="540" y="365" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="700" fill="#10b981">● VERIFIED</text>
</svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export const SAMPLE_PRESCRIPTION_LABELS: SampleLabel[] = [
  {
    id: 'sample-1',
    title: 'Houston Westheimer Rd Rx',
    badge: 'Zone 1 Standard (3.5 mi)',
    address: '9600 Westheimer Rd, Houston, TX 77063',
    city: 'Houston',
    zip: '77063',
    patientName: 'Sarah Jenkins',
    rxNumber: 'RX-84920',
    medicationName: 'Amoxicillin 500mg (30 capsules)',
    isStat: false,
    notes: 'Leave at front porch inside enclosed patio',
    dataUrl: createLabelSvgDataUrl({
      pharmacy: 'Houston Regional Pharmacy Hub',
      rxNumber: 'RX-84920',
      patientName: 'Sarah Jenkins',
      address: '9600 Westheimer Rd, Houston, TX 77063',
      medication: 'Amoxicillin 500mg',
      isStat: false,
      notes: 'Leave on porch inside patio',
    }),
  },
  {
    id: 'sample-2',
    title: 'Texas Medical Center STAT',
    badge: 'STAT Urgent (+$15)',
    address: '6565 Fannin St, Houston, TX 77030',
    city: 'Houston',
    zip: '77030',
    patientName: 'Marcus Vance',
    rxNumber: 'RX-99412',
    medicationName: 'Insulin Glargine - Keep Refrigerated',
    isStat: true,
    notes: 'Urgent Care Nurse Station #4 • Direct Signature',
    dataUrl: createLabelSvgDataUrl({
      pharmacy: 'Houston Methodist Medical Center',
      rxNumber: 'RX-99412',
      patientName: 'Marcus Vance',
      address: '6565 Fannin St, Houston, TX 77030',
      medication: 'Insulin Glargine (Refrigerated)',
      isStat: true,
      notes: 'Urgent Care Nurse Station #4 • Direct Hand-off',
    }),
  },
  {
    id: 'sample-3',
    title: 'Sugar Land Regional Outpatient',
    badge: 'Zone 2 (11 mi)',
    address: '16655 Southwest Fwy, Sugar Land, TX 77479',
    city: 'Sugar Land',
    zip: '77479',
    patientName: 'Elena Rostova',
    rxNumber: 'RX-38291',
    medicationName: 'Atorvastatin 20mg',
    isStat: false,
    notes: 'Gate Code #7721 • Building B Suite 204',
    dataUrl: createLabelSvgDataUrl({
      pharmacy: 'Sugar Land Health Specialists',
      rxNumber: 'RX-38291',
      patientName: 'Elena Rostova',
      address: '16655 Southwest Fwy, Sugar Land, TX 77479',
      medication: 'Atorvastatin 20mg',
      isStat: false,
      notes: 'Gate Code #7721 • Building B Suite 204',
    }),
  },
  {
    id: 'sample-4',
    title: 'Katy Freeway Infusion STAT',
    badge: 'STAT Urgent (+$15)',
    address: '23900 Katy Fwy, Katy, TX 77494',
    city: 'Katy',
    zip: '77494',
    patientName: 'David K. Morales',
    rxNumber: 'RX-44109',
    medicationName: 'STAT Pediatric Suspension Antibiotic',
    isStat: true,
    notes: 'Ring doorbell twice upon arrival',
    dataUrl: createLabelSvgDataUrl({
      pharmacy: 'Texas Children’s Hospital West Campus',
      rxNumber: 'RX-44109',
      patientName: 'David K. Morales',
      address: '23900 Katy Fwy, Katy, TX 77494',
      medication: 'STAT Pediatric Suspension',
      isStat: true,
      notes: 'Ring doorbell twice upon arrival',
    }),
  },
];
