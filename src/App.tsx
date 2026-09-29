import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Delivery,
  DeliveryStatus,
  DriverState,
  OptimizationMetrics,
  ZoneId,
  HubLocation,
  LocationPoint,
  FullRouteData,
  TripScheduleConfig,
  RatesConfig,
  ThemeMode,
  RouteLeg,
} from './types';
import { CENTRAL_HUB, INITIAL_DRIVER, getInitialDeliveries } from './data/mockData';
import {
  calculateZoneAccumulation,
  determineZoneAndPay,
  evaluateStopPay,
  calculateDistanceMiles,
  getCurrentDayOfWeek,
  loadSavedRatesConfig,
  saveSavedRatesConfig,
} from './utils/zonePay';
import { optimizeDeliverySequence, generateCurvedPath } from './utils/routeOptimizer';
import { fetchStreetRoute } from './utils/streetRouting';
import { parseAddressComponents } from './utils/geocoding';
import { MapComponent } from './components/MapComponent';
import { ZonePayCard } from './components/ZonePayCard';
import { DeliveryList } from './components/DeliveryList';
import { DriverHUD } from './components/DriverHUD';
import { RouteOptimizerBanner } from './components/RouteOptimizerBanner';
import { AddDeliveryModal } from './components/AddDeliveryModal';
import { AddressCameraScanner } from './components/AddressCameraScanner';
import { PayReceiptModal } from './components/PayReceiptModal';
import { StartingPointModal } from './components/StartingPointModal';
import { DirectionsModal } from './components/DirectionsModal';
import { DriverProfileModal } from './components/DriverProfileModal';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { RateEditorModal } from './components/RateEditorModal';
import { NavigationAppModal } from './components/NavigationAppModal';
import { ContactPatientModal } from './components/ContactPatientModal';
import { DriveModeModal } from './components/DriveModeModal';
import {
  getSavedRoundTripPreference,
  saveRoundTripPreference,
  launchPreferredNavApp,
} from './utils/navigationShortcuts';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { OfflineIndicator, OfflineBanner } from './components/OfflineIndicator';
import { loadSavedDriverProfile, saveDriverProfile } from './utils/driverStorage';
import {
  loadInitialDeliveriesState,
  saveDeliveries,
  loadDeliveriesFromIndexedDB,
  loadDeliveriesFromLocalStorage,
  isDemoDeliveryList,
} from './utils/deliveryStorage';
import { ScannedAddressResult } from './types';
import {
  Pill,
  MapPin,
  RefreshCw,
  FileText,
  Plus,
  ShieldAlert,
  HelpCircle,
  Truck,
  CheckCircle2,
  AlertTriangle,
  X,
  Camera,
  Settings,
  Sun,
  Moon,
  DollarSign,
  ListOrdered,
  Navigation,
  Phone,
  Compass,
  RotateCcw,
  MessageSquare,
  Car,
  Home,
} from 'lucide-react';

const HUB_STORAGE_KEY = 'medroute_saved_hub';
const THEME_STORAGE_KEY = 'medroute_theme_mode';

function loadInitialTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'night' || raw === 'day') {
      return raw;
    }
  } catch (err) {
    console.warn('Failed to parse saved theme:', err);
  }
  return 'day';
}

