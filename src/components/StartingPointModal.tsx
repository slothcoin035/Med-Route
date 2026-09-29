import React, { useState, useEffect } from 'react';
import { HubLocation, LocationPoint } from '../types';
import { geocodeAddress, cleanAddressQuery } from '../utils/geocoding';
import { MapPin, Navigation, Search, Check, X, Building, LocateFixed, Loader2, Sparkles } from 'lucide-react';

interface StartingPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHub: HubLocation;
  onSaveHub: (newHub: HubLocation, relocateDriver: boolean) => void;
  onStartMapPick: () => void;
}

export const PRESET_STARTING_POINTS: HubLocation[] = [
  {
    id: 'hub-houston-central',
    name: 'Houston Hub',
    address: '800 W Sam Houston Pkwy S, Houston, TX 77042',
    coordinates: { lat: 29.7295, lng: -95.5714 },
  },
  {
    id: 'hub-houston-tmc',
    name: 'Texas Medical Center Hub',
    address: '6560 Fannin St, Houston, TX 77030',
    coordinates: { lat: 29.7108, lng: -95.3995 },
  },
  {
    id: 'hub-houston-katy',
    name: 'West Houston / Katy Hub',
    address: '13900 Katy Fwy, Houston, TX 77079',
    coordinates: { lat: 29.7856, lng: -95.6321 },
  },
  {
    id: 'hub-houston-woodlands',
    name: 'North Houston / Woodlands Hub',
    address: '17200 St Lukes Way, The Woodlands, TX 77384',
    coordinates: { lat: 30.1983, lng: -95.4526 },
  },
  {
    id: 'hub-houston-sugarland',
    name: 'Sugar Land Medical Hub',
    address: '16655 Southwest Fwy, Sugar Land, TX 77479',
    coordinates: { lat: 29.5886, lng: -95.6267 },
  },
  {
    id: 'hub-houston-pasadena',
    name: 'East Houston / Pasadena Depot',
    address: '3301 Plainview St, Pasadena, TX 77504',
    coordinates: { lat: 29.6874, lng: -95.1974 },
  },
];

