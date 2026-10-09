import React, { useMemo } from 'react';
import { 
  PhoneCall, 
  ShieldCheck, 
  ArrowUpRight,
  Smartphone,
  Laptop,
  Tablet,
  RotateCcw
} from 'lucide-react';
import { DOMAINS_DIRECTORY } from '../utils/auth';
import { getAuditLogs, getCallRecords } from '../utils/callStore';
import { 
  isParticipantRefunded, 
  isParticipantUnpaid,
  isParticipantCancelled 
} from '../utils/paymentUtils';

export default function BentoGrid({ 
  participants = [], 
  summary = {}, 
  currentUser,
  activeDomainId,
  callDbVersion = 0,
  onOpenAuditLogs,
  onOpenVerificationQueue
}) {
  // Exact real numbers from dataset
  const totalCount = participants.length;
  
  // Refunded candidates from Unstop
  const refundedCount = useMemo(() => {
    return participants.filter(p => isParticipantRefunded(p)).length;
  }, [participants]);

  // Unpaid candidates awaiting payment on techfest26.in
  const unpaidCount = useMemo(() => {
    return participants.filter(p => isParticipantUnpaid(p)).length;
  }, [participants]);

  const refundedPrecise = totalCount > 0 ? ((refundedCount / totalCount) * 100).toFixed(1) : '0.0';
  const unpaidPrecise = totalCount > 0 ? ((unpaidCount / totalCount) * 100).toFixed(1) : '0.0';

  // Real catalog scale, derived rather than hardcoded
  const eventCount = useMemo(() => {
    return summary?.total_events_scanned || new Set(participants.map(p => p.event_name).filter(Boolean)).size;
  }, [summary, participants]);

  const eventsWithEntries = useMemo(() => {
    return new Set(participants.map(p => p.event_name).filter(Boolean)).size;
  }, [participants]);

  const eventsWithEntriesPct = eventCount > 0
    ? Math.min(100, Math.round((eventsWithEntries / eventCount) * 100))
    : 0;

  const domainCount = Object.keys(DOMAINS_DIRECTORY).length;
  const cancelledCount = useMemo(
    () => participants.filter(p => isParticipantCancelled(p)).length,
    [participants]
  );
  const revertedCount = useMemo(
    () => participants.filter(p => isParticipantCancelled(p) && p.cancel_reverted).length,
    [participants]
  );

  // Real call stats from the CRM store. The store lives in localStorage, so
  // callDbVersion (bumped by App after every sync) is the invalidation signal.
  const callRecords = useMemo(() => getCallRecords(), [callDbVersion]);
  const calledCount = useMemo(() => {
    return Object.values(callRecords).filter(r => (r.callCount || 0) > 0).length;
  }, [callRecords]);

  // Activity distribution across dates
  const chartBars = useMemo(() => {
    const datesMap = {};
    const refMap = {};
    const unpMap = {};

    participants.forEach(p => {
      if (p.registered_at) {
        const d = p.registered_at.substring(0, 10);
        datesMap[d] = (datesMap[d] || 0) + 1;
        if (isParticipantRefunded(p)) {
          refMap[d] = (refMap[d] || 0) + 1;
        } else {
          unpMap[d] = (unpMap[d] || 0) + 1;
        }
      }
    });

    const sortedDates = Object.keys(datesMap).sort();
    const recentDates = sortedDates.slice(-7);
    if (recentDates.length === 0) {
      return [];
    }

    const max = Math.max(...recentDates.map(d => datesMap[d] || 1));
    return recentDates.map(d => {
      const parts = d.split('-');
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const count = datesMap[d] || 0;
      const ref = refMap[d] || 0;
      const unp = unpMap[d] || 0;
      const height = Math.max(14, Math.round(Math.pow(count / max, 0.42) * 100));
      return { label, count, ref, unp, height };
    });
  }, [participants]);

  // Real recent operations activities from audit store
  const recentActivities = useMemo(() => {
    // getAuditLogs reads localStorage, which is not a React dependency; App
    // remounts the grid via a key when a sync completes so this re-runs.
    const logs = getAuditLogs().slice(0, 8);
    if (logs.length > 0) {
      return logs.map((l, idx) => ({
        id: l.id || idx,
        title: `${l.actorName || 'Staff'} → ${l.targetName || 'Participant'}`,
        subtitle: l.details || l.eventName || 'Call logged',
        time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        icon: ['VERIFY_PAYMENT', 'CLAIM_RESOLVED'].includes(l.action)
          ? ShieldCheck
          : ['CANCELLATION_CONTACTED', 'CANCELLATION_REVERTED'].includes(l.action)
            ? RotateCcw
            : PhoneCall,
        device: l.device,
        deviceType: l.deviceType
      }));
    }
    return [];
  }, []);

  return (
    <div className="mb-8 font-sans">
      
      {/* Two cards plus the full-width activity feed below */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* ========================================================
            CARD 1: Registration Velocity & Daily Chart Breakdown
            ======================================================== */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
                  Registration Flow
                </h3>
                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full font-semibold">
                  {totalCount.toLocaleString('en-IN')} Total
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Daily registrations over the last 7 days
            </p>

            {/* Minimalist Neutral Bar Chart with Tooltips */}
            {chartBars.length === 0 ? (
              <div className="h-32 flex items-center justify-center border-b border-zinc-100 mb-4 text-xs text-zinc-400">
                No registration timeline available
              </div>
            ) : (
              <div className="h-32 flex items-end justify-between gap-1 sm:gap-2.5 px-1 sm:px-2 pt-2 pb-1 mb-4 border-b border-zinc-100">
                {chartBars.map((bar, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Hover Floating Pill */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[9.5px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10 font-mono shadow-sm">
                      {bar.count.toLocaleString('en-IN')} leads
                    </div>
                    
                    <div className="w-full relative flex items-end justify-center h-full">
                      <div 
                        style={{ height: `${bar.height}%` }}
                        className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                          idx === chartBars.length - 1 
                            ? 'bg-zinc-900 shadow-xs' 
                            : 'bg-zinc-500 hover:bg-zinc-700'
                        }`}
                        title={`${bar.label}: ${bar.count.toLocaleString('en-IN')} registrations (${bar.ref} refunded, ${bar.unp} awaiting payment)`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-900 truncate">
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Single canonical status split: unpaid vs refunded */}
            <div className="mb-1">
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-1">
                <span className="font-semibold text-amber-700">
                  Unpaid: {unpaidCount.toLocaleString('en-IN')} ({unpaidPrecise}%)
                </span>
                <span className="font-semibold text-purple-700">
                  Refunded: {refundedCount.toLocaleString('en-IN')} ({refundedPrecise}%)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAuditLogs}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>View Operations Audit Report</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>


        {/* ========================================================
            CARD 2: Registration Milestones & Conversion Funnel
            ======================================================== */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
                Registration Milestones
              </h3>
              <button 
                onClick={onOpenVerificationQueue}
                className="text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Verification Desk
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Payment status breakdown across {eventCount} competitions
            </p>

            <div className="space-y-4">
              
              {/* Target 1: Refunded on Unstop */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-purple-600" />
                    REFUNDED ON UNSTOP
                  </span>
                  <span className="font-mono font-bold text-purple-900 text-sm">
                    {refundedCount.toLocaleString('en-IN')}
                  </span>
                </div>
                
                {/* Purple Progress Bar */}
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: `${Math.max(1, Math.round((refundedCount / (totalCount || 1)) * 100))}%` }}
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{refundedPrecise}% refunded by fest team</span>
                  <span className="font-medium text-purple-700">{refundedCount} / {totalCount}</span>
                </div>
              </div>

              {/* Target 2: Unpaid Candidates */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    UNPAID CANDIDATES
                  </span>
                  <span className="font-mono font-bold text-amber-800 text-sm">
                    {unpaidCount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: `${Math.min(100, Math.round((unpaidCount / (totalCount || 1)) * 100))}%` }}
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{unpaidPrecise}% entry fee pending</span>
                  <span className="font-medium text-amber-700">{unpaidCount} / {totalCount}</span>
                </div>
              </div>

              {/* Target 3: Cancellation Win-Back */}
              {cancelledCount > 0 && (
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-rose-600" />
                      CANCELLATION WIN-BACK
                    </span>
                    <span className="font-mono font-bold text-rose-900 text-sm">
                      {cancelledCount}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                    <div
                      style={{ width: `${cancelledCount > 0 ? Math.round((revertedCount / cancelledCount) * 100) : 0}%` }}
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{revertedCount} won back</span>
                    <span className="font-medium text-rose-700">{cancelledCount - revertedCount} to contact</span>
                  </div>
                </div>
              )}

              {/* Target 4: Technical Catalog Scale */}
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    EVENTS & DOMAINS
                  </span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    {eventCount} Events
                  </span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div
                    style={{ width: `${eventsWithEntriesPct}%` }}
                    className="bg-zinc-700 h-full rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{domainCount} Technical Bays & Domains</span>
                  <span className="font-medium text-zinc-700">
                    {eventsWithEntries} with entries
                  </span>
                </div>
              </div>

            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 text-xs text-zinc-400 flex items-center justify-between">
            <span>Total Leads: {totalCount.toLocaleString('en-IN')}</span>
            <span className="font-mono text-zinc-500">
              Called: {calledCount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* ========================================================
            CARD 2: Recent Operations Activity
            ======================================================== */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
                Recent Operations Activity
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Live caller updates, win-back attempts and reconciled claims
              </p>
            </div>

            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-zinc-900 text-white shrink-0">
              {recentActivities.length} logs
            </span>
          </div>

          {/* List Rows or Clean Empty State */}
          {recentActivities.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-zinc-400">
              <PhoneCall className="w-8 h-8 mx-auto mb-2 text-zinc-300 stroke-[1.5]" />
              <p className="text-xs font-medium text-zinc-600">No calling activity logged yet</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Calls, win-back attempts and reconciled claims appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 mt-3">
              {recentActivities.map((act) => {
                const IconComp = act.icon;
                return (
                  <div
                    key={act.id}
                    className="py-3 flex items-center justify-between gap-3 group hover:bg-zinc-50/60 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0 group-hover:bg-zinc-200 transition-colors">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs text-zinc-900 flex items-center justify-between gap-2">
                          <span className="truncate">{act.title}</span>
                          <span className="text-[10.5px] font-medium text-zinc-400 shrink-0">
                            {act.time}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mt-0.5">
                          <div className="text-[11px] text-zinc-500 truncate">
                            {act.subtitle}
                          </div>
                          {act.device && (
                            <span
                              className="inline-flex items-center gap-1 text-[9.5px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/60 shrink-0 self-start sm:self-auto"
                              title={`Logged via: ${act.device}`}
                            >
                              {act.deviceType === 'mobile' ? (
                                <Smartphone className="w-2.5 h-2.5 text-zinc-400" />
                              ) : act.deviceType === 'tablet' ? (
                                <Tablet className="w-2.5 h-2.5 text-zinc-400" />
                              ) : (
                                <Laptop className="w-2.5 h-2.5 text-zinc-400" />
                              )}
                              <span className="truncate max-w-[120px]">{act.device}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
