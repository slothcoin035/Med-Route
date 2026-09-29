import React, { useState } from 'react';
import { Delivery, HubLocation, LocationPoint, TripScheduleConfig, ScannedAddressResult, RatesConfig } from '../types';
import { calculateDistanceMiles, determineZoneAndPay, evaluateStopPay } from '../utils/zonePay';
import {
  geocodeAddressWithDistance,
  cleanAddressQuery,
  parseAddressComponents,
} from '../utils/geocoding';
import { AddressCameraScanner } from './AddressCameraScanner';
import {
  X,
  Plus,
  MapPin,
  Search,
  Loader2,
  Trash2,
  Zap,
  FileText,
  ListPlus,
  CheckCircle2,
  Camera,
  Sparkles,
} from 'lucide-react';

export interface StagedDestination {
  id: string;
  address: string;
  miles: number;
  isStat: boolean;
  coordinates?: LocationPoint;
  city?: string;
  zip?: string;
  patientName?: string;
  notes?: string;
  medicationName?: string;
  rxNumber?: string;
}

interface AddDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDelivery: (newDelivery: Delivery) => void;
  onAddDeliveries?: (newDeliveries: Delivery[]) => void;
  hub: HubLocation;
  currentStopsCount: number;
  scheduleConfig?: TripScheduleConfig;
  ratesConfig?: RatesConfig;
}

