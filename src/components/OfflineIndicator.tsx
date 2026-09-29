import React, { useState, useRef, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, RefreshCw, X, ShieldCheck, HelpCircle } from 'lucide-react';
import { NetworkStatus, NetworkSimulateMode } from '../hooks/useNetworkStatus';

interface OfflineIndicatorProps {
  network: NetworkStatus;
  compact?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ network }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };

    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  // If connection is online and not simulated, do not show the indicator
  if (network.status === 'online') {
    return null;
  }

  const isUnstable = network.status === 'unstable';

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      {/* Clickable Header Badge */}
      <button
        type="button"
        id="header-offline-mode-indicator"
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 transition-all shadow-sm active:scale-95 cursor-pointer min-h-[34px] group"
        title="Unstable network connection: route updates may be delayed. Click for driver details."
        aria-label="Offline Mode Indicator"
        aria-expanded={isPopoverOpen}
      >
        <div className="relative flex items-center justify-center">
          <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-pulse shrink-0" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </div>

        <div className="flex items-center gap-1 text-left">
          <span className="font-bold text-xs sm:text-[13px] text-amber-200 group-hover:text-white leading-tight">
            <span className="sm:hidden">Offline</span>
            <span className="hidden sm:inline">Offline Mode</span>
          </span>
          <span className="hidden md:inline text-[11px] text-amber-300/80 font-normal">
            · {isUnstable ? 'Unstable Signal' : 'No Connection'}
          </span>
        </div>

        {/* Small chevron or info hint */}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-semibold uppercase tracking-wider hidden sm:inline">
          Delayed Routes
        </span>
      </button>

      {/* Driver Advisory Popover */}
      {isPopoverOpen && (
        <div className="absolute top-full right-0 sm:left-auto mt-2 w-80 sm:w-96 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-amber-500/40 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-200 leading-tight">
                  Offline Mode Active
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isUnstable
                    ? 'Unstable / Weak Internet Connection Detected'
                    : 'Device is currently disconnected from internet'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Advisory"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Warning Body */}
          <div className="py-3 space-y-2.5 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300">Driver Warning:</strong> Because your internet connection is unstable, real-time street route optimization and turn-by-turn recalculations may be delayed.
            </div>

            <div className="flex items-start gap-2 text-slate-300 text-[11px] leading-tight">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Local Data Protected:</strong> All stops, package notes, proof-of-delivery receipts, and device GPS tracking remain fully functional on this device.
              </span>
            </div>

            {/* Connection Diagnostics */}
            <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-semibold text-amber-400">
                  {isUnstable ? 'Unstable Cellular / High Latency' : 'Offline (No Signal)'}
                </span>
              </div>
              {network.effectiveType && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Network Type:</span>
                  <span className="font-mono text-slate-300">{network.effectiveType.toUpperCase()}</span>
                </div>
              )}
              {network.rtt !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Round Trip Time:</span>
                  <span className="font-mono text-slate-300">{network.rtt} ms</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Last Checked:</span>
                <span className="text-slate-300">
                  {network.lastChecked ? network.lastChecked.toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* Test & Simulation Controls */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-500" />
                Network Simulation:
              </span>
              <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-md border border-slate-700">
                {(['auto', 'unstable', 'offline'] as NetworkSimulateMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => network.setSimulateStatus(mode)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-all ${
                      network.simulateStatus === mode
                        ? 'bg-teal-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await network.checkConnectivity();
                }}
                disabled={network.isChecking}
                className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${network.isChecking ? 'animate-spin' : ''}`} />
                <span>{network.isChecking ? 'Checking...' : 'Check Connection Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPopoverOpen(false)}
                className="py-1.5 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface OfflineBannerProps {
  network: NetworkStatus;
  isDismissed: boolean;
  onDismiss: () => void;
  onOpenDetails?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  network,
  isDismissed,
  onDismiss,
}) => {
  if (network.status === 'online' || isDismissed) {
    return null;
  }

  const isUnstable = network.status === 'unstable';

  return (
    <div
      role="alert"
      className="bg-amber-500/15 dark:bg-amber-950/70 border-b border-amber-500/30 px-3 sm:px-6 py-2 text-xs text-amber-200 flex items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-1 duration-200"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
          <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
        </span>
        <div className="min-w-0 leading-tight">
          <strong className="text-amber-300 mr-1.5 font-bold">
            Offline Mode Active:
          </strong>
          <span className="text-amber-200/90 text-[11px] sm:text-xs">
            {isUnstable
              ? 'Internet connection is unstable. Route recalculations and live traffic updates may be delayed.'
              : 'Device is offline. Turn-by-turn route updates may be delayed. Local stops & GPS remain saved.'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={network.checkConnectivity}
          disabled={network.isChecking}
          className="px-2 sm:px-2.5 py-1 text-[11px] font-semibold rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="Retry network connection check"
        >
          <RefreshCw className={`w-3 h-3 ${network.isChecking ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Retry</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-amber-300 hover:text-white hover:bg-amber-500/20 rounded transition-colors"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
