import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HubLocation, LocationPoint, ScannedAddressResult } from '../types';
import { calculateDistanceMiles, determineZoneAndPay } from '../utils/zonePay';
import { SAMPLE_PRESCRIPTION_LABELS, SampleLabel } from '../data/sampleLabels';
import {
  geocodeAddressWithDistance,
  cleanAddressQuery,
  parseAddressComponents,
  GeocodeResult,
} from '../utils/geocoding';
import {
  Camera,
  X,
  FlipHorizontal,
  Zap,
  ZapOff,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Plus,
  Sparkles,
  FileText,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';

interface AddressCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressScanned: (result: ScannedAddressResult) => void;
  hub: HubLocation;
  mode?: 'modal' | 'embedded';
}

export const AddressCameraScanner: React.FC<AddressCameraScannerProps> = ({
  isOpen,
  onClose,
  onAddressScanned,
  hub,
  mode = 'modal',
}) => {
  // Video and Stream Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  // Captured snapshot
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Parsed Result state
  const [scannedData, setScannedData] = useState<ScannedAddressResult | null>(null);
  const [editedAddress, setEditedAddress] = useState<string>('');
  const [editedPatient, setEditedPatient] = useState<string>('');
  const [editedRxNumber, setEditedRxNumber] = useState<string>('');
  const [editedIsStat, setEditedIsStat] = useState<boolean>(false);
  const [editedMiles, setEditedMiles] = useState<string>('8.0');
  const [editedNotes, setEditedNotes] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
  const [scannedCoords, setScannedCoords] = useState<LocationPoint | null>(null);
  const [scannedCity, setScannedCity] = useState<string>('');
  const [scannedZip, setScannedZip] = useState<string>('');
  const [geocodeConfidence, setGeocodeConfidence] = useState<string | null>(null);

  // Selected sample label tab
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'samples'>('camera');

  // Play subtle camera shutter audio feedback using Web Audio API
  const playShutterSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch {
      // Audio not permitted or supported; silent fallback
    }
  };

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start camera media stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Direct camera video stream is not supported in this browser environment. Please use the "Take Photo with Phone Camera" button or sample labels below.'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn('Video play error:', err);
        });
      }

      setIsCameraActive(true);

      // Check if flashlight / torch is supported by the video track
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities?.() as any) || {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      let message = 'Unable to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera access in your browser or use the "Take Photo with Phone Camera" file button.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device. You can upload an image or test using sample labels.';
      } else if (err.name === 'NotReadableError') {
        message = 'Camera is currently in use by another application.';
      }
      setCameraError(message);
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    }
  };

  // Flip camera between environment (rear) and user (front)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Initialize camera when active tab is camera and modal is open
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, facingMode, capturedImage, startCamera, stopCamera]);

  // Geocode address using high-precision multi-provider geocoder
  const geocodeAddressString = async (addressStr: string) => {
    const clean = cleanAddressQuery(addressStr);
    if (!clean) return;

    setIsGeocoding(true);
    setGeocodeNotice(null);

    try {
      const geo = await geocodeAddressWithDistance(clean, hub.coordinates);

      if (geo.result) {
        const coords = geo.result.coordinates;
        setScannedCoords(coords);
        setEditedAddress(geo.result.formattedAddress);
        if (geo.result.city) setScannedCity(geo.result.city);
        if (geo.result.zip) setScannedZip(geo.result.zip);
        setGeocodeConfidence(geo.result.confidence);
        setEditedMiles(geo.distanceMiles.toFixed(1));

        const cityLabel = geo.result.city
          ? `${geo.result.city}, ${geo.result.state || 'TX'}`
          : '';
        const confLabel =
          geo.result.confidence === 'rooftop'
            ? 'Exact rooftop location verified'
            : 'Address coordinates verified';

        setGeocodeNotice(
          `✓ ${confLabel} in ${cityLabel || 'destination'}: (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) • ${geo.distanceMiles.toFixed(1)} mi from ${hub.name}`
        );
        return { coords, miles: geo.distanceMiles };
      } else {
        // Fallback component parser
        const parsed = parseAddressComponents(clean);
        if (parsed.city) setScannedCity(parsed.city);
        if (parsed.zip) setScannedZip(parsed.zip);
        setGeocodeNotice(
          'Address received. Distance can be adjusted manually.'
        );
      }
    } catch (e) {
      console.warn('Geocoding notice:', e);
      setGeocodeNotice('Geocoding lookup notice. Distance can be adjusted manually.');
    } finally {
      setIsGeocoding(false);
    }

    return null;
  };

  // Process and analyze image using Gemini Vision API endpoint
  const analyzeImage = async (dataUrl: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setCapturedImage(dataUrl);
    stopCamera();

    try {
      const response = await fetch('/api/scan-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          mimeType: dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.data?.address) {
        const data = result.data;
        setScannedData(data);
        setEditedAddress(data.address || '');
        setEditedPatient(data.patientName || '');
        setEditedRxNumber(data.rxNumber || '');
        setEditedIsStat(Boolean(data.isStat));
        setEditedNotes(data.notes || '');

        // Auto-geocode the scanned address
        await geocodeAddressString(data.address);
      } else {
        // If server or Gemini had an issue, provide smart fallback or informative message
        console.warn('API response notice:', result.error);
        fallbackParsing(dataUrl, result.error);
      }
    } catch (err: any) {
      console.error('Failed to contact scan API:', err);
      fallbackParsing(dataUrl, err?.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fallback parser if Gemini is unavailable
  const fallbackParsing = (dataUrl: string, errorMsg?: string) => {
    // Check if it's one of the sample labels
    const matchedSample = SAMPLE_PRESCRIPTION_LABELS.find((s) => s.dataUrl === dataUrl);
    if (matchedSample) {
      setScannedData({
        address: matchedSample.address,
        city: matchedSample.city,
        zip: matchedSample.zip,
        patientName: matchedSample.patientName,
        rxNumber: matchedSample.rxNumber,
        medicationName: matchedSample.medicationName,
        isStat: matchedSample.isStat,
        notes: matchedSample.notes,
        confidence: 'high',
      });
      setEditedAddress(matchedSample.address);
      setEditedPatient(matchedSample.patientName);
      setEditedRxNumber(matchedSample.rxNumber);
      setEditedIsStat(matchedSample.isStat);
      setEditedNotes(matchedSample.notes);
      geocodeAddressString(matchedSample.address);
      return;
    }

    setAnalysisError(
      errorMsg || 'Could not automatically detect address. You can review or enter the address directly below.'
    );
    // Provide blank editable form with image preview
    setScannedData({
      address: '',
      confidence: 'low',
    });
  };

  // Capture frame from the active video element
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;

    playShutterSound();

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      analyzeImage(dataUrl);
    }
  };

  // Handle image upload from file or phone camera capture
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        analyzeImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected if needed
    e.target.value = '';
  };

  // Select a sample label for testing
  const handleSelectSample = (sample: SampleLabel) => {
    setScannedData({
      address: sample.address,
      city: sample.city,
      zip: sample.zip,
      patientName: sample.patientName,
      rxNumber: sample.rxNumber,
      medicationName: sample.medicationName,
      isStat: sample.isStat,
      notes: sample.notes,
      confidence: 'high',
    });
    setCapturedImage(sample.dataUrl);
    setEditedAddress(sample.address);
    setEditedPatient(sample.patientName);
    setEditedRxNumber(sample.rxNumber);
    setEditedIsStat(sample.isStat);
    setEditedNotes(sample.notes);
    stopCamera();
    geocodeAddressString(sample.address);
  };

  // Reset scanner to scan another label
  const handleResetScanner = () => {
    setCapturedImage(null);
    setScannedData(null);
    setAnalysisError(null);
    setEditedAddress('');
    setEditedPatient('');
    setEditedRxNumber('');
    setEditedIsStat(false);
    setEditedNotes('');
    setGeocodeNotice(null);
    setScannedCoords(null);
    setScannedCity('');
    setScannedZip('');
    setGeocodeConfidence(null);
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  // Confirm and stage/add the scanned address
  const handleConfirmAdd = () => {
    const address = editedAddress.trim();
    if (!address) return;

    const miles = parseFloat(editedMiles) || 8.0;

    // Use verified exact geocoded coordinates if available
    let coords: LocationPoint;
    const hubLat = Number(hub?.coordinates?.lat) || 29.7295;
    const hubLng = Number(hub?.coordinates?.lng) || -95.5714;

    if (scannedCoords && !isNaN(scannedCoords.lat) && !isNaN(scannedCoords.lng)) {
      coords = scannedCoords;
    } else {
      // Approximate coordinate placement based on distance from hub
      const angleRad = Math.random() * 2 * Math.PI;
      const latOffset = (miles / 69) * Math.cos(angleRad);
      const lngOffset =
        (miles / (69 * Math.cos((hubLat * Math.PI) / 180))) * Math.sin(angleRad);
      coords = {
        lat: Math.round((hubLat + latOffset) * 10000) / 10000,
        lng: Math.round((hubLng + lngOffset) * 10000) / 10000,
      };
    }

    const parsed = parseAddressComponents(address);
    const finalCity = scannedCity || parsed.city || scannedData?.city || undefined;
    const finalZip = scannedZip || parsed.zip || scannedData?.zip || undefined;

    const result: ScannedAddressResult = {
      address,
      patientName: editedPatient.trim() || undefined,
      rxNumber: editedRxNumber.trim() || undefined,
      medicationName: scannedData?.medicationName,
      isStat: editedIsStat,
      notes: editedNotes.trim() || undefined,
      miles,
      city: finalCity,
      zip: finalZip,
      coordinates: coords,
      rawExtractedText: scannedData?.rawExtractedText,
      confidence: geocodeConfidence || scannedData?.confidence || 'high',
    };

    onAddressScanned(result);
    handleResetScanner();
    onClose();
  };

  if (!isOpen) return null;

  const numericMiles = parseFloat(editedMiles) || 8;
  const { zone: currentZone, pay: currentPay, rule: currentRule } = determineZoneAndPay(
    numericMiles,
    editedIsStat
  );

  return (
    <div
      className={
        mode === 'modal'
          ? 'fixed inset-0 z-[2100] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto'
          : 'w-full'
      }
    >
      <div
        className={`bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-white w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92dvh] flex flex-col ${
          mode === 'embedded' ? 'border-none shadow-none max-h-none' : ''
        }`}
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-lg tracking-tight">
                  Scan Address with Camera
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  AI OCR Vision
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px] sm:max-w-none">
                Scan prescription label, delivery waybill, or handwritten address
              </p>
            </div>
          </div>

          {mode === 'modal' && (
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              title="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Source Navigation Tabs (when not viewing a captured result) */}
        {!capturedImage && (
          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 pt-2.5 sm:pt-3 border-b border-slate-800/80 bg-slate-950/40 shrink-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'camera'
                  ? 'text-teal-400 border-teal-500 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'upload'
                  ? 'text-teal-400 border-teal-500 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('samples')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'samples'
                  ? 'text-teal-400 border-teal-500 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample Rx Labels</span>
            </button>
          </div>
        )}

        {/* Scanner Body */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* STATE 1: Live Viewfinder / Capture mode */}
          {!capturedImage && activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
                {/* Live Video Feed */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Target Reticle Overlay */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                    {/* Corner Guides */}
                    <div className="relative w-full max-w-md h-48 sm:h-56 border border-teal-500/40 rounded-xl bg-teal-950/10">
                      {/* Laser scanning beam line */}
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#2dd4bf] animate-[bounce_2.5s_infinite]" />

                      {/* Top-left corner bracket */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
                      {/* Top-right corner bracket */}
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
                      {/* Bottom-left corner bracket */}
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
                      {/* Bottom-right corner bracket */}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />

                      <div className="absolute bottom-2 inset-x-0 text-center">
                        <span className="text-[10px] font-semibold tracking-wider text-teal-200/90 bg-slate-950/80 px-2.5 py-1 rounded-full border border-teal-500/30 backdrop-blur-xs">
                          Align Rx Label or Address Inside Frame
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Camera Top Controls Bar */}
                {isCameraActive && (
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                    <span className="text-[10px] font-mono text-emerald-400 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE CAMERA</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`p-2 rounded-xl backdrop-blur-xs transition-colors ${
                            isTorchOn
                              ? 'bg-amber-500 text-slate-950 shadow-md'
                              : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700'
                          }`}
                          title="Toggle Flashlight"
                        >
                          {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="p-2 rounded-xl bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700 backdrop-blur-xs transition-colors"
                        title="Switch Camera (Front / Rear)"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Error / Fallback State */}
                {!isCameraActive && (
                  <div className="text-center p-6 space-y-3 max-w-md">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-teal-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    {cameraError ? (
                      <div>
                        <p className="text-xs text-amber-300 font-semibold mb-1 flex items-center justify-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Camera Access Notice</span>
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {cameraError}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 font-medium">
                        Initializing phone camera stream...
                      </p>
                    )}

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                        <span>Retry Camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Take Photo / Upload</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Shutter Capture Controls Bar */}
              {isCameraActive && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-400" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    className="flex-1 max-w-xs py-3 px-5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-teal-950 transition-all active:scale-95 flex items-center justify-center gap-2.5"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-950" />
                    </div>
                    <span>Capture & Scan Address</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('samples')}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-amber-300 hover:text-amber-200 rounded-xl bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/60 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sample Labels</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STATE 2: Upload / Native Camera Mode */}
          {!capturedImage && activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-sm text-white mb-1">
                  Take Photo with Phone Camera or Select Image
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  On mobile phones, clicking below directly opens your camera app to snap a high-resolution photo of the prescription bottle or shipping label.
                </p>

                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="px-4 py-2 rounded-xl bg-teal-600 group-hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>Snap / Choose Photo</span>
                  </span>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
                <FileText className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Supported formats: </span>
                  Photos of medicine bottles, paper waybills, delivery manifests, delivery box stickers, and handwriting.
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: Sample Labels for quick testing */}
          {!capturedImage && activeTab === 'samples' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Test address extraction instantly without a physical label in hand:
                </p>
                <span className="text-[10px] text-teal-400 font-bold bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-800">
                  1-Click AI Test
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SAMPLE_PRESCRIPTION_LABELS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/70 text-left transition-all active:scale-[0.98] group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                          {sample.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            sample.isStat
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {sample.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono line-clamp-1 mb-1">
                        📍 {sample.address}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        👤 {sample.patientName} • {sample.rxNumber}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-teal-400 font-bold">
                      <span>Click to Scan This Label</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STATE 4: Loading / Analyzing */}
          {isAnalyzing && (
            <div className="p-8 text-center space-y-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-teal-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-400 absolute" />
              </div>
              <h4 className="font-bold text-sm text-white">
                Reading Prescription Label & Detecting Destination Address...
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Gemini Vision is filtering pharmacy info from patient destination, checking STAT priority markers, and calculating zone metrics.
              </p>
            </div>
          )}

          {/* STATE 5: Scanned / Verified Result Review Card */}
          {capturedImage && !isAnalyzing && (
            <div className="space-y-4">
              {analysisError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice: </span>
                    {analysisError}
                  </div>
                </div>
              )}

              {/* Top Bar: Thumbnail + Extracted Status */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-3">
                <div className="relative w-20 h-16 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-black">
                  <img
                    src={capturedImage}
                    alt="Captured label"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/20" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      <span>Address Extracted</span>
                    </span>
                    {scannedData?.confidence && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {scannedData.confidence} confidence
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Review and verify details below before queuing to route.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-slate-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {/* Editable Form Fields for Confirmation */}
              <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Destination Delivery Address *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      placeholder="e.g. 4500 Speedway Blvd, Austin, TX 78751"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-teal-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => geocodeAddressString(editedAddress)}
                      disabled={isGeocoding || !editedAddress.trim()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                      title="Geocode and recalculate distance from hub"
                    >
                      {isGeocoding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-teal-400" />
                      )}
                      <span>Locate</span>
                    </button>
                  </div>
                  {geocodeNotice && (
                    <p className="text-[11px] text-teal-300 mt-1 flex items-center gap-1.5 font-medium">
                      <span>{geocodeNotice}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Patient / Recipient Name
                    </label>
                    <input
                      type="text"
                      value={editedPatient}
                      onChange={(e) => setEditedPatient(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Prescription / Tracking #
                    </label>
                    <input
                      type="text"
                      value={editedRxNumber}
                      onChange={(e) => setEditedRxNumber(e.target.value)}
                      placeholder="e.g. RX-84920"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-teal-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Distance from Hub:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="300"
                      value={editedMiles}
                      onChange={(e) => setEditedMiles(e.target.value)}
                      className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-teal-500"
                    />
                    <span className="text-xs text-slate-400">mi</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedIsStat}
                      onChange={(e) => setEditedIsStat(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-rose-500" />
                      STAT Priority / Urgent (+$15.00)
                    </span>
                  </label>
                </div>

                {editedNotes && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">
                      Delivery Instructions:
                    </label>
                    <input
                      type="text"
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-lg text-xs text-slate-300 focus:outline-teal-500"
                    />
                  </div>
                )}
              </div>

              {/* Calculated Zone & Payout Card */}
              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: currentRule?.color }}
                  />
                  <div>
                    <span className="text-xs font-bold text-white">{currentZone}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      ({editedMiles} miles from {hub.name})
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Driver Zone Pay
                  </span>
                  <span className="text-base font-black text-emerald-400">
                    ${currentPay}.00
                  </span>
                </div>
              </div>

              {/* Confirmation Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetScanner}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Scan Another First
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAdd}
                  disabled={!editedAddress.trim()}
                  className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Add Destination to Route</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Input for Native Camera & Gallery */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
