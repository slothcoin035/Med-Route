import React, { useState, useEffect } from 'react';
import { Delivery, DriverState, HubLocation, LocationPoint, NavAppChoice, RouteLeg, RouteStep } from '../types';
import {
  getPreferredNavApp,
  setPreferredNavApp,
  openInNavigationApp,
  openPhoneDialer,
  openSmsApp,
  triggerHapticFeedback,
  getNavAppName,
  getTelUrl,
  getSmsUrl,
  getNavigationAppUrl,
  COURIER_SMS_TEMPLATES,
  playInVehicleChime,
  speakDriverGuidance,
  getVoiceGuidancePref,
  saveVoiceGuidancePref,
} from '../utils/navigationShortcuts';
import {
  X,
  Compass,
  Phone,
  MessageSquare,
  CheckCircle2,
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  Flag,
  Volume2,
  VolumeX,
  Home,
  Building2,
  AlertTriangle,
  Play,
  Pause,
  FastForward,
  Keyboard,
  Radio,
  Clock,
  MapPin,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';

interface DriveModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverState;
  nextDelivery: Delivery | null;
  deliveries: Delivery[];
  hub: HubLocation;
  legs: RouteLeg[];
  upcomingManeuver?: string;
  onDeliverActive: () => void;
  onOpenDirections: () => void;
  onToggleSimulation: () => void;
  onSetSimSpeed: (speed: number) => void;
  onToggleDeviceGps: () => void;
  onUpdateDelivery?: (updated: Delivery) => void;
}

