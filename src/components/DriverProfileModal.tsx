import React, { useState, useRef, useEffect } from 'react';
import { DriverState, HubLocation, LocationPoint } from '../types';
import { compressImageForAvatar, clearSavedDriverProfile } from '../utils/driverStorage';
import { geocodeAddress, reverseGeocode } from '../utils/geocoding';
import {
  X,
  User,
  Camera,
  Upload,
  Trash2,
  Check,
  Smartphone,
  Car,
  Phone,
  Shield,
  RefreshCw,
  Sparkles,
  AlertCircle,
  MapPin,
  Crosshair,
  Navigation,
} from 'lucide-react';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: DriverState;
  onSaveDriver: (updated: DriverState) => void;
  onSetAsHub?: (hub: HubLocation) => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
  driver,
  onSaveDriver,
  onSetAsHub,
}) => {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [vehicle, setVehicle] = useState(driver.vehicle);
  const [licensePlate, setLicensePlate] = useState(driver.licensePlate);
  const [address, setAddress] = useState(driver.address || '');
  const [addressCoordinates, setAddressCoordinates] = useState<LocationPoint | undefined>(
    driver.addressCoordinates
  );
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(driver.avatarUrl);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Live camera preview state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(driver.name);
      setPhone(driver.phone);
      setVehicle(driver.vehicle);
      setLicensePlate(driver.licensePlate);
      setAddress(driver.address || '');
      setAddressCoordinates(driver.addressCoordinates);
      setAvatarUrl(driver.avatarUrl);
      setPhotoError(null);
      setSuccessNotice(null);
      setAddressNotice(null);
    } else {
      stopLiveCamera();
    }
  }, [isOpen, driver]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setAddressNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocatingGps(true);
    setAddressNotice('Detecting device GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: Math.round(pos.coords.latitude * 100000) / 100000,
          lng: Math.round(pos.coords.longitude * 100000) / 100000,
        };
        setAddressCoordinates(coords);
        setAddressNotice('Looking up street address from GPS...');
        try {
          const reverseResult = await reverseGeocode(coords);
          if (reverseResult) {
            setAddress(reverseResult);
            setAddressNotice('✓ Location detected from device GPS');
          } else {
            setAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
            setAddressNotice('✓ GPS coordinates captured');
          }
        } catch {
          setAddress(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          setAddressNotice('✓ GPS coordinates captured');
        } finally {
          setIsLocatingGps(false);
        }
      },
      () => {
        setIsLocatingGps(false);
        setAddressNotice('Could not access device GPS. Check location permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleVerifyAddress = async () => {
    if (!address.trim()) return;
    setIsGeocodingAddress(true);
    setAddressNotice('Verifying address coordinates...');
    try {
      const geo = await geocodeAddress(address.trim());
      if (geo) {
        setAddressCoordinates(geo.coordinates);
        setAddress(geo.formattedAddress);
        setAddressNotice(`✓ Verified (${geo.confidence} accuracy)`);
      } else {
        setAddressNotice('Address saved. Coordinates estimated.');
      }
    } catch {
      setAddressNotice('Address saved.');
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  // Keyboard Escape shortcut
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsLiveCameraActive(false);
  };

  const handleStartLiveCamera = async () => {
    try {
      setPhotoError(null);
      setIsLiveCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Live camera access error:', err);
      setIsLiveCameraActive(false);
      setPhotoError('Camera permission denied or camera not found. You can still pick a photo from your device files.');
    }
  };

  const handleCaptureLiveSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const size = Math.min(video.videoWidth, video.videoHeight) || 400;
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatarUrl(dataUrl);
        setSuccessNotice('Photo captured directly from camera!');
      }
      stopLiveCamera();
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
      setPhotoError('Could not process camera image.');
    }
  };

  // Handle image selection from phone/device file picker
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (PNG, JPG, HEIC, or WebP).');
      return;
    }

    try {
      setIsProcessingPhoto(true);
      setPhotoError(null);
      const compressedDataUrl = await compressImageForAvatar(file);
      setAvatarUrl(compressedDataUrl);
      setSuccessNotice('Photo loaded and optimized from your device!');
    } catch (err: any) {
      console.error('Photo compression error:', err);
      setPhotoError('Unable to process selected photo. Please try another image.');
    } finally {
      setIsProcessingPhoto(false);
      // Reset input value so user can re-select the same file if desired
      if (e.target) e.target.value = '';
    }
  };

  // Handle Drag and Drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please drop an image file.');
      return;
    }

    try {
      setIsProcessingPhoto(true);
      setPhotoError(null);
      const compressedDataUrl = await compressImageForAvatar(file);
      setAvatarUrl(compressedDataUrl);
      setSuccessNotice('Photo loaded from your device!');
    } catch (err) {
      setPhotoError('Failed to process dropped image.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(undefined);
    setSuccessNotice('Photo removed. Initials will be used.');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setPhotoError('Driver name cannot be empty.');
      return;
    }

    const updated: DriverState = {
      ...driver,
      name: name.trim(),
      phone: phone.trim() || '(512) 555-0194',
      vehicle: vehicle.trim() || 'Medical Delivery Vehicle',
      licensePlate: licensePlate.trim().toUpperCase() || 'TX-MED',
      address: address.trim(),
      addressCoordinates: addressCoordinates,
      avatarUrl: avatarUrl || undefined,
    };

    onSaveDriver(updated);
    stopLiveCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopLiveCamera();
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full my-auto max-h-[92dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Sticky Header */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                Driver Profile & Device Photo
              </h3>
              <p className="text-[11px] text-slate-400">
                Edit your driver details and save a photo straight from your phone
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-driver-profile-btn"
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banners */}
        {photoError && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{photoError}</span>
          </div>
        )}

        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Content */}
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
            {/* Section 1: Device Photo Upload & Live Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Driver Photo</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Saved locally on your device
              </span>
            </div>

            {/* Photo Avatar Preview & Action Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Round Preview */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-teal-500 shadow-md bg-slate-900 flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name || 'Driver'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-slate-800 to-slate-700 text-teal-300 font-black text-2xl flex items-center justify-center">
                      {(name || 'Marcus Vance')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    title="Remove Photo"
                    className="absolute -top-1 -right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow transition-transform hover:scale-110"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Photo Upload Buttons */}
              <div className="flex-1 w-full space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option A: Pick file from phone/device */}
                  <button
                    type="button"
                    id="upload-photo-device-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="w-full py-2 px-3 rounded-lg bg-white border border-slate-300 hover:border-teal-500 hover:bg-teal-50/50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                    <span>{isProcessingPhoto ? 'Processing...' : 'Upload from Device'}</span>
                  </button>

                  {/* Option B: Direct phone camera capture */}
                  <button
                    type="button"
                    id="capture-phone-camera-btn"
                    onClick={() => {
                      // If mobile, prompt native camera capture; otherwise toggle web camera
                      if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        cameraInputRef.current?.click();
                      } else {
                        if (isLiveCameraActive) {
                          stopLiveCamera();
                        } else {
                          handleStartLiveCamera();
                        }
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isLiveCameraActive ? 'Cancel Camera' : 'Take Photo (Camera)'}</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border border-dashed border-slate-300 rounded-lg p-2 text-center text-[11px] text-slate-500 bg-white/60 hover:bg-white hover:border-teal-400 transition-colors"
                >
                  <span>Or drag & drop photo here • Auto-optimized for mobile</span>
                </div>

                {/* Hidden Native File Inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="user"
                  className="hidden"
                />
              </div>
            </div>

            {/* Live Camera Viewfinder (if activated on desktop/web) */}
            {isLiveCameraActive && (
              <div className="mt-3 p-3 bg-slate-900 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5 text-teal-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    Live Camera Viewfinder
                  </span>
                  <span className="text-[11px] text-slate-400">Position your face in the center</span>
                </div>

                <div className="relative w-full max-w-[280px] mx-auto aspect-square rounded-full overflow-hidden border-2 border-teal-400 shadow-inner bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCaptureLiveSnapshot}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Snap Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Driver Identity & Contact Information */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Driver Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Full Name */}
              <div className="space-y-1">
                <label htmlFor="driver-name-input" className="font-semibold text-slate-700 block">
                  Driver Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="driver-name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label htmlFor="driver-phone-input" className="font-semibold text-slate-700 block">
                  Driver Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="driver-phone-input"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. (512) 555-0194"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>
              </div>

              {/* Vehicle Description */}
              <div className="space-y-1">
                <label htmlFor="driver-vehicle-input" className="font-semibold text-slate-700 block">
                  Vehicle Model & Specs
                </label>
                <div className="relative">
                  <Car className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="driver-vehicle-input"
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="e.g. Toyota Prius (Insulated Cooler)"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                </div>
              </div>

              {/* License Plate */}
              <div className="space-y-1">
                <label htmlFor="driver-plate-input" className="font-semibold text-slate-700 block">
                  License Plate Number
                </label>
                <div className="relative">
                  <Shield className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="driver-plate-input"
                    type="text"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="e.g. TX-MED-492"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs uppercase"
                  />
                </div>
              </div>

              {/* Driver Home / Base Address (Full Width across 2 columns) */}
              <div className="sm:col-span-2 space-y-1.5 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label htmlFor="driver-address-input" className="font-semibold text-slate-700 block">
                    Driver Address (Home or Base Depot)
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocatingGps}
                    className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 hover:underline disabled:opacity-50 cursor-pointer"
                    title="Detect your device GPS coordinates and autofill address"
                  >
                    <Crosshair className={`w-3.5 h-3.5 text-teal-500 ${isLocatingGps ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGps ? 'Locating...' : 'Use Device GPS'}</span>
                  </button>
                </div>

                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="driver-address-input"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressNotice(null);
                    }}
                    placeholder="e.g. 1042 Westheimer Rd, Houston, TX 77006"
                    className="w-full pl-8 pr-16 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyAddress}
                    disabled={isGeocodingAddress || !address.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {isGeocodingAddress ? 'Checking...' : 'Verify'}
                  </button>
                </div>

                {/* Status Notice & Coordinates Badge */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] pt-0.5">
                  {addressNotice ? (
                    <span className={`font-medium ${addressNotice.includes('✓') ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {addressNotice}
                    </span>
                  ) : (
                    <span className="text-slate-400">Used for driver profile, route origin, and shift settlements</span>
                  )}

                  {addressCoordinates && (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {addressCoordinates.lat.toFixed(4)}, {addressCoordinates.lng.toFixed(4)}
                      </span>

                      {onSetAsHub && address.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            onSetAsHub({
                              id: `hub-driver-${Date.now()}`,
                              name: `${name.split(' ')[0] || 'Driver'}'s Base`,
                              address: address.trim(),
                              coordinates: addressCoordinates,
                            });
                            setAddressNotice('✓ Set as active route starting hub!');
                          }}
                          className="px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-bold transition-colors cursor-pointer"
                          title="Set this address as the starting hub to measure all delivery zones from here"
                        >
                          Set as Starting Hub
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Modal Footer Actions (Pinned to bottom) */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                clearSavedDriverProfile();
                setName(driver.name);
                setAddress('');
                setAddressCoordinates(undefined);
                setAvatarUrl(undefined);
                setSuccessNotice('Restored default driver profile.');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stopLiveCamera();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-driver-profile-btn"
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save to Device</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
