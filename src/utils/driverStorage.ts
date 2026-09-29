import { DriverState } from '../types';
import { INITIAL_DRIVER } from '../data/mockData';

const DRIVER_STORAGE_KEY = 'medroute_saved_driver_profile';

/**
 * Loads persisted driver profile from device localStorage, or falls back to INITIAL_DRIVER.
 */
export function loadSavedDriverProfile(): DriverState {
  try {
    const raw = localStorage.getItem(DRIVER_STORAGE_KEY);
    if (!raw) return INITIAL_DRIVER;
    const parsed = JSON.parse(raw);

    const safeLat = Number(parsed.currentLocation?.lat);
    const safeLng = Number(parsed.currentLocation?.lng);
    const hasValidCoords =
      !isNaN(safeLat) && !isNaN(safeLng) && isFinite(safeLat) && isFinite(safeLng);

    return {
      ...INITIAL_DRIVER,
      ...parsed,
      address: typeof parsed.address === 'string' ? parsed.address : INITIAL_DRIVER.address,
      addressCoordinates:
        parsed.addressCoordinates &&
        !isNaN(Number(parsed.addressCoordinates.lat)) &&
        !isNaN(Number(parsed.addressCoordinates.lng))
          ? {
              lat: Number(parsed.addressCoordinates.lat),
              lng: Number(parsed.addressCoordinates.lng),
            }
          : INITIAL_DRIVER.addressCoordinates,
      // preserve runtime fields with validated finite coordinates
      currentLocation: hasValidCoords
        ? { lat: safeLat, lng: safeLng }
        : INITIAL_DRIVER.currentLocation,
      isSimulating: false,
    };
  } catch (err) {
    console.warn('Failed to load driver profile from localStorage:', err);
    return INITIAL_DRIVER;
  }
}

/**
 * Persists driver profile (including custom avatar photo and address) to device localStorage.
 */
export function saveDriverProfile(driver: DriverState): void {
  try {
    const toSave = {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      licensePlate: driver.licensePlate,
      address: driver.address || '',
      addressCoordinates: driver.addressCoordinates || undefined,
      avatarUrl: driver.avatarUrl || '',
    };
    localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Failed to save driver profile to localStorage:', err);
  }
}

/**
 * Clears custom saved profile from device and restores system defaults.
 */
export function clearSavedDriverProfile(): void {
  try {
    localStorage.removeItem(DRIVER_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear driver profile:', err);
  }
}

/**
 * Compresses an image file from user's phone or device to an optimized Data URL
 * suitable for localStorage and instant avatar rendering (max 400x400, quality 0.85).
 */
export function compressImageForAvatar(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        const maxSize = 400;
        let width = img.width;
        let height = img.height;

        // Square cropping / aspect ratio scaling
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          // Fallback to original data URL if canvas context unavailable
          resolve(e.target?.result as string);
          return;
        }

        // Draw cropped square centered image
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);

        // Convert to compact JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(compressedDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
