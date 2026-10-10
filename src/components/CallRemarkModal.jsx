// src/components/CallRemarkModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneCall, 
  Check, 
  CheckCircle2,
  AlertCircle, 
  Sparkles,
  Smartphone,
  Laptop,
  Tablet,
  Settings2,
  QrCode,
  Copy,
  Calendar,
  CreditCard,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CALL_STATUSES, getParticipantCallRecord, formatCallTime } from '../utils/callStore';
import { getDeviceInfo, setCustomDeviceName, getCustomDeviceName } from '../utils/device';
import { isParticipantCancelled, getCallPaymentStatus, getCallPaymentBadge } from '../utils/paymentUtils';

export default function CallRemarkModal({ 
  isOpen, 
  participant, 
  currentUser, 
  techfestPaymentIndex,
  onClose, 
  onSubmit 
}) {
  const [remark, setRemark] = useState('');
  const [leadNumber, setLeadNumber] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [amountPaid, setAmountPaid] = useState('199');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(() => getDeviceInfo());
  const [isEditingStation, setIsEditingStation] = useState(false);
  const [stationName, setStationName] = useState(() => getCustomDeviceName());

  // Cancellation win-back fields, only meaningful for a cancelled participant
  const [cancelReason, setCancelReason] = useState('');
  const [revertOutcome, setRevertOutcome] = useState('');

  const existingRecord = participant ? getParticipantCallRecord(participant) : null;
  const nextCallNum = (existingRecord?.callCount || 0) + 1;

  const isCancelledParticipant = participant ? isParticipantCancelled(participant) : false;
  const wasReverted = participant?.cancel_reverted === true;

  // Paid / Unpaid state, resolved from techfest26.in payments plus the Unstop row
  const paymentStatus = participant ? getCallPaymentStatus(participant, techfestPaymentIndex) : null;
  const paymentBadge = getCallPaymentBadge(paymentStatus);

  const CANCEL_REASONS = [
    { value: 'FEE_TOO_HIGH', label: 'Fee too high' },
    { value: 'DATE_CLASH', label: 'Clash with exams or another event' },
    { value: 'TEAM_DISSOLVED', label: 'Team could not be formed' },
    { value: 'NOT_INTERESTED', label: 'Not interested any more' },
    { value: 'OTHER_FEST', label: 'Joined another fest' },
    { value: 'DUPLICATE', label: 'Duplicate registration' },
    { value: 'TECHNICAL_ISSUE', label: 'Technical or payment issue' },
    { value: 'UNSTOP_ISSUES', label: 'Trouble with the Unstop platform' },
    { value: 'MOVED_TO_TECHFEST26', label: 'Moving to techfest26.in' },
    { value: 'OTHER', label: 'Other' }
  ];

  // Reset the form each time a new participant is dialled.
  useEffect(() => {
    if (!participant) return;
    const record = getParticipantCallRecord(participant);
    setRemark('');
    setSelectedStatus('');
    setUtrNumber(record?.utrNumber || '');
    setPaymentMode(record?.paymentMode || 'UPI');
    setAmountPaid(String(record?.amountPaid || '199'));
    setShowQrCode(false);
    setCopiedUpi(false);
    setHasError(false);
    setLeadNumber(record?.leadNumber || participant.phone || '');
    setDeviceInfo(getDeviceInfo());
    setStationName(getCustomDeviceName());
    setIsEditingStation(false);
    setCancelReason('');
    setRevertOutcome('');
  }, [participant]);

  const handleSaveStation = (e) => {
    e.preventDefault();
    setCustomDeviceName(stationName);
    setDeviceInfo(getDeviceInfo());
    setIsEditingStation(false);
  };

  if (!isOpen || !participant) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedStatus) {
      setHasError(true);
      return;
    }

    // A cancellation call must record why they left and what happened next
    if (isCancelledParticipant && !cancelReason) {
      setHasError(true);
      return;
    }
    if (isCancelledParticipant && !revertOutcome) {
      setHasError(true);
      return;
    }

    const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelReason)?.label || '';
    const outcomeLabel = revertOutcome === 'REVERT_WON'
      ? 'Confirmed they re-registered'
      : revertOutcome === 'REVERT_PENDING'
        ? 'Agreed to re-register; awaiting confirmation'
        : 'Still cancelled / declined to return';

    onSubmit({
      participant: {
        ...participant,
        utrNumber: utrNumber.trim(),
        paymentMode,
        amountPaid: Number(amountPaid) || 199,
        is_cancelled: isCancelledParticipant,
        cancel_reason: reasonLabel,
        cancel_reverted: wasReverted || revertOutcome === 'REVERT_WON'
      },
      callerUser: currentUser,
      remark: (
        remark.trim() ||
        (selectedStatus === 'PAYMENT_CLAIMED' ? 'Payment completed and confirmed.' : 'Call completed.')
      ) + (
        isCancelledParticipant
          ? ` | Cancellation reason: ${reasonLabel}. Win-back: ${outcomeLabel}.`
          : ''
      ),
      leadNumber: leadNumber.trim(),
      status: selectedStatus,
      cancelReason: reasonLabel,
      revertOutcome
    });
    onClose();
  };

  const handleRedial = () => {
    if (participant.phone && participant.phone !== 'N/A') {
      window.open(`tel:${participant.phone}`, '_self');
    }
  };

  const copyUpiId = () => {
    navigator.clipboard?.writeText('sliet.techfest26@upi');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg bg-white border-slate-200 text-slate-900 p-0 overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-slate-900">Log Call Details</DialogTitle>
                <Badge variant="warning" className="text-[10px] font-mono">
                  Call #{nextCallNum}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Calling as <span className="text-sky-700 font-semibold">{currentUser?.name}</span> ({currentUser?.teamName || 'Staff'})
              </DialogDescription>
            </div>
          </div>

          {/* Quick QR Code Toggle Button */}
          <button
            type="button"
            onClick={() => setShowQrCode(!showQrCode)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            title="Show TechFEST UPI QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TechFEST QR</span>
          </button>
        </div>

        {/* Candidate Context Pill */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="truncate mr-2">
            <span className="text-slate-500">Candidate: </span>
            <span className="font-semibold text-slate-900">{participant.name}</span>
            <span className="text-slate-400 mx-2">•</span>
            <span className="text-slate-600 font-medium">{participant.event_name}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRedial}
            className="h-7 px-2.5 text-[11px] font-mono text-sky-700 hover:text-sky-800 hover:bg-sky-100/60 border border-sky-200 bg-white"
            title="Redial via phone app"
          >
            <Phone className="w-3 h-3 mr-1" />
            <span>Redial</span>
          </Button>
        </div>

        {/* Paid / Unpaid field: the caller must know the money status before dialling */}
        {paymentStatus && (
          <div className={`mx-5 mt-3 rounded-xl border ${paymentBadge.accent} px-3.5 py-3`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${paymentBadge.dot}`} />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                  Payment
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-[10.5px] font-mono font-bold uppercase ${paymentBadge.chip}`}>
                  {paymentStatus.label}
                </span>
              </div>
              {paymentStatus.amount ? (
                <span className="font-mono text-sm font-bold text-slate-900 shrink-0">
                  ₹{paymentStatus.amount.toLocaleString('en-IN')}
                </span>
              ) : null}
            </div>

            {(paymentStatus.utr || paymentStatus.paymentType || paymentStatus.registrationId) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-mono text-slate-600">
                {paymentStatus.utr && <span>UTR {paymentStatus.utr}</span>}
                {paymentStatus.paymentType && <span className="uppercase">via {paymentStatus.paymentType}</span>}
                {paymentStatus.registrationId && (
                  <span className="text-slate-400">{paymentStatus.registrationId}</span>
                )}
              </div>
            )}

            <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
              {paymentStatus.note}
            </p>

            {paymentStatus.matchedOn &&
              participant?.email &&
              paymentStatus.matchedOn !== String(participant.email).trim().toLowerCase() && (
                <p className="mt-1 text-[10.5px] font-mono text-slate-500">
                  Matched on {paymentStatus.matchedOn}
                </p>
              )}
          </div>
        )}

        {/* Cancellation win-back panel */}
        {isCancelledParticipant && (
          <div className="mx-5 mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-300 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600" />
              <p className="text-xs font-semibold text-rose-900">Registration cancelled — win-back attempt</p>
              {wasReverted && (
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 border-emerald-300 bg-emerald-50">
                  previously won back
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-rose-800/90 leading-relaxed">
                Ask why they cancelled, then confirm whether they re-registered on
                techfest26.in with the same email. This row turns green automatically once that
                email appears in a registration created after the cancellation — you do not need to
                tell the system yourself.
              </p>

            <div>
              <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                Why did they cancel? <span className="text-rose-500">*</span>
              </label>
              <select
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setHasError(false); }}
                className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-rose-500"
              >
                <option value="">Select a reason...</option>
                {CANCEL_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-rose-900 mb-1">
                Did they re-register? <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5">
                {[
                  { value: 'REVERT_WON', label: 'Yes, already re-registered on techfest26.in' },
                  { value: 'REVERT_PENDING', label: 'Promised to re-register, not done yet' },
                  { value: 'STILL_CANCELLED', label: 'No, still cancelled' }
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 text-xs text-rose-900 cursor-pointer">
                    <input
                      type="radio"
                      name="revertOutcome"
                      value={opt.value}
                      checked={revertOutcome === opt.value}
                      onChange={(e) => { setRevertOutcome(e.target.value); setHasError(false); }}
                      className="accent-rose-600"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {hasError && !cancelReason && (
              <p className="text-[11px] text-rose-700 font-medium">Select a cancellation reason to continue.</p>
            )}
            {hasError && cancelReason && !revertOutcome && (
              <p className="text-[11px] text-rose-700 font-medium">Tell us whether they re-registered.</p>
            )}
          </div>
        )}

        {/* Warning if already contacted */}
        {existingRecord && existingRecord.callCount > 0 && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Already Contacted ({existingRecord.callCount} previous call{existingRecord.callCount > 1 ? 's' : ''})
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold border border-amber-300">
                Avoid Duplicate Call
              </span>
            </div>
            <p className="text-[11px] text-amber-850">
              Last contacted by <span className="font-semibold">{existingRecord.lastCallerName || existingRecord.history?.[0]?.callerName || 'Staff'}</span> on <span className="font-semibold">{formatCallTime(existingRecord.lastCalledAt)}</span> • Status: <span className="font-semibold">{CALL_STATUSES[existingRecord.lastStatus]?.label || existingRecord.lastStatus}</span>
            </p>
            {existingRecord.lastRemark && existingRecord.lastRemark !== 'No remarks entered.' && (
              <p className="text-[11px] font-mono bg-white/90 p-1.5 rounded border border-amber-200 text-slate-850 italic">
                "{existingRecord.lastRemark}"
              </p>
            )}
          </div>
        )}

        {/* UPI QR Code Expandable Panel (Requested by Sliet Hub for on-spot registration) */}
        {showQrCode && (
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 text-center animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="inline-block p-3 bg-white rounded-xl shadow-xs border border-emerald-200 mb-2">
              {/* Crisp SVG QR Code Representation */}
              <div className="w-36 h-36 mx-auto bg-zinc-900 rounded-lg p-2 flex flex-col items-center justify-center text-white relative">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                  <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" />
                  <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z" />
                  <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z" />
                  <rect x="50" y="50" width="8" height="8" />
                  <rect x="65" y="65" width="10" height="10" />
                  <rect x="80" y="50" width="10" height="15" />
                  <rect x="50" y="80" width="15" height="10" />
                  <rect x="75" y="80" width="15" height="10" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-emerald-600 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow">UPI</span>
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-emerald-950 mb-1">
              TechFEST '26 SLIET Longowal Official UPI
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 px-3 py-1 rounded-full text-xs font-mono text-emerald-800 mb-1">
              <span>sliet.techfest26@upi</span>
              <button 
                type="button" 
                onClick={copyUpiId}
                className="hover:text-emerald-950 transition-colors ml-1 cursor-pointer"
                title="Copy UPI ID"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-emerald-700">
              Registration Fee: ₹199 • Ask candidate to quote UTR / Ref number
            </p>
          </div>
        )}

        {/* Active Caller Device Recognition Bar */}
        <div className="px-5 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex items-center gap-1.5 text-zinc-600 truncate flex-wrap">
              <span className="text-[11px] text-zinc-500">Device:</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-zinc-800 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                {deviceInfo.deviceType === 'mobile' ? (
                  <Smartphone className="w-3 h-3 text-zinc-600 shrink-0" />
                ) : deviceInfo.deviceType === 'tablet' ? (
                  <Tablet className="w-3 h-3 text-zinc-600 shrink-0" />
                ) : (
                  <Laptop className="w-3 h-3 text-zinc-600 shrink-0" />
                )}
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {deviceInfo.deviceName}
                </span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-600 font-medium">
                <span>📍 {deviceInfo.location}</span>
                <span className="text-zinc-400 font-mono text-[10px]">({deviceInfo.ip})</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingStation(!isEditingStation)}
            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
            title="Customize device nickname or station"
          >
            <Settings2 className="w-3 h-3" />
            <span>{isEditingStation ? 'Close' : 'Nickname'}</span>
          </button>
        </div>

        {/* Optional Custom Device Station Editor */}
        {isEditingStation && (
          <form onSubmit={handleSaveStation} className="px-5 py-2.5 bg-zinc-100/90 border-b border-zinc-200 flex items-center gap-2 animate-in fade-in duration-150">
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              placeholder="e.g. Plexus Desk #1 or Sagar's iPhone"
              className="flex-1 bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900"
              autoFocus
            />
            <Button type="submit" size="sm" className="h-7 text-xs px-2.5 bg-zinc-900 text-white hover:bg-zinc-800">
              Save
            </Button>
          </form>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Field 1: Remark */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Enter call remarks & notes</span>
              <span className="text-[10px] font-mono text-slate-400">Summary</span>
            </label>
            <textarea
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Candidate confirmed payment completed via PhonePe. Shared UTR..."
              className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all resize-none shadow-xs"
              autoFocus
            />
          </div>

          {/* Field 2: Lead Number */}
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Lead Number</span>
              <span className="text-[10px] font-mono text-slate-400">Alternate phone / WhatsApp</span>
            </label>
            <Input
              type="text"
              value={leadNumber}
              onChange={(e) => setLeadNumber(e.target.value)}
              placeholder="e.g. 9876543210 (Direct candidate number)"
              className="font-mono text-xs bg-white border-slate-200 text-slate-900"
            />
          </div>

          {/* Field 3: Compulsory Status Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <span>Select Call Status</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <span className="text-[10px] font-mono text-amber-700 font-medium">
                Compulsory Selection
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.values(CALL_STATUSES).map((st) => {
                const isSelected = selectedStatus === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(st.id);
                      setHasError(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${st.badge} ring-2 ring-slate-900/10 shadow-xs font-medium`
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${st.indicator} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {st.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {st.shortLabel}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {hasError && !isCancelledParticipant && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-2 font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                Please select a call status before saving.
              </p>
            )}
          </div>

          {/* Payment & UTR Details */}
          {selectedStatus === 'PAYMENT_CLAIMED' && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-semibold text-xs text-emerald-900">
                    Payment Completed Confirmation
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 font-semibold">
                  No UTR Required
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Candidate confirmed payment completed. Simply click <strong>Confirm Payment Completed</strong> below.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-emerald-900 mb-1">
                    UTR / Ref No <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Optional (leave blank)"
                    className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-950 outline-none focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-emerald-900 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-emerald-950 outline-none focus:border-emerald-700"
                  >
                    <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
                    <option value="QR_SCAN">TechFEST QR Code Scan</option>
                    <option value="NETBANKING">Net Banking / IMPS</option>
                    <option value="CASH_DESK">Fest Secretariat Cash Desk</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                <span className="flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Ready to confirm payment
                </span>
                <span className="font-mono text-[10px]">Fee: ₹{amountPaid}</span>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <DialogFooter className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-slate-700 border-slate-200 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedStatus || (isCancelledParticipant && (!cancelReason || !revertOutcome))}
              className={
                selectedStatus === 'PAYMENT_CLAIMED'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold'
                  : selectedStatus
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                  : ''
              }
            >
              {isCancelledParticipant ? (
                <>
                  <XCircle className="w-4 h-4 mr-1 text-white" />
                  <span>Save Win-back Outcome</span>
                </>
              ) : selectedStatus === 'PAYMENT_CLAIMED' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1 text-white" />
                  <span>Confirm Payment Completed</span>
                </>
              ) : (
                'Save Call Record'
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