export const StartingPointModal: React.FC<StartingPointModalProps> = ({
  isOpen,
  onClose,
  currentHub,
  onSaveHub,
  onStartMapPick,
}) => {
  const initialLat = Number(currentHub?.coordinates?.lat);
  const initialLng = Number(currentHub?.coordinates?.lng);
  const safeLatStr = !isNaN(initialLat) && isFinite(initialLat) ? initialLat.toString() : '29.7295';
  const safeLngStr = !isNaN(initialLng) && isFinite(initialLng) ? initialLng.toString() : '-95.5714';

  const [name, setName] = useState(currentHub?.name || 'Houston Hub');
  const [address, setAddress] = useState(currentHub?.address || '800 W Sam Houston Pkwy S, Houston, TX 77042');
  const [lat, setLat] = useState(safeLatStr);
  const [lng, setLng] = useState(safeLngStr);
  const [relocateDriver, setRelocateDriver] = useState(true);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cLat = Number(currentHub?.coordinates?.lat);
      const cLng = Number(currentHub?.coordinates?.lng);
      setName(currentHub?.name || 'Houston Hub');
      setAddress(currentHub?.address || '800 W Sam Houston Pkwy S, Houston, TX 77042');
      setLat(!isNaN(cLat) && isFinite(cLat) ? cLat.toString() : '29.7295');
      setLng(!isNaN(cLng) && isFinite(cLng) ? cLng.toString() : '-95.5714');
      setGeoNotice(null);
    }
  }, [isOpen, currentHub]);

  if (!isOpen) return null;

  // Handle address lookup using high-accuracy multi-provider geocoding
  const handleLookupAddress = async () => {
    const clean = cleanAddressQuery(address);
    if (!clean) {
      setGeoNotice('Please enter an address or city to locate.');
      return;
    }

    setIsGeocoding(true);
    setGeoNotice(null);

    try {
      const result = await geocodeAddress(clean);

      if (result) {
        setLat(result.coordinates.lat.toFixed(4));
        setLng(result.coordinates.lng.toFixed(4));
        setAddress(result.formattedAddress);
        setGeoNotice(
          `✓ Verified exact location: "${result.formattedAddress}" (${result.coordinates.lat.toFixed(4)}, ${result.coordinates.lng.toFixed(4)})`
        );
      } else {
        setGeoNotice('Address not found in index. Please verify street/city or enter coordinates manually.');
      }
    } catch (err) {
      console.warn('Geocoding lookup notice:', err);
      setGeoNotice('Unable to connect to geocoding lookup. You can enter coordinates manually.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle Device GPS lookup
  const handleUseDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoNotice('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingDevice(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingDevice(false);
        const foundLat = pos.coords.latitude;
        const foundLng = pos.coords.longitude;
        setLat(foundLat.toFixed(4));
        setLng(foundLng.toFixed(4));
        setName('My Current Location (Start Hub)');
        setAddress('GPS Acquired Starting Location');
        setGeoNotice('Current device GPS coordinates acquired successfully!');
      },
      (err) => {
        setIsLocatingDevice(false);
        setGeoNotice(`GPS Notice: ${err.message}. Please enter starting address manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle Preset selection
  const handleSelectPreset = (preset: HubLocation) => {
    setName(preset.name);
    setAddress(preset.address);
    setLat(preset.coordinates.lat.toString());
    setLng(preset.coordinates.lng.toString());
    setGeoNotice(null);
  };

  // Submit and apply new starting hub
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setGeoNotice('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    const newHub: HubLocation = {
      id: `hub-${Date.now()}`,
      name: name.trim() || 'Custom Pharmacy Hub',
      address: address.trim() || `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`,
      coordinates: {
        lat: Math.round(parsedLat * 10000) / 10000,
        lng: Math.round(parsedLng * 10000) / 10000,
      },
    };

    onSaveHub(newHub, relocateDriver);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-lg tracking-tight">
                Set Route Starting Point
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px] sm:max-w-none">
                Dispatch pharmacy origin for distance & zone pay calculations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Starting Point Badge */}
        <div className="bg-teal-50/80 border-b border-teal-100 p-2.5 sm:p-3 px-4 sm:px-5 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-teal-900">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full">
              Active Hub
            </span>
            <span className="font-semibold truncate max-w-[160px] sm:max-w-none">{currentHub.name}</span>
          </div>
          <span className="text-teal-700 text-[11px] font-mono">
            {currentHub.coordinates.lat.toFixed(4)}, {currentHub.coordinates.lng.toFixed(4)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Preset Dispatch Centers */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Quick Select Preset Hubs
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_STARTING_POINTS.map((preset, index) => {
                const isSelected =
                  name === preset.name ||
                  (parseFloat(lat) === preset.coordinates.lat &&
                    parseFloat(lng) === preset.coordinates.lng);

                return (
                  <button
                    key={`${preset.id}-${index}`}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2.5 text-left rounded-xl border text-xs transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 text-slate-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span className="truncate">{preset.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 ml-1" />}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">
                      {preset.address}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Action Buttons: Device GPS or Pick on Map */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleUseDeviceLocation}
              disabled={isLocatingDevice}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
            >
              {isLocatingDevice ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
              ) : (
                <LocateFixed className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span>Use Device Location</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartMapPick();
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>Click Map to Place</span>
            </button>
          </div>

          {/* Notice / Feedback Message */}
          {geoNotice && (
            <div className="p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{geoNotice}</span>
            </div>
          )}

          {/* Manual Input Fields */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Starting Point Name / Description
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Houston Regional Dispatch"
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-teal-600 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Street Address / Location
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 800 West Sam Houston, Houston, TX"
                  required
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-teal-600 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={handleLookupAddress}
                  disabled={isGeocoding}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50"
                  title="Search coordinates for this address"
                >
                  {isGeocoding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Locate</span>
                </button>
              </div>
            </div>

            {/* Coordinates Lat / Lng */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-teal-600 focus:bg-white transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-teal-600 focus:bg-white transition-colors font-mono"
                />
              </div>
            </div>

            {/* Relocate Driver Option */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={relocateDriver}
                  onChange={(e) => setRelocateDriver(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <span className="font-medium">
                  Relocate driver vehicle to this new starting point
                </span>
              </label>
              <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                Moves the active driver location to the new hub and updates ETAs from here.
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply Starting Point</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
