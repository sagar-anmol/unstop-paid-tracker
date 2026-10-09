// src/components/VerificationQueueModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Download, 
  Phone, 
  PhoneCall, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getPaymentVerificationQueue, 
  setManualVerification 
} from '../utils/callStore';

// Decided by a human; never returned to the open queue
const TERMINAL_CLAIM_STATES = ['VERIFIED_PAID', 'REJECTED'];

const STATE_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'MATCH_FOUND', label: 'Needs Confirm' },
  { id: 'AWAITING_SETTLEMENT', label: 'Settling' },
  { id: 'PENDING_RECONCILE', label: 'Awaiting Check' },
  { id: 'DISPUTES', label: 'Disputes' },
  { id: 'VERIFIED_PAID', label: 'Confirmed' },
  { id: 'REJECTED', label: 'Rejected' }
];

export default function VerificationQueueModal({ 
  isOpen, 
  participants, 
  currentUser, 
  onClose, 
  onTriggerCall,
  onTriggerToast 
}) {
  // 'ALL', 'OPEN', 'DISPUTES', or a specific claim state id
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Reset to the full list each time the desk is opened so a stale filter from
  // a previous session does not hide claims.
  useEffect(() => {
    if (isOpen) {
      setFilter('ALL');
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const queue = getPaymentVerificationQueue(participants);

  // Approve/reject is gated on super admin OR an explicit can_verify_payments grant
  const canVerify = currentUser?.role === 'super_admin' || currentUser?.canVerifyPayments === true;

  const filtered = queue.filter(item => {
    if (filter === 'DISPUTES' && !['NO_MATCH', 'AMBIGUOUS'].includes(item.verificationState)) return false;
    if (filter === 'OPEN' && TERMINAL_CLAIM_STATES.includes(item.verificationState)) return false;
    if (!['ALL', 'DISPUTES', 'OPEN'].includes(filter) && item.verificationState !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (item.participant.name || '').toLowerCase().includes(q);
      const matchEvent = (item.participant.event_name || '').toLowerCase().includes(q);
      const matchPhone = (item.participant.phone || '').toLowerCase().includes(q);
      const matchEmail = (item.participant.email || '').toLowerCase().includes(q);
      if (!matchName && !matchEvent && !matchPhone && !matchEmail) return false;
    }
    return true;
  });

  const verifiedCount = queue.filter(q => q.verificationState === 'VERIFIED_PAID').length;
  const pendingCount = queue.filter(q => ['PENDING_RECONCILE', 'AWAITING_SETTLEMENT', 'REVERT_CLAIMED'].includes(q.verificationState)).length;
  const disputeCount = queue.filter(q => ['NO_MATCH', 'AMBIGUOUS'].includes(q.verificationState)).length;
  const matchFoundCount = queue.filter(q => q.verificationState === 'MATCH_FOUND').length;

  // Zero claims is the normal state for a fresh deployment, so it gets a short
  // explanation rather than an empty table.
  const emptyMessage = queue.length === 0
    ? 'No payment claims yet. When a coordinator logs a call as "Payment Completed", the claim appears here for reconciliation.'
    : 'Nothing in this category right now.';

  const handleManualAction = (participantId, status, reason) => {
    if (!canVerify) return;
    setManualVerification(participantId, status, currentUser, reason);
    if (onTriggerToast) {
      onTriggerToast({
        type: status === 'APPROVED' ? 'success' : 'error',
        message: `Payment status updated to ${status} for ID #${participantId}`
      });
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Participant ID', 'Candidate Name', 'Email', 'Event', 'Phone', 'Claimed At', 'Elapsed Hours', 'Verification Status', 'API Registration ID', 'API UTR', 'API Amount', 'API Status', 'Last Caller'];
    const rows = filtered.map(item => [
      `"${item.participantId}"`,
      `"${item.participant.name || ''}"`,
      `"${item.participant.email || ''}"`,
      `"${item.participant.event_name || ''}"`,
      `"${item.participant.phone || ''}"`,
      `"${item.record.claimedAt || ''}"`,
      `"${item.elapsedHours} hrs"`,
      `"${item.stateLabel}"`,
      `"${item.apiEvidence?.registrationId || ''}"`,
      `"${item.apiEvidence?.utr || ''}"`,
      `"${item.apiEvidence?.amount ?? ''}"`,
      `"${item.apiEvidence?.status || ''}"`,
      `"${item.record.history?.[0]?.callerName || 'Staff'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TechFEST_Payment_Verification_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Payment Verification Desk</h3>
                {disputeCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] font-mono">
                    {disputeCount} Dispute{disputeCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Claimed payments matched against techfest26.in by email
                {canVerify ? '' : ' • read-only for your role'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-xs text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/60 divide-x divide-slate-200">
          <button
            onClick={() => setFilter('VERIFIED_PAID')}
            className={`p-3 text-left transition-all ${filter === 'VERIFIED_PAID' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-semibold">Confirmed</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{verifiedCount}</div>
          </button>

          <button
            onClick={() => setFilter('MATCH_FOUND')}
            className={`p-3 text-left transition-all ${filter === 'MATCH_FOUND' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-violet-700 font-semibold">Needs Confirm</div>
            <div className="text-lg font-bold text-violet-700 mt-0.5">{matchFoundCount}</div>
          </button>

          <button
            onClick={() => setFilter('PENDING_RECONCILE')}
            className={`p-3 text-left transition-all ${filter === 'PENDING_RECONCILE' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-semibold">Awaiting Check</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{pendingCount}</div>
          </button>

          <button
            onClick={() => setFilter('DISPUTES')}
            className={`p-3 text-left transition-all ${filter === 'DISPUTES' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-semibold">Disputes</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{disputeCount}</div>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email or event..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
            {STATE_FILTERS.map(f => {
              const count = f.id === 'ALL'
                ? queue.length
                : f.id === 'OPEN'
                  ? queue.length - verifiedCount - queue.filter(q => q.verificationState === 'REJECTED').length
                  : f.id === 'DISPUTES'
                    ? disputeCount
                    : queue.filter(q => q.verificationState === f.id).length;

              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-medium whitespace-nowrap transition-all ${
                    filter === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                  <span className="ml-1 font-mono opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Queue Items Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
              {emptyMessage}
            </div>
          ) : (
            filtered.map((item) => {
              const p = item.participant;
              const rec = item.record;
              const isDispute = ['NO_MATCH', 'AMBIGUOUS'].includes(item.verificationState);
              const needsReview = item.verificationState === 'MATCH_FOUND';

              return (
                <div
                  key={item.participantId}
                  className={`p-4 rounded-xl border transition-all ${
                    isDispute
                      ? 'bg-rose-50/50 border-rose-200 shadow-xs'
                      : needsReview
                        ? 'bg-violet-50/40 border-violet-200 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isDispute
                          ? 'bg-rose-100 text-rose-700'
                          : needsReview
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isDispute ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900">{p.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border font-medium ${item.stateBadge}`}>
                            {item.stateLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.event_name} • Phone: <span className="font-mono text-slate-700">{p.phone || 'N/A'}</span>
                          {p.email && <> • <span className="font-mono text-slate-600">{p.email}</span></>}
                        </p>

                        {/* API reconciliation evidence */}
                        {item.apiEvidence ? (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-[11px]">
                            <div className="flex items-center gap-2 flex-wrap font-mono text-slate-600">
                              <span className="font-semibold text-slate-700">techfest26.in</span>
                              {item.apiEvidence.registrationId && <span>Reg: {item.apiEvidence.registrationId}</span>}
                              {item.apiEvidence.status && (
                                <span className={`font-semibold ${item.apiEvidence.status === 'completed' ? 'text-emerald-700' : item.apiEvidence.status === 'failed' ? 'text-rose-700' : 'text-amber-700'}`}>
                                  {item.apiEvidence.status}
                                </span>
                              )}
                              {item.apiEvidence.amount != null && item.apiEvidence.amount !== '' && (
                                <span>₹{Number(item.apiEvidence.amount).toLocaleString('en-IN')}</span>
                              )}
                              {item.apiEvidence.utr && <span className="select-all">UTR: {item.apiEvidence.utr}</span>}
                            </div>
                            {item.apiEvidence.note && (
                              <p className="mt-1 text-slate-500 leading-relaxed">{item.apiEvidence.note}</p>
                            )}
                            {item.apiEvidence.checkedAt && (
                              <p className="mt-1 text-[10px] text-slate-400 font-mono">
                                Checked {new Date(item.apiEvidence.checkedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Matched by email on the next hourly reconciliation run.
                          </p>
                        )}

                        <p className="text-[11px] text-slate-500 font-mono mt-1">
                          Claimed by caller {item.elapsedHours} hrs ago ({rec.history?.[0]?.callerName || 'Staff'})
                        </p>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {p.phone && p.phone !== 'N/A' && (
                        <button
                          onClick={() => {
                            if (onTriggerCall) onTriggerCall(p);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-semibold transition-all shadow-xs"
                          title="Call candidate to follow up"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call Again</span>
                        </button>
                      )}

                      {canVerify && (
                        <>
                          <button
                            onClick={() => handleManualAction(item.participantId, 'APPROVED', 'Verified by Admin')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all shadow-xs"
                            title="Mark as Verified Manually"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleManualAction(item.participantId, 'REJECTED', 'Defaulter / Unpaid')}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-xs"
                            title="Mark as Defaulter"
                          >
                            Flag Defaulter
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {rec.lastRemark && (
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700">
                      <span className="text-slate-500 font-medium">Caller Note: </span>
                      {rec.lastRemark}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{queue.length} claimed registrations tracked against techfest26.in</span>
          <span className="font-mono text-[11px] text-slate-500">Auto-matched every 2 hours via Cloud Sync</span>
        </div>

      </div>
    </div>
  );
}
