import { jsPDF } from 'jspdf';
import { Delivery, DriverState, HubLocation, ZoneBreakdownSummary, TripScheduleConfig } from '../types';
import { generateLast7ShiftsHistory } from './shiftHistory';

export interface ShiftExportParams {
  driver: DriverState;
  hub: HubLocation;
  deliveries: Delivery[];
  summary: ZoneBreakdownSummary[];
  totalPay: number;
  completedPay: number;
  totalMiles: number;
  basePayTotal?: number;
  surchargesTotal?: number;
  eveningSurchargeCount?: number;
  eveningSurchargeTotal?: number;
  weekendSurchargeCount?: number;
  weekendSurchargeTotal?: number;
  scheduleConfig?: TripScheduleConfig;
}

function getSafeFileSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getFormattedDateStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Downloads a comprehensive Shift Summary as a CSV spreadsheet
 */
export function downloadShiftSummaryCSV(params: ShiftExportParams): void {
  const {
    driver,
    hub,
    deliveries,
    summary,
    totalPay,
    completedPay,
    totalMiles,
    basePayTotal = totalPay,
    surchargesTotal = 0,
    eveningSurchargeCount = 0,
    eveningSurchargeTotal = 0,
    weekendSurchargeCount = 0,
    weekendSurchargeTotal = 0,
    scheduleConfig,
  } = params;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const completedStops = deliveries.filter((d) => d.status === 'delivered');
  const completionRate = deliveries.length > 0 ? Math.round((completedStops.length / deliveries.length) * 100) : 0;

  const lines: string[] = [];

  // Metadata Section
  lines.push('"MEDROUTE LOGISTICS - DRIVER SHIFT SETTLEMENT SUMMARY"');
  lines.push(`"Report Generated","${dateStr} ${timeStr}"`);
  lines.push(`"Pharmacy Hub","${hub.name.replace(/"/g, '""')}"`);
  lines.push(`"Hub Address","${hub.address.replace(/"/g, '""')}"`);
  lines.push(`"Driver Name","${driver.name.replace(/"/g, '""')}"`);
  lines.push(`"Driver Phone","${driver.phone}"`);
  lines.push(`"Vehicle / Plate","${driver.vehicle} (${driver.licensePlate})"`);
  lines.push(`"Shift Schedule","${scheduleConfig?.dayOfWeek || 'Scheduled'} @ ${scheduleConfig?.customTime || 'Daytime'}"`);
  lines.push('');

  // Performance & Earnings Overview
  lines.push('"SHIFT PERFORMANCE & EARNINGS OVERVIEW"');
  lines.push('"Metric","Value"');
  lines.push(`"Total Assigned Stops","${deliveries.length}"`);
  lines.push(`"Completed Stops","${completedStops.length}"`);
  lines.push(`"Pending Stops","${deliveries.length - completedStops.length}"`);
  lines.push(`"Completion Rate","${completionRate}%"`);
  lines.push(`"Total Route Distance","${totalMiles} miles"`);
  lines.push(`"Base Zone Pay Subtotal","$${basePayTotal.toFixed(2)}"`);
  lines.push(`"Evening Differentials (+ $1.00/stop)","$${eveningSurchargeTotal.toFixed(2)} (${eveningSurchargeCount} stops)"`);
  lines.push(`"Weekend Differentials (+ $2.00/stop)","$${weekendSurchargeTotal.toFixed(2)} (${weekendSurchargeCount} stops)"`);
  lines.push(`"Total Time Surcharges","$${surchargesTotal.toFixed(2)}"`);
  lines.push(`"Total Completed / Delivered Pay","$${completedPay.toFixed(2)}"`);
  lines.push(`"GRAND TOTAL PROJECTED PAY","$${totalPay.toFixed(2)}"`);
  lines.push('');

  // Zone Breakdown Table
  lines.push('"ZONE PAY BREAKDOWN"');
  lines.push('"Zone","Distance Range","Base Rate ($)","Assigned Stops","Subtotal ($)"');
  summary.forEach((row) => {
    lines.push(`"${row.name}","${row.rangeLabel}","$${row.rate.toFixed(2)}","${row.count}","$${row.subtotal.toFixed(2)}"`);
  });
  lines.push('');

  // Itemized Deliveries
  lines.push('"ITEMIZED MEDICATION DELIVERIES LOG"');
  lines.push(
    '"Stop #","Rx Number","Patient Name","Address","City","Zone","Distance (mi)","Base Pay ($)","Time Surcharge ($)","Surcharge Reason","Net Pay ($)","Status","Delivered At"'
  );
  deliveries.forEach((d) => {
    const base = d.basePay !== undefined ? d.basePay : d.pay;
    const sur = d.surcharge || 0;
    lines.push(
      [
        d.sequence,
        `"${d.rxNumber}"`,
        `"${d.patientName.replace(/"/g, '""')}"`,
        `"${d.address.replace(/"/g, '""')}"`,
        `"${d.city}"`,
        `"${d.zone}"`,
        d.distanceFromHubMiles,
        `$${base.toFixed(2)}`,
        `+$${sur.toFixed(2)}`,
        `"${d.surchargeReason || 'None'}"`,
        `$${d.pay.toFixed(2)}`,
        `"${d.status.toUpperCase()}"`,
        `"${d.deliveredAt || 'Pending'}"`,
      ].join(',')
    );
  });

  // Last 7 Shifts Daily Trend Section
  lines.push('');
  lines.push('"LAST 7 SHIFTS DAILY EARNINGS TREND"');
  lines.push('"Shift Date","Calendar Date","Stops","Miles Driven","Base Pay","Surcharges","Total Pay","Status"');
  const history = generateLast7ShiftsHistory({
    currentTotalPay: totalPay,
    currentCompletedPay: completedPay,
    currentBasePay: basePayTotal,
    currentSurcharges: surchargesTotal,
    currentStopsCount: deliveries.length,
    currentMiles: totalMiles,
  });
  history.forEach((h) => {
    lines.push(
      [
        `"${h.dateLabel}"`,
        `"${h.fullDate}"`,
        h.stopsCount,
        `${h.totalMiles.toFixed(1)} mi`,
        `$${h.basePay.toFixed(2)}`,
        `$${h.surcharges.toFixed(2)}`,
        `$${h.totalPay.toFixed(2)}`,
        `"${h.isCurrentShift ? 'CURRENT ACTIVE' : 'COMPLETED'}"`,
      ].join(',')
    );
  });

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `shift_summary_${getSafeFileSlug(driver.name)}_${getFormattedDateStamp()}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a comprehensive Shift Summary as a formatted Text File (.txt)
 */
export function downloadShiftSummaryTXT(params: ShiftExportParams): void {
  const {
    driver,
    hub,
    deliveries,
    summary,
    totalPay,
    completedPay,
    totalMiles,
    basePayTotal = totalPay,
    surchargesTotal = 0,
    eveningSurchargeCount = 0,
    eveningSurchargeTotal = 0,
    weekendSurchargeCount = 0,
    weekendSurchargeTotal = 0,
    scheduleConfig,
  } = params;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const completedStops = deliveries.filter((d) => d.status === 'delivered');
  const completionRate = deliveries.length > 0 ? Math.round((completedStops.length / deliveries.length) * 100) : 0;

  const sep = '='.repeat(74);
  const subSep = '-'.repeat(74);

  const lines: string[] = [
    sep,
    '                     MEDROUTE PHARMACY LOGISTICS',
    '                 DRIVER SHIFT SETTLEMENT SUMMARY REPORT',
    sep,
    `Report Generated:    ${dateStr} ${timeStr}`,
    `Pharmacy Hub:        ${hub.name}`,
    `Hub Location:        ${hub.address}`,
    `Driver Name:         ${driver.name}`,
    `Driver Contact:      ${driver.phone}`,
    `Vehicle:             ${driver.vehicle} (Plate: ${driver.licensePlate})`,
    `Shift Schedule:      ${scheduleConfig?.dayOfWeek || 'Shift'} @ ${scheduleConfig?.customTime || 'Daytime'}`,
    subSep,
    'SHIFT PERFORMANCE & SETTLEMENT METRICS:',
    `  Total Assigned Deliveries:  ${deliveries.length} stops`,
    `  Completed Deliveries:       ${completedStops.length} delivered (${completionRate}%)`,
    `  Pending Deliveries:         ${deliveries.length - completedStops.length} stops remaining`,
    `  Total Shift Distance:       ${totalMiles} miles`,
    `  Delivered Earnings To Date: $${completedPay.toFixed(2)}`,
    `  Total Shift Projected Pay:  $${totalPay.toFixed(2)}`,
    subSep,
    'ZONE PAY BREAKDOWN (Official Rate Sheet):',
  ];

  summary.forEach((row) => {
    const namePad = row.name.padEnd(8);
    const rangePad = row.rangeLabel.padEnd(16);
    const rateStr = `$${row.rate.toFixed(2)}/stop`.padEnd(14);
    const stopsStr = `${row.count} stops`.padEnd(10);
    const subStr = `$${row.subtotal.toFixed(2)}`.padStart(10);
    lines.push(`  ${namePad} (${rangePad}) @ ${rateStr} : ${stopsStr} --> ${subStr}`);
  });

  lines.push('  ' + '.'.repeat(68));
  lines.push(`  Base Zone Pay Subtotal:                                    $${basePayTotal.toFixed(2)}`.padStart(70));

  if (eveningSurchargeCount > 0) {
    lines.push(
      `  Evening Differential (+ $1.00/stop) [${eveningSurchargeCount} stops]:            +$${eveningSurchargeTotal.toFixed(2)}`
    );
  }
  if (weekendSurchargeCount > 0) {
    lines.push(
      `  Weekend Differential (+ $2.00/stop) [${weekendSurchargeCount} stops]:            +$${weekendSurchargeTotal.toFixed(2)}`
    );
  }
  lines.push(`  Total Surcharges & Differentials:                          +$${surchargesTotal.toFixed(2)}`);
  lines.push(subSep);
  lines.push(`  GRAND TOTAL SETTLEMENT PAY:                                $${totalPay.toFixed(2)}`.padEnd(72));
  lines.push(`  COMPLETED / EARNED PAY:                                    $${completedPay.toFixed(2)}`.padEnd(72));
  lines.push(subSep);
  lines.push('ITEMIZED STOP-BY-STOP DELIVERIES LOG:');
  lines.push('  #   Rx Number   Patient Name         Zone    Dist     Base     Surch.  Net Pay  Status');
  lines.push('  ' + '-'.repeat(70));

  deliveries.forEach((d) => {
    const seq = String(d.sequence).padStart(2);
    const rx = d.rxNumber.padEnd(11);
    const pat = (d.patientName.length > 18 ? d.patientName.slice(0, 16) + '..' : d.patientName).padEnd(18);
    const zone = d.zone.padEnd(7);
    const dist = `${d.distanceFromHubMiles}m`.padEnd(7);
    const base = `$${(d.basePay !== undefined ? d.basePay : d.pay).toFixed(2)}`.padEnd(8);
    const sur = d.surcharge ? `+$${d.surcharge.toFixed(2)}` : '  --  ';
    const net = `$${d.pay.toFixed(2)}`.padStart(7);
    const stat = d.status === 'delivered' ? '[DONE]' : '[PEND]';
    lines.push(`  ${seq}  ${rx} ${pat} ${zone} ${dist} ${base} ${sur.padEnd(8)} ${net}  ${stat}`);
  });

  lines.push(subSep);
  lines.push('LAST 7 SHIFTS DAILY EARNINGS TREND:');
  lines.push('  Date          Stops   Mileage    Base Pay   Surcharges   Total Pay  Status');
  lines.push('  ' + '-'.repeat(70));
  const txtHistory = generateLast7ShiftsHistory({
    currentTotalPay: totalPay,
    currentCompletedPay: completedPay,
    currentBasePay: basePayTotal,
    currentSurcharges: surchargesTotal,
    currentStopsCount: deliveries.length,
    currentMiles: totalMiles,
  });
  txtHistory.forEach((h) => {
    const dLabel = h.dateLabel.padEnd(13);
    const stops = String(h.stopsCount).padStart(3);
    const miles = `${h.totalMiles.toFixed(1)} mi`.padStart(9);
    const base = `$${h.basePay.toFixed(2)}`.padStart(10);
    const sur = `$${h.surcharges.toFixed(2)}`.padStart(11);
    const total = `$${h.totalPay.toFixed(2)}`.padStart(11);
    const stat = h.isCurrentShift ? '[ACTIVE SHIFT]' : '[COMPLETED]';
    lines.push(`  ${dLabel} ${stops}  ${miles} ${base}  ${sur}  ${total}  ${stat}`);
  });

  lines.push(sep);
  lines.push('SIGNATURE VERIFICATION & APPROVAL:');
  lines.push('');
  lines.push('  Driver Signature:       ___________________________   Date: ___________');
  lines.push(`                          ${driver.name}`);
  lines.push('');
  lines.push('  Dispatcher Signature:   ___________________________   Date: ___________');
  lines.push('                          Shift Dispatcher Lead');
  lines.push(sep);

  const textContent = lines.join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = `shift_summary_${getSafeFileSlug(driver.name)}_${getFormattedDateStamp()}.txt`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a beautifully formatted official PDF shift settlement report
 */
export function downloadShiftSummaryPDF(params: ShiftExportParams): void {
  const {
    driver,
    hub,
    deliveries,
    summary,
    totalPay,
    completedPay,
    totalMiles,
    basePayTotal = totalPay,
    surchargesTotal = 0,
    eveningSurchargeCount = 0,
    eveningSurchargeTotal = 0,
    weekendSurchargeCount = 0,
    weekendSurchargeTotal = 0,
    scheduleConfig,
  } = params;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const completedStops = deliveries.filter((d) => d.status === 'delivered');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(12, y, pageWidth - 24, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MEDROUTE LOGISTICS', 18, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Prescription Delivery & Driver Zone Pay Settlement Report', 18, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`DATE: ${dateStr} ${timeStr}`, pageWidth - 18, y + 12, { align: 'right' });

  y += 26;

  // Hub & Driver Metadata Box
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(12, y, pageWidth - 24, 28, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PHARMACY HUB:', 16, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(hub.name, 16, y + 11);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(hub.address, 16, y + 16);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DRIVER INFORMATION:', 90, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(driver.name, 90, y + 11);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`${driver.vehicle}  |  Plate: ${driver.licensePlate}`, 90, y + 16);
  doc.text(`Contact: ${driver.phone}`, 90, y + 21);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SHIFT SCHEDULE:', 150, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${scheduleConfig?.dayOfWeek || 'Shift'} @ ${scheduleConfig?.customTime || 'Daytime'}`, 150, y + 11);
  doc.text(`Total Route Miles: ${totalMiles} mi`, 150, y + 16);
  doc.text(`Deliveries: ${completedStops.length}/${deliveries.length} delivered`, 150, y + 21);

  y += 33;

  // Section: Zone Pay Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('ZONE PAY ACCUMULATION & RATE SCHEDULE', 12, y);

  y += 4;

  // Table header
  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Zone Breakdown', 16, y + 4.8);
  doc.text('Distance Radius', 60, y + 4.8);
  doc.text('Base Rate', 110, y + 4.8, { align: 'right' });
  doc.text('Stops', 145, y + 4.8, { align: 'center' });
  doc.text('Subtotal', pageWidth - 16, y + 4.8, { align: 'right' });

  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  summary.forEach((row, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(12, y, pageWidth - 24, 6, 'F');
    }
    doc.setTextColor(15, 23, 42);
    doc.text(row.name, 16, y + 4.2);
    doc.setTextColor(100, 116, 139);
    doc.text(row.rangeLabel, 60, y + 4.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`$${row.rate.toFixed(2)}`, 110, y + 4.2, { align: 'right' });
    doc.text(String(row.count), 145, y + 4.2, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${row.subtotal.toFixed(2)}`, pageWidth - 16, y + 4.2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 6;
  });

  // Base subtotal
  doc.setDrawColor(203, 213, 225);
  doc.line(12, y, pageWidth - 12, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Base Zone Subtotal:', 60, y + 4.5);
  doc.text(`$${basePayTotal.toFixed(2)}`, pageWidth - 16, y + 4.5, { align: 'right' });
  y += 6;

  // Differentials if applicable
  if (eveningSurchargeCount > 0) {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.rect(12, y, pageWidth - 24, 6, 'F');
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(`Evening Differential (After 6:00 PM: +$1.00/stop) [${eveningSurchargeCount} stops]`, 16, y + 4.2);
    doc.text(`+$${eveningSurchargeTotal.toFixed(2)}`, pageWidth - 16, y + 4.2, { align: 'right' });
    y += 6;
  }

  if (weekendSurchargeCount > 0) {
    doc.setFillColor(243, 232, 255); // purple-100
    doc.rect(12, y, pageWidth - 24, 6, 'F');
    doc.setTextColor(107, 33, 168); // purple-800
    doc.text(`Weekend Evening (Sat/Sun After 4:00 PM: +$2.00/stop) [${weekendSurchargeCount} stops]`, 16, y + 4.2);
    doc.text(`+$${weekendSurchargeTotal.toFixed(2)}`, pageWidth - 16, y + 4.2, { align: 'right' });
    y += 6;
  }

  // Grand Total Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(12, y, pageWidth - 24, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('GRAND TOTAL SETTLEMENT PAY:', 16, y + 5.5);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.setFontSize(11);
  doc.text(`$${totalPay.toFixed(2)}`, pageWidth - 16, y + 5.8, { align: 'right' });

  y += 13;

  // Section: Itemized Deliveries Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ITEMIZED DELIVERIES LOG (COMPLETED & SCHEDULED)', 12, y);

  y += 4;

  // Table header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(12, y, pageWidth - 24, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('#', 15, y + 4.2);
  doc.text('Rx Number', 23, y + 4.2);
  doc.text('Patient Name', 52, y + 4.2);
  doc.text('Zone', 96, y + 4.2);
  doc.text('Dist.', 118, y + 4.2, { align: 'right' });
  doc.text('Base', 136, y + 4.2, { align: 'right' });
  doc.text('Surch.', 154, y + 4.2, { align: 'right' });
  doc.text('Total Pay', 174, y + 4.2, { align: 'right' });
  doc.text('Status', pageWidth - 16, y + 4.2, { align: 'right' });

  y += 6;

  // Table rows with page break support
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  deliveries.forEach((d, index) => {
    // Check page height
    if (y > 265) {
      doc.addPage();
      y = 15;
      // Re-print small subhead
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('ITEMIZED DELIVERIES LOG (CONTINUED)', 12, y);
      y += 5;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(12, y, pageWidth - 24, 5.5, 'F');
    }

    const base = d.basePay !== undefined ? d.basePay : d.pay;
    const sur = d.surcharge || 0;

    doc.setTextColor(15, 23, 42);
    doc.text(String(d.sequence), 15, y + 3.8);
    doc.text(d.rxNumber, 23, y + 3.8);

    const patName = d.patientName.length > 22 ? d.patientName.slice(0, 20) + '..' : d.patientName;
    doc.text(patName, 52, y + 3.8);
    doc.text(d.zone, 96, y + 3.8);
    doc.text(`${d.distanceFromHubMiles} mi`, 118, y + 3.8, { align: 'right' });
    doc.text(`$${base.toFixed(2)}`, 136, y + 3.8, { align: 'right' });
    doc.text(sur > 0 ? `+$${sur.toFixed(2)}` : '--', 154, y + 3.8, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${d.pay.toFixed(2)}`, 174, y + 3.8, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    if (d.status === 'delivered') {
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text('DELIVERED', pageWidth - 16, y + 3.8, { align: 'right' });
    } else {
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text('PENDING', pageWidth - 16, y + 3.8, { align: 'right' });
    }

    y += 5.5;
  });

  // Footer Signature Lines
  if (y > 250) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(16, y + 10, 85, y + 10);
  doc.line(115, y + 10, 185, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Driver Signature & Date', 16, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(driver.name, 16, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Pharmacy Dispatcher Approval & Date', 115, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('MedRoute Logistics Operations Lead', 115, y + 18);

  const filename = `shift_summary_${getSafeFileSlug(driver.name)}_${getFormattedDateStamp()}.pdf`;
  doc.save(filename);
}