function loadInitialHub(): HubLocation {
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const safeLat = Number(parsed?.coordinates?.lat);
      const safeLng = Number(parsed?.coordinates?.lng);
      // Ensure it is valid and bypass any legacy Austin hub so Houston Hub is the default
      if (
        parsed &&
        !isNaN(safeLat) &&
        !isNaN(safeLng) &&
        isFinite(safeLat) &&
        isFinite(safeLng) &&
        parsed.name &&
        parsed.id !== 'hub-01' &&
        !parsed.address?.includes('Austin')
      ) {
        return {
          ...parsed,
          coordinates: { lat: safeLat, lng: safeLng },
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse saved hub:', err);
  }
  return CENTRAL_HUB;
}

export default function App() {
  const [hub, setHub] = useState<HubLocation>(() => loadInitialHub());
  const [ratesConfig, setRatesConfig] = useState<RatesConfig>(() => loadSavedRatesConfig());
  const [scheduleConfig, setScheduleConfig] = useState<TripScheduleConfig>({
    dayOfWeek: getCurrentDayOfWeek(),
    timeMode: 'auto_eta',
    customTime: '18:30',
  });
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => {
    return loadInitialDeliveriesState();
  });
  const [driver, setDriver] = useState<DriverState>(() => loadSavedDriverProfile());
  const [isDriverProfileModalOpen, setIsDriverProfileModalOpen] = useState<boolean>(false);
  const [isRateEditorModalOpen, setIsRateEditorModalOpen] = useState<boolean>(false);
  const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(() => {
    const saved = loadDeliveriesFromLocalStorage();
    if (saved && saved.length > 0 && !isDemoDeliveryList(saved)) {
      const pending = saved.find((d) => d.status !== 'delivered');
      return pending ? pending.id : saved[0].id;
    }
    return null;
  });
  const [zoneFilter, setZoneFilter] = useState<ZoneId | 'ALL'>('ALL');
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCameraScanModalOpen, setIsCameraScanModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isStartPointModalOpen, setIsStartPointModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
  const [isPickingStartLocation, setIsPickingStartLocation] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadInitialTheme());
  const networkStatus = useNetworkStatus();
  const [isOfflineBannerDismissed, setIsOfflineBannerDismissed] = useState<boolean>(false);

  // In-vehicle GPS navigation and patient contact shortcuts
  const [includeRoundTrip, setIncludeRoundTrip] = useState<boolean>(() =>
    getSavedRoundTripPreference()
  );
  const [returnLeg, setReturnLeg] = useState<RouteLeg | undefined>(undefined);
  const [navModalState, setNavModalState] = useState<{
    isOpen: boolean;
    destination: LocationPoint | null;
    name?: string;
    address?: string;
  }>({
    isOpen: false,
    destination: null,
  });
  const [contactModalState, setContactModalState] = useState<{
    isOpen: boolean;
    delivery: Delivery | null;
  }>({
    isOpen: false,
    delivery: null,
  });
  const [isDriveModeOpen, setIsDriveModeOpen] = useState<boolean>(false);

  const handleOpenNavigationApp = (
    destination: LocationPoint,
    name?: string,
    address?: string
  ) => {
    setNavModalState({
      isOpen: true,
      destination,
      name,
      address,
    });
  };

  const handleReturnToBase = () => {
    const returnCoords = driver.addressCoordinates || hub.coordinates;
    const returnName = driver.address ? `${driver.name}'s Base` : hub.name;
    const returnAddress = driver.address || hub.address;
    handleOpenNavigationApp(returnCoords, returnName, returnAddress);
  };

  const handleOpenContactPatient = (deliv: Delivery) => {
    setContactModalState({
      isOpen: true,
      delivery: deliv,
    });
  };

  // Persist deliveries state persistently to IndexedDB and localStorage whenever modified
  useEffect(() => {
    saveDeliveries(deliveries);
  }, [deliveries]);

  // Deep offline persistence recovery: verify IndexedDB on startup if localStorage was empty
  useEffect(() => {
    let isMounted = true;
    loadDeliveriesFromIndexedDB().then((idbDeliveries) => {
      if (!isMounted) return;
      if (idbDeliveries && idbDeliveries.length > 0 && deliveries.length === 0) {
        if (!isDemoDeliveryList(idbDeliveries)) {
          setDeliveries(idbDeliveries);
          const pending = idbDeliveries.find((d) => d.status !== 'delivered');
          setActiveDeliveryId(pending ? pending.id : idbDeliveries[0].id);
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Automatically show warning banner whenever connection drops to unstable or offline
  useEffect(() => {
    if (networkStatus.status !== 'online') {
      setIsOfflineBannerDismissed(false);
    }
  }, [networkStatus.status]);

  const [mobileTab, setMobileTab] = useState<'map' | 'stops' | 'pay'>('map');
  const [isDesktopView, setIsDesktopView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopView(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === 'day' ? 'night' : 'day'));
  };

  // Re-invalidate map size when mobile user switches back to Map tab
  useEffect(() => {
    if (mobileTab === 'map') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // Sync theme mode to localStorage and documentElement classes
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch (err) {
      console.warn('Failed to persist theme mode:', err);
    }
    if (themeMode === 'night') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'day');
    }
  }, [themeMode]);

  const [routeData, setRouteData] = useState<FullRouteData>({
    geometry: [],
    distanceMiles: 0,
    durationMinutes: 0,
    legs: [],
    isLoading: false,
  });
  const [isDirectionsModalOpen, setIsDirectionsModalOpen] = useState<boolean>(false);

  const [metrics, setMetrics] = useState<OptimizationMetrics>({
    originalDistanceMiles: 0,
    optimizedDistanceMiles: 0,
    milesSaved: 0,
    originalTimeMinutes: 0,
    optimizedTimeMinutes: 0,
    timeSavedMinutes: 0,
    fuelSavingsEstimated: 0,
  });

  // Calculate Zone Accumulation & Pay Summary in real-time
  const accumulation = useMemo(
    () => calculateZoneAccumulation(deliveries, ratesConfig),
    [deliveries, ratesConfig]
  );
  const { breakdown, totalPay, completedPay, totalMiles, totalDeliveries, completedDeliveries } =
    accumulation;

  // Save updated custom rates & surcharges, and recalculate all active deliveries immediately
  const handleSaveRates = (newRates: RatesConfig) => {
    setRatesConfig(newRates);
    saveSavedRatesConfig(newRates);
    setDeliveries((prev) =>
      prev.map((d) => {
        const timeRef =
          scheduleConfig.timeMode === 'custom_time'
            ? scheduleConfig.customTime
            : d.deliveredAt || d.eta || d.scheduledTimeWindow;
        const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
          d.distanceFromHubMiles,
          d.isStat,
          scheduleConfig,
          timeRef,
          newRates
        );
        return {
          ...d,
          zone,
          basePay,
          surcharge,
          surchargeReason,
          pay,
        };
      })
    );
    setGpsNotice('✓ Pay rates and zone rules updated successfully.');
  };

  // Handle shift schedule / day / time mode change
  const handleScheduleConfigChange = (newConfig: TripScheduleConfig) => {
    setScheduleConfig(newConfig);
    setDeliveries((prev) =>
      prev.map((d) => {
        const timeRef =
          newConfig.timeMode === 'custom_time'
            ? newConfig.customTime
            : d.deliveredAt || d.eta || d.scheduledTimeWindow;
        const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
          d.distanceFromHubMiles,
          d.isStat,
          newConfig,
          timeRef,
          ratesConfig
        );
        return {
          ...d,
          zone,
          basePay,
          surcharge,
          surchargeReason,
          pay,
        };
      })
    );
  };

  // Find next pending delivery
  const nextPendingDelivery = useMemo(() => {
    return deliveries.find((d) => d.status !== 'delivered') || null;
  }, [deliveries]);

  // Global In-Vehicle Driver Shortcuts (M = Car Mode, G = GPS, C = Call, D = Directions, H = Return to Base)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsDriveModeOpen((prev) => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        if (!isDriveModeOpen) {
          e.preventDefault();
          if (nextPendingDelivery) {
            handleOpenNavigationApp(
              nextPendingDelivery.coordinates,
              nextPendingDelivery.patientName,
              nextPendingDelivery.address
            );
          } else {
            handleReturnToBase();
          }
        }
      } else if (e.key === 'c' || e.key === 'C') {
        if (!isDriveModeOpen && nextPendingDelivery) {
          e.preventDefault();
          handleOpenContactPatient(nextPendingDelivery);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (!isDriveModeOpen) {
          e.preventDefault();
          setIsDirectionsModalOpen((prev) => !prev);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        if (!isDriveModeOpen) {
          e.preventDefault();
          handleReturnToBase();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [nextPendingDelivery, isDriveModeOpen, driver, hub]);

  // Fetch real street routing & turn-by-turn directions whenever route or hub updates
  useEffect(() => {
    const pendingStops = deliveries
      .filter((d) => d.status !== 'delivered')
      .map((d) => ({
        id: d.id,
        name: d.patientName,
        address: `${d.address}, ${d.city}`,
        coordinates: d.coordinates,
      }));

    if (pendingStops.length === 0) {
      setRouteData({
        geometry: [],
        distanceMiles: 0,
        durationMinutes: 0,
        legs: [],
        isLoading: false,
      });
      return;
    }

    let isMounted = true;
    setRouteData((prev) => ({ ...prev, isLoading: true }));

    fetchStreetRoute(hub.coordinates, hub.name, pendingStops)
      .then((data) => {
        if (!isMounted) return;
        setRouteData({ ...data, isLoading: false });

        if (data.distanceMiles > 0) {
          setMetrics((prev) => ({
            ...prev,
            optimizedDistanceMiles: data.distanceMiles,
            optimizedTimeMinutes: data.durationMinutes,
            originalDistanceMiles: Math.round(data.distanceMiles * 1.25 * 10) / 10,
            milesSaved: Math.max(0, Math.round(data.distanceMiles * 0.25 * 10) / 10),
            originalTimeMinutes: Math.round(data.durationMinutes * 1.25),
            timeSavedMinutes: Math.max(0, Math.round(data.durationMinutes * 0.25)),
          }));
        }
      })
      .catch((err) => {
        console.warn('Street routing error:', err);
        if (isMounted) {
          setRouteData((prev) => ({ ...prev, isLoading: false }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hub, deliveries]);

  // Derive active leg and upcoming maneuver for driver HUD
  const activeLeg = useMemo(() => {
    if (!routeData.legs || routeData.legs.length === 0) return null;
    if (nextPendingDelivery) {
      return (
        routeData.legs.find((l) => l.targetDeliveryId === nextPendingDelivery.id) ||
        routeData.legs[0]
      );
    }
    return routeData.legs[0];
  }, [routeData.legs, nextPendingDelivery]);

  const upcomingManeuver = useMemo(() => {
    if (!activeLeg || !activeLeg.steps || activeLeg.steps.length === 0) return undefined;
    const step = activeLeg.steps[0];
    return `${step.instruction}${step.distanceMiles > 0 ? ` (${step.distanceMiles} mi)` : ''}`;
  }, [activeLeg]);

  // Initial optimization on mount to calculate ETAs accurately if deliveries exist
  useEffect(() => {
    if (deliveries.length === 0) return;
    const { optimizedDeliveries, metrics: optMetrics } = optimizeDeliverySequence(
      hub,
      driver.currentLocation,
      deliveries
    );
    setDeliveries(optimizedDeliveries);
    setMetrics(optMetrics);
    setIsOptimized(true);
    if (optimizedDeliveries.length > 0) {
      setActiveDeliveryId(optimizedDeliveries[0].id);
    }
  }, []);

  // Update starting point / dispatch hub
  const handleUpdateStartingPoint = (newHub: HubLocation, relocateDriver: boolean = true) => {
    setHub(newHub);
    try {
      localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(newHub));
    } catch (e) {
      console.warn('Failed to save hub to localStorage:', e);
    }

    // Recalculate distance from new hub, zone, and pay for all deliveries
    const updatedDeliveries = deliveries.map((d) => {
      const newDist = calculateDistanceMiles(newHub.coordinates, d.coordinates);
      const timeRef =
        scheduleConfig.timeMode === 'custom_time'
          ? scheduleConfig.customTime
          : d.deliveredAt || d.eta || d.scheduledTimeWindow;
      const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
        newDist,
        d.isStat,
        scheduleConfig,
        timeRef,
        ratesConfig
      );
      return {
        ...d,
        distanceFromHubMiles: newDist,
        zone,
        basePay,
        surcharge,
        surchargeReason,
        pay,
      };
    });

    const newDriverLoc = relocateDriver ? newHub.coordinates : driver.currentLocation;

    if (relocateDriver) {
      setDriver((prev) => ({
        ...prev,
        currentLocation: newHub.coordinates,
        isSimulating: false,
        speedMph: 0,
      }));
    }

    const { optimizedDeliveries, metrics: newMetrics } = optimizeDeliverySequence(
      newHub,
      newDriverLoc,
      updatedDeliveries
    );

    setDeliveries(optimizedDeliveries);
    setMetrics(newMetrics);
    setIsOptimized(true);
    setGpsNotice(`Starting point set to "${newHub.name}". Distance zones & routing updated.`);
  };

  // Handle clicking directly on map to set starting point
  const handleMapClick = (coords: LocationPoint) => {
    if (!isPickingStartLocation) return;
    setIsPickingStartLocation(false);

    const newHub: HubLocation = {
      id: `hub-${Date.now()}`,
      name: `Custom Hub (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`,
      address: `Selected Point (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
      coordinates: coords,
    };

    handleUpdateStartingPoint(newHub, true);
  };

  // Handle toggling round trip mode
  const handleToggleRoundTrip = () => {
    const next = !includeRoundTrip;
    setIncludeRoundTrip(next);
    saveRoundTripPreference(next);
    if (deliveries.length > 0) {
      const { optimizedDeliveries, metrics: newMetrics, returnLeg: newReturnLeg } =
        optimizeDeliverySequence(hub, driver.currentLocation, deliveries, {
          includeRoundTrip: next,
          returnTargetCoords: driver.addressCoordinates || hub.coordinates,
          returnTargetName: driver.address ? `${driver.name}'s Base` : hub.name,
        });
      setDeliveries(optimizedDeliveries);
      setMetrics(newMetrics);
      setReturnLeg(newReturnLeg);
    }
    setGpsNotice(
      next
        ? '✓ Round-trip enabled: Return trip to hub included in total mileage'
        : '✓ Round-trip disabled: One-way delivery route calculated'
    );
  };

  // Trigger manual optimization
  const handleOptimizeRoute = () => {
    if (deliveries.length === 0) {
      setGpsNotice('No delivery stops on route yet. Click + Add Stop to add destinations.');
      return;
    }
    const { optimizedDeliveries, metrics: newMetrics, returnLeg: newReturnLeg } =
      optimizeDeliverySequence(hub, driver.currentLocation, deliveries, {
        includeRoundTrip,
        returnTargetCoords: driver.addressCoordinates || hub.coordinates,
        returnTargetName: driver.address ? `${driver.name}'s Base` : hub.name,
      });
    setDeliveries(optimizedDeliveries);
    setMetrics(newMetrics);
    setReturnLeg(newReturnLeg);
    setIsOptimized(true);

    const firstActive = optimizedDeliveries.find((d) => d.status !== 'delivered');
    if (firstActive) {
      setActiveDeliveryId(firstActive.id);
    }
  };

  // Real-time Vehicle Drive Simulation Loop
  const simulationStepRef = useRef<number>(0);
  const simPathRef = useRef<{ lat: number; lng: number }[]>([]);

  useEffect(() => {
    if (!driver.isSimulating || !nextPendingDelivery) return;

    // Build path along real streets if available, otherwise curved roadway
    if (routeData.geometry && routeData.geometry.length > 10) {
      const validPoints = routeData.geometry.filter(
        (p) =>
          p &&
          typeof p.lat === 'number' &&
          !isNaN(p.lat) &&
          isFinite(p.lat) &&
          typeof p.lng === 'number' &&
          !isNaN(p.lng) &&
          isFinite(p.lng)
      );

      if (validPoints.length > 10) {
        const targetCount = 35;
        const sampled: LocationPoint[] = [];
        const step = (validPoints.length - 1) / (targetCount - 1);
        for (let i = 0; i < targetCount; i++) {
          const idx = Math.min(validPoints.length - 1, Math.round(i * step));
          if (validPoints[idx]) {
            sampled.push(validPoints[idx]);
          }
        }
        simPathRef.current = sampled;
      } else {
        simPathRef.current = generateCurvedPath(
          driver.currentLocation,
          nextPendingDelivery.coordinates,
          30
        );
      }
    } else {
      simPathRef.current = generateCurvedPath(
        driver.currentLocation,
        nextPendingDelivery.coordinates,
        30
      );
    }
    simulationStepRef.current = 0;

    const intervalMs = Math.max(120, Math.floor(400 / driver.simSpeedMultiplier));

    const timer = setInterval(() => {
      simulationStepRef.current += 1;
      const path = simPathRef.current;

      if (simulationStepRef.current < path.length) {
        const nextCoord = path[simulationStepRef.current];
        const prevCoord = path[simulationStepRef.current - 1];

        if (
          !nextCoord ||
          isNaN(nextCoord.lat) ||
          isNaN(nextCoord.lng) ||
          !isFinite(nextCoord.lat) ||
          !isFinite(nextCoord.lng) ||
          !prevCoord ||
          isNaN(prevCoord.lat) ||
          isNaN(prevCoord.lng)
        ) {
          return;
        }

        // Calculate heading in degrees
        const dLng = nextCoord.lng - prevCoord.lng;
        const dLat = nextCoord.lat - prevCoord.lat;
        const headingDeg = (Math.atan2(dLng, dLat) * 180) / Math.PI;

        setDriver((prev) => ({
          ...prev,
          currentLocation: nextCoord,
          heading: Math.round(headingDeg),
          speedMph: 28 + Math.floor(Math.random() * 8),
          activeDeliveryId: nextPendingDelivery.id,
        }));
      } else {
        // Driver reached destination stop!
        clearInterval(timer);

        // Mark as arrived
        setDeliveries((prev) =>
          prev.map((d) =>
            d.id === nextPendingDelivery.id
              ? {
                  ...d,
                  status: 'delivered',
                  deliveredAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }
              : d
          )
        );

        setDriver((prev) => ({
          ...prev,
          isSimulating: false,
          speedMph: 0,
        }));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [driver.isSimulating, driver.simSpeedMultiplier, nextPendingDelivery, routeData.geometry]);

  // Real Device Hardware GPS watcher
  useEffect(() => {
    if (!driver.useDeviceGps) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsNotice('Device GPS is not supported by your browser environment. Using simulation mode.');
      setDriver((d) => ({ ...d, useDeviceGps: false }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        if (
          typeof rawLat !== 'number' ||
          isNaN(rawLat) ||
          !isFinite(rawLat) ||
          typeof rawLng !== 'number' ||
          isNaN(rawLng) ||
          !isFinite(rawLng)
        ) {
          return;
        }

        const coords = {
          lat: rawLat,
          lng: rawLng,
        };
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 2.23694) : 25; // m/s to mph

        setDriver((d) => ({
          ...d,
          currentLocation: coords,
          speedMph: speed,
        }));
      },
      (err) => {
        console.warn('Geolocation access note:', err.message);
        setGpsNotice(`GPS Signal: ${err.message}. Switched back to Route Simulator.`);
        setDriver((d) => ({ ...d, useDeviceGps: false }));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driver.useDeviceGps]);

  // Delivery status toggle handler
  const handleStatusChange = (id: string, newStatus: DeliveryStatus) => {
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: newStatus,
              deliveredAt:
                newStatus === 'delivered'
                  ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : undefined,
            }
          : d
      )
    );
  };

  // Add new deliveries (single or multiple)
  const handleAddDeliveries = (newDeliveries: Delivery[]) => {
    if (newDeliveries.length === 0) return;
    setDeliveries((prev) => {
      const updated = [...prev, ...newDeliveries];
      // Automatically run optimization with the new stops
      const { optimizedDeliveries, metrics: newMetrics } = optimizeDeliverySequence(
        hub,
        driver.currentLocation,
        updated
      );
      setMetrics(newMetrics);
      return optimizedDeliveries;
    });
    setActiveDeliveryId(newDeliveries[0].id);
    setGpsNotice(
      `Added ${newDeliveries.length} new destination stop${newDeliveries.length > 1 ? 's' : ''}. Route sequence & zones updated.`
    );
  };

  const handleAddDelivery = (newDelivery: Delivery) => {
    handleAddDeliveries([newDelivery]);
  };

  // Add delivery directly from phone camera scan
  const handleScanAddDelivery = (scanned: ScannedAddressResult) => {
    const miles = scanned.miles || 8.0;
    const stopNumber = deliveries.length + 1;
    const { zone, basePay, surcharge, surchargeReason, pay } = evaluateStopPay(
      miles,
      Boolean(scanned.isStat),
      scheduleConfig,
      undefined,
      ratesConfig
    );

    const parsed = parseAddressComponents(scanned.address);
    const guessedCity = scanned.city || parsed.city || 'Spring';
    const guessedZip = scanned.zip || parsed.zip || '77388';

    const newDelivery: Delivery = {
      id: `del-scan-${Date.now()}`,
      rxNumber: scanned.rxNumber || `RX-${Math.floor(10000 + Math.random() * 90000)}`,
      patientName:
        scanned.patientName || `Stop #${stopNumber} (${scanned.address.split(',')[0].trim()})`,
      phone: '(512) 555-0100',
      address: scanned.address,
      city: guessedCity,
      zip: guessedZip,
      coordinates: scanned.coordinates || {
        lat: hub.coordinates.lat + 0.04,
        lng: hub.coordinates.lng + 0.04,
      },
      distanceFromHubMiles: miles,
      isStat: Boolean(scanned.isStat),
      zone,
      basePay,
      surcharge,
      surchargeReason,
      pay,
      medicationName:
        scanned.medicationName ||
        (scanned.isStat ? 'STAT Urgent Medication' : 'Prescription Delivery'),
      category: scanned.isStat ? 'STAT Urgent' : 'Standard',
      tempControlled: false,
      signatureRequired: true,
      specialInstructions: scanned.notes,
      status: 'pending',
      scheduledTimeWindow: scanned.isStat ? 'ASAP / STAT Urgent' : 'Today, Standard Dispatch',
      sequence: stopNumber,
    };

    handleAddDeliveries([newDelivery]);
    setGpsNotice(`✓ Scanned & Added: ${newDelivery.patientName} at ${newDelivery.address}`);
  };

  // Delete a single delivery location/stop
  const handleDeleteDelivery = (id: string) => {
    const toRemove = deliveries.find((d) => d.id === id);
    const updated = deliveries.filter((d) => d.id !== id);

    if (updated.length === 0) {
      setDeliveries([]);
      setActiveDeliveryId(null);
      setMetrics({
        originalDistanceMiles: 0,
        optimizedDistanceMiles: 0,
        milesSaved: 0,
        originalTimeMinutes: 0,
        optimizedTimeMinutes: 0,
        timeSavedMinutes: 0,
        fuelSavingsEstimated: 0,
      });
      setGpsNotice(
        toRemove
          ? `Removed destination "${toRemove.address}". Route is now empty.`
          : 'Destination stop removed.'
      );
      return;
    }

    // Re-run optimization sequence on the remaining stops
    const { optimizedDeliveries, metrics: newMetrics } = optimizeDeliverySequence(
      hub,
      driver.currentLocation,
      updated
    );
    setDeliveries(optimizedDeliveries);
    setMetrics(newMetrics);

    // If the active stop was deleted, switch focus to the next pending stop
    if (activeDeliveryId === id) {
      const nextPending = optimizedDeliveries.find((d) => d.status !== 'delivered');
      setActiveDeliveryId(nextPending ? nextPending.id : optimizedDeliveries[0]?.id || null);
    }

    setGpsNotice(
      `Removed destination "${toRemove?.address || 'Stop'}". Route and sequence recalculated.`
    );
  };

  // Clear all delivery locations from the route
  const handleClearAllDeliveries = () => {
    if (deliveries.length === 0) return;
    setDeliveries([]);
    setActiveDeliveryId(null);
    setMetrics({
      originalDistanceMiles: 0,
      optimizedDistanceMiles: 0,
      milesSaved: 0,
      originalTimeMinutes: 0,
      optimizedTimeMinutes: 0,
      timeSavedMinutes: 0,
      fuelSavingsEstimated: 0,
    });
    setGpsNotice('All route destinations have been removed. Add new delivery locations anytime.');
  };

  // Save updated driver profile and photo
  const handleSaveDriverProfile = (updated: DriverState) => {
    setDriver(updated);
    saveDriverProfile(updated);
    setGpsNotice(`✓ Driver profile & device photo saved for ${updated.name}`);
  };

  // Reset route to blank
  const handleReset = () => {
    setDeliveries([]);
    saveDeliveries([]);
    setActiveDeliveryId(null);
    setMetrics({
      originalDistanceMiles: 0,
      optimizedDistanceMiles: 0,
      milesSaved: 0,
      originalTimeMinutes: 0,
      optimizedTimeMinutes: 0,
      timeSavedMinutes: 0,
      fuelSavingsEstimated: 0,
    });
    setIsOptimized(false);
    const savedDriver = loadSavedDriverProfile();
    setDriver({
      ...savedDriver,
      currentLocation: hub.coordinates,
      isSimulating: false,
    });
    setGpsNotice('Route cleared to blank. Ready to add destinations.');
  };

  // Restore default demo Houston route
  const handleResetToDemo = () => {
    const demoStops = getInitialDeliveries(scheduleConfig).map((d) => {
      const distMiles = calculateDistanceMiles(hub.coordinates, d.coordinates);
      const evaluated = evaluateStopPay(
        distMiles,
        d.isStat,
        scheduleConfig,
        d.scheduledTimeWindow,
        ratesConfig
      );
      return {
        ...d,
        distanceFromHubMiles: distMiles,
        zone: evaluated.zone,
        basePay: evaluated.basePay,
        surcharge: evaluated.surcharge,
        surchargeReason: evaluated.surchargeReason,
        pay: evaluated.pay,
      };
    });
    setDeliveries(demoStops);
    saveDeliveries(demoStops);
    setDriver((d) => ({
      ...d,
      currentLocation: { ...hub.coordinates },
      heading: 0,
      isSimulating: false,
    }));
    setActiveDeliveryId(demoStops[0]?.id || null);
    setGpsNotice('Houston demo route restored (8 deliveries active).');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Starting Depot Link */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-white/20 shrink-0 bg-slate-800">
              <img
                src="/app-icon.png"
                alt="MedRoute"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white leading-tight">
                  MedRoute
                </h1>
                <span className="hidden sm:inline text-xs text-slate-500">·</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="hidden md:inline-flex items-center gap-1 text-xs text-slate-300 hover:text-teal-300 transition-colors font-medium truncate max-w-[200px]"
                  title="Click to view or change starting hub in Settings"
                >
                  <MapPin className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="truncate">{hub.name}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Clean, Intentional Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Offline Mode Indicator (appears when internet is unstable or offline) */}
            <OfflineIndicator network={networkStatus} />

            {/* Day / Night Mode Quick Toggle */}
            <button
              type="button"
              id="header-day-night-toggle"
              onClick={handleToggleTheme}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-teal-500/50 transition-all shadow-xs active:scale-95 cursor-pointer min-h-[36px]"
              title={themeMode === 'night' ? 'Switch to Day Mode (CartoDB Voyager)' : 'Switch to Night Mode (CartoDB Dark Matter)'}
              aria-label="Day/Night Mode Toggle"
            >
              {themeMode === 'night' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline font-medium">Day Mode</span>
                  <span className="sm:hidden text-[11px] font-medium">Day</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                  <span className="hidden sm:inline font-medium">Night Mode</span>
                  <span className="sm:hidden text-[11px] font-medium">Night</span>
                </>
              )}
            </button>

            {/* In-Vehicle Car Mode Button */}
            <button
              type="button"
              id="header-car-mode-btn"
              onClick={() => setIsDriveModeOpen(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border border-teal-400/40 transition-all shadow-xs active:scale-95 cursor-pointer min-h-[36px]"
              title="Launch In-Vehicle Drive Mode Cockpit & Shortcuts [M]"
            >
              <Car className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Car Mode</span>
              <span className="sm:hidden text-[11px]">Drive</span>
            </button>

            {/* Scan Camera */}
            <button
              onClick={() => setIsCameraScanModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 hover:border-teal-500/60 transition-all shadow-xs min-h-[36px]"
              title="Scan address from phone camera or prescription label"
            >
              <Camera className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Scan Label</span>
              <span className="sm:hidden text-[11px]">Scan</span>
            </button>

            {/* Primary Action: Add Delivery */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all shadow-md active:scale-95 min-h-[36px]"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span className="hidden xs:inline">Add Stop</span>
              <span className="xs:hidden text-[11px]">Add</span>
            </button>

            {/* Settings Button */}
            <button
              type="button"
              id="header-settings-btn"
              onClick={() => {
                setSettingsInitialTab('general');
                setIsSettingsModalOpen(true);
              }}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-teal-500/50 transition-all shadow-xs active:scale-95 min-h-[36px]"
              title="Open Settings, Shift Settlement & Preferences"
            >
              <Settings className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>

        {/* Offline Alert Banner (drops down under header when connection is unstable) */}
        <OfflineBanner
          network={networkStatus}
          isDismissed={isOfflineBannerDismissed}
          onDismiss={() => setIsOfflineBannerDismissed(true)}
        />
      </header>

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 pb-20 lg:pb-6">
        {gpsNotice && (
          <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-medium shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{gpsNotice}</span>
            </div>
            <button
              onClick={() => setGpsNotice(null)}
              className="p-1 hover:bg-amber-100 rounded text-amber-700 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Mobile View Switcher Top Bar (Shown only on small/medium screens < lg) */}
        <div className="lg:hidden flex items-center bg-slate-200 dark:bg-slate-850 p-1 rounded-xl gap-1 text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileTab('map')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all min-h-[38px] active:scale-95 ${
              mobileTab === 'map'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            <span>Map (Live)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('stops')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all min-h-[38px] active:scale-95 ${
              mobileTab === 'stops'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 text-teal-400" />
            <span>Stops ({deliveries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('pay')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all min-h-[38px] active:scale-95 ${
              mobileTab === 'pay'
                ? 'bg-slate-900 dark:bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pay (${accumulation.totalPay.toFixed(0)})</span>
          </button>
        </div>

        {/* Real-time Driver HUD Bar */}
        <div className={mobileTab === 'map' || mobileTab === 'stops' ? 'block' : 'hidden lg:block'}>
          <DriverHUD
            driver={driver}
            nextDelivery={nextPendingDelivery}
            completedCount={completedDeliveries}
            totalCount={totalDeliveries}
            onToggleSimulation={() =>
              setDriver((d) => ({ ...d, isSimulating: !d.isSimulating }))
            }
            onSetSimSpeed={(spd) => setDriver((d) => ({ ...d, simSpeedMultiplier: spd }))}
            onToggleDeviceGps={() =>
              setDriver((d) => ({ ...d, useDeviceGps: !d.useDeviceGps }))
            }
            onDeliverActive={() => {
              if (nextPendingDelivery) {
                handleStatusChange(nextPendingDelivery.id, 'delivered');
              }
            }}
            onOpenDirections={() => setIsDirectionsModalOpen(true)}
            onOpenNavigationApp={handleOpenNavigationApp}
            onOpenContactPatient={handleOpenContactPatient}
            upcomingManeuver={upcomingManeuver}
            onOpenEditProfile={() => setIsDriverProfileModalOpen(true)}
            onOpenDriveMode={() => setIsDriveModeOpen(true)}
            onReturnToBase={handleReturnToBase}
          />
        </div>

        {/* Route Optimization & Scheduling Metrics Banner (Visible on Stops/Pay tabs or desktop) */}
        <div className={mobileTab !== 'map' ? 'block' : 'hidden lg:block'}>
          <RouteOptimizerBanner
            metrics={metrics}
            isOptimized={isOptimized}
            onOptimizeRoute={handleOptimizeRoute}
            onOpenDirections={() => setIsDirectionsModalOpen(true)}
            onOpenNavigationApp={() => {
              if (nextPendingDelivery) {
                handleOpenNavigationApp(
                  nextPendingDelivery.coordinates,
                  nextPendingDelivery.patientName,
                  nextPendingDelivery.address
                );
              } else if (hub) {
                handleOpenNavigationApp(hub.coordinates, hub.name, hub.address);
              }
            }}
            hubName={hub.name}
            onEditHub={() => setIsStartPointModalOpen(true)}
            includeRoundTrip={includeRoundTrip}
            onToggleRoundTrip={handleToggleRoundTrip}
            roundTripTargetName={driver.address ? `${driver.name}'s Base` : hub.name}
          />
        </div>

        {/* MOBILE VIEWPORT RENDERING (< lg) */}
        <div className="lg:hidden space-y-4">
          {/* Mobile Tab 1: Live Interactive Map with Docked Next Stop Card */}
          {!isDesktopView && mobileTab === 'map' && (
            <div className="relative h-[calc(100dvh-280px)] min-h-[460px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <MapComponent
                hub={hub}
                driver={driver}
                deliveries={deliveries}
                activeDeliveryId={activeDeliveryId}
                routeGeometry={routeData.geometry}
                onSelectDelivery={(id) => setActiveDeliveryId(id)}
                onDeliverStop={(id) => handleStatusChange(id, 'delivered')}
                onDeleteDelivery={handleDeleteDelivery}
                onOpenDirections={() => setIsDirectionsModalOpen(true)}
                onOpenDirectionsForStop={(id) => {
                  setActiveDeliveryId(id);
                  setIsDirectionsModalOpen(true);
                }}
                isPickingStartLocation={isPickingStartLocation}
                onMapClick={handleMapClick}
                onCancelMapPick={() => setIsPickingStartLocation(false)}
                onOpenStartingPointModal={() => setIsStartPointModalOpen(true)}
                ratesConfig={ratesConfig}
                themeMode={themeMode}
                onToggleTheme={handleToggleTheme}
                onOpenNavigationApp={handleOpenNavigationApp}
                onOpenContactPatient={handleOpenContactPatient}
              />

              {/* Mobile Docked Next Delivery Quick Action Card */}
              {nextPendingDelivery ? (
                <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-teal-500 text-slate-950">
                        Stop #{nextPendingDelivery.sequence}
                      </span>
                      {nextPendingDelivery.isStat && (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-600 text-white animate-pulse">
                          STAT
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                        {nextPendingDelivery.zone} (${nextPendingDelivery.pay.toFixed(2)})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase tracking-wider">ETA</span>
                      <span className="text-xs font-bold text-teal-300">
                        {nextPendingDelivery.eta || 'Calculating...'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <h4 className="font-bold text-white text-sm truncate">{nextPendingDelivery.patientName}</h4>
                    <p className="text-xs text-slate-300 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{nextPendingDelivery.address}, {nextPendingDelivery.city}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      Rx: {nextPendingDelivery.medicationName} ({nextPendingDelivery.distanceFromHubMiles} mi from hub)
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Enter Fullscreen Car Drive Mode */}
                    <button
                      type="button"
                      onClick={() => setIsDriveModeOpen(true)}
                      className="px-2.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 min-h-[40px] active:scale-95 cursor-pointer shadow-sm border border-teal-400/30"
                      title="Open Fullscreen In-Vehicle Drive Mode Cockpit"
                    >
                      <Car className="w-4 h-4" />
                      <span>Drive</span>
                    </button>

                    {/* GPS Navigation Shortcut */}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenNavigationApp(
                          nextPendingDelivery.coordinates,
                          nextPendingDelivery.patientName,
                          nextPendingDelivery.address
                        )
                      }
                      className="px-2.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 min-h-[40px] active:scale-95 cursor-pointer shadow-xs"
                      title="Open GPS Turn-by-Turn Navigation (Google Maps, Apple Maps, Waze)"
                    >
                      <Compass className="w-4 h-4" />
                      <span>GPS</span>
                    </button>

                    {/* Patient Contact Shortcut */}
                    <button
                      type="button"
                      onClick={() => handleOpenContactPatient(nextPendingDelivery)}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1 min-h-[40px] active:scale-95 cursor-pointer"
                      title="Call or SMS recipient with pharmacy delivery ETA"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Contact</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsDirectionsModalOpen(true)}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1 min-h-[40px] active:scale-95 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5 text-teal-400" />
                      <span className="hidden xs:inline">Steps</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(nextPendingDelivery.id, 'delivered')}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 min-h-[40px] shadow-lg shadow-emerald-900/40 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Delivered</span>
                    </button>
                  </div>
                </div>
              ) : totalDeliveries > 0 ? (
                <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-emerald-950/95 text-emerald-100 p-3 rounded-2xl shadow-2xl border border-emerald-800 backdrop-blur-md flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">All {completedDeliveries} Stops Delivered!</h4>
                      <p className="text-xs text-emerald-300">Total Shift Pay: <strong>${completedPay.toFixed(2)}</strong></p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsInitialTab('settlement');
                      setIsSettingsModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    Settlement
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Mobile Tab 2: Delivery Stops Queue */}
          {mobileTab === 'stops' && (
            <div>
              <DeliveryList
                deliveries={deliveries}
                activeDeliveryId={activeDeliveryId}
                onSelectDelivery={(id) => {
                  setActiveDeliveryId(id);
                  setMobileTab('map');
                }}
                onStatusChange={handleStatusChange}
                onDeleteDelivery={handleDeleteDelivery}
                onClearAllDeliveries={handleClearAllDeliveries}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenDirections={(deliveryId) => {
                  if (deliveryId) setActiveDeliveryId(deliveryId);
                  setIsDirectionsModalOpen(true);
                }}
                onOpenNavigationApp={handleOpenNavigationApp}
                onOpenContactPatient={handleOpenContactPatient}
                zoneFilter={zoneFilter}
                ratesConfig={ratesConfig}
                returnLeg={returnLeg}
                includeRoundTrip={includeRoundTrip}
              />
            </div>
          )}

          {/* Mobile Tab 3: Zone Pay & Surcharges Summary */}
          {mobileTab === 'pay' && (
            <div>
              <ZonePayCard
                summary={accumulation.breakdown}
                totalPay={accumulation.totalPay}
                completedPay={accumulation.completedPay}
                totalMiles={accumulation.totalMiles}
                totalDeliveries={accumulation.totalDeliveries}
                completedDeliveries={accumulation.completedDeliveries}
                basePayTotal={accumulation.basePayTotal}
                surchargesTotal={accumulation.surchargesTotal}
                eveningSurchargeCount={accumulation.eveningSurchargeCount}
                eveningSurchargeTotal={accumulation.eveningSurchargeTotal}
                weekendSurchargeCount={accumulation.weekendSurchargeCount}
                weekendSurchargeTotal={accumulation.weekendSurchargeTotal}
                scheduleConfig={scheduleConfig}
                onScheduleConfigChange={handleScheduleConfigChange}
                onFilterByZone={(zone) => setZoneFilter(zone)}
                activeFilter={zoneFilter}
                ratesConfig={ratesConfig}
                onOpenRateEditor={() => setIsRateEditorModalOpen(true)}
                onOpenShiftSettlement={() => {
                  setSettingsInitialTab('settlement');
                  setIsSettingsModalOpen(true);
                }}
              />
            </div>
          )}
        </div>

        {/* DESKTOP VIEWPORT RENDERING (>= lg) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Zone Breakdown & Pay Accumulator + Delivery Queue */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            {/* Zone Pay Rate Card (Exact recreation of user's rate sheet) */}
            <ZonePayCard
              summary={accumulation.breakdown}
              totalPay={accumulation.totalPay}
              completedPay={accumulation.completedPay}
              totalMiles={accumulation.totalMiles}
              totalDeliveries={accumulation.totalDeliveries}
              completedDeliveries={accumulation.completedDeliveries}
              basePayTotal={accumulation.basePayTotal}
              surchargesTotal={accumulation.surchargesTotal}
              eveningSurchargeCount={accumulation.eveningSurchargeCount}
              eveningSurchargeTotal={accumulation.eveningSurchargeTotal}
              weekendSurchargeCount={accumulation.weekendSurchargeCount}
              weekendSurchargeTotal={accumulation.weekendSurchargeTotal}
              scheduleConfig={scheduleConfig}
              onScheduleConfigChange={handleScheduleConfigChange}
              onFilterByZone={(zone) => setZoneFilter(zone)}
              activeFilter={zoneFilter}
              ratesConfig={ratesConfig}
              onOpenRateEditor={() => setIsRateEditorModalOpen(true)}
              onOpenShiftSettlement={() => {
                setSettingsInitialTab('settlement');
                setIsSettingsModalOpen(true);
              }}
            />

            {/* Scheduled Deliveries List with ETAs and Statuses */}
            <DeliveryList
              deliveries={deliveries}
              activeDeliveryId={activeDeliveryId}
              onSelectDelivery={(id) => setActiveDeliveryId(id)}
              onStatusChange={handleStatusChange}
              onDeleteDelivery={handleDeleteDelivery}
              onClearAllDeliveries={handleClearAllDeliveries}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenDirections={(deliveryId) => {
                if (deliveryId) setActiveDeliveryId(deliveryId);
                setIsDirectionsModalOpen(true);
              }}
              onOpenNavigationApp={handleOpenNavigationApp}
              onOpenContactPatient={handleOpenContactPatient}
              zoneFilter={zoneFilter}
              ratesConfig={ratesConfig}
              returnLeg={returnLeg}
              includeRoundTrip={includeRoundTrip}
            />
          </div>

          {/* Right Column: Live Tracking Map with Driver & Route Polylines */}
          {isDesktopView && (
            <div className="lg:col-span-7 h-[680px] lg:h-[860px] sticky top-20 flex flex-col">
              <MapComponent
                hub={hub}
                driver={driver}
                deliveries={deliveries}
                activeDeliveryId={activeDeliveryId}
                routeGeometry={routeData.geometry}
                onSelectDelivery={(id) => setActiveDeliveryId(id)}
                onDeliverStop={(id) => handleStatusChange(id, 'delivered')}
                onDeleteDelivery={handleDeleteDelivery}
                onOpenDirections={() => setIsDirectionsModalOpen(true)}
                onOpenDirectionsForStop={(id) => {
                  setActiveDeliveryId(id);
                  setIsDirectionsModalOpen(true);
                }}
                onOpenNavigationApp={handleOpenNavigationApp}
                onOpenContactPatient={handleOpenContactPatient}
                isPickingStartLocation={isPickingStartLocation}
                onMapClick={handleMapClick}
                onCancelMapPick={() => setIsPickingStartLocation(false)}
                onOpenStartingPointModal={() => setIsStartPointModalOpen(true)}
                ratesConfig={ratesConfig}
                themeMode={themeMode}
                onToggleTheme={handleToggleTheme}
              />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Hidden on desktop lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 pb-safe flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-all relative ${
            mobileTab === 'map' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MapPin className="w-5 h-5" />
            {driver.isSimulating && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <span>Map</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('stops')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-all relative ${
            mobileTab === 'stops' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ListOrdered className="w-5 h-5" />
            {deliveries.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-teal-500 text-slate-950 text-[10px] font-black leading-tight">
                {deliveries.filter((d) => d.status !== 'delivered').length || deliveries.length}
              </span>
            )}
          </div>
          <span>Stops</span>
        </button>

        {/* Quick Camera Scan Center Action Button */}
        <button
          type="button"
          onClick={() => setIsCameraScanModalOpen(true)}
          className="mx-1 px-3.5 py-2.5 -mt-6 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-bold shadow-lg shadow-teal-500/30 flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-2 border-slate-900"
          title="Scan Prescription or Address Label"
        >
          <Camera className="w-5 h-5 text-slate-950" />
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('pay')}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-all relative ${
            mobileTab === 'pay' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <DollarSign className="w-5 h-5" />
            <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold leading-tight">
              ${accumulation.totalPay.toFixed(0)}
            </span>
          </div>
          <span>Pay & Rates</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex-1 py-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-400 hover:text-teal-300 transition-all"
        >
          <Plus className="w-5 h-5 text-teal-400" />
          <span>+ Stop</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 px-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors mb-16 lg:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MedRoute Delivery Management & Zone Payroll System</span>
          <div className="flex items-center gap-3 sm:gap-4 text-[11px] flex-wrap justify-center">
            <span>Zone 1: ${ratesConfig.zones['Zone 1'].pay} (0-{ratesConfig.zones['Zone 1'].maxMiles}mi)</span>
            <span>Zone 2: ${ratesConfig.zones['Zone 2'].pay} ({ratesConfig.zones['Zone 2'].minMiles}-{ratesConfig.zones['Zone 2'].maxMiles}mi)</span>
            <span>Zone 3: ${ratesConfig.zones['Zone 3'].pay} ({ratesConfig.zones['Zone 3'].minMiles}-{ratesConfig.zones['Zone 3'].maxMiles}mi)</span>
            <span>Zone 4: ${ratesConfig.zones['Zone 4'].pay} ({ratesConfig.zones['Zone 4'].minMiles}-{ratesConfig.zones['Zone 4'].maxMiles}mi)</span>
            <span>Zone 5: ${ratesConfig.zones['Zone 5'].pay} ({ratesConfig.zones['Zone 5'].minMiles}+mi)</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">STAT: ${ratesConfig.zones['STAT'].pay}</span>
            <button
              type="button"
              onClick={() => setIsRateEditorModalOpen(true)}
              className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold underline underline-offset-2 ml-1"
            >
              Edit Rates
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DirectionsModal
        isOpen={isDirectionsModalOpen}
        onClose={() => setIsDirectionsModalOpen(false)}
        hub={hub}
        deliveries={deliveries}
        legs={routeData.legs}
        totalDistanceMiles={routeData.distanceMiles}
        totalDurationMinutes={routeData.durationMinutes}
        activeDeliveryId={activeDeliveryId}
        onSelectDelivery={(id) => setActiveDeliveryId(id)}
      />
      <StartingPointModal
        isOpen={isStartPointModalOpen}
        onClose={() => setIsStartPointModalOpen(false)}
        currentHub={hub}
        onSaveHub={handleUpdateStartingPoint}
        onStartMapPick={() => setIsPickingStartLocation(true)}
      />

      <AddDeliveryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddDelivery={handleAddDelivery}
        onAddDeliveries={handleAddDeliveries}
        hub={hub}
        currentStopsCount={deliveries.length}
        scheduleConfig={scheduleConfig}
        ratesConfig={ratesConfig}
      />

      <AddressCameraScanner
        isOpen={isCameraScanModalOpen}
        onClose={() => setIsCameraScanModalOpen(false)}
        onAddressScanned={handleScanAddDelivery}
        hub={hub}
        mode="modal"
      />

      <PayReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        driver={driver}
        hub={hub}
        deliveries={deliveries}
        summary={accumulation.breakdown}
        totalPay={accumulation.totalPay}
        completedPay={accumulation.completedPay}
        totalMiles={accumulation.totalMiles}
        basePayTotal={accumulation.basePayTotal}
        surchargesTotal={accumulation.surchargesTotal}
        eveningSurchargeCount={accumulation.eveningSurchargeCount}
        eveningSurchargeTotal={accumulation.eveningSurchargeTotal}
        weekendSurchargeCount={accumulation.weekendSurchargeCount}
        weekendSurchargeTotal={accumulation.weekendSurchargeTotal}
        scheduleConfig={scheduleConfig}
        ratesConfig={ratesConfig}
      />

      <DriverProfileModal
        isOpen={isDriverProfileModalOpen}
        onClose={() => setIsDriverProfileModalOpen(false)}
        driver={driver}
        onSaveDriver={handleSaveDriverProfile}
        onSetAsHub={(newHub) => handleUpdateStartingPoint(newHub, true)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        hub={hub}
        onSaveHub={handleUpdateStartingPoint}
        onOpenStartingPointModal={() => setIsStartPointModalOpen(true)}
        driver={driver}
        onOpenDriverProfileModal={() => setIsDriverProfileModalOpen(true)}
        onToggleDeviceGps={() => setDriver((d) => ({ ...d, useDeviceGps: !d.useDeviceGps }))}
        onSetSimSpeed={(spd) => setDriver((d) => ({ ...d, simSpeedMultiplier: spd }))}
        onResetToDemo={handleResetToDemo}
        onClearRoute={handleReset}
        deliveriesCount={deliveries.length}
        ratesConfig={ratesConfig}
        onSaveRates={handleSaveRates}
        initialTab={settingsInitialTab}
        deliveries={deliveries}
        totalPay={accumulation.totalPay}
        completedPay={accumulation.completedPay}
        totalMiles={accumulation.totalMiles}
        eveningSurchargeCount={accumulation.eveningSurchargeCount}
        eveningSurchargeTotal={accumulation.eveningSurchargeTotal}
        weekendSurchargeCount={accumulation.weekendSurchargeCount}
        weekendSurchargeTotal={accumulation.weekendSurchargeTotal}
        scheduleConfig={scheduleConfig}
        onOpenReceiptModal={() => setIsReceiptModalOpen(true)}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        networkStatus={networkStatus}
      />

      <RateEditorModal
        isOpen={isRateEditorModalOpen}
        onClose={() => setIsRateEditorModalOpen(false)}
        ratesConfig={ratesConfig}
        onSaveRates={handleSaveRates}
      />

      {/* In-Vehicle GPS & Navigation Shortcuts Modals */}
      <NavigationAppModal
        isOpen={navModalState.isOpen}
        onClose={() => setNavModalState((prev) => ({ ...prev, isOpen: false }))}
        destination={navModalState.destination}
        destinationName={navModalState.name}
        destinationAddress={navModalState.address}
        origin={driver.currentLocation}
      />

      <ContactPatientModal
        isOpen={contactModalState.isOpen}
        onClose={() => setContactModalState((prev) => ({ ...prev, isOpen: false }))}
        delivery={contactModalState.delivery}
        driverName={driver.name}
      />

      <DriveModeModal
        isOpen={isDriveModeOpen}
        onClose={() => setIsDriveModeOpen(false)}
        driver={driver}
        nextDelivery={nextPendingDelivery}
        deliveries={deliveries}
        hub={hub}
        legs={routeData.legs}
        upcomingManeuver={upcomingManeuver}
        onDeliverActive={() => {
          if (nextPendingDelivery) {
            handleStatusChange(nextPendingDelivery.id, 'delivered');
          }
        }}
        onOpenDirections={() => setIsDirectionsModalOpen(true)}
        onToggleSimulation={() =>
          setDriver((d) => ({ ...d, isSimulating: !d.isSimulating }))
        }
        onSetSimSpeed={(spd) => setDriver((d) => ({ ...d, simSpeedMultiplier: spd }))}
        onToggleDeviceGps={() =>
          setDriver((d) => ({ ...d, useDeviceGps: !d.useDeviceGps }))
        }
      />
    </div>
  );
}
