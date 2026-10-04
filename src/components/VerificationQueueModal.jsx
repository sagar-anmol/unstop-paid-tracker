// src/components/VerificationQueueModal.jsx
import React, { useState } from 'react';
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

export default function VerificationQueueModal({ 
  isOpen, 
  participants, 
  currentUser, 
  onClose, 
  onTriggerCall,
  onTriggerToast 
}) {
  const [filter, setFilter] = useState('ALL'); // ALL, VERIFIED_PAID, PENDING_SYNC, DEFAULTER
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const queue = getPaymentVerificationQueue(participants);

  const filtered = queue.filter(item => {
    if (filter !== 'ALL' && item.verificationState !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (item.participant.name || '').toLowerCase().includes(q);
      const matchEvent = (item.participant.event_name || '').toLowerCase().includes(q);
      const matchPhone = (item.participant.phone || '').toLowerCase().includes(q);
      if (!matchName && !matchEvent && !matchPhone) return false;
    }
    return true;
  });

  const verifiedCount = queue.filter(q => q.verificationState === 'VERIFIED_PAID').length;
  const pendingCount = queue.filter(q => q.verificationState === 'PENDING_SYNC').length;
  const defaulterCount = queue.filter(q => q.verificationState === 'DEFAULTER').length;

  const handleManualAction = (participantId, status, reason) => {
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
    const headers = ['Participant ID', 'Candidate Name', 'Event', 'Phone', 'Claimed At', 'Elapsed Hours', 'Verification Status', 'Unstop Gateway Status', 'Last Caller'];
    const rows = filtered.map(item => [
      `"${item.participantId}"`,
      `"${item.participant.name || ''}"`,
      `"${item.participant.event_name || ''}"`,
      `"${item.participant.phone || ''}"`,
      `"${item.record.claimedAt || ''}"`,
      `"${item.elapsedHours} hrs"`,
      `"${item.stateLabel}"`,
      `"${item.isGatewayPaid ? 'Paid' : 'Unpaid'}"`,
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
                <h3 className="text-sm font-semibold text-slate-900">Payment Verification & Defaulter Desk</h3>
                {defaulterCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] font-mono">
                    {defaulterCount} Defaulters Flagged
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cross-matches participant claimed payments against Unstop Gateway records
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
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/60 divide-x divide-slate-200">
          <button
            onClick={() => setFilter('VERIFIED_PAID')}
            className={`p-3 text-left transition-all ${filter === 'VERIFIED_PAID' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-semibold">Verified in Gateway</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{verifiedCount}</div>
          </button>

          <button
            onClick={() => setFilter('PENDING_SYNC')}
            className={`p-3 text-left transition-all ${filter === 'PENDING_SYNC' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-semibold">Pending Nightly Sync</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{pendingCount}</div>
          </button>

          <button
            onClick={() => setFilter('DEFAULTER')}
            className={`p-3 text-left transition-all ${filter === 'DEFAULTER' ? 'bg-white shadow-xs' : 'hover:bg-slate-100/60'}`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-semibold">Defaulters (&gt;24h Unpaid)</div>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{defaulterCount}</div>
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
              placeholder="Search candidate name, phone or event..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none shadow-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${filter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            >
              All ({queue.length})
            </button>
          </div>
        </div>

        {/* Queue Items Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No participants currently in this verification category.
            </div>
          ) : (
            filtered.map((item) => {
              const p = item.participant;
              const rec = item.record;
              const isDefaulter = item.verificationState === 'DEFAULTER';

              return (
                <div
                  key={item.participantId}
                  className={`p-4 rounded-xl border transition-all ${
                    isDefaulter
                      ? 'bg-rose-50/50 border-rose-200 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isDefaulter ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isDefaulter ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
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
                        </p>
                        
                        {/* UTR & Payment Mode Display (Sliet Hub Meeting requirement) */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {item.utrNumber ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                              <span>UTR:</span>
                              <span className="select-all">{item.utrNumber}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Payment Confirmed
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {item.paymentMode || 'UPI / QR'}
                          </span>

                          <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            🗓️ Saturday Verification
                          </span>
                        </div>

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

                      {currentUser?.role === 'super_admin' && (
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
          <span>{queue.length} claimed registrations tracked against Unstop</span>
          <span className="font-mono text-[11px] text-slate-500">Auto-matched every 2 hours via Cloud Sync</span>
        </div>

      </div>
    </div>
  );
}