export const DriveModeModal: React.FC<DriveModeModalProps> = ({
  isOpen,
  onClose,
  driver,
  nextDelivery,
  deliveries,
  hub,
  legs,
  upcomingManeuver,
  onDeliverActive,
  onOpenDirections,
  onToggleSimulation,
  onSetSimSpeed,
  onToggleDeviceGps,
  onUpdateDelivery,
}) => {
  const [preferredApp, setPreferredApp] = useState<NavAppChoice>(() => getPreferredNavApp());
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(() => getVoiceGuidancePref());
  const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);
  const [isHighContrastNight, setIsHighContrastNight] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');

  // Sync preferences on open
  useEffect(() => {
    if (isOpen) {
      setPreferredApp(getPreferredNavApp());
      setIsVoiceEnabled(getVoiceGuidancePref());
    }
  }, [isOpen]);

  // Read upcoming stop whenever it changes and voice is enabled
  useEffect(() => {
    if (isOpen && isVoiceEnabled && nextDelivery) {
      const statNote = nextDelivery.isStat ? 'Attention. Emergency STAT delivery. ' : '';
      const text = `${statNote}Stop number ${nextDelivery.sequence}. ${nextDelivery.patientName} at ${nextDelivery.address}. Estimated arrival ${nextDelivery.eta || 'shortly'}.`;
      speakDriverGuidance(text);
      if (nextDelivery.isStat) {
        playInVehicleChime('stat');
      }
    }
  }, [isOpen, nextDelivery?.id]);

  // Flash temporary action feedback message
  const flashNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice((cur) => (cur === msg ? null : cur));
    }, 3200);
  };

  // Direct URLs for native mobile deep-linking
  const gpsUrl = nextDelivery
    ? getNavigationAppUrl(preferredApp, nextDelivery.coordinates, {
        origin: driver.currentLocation,
        address: nextDelivery.address,
      })
    : '';

  const telUrl = nextDelivery?.phone ? getTelUrl(nextDelivery.phone) : '';

  const smsTemplate = COURIER_SMS_TEMPLATES.find((t) => t.id === 'eta') || COURIER_SMS_TEMPLATES[0];
  const smsBodyText = nextDelivery
    ? smsTemplate.generateText({
        patientName: nextDelivery.patientName,
        medicationName: nextDelivery.medicationName,
        address: nextDelivery.address,
        eta: nextDelivery.eta,
        driverName: driver.name,
      })
    : '';
  const smsUrl = nextDelivery?.phone ? getSmsUrl(nextDelivery.phone, smsBodyText) : '';

  // 1-Tap Launch Preferred GPS
  const handleLaunchGps = (destCoords: LocationPoint, destAddress?: string) => {
    triggerHapticFeedback('tap');
    playInVehicleChime('action');
    openInNavigationApp(preferredApp, destCoords, {
      origin: driver.currentLocation,
      address: destAddress,
    });
    flashNotice(`Opening ${getNavAppName(preferredApp)}`);
  };

  // 1-Tap Direct Call
  const handleCallPatient = (e?: React.MouseEvent) => {
    triggerHapticFeedback('tap');
    if (!nextDelivery || !nextDelivery.phone) {
      if (e) e.preventDefault();
      setPhoneInput('');
      setIsEditingPhone(true);
      flashNotice('Enter patient phone number');
      return;
    }
    openPhoneDialer(nextDelivery.phone);
    flashNotice(`Dialing ${nextDelivery.patientName}...`);
  };

  // 1-Tap Quick Courier SMS
  const handleQuickSms = (e?: React.MouseEvent) => {
    triggerHapticFeedback('tap');
    if (!nextDelivery || !nextDelivery.phone) {
      if (e) e.preventDefault();
      setPhoneInput('');
      setIsEditingPhone(true);
      flashNotice('Enter patient phone number');
      return;
    }
    openSmsApp(nextDelivery.phone, smsBodyText);
    flashNotice(`Opening SMS to ${nextDelivery.patientName}`);
  };

  // 1-Tap Mark Delivered
  const handleMarkDelivered = () => {
    triggerHapticFeedback('success');
    playInVehicleChime('delivered');
    flashNotice(`✓ Stop #${nextDelivery?.sequence} delivered!`);
    onDeliverActive();
  };

  // Voice readout button
  const handleSpeakStatus = () => {
    triggerHapticFeedback('tap');
    if (nextDelivery) {
      const statNote = nextDelivery.isStat ? 'Attention: STAT urgent stop. ' : '';
      const text = `${statNote}Next stop #${nextDelivery.sequence}. ${nextDelivery.patientName} at ${nextDelivery.address}. Medication: ${nextDelivery.medicationName}. Estimated arrival ${nextDelivery.eta || 'soon'}.`;
      speakDriverGuidance(text);
      flashNotice('Reading stop information aloud');
    } else {
      speakDriverGuidance('All delivery stops completed. Ready to return to base.');
      flashNotice('All stops completed');
    }
  };

  // Return to Hub or Driver Home Base
  const handleReturnToBase = () => {
    triggerHapticFeedback('tap');
    const returnCoords = driver.addressCoordinates || hub.coordinates;
    const returnName = driver.address ? `${driver.name}'s Home Base` : hub.name;
    const returnAddress = driver.address || hub.address;
    handleLaunchGps(returnCoords, returnAddress);
    flashNotice(`Navigating back to ${returnName}`);
  };

  // Switch preferred app on 1 tap
  const handleSelectApp = (app: NavAppChoice) => {
    triggerHapticFeedback('tap');
    setPreferredNavApp(app);
    setPreferredApp(app);
    flashNotice(`Navigation set to ${getNavAppName(app)}`);
  };

  // Keyboard Shortcuts in Car Mode
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (nextDelivery) handleMarkDelivered();
          break;
        case 'KeyG':
          e.preventDefault();
          if (nextDelivery) {
            handleLaunchGps(nextDelivery.coordinates, nextDelivery.address);
          } else {
            handleReturnToBase();
          }
          break;
        case 'KeyC':
          e.preventDefault();
          handleCallPatient();
          break;
        case 'KeyT':
          e.preventDefault();
          handleQuickSms();
          break;
        case 'KeyV':
          e.preventDefault();
          handleSpeakStatus();
          break;
        case 'KeyD':
          e.preventDefault();
          onOpenDirections();
          break;
        case 'KeyH':
          e.preventDefault();
          handleReturnToBase();
          break;
        case 'KeyM':
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextDelivery, preferredApp, driver]);

  if (!isOpen) return null;

  // Cardinal Heading Direction
  const getHeadingDirection = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((heading % 360) / 45)) % 8;
    return directions[index];
  };

  // Progress counts
  const pendingCount = deliveries.filter((d) => d.status !== 'delivered').length;
  const completedCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <div
      className={`fixed inset-0 z-[2300] flex flex-col touch-manipulation overflow-hidden transition-colors duration-200 ${
        isHighContrastNight
          ? 'bg-slate-950 text-slate-100'
          : 'bg-slate-900 text-white'
      }`}
    >
      {/* Top Cockpit Header Bar */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-teal-400">
              Drive Mode
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-3">
            <span>Driver: <strong className="text-white">{driver.name}</strong></span>
            <span>•</span>
            <span>Plate: <strong className="text-teal-300 font-mono">{driver.licensePlate}</strong></span>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionNotice && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[11px] sm:text-xs font-bold animate-in fade-in zoom-in-95 truncate max-w-[200px] sm:max-w-none">
            <Sparkles className="w-3 h-3 shrink-0 text-teal-400" />
            <span className="truncate">{actionNotice}</span>
          </div>
        )}

        {/* Top Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Voice Announcement Toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('tap');
              const next = !isVoiceEnabled;
              setIsVoiceEnabled(next);
              saveVoiceGuidancePref(next);
              flashNotice(next ? 'Voice guidance ON' : 'Voice guidance MUTED');
            }}
            className={`p-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border cursor-pointer min-h-[38px] ${
              isVoiceEnabled
                ? 'bg-teal-600/30 text-teal-300 border-teal-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={isVoiceEnabled ? 'Voice Guidance Active (Press V to speak)' : 'Voice Guidance Muted'}
          >
            {isVoiceEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline text-[11px]">{isVoiceEnabled ? 'Voice ON' : 'Muted'}</span>
          </button>

          {/* Night / High-Contrast Toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('tap');
              setIsHighContrastNight((prev) => !prev);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors min-h-[38px]"
            title="Toggle Night Vision / Contrast Mode"
          >
            {isHighContrastNight ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Keyboard Shortcuts Help (visible on tablets/desktop) */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('tap');
              setShowShortcutsHelp((prev) => !prev);
            }}
            className={`hidden sm:flex p-2 rounded-xl text-xs border transition-colors min-h-[38px] items-center justify-center ${
              showShortcutsHelp
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
            }`}
            title="Keyboard / Bluetooth Shortcuts [?]"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Exit Drive Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('tap');
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-500 shadow-sm min-h-[38px]"
            title="Exit In-Vehicle Drive Mode (Esc)"
          >
            <X className="w-4 h-4" />
            <span className="hidden xs:inline">Exit</span>
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Drawer */}
      {showShortcutsHelp && (
        <div className="bg-slate-900 border-b border-slate-800 p-2.5 sm:p-4 text-xs animate-in slide-in-from-top duration-150">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-teal-400 font-bold text-xs">
              <Keyboard className="w-4 h-4" />
              <span>In-Vehicle Remote & Steering Wheel Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 w-full pt-1">
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">SPACE</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Delivered</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">G</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Launch GPS</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">C</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Call Patient</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">T</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Text ETA</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">V</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Voice Readout</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">D</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Directions</div>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px] font-bold">H</kbd>
                <div className="text-[10px] text-slate-300 mt-0.5">Return Base</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Middle Scrollable Content (Telemetry & Stop Details) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 max-w-4xl w-full mx-auto space-y-3 pb-4">
        {/* Compact Telemetry Chips Row (Optimized for Mobile Screens) */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* Speed */}
          <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speed</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black text-white">{driver.speedMph}</span>
              <span className="text-[9px] font-bold text-slate-400">MPH</span>
            </div>
          </div>

          {/* Heading */}
          <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heading</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black text-teal-300">{getHeadingDirection(driver.heading)}</span>
              <span className="text-[9px] font-mono text-slate-400">{Math.round(driver.heading)}°</span>
            </div>
          </div>

          {/* Stops */}
          <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800 shadow-sm flex flex-col items-center justify-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{completedCount}</span>
              <span className="text-[9px] text-slate-400">/{deliveries.length}</span>
            </div>
          </div>

          {/* Base */}
          <button
            type="button"
            onClick={handleReturnToBase}
            className="bg-slate-900/90 hover:bg-slate-800 rounded-xl p-2 border border-slate-800 hover:border-teal-500/40 shadow-sm flex flex-col items-center justify-center cursor-pointer transition-colors active:scale-95"
            title="Navigate to Base / Home"
          >
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base</span>
            <div className="flex items-center gap-1 text-teal-300 mt-0.5">
              <Home className="w-3.5 h-3.5" />
              <span className="text-xs font-bold truncate max-w-[65px]">
                {driver.address ? 'Home' : 'Hub'}
              </span>
            </div>
          </button>
        </div>

        {/* Active Maneuver Guidance Card */}
        {nextDelivery && (
          <div className="bg-gradient-to-r from-teal-950/80 via-slate-900 to-slate-900 p-3 sm:p-4 rounded-2xl border-2 border-teal-500/60 shadow-lg flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black shadow shrink-0">
              <CornerUpRight className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                Next Driving Maneuver
              </span>
              <h2 className="text-sm sm:text-lg font-black text-white leading-snug truncate">
                {upcomingManeuver || `Continue to ${nextDelivery.address}`}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
                <span className="flex items-center gap-1 font-bold text-teal-300">
                  <Clock className="w-3 h-3" />
                  <span>ETA: {nextDelivery.eta || 'En Route'}</span>
                </span>
                <span>•</span>
                <span>{nextDelivery.distanceFromHubMiles} mi from hub</span>
              </div>
            </div>

            {/* Read Aloud Button */}
            <button
              type="button"
              onClick={handleSpeakStatus}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 flex items-center justify-center shrink-0 cursor-pointer shadow active:scale-95 min-h-[40px] min-w-[40px]"
              title="Speak stop guidance aloud [V]"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Target Delivery Details Card */}
        {nextDelivery ? (
          <div className="bg-slate-900/90 rounded-2xl p-3.5 sm:p-5 border border-slate-800 shadow-md space-y-2.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-black text-xs">
                    STOP #{nextDelivery.sequence}
                  </span>
                  {nextDelivery.isStat && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-xs uppercase animate-pulse flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>STAT URGENT</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700">
                    {nextDelivery.zone} • ${nextDelivery.pay}
                  </span>
                  {nextDelivery.tempControlled && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-950 text-sky-300 font-bold text-xs border border-sky-800">
                      ❄ Cold Storage
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  {nextDelivery.patientName}
                </h1>

                <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm mt-0.5 font-medium flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">{nextDelivery.address}, {nextDelivery.city}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 border-l border-slate-700 pl-2">
                    <Phone className="w-3 h-3 text-sky-400 shrink-0" />
                    <span className="font-mono text-xs">{nextDelivery.phone || 'No Phone'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneInput(nextDelivery.phone || '');
                        setIsEditingPhone(true);
                      }}
                      className="text-teal-400 hover:text-teal-300 text-[11px] font-bold ml-1 hover:underline cursor-pointer"
                    >
                      {nextDelivery.phone ? 'Edit' : '+ Add'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Arrival</span>
                <span className="text-xl sm:text-2xl font-black text-teal-300">
                  {nextDelivery.eta || 'Soon'}
                </span>
              </div>
            </div>

            {/* Medication & Rx Notes */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="font-bold text-white">Rx:</span> {nextDelivery.medicationName}
                {nextDelivery.specialInstructions && (
                  <span className="text-amber-400 font-medium ml-2 truncate">
                    ⚠️ {nextDelivery.specialInstructions}
                  </span>
                )}
              </div>
              {nextDelivery.signatureRequired && (
                <span className="text-[10px] font-bold text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 shrink-0">
                  Signature
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Finished State */
          <div className="bg-slate-900/90 rounded-2xl p-6 border border-emerald-500/40 shadow-xl text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">All Route Deliveries Completed!</h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                All medications delivered. Tap below for turn-by-turn navigation back to your starting point.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReturnToBase}
              className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 mx-auto active:scale-95 cursor-pointer min-h-[48px]"
            >
              <Home className="w-4 h-4" />
              <span>Navigate to {driver.address ? "Driver's Home Base" : hub.name}</span>
            </button>
          </div>
        )}
      </div>

      {/* DOCKED / STICKY BOTTOM SHORTCUTS BAR (ALWAYS VISIBLE & TOUCH-SAFE ON PHONES) */}
      {nextDelivery && (
        <div className="sticky bottom-0 z-20 bg-slate-950/95 border-t border-slate-800 p-2.5 sm:p-4 backdrop-blur-md shadow-2xl shrink-0 space-y-2">
          {/* Segmented Nav App Picker (Direct 1-Tap Switching without dropdown interference) */}
          <div className="flex items-center justify-between gap-1 max-w-4xl mx-auto">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Nav App:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              {(['google', 'apple', 'waze'] as NavAppChoice[]).map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => handleSelectApp(app)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    preferredApp === app
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {app === 'google' ? 'Google' : app === 'apple' ? 'Apple' : 'Waze'}
                </button>
              ))}
            </div>
          </div>

          {/* THE 4 GIANT TOUCH IN-VEHICLE SHORTCUTS (MIN 60px TOUCH HEIGHT, REAL ANCHOR LINKS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 max-w-4xl mx-auto">
            {/* SHORTCUT 1: GIANT LAUNCH PREFERRED GPS (Direct Link with Native Mobile App Deep-linking) */}
            <a
              href={gpsUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!gpsUrl) {
                  e.preventDefault();
                  flashNotice('No destination coordinates');
                  return;
                }
                triggerHapticFeedback('tap');
                playInVehicleChime('action');
                flashNotice(`Opening ${getNavAppName(preferredApp)}`);
              }}
              role="button"
              className="h-16 sm:h-20 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-95 text-white shadow-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border border-blue-400/40 select-none text-decoration-none"
              title="Launch GPS Turn-by-Turn Navigation [G]"
            >
              <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                <Compass className="w-5 h-5 shrink-0" />
                <span>Launch GPS</span>
              </div>
              <span className="text-[10px] font-bold text-blue-100">
                {getNavAppName(preferredApp)} [G]
              </span>
            </a>

            {/* SHORTCUT 2: GIANT CALL PATIENT (Direct Tel Link for 100% Reliable Native Dialer) */}
            <a
              href={telUrl || '#'}
              onClick={handleCallPatient}
              role="button"
              className={`h-16 sm:h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 font-bold shadow-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border border-slate-700 select-none text-decoration-none ${
                nextDelivery.phone ? 'text-sky-300 hover:text-white' : 'opacity-60 text-slate-500'
              }`}
              title="Call Patient Directly [C]"
            >
              <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                <Phone className="w-5 h-5 text-sky-400 shrink-0" />
                <span>Call Patient</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px] px-1">
                {nextDelivery.phone || 'No Phone'} [C]
              </span>
            </a>

            {/* SHORTCUT 3: GIANT TEXT ETA (Direct SMS Link for 100% Reliable Native Messenger) */}
            <a
              href={smsUrl || '#'}
              onClick={handleQuickSms}
              role="button"
              className={`h-16 sm:h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 font-bold shadow-md transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border border-slate-700 select-none text-decoration-none ${
                nextDelivery.phone ? 'text-teal-300 hover:text-white' : 'opacity-60 text-slate-500'
              }`}
              title="Send Pre-filled Courier Arrival SMS [T]"
            >
              <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                <MessageSquare className="w-5 h-5 text-teal-400 shrink-0" />
                <span>Text ETA</span>
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[130px] px-1">
                Courier SMS [T]
              </span>
            </a>

            {/* SHORTCUT 4: GIANT MARK DELIVERED (Immediate Advance to Next Stop) */}
            <button
              type="button"
              onClick={handleMarkDelivered}
              className="h-16 sm:h-20 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-95 text-white shadow-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border border-emerald-400/40 select-none"
              title="Mark Stop Delivered & Advance to Next [SPACE]"
            >
              <div className="flex items-center gap-1.5 font-black text-sm sm:text-base">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Delivered</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-100">
                Advance Stop [Space]
              </span>
            </button>
          </div>

          {/* Secondary Controls Bar */}
          <div className="flex items-center justify-between gap-1.5 max-w-4xl mx-auto pt-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('tap');
                onOpenDirections();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <Navigation className="w-3.5 h-3.5 text-teal-400" />
              <span>Directions</span>
            </button>

            <button
              type="button"
              onClick={handleSpeakStatus}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <Volume2 className="w-3.5 h-3.5 text-teal-400" />
              <span>Speak Info</span>
            </button>

            {/* Driver Simulation Speed Toggles */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  triggerHapticFeedback('tap');
                  onToggleSimulation();
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5 ${
                  driver.isSimulating
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {driver.isSimulating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{driver.isSimulating ? 'Sim On' : 'Sim'}</span>
              </button>

              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('tap');
                    onSetSimSpeed(spd);
                  }}
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    driver.simSpeedMultiplier === spd
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Phone Config Dialog in Drive Mode */}
      {isEditingPhone && nextDelivery && (
        <div className="fixed inset-0 z-[2400] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-400" />
                <span>Configure Patient Phone</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              For Stop #{nextDelivery.sequence}: <strong className="text-white">{nextDelivery.patientName}</strong>
            </p>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  if (digits.length <= 3) setPhoneInput(digits ? `(${digits}` : '');
                  else if (digits.length <= 6) setPhoneInput(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
                  else setPhoneInput(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
                }}
                placeholder="(713) 555-0100"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-slate-950 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateDelivery) {
                    onUpdateDelivery({ ...nextDelivery, phone: phoneInput.trim() });
                  }
                  flashNotice(`Saved phone for ${nextDelivery.patientName}`);
                  setIsEditingPhone(false);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer active:scale-95"
              >
                Save Phone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
