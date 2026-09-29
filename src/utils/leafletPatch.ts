import L from 'leaflet';

/**
 * Defensive monkey-patches for Leaflet to prevent "Invalid LatLng object: (NaN, NaN)"
 * errors that occur when maps are initialized or animated in zero-size containers
 * (e.g. hidden tabs, responsive display:none containers, or during fast mount/unmount).
 */

let isPatched = false;

export function applyLeafletSafetyPatches(): void {
  if (isPatched || typeof window === 'undefined') return;
  isPatched = true;

  // 1. Patch L.Map.prototype.flyTo
  const originalFlyTo = L.Map.prototype.flyTo;
  L.Map.prototype.flyTo = function (targetCenter: any, targetZoom?: number, options?: any) {
    try {
      const size = this.getSize();
      // If the container has zero or invalid dimensions, flyTo mathematics fail (divide by zero => NaN)
      if (!size || size.x <= 0 || size.y <= 0 || isNaN(size.x) || isNaN(size.y)) {
        const currentZoom = this.getZoom();
        const safeZoom =
          typeof targetZoom === 'number' && !isNaN(targetZoom) && isFinite(targetZoom)
            ? targetZoom
            : typeof currentZoom === 'number' && !isNaN(currentZoom)
            ? currentZoom
            : 10;
        return this.setView(targetCenter, safeZoom, { animate: false });
      }
      return originalFlyTo.call(this, targetCenter, targetZoom, options);
    } catch (err) {
      console.warn('Leaflet flyTo fallback triggered:', err);
      try {
        const fallbackZoom =
          typeof targetZoom === 'number' && !isNaN(targetZoom) ? targetZoom : 10;
        return this.setView(targetCenter, fallbackZoom, { animate: false });
      } catch {
        return this;
      }
    }
  };

  // 2. Patch L.Map.prototype.panTo
  const originalPanTo = L.Map.prototype.panTo;
  L.Map.prototype.panTo = function (latlng: any, options?: any) {
    try {
      const size = this.getSize();
      if (!size || size.x <= 0 || size.y <= 0 || isNaN(size.x) || isNaN(size.y)) {
        const currentZoom = this.getZoom();
        const safeZoom = typeof currentZoom === 'number' && !isNaN(currentZoom) ? currentZoom : 10;
        return this.setView(latlng, safeZoom, { animate: false });
      }
      return originalPanTo.call(this, latlng, options);
    } catch (err) {
      console.warn('Leaflet panTo fallback triggered:', err);
      try {
        return this.setView(latlng, this.getZoom() || 10, { animate: false });
      } catch {
        return this;
      }
    }
  };

  // 3. Patch L.Map.prototype.fitBounds
  const originalFitBounds = L.Map.prototype.fitBounds;
  L.Map.prototype.fitBounds = function (bounds: any, options?: any) {
    try {
      const size = this.getSize();
      if (!size || size.x <= 0 || size.y <= 0 || isNaN(size.x) || isNaN(size.y)) {
        return this;
      }
      return originalFitBounds.call(this, bounds, options);
    } catch (err) {
      console.warn('Leaflet fitBounds fallback triggered:', err);
      return this;
    }
  };

  // 4. Patch L.latLng factory function
  const originalLatLng = L.latLng;
  (L as any).latLng = function (a: any, b?: any, c?: any) {
    try {
      if (a instanceof L.LatLng) return a;

      if (Array.isArray(a)) {
        const lat = Number(a[0]);
        const lng = Number(a[1]);
        const safeLat = !isNaN(lat) && isFinite(lat) ? lat : 29.7295;
        const safeLng = !isNaN(lng) && isFinite(lng) ? lng : -95.5714;
        return originalLatLng([safeLat, safeLng, a[2]]);
      }

      if (typeof a === 'object' && a !== null && 'lat' in a) {
        const lat = Number(a.lat);
        const lng = Number(a.lng ?? (a as any).lon);
        const safeLat = !isNaN(lat) && isFinite(lat) ? lat : 29.7295;
        const safeLng = !isNaN(lng) && isFinite(lng) ? lng : -95.5714;
        return originalLatLng({ lat: safeLat, lng: safeLng, alt: (a as any).alt });
      }

      if (b !== undefined) {
        const lat = Number(a);
        const lng = Number(b);
        const safeLat = !isNaN(lat) && isFinite(lat) ? lat : 29.7295;
        const safeLng = !isNaN(lng) && isFinite(lng) ? lng : -95.5714;
        return originalLatLng(safeLat, safeLng, c);
      }

      return originalLatLng(a, b, c);
    } catch {
      return originalLatLng(29.7295, -95.5714);
    }
  };

  // 5. Patch L.latLngBounds factory function
  const originalLatLngBounds = L.latLngBounds;
  (L as any).latLngBounds = function (a: any, b?: any) {
    try {
      if (Array.isArray(a)) {
        const validCoords = a.filter((pt: any) => {
          if (!pt) return false;
          if (Array.isArray(pt)) {
            const lat = Number(pt[0]);
            const lng = Number(pt[1]);
            return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
          }
          if (typeof pt === 'object' && 'lat' in pt) {
            const lat = Number(pt.lat);
            const lng = Number(pt.lng ?? pt.lon);
            return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
          }
          return false;
        });

        if (validCoords.length === 0) {
          return originalLatLngBounds([
            [29.7295, -95.5714],
            [29.7395, -95.5614],
          ]);
        }
        return (originalLatLngBounds as any)(validCoords, b);
      }
      return originalLatLngBounds(a, b);
    } catch {
      return originalLatLngBounds([
        [29.7295, -95.5714],
        [29.7395, -95.5614],
      ]);
    }
  };
}

// Auto-run patches on load
applyLeafletSafetyPatches();
