import React, { useEffect, useMemo } from 'react';
import { 
  X, 
  Phone, 
  PhoneCall, 
  Mail, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  Users, 
  Download, 
  ExternalLink,
  Crown,
  Clock,
  MessageSquare,
  AlertTriangle,
  History,
  Smartphone,
  Laptop,
  Tablet,
  Edit3,
  Trophy,
  Layers,
  RotateCcw
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { getAvatarStyle, getInitials } from '../utils/avatar';
import { getParticipantCallRecord, CALL_STATUSES } from '../utils/callStore';
import { getDomainForEvent } from '../utils/auth';
import { 
  isParticipantRefunded, 
  isParticipantPaid, 
  isParticipantUnpaid, 
  getPaymentBadgeConfig 
} from '../utils/paymentUtils';

export default function CandidateDrawer({ 
  participant, 
  currentUser, 
  onClose, 
  onTriggerCall, 
  callDbVersion = 0,
  onUpdateParticipant 
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!participant) return null;

  const initials = getInitials(participant.name);
  const avatarStyle = getAvatarStyle(participant.name);

  const cleanPhone = (participant.phone || '').replace(/[^0-9]/g, '');
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}` : null;
  const mailLink = participant.email && participant.email !== 'N/A' ? `mailto:${participant.email}` : null;

  const amt = Number(participant.amount) || 0;
  const hasMembers = participant.team_members && Array.isArray(participant.team_members) && participant.team_members.length > 0;

  // Retrieve call history & timeline
  const callRecord = useMemo(() => {
    if (!participant) return null;
    return getParticipantCallRecord(participant.id) || (participant.internal_id ? getParticipantCallRecord(participant.internal_id) : null);
  }, [participant, callDbVersion]);
  const callCount = callRecord?.callCount || 0;
  const history = callRecord?.history || [];
  const latestStatusDef = callRecord?.lastStatus ? CALL_STATUSES[callRecord.lastStatus] : null;

  // Edit state for WebDev and Super Admins
  const canEdit = currentUser?.role === 'super_admin' || currentUser?.role === 'webdev';
  const [isEditing, setIsEditing] = React.useState(false);
  const [editStatus, setEditStatus] = React.useState(participant.payment_status || (isParticipantRefunded(participant) ? 'REFUNDED' : (isParticipantPaid(participant) ? 'PAID' : 'UNPAID')));
  const [editAmount, setEditAmount] = React.useState(participant.amount !== undefined ? String(participant.amount) : '0');
  const [editPaymentId, setEditPaymentId] = React.useState(participant.payment_id || '');
  const [editUtr, setEditUtr] = React.useState(participant.utr_number || '');
  const [editRemark, setEditRemark] = React.useState(participant.admin_note || '');

  React.useEffect(() => {
    if (participant) {
      setEditStatus(participant.payment_status || (isParticipantRefunded(participant) ? 'REFUNDED' : (isParticipantPaid(participant) ? 'PAID' : 'UNPAID')));
      setEditAmount(participant.amount !== undefined ? String(participant.amount) : '0');
      setEditPaymentId(participant.payment_id || '');
      setEditUtr(participant.utr_number || '');
      setEditRemark(participant.admin_note || '');
      setIsEditing(false);
    }
  }, [participant]);

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (onUpdateParticipant) {
      onUpdateParticipant(participant.id, {
        payment_status: editStatus,
        is_paid: editStatus === 'PAID',
        is_refunded: editStatus === 'REFUNDED',
        amount: Number(editAmount) || 0,
        payment_id: editPaymentId.trim(),
        utr_number: editUtr.trim(),
        admin_note: editRemark.trim()
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Right Sheet */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-md lg:max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
            <div className="flex items-center gap-3">
              <span 
                style={avatarStyle}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold tracking-tight shadow-xs"
              >
                {initials}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 text-sm truncate max-w-[200px]">
                    {participant.name || 'Participant'}
                  </h3>
                  {participant.events && participant.events.length > 1 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Layers className="w-3 h-3 text-indigo-600" />
                      <span>{participant.events.length} Events</span>
                    </span>
                  ) : (
                    <Badge variant="info" className="text-[10px] font-mono">
                      {participant.event_type || 'Event'}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                  {participant.events && participant.events.length > 1 
                    ? `Unified Candidate Profile • ${participant.events.length} Competitions` 
                    : `ID: ${participant.id} • Ref: ${participant.payment_id || '--'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isEditing 
                      ? 'bg-zinc-900 text-white border-zinc-900' 
                      : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200 shadow-2xs'
                  }`}
                  title="Edit participant payment status & operations details"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit Record'}</span>
                </button>
              )}

              <Button
                variant="ghost"
                size="iconSm"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/40">
            
            {/* Quick Contact Actions Bar */}
            <div className="grid grid-cols-3 gap-2">
              {participant.phone && participant.phone !== 'N/A' && (
                <Button
                  variant="sky"
                  size="sm"
                  onClick={() => onTriggerCall && onTriggerCall(participant)}
                  className="font-semibold shadow-xs"
                  title="Call via phone and log remarks"
                >
                  <PhoneCall className="w-3.5 h-3.5 mr-1" />
                  <span>Call ({callCount})</span>
                </Button>
              )}

              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-xs"
                >
                  <span>WhatsApp</span>
                </a>
              )}

              {mailLink && (
                <a
                  href={mailLink}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </a>
              )}
            </div>

            {/* Interactive Record Editor for WebDev & Super Admins */}
            {isEditing && (
              <form onSubmit={handleSaveEdit} className="p-4 rounded-xl bg-white border border-zinc-300 shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-zinc-900" />
                    <span className="text-xs font-bold text-zinc-900">
                      Operations Record Editor
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 font-semibold">
                    {currentUser?.role === 'webdev' ? 'WebDev Access' : 'Super Admin'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                      Payment Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditStatus(val);
                        if (val === 'PAID' && (!editAmount || editAmount === '0')) {
                          setEditAmount('200');
                        } else if (val === 'FREE') {
                          setEditAmount('0');
                        }
                      }}
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 font-semibold text-zinc-900 focus:border-zinc-900 outline-none"
                    >
                      <option value="UNPAID">UNPAID (Pending techfest26.in)</option>
                      <option value="REFUNDED">REFUNDED (Unstop Refunded)</option>
                      <option value="PAID">PAID (techfest26.in Confirmed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                      Amount Collected (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="e.g. 200"
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 font-mono text-zinc-900 focus:border-zinc-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                      Payment / Txn Ref ID
                    </label>
                    <input
                      type="text"
                      value={editPaymentId}
                      onChange={(e) => setEditPaymentId(e.target.value)}
                      placeholder="e.g. ORD_1744..."
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 font-mono text-zinc-900 focus:border-zinc-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                      UTR / Direct UPI Ref <span className="text-zinc-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={editUtr}
                      onChange={(e) => setEditUtr(e.target.value)}
                      placeholder="Optional (leave empty)"
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 font-mono text-zinc-900 focus:border-zinc-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Editor Remark / Verification Note
                  </label>
                  <input
                    type="text"
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    placeholder="e.g. Verified by WebDev / Paid offline via UPI"
                    className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 text-zinc-900 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}

            {/* Custom Override Notice Banner if modified */}
            {participant._hasCustomOverride && !isEditing && (
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between">
                <span className="font-semibold">
                  ✏️ Operations Override Active: Updated by {participant._overrideMeta?.updatedBy || 'Staff'}
                </span>
                <span className="text-[10px] font-mono text-purple-600">
                  {participant._overrideMeta?.updatedAt ? new Date(participant._overrideMeta.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            )}

            {/* Registered Competitions Card (if multi-event candidate) */}
            {participant.events && participant.events.length > 1 && (
              <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-indigo-600" />
                    <span className="font-semibold text-xs text-slate-900">
                      All Registered Competitions ({participant.events.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                    Multi-Event Candidate
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {participant.events.map((ev, i) => {
                    const dom = getDomainForEvent(ev.event_name);
                    const isEvPaid = isParticipantPaid(ev);
                    const isEvRefunded = isParticipantRefunded(ev);
                    return (
                      <div key={ev.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {ev.event_name}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                            {dom && (
                              <span 
                                className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium border"
                                style={{
                                  borderColor: `${dom.accentColor}40`,
                                  color: dom.accentColor,
                                  backgroundColor: `${dom.accentColor}12`
                                }}
                              >
                                {dom.name}
                              </span>
                            )}
                            {ev.team_name && <span className="truncate">Team: {ev.team_name}</span>}
                          </div>
                        </div>

                        <div>
                          {isEvPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              Paid {Number(ev.amount) > 0 ? `₹${ev.amount}` : ''}
                            </span>
                          ) : isEvRefunded ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0 flex items-center gap-1">
                              <RotateCcw className="w-2.5 h-2.5 text-purple-600" />
                              Refunded {Number(ev.amount) > 0 ? `₹${ev.amount}` : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                              Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment & Verification Status Banner */}
            {isParticipantRefunded(participant) ? (
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 shadow-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-purple-700 font-semibold mb-0.5 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                  Refund Processed (Unstop)
                </div>
                <div className="flex items-center gap-2 font-semibold text-sm text-purple-900">
                  <span>Refunded {amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : ''} • techfest26.in Payment Pending</span>
                </div>
                <div className="text-[11px] text-purple-700 mt-1">
                  Unstop payment was refunded. Participant needs to complete their entry fee payment on techfest26.in.
                </div>
                {participant.payment_id && (
                  <div className="text-[10px] font-mono text-purple-600 mt-1.5 select-all">
                    Original Unstop Txn: {participant.payment_id}
                  </div>
                )}
              </div>
            ) : isParticipantPaid(participant) ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-semibold mb-0.5">
                  Payment Status
                </div>
                <div className="flex items-center gap-2 font-semibold text-sm text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Paid {amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : ''} (Gateway Confirmed)</span>
                </div>
                {participant.payment_id && (
                  <div className="text-[11px] font-mono text-emerald-700/80 mt-1 select-all">
                    Txn ID: {participant.payment_id}
                  </div>
                )}
              </div>
            ) : callRecord?.lastStatus === 'PAYMENT_CLAIMED' ? (
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 shadow-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 font-semibold mb-0.5">
                  Verification Status
                </div>
                <div className="flex items-center gap-2 font-semibold text-sm text-indigo-800">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Payment Claimed • Saturday Batch Verification Desk</span>
                </div>
                {callRecord.utrNumber && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-950 font-bold select-all">
                      UTR: {callRecord.utrNumber}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                      {callRecord.paymentMode || 'UPI'}
                    </span>
                  </div>
                )}
                <div className="text-[11px] font-mono text-indigo-700 mt-1">
                  Claimed: {new Date(callRecord.lastCalledAt).toLocaleString('en-IN')}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-semibold mb-0.5">
                  Registration Status
                </div>
                <div className="flex items-center gap-2 font-semibold text-sm text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Unpaid • Entry Fee Pending (techfest26.in)</span>
                </div>
                <div className="text-[11px] text-amber-700/90 mt-1">
                  Registration recorded. Participant needs to complete payment via official portal (techfest26.in).
                </div>
                <div className="text-[11px] font-mono text-amber-700/80 mt-1 select-all">
                  Unstop Reg ID: {participant.id}
                </div>
              </div>
            )}

            {/* CALL HISTORY TIMELINE SECTION */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-xs text-slate-900">
                    Operations Call Timeline ({callCount} Calls)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {latestStatusDef && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border font-medium ${latestStatusDef.badge}`}>
                      {latestStatusDef.label}
                    </span>
                  )}
                  {participant.phone && participant.phone !== 'N/A' && (
                    <button
                      onClick={() => onTriggerCall && onTriggerCall(participant)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-all flex items-center gap-1"
                    >
                      <PhoneCall className="w-2.5 h-2.5 text-sky-600" />
                      <span>+ Log Call</span>
                    </button>
                  )}
                </div>
              </div>

              {history.length > 0 ? (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                  {history.map((call, idx) => {
                    const st = CALL_STATUSES[call.status] || {};
                    const dateFormatted = call.timestamp ? new Date(call.timestamp).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '--';

                    return (
                      <div key={call.id || idx} className="relative flex items-start gap-3 pl-8">
                        {/* Timeline Node */}
                        <div className={`absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${st.indicator || 'bg-slate-400'}`} />

                        <div className="flex-1 p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-slate-900">
                              <span>{call.callerName}</span>
                              <span className="text-[10px] font-mono text-slate-500">
                                ({call.callerTeam || 'Team'})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {call.device && (
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-600 bg-zinc-100 border border-zinc-200"
                                  title={`Logged via: ${call.device} • Location: ${call.location || 'SLIET Punjab'}${call.ip ? ` • IP: ${call.ip}` : ''}`}
                                >
                                  {call.deviceType === 'mobile' ? (
                                    <Smartphone className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                                  ) : call.deviceType === 'tablet' ? (
                                    <Tablet className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                                  ) : (
                                    <Laptop className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[110px] sm:max-w-[150px]">{call.device}</span>
                                  {call.location && (
                                    <>
                                      <span className="text-zinc-300">•</span>
                                      <span className="text-zinc-500 truncate max-w-[90px]">📍 {call.location.split(',')[0]}</span>
                                    </>
                                  )}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                {dateFormatted}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 my-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium ${st.badge || 'border-slate-300 text-slate-700 bg-white'}`}>
                              {st.label || call.status}
                            </span>
                            {call.leadNumber && (
                              <span className="text-[10px] font-mono text-slate-500">
                                Lead: {call.leadNumber}
                              </span>
                            )}
                          </div>

                          <p className="text-slate-600 text-[11px] leading-relaxed">
                            {call.remark}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  <p>No calls logged yet for this participant.</p>
                  {participant.phone && participant.phone !== 'N/A' && (
                    <button
                      onClick={() => onTriggerCall && onTriggerCall(participant)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-medium transition-all shadow-xs"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Initiate 1st Call</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Candidate Profile Details */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
                <User className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-xs text-slate-900">Candidate Profile</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <dt className="text-slate-500">Candidate:</dt>
                <dd className="col-span-2 font-medium text-slate-900 select-all">{participant.name}</dd>

                <dt className="text-slate-500">Email:</dt>
                <dd className="col-span-2 font-mono text-slate-700 select-all truncate">{participant.email || 'N/A'}</dd>

                <dt className="text-slate-500">Mobile:</dt>
                <dd className="col-span-2 font-mono text-slate-700 select-all">{participant.phone || 'N/A'}</dd>

                <dt className="text-slate-500">College:</dt>
                <dd className="col-span-2 text-slate-800">{participant.college || 'N/A'}</dd>

                {participant.specialization && (
                  <>
                    <dt className="text-slate-500">Course / Branch:</dt>
                    <dd className="col-span-2 text-slate-700">{participant.specialization}</dd>
                  </>
                )}

                {participant.passing_year && (
                  <>
                    <dt className="text-slate-500">Graduation Year:</dt>
                    <dd className="col-span-2 font-mono text-slate-700">{participant.passing_year}</dd>
                  </>
                )}

                <dt className="text-slate-500">Registered At:</dt>
                <dd className="col-span-2 font-mono text-slate-600">
                  {participant.registered_at ? new Date(participant.registered_at).toLocaleString('en-IN') : 'N/A'}
                </dd>
              </dl>

              {/* Download Resume Link if Available */}
              {participant.resume_url && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                  <a
                    href={participant.resume_url.startsWith('http') ? participant.resume_url : 'https://d8it4huxumps7.cloudfront.net/' + participant.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Uploaded Resume PDF</span>
                  </a>
                </div>
              )}
            </div>

            {/* Team Roster Section */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold text-xs text-slate-900">
                    Team: {participant.team_name || 'Individual'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {(participant.team_members || []).length} Member(s)
                </span>
              </div>

              {hasMembers ? (
                <div className="space-y-2">
                  {participant.team_members.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <span>{m.name || 'Member'}</span>
                          {idx === 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              <Crown className="w-2.5 h-2.5 text-amber-600" /> LEADER
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 truncate max-w-[150px]">{m.college}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 select-all">
                        {m.email} {m.phone && `• ${m.phone}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-500 italic">
                  Solo Participant (Individual Registration)
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Unstop ID: {participant.internal_id || participant.id}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-slate-700 bg-white hover:bg-slate-100 border-slate-200 shadow-xs"
            >
              Close
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
