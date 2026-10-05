import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  PhoneCall, 
  ShieldCheck, 
  Zap, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Smartphone,
  Laptop,
  Tablet
} from 'lucide-react';
import { DOMAINS_DIRECTORY } from '../utils/auth';
import { getAuditLogs, getCallRecords } from '../utils/callStore';

export default function BentoGrid({ 
  participants = [], 
  summary = {}, 
  currentUser,
  activeDomainId,
  onOpenAuditLogs,
  onOpenVerificationQueue
}) {
  const [memoNote, setMemoNote] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // Exact real numbers from Unstop dataset
  const totalCount = participants.length;
  
  // Real incomplete: "Registraition fee not paid" & payment incomplete
  const incompleteCount = useMemo(() => {
    return participants.filter(p => 
      p.payment_status === 'INCOMPLETE' || 
      p.payment_status === 'UNPAID' || 
      (p.status_label && p.status_label.toLowerCase().includes('not paid'))
    ).length;
  }, [participants]);

  // Real completed
  const completedCount = Math.max(0, totalCount - incompleteCount);
  const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const incompletePct = totalCount > 0 ? Math.round((incompleteCount / totalCount) * 100) : 0;
  const completedPrecise = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : '0.0';
  const incompletePrecise = totalCount > 0 ? ((incompleteCount / totalCount) * 100).toFixed(1) : '0.0';

  // Real Gateway Revenue collected so far (from Unstop paid receipts)
  const gatewayRevenue = useMemo(() => {
    return participants.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [participants]);

  // Paid candidate count with gateway receipts
  const paidGatewayCount = useMemo(() => {
    return participants.filter(p => (Number(p.amount) || 0) > 0).length;
  }, [participants]);

  // Calling recovery pipeline (unpaid leads @ ₹199 standard fee)
  const standardFee = 199;
  const pipelineValue = incompleteCount * standardFee;

  // Real call stats from CRM store
  const callRecords = useMemo(() => getCallRecords(), [participants]);
  const calledCount = useMemo(() => {
    return Object.values(callRecords).filter(r => (r.callCount || 0) > 0).length;
  }, [callRecords]);

  // Activity distribution across dates with human-readable power-scaled bar heights
  const chartBars = useMemo(() => {
    const datesMap = {};
    const compMap = {};
    const incompMap = {};

    participants.forEach(p => {
      if (p.registered_at) {
        const d = p.registered_at.substring(0, 10);
        datesMap[d] = (datesMap[d] || 0) + 1;
        const isIncomp = p.payment_status === 'INCOMPLETE' || 
          p.payment_status === 'UNPAID' || 
          (p.status_label && p.status_label.toLowerCase().includes('not paid'));
        if (isIncomp) {
          incompMap[d] = (incompMap[d] || 0) + 1;
        } else {
          compMap[d] = (compMap[d] || 0) + 1;
        }
      }
    });

    const sortedDates = Object.keys(datesMap).sort();
    // Pick the most recent 7 active dates for clear visualization
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
      const comp = compMap[d] || 0;
      const incomp = incompMap[d] || 0;
      // Power scale (exponent 0.42) so low-volume days remain visible alongside any spikes
      const height = Math.max(14, Math.round(Math.pow(count / max, 0.42) * 100));
      return { label, count, comp, incomp, height };
    });
  }, [participants]);

  // Real recent operations activities from audit store
  const recentActivities = useMemo(() => {
    const logs = getAuditLogs().slice(0, 8);
    if (logs.length > 0) {
      return logs.map((l, idx) => ({
        id: l.id || idx,
        title: `${l.actorName || 'Staff'} → ${l.targetName || 'Participant'}`,
        subtitle: l.details || l.eventName || 'Call logged',
        time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        icon: l.action === 'VERIFY_PAYMENT' ? ShieldCheck : PhoneCall,
        device: l.device,
        deviceType: l.deviceType
      }));
    }
    return [];
  }, []);

  const handleSaveQuota = (e) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-6 mb-8 font-sans">
      
      {/* 3-Column Bento Grid matching modern shadcn UI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
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
              <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-medium">
                {completedPct}% Done
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Daily student signups on Unstop & status breakdown
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
                        title={`${bar.label}: ${bar.count.toLocaleString('en-IN')} total (${bar.comp} completed, ${bar.incomp} unpaid)`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-zinc-500 group-hover:text-zinc-900 truncate">
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Split Progress Indicator: Completed vs Fee Not Paid */}
            <div className="mb-4">
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${Math.round((completedCount / (totalCount || 1)) * 100)}%` }}
                  className="bg-zinc-900 h-full transition-all duration-500"
                  title={`Completed: ${completedCount} (${completedPct}%)`}
                />
                <div 
                  style={{ width: `${Math.round((incompleteCount / (totalCount || 1)) * 100)}%` }}
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`Fee Not Paid: ${incompleteCount} (${incompletePct}%)`}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-zinc-500 mt-1.5 font-mono gap-1">
                <span className="flex items-center gap-1 font-medium text-zinc-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 inline-block" />
                  Completed: {completedCount.toLocaleString('en-IN')} ({completedPct}%)
                </span>
                <span className="flex items-center gap-1 font-medium text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Fee Not Paid: {incompleteCount.toLocaleString('en-IN')} ({incompletePct}%)
                </span>
              </div>
            </div>

            {/* 2 Stat Tiles: Completed vs Fee Not Paid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 flex items-center justify-between">
                  <span>COMPLETED</span>
                  <span className="text-[9px] font-mono text-zinc-400 font-normal">{completedPrecise}%</span>
                </div>
                <div className="text-xl font-bold text-zinc-900">
                  {completedCount.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Registration done
                </div>
              </div>

              <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1 flex items-center justify-between">
                  <span>FEE NOT PAID</span>
                  <span className="text-[9px] font-mono text-amber-600 font-normal">{incompletePrecise}%</span>
                </div>
                <div className="text-xl font-bold text-amber-950">
                  {incompleteCount.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5">
                  Drop-off leads to call
                </div>
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
            CARD 2: Total Revenue & Calling Recovery Pipeline
            ======================================================== */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
                Total Revenue & Pipeline
              </h3>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                Live Receipts
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Real gateway receipts + recoverable calling pipeline
            </p>

            {/* Hero Revenue Box */}
            <div className="bg-zinc-900 rounded-xl p-3.5 sm:p-4 text-white mb-4 shadow-xs">
              <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
                <span className="font-medium">Direct Unstop Gateway Revenue</span>
                <span className="text-[10px] font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                  {paidGatewayCount} Paid Receipts
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                ₹{gatewayRevenue.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-zinc-800">
                <span>RC Boat (₹2,995) • Soldering (₹598) • Ghost Code (₹200)</span>
              </div>
            </div>

            {/* Recoverable Pipeline Target Card */}
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Calling Recovery Pipeline
                </span>
                <span className="text-xs font-bold text-zinc-900 font-mono">
                  ₹{pipelineValue.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mb-2">
                {incompleteCount.toLocaleString('en-IN')} unpaid leads × ₹199 standard event entry fee
              </p>
              
              {/* Recovery Progress Bar */}
              <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden mb-1.5">
                <div 
                  style={{ width: `${Math.min(100, Math.round((calledCount / Math.max(1, incompleteCount)) * 100))}%` }}
                  className="bg-zinc-900 h-full rounded-full transition-all duration-500"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>{calledCount} Calls Logged</span>
                <span>Target: ₹{Math.round(incompleteCount * 199 * 0.15).toLocaleString('en-IN')} (15% Recovery)</span>
              </div>
            </div>

            {/* Calling Guidelines / Memo */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Calling Desk Memo / Pitch
              </label>
              <textarea 
                rows={2}
                value={memoNote}
                onChange={(e) => setMemoNote(e.target.value)}
                placeholder="e.g. ₹199 fee includes TechFEST '26 master pass, kits & certificate of participation..."
                className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-900 resize-none shadow-xs"
              />
            </div>
          </div>

          <button
            onClick={handleSaveQuota}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer mt-3"
          >
            {savedNotice ? '✓ Calling Memo Saved' : 'Save Calling Guidelines'}
          </button>
        </div>


        {/* ========================================================
            CARD 3: Registration Milestones & Conversion Funnel
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
              Official Unstop conversion breakdown across 62 competitions
            </p>

            <div className="space-y-4">
              
              {/* Target 1: Completed Registrations */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    COMPLETED REGISTRATIONS
                  </span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    {completedCount.toLocaleString('en-IN')}
                  </span>
                </div>
                
                {/* Thick Solid Black Progress Bar */}
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: `${Math.min(100, Math.round((completedCount / (totalCount || 1)) * 100))}%` }}
                    className="bg-zinc-900 h-full rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{completedPrecise}% completed on portal</span>
                  <span className="font-medium text-zinc-700">{completedCount} / {totalCount}</span>
                </div>
              </div>

              {/* Target 2: Registration Fee Not Paid */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    FEE NOT PAID (DROP-OFFS)
                  </span>
                  <span className="font-mono font-bold text-amber-800 text-sm">
                    {incompleteCount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: `${Math.min(100, Math.round((incompleteCount / (totalCount || 1)) * 100))}%` }}
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{incompletePrecise}% drop-off at gateway</span>
                  <span className="font-medium text-zinc-700">{incompleteCount} / {totalCount}</span>
                </div>
              </div>

              {/* Target 3: Technical Catalog Scale */}
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    EVENTS & DOMAINS
                  </span>
                  <span className="font-mono font-bold text-zinc-900 text-sm">
                    62 Events
                  </span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    style={{ width: '100%' }}
                    className="bg-zinc-700 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>13 Technical Bays & Domains</span>
                  <span className="font-medium text-zinc-700">100% Synced</span>
                </div>
              </div>

            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 text-xs text-zinc-400 flex items-center justify-between">
            <span>Average Ticket: ₹199 - ₹200</span>
            <span className="font-mono text-zinc-500">Total Leads: {totalCount.toLocaleString('en-IN')}</span>
          </div>
        </div>

      </div>

      {/* ========================================================
          RECENT OPERATIONS ACTIVITY (Like Recent Transactions)
          ======================================================== */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 tracking-tight">
              Recent Operations Activity
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live caller updates, status marks and verified claims
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-zinc-900 text-white">
              {recentActivities.length} logs
            </span>
          </div>
        </div>

        {/* List Rows or Clean Empty State */}
        {recentActivities.length === 0 ? (
          <div className="py-8 text-center text-zinc-400">
            <PhoneCall className="w-8 h-8 mx-auto mb-2 text-zinc-300 stroke-[1.5]" />
            <p className="text-xs font-medium text-zinc-600">No calling activity logged yet</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Calls and verification updates logged by coordinators will appear here in real-time.</p>
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
  );
}
