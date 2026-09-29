import React, { useState, useEffect } from 'react';
import { HubLocation, DriverState, RatesConfig, ZoneId, Delivery, TripScheduleConfig, ThemeMode } from '../types';
import { PRESET_STARTING_POINTS } from './StartingPointModal';
import {
  DEFAULT_RATES_CONFIG,
  formatMinutesTo12Hour,
  parseMinutesFromTimeString,
} from '../utils/zonePay';
import {
  X,
  Settings,
  MapPin,
  User,
  Navigation,
  RotateCcw,
  Check,
  Building,
  Car,
  Phone,
  Shield,
  Clock,
  Sparkles,
  Sliders,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Receipt,
  TrendingUp,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  HardDrive,
  Compass,
} from 'lucide-react';
import { NetworkStatus, NetworkSimulateMode } from '../hooks/useNetworkStatus';
import { getSavedDeliveriesMetadata } from '../utils/deliveryStorage';
import {
  getPreferredNavApp,
  setPreferredNavApp,
  getSavedRoundTripPreference,
  saveRoundTripPreference,
} from '../utils/navigationShortcuts';
import { NavAppChoice } from '../types';

export type SettingsTab = 'general' | 'settlement' | 'rates' | 'hub' | 'driver' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hub: HubLocation;
  onSaveHub: (newHub: HubLocation, relocateDriver?: boolean) => void;
  onOpenStartingPointModal: () => void;
  driver: DriverState;
  onOpenDriverProfileModal: () => void;
  onToggleDeviceGps: () => void;
  onSetSimSpeed: (speed: number) => void;
  onResetToDemo: () => void;
  onClearRoute: () => void;
  deliveriesCount: number;
  ratesConfig: RatesConfig;
  onSaveRates: (newConfig: RatesConfig) => void;
  initialTab?: SettingsTab;
  // Shift Settlement props
  deliveries?: Delivery[];
  totalPay?: number;
  completedPay?: number;
  totalMiles?: number;
  eveningSurchargeCount?: number;
  eveningSurchargeTotal?: number;
  weekendSurchargeCount?: number;
  weekendSurchargeTotal?: number;
  scheduleConfig?: TripScheduleConfig;
  onOpenReceiptModal?: () => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  networkStatus?: NetworkStatus;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  hub,
  onSaveHub,
  onOpenStartingPointModal,
  driver,
  onOpenDriverProfileModal,
  onToggleDeviceGps,
  onSetSimSpeed,
  onResetToDemo,
  onClearRoute,
  deliveriesCount,
  ratesConfig,
  onSaveRates,
  initialTab = 'general',
  deliveries = [],
  totalPay = 0,
  completedPay = 0,
  totalMiles = 0,
  eveningSurchargeCount = 0,
  eveningSurchargeTotal = 0,
  weekendSurchargeCount = 0,
  weekendSurchargeTotal = 0,
  scheduleConfig,
  onOpenReceiptModal,
  themeMode = 'day',
  onToggleTheme,
  networkStatus,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for Rates editing
  const [ratesForm, setRatesForm] = useState<RatesConfig>(ratesConfig);
  const [rateValidationErr, setRateValidationErr] = useState<string | null>(null);

  // In-vehicle navigation preferences
  const [preferredNavApp, setPreferredNavAppState] = useState<NavAppChoice>(() =>
    getPreferredNavApp()
  );
  const [roundTripPref, setRoundTripPref] = useState<boolean>(() =>
    getSavedRoundTripPreference()
  );

  // Sync state when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setRatesForm(ratesConfig);
      setRateValidationErr(null);
      setIsConfirmingClear(false);
      setPreferredNavAppState(getPreferredNavApp());
      setRoundTripPref(getSavedRoundTripPreference());
    }
  }, [isOpen, initialTab, ratesConfig]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleSelectPreset = (preset: HubLocation) => {
    onSaveHub(preset, true);
    showNotification(`Starting point updated to ${preset.name}`);
  };

  const handleClearWithConfirm = () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 4000);
      return;
    }
    onClearRoute();
    setIsConfirmingClear(false);
    showNotification('Route cleared to blank.');
  };

  const handleResetDemoWithNotice = () => {
    onResetToDemo();
    showNotification('Restored default Houston sample route.');
  };

  const handleZonePayChange = (zone: ZoneId, valStr: string) => {
    const val = parseFloat(valStr);
    const safeVal = isNaN(val) ? 0 : Math.max(0, val);
    setRatesForm((prev) => {
      if (zone === 'STAT') {
        return {
          ...prev,
          zones: {
            ...prev.zones,
            STAT: { pay: safeVal },
          },
        };
      }
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zone]: {
            ...prev.zones[zone],
            pay: safeVal,
          },
        },
      };
    });
  };

  const handleSaveRatesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      ratesForm.zones['Zone 1'].pay < 0 ||
      ratesForm.zones['Zone 2'].pay < 0 ||
      ratesForm.zones['Zone 3'].pay < 0 ||
      ratesForm.zones['Zone 4'].pay < 0 ||
      ratesForm.zones['Zone 5'].pay < 0 ||
      ratesForm.zones.STAT.pay < 0
    ) {
      setRateValidationErr('Zone pay rates cannot be negative values.');
      return;
    }

    if (ratesForm.afterHourSurcharge.rate < 0 || ratesForm.weekendSurcharge.rate < 0) {
      setRateValidationErr('Surcharge rates cannot be negative values.');
      return;
    }

    setRateValidationErr(null);
    onSaveRates(ratesForm);
    showNotification('Zone pay rates and differentials updated and recalculated!');
  };

  const handleRestoreRateDefaults = () => {
    setRatesForm(DEFAULT_RATES_CONFIG);
    setRateValidationErr(null);
    onSaveRates(DEFAULT_RATES_CONFIG);
    showNotification('Restored standard contract rates ($7, $8, $9, $11, $15).');
  };

  const weekendMins = parseMinutesFromTimeString(ratesForm.weekendSurcharge.cutoffTime) ?? 960;
  const eveningMins = parseMinutesFromTimeString(ratesForm.afterHourSurcharge.cutoffTime) ?? 1080;

  // Shift Settlement breakdown computations
  const zone1Stops = deliveries.filter((d) => d.zone === 'Zone 1').length;
  const zone2Stops = deliveries.filter((d) => d.zone === 'Zone 2').length;
  const zone3Stops = deliveries.filter((d) => d.zone === 'Zone 3').length;
  const zone4Stops = deliveries.filter((d) => d.zone === 'Zone 4').length;
  const zone5Stops = deliveries.filter((d) => d.zone === 'Zone 5').length;
  const statStops = deliveries.filter((d) => d.zone === 'STAT').length;

  const currentZoneBreakdown = [
    { zone: 'Zone 1', radius: `0–${ratesConfig.zones['Zone 1'].maxMiles} mi`, count: zone1Stops, rate: ratesConfig.zones['Zone 1'].pay, subtotal: zone1Stops * ratesConfig.zones['Zone 1'].pay, color: '#10b981' },
    { zone: 'Zone 2', radius: `${ratesConfig.zones['Zone 2'].minMiles}–${ratesConfig.zones['Zone 2'].maxMiles} mi`, count: zone2Stops, rate: ratesConfig.zones['Zone 2'].pay, subtotal: zone2Stops * ratesConfig.zones['Zone 2'].pay, color: '#3b82f6' },
    { zone: 'Zone 3', radius: `${ratesConfig.zones['Zone 3'].minMiles}–${ratesConfig.zones['Zone 3'].maxMiles} mi`, count: zone3Stops, rate: ratesConfig.zones['Zone 3'].pay, subtotal: zone3Stops * ratesConfig.zones['Zone 3'].pay, color: '#8b5cf6' },
    { zone: 'Zone 4', radius: `${ratesConfig.zones['Zone 4'].minMiles}–${ratesConfig.zones['Zone 4'].maxMiles} mi`, count: zone4Stops, rate: ratesConfig.zones['Zone 4'].pay, subtotal: zone4Stops * ratesConfig.zones['Zone 4'].pay, color: '#f59e0b' },
    { zone: 'Zone 5', radius: `${ratesConfig.zones['Zone 5'].minMiles}+ mi`, count: zone5Stops, rate: ratesConfig.zones['Zone 5'].pay, subtotal: zone5Stops * ratesConfig.zones['Zone 5'].pay, color: '#ef4444' },
    { zone: 'STAT', radius: 'Emergency', count: statStops, rate: ratesConfig.zones['STAT'].pay, subtotal: statStops * ratesConfig.zones['STAT'].pay, color: '#dc2626' },
  ];

  const baseSubtotal = currentZoneBreakdown.reduce((sum, item) => sum + item.subtotal, 0);
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92dvh] text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-white leading-tight">Settings & Dispatch</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">Hub location, driver settlement, pay rates, and dispatch preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 pt-2.5 sm:pt-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Overview & GPS</span>
          </button>

          <button
            onClick={() => setActiveTab('settlement')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settlement'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Shift Settlement</span>
          </button>

          <button
            onClick={() => setActiveTab('rates')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rates'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Rates & Zones</span>
          </button>

          <button
            onClick={() => setActiveTab('hub')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hub'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Starting Hub</span>
          </button>

          <button
            onClick={() => setActiveTab('driver')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'driver'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Driver Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-teal-600 text-teal-700 dark:text-teal-300 dark:border-teal-400 bg-white dark:bg-slate-900 shadow-xs font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Data & Demo</span>
          </button>
        </div>

        {/* Notification Toast */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: OVERVIEW & GPS */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              {/* Quick Summary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Starting Point</span>
                    <h3 className="font-bold text-slate-900 text-sm">{hub.name}</h3>
                    <p className="text-xs text-slate-500 truncate max-w-sm">{hub.address}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('hub')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs self-start sm:self-auto"
                >
                  Change Hub
                </button>
              </div>

              {/* Day / Night Theme Mode Card */}
              {onToggleTheme && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      {themeMode === 'night' ? <Moon className="w-6 h-6 text-amber-400" /> : <Sun className="w-6 h-6 text-amber-500" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Display Appearance</span>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {themeMode === 'night' ? 'Night (Dark) Mode Active' : 'Day (Light) Mode Active'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {themeMode === 'night'
                          ? 'Optimized for low-light night driving and battery saving'
                          : 'High contrast for daylight visibility'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-650 transition-colors shadow-2xs self-start sm:self-auto"
                  >
                    {themeMode === 'night' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400" />
                        <span>Switch to Day Mode</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-600" />
                        <span>Switch to Night Mode</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Shift Settlement Quick Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                      <span>Driver Shift Settlement</span>
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <h3 className="font-bold text-lg text-white">${completedPay.toFixed(2)} Earned</h3>
                      <span className="text-xs text-slate-300">(${totalPay.toFixed(2)} total route value)</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {deliveredCount} of {deliveries.length} stops delivered • {totalMiles.toFixed(1)} route miles
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('settlement')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    View Breakdown
                  </button>
                  {onOpenReceiptModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReceiptModal();
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Manifest</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation & Simulation Controls */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-teal-600" />
                    <h4 className="text-sm font-bold text-slate-900">GPS & Driving Simulator</h4>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    driver.useDeviceGps
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : driver.isSimulating
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {driver.useDeviceGps ? 'Device GPS Active' : driver.isSimulating ? 'Driver Simulating' : 'Driver Idle'}
                  </span>
                </div>

                {/* GPS Source Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Use Live Device Hardware GPS</p>
                    <p className="text-[11px] text-slate-500">Track current phone or browser coordinates instead of simulated route driver</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleDeviceGps();
                      showNotification(driver.useDeviceGps ? 'Switched to simulated driving GPS' : 'Live device GPS activated');
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      driver.useDeviceGps ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        driver.useDeviceGps ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Simulation Speed Buttons */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Simulation Driving Speed</p>
                    <p className="text-[11px] text-slate-500">Adjust the driver animation speed along the route</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                    {[1, 2, 5, 10].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          onSetSimSpeed(spd);
                          showNotification(`Simulation speed set to ${spd}x`);
                        }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                          driver.simSpeedMultiplier === spd
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Network Connectivity & Offline Mode Settings */}
              {networkStatus && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {networkStatus.status === 'online' ? (
                        <Wifi className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                      )}
                      <h4 className="text-sm font-bold text-slate-900">Internet & Offline Routing Status</h4>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      networkStatus.status === 'online'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : networkStatus.status === 'unstable'
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-rose-100 text-rose-700 border border-rose-300'
                    }`}>
                      {networkStatus.status === 'online'
                        ? 'Online & Stable'
                        : networkStatus.status === 'unstable'
                        ? 'Unstable / Weak Signal'
                        : 'Offline Mode Active'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    When network signal drops or becomes unstable on delivery routes, MedRoute automatically switches to Offline Mode, warning the driver that route updates may be delayed while preserving local dispatch logs and GPS.
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Connection Mode / Simulation</p>
                      <p className="text-[11px] text-slate-500">
                        {networkStatus.effectiveType ? `Detected: ${networkStatus.effectiveType.toUpperCase()}` : 'Live browser connectivity'}
                        {networkStatus.rtt !== undefined ? ` · ${networkStatus.rtt}ms RTT` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        {(['auto', 'unstable', 'offline'] as NetworkSimulateMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              networkStatus.setSimulateStatus(mode);
                              showNotification(
                                mode === 'auto'
                                  ? 'Restored real-time network detection'
                                  : `Simulating ${mode} network connection for testing`
                              );
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-md capitalize transition-colors ${
                              networkStatus.simulateStatus === mode
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            {mode === 'auto' ? 'Auto Live' : mode}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={networkStatus.checkConnectivity}
                        disabled={networkStatus.isChecking}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        title="Ping network check"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${networkStatus.isChecking ? 'animate-spin text-teal-600' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pay Schedule Reference Pill */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-900">Active Zone Pay & Differentials</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rates')}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1"
                  >
                    <span>Edit Rates</span>
                    <Sliders className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <span className="text-slate-500 block text-[10px]">Zone 1 (0–15 mi)</span>
                    <strong className="text-slate-900 text-sm">${ratesConfig.zones['Zone 1'].pay.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-200">
                    <span className="text-slate-500 block text-[10px]">Zone 2 (16–30 mi)</span>
                    <strong className="text-slate-900 text-sm">${ratesConfig.zones['Zone 2'].pay.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50/50 border border-purple-200">
                    <span className="text-slate-500 block text-[10px]">Zone 3 (31–40 mi)</span>
                    <strong className="text-slate-900 text-sm">${ratesConfig.zones['Zone 3'].pay.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-200">
                    <span className="text-slate-500 block text-[10px]">Zone 4 (41–60 mi)</span>
                    <strong className="text-slate-900 text-sm">${ratesConfig.zones['Zone 4'].pay.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-200">
                    <span className="text-slate-500 block text-[10px]">Zone 5 (61+ mi)</span>
                    <strong className="text-slate-900 text-sm">${ratesConfig.zones['Zone 5'].pay.toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50/70 border border-red-200">
                    <span className="text-rose-600 block text-[10px] font-bold">STAT Emergency</span>
                    <strong className="text-rose-700 text-sm">${ratesConfig.zones.STAT.pay.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>
                    After-Hours: <strong>+${ratesConfig.afterHourSurcharge.rate.toFixed(2)}</strong> after {ratesConfig.afterHourSurcharge.cutoffTime}
                  </span>
                  <span>
                    Weekend: <strong>+${ratesConfig.weekendSurcharge.rate.toFixed(2)}</strong> after {ratesConfig.weekendSurcharge.cutoffTime}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHIFT SETTLEMENT */}
          {activeTab === 'settlement' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Top Settlement Summary Header */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-800 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Shift Settlement & Zone Payroll</span>
                    </span>
                    <div className="flex items-baseline gap-2.5 mt-1">
                      <h3 className="text-2xl font-black text-white tracking-tight">
                        ${completedPay.toFixed(2)}
                      </h3>
                      <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                        Earned & Delivered
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Total potential route value: <strong className="text-white">${totalPay.toFixed(2)}</strong> ({deliveries.length} stops • {totalMiles.toFixed(1)} miles)
                    </p>
                  </div>

                  {onOpenReceiptModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReceiptModal();
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 transition-all shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95"
                    >
                      <Printer className="w-4 h-4 text-slate-950" />
                      <span>Print Official Manifest</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Deliveries</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-slate-900">{deliveredCount}</span>
                    <span className="text-xs text-slate-500">/ {deliveries.length}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
                    {deliveries.length > 0 ? `${Math.round((deliveredCount / deliveries.length) * 100)}% Complete` : '0% Complete'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Route</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-slate-900">{totalMiles.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">mi</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block truncate">
                    Hub: {hub.name.split(' ')[0]}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Evening Diff.</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-amber-800">${eveningSurchargeTotal.toFixed(2)}</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">
                    {eveningSurchargeCount} stops (+${ratesConfig.afterHourSurcharge.rate.toFixed(2)})
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">Weekend Diff.</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-purple-800">${weekendSurchargeTotal.toFixed(2)}</span>
                  </div>
                  <span className="text-[10px] text-purple-700 font-medium mt-0.5 block">
                    {weekendSurchargeCount} stops (+${ratesConfig.weekendSurcharge.rate.toFixed(2)})
                  </span>
                </div>
              </div>

              {/* Zone Payroll Breakdown Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Zone Payroll Breakdown</h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Active Rates & Rules</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Zone / Tier</th>
                        <th className="py-2 px-3">Radius Range</th>
                        <th className="py-2 px-3 text-center">Stops</th>
                        <th className="py-2 px-3 text-right">Base Rate</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {currentZoneBreakdown.map((row) => (
                        <tr key={row.zone} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            <span>{row.zone}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{row.radius}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-900">{row.count}</td>
                          <td className="py-2 px-3 text-right text-slate-600">${row.rate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">${row.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-2 px-3">Base Zone Total</td>
                        <td className="py-2 px-3 text-center">{deliveries.length}</td>
                        <td className="py-2 px-3 text-right text-slate-400">—</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-extrabold">
                          ${baseSubtotal.toFixed(2)}
                        </td>
                      </tr>
                      {(eveningSurchargeTotal > 0 || weekendSurchargeTotal > 0) && (
                        <tr className="text-slate-600 font-normal">
                          <td colSpan={4} className="py-1 px-3">
                            Differentials (+${ratesConfig.afterHourSurcharge.rate.toFixed(2)} evening / +${ratesConfig.weekendSurcharge.rate.toFixed(2)} weekend)
                          </td>
                          <td className="py-1 px-3 text-right font-semibold text-purple-700">
                            +${(eveningSurchargeTotal + weekendSurchargeTotal).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 border-t border-slate-300 text-sm">
                        <td colSpan={4} className="py-2 px-3 font-extrabold text-slate-900">Grand Total Projected Shift Payout</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-800">
                          ${totalPay.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Stop by Stop Breakdown preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Stop Payout Manifest</span>
                  <span className="text-[11px] text-slate-500">{deliveries.length} Total Deliveries</span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {deliveries.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No stops scheduled in current shift.</div>
                  ) : (
                    deliveries.map((delivery) => {
                      const isDelivered = delivery.status === 'delivered';
                      return (
                        <div key={delivery.id} className="p-2.5 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-slate-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {delivery.sequence}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">{delivery.patientName}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  delivery.isStat
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {delivery.zone}
                                </span>
                                {isDelivered && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Delivered
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{delivery.address}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900">${delivery.pay.toFixed(2)}</span>
                            {delivery.surcharge !== undefined && delivery.surcharge > 0 && (
                              <span className="block text-[10px] text-purple-700 font-semibold">
                                +${delivery.surcharge.toFixed(2)} diff
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Driver & Shift reconciliation info */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Driver:</span>
                    <span className="font-bold text-slate-900">{driver.name} • {driver.vehicle} ({driver.licensePlate})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Schedule Reference:</span>
                    <span className="font-semibold text-slate-800">
                      {scheduleConfig?.dayOfWeek} • {scheduleConfig?.timeMode === 'custom_time' ? scheduleConfig.customTime : 'Live Stop ETAs'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500">
                    Need the printable manifest with recipient signatures and official dispatch certification?
                  </p>
                  {onOpenReceiptModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReceiptModal();
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Open Full Settlement & Print Receipt</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RATES & ZONES (NEW) */}
          {activeTab === 'rates' && (
            <form onSubmit={handleSaveRatesSubmit} className="space-y-5">
              {rateValidationErr && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{rateValidationErr}</span>
                </div>
              )}

              {/* Zone Base Rates Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Zone Base Rates</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Change the driver base payout for each delivery radius
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Zone 1 */}
                  <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Zone 1
                      </span>
                      <span className="text-[10px] text-emerald-700">0–15 mi</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones['Zone 1'].pay}
                        onChange={(e) => handleZonePayChange('Zone 1', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Zone 2 */}
                  <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Zone 2
                      </span>
                      <span className="text-[10px] text-blue-700">16–30 mi</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones['Zone 2'].pay}
                        onChange={(e) => handleZonePayChange('Zone 2', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Zone 3 */}
                  <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Zone 3
                      </span>
                      <span className="text-[10px] text-purple-700">31–40 mi</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones['Zone 3'].pay}
                        onChange={(e) => handleZonePayChange('Zone 3', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Zone 4 */}
                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Zone 4
                      </span>
                      <span className="text-[10px] text-amber-700">41–60 mi</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones['Zone 4'].pay}
                        onChange={(e) => handleZonePayChange('Zone 4', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Zone 5 */}
                  <div className="p-3 bg-rose-50/40 rounded-xl border border-rose-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Zone 5
                      </span>
                      <span className="text-[10px] text-rose-700">61+ mi</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones['Zone 5'].pay}
                        onChange={(e) => handleZonePayChange('Zone 5', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* STAT Urgent */}
                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-300/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-950 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                        STAT
                      </span>
                      <span className="text-[10px] font-bold text-red-700">Urgent</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={ratesForm.zones.STAT.pay}
                        onChange={(e) => handleZonePayChange('STAT', e.target.value)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Differentials Section */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>Weekend & After-Hours Differentials</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extra pay added to every stop completed during evening or weekend delivery windows
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Evening / After-Hours */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        Evening / After-Hours
                      </span>
                      <input
                        type="checkbox"
                        checked={ratesForm.afterHourSurcharge.enabled}
                        onChange={(e) =>
                          setRatesForm((prev) => ({
                            ...prev,
                            afterHourSurcharge: {
                              ...prev.afterHourSurcharge,
                              enabled: e.target.checked,
                            },
                          }))
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Bonus / Stop:
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">+$</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={ratesForm.afterHourSurcharge.rate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setRatesForm((prev) => ({
                                ...prev,
                                afterHourSurcharge: {
                                  ...prev.afterHourSurcharge,
                                  rate: isNaN(val) ? 0 : Math.max(0, val),
                                },
                              }));
                            }}
                            disabled={!ratesForm.afterHourSurcharge.enabled}
                            className="w-full pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Cutoff Time:
                        </label>
                        <input
                          type="time"
                          value={ratesForm.afterHourSurcharge.cutoffTime}
                          onChange={(e) =>
                            setRatesForm((prev) => ({
                              ...prev,
                              afterHourSurcharge: {
                                ...prev.afterHourSurcharge,
                                cutoffTime: e.target.value,
                              },
                            }))
                          }
                          disabled={!ratesForm.afterHourSurcharge.enabled}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Applies to deliveries after {formatMinutesTo12Hour(eveningMins)}
                    </p>
                  </div>

                  {/* Weekend Differential */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        Weekend (Sat & Sun)
                      </span>
                      <input
                        type="checkbox"
                        checked={ratesForm.weekendSurcharge.enabled}
                        onChange={(e) =>
                          setRatesForm((prev) => ({
                            ...prev,
                            weekendSurcharge: {
                              ...prev.weekendSurcharge,
                              enabled: e.target.checked,
                            },
                          }))
                        }
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Bonus / Stop:
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">+$</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={ratesForm.weekendSurcharge.rate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setRatesForm((prev) => ({
                                ...prev,
                                weekendSurcharge: {
                                  ...prev.weekendSurcharge,
                                  rate: isNaN(val) ? 0 : Math.max(0, val),
                                },
                              }));
                            }}
                            disabled={!ratesForm.weekendSurcharge.enabled}
                            className="w-full pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">
                          Cutoff Time:
                        </label>
                        <input
                          type="time"
                          value={ratesForm.weekendSurcharge.cutoffTime}
                          onChange={(e) =>
                            setRatesForm((prev) => ({
                              ...prev,
                              weekendSurcharge: {
                                ...prev.weekendSurcharge,
                                cutoffTime: e.target.value,
                              },
                            }))
                          }
                          disabled={!ratesForm.weekendSurcharge.enabled}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-teal-600 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Applies to Sat/Sun stops after {formatMinutesTo12Hour(weekendMins)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRestoreRateDefaults}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Restore Standard Defaults</span>
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Rates & Recalculate</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: STARTING HUB */}
          {activeTab === 'hub' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Select Regional Dispatch Depot</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose one of the standard pharmacy distribution centers in Greater Houston
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenStartingPointModal}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1 shadow-2xs"
                >
                  <span>Custom Depot / Pin</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {PRESET_STARTING_POINTS.map((preset) => {
                  const isCurrent = hub.name.toLowerCase() === preset.name.toLowerCase();
                  return (
                    <div
                      key={preset.name}
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-500/30'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-teal-600 text-white font-bold'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {preset.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-teal-600 text-white rounded">
                                Active Hub
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{preset.address}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPreset(preset);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                          isCurrent
                            ? 'bg-teal-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isCurrent ? 'Selected' : 'Use Hub'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DRIVER PROFILE */}
          {activeTab === 'driver' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-teal-700 border-2 border-teal-500 flex items-center justify-center font-bold text-lg text-white shrink-0 shadow-xs">
                    {driver.avatarUrl ? (
                      <img src={driver.avatarUrl} alt={driver.name} className="w-full h-full object-cover" />
                    ) : (
                      driver.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Assigned Driver</span>
                    <h3 className="font-bold text-slate-900 text-base">{driver.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {driver.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-slate-400" />
                        {driver.vehicle}
                      </span>
                      <span className="bg-slate-200 text-slate-700 font-mono text-[10px] px-1.5 py-0.2 rounded font-bold">
                        {driver.licensePlate}
                      </span>
                    </div>
                    {driver.address && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate max-w-[240px] sm:max-w-md">{driver.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenDriverProfileModal}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-2xs shrink-0 self-start sm:self-auto flex items-center gap-1.5"
                >
                  <span>Edit Profile & Photo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-teal-600" />
                  <span>Compliance & Camera Badging</span>
                </h5>
                <p>
                  Driver photo and phone information are embedded directly on the printable Shift Settlement PDF and customer proof-of-delivery receipts.
                </p>
              </div>

              {/* In-Vehicle GPS Navigation App Preference */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-blue-600" />
                    <span>Default GPS Navigation App</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select your preferred app for 1-tap voice-guided turn-by-turn driving:
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'google' as NavAppChoice, label: 'Google Maps' },
                    { id: 'apple' as NavAppChoice, label: 'Apple Maps' },
                    { id: 'waze' as NavAppChoice, label: 'Waze' },
                  ].map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setPreferredNavApp(app.id);
                        setPreferredNavAppState(app.id);
                        showNotification(`Default navigation set to ${app.label}`);
                      }}
                      className={`py-2 px-2.5 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        preferredNavApp === app.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {preferredNavApp === app.id && <Check className="w-3.5 h-3.5" />}
                      <span>{app.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Round-Trip / Return Leg Preference */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-teal-600" />
                    <span>Round-Trip (Return to Base)</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Calculate return mileage and driving time back to your dispatch hub or home base
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !roundTripPref;
                    saveRoundTripPreference(next);
                    setRoundTripPref(next);
                    showNotification(
                      next ? 'Round-trip mileage enabled' : 'Round-trip mileage disabled'
                    );
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                    roundTripPref
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {roundTripPref ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DATA & DEMO */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Currently Loaded Destinations:</span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  {deliveriesCount} Stops
                </span>
              </div>

              {/* Offline Persistent Route Storage Status */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 border border-teal-500/20">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Offline Route Persistence</h5>
                      <p className="text-[11px] text-slate-500">IndexedDB & localStorage dual-storage active</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Auto-Saved
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  All active delivery stops, geocoded coordinates, delivery completion timestamps, recipient signatures, and optimized route sequence are continuously synchronized to device storage. If you refresh or reopen the app while completely offline, your route data is preserved without data loss.
                </p>
                {(() => {
                  const meta = getSavedDeliveriesMetadata();
                  return meta?.savedAt ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      <HardDrive className="w-3 h-3 text-slate-400" />
                      <span>Last local sync: {new Date(meta.savedAt).toLocaleTimeString()} ({meta.count} stops stored)</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Load Demo */}
              <div className="p-4 rounded-xl border border-slate-200 hover:border-teal-500/50 transition-colors flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Load Demo Houston Deliveries</h5>
                  <p className="text-[11px] text-slate-500">
                    Restores the 8 standard Houston-area stops across Zones 1–5 with insulin, antibiotics, and STAT drops
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDemoWithNotice}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100 transition-colors shadow-2xs whitespace-nowrap shrink-0"
                >
                  Load Demo Route
                </button>
              </div>

              {/* Clear All Stops */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-rose-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Clear Route to Blank</span>
                  </h5>
                  <p className="text-[11px] text-rose-700">
                    Removes all stops from the current queue and relocates driver to the starting hub
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearWithConfirm}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-2xs whitespace-nowrap shrink-0 ${
                    isConfirmingClear
                      ? 'bg-rose-700 text-white animate-pulse'
                      : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-100'
                  }`}
                >
                  {isConfirmingClear ? 'Confirm Wipe Route?' : 'Clear All Stops'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            MedRoute Logistics • Houston Hub
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
