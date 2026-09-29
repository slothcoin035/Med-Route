import React, { useState } from 'react';
import { LocationPoint, NavAppChoice } from '../types';
import {
  getPreferredNavApp,
  setPreferredNavApp,
  openInNavigationApp,
  getNavigationAppUrl,
} from '../utils/navigationShortcuts';
import {
  X,
  Navigation,
  ExternalLink,
  Check,
  Compass,
  MapPin,
  Car,
} from 'lucide-react';

interface NavigationAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  destination: LocationPoint | null;
  destinationName?: string;
  destinationAddress?: string;
  origin?: LocationPoint;
}

interface NavAppOption {
  id: NavAppChoice;
  name: string;
  tagline: string;
  badge: string;
  colorClass: string;
  iconBg: string;
}

const NAV_APPS: NavAppOption[] = [
  {
    id: 'google',
    name: 'Google Maps',
    tagline: 'Standard turn-by-turn navigation with live traffic & lane guidance',
    badge: 'Popular',
    colorClass: 'border-blue-500/40 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30',
    iconBg: 'bg-blue-600 text-white',
  },
  {
    id: 'apple',
    name: 'Apple Maps',
    tagline: 'Native iOS & CarPlay integration with Siri voice guidance',
    badge: 'iOS / CarPlay',
    colorClass: 'border-slate-400 hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/40',
    iconBg: 'bg-slate-800 text-white',
  },
  {
    id: 'waze',
    name: 'Waze',
    tagline: 'Community-driven alerts for police, speed traps, and road hazards',
    badge: 'Traffic & Hazards',
    colorClass: 'border-cyan-500/40 hover:border-cyan-500 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30',
    iconBg: 'bg-cyan-600 text-white',
  },
];

export const NavigationAppModal: React.FC<NavigationAppModalProps> = ({
  isOpen,
  onClose,
  destination,
  destinationName,
  destinationAddress,
  origin,
}) => {
  const [preferredApp, setPreferred] = useState<NavAppChoice>(() => getPreferredNavApp());
  const [rememberDefault, setRememberDefault] = useState<boolean>(true);

  if (!isOpen || !destination) return null;

  const handleLaunch = (appId: NavAppChoice) => {
    if (rememberDefault) {
      setPreferredNavApp(appId);
      setPreferred(appId);
    }
    openInNavigationApp(appId, destination, {
      origin,
      address: destinationAddress,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[2250] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                Launch External GPS Navigation
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Choose your favorite turn-by-turn driving app
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Destination Target Info */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-slate-900 dark:text-white block truncate">
              {destinationName || 'Destination'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
              {destinationAddress || `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`}
            </span>
          </div>
        </div>

        {/* Apps List */}
        <div className="p-4 space-y-2.5">
          {NAV_APPS.map((app) => {
            const isPreferred = preferredApp === app.id;

            return (
              <button
                key={app.id}
                type="button"
                onClick={() => handleLaunch(app.id)}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-98 cursor-pointer ${
                  app.colorClass
                } ${isPreferred ? 'ring-2 ring-teal-500/50 bg-teal-50/30 dark:bg-teal-950/20' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-xs ${app.iconBg}`}
                  >
                    <Compass className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {app.name}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {app.badge}
                      </span>
                      {isPreferred && (
                        <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 flex items-center gap-0.5">
                          <Check className="w-3 h-3" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {app.tagline}
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 text-slate-500 group-hover:text-teal-600">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer with Default Checkbox */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberDefault}
              onChange={(e) => setRememberDefault(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <span>Remember as default GPS app</span>
          </label>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
