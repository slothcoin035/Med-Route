import { Delivery, HubLocation, RatesConfig, TripScheduleConfig } from '../types';
import { calculateDistanceMiles, evaluateStopPay } from './zonePay';

const STORAGE_KEY = 'medroute_saved_deliveries_v2';
const META_KEY = 'medroute_deliveries_meta_v2';
const DB_NAME = 'medroute_storage';
const DB_VERSION = 2;
const STORE_NAME = 'deliveries_store';
const RECORD_KEY = 'current_active_deliveries_v2';

export interface DeliveryStorageMetadata {
  savedAt: string;
  count: number;
  version: number;
}

/**
 * Detects whether a delivery list contains the original 8 seed demo deliveries
 */
export function isDemoDeliveryList(list: Delivery[] | null | undefined): boolean {
  if (!list || list.length === 0) return false;
  return list.length === 8 && list.every((d) => /^del-[1-8]$/.test(d.id));
}

/**
 * Validates and sanitizes a single delivery object loaded from storage.
 */
function isValidDelivery(item: unknown): item is Delivery {
  if (!item || typeof item !== 'object') return false;
  const d = item as Partial<Delivery>;

  if (typeof d.id !== 'string' || !d.id) return false;
  if (typeof d.address !== 'string') return false;
  if (!d.coordinates || typeof d.coordinates !== 'object') return false;

  const lat = Number(d.coordinates.lat);
  const lng = Number(d.coordinates.lng);
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;

  return true;
}

/**
 * Validates and filters an array of deliveries.
 */
function sanitizeDeliveries(raw: unknown): Delivery[] | null {
  if (!Array.isArray(raw)) return null;
  const valid: Delivery[] = [];
  for (const item of raw) {
    if (isValidDelivery(item)) {
      valid.push({
        ...item,
        coordinates: {
          lat: Number(item.coordinates.lat),
          lng: Number(item.coordinates.lng),
        },
        distanceFromHubMiles: Number(item.distanceFromHubMiles) || 0,
        basePay: Number(item.basePay) || 0,
        surcharge: Number(item.surcharge) || 0,
        pay: Number(item.pay) || 0,
        sequence: Number(item.sequence) || valid.length + 1,
      });
    }
  }
  return valid;
}

/* =========================================================================
   IndexedDB Native Implementation (Persistent Offline Storage)
   ========================================================================= */

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Saves deliveries directly to IndexedDB.
 */
export async function saveDeliveriesToIndexedDB(deliveries: Delivery[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const payload = {
        deliveries,
        savedAt: new Date().toISOString(),
        count: deliveries.length,
      };

      const request = store.put(payload, RECORD_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        db.close();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    // Non-fatal, logs diagnostic
    console.warn('[MedRoute IndexedDB] Failed to save deliveries to IndexedDB:', err);
  }
}

/**
 * Loads deliveries from IndexedDB.
 */
export async function loadDeliveriesFromIndexedDB(): Promise<Delivery[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(RECORD_KEY);

      request.onsuccess = () => {
        const result = request.result;
        if (result && Array.isArray(result.deliveries)) {
          const sanitized = sanitizeDeliveries(result.deliveries);
          if (isDemoDeliveryList(sanitized)) {
            // Demo stops detected in storage: clear them
            clearDeliveriesFromIndexedDB();
            resolve([]);
          } else {
            resolve(sanitized);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn('[MedRoute IndexedDB] Failed to load deliveries from IndexedDB:', err);
    return null;
  }
}

/**
 * Clears deliveries from IndexedDB.
 */
export async function clearDeliveriesFromIndexedDB(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(RECORD_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (err) {
    console.warn('[MedRoute IndexedDB] Failed to clear IndexedDB:', err);
  }
}

/* =========================================================================
   localStorage Implementation (Instant Synchronous Hydration)
   ========================================================================= */

/**
 * Checks if a persisted delivery route exists in localStorage.
 */
export function hasSavedDeliveries(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Synchronously loads saved deliveries from localStorage.
 */
export function loadDeliveriesFromLocalStorage(): Delivery[] | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return sanitizeDeliveries(parsed);
  } catch (err) {
    console.warn('[MedRoute Storage] Failed to parse deliveries from localStorage:', err);
    return null;
  }
}

/**
 * Synchronously saves deliveries to localStorage.
 */
export function saveDeliveriesToLocalStorage(deliveries: Delivery[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries));
    const meta: DeliveryStorageMetadata = {
      savedAt: new Date().toISOString(),
      count: deliveries.length,
      version: 1,
    };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.error('[MedRoute Storage] Failed to save deliveries to localStorage:', err);
  }
}

/**
 * Clears saved deliveries from localStorage.
 */
export function clearDeliveriesFromLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
  } catch (err) {
    console.warn('[MedRoute Storage] Failed to remove deliveries from localStorage:', err);
  }
}

/**
 * Returns storage metadata (last saved timestamp, count).
 */
export function getSavedDeliveriesMetadata(): DeliveryStorageMetadata | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* =========================================================================
   Unified Facade (Dual Persistence: localStorage + IndexedDB)
   ========================================================================= */

/**
 * Synchronously retrieves initial deliveries on application startup:
 * 1. Checks and clears any legacy demo data from browser storage.
 * 2. If valid custom deliveries exist in localStorage, returns them.
 * 3. Defaults to an empty route list (0 stops, clean map).
 */
export function loadInitialDeliveriesState(
  _hub?: HubLocation,
  _scheduleConfig?: TripScheduleConfig,
  _ratesConfig?: RatesConfig
): Delivery[] {
  // Proactively purge old v1 demo keys from browser storage if present
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem('medroute_saved_deliveries_v1');
      localStorage.removeItem('medroute_deliveries_meta_v1');
    } catch {
      // ignore
    }
  }

  // Check if saved state exists in active localStorage
  const saved = loadDeliveriesFromLocalStorage();
  if (saved !== null) {
    if (isDemoDeliveryList(saved)) {
      clearAllPersistentDeliveries();
      return [];
    }
    return saved;
  }

  // Start with clean state: 0 stops, clean map
  saveDeliveries([]);
  return [];
}

/**
 * Persists the entire route state:
 * - Writes synchronously to localStorage for immediate reload durability.
 * - Writes asynchronously to IndexedDB for large-quota, reliable offline backup.
 */
export function saveDeliveries(deliveries: Delivery[]): void {
  saveDeliveriesToLocalStorage(deliveries);
  // Asynchronously commit to IndexedDB
  saveDeliveriesToIndexedDB(deliveries).catch(() => {
    // Already logged in saveDeliveriesToIndexedDB
  });
}

/**
 * Resets/clears persistent storage across both localStorage and IndexedDB.
 */
export async function clearAllPersistentDeliveries(): Promise<void> {
  clearDeliveriesFromLocalStorage();
  await clearDeliveriesFromIndexedDB();
}
