import React, { useState, useEffect } from 'react';
import { Delivery } from '../types';
import {
  COURIER_SMS_TEMPLATES,
  getTelUrl,
  getSmsUrl,
  cleanPhoneNumber,
  CourierSmsData,
  triggerHapticFeedback,
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
  ShieldCheck,
  ExternalLink,
  Edit2,
  FileEdit,
} from 'lucide-react';

interface ContactPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  driverName?: string;
  onUpdateDelivery?: (updated: Delivery) => void;
  onOpenEditStop?: (delivery: Delivery) => void;
}

export const ContactPatientModal: React.FC<ContactPatientModalProps> = ({
  isOpen,
  onClose,
  delivery,
  driverName,
  onUpdateDelivery,
  onOpenEditStop,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('eta');
  const [messageBody, setMessageBody] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');

  // Sync phone input when delivery opens
  useEffect(() => {
    if (delivery) {
      setPhoneInput(delivery.phone || '');
      setIsEditingPhone(false);
    }
  }, [delivery, isOpen]);

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

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) {
      setPhoneInput('');
    } else if (digits.length <= 3) {
      setPhoneInput(`(${digits}`);
    } else if (digits.length <= 6) {
      setPhoneInput(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
    } else {
      setPhoneInput(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`);
    }
  };

  const handleSavePhone = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    triggerHapticFeedback('success');
    if (onUpdateDelivery && delivery) {
      const updated: Delivery = {
        ...delivery,
        phone: phoneInput.trim(),
      };
      onUpdateDelivery(updated);
    }
    setIsEditingPhone(false);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setCopied(true);
      triggerHapticFeedback('tap');
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
                1-tap driver call & customizable pharmacy SMS arrival alerts
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
                Stop #{delivery.sequence} • Prescription Delivery
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
          {/* Action 1: Call Patient & Phone Config */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Voice Call
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  {displayPhone}
                </span>
                {onUpdateDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput(delivery.phone || '');
                      setIsEditingPhone((prev) => !prev);
                    }}
                    className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                    title="Edit or add patient phone number"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{hasPhone ? 'Edit' : '+ Add'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Inline Quick Phone Editor */}
            {isEditingPhone && (
              <form onSubmit={handleSavePhone} className="mb-2 p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-700 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-teal-900 dark:text-teal-300 uppercase">
                    Patient Phone Number:
                  </label>
                  <span className="text-[10px] text-slate-500">Auto-formatted (###) ###-####</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={handlePhoneInputChange}
                      placeholder="(713) 555-0100"
                      className="w-full pl-8 pr-2 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(false)}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {hasPhone ? (
              <a
                href={telUrl}
                onClick={() => triggerHapticFeedback('tap')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/20 transition-all active:scale-98 cursor-pointer text-decoration-none"
              >
                <Phone className="w-4 h-4 fill-current" />
                <span>Call Patient ({cleanPhoneNumber(rawPhone)})</span>
              </a>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-center space-y-1.5">
                <p className="text-slate-500 dark:text-slate-400">
                  No phone number listed for {delivery.patientName}.
                </p>
                {onUpdateDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput('');
                      setIsEditingPhone(true);
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg shadow-sm inline-flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>+ Add Phone Number</span>
                  </button>
                )}
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
                  onClick={() => triggerHapticFeedback('tap')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-sky-600/20 transition-all active:scale-98 cursor-pointer text-decoration-none"
                >
                  <Send className="w-4 h-4" />
                  <span>Open in SMS App</span>
                  <ExternalLink className="w-3 h-3 text-sky-200" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPhoneInput('');
                    setIsEditingPhone(true);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-600 font-bold text-xs cursor-pointer text-center"
                >
                  Add phone number to send SMS
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
          {onOpenEditStop ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditStop(delivery);
              }}
              className="text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span>Edit Full Stop Manifest</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Courier dispatch standards compliant</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
