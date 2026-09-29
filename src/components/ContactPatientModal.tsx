import React, { useState, useEffect } from 'react';
import { Delivery } from '../types';
import {
  COURIER_SMS_TEMPLATES,
  getTelUrl,
  getSmsUrl,
  cleanPhoneNumber,
  CourierSmsData,
} from '../utils/navigationShortcuts';
import {
  X,
  Phone,
  MessageSquare,
  Send,
  Copy,
  Check,
  Clock,
  MapPin,
  Pill,
  User,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface ContactPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  driverName?: string;
}

export const ContactPatientModal: React.FC<ContactPatientModalProps> = ({
  isOpen,
  onClose,
  delivery,
  driverName,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('eta');
  const [messageBody, setMessageBody] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Re-generate template when delivery or template choice changes
  useEffect(() => {
    if (!delivery) return;

    const data: CourierSmsData = {
      patientName: delivery.patientName,
      medicationName: delivery.medicationName,
      address: `${delivery.address}, ${delivery.city}`,
      eta: delivery.eta,
      driverName,
    };

    const template =
      COURIER_SMS_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      COURIER_SMS_TEMPLATES[0];

    setMessageBody(template.generateText(data));
    setCopied(false);
  }, [delivery, selectedTemplateId, driverName, isOpen]);

  // Keyboard shortcut
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !delivery) return null;

  const rawPhone = delivery.phone || '';
  const displayPhone = rawPhone || 'No phone recorded';
  const hasPhone = Boolean(rawPhone.trim());
  const telUrl = getTelUrl(rawPhone);
  const smsUrl = getSmsUrl(rawPhone, messageBody);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2200] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                Contact Recipient
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                One-tap driver call & customizable pharmacy SMS alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient Details Summary Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block">
                Prescription Delivery
              </span>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {delivery.patientName}
              </h4>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Estimated Arrival</span>
              <span className="text-xs sm:text-sm font-black text-teal-600 dark:text-teal-400 flex items-center gap-1 justify-end">
                <Clock className="w-3.5 h-3.5" />
                <span>{delivery.eta || 'Calculating...'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{delivery.address}, {delivery.city}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Pill className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{delivery.medicationName} ({delivery.rxNumber})</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Action 1: Call Patient */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Voice Call
              </span>
              <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                {displayPhone}
              </span>
            </div>

            {hasPhone ? (
              <a
                href={telUrl}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/20 transition-all active:scale-98 cursor-pointer"
              >
                <Phone className="w-4 h-4 fill-current" />
                <span>Call Patient ({cleanPhoneNumber(rawPhone)})</span>
              </a>
            ) : (
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs text-center">
                No phone number listed for this stop manifest
              </div>
            )}
          </div>

          {/* Action 2: Text / SMS Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                2. Quick Courier SMS
              </span>
              <span className="text-[11px] text-slate-400">Select template below</span>
            </div>

            {/* Template Selector Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {COURIER_SMS_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    selectedTemplateId === tmpl.id
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  title={tmpl.description}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            {/* Editable Text Area */}
            <div className="relative">
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans leading-relaxed resize-none"
                placeholder="Type your message..."
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-0.5">
                <span>Auto-fills medication & ETA</span>
                <span>{messageBody.length} chars</span>
              </div>
            </div>

            {/* SMS Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              {hasPhone ? (
                <a
                  href={smsUrl}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-sky-600/20 transition-all active:scale-98 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in SMS App</span>
                  <ExternalLink className="w-3 h-3 text-sky-200" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold text-xs cursor-not-allowed text-center"
                >
                  Phone number unavailable
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyText}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer shrink-0"
                title="Copy text to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Prescription courier dispatch standards compliant</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
