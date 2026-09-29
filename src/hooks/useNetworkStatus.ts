import { useState, useEffect, useCallback, useRef } from 'react';

export type NetworkConnectionStatus = 'online' | 'unstable' | 'offline';
export type NetworkSimulateMode = 'auto' | 'unstable' | 'offline';

export interface NetworkStatus {
  isOnline: boolean;
  isUnstable: boolean;
  isOffline: boolean;
  status: NetworkConnectionStatus;
  effectiveType?: string;
  rtt?: number;
  lastChecked: Date | null;
  isChecking: boolean;
  checkConnectivity: () => Promise<void>;
  simulateStatus: NetworkSimulateMode;
  setSimulateStatus: (mode: NetworkSimulateMode) => void;
}

const STORAGE_KEY = 'medroute_simulated_network_status';

export function useNetworkStatus(): NetworkStatus {
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [effectiveType, setEffectiveType] = useState<string | undefined>(() => {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } })?.connection;
    return conn?.effectiveType;
  });

  const [rtt, setRtt] = useState<number | undefined>(() => {
    const conn = (navigator as unknown as { connection?: { rtt?: number } })?.connection;
    return conn?.rtt;
  });

  const [isHighLatency, setIsHighLatency] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(() => new Date());

  const [simulateStatus, setSimulateStatusState] = useState<NetworkSimulateMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'offline' || stored === 'unstable' || stored === 'auto') {
        return stored;
      }
    } catch {
      // ignore localStorage errors
    }
    return 'auto';
  });

  const setSimulateStatus = useCallback((mode: NetworkSimulateMode) => {
    setSimulateStatusState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const checkingRef = useRef(false);

  // Active ping check to verify real internet connectivity and latency
  const checkConnectivity = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsChecking(true);

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Lightweight probe using cache-busted fetch to test real throughput and availability
      const probeUrl = `/app-icon.png?t=${Date.now()}`;
      const response = await fetch(probeUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (!response.ok && response.status !== 304 && response.status !== 0) {
        setIsBrowserOnline(false);
      } else {
        setIsBrowserOnline(true);
        // If round trip took longer than 1800ms, mark as high latency / unstable
        setIsHighLatency(latency > 1800);
      }
    } catch {
      // Fetch aborted or failed due to offline/unstable network
      if (!navigator.onLine) {
        setIsBrowserOnline(false);
      } else {
        // Browser reports online but request failed -> unstable connection
        setIsHighLatency(true);
      }
    } finally {
      setLastChecked(new Date());
      setIsChecking(false);
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = navigator as unknown as {
      connection?: {
        effectiveType?: string;
        rtt?: number;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    };

    const conn = nav?.connection;
    const handleConnChange = () => {
      if (conn) {
        setEffectiveType(conn.effectiveType);
        setRtt(conn.rtt);
      }
    };

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange);
    }

    // Periodic lightweight health check every 45 seconds when page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkConnectivity();
      }
    }, 45000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleConnChange);
      }
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  // Determine computed status
  let computedStatus: NetworkConnectionStatus = 'online';

  if (simulateStatus === 'offline') {
    computedStatus = 'offline';
  } else if (simulateStatus === 'unstable') {
    computedStatus = 'unstable';
  } else {
    // Auto detection
    if (!isBrowserOnline) {
      computedStatus = 'offline';
    } else {
      const isWeakCellular =
        effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        (rtt !== undefined && rtt > 1500) ||
        isHighLatency;

      if (isWeakCellular) {
        computedStatus = 'unstable';
      } else {
        computedStatus = 'online';
      }
    }
  }

  const isOffline = computedStatus === 'offline';
  const isUnstable = computedStatus === 'unstable';
  const isOnline = computedStatus === 'online';

  return {
    isOnline,
    isUnstable,
    isOffline,
    status: computedStatus,
    effectiveType,
    rtt,
    lastChecked,
    isChecking,
    checkConnectivity,
    simulateStatus,
    setSimulateStatus,
  };
}