export const AddDeliveryModal: React.FC<AddDeliveryModalProps> = ({
  isOpen,
  onClose,
  onAddDelivery,
  onAddDeliveries,
  hub,
  currentStopsCount,
  scheduleConfig,
  ratesConfig,
}) => {
  // Staged destinations list for multiple additions
  const [stagedList, setStagedList] = useState<StagedDestination[]>([]);

  // Current single input fields
  const [currentAddress, setCurrentAddress] = useState('');
  const [currentMiles, setCurrentMiles] = useState('8.5');
  const [currentIsStat, setCurrentIsStat] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<LocationPoint | null>(null);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentZip, setCurrentZip] = useState<string>('');

  // Bulk paste mode toggle & text
  const [inputMode, setInputMode] = useState<'single' | 'camera' | 'bulk'>('single');
  const [bulkText, setBulkText] = useState('');

  // Handle address returned from camera scanner
  const handleAddressScanned = (scanned: ScannedAddressResult) => {
    const miles = scanned.miles || parseFloat(currentMiles) || 8.0;
    const newDest: StagedDestination = {
      id: `stage-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      address: scanned.address,
      miles,
      isStat: Boolean(scanned.isStat),
      coordinates: scanned.coordinates,
      city: scanned.city,
      zip: scanned.zip,
      patientName: scanned.patientName,
      notes: scanned.notes,
      medicationName: scanned.medicationName,
      rxNumber: scanned.rxNumber,
    };

    setStagedList((prev) => [...prev, newDest]);
    setCurrentAddress(scanned.address);
    if (scanned.coordinates) setCurrentCoords(scanned.coordinates);
    if (scanned.city) setCurrentCity(scanned.city);
    if (scanned.zip) setCurrentZip(scanned.zip);
    setCurrentMiles(miles.toFixed(1));
    setCurrentIsStat(Boolean(scanned.isStat));
    setInputMode('single');
    setLocationNotice(`✓ Scanned with Camera: ${scanned.address} (${miles.toFixed(1)} mi staged)`);
  };

  if (!isOpen) return null;

  const numericMiles = parseFloat(currentMiles) || 5;
  const { zone: currentZone, pay: currentPay, rule: currentRule } = determineZoneAndPay(
    numericMiles,
    currentIsStat,
    ratesConfig
  );

  // Geocode current single address
  const handleGeocodeAddress = async () => {
    const clean = cleanAddressQuery(currentAddress);
    if (!clean) {
      setLocationNotice('Please enter an address first.');
      return;
    }

    setIsLocating(true);
    setLocationNotice(null);

    try {
      const geo = await geocodeAddressWithDistance(clean, hub.coordinates);

      if (geo.result) {
        const coords = geo.result.coordinates;
        setCurrentCoords(coords);
        setCurrentAddress(geo.result.formattedAddress);
        if (geo.result.city) setCurrentCity(geo.result.city);
        if (geo.result.zip) setCurrentZip(geo.result.zip);
        setCurrentMiles(geo.distanceMiles.toFixed(1));

        const cityLabel = geo.result.city
          ? `${geo.result.city}, ${geo.result.state || 'TX'}`
          : '';
        setLocationNotice(
          `✓ Verified: (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) in ${cityLabel || 'destination'} • ${geo.distanceMiles.toFixed(1)} mi from ${hub.name}`
        );
      } else {
        const parsed = parseAddressComponents(clean);
        if (parsed.city) setCurrentCity(parsed.city);
        if (parsed.zip) setCurrentZip(parsed.zip);
        setLocationNotice('Address not found in index. You can adjust the distance directly.');
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
      setLocationNotice('Could not connect to geocoding. Using manual distance.');
    } finally {
      setIsLocating(false);
    }
  };

  // Add current address to staged list
  const handleAddCurrentToStaged = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const addr = currentAddress.trim();
    if (!addr) return;

    const miles = parseFloat(currentMiles) || 6.5;

    const hubLat = Number(hub?.coordinates?.lat) || 29.7295;
    const hubLng = Number(hub?.coordinates?.lng) || -95.5714;

    let coords: LocationPoint;
    if (currentCoords && !isNaN(currentCoords.lat) && !isNaN(currentCoords.lng)) {
      coords = currentCoords;
    } else {
      const angleRad = Math.random() * 2 * Math.PI;
      const latOffset = (miles / 69) * Math.cos(angleRad);
      const lngOffset =
        (miles / (69 * Math.cos((hubLat * Math.PI) / 180))) * Math.sin(angleRad);
      coords = {
        lat: Math.round((hubLat + latOffset) * 10000) / 10000,
        lng: Math.round((hubLng + lngOffset) * 10000) / 10000,
      };
    }

    const parsed = parseAddressComponents(addr);

    const newDest: StagedDestination = {
      id: `stage-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      address: addr,
      miles,
      isStat: currentIsStat,
      coordinates: coords,
      city: currentCity || parsed.city || undefined,
      zip: currentZip || parsed.zip || undefined,
    };

    setStagedList((prev) => [...prev, newDest]);
    setCurrentAddress('');
    setCurrentCoords(null);
    setCurrentCity('');
    setCurrentZip('');
    setCurrentMiles('10.0');
    setCurrentIsStat(false);
    setLocationNotice(null);
  };

  // Parse bulk pasted text (one address per line)
  const handleProcessBulkText = () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3);

    if (lines.length === 0) return;

    const hubLat = Number(hub?.coordinates?.lat) || 29.7295;
    const hubLng = Number(hub?.coordinates?.lng) || -95.5714;

    const newStaged: StagedDestination[] = lines.map((addr, idx) => {
      // Generate varying reasonable distances (5 to 35 miles)
      const miles = Math.round((5 + (idx * 6.5) % 35 + Math.random() * 3) * 10) / 10;
      const angleRad = ((idx * 65) % 360) * (Math.PI / 180);
      const latOffset = (miles / 69) * Math.cos(angleRad);
      const lngOffset =
        (miles / (69 * Math.cos((hubLat * Math.PI) / 180))) * Math.sin(angleRad);

      const coords: LocationPoint = {
        lat: Math.round((hubLat + latOffset) * 10000) / 10000,
        lng: Math.round((hubLng + lngOffset) * 10000) / 10000,
      };

      const isStatLine = addr.toLowerCase().includes('stat') || addr.toLowerCase().includes('urgent');
      const cleanAddress = addr.replace(/\(stat\)/gi, '').replace(/\[stat\]/gi, '').trim();

      return {
        id: `bulk-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        address: cleanAddress,
        miles,
        isStat: isStatLine,
        coordinates: coords,
      };
    });

    setStagedList((prev) => [...prev, ...newStaged]);
    setBulkText('');
    setInputMode('single');
  };

  // Remove item from staged list
  const handleRemoveStaged = (id: string) => {
    setStagedList((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit all destinations (staged + any currently typed address)
  const handleFinalSubmit = () => {
    const listToSubmit = [...stagedList];

    // If user typed an address in the input but didn't click "+ Add to List", include it
    if (currentAddress.trim()) {
      const miles = parseFloat(currentMiles) || 6.5;
      const hubLat = Number(hub?.coordinates?.lat) || 29.7295;
      const hubLng = Number(hub?.coordinates?.lng) || -95.5714;

      let coords: LocationPoint;
      if (currentCoords && !isNaN(currentCoords.lat) && !isNaN(currentCoords.lng)) {
        coords = currentCoords;
      } else {
        const angleRad = Math.random() * 2 * Math.PI;
        const latOffset = (miles / 69) * Math.cos(angleRad);
        const lngOffset =
          (miles / (69 * Math.cos((hubLat * Math.PI) / 180))) * Math.sin(angleRad);
        coords = {
          lat: Math.round((hubLat + latOffset) * 10000) / 10000,
          lng: Math.round((hubLng + lngOffset) * 10000) / 10000,
        };
      }

      const parsed = parseAddressComponents(currentAddress.trim());

      listToSubmit.push({
        id: `stage-${Date.now()}`,
        address: currentAddress.trim(),
        miles,
        isStat: currentIsStat,
        coordinates: coords,
        city: currentCity || parsed.city || undefined,
        zip: currentZip || parsed.zip || undefined,
      });
    }

    if (listToSubmit.length === 0) return;

    // Convert staged destinations into Delivery entities
    const createdDeliveries: Delivery[] = listToSubmit.map((item, idx) => {
      const stopNumber = currentStopsCount + idx + 1;
      const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
        item.miles,
        item.isStat,
        scheduleConfig,
        undefined,
        ratesConfig
      );

      const parsed = parseAddressComponents(item.address);
      const finalCity = item.city || parsed.city || 'Houston';
      const finalZip = item.zip || parsed.zip || '77042';

      return {
        id: `del-${Date.now()}-${idx}`,
        rxNumber: item.rxNumber || `RX-${Math.floor(10000 + Math.random() * 90000)}`,
        patientName: item.patientName || `Stop #${stopNumber} (${item.address.split(',')[0].trim()})`,
        phone: '(713) 555-0100',
        address: item.address,
        city: finalCity,
        zip: finalZip,
        coordinates: item.coordinates || {
          lat: hub.coordinates.lat + 0.05 * (idx + 1),
          lng: hub.coordinates.lng + 0.05 * (idx + 1),
        },
        distanceFromHubMiles: item.miles,
        isStat: item.isStat,
        zone,
        basePay,
        surcharge,
        surchargeReason,
        pay,
        medicationName: item.medicationName || (item.isStat ? 'STAT Urgent Medication' : 'Prescription Delivery'),
        category: item.isStat ? 'STAT Urgent' : 'Standard',
        tempControlled: false,
        signatureRequired: true,
        specialInstructions: item.notes,
        status: 'pending',
        scheduledTimeWindow: item.isStat ? 'ASAP / STAT Urgent' : 'Today, Standard Dispatch',
        sequence: stopNumber,
      };
    });

    if (onAddDeliveries) {
      onAddDeliveries(createdDeliveries);
    } else {
      createdDeliveries.forEach((d) => onAddDelivery(d));
    }

    setStagedList([]);
    setCurrentAddress('');
    onClose();
  };

  // Calculate total metrics for staged list
  const totalStagedCount = stagedList.length + (currentAddress.trim() ? 1 : 0);
  const totalStagedPay =
    stagedList.reduce((acc, item) => acc + determineZoneAndPay(item.miles, item.isStat).pay, 0) +
    (currentAddress.trim() ? currentPay : 0);

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight flex items-center gap-2">
                <span>Add Delivery Destinations</span>
                {stagedList.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">
                    {stagedList.length} staged
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px] sm:max-w-none">
                Input drop-off locations to calculate zones and pay from dispatch hub ({hub.name})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setInputMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                inputMode === 'single'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Add Destinations</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('camera')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                inputMode === 'camera'
                  ? 'bg-slate-900 text-teal-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-teal-500" />
              <span>Scan with Camera</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                AI
              </span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('bulk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                inputMode === 'bulk'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Bulk Paste Addresses</span>
            </button>
          </div>

          {/* Mode 1: Single/Multiple Row Builder */}
          {inputMode === 'single' && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div>
                <label className="block font-bold text-slate-800 text-xs mb-1">
                  Destination Address / Location *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCurrentToStaged();
                        }
                      }}
                      placeholder="e.g. 4500 Speedway Blvd, Austin, TX"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-teal-600 bg-white transition-colors shadow-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGeocodeAddress}
                    disabled={isLocating || !currentAddress.trim()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                    title="Find GPS coordinates and calculate distance from hub"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-teal-400" />
                    )}
                    <span>Locate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('camera')}
                    className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                    title="Scan address from phone camera photo or label"
                  >
                    <Camera className="w-3.5 h-3.5 text-teal-600" />
                    <span className="hidden sm:inline">Scan Camera</span>
                  </button>
                </div>
              </div>

              {/* Distance, STAT, and Add to Batch Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">Distance:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="300"
                      value={currentMiles}
                      onChange={(e) => setCurrentMiles(e.target.value)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 bg-white"
                    />
                    <span className="text-xs text-slate-500 font-semibold">mi</span>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentIsStat}
                      onChange={(e) => setCurrentIsStat(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-rose-600" />
                      STAT Urgent ($15)
                    </span>
                  </label>

                  {/* Live Zone preview for current input */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: currentRule?.color }}
                    />
                    <span className="font-bold text-slate-700">{currentZone}</span>
                    <span className="font-bold text-emerald-700">(${currentPay}.00)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddCurrentToStaged()}
                  disabled={!currentAddress.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4 text-teal-400" />
                  <span>Add to List</span>
                </button>
              </div>

              {locationNotice && (
                <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 p-2 rounded-lg">
                  {locationNotice}
                </p>
              )}
            </div>
          )}

          {/* Mode 2: Bulk Paste Textarea */}
          {inputMode === 'bulk' && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div>
                <label className="block font-bold text-slate-800 text-xs mb-1">
                  Paste Multiple Addresses (One address per line)
                </label>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`4500 Speedway Blvd, Austin, TX&#10;10401 Research Blvd, Austin, TX&#10;2100 E 51st St, Austin, TX (STAT)&#10;1201 W San Antonio St, San Marcos, TX`}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-teal-600 bg-white shadow-xs"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Tip: Append "(STAT)" to any address line to automatically designate it as an urgent priority stop.
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessBulkText}
                  disabled={!bulkText.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-teal-400" />
                  <span>Parse & Add All Addresses to List</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 3: Camera AI Scan */}
          {inputMode === 'camera' && (
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-1 shadow-lg">
              <AddressCameraScanner
                isOpen={true}
                mode="embedded"
                onClose={() => setInputMode('single')}
                onAddressScanned={handleAddressScanned}
                hub={hub}
              />
            </div>
          )}

          {/* Staged Destinations Table / List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <span>Staged Destinations for This Route</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                  {stagedList.length} stop{stagedList.length !== 1 ? 's' : ''}
                </span>
              </h4>

              {stagedList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setStagedList([])}
                  className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {stagedList.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/60">
                <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-600">
                  No destinations staged yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Type an address above and click <span className="font-semibold text-slate-700">Add to List</span> or use bulk paste to queue multiple stops.
                </p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {stagedList.map((item, idx) => {
                  const { zone, pay, rule } = determineZoneAndPay(item.miles, item.isStat);
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {currentStopsCount + idx + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {item.address}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="text-slate-500">{item.miles} mi from Hub</span>
                            <span
                              className="px-1.5 py-0.2 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: rule?.color }}
                            >
                              {zone}
                            </span>
                            {item.isStat && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-rose-600 text-white">
                                STAT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-emerald-700 text-sm">
                          ${pay}.00
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaged(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors"
                          title="Remove this destination"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Batch Summary & Payout Accumulator */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">
                Stops to Add
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {totalStagedCount} destination{totalStagedCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase block font-bold tracking-wider">
                Total Added Driver Pay
              </span>
              <span className="font-black text-emerald-700 text-base sm:text-lg">
                +${totalStagedPay}.00
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={totalStagedCount === 0}
              className="px-5 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {totalStagedCount > 1
                  ? `Add All ${totalStagedCount} Destinations to Route`
                  : totalStagedCount === 1
                  ? 'Add 1 Destination to Route'
                  : 'Add Destinations to Route'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
