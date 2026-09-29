import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '../utils/leafletPatch';
import { Delivery, DriverState, HubLocation, LocationPoint, RatesConfig, ThemeMode } from '../types';
import { ZONE_RULES, getZoneRules } from '../utils/zonePay';
import { Layers, Crosshair, Navigation2, Navigation, Compass, ShieldAlert, Sparkles, MapPin, Sun, Moon } from 'lucide-react';

interface MapComponentProps {
  hub: HubLocation;
  driver: DriverState;
  deliveries: Delivery[];
  activeDeliveryId: string | null;
  routeGeometry?: LocationPoint[];
  onSelectDelivery: (id: string) => void;
  onDeliverStop?: (id: string) => void;
  onDeleteDelivery?: (id: string) => void;
  onOpenDirections?: () => void;
  onOpenDirectionsForStop?: (id: string) => void;
  onOpenNavigationApp?: (destination: LocationPoint, name?: string, address?: string) => void;
  onOpenContactPatient?: (delivery: Delivery) => void;
  isPickingStartLocation?: boolean;
  onMapClick?: (coords: LocationPoint) => void;
  onCancelMapPick?: () => void;
  onOpenStartingPointModal?: () => void;
  ratesConfig?: RatesConfig;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export const MapComponent: React.FC<MapComponentProps> = ({
  hub,
  driver,
  deliveries,
  activeDeliveryId,
  routeGeometry,
  onSelectDelivery,
  onDeliverStop,
  onDeleteDelivery,
  onOpenDirections,
  onOpenDirectionsForStop,
  onOpenNavigationApp,
  onOpenContactPatient,
  isPickingStartLocation = false,
  onMapClick,
  onCancelMapPick,
  onOpenStartingPointModal,
  ratesConfig,
  themeMode = 'day',
  onToggleTheme,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneRingsLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  const [showZoneRings, setShowZoneRings] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'light'>('light');

  const isNight = themeMode === 'night';

  const getTileConfig = () => {
    const cartoKey = import.meta.env.VITE_CARTO_API_KEY || 'cb1_42jw_1_5f988acab27d1480aa26036c';
    const keyParam = cartoKey ? `?key=${cartoKey}` : '';

    if (isNight) {
      return {
        url: `https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
      };
    }
    if (mapStyle === 'streets') {
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      };
    }
    return {
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${keyParam}`,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    };
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const hubLat = Number(hub?.coordinates?.lat);
    const hubLng = Number(hub?.coordinates?.lng);
    const validCenter: [number, number] = isValidLatLng(hubLat, hubLng)
      ? [hubLat, hubLng]
      : [29.7295, -95.5714];

    const map = L.map(mapContainerRef.current, {
      center: validCenter,
      zoom: 10,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const config = getTileConfig();
    const baseLayer = L.tileLayer(config.url, {
      maxZoom: 19,
      attribution: config.attribution,
    });
    baseLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const zoneRingsLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    zoneRingsLayerRef.current = zoneRingsLayer;
    mapInstanceRef.current = map;

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      try {
        resizeObserver.disconnect();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        markersLayerRef.current = null;
        zoneRingsLayerRef.current = null;
        driverMarkerRef.current = null;
        routePolylineRef.current = null;
      } catch (err) {
        console.warn('Map cleanup error:', err);
      }
    };
  }, []);

  // Update Tile Layer if style or themeMode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const config = getTileConfig();
    L.tileLayer(config.url, { maxZoom: 19, attribution: config.attribution }).addTo(map);
  }, [mapStyle, themeMode]);

  // Render Zone Distance Rings (0-15mi, 16-30mi, 31-40mi, 41-60mi)
  useEffect(() => {
    if (!zoneRingsLayerRef.current) return;
    const zoneGroup = zoneRingsLayerRef.current;
    zoneGroup.clearLayers();

    if (!showZoneRings) return;

    // Radius in meters: 1 mile = 1609.34 meters
    const z1Max = ratesConfig?.zones['Zone 1'].maxMiles ?? 15;
    const z2Max = ratesConfig?.zones['Zone 2'].maxMiles ?? 30;
    const z3Max = ratesConfig?.zones['Zone 3'].maxMiles ?? 40;
    const z4Max = ratesConfig?.zones['Zone 4'].maxMiles ?? 60;

    const z1Pay = ratesConfig?.zones['Zone 1'].pay ?? 7;
    const z2Pay = ratesConfig?.zones['Zone 2'].pay ?? 8;
    const z3Pay = ratesConfig?.zones['Zone 3'].pay ?? 9;
    const z4Pay = ratesConfig?.zones['Zone 4'].pay ?? 11;

    const rings = [
      { name: `Zone 1 (${z1Max} mi • $${z1Pay})`, radiusMeters: z1Max * 1609.34, color: '#10b981', fill: '#10b981', fillOpacity: 0.05 },
      { name: `Zone 2 (${z2Max} mi • $${z2Pay})`, radiusMeters: z2Max * 1609.34, color: '#3b82f6', fill: '#3b82f6', fillOpacity: 0.03 },
      { name: `Zone 3 (${z3Max} mi • $${z3Pay})`, radiusMeters: z3Max * 1609.34, color: '#8b5cf6', fill: '#8b5cf6', fillOpacity: 0.02 },
      { name: `Zone 4 (${z4Max} mi • $${z4Pay})`, radiusMeters: z4Max * 1609.34, color: '#f59e0b', fill: '#f59e0b', fillOpacity: 0.015 },
    ];

    const hubLat = Number(hub?.coordinates?.lat);
    const hubLng = Number(hub?.coordinates?.lng);
    if (!isValidLatLng(hubLat, hubLng)) return;

    rings.forEach((ring) => {
      const circle = L.circle([hubLat, hubLng], {
        radius: ring.radiusMeters,
        color: ring.color,
        weight: 1.5,
        dashArray: '4, 6',
        fillColor: ring.fill,
        fillOpacity: ring.fillOpacity,
      });

      circle.bindTooltip(ring.name, {
        permanent: false,
        direction: 'top',
        className: 'zone-tooltip bg-slate-900 text-white font-semibold text-xs px-2 py-1 rounded shadow',
      });

      circle.addTo(zoneGroup);
    });
  }, [showZoneRings, hub?.coordinates?.lat, hub?.coordinates?.lng]);

  // Update Markers, Route Polylines, and Hub
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    const hubLat = Number(hub?.coordinates?.lat);
    const hubLng = Number(hub?.coordinates?.lng);

    // 1. Hub Marker
    if (isValidLatLng(hubLat, hubLng)) {
      const hubIcon = L.divIcon({
        className: 'custom-hub-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-10 h-10 rounded-full bg-emerald-500/30 animate-ping"></div>
            <div class="relative z-10 w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-sm">
              Rx
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const hubMarker = L.marker([hubLat, hubLng], { icon: hubIcon });
      hubMarker.bindPopup(`
        <div class="p-1 min-w-[200px]">
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Dispatch Origin</span>
          <h4 class="font-bold text-slate-900 text-sm mt-1">${hub.name}</h4>
          <p class="text-xs text-slate-600">${hub.address}</p>
          <p class="text-[11px] text-slate-500 mt-1 font-medium">Zone radii (0-60+ mi) measured from this pharmacy hub.</p>
        </div>
      `);
      hubMarker.addTo(markersGroup);
    }

    const currentRules = getZoneRules(ratesConfig);

    // 2. Delivery Markers
    deliveries.forEach((d) => {
      if (!d.coordinates) return;
      const dLat = Number(d.coordinates.lat);
      const dLng = Number(d.coordinates.lng);
      if (!isValidLatLng(dLat, dLng)) return;

      const isDelivered = d.status === 'delivered';
      const isActive = activeDeliveryId === d.id;
      const rule = currentRules.find((r) => r.id === d.zone);

      let pinColor = rule?.color || '#3b82f6';
      if (isDelivered) pinColor = '#94a3b8';
      if (d.isStat) pinColor = '#e11d48';

      const deliveryIcon = L.divIcon({
        className: 'custom-delivery-pin',
        html: `
          <div class="relative flex flex-col items-center group cursor-pointer transition-transform ${
            isActive ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }">
            ${
              d.isStat && !isDelivered
                ? `<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping"></div>`
                : ''
            }
            <div class="px-2 py-1 rounded-full shadow-md text-white font-bold text-xs flex items-center gap-1 border-2 ${
              isActive ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white'
            }" style="background-color: ${pinColor}">
              <span>#${d.sequence}</span>
              ${d.isStat ? '<span class="text-[9px]">STAT</span>' : ''}
              ${isDelivered ? '<span>✓</span>' : ''}
            </div>
            <div class="w-2 h-2 rotate-45 -mt-1 shadow" style="background-color: ${pinColor}"></div>
          </div>
        `,
        iconSize: [42, 34],
        iconAnchor: [21, 32],
      });

      const marker = L.marker([dLat, dLng], { icon: deliveryIcon });

      const popupContent = `
        <div class="p-2 min-w-[220px]">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded text-white" style="background-color: ${pinColor}">
              Stop #${d.sequence} • ${d.zone}
            </span>
            <span class="text-xs font-bold text-emerald-600">$${d.pay.toFixed(2)}</span>
          </div>

          <h4 class="font-bold text-slate-900 text-sm">${d.patientName}</h4>
          <p class="text-xs text-slate-600">${d.address}, ${d.city}</p>

          <div class="my-2 p-2 rounded bg-slate-50 border border-slate-200 text-xs">
            <div class="font-medium text-slate-800">${d.medicationName}</div>
            <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
              <span>Dist: <strong>${d.distanceFromHubMiles} mi</strong></span>
              <span>•</span>
              <span>ETA: <strong>${d.eta || 'Pending'}</strong></span>
            </div>
          </div>

          ${
            d.specialInstructions
              ? `<div class="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded mb-2 border border-amber-200">${d.specialInstructions}</div>`
              : ''
          }

          <div class="flex items-center justify-between gap-1.5 mt-2 flex-wrap">
            <button id="btn-select-${d.id}" class="px-2 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-900 text-white flex-1 cursor-pointer">
              ${isActive ? 'Selected' : 'View'}
            </button>
            <button id="btn-gps-${d.id}" class="px-2 py-1 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer" title="Open Google Maps / Apple Maps / Waze">
              GPS
            </button>
            <button id="btn-contact-${d.id}" class="px-2 py-1 text-xs font-semibold rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 whitespace-nowrap cursor-pointer" title="Call or SMS recipient">
              Contact
            </button>
            <button id="btn-directions-${d.id}" class="px-2 py-1 text-xs font-semibold rounded bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 whitespace-nowrap cursor-pointer" title="Turn-by-turn directions">
              Directions
            </button>
            ${
              !isDelivered
                ? `<button id="btn-deliver-${d.id}" class="px-2 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap cursor-pointer">
                    Complete
                  </button>`
                : ''
            }
            <button id="btn-delete-${d.id}" class="px-2 py-1 text-xs font-semibold rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap cursor-pointer" title="Remove stop from route">
              Delete
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const selectBtn = document.getElementById(`btn-select-${d.id}`);
        const gpsBtn = document.getElementById(`btn-gps-${d.id}`);
        const contactBtn = document.getElementById(`btn-contact-${d.id}`);
        const deliverBtn = document.getElementById(`btn-deliver-${d.id}`);
        const deleteBtn = document.getElementById(`btn-delete-${d.id}`);
        const dirBtn = document.getElementById(`btn-directions-${d.id}`);

        if (selectBtn) {
          selectBtn.onclick = () => onSelectDelivery(d.id);
        }
        if (gpsBtn && onOpenNavigationApp) {
          gpsBtn.onclick = () => {
            onOpenNavigationApp(d.coordinates, d.patientName, d.address);
          };
        }
        if (contactBtn && onOpenContactPatient) {
          contactBtn.onclick = () => {
            onOpenContactPatient(d);
          };
        }
        if (dirBtn) {
          dirBtn.onclick = () => {
            if (onOpenDirectionsForStop) {
              onOpenDirectionsForStop(d.id);
            } else if (onOpenDirections) {
              onOpenDirections();
            }
          };
        }
        if (deliverBtn && onDeliverStop) {
          deliverBtn.onclick = () => {
            onDeliverStop(d.id);
            marker.closePopup();
          };
        }
        if (deleteBtn && onDeleteDelivery) {
          deleteBtn.onclick = () => {
            marker.closePopup();
            onDeleteDelivery(d.id);
          };
        }
      });

      marker.addTo(markersGroup);
    });

    // 3. Connect Sequence with Real Street Route Polylines
    // If real street geometry is available, draw high-resolution road curves
    if (routeCasingRef.current) {
      routeCasingRef.current.remove();
      routeCasingRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routeGeometry && routeGeometry.length > 1) {
      const streetCoords: [number, number][] = routeGeometry
        .map((pt) => [Number(pt.lat), Number(pt.lng)] as [number, number])
        .filter(([lat, lng]) => isValidLatLng(lat, lng));

      if (streetCoords.length > 1) {
        // Outer road casing
        const casing = L.polyline(streetCoords, {
          color: isNight ? '#020617' : '#0f172a',
          weight: isNight ? 7 : 6,
          opacity: isNight ? 0.9 : 0.7,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(markersGroup);
        routeCasingRef.current = casing;

        // Inner vibrant road polyline
        const polyline = L.polyline(streetCoords, {
          color: isNight ? '#2dd4bf' : '#0284c7', // luminous cyan/teal for night vs vibrant blue for day
          weight: isNight ? 4.5 : 4,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(markersGroup);
        routePolylineRef.current = polyline;
      }
    } else {
      // Fallback straight connections if street geometry is loading
      const activeRouteCoords: [number, number][] = [];
      const drvLat = Number(driver?.currentLocation?.lat);
      const drvLng = Number(driver?.currentLocation?.lng);
      if (isValidLatLng(drvLat, drvLng)) {
        activeRouteCoords.push([drvLat, drvLng]);
      }

      const pendingDeliveries = deliveries.filter((d) => d.status !== 'delivered');
      pendingDeliveries.forEach((d) => {
        if (d.coordinates) {
          const lat = Number(d.coordinates.lat);
          const lng = Number(d.coordinates.lng);
          if (isValidLatLng(lat, lng)) {
            activeRouteCoords.push([lat, lng]);
          }
        }
      });

      if (activeRouteCoords.length > 1) {
        const polyline = L.polyline(activeRouteCoords, {
          color: isNight ? '#2dd4bf' : '#0284c7',
          weight: 4,
          opacity: isNight ? 0.95 : 0.85,
          dashArray: '6, 8',
        }).addTo(markersGroup);
        routePolylineRef.current = polyline;
      }
    }
  }, [deliveries, hub?.coordinates?.lat, hub?.coordinates?.lng, activeDeliveryId, driver?.currentLocation?.lat, driver?.currentLocation?.lng, routeGeometry, themeMode]);

  // 4. Driver Live Marker Updates
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const drvLat = Number(driver?.currentLocation?.lat);
    const drvLng = Number(driver?.currentLocation?.lng);
    if (!isValidLatLng(drvLat, drvLng)) return;

    const driverIcon = L.divIcon({
      className: 'custom-driver-vehicle',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full bg-teal-500/20 driver-pulse"></div>
          <div class="relative z-30 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xl border-2 border-teal-400 transition-transform">
            <svg class="w-5 h-5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.1.2-.1.4-.1.6v4.7c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-slate-900/90 text-white text-[9px] font-bold whitespace-nowrap shadow border border-slate-700">
            ${(driver.name || 'Driver').split(' ')[0]} • ${driver.speedMph || 0} mph
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    try {
      if (driverMarkerRef.current && map.hasLayer(driverMarkerRef.current)) {
        driverMarkerRef.current.setLatLng([drvLat, drvLng]);
        driverMarkerRef.current.setIcon(driverIcon);
      } else {
        const marker = L.marker([drvLat, drvLng], {
          icon: driverIcon,
          zIndexOffset: 1000,
        }).addTo(map);

        marker.bindPopup(`
          <div class="p-1 min-w-[190px]">
            <div class="flex items-center gap-2 mb-1">
              ${driver.avatarUrl ? `<img src="${driver.avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-teal-500 shrink-0" />` : ''}
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">Active Driver</span>
                <h4 class="font-bold text-slate-900 text-sm leading-tight">${driver.name}</h4>
              </div>
            </div>
            <p class="text-xs text-slate-600">${driver.vehicle}</p>
            <div class="mt-1.5 text-xs font-medium text-slate-700">
              Current Speed: <strong>${driver.speedMph} mph</strong>
            </div>
          </div>
        `);

        driverMarkerRef.current = marker;
      }
    } catch (err) {
      console.warn('Driver marker update error:', err);
    }
  }, [driver?.currentLocation?.lat, driver?.currentLocation?.lng, driver?.speedMph, driver?.name, driver?.vehicle, driver?.avatarUrl]);

  // Center on Driver
  const handleRecenterDriver = () => {
    try {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const drvLat = Number(driver?.currentLocation?.lat);
      const drvLng = Number(driver?.currentLocation?.lng);
      if (!isValidLatLng(drvLat, drvLng)) return;

      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) {
        map.setView([drvLat, drvLng], 13, { animate: false });
        return;
      }

      map.flyTo([drvLat, drvLng], 13, {
        duration: 1.2,
      });
    } catch (err) {
      console.warn('Recenter driver error:', err);
    }
  };

  // Fit all stops
  const handleFitRoute = () => {
    try {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) return;

      const allCoords: [number, number][] = [];

      const hubLat = Number(hub?.coordinates?.lat);
      const hubLng = Number(hub?.coordinates?.lng);
      if (isValidLatLng(hubLat, hubLng)) {
        allCoords.push([hubLat, hubLng]);
      }

      const drvLat = Number(driver?.currentLocation?.lat);
      const drvLng = Number(driver?.currentLocation?.lng);
      if (isValidLatLng(drvLat, drvLng)) {
        allCoords.push([drvLat, drvLng]);
      }

      deliveries.forEach((d) => {
        if (d?.coordinates) {
          const lat = Number(d.coordinates.lat);
          const lng = Number(d.coordinates.lng);
          if (isValidLatLng(lat, lng)) {
            allCoords.push([lat, lng]);
          }
        }
      });

      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      }
    } catch (err) {
      console.warn('Fit route error:', err);
    }
  };

