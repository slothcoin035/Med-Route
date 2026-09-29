import React, { useState, useEffect } from 'react';
import { Delivery, HubLocation, RatesConfig } from '../types';
import { geocodeAddressWithDistance, cleanAddressQuery, parseAddressComponents } from '../utils/geocoding';
import { determineZoneAndPay } from '../utils/zonePay';
import { cleanPhoneNumber } from '../utils/navigationShortcuts';
import {
  X,
  Phone,
  User,
  MapPin,
  Pill,
  FileText,
  AlertTriangle,
  Snowflake,
  FileSignature,
  Check,
  Search,
  Loader2,
  Save,
} from 'lucide-react';

interface EditDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  hub: HubLocation;
  ratesConfig?: RatesConfig;
  onSaveDelivery: (updated: Delivery) => void;
}

export const EditDeliveryModal: React.FC<EditDeliveryModalProps> = ({
  isOpen,
  onClose,
  delivery,
  hub,
  ratesConfig,
  onSaveDelivery,
}) => {
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [rxNumber, setRxNumber] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isStat, setIsStat] = useState(false);
  const [tempControlled, setTempControlled] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(true);
  const [miles, setMiles] = useState('5.0');
  const [isLocating, setIsLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (delivery) {
      setPatientName(delivery.patientName || '');
      setPhone(delivery.phone || '');
      setAddress(delivery.address || '');
      setCity(delivery.city || '');
      setZip(delivery.zip || '');
      setMedicationName(delivery.medicationName || '');
      setRxNumber(delivery.rxNumber || '');
      setSpecialInstructions(delivery.specialInstructions || '');
      setIsStat(Boolean(delivery.isStat));
      setTempControlled(Boolean(delivery.tempControlled));
      setSignatureRequired(delivery.signatureRequired ?? true);
      setMiles(delivery.distanceFromHubMiles?.toFixed(1) || '5.0');
      setNotice(null);
    }
  }, [delivery, isOpen]);

  if (!isOpen || !delivery) return null;

  // Phone input formatter: (###) ###-####
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) {
      setPhone('');
    } else if (digits.length <= 3) {
      setPhone(`(${digits}`);
    } else if (digits.length <= 6) {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
    } else {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
    }
  };

  const handleVerifyAddress = async () => {
    const clean = cleanAddressQuery(address);
    if (!clean) {
      setNotice('Please enter an address first');
      return;
    }

    setIsLocating(true);
    setNotice(null);

    try {
      const geo = await geocodeAddressWithDistance(clean, hub.coordinates);
      if (geo.result) {
        setAddress(geo.result.formattedAddress);
        if (geo.result.city) setCity(geo.result.city);
        if (geo.result.zip) setZip(geo.result.zip);
        setMiles(geo.distanceMiles.toFixed(1));
        setNotice(`✓ Verified: ${geo.distanceMiles.toFixed(1)} mi from ${hub.name}`);
      } else {
        const parsed = parseAddressComponents(clean);
        if (parsed.city) setCity(parsed.city);
        if (parsed.zip) setZip(parsed.zip);
        setNotice('Address not found in index. You can manually adjust the distance.');
      }
    } catch (err) {
      setNotice('Geocoding offline. Using manual distance.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numericMiles = parseFloat(miles) || delivery.distanceFromHubMiles || 5;
    const { zone, pay } = determineZoneAndPay(numericMiles, isStat, ratesConfig);

    const updated: Delivery = {
      ...delivery,
      patientName: patientName.trim() || delivery.patientName,
      phone: phone.trim(),
      address: address.trim() || delivery.address,
      city: city.trim() || delivery.city || 'Houston',
      zip: zip.trim() || delivery.zip || '77042',
      medicationName: medicationName.trim() || delivery.medicationName,
      rxNumber: rxNumber.trim() || delivery.rxNumber,
      specialInstructions: specialInstructions.trim() || undefined,
      isStat,
      tempControlled,
      signatureRequired,
      distanceFromHubMiles: numericMiles,
      zone,
      pay,
    };

    onSaveDelivery(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2200] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              #{delivery.sequence}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Edit Delivery Stop #{delivery.sequence}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update patient phone, contact details, address, or Rx notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Patient Name & Phone Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Patient Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Patient Phone</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold lowercase">
                  for calls & SMS
                </span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(713) 555-0100"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Delivery Address
              </label>
              <button
                type="button"
                onClick={handleVerifyAddress}
                disabled={isLocating}
                className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                <span>Verify & Calc Miles</span>
              </button>
            </div>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address (e.g. 7500 Cambridge St)"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-medium"
                required
              />
            </div>

            {notice && (
              <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-1">
                {notice}
              </p>
            )}
          </div>

          {/* City, Zip, Miles */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Houston"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Zip Code
              </label>
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="77042"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Miles from Hub
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-mono font-bold"
              />
            </div>
          </div>

          {/* Rx Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Medication Name
              </label>
              <div className="relative">
                <Pill className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  placeholder="e.g. Amoxicillin 500mg"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Rx Number
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={rxNumber}
                  onChange={(e) => setRxNumber(e.target.value)}
                  placeholder="RX-12345"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          {/* Special Instructions / Gate Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Courier Notes / Gate Code
            </label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Gate code #1234, leave in cool shaded porch box"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
            />
          </div>

          {/* Delivery Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              isStat
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={isStat}
                onChange={(e) => setIsStat(e.target.checked)}
                className="w-4 h-4 accent-rose-600 rounded"
              />
              <span className="text-xs font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>STAT Urgent</span>
              </span>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              tempControlled
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={tempControlled}
                onChange={(e) => setTempControlled(e.target.checked)}
                className="w-4 h-4 accent-sky-600 rounded"
              />
              <span className="text-xs font-bold flex items-center gap-1">
                <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                <span>Cold Storage</span>
              </span>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
              signatureRequired
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={signatureRequired}
                onChange={(e) => setSignatureRequired(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded"
              />
              <span className="text-xs font-bold flex items-center gap-1">
                <FileSignature className="w-3.5 h-3.5 text-amber-500" />
                <span>Signature</span>
              </span>
            </label>
          </div>

          {/* Footer Save Button */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-900/20 active:scale-95 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