  // Pan to Hub when Hub coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const hubLat = Number(hub?.coordinates?.lat);
    const hubLng = Number(hub?.coordinates?.lng);
    if (!isValidLatLng(hubLat, hubLng)) return;

    try {
      const size = map.getSize();
      if (!size || size.x <= 0 || size.y <= 0) {
        map.setView([hubLat, hubLng], map.getZoom() || 10, { animate: false });
      } else {
        map.panTo([hubLat, hubLng], {
          animate: true,
          duration: 0.8,
        });
      }
    } catch (err) {
      console.warn('Map pan error:', err);
    }
  }, [hub?.coordinates?.lat, hub?.coordinates?.lng]);

  // Pan to selected delivery stop when activeDeliveryId changes
  useEffect(() => {
    if (!mapInstanceRef.current || !activeDeliveryId) return;
    const map = mapInstanceRef.current;
    const target = deliveries.find((d) => d.id === activeDeliveryId);
    if (target?.coordinates) {
      const targetLat = Number(target.coordinates.lat);
      const targetLng = Number(target.coordinates.lng);
      if (isValidLatLng(targetLat, targetLng)) {
        try {
          const size = map.getSize();
          if (!size || size.x <= 0 || size.y <= 0) {
            map.setView([targetLat, targetLng], 14, { animate: false });
          } else {
            map.flyTo([targetLat, targetLng], 14, {
              duration: 1.0,
            });
          }
        } catch (err) {
          console.warn('Map flyTo delivery error:', err);
        }
      }
    }
  }, [activeDeliveryId, deliveries]);

  // Interactive map click for setting location
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickingStartLocation && onMapClick) {
        if (e && e.latlng && isValidLatLng(e.latlng.lat, e.latlng.lng)) {
          onMapClick({
            lat: Math.round(e.latlng.lat * 10000) / 10000,
            lng: Math.round(e.latlng.lng * 10000) / 10000,
          });
        }
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickingStartLocation, onMapClick]);

  return (
    <div className="relative isolate z-0 w-full h-full min-h-[420px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
      {/* Floating Prompt when User is Picking Start Location */}
      {isPickingStartLocation && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/95 text-white px-4 py-2 rounded-xl shadow-2xl border border-teal-400 flex items-center gap-3 backdrop-blur animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
          <span className="text-xs font-bold whitespace-nowrap">
            Click anywhere on map to set route starting point
          </span>
          {onCancelMapPick && (
            <button
              onClick={onCancelMapPick}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Map Control Floating Bar */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-auto z-[500] flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
        {onOpenStartingPointModal && (
          <button
            onClick={onOpenStartingPointModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur transition-all active:scale-95 shrink-0"
            title="Change Route Starting Point & Dispatch Hub"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold whitespace-nowrap">Start Hub</span>
          </button>
        )}

        <button
          onClick={handleRecenterDriver}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur transition-all active:scale-95 shrink-0"
          title="Center on Driver"
        >
          <Navigation2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span className="whitespace-nowrap">Follow Driver</span>
        </button>

        <button
          onClick={handleFitRoute}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-lg shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur transition-all active:scale-95 shrink-0"
          title="Fit Full Route"
        >
          <Crosshair className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="whitespace-nowrap">Fit Route</span>
        </button>

        {onOpenDirections && (
          <button
            onClick={onOpenDirections}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white font-bold text-xs rounded-lg shadow-md border border-teal-700 dark:border-teal-500 backdrop-blur transition-all active:scale-95 shrink-0"
            title="View Turn-by-Turn Driving Directions"
          >
            <Navigation className="w-3.5 h-3.5 text-teal-100" />
            <span className="whitespace-nowrap">Directions</span>
          </button>
        )}

        <button
          onClick={() => setShowZoneRings(!showZoneRings)}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 font-semibold text-xs rounded-lg shadow-md border backdrop-blur transition-all active:scale-95 shrink-0 ${
            showZoneRings
              ? 'bg-teal-600 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-500'
              : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
          }`}
          title="Toggle Zone 1-4 Distance Rings"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">{showZoneRings ? 'Hide Zones' : 'Show Zones'}</span>
        </button>

        <button
          onClick={() => setMapStyle(mapStyle === 'light' ? 'streets' : 'light')}
          className="px-2.5 py-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur transition-all shrink-0 whitespace-nowrap"
          title="Change Map Style"
        >
          {isNight ? 'Dark Matter' : mapStyle === 'light' ? 'OSM Streets' : 'Voyager'}
        </button>

        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur transition-all active:scale-95 shrink-0"
            title={isNight ? 'Switch to Day Mode' : 'Switch to Night Mode'}
          >
            {isNight ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Day</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Night</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Floating Zone Legend Bar */}
      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 z-[500] bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px] flex items-center gap-2 sm:gap-3 max-w-[calc(100%-16px)] sm:max-w-md overflow-x-auto no-scrollbar">
        <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Zones:</span>
        {ZONE_RULES.map((rule) => (
          <div key={rule.id} className="flex items-center gap-1 whitespace-nowrap">
            <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0" style={{ backgroundColor: rule.color }} />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{rule.name}</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">${rule.pay}</span>
          </div>
        ))}
      </div>

      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        className={`w-full h-full ${isPickingStartLocation ? 'cursor-crosshair' : ''}`}
        style={{ minHeight: '440px' }}
      />
    </div>
  );
};
