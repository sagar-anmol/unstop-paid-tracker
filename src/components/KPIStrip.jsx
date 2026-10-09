import React, { useMemo } from 'react';
import { Users, IndianRupee, ShieldCheck, PhoneCall, Clock, XCircle } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { isParticipantRefunded, isParticipantUnpaid, isParticipantCancelled } from '../utils/paymentUtils';
import { getCallRecords, getPaymentVerificationQueue } from '../utils/callStore';

// Only a human decision ends a claim; everything else stays open
const TERMINAL_CLAIM_STATES = ['VERIFIED_PAID', 'REJECTED'];

function ProgressBar({ pct, trackClass = "bg-zinc-200", barClass = "bg-slate-900" }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className={`w-full h-1.5 rounded-full overflow-hidden ${trackClass}`}>
      <div
        style={{ width: `${clamped}%` }}
        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
      />
    </div>
  );
}

export default function KPIStrip({ summary, participants, techfestPayments }) {
  const totalCount = participants.length;

  const refundedCount = useMemo(
    () => participants.filter(p => isParticipantRefunded(p)).length,
    [participants]
  );
  const unpaidCount = useMemo(
    () => participants.filter(p => isParticipantUnpaid(p)).length,
    [participants]
  );

  // Real collected figures come from the techfest26.in payments API snapshot,
  // synced hourly by CI. Nothing is inferred when the snapshot is empty.
  const paymentStats = useMemo(() => {
    const records = Array.isArray(techfestPayments?.records) ? techfestPayments.records : [];
    if (records.length === 0) {
      return { available: false, paidCount: 0, collected: 0, pendingCount: 0 };
    }
    const completed = records.filter(r => r.paymentStatus === 'completed');
    return {
      available: true,
      paidCount: completed.length,
      collected: completed.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
      pendingCount: records.length - completed.length
    };
  }, [techfestPayments]);

  // Cancellation win-back progress. Outstanding work is split by whether anyone
  // has actually called them yet, so the card points at the next action.
  const winBack = useMemo(() => {
    const records = getCallRecords();
    const cancelled = participants.filter(p => isParticipantCancelled(p));
    const reverted = cancelled.filter(p => p.cancel_reverted).length;
    const outstanding = cancelled.filter(p => !p.cancel_reverted);
    const contacted = outstanding.filter(p => (records[String(p.id)]?.callCount || 0) > 0).length;

    return {
      total: cancelled.length,
      reverted,
      outstanding: outstanding.length,
      contacted,
      uncontacted: outstanding.length - contacted,
      ratePct: cancelled.length > 0 ? (reverted / cancelled.length) * 100 : 0
    };
  }, [participants]);

  // Real call coverage from the local call store (1 row per participant)
  const { calledCount, callCoveragePct } = useMemo(() => {
    const records = getCallRecords();
    const called = Object.keys(records).filter(
      pid => (records[pid]?.callCount || 0) > 0 && participants.some(p => String(p.id) === String(pid))
    ).length;
    return {
      calledCount: called,
      callCoveragePct: totalCount > 0 ? (called / totalCount) * 100 : 0
    };
  }, [participants, totalCount]);

  // Verification desk progress: claims raised vs claims already resolved
  const { claimCount, resolvedCount, verificationPct, oldestPendingHours } = useMemo(() => {
    const queue = getPaymentVerificationQueue(participants);
    const resolved = queue.filter(q => TERMINAL_CLAIM_STATES.includes(q.verificationState)).length;
    const pending = queue.filter(q => !TERMINAL_CLAIM_STATES.includes(q.verificationState));
    const oldest = pending.reduce((max, q) => Math.max(max, q.elapsedHours || 0), 0);
    return {
      claimCount: queue.length,
      resolvedCount: resolved,
      verificationPct: queue.length > 0 ? (resolved / queue.length) * 100 : 0,
      oldestPendingHours: Math.round(oldest)
    };
  }, [participants]);

  const collectedPct = paymentStats.available && totalCount > 0
    ? (paymentStats.paidCount / totalCount) * 100
    : 0;
  const collegeCount = summary?.total_colleges || new Set(participants.map(p => p.college).filter(Boolean)).size;
  const eventCount = summary?.total_events_scanned || new Set(participants.map(p => p.event_name)).size;
  const lastSyncedAt = summary?.last_synced_at;

  const cards = [
    {
      label: "Registrations",
      value: totalCount.toLocaleString('en-IN'),
      badgeText: "UNSTOP",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
      valueColor: "text-slate-900",
      subtext: `${unpaidCount.toLocaleString('en-IN')} awaiting payment`,
      progress: {
        pct: totalCount > 0 ? (unpaidCount / totalCount) * 100 : 0,
        barClass: "bg-amber-400",
        label: `${unpaidCount.toLocaleString('en-IN')} unpaid`,
        value: `${refundedCount.toLocaleString('en-IN')} refunded`
      },
      icon: Users,
      iconBg: "bg-sky-50 text-sky-600"
    },
    {
      label: "Collected",
      value: paymentStats.available ? `₹${paymentStats.collected.toLocaleString('en-IN')}` : "—",
      badgeText: paymentStats.available ? "TECHFEST26.IN" : "AWAITING SYNC",
      badgeClass: paymentStats.available
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-zinc-50 text-zinc-500 border-zinc-200",
      valueColor: paymentStats.available ? "text-emerald-700" : "text-zinc-400",
      subtext: paymentStats.available
        ? `${paymentStats.paidCount.toLocaleString('en-IN')} completed • ${paymentStats.pendingCount.toLocaleString('en-IN')} pending`
        : "Live once the techfest26.in sync runs",
      progress: {
        pct: collectedPct,
        barClass: "bg-emerald-500",
        label: paymentStats.available ? `${collectedPct.toFixed(1)}% of registrations paid` : 'No data yet',
        value: `${refundedCount.toLocaleString('en-IN')} refunded`
      },
      icon: IndianRupee,
      iconBg: paymentStats.available ? "bg-emerald-50 text-emerald-600" : "bg-zinc-50 text-zinc-400"
    },
    {
      label: "Verification Desk",
      value: claimCount > 0 ? `${resolvedCount}/${claimCount}` : "—",
      badgeText: claimCount > 0 ? "CLAIMS" : "NO CLAIMS",
      badgeClass: claimCount > 0
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : "bg-zinc-50 text-zinc-500 border-zinc-200",
      valueColor: "text-slate-900",
      subtext: claimCount > 0
        ? oldestPendingHours > 0
          ? `Oldest pending ${oldestPendingHours}h`
          : "All claims resolved"
        : "No payment claims raised",
      progress: {
        pct: verificationPct,
        barClass: "bg-violet-500",
        label: `${verificationPct.toFixed(0)}% resolved`,
        value: `${claimCount - resolvedCount} pending`
      },
      icon: ShieldCheck,
      iconBg: "bg-violet-50 text-violet-600"
    },
    {
      label: "Call Coverage",
      value: `${callCoveragePct.toFixed(0)}%`,
      badgeText: "CRM",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      valueColor: "text-slate-900",
      subtext: `${calledCount.toLocaleString('en-IN')} of ${totalCount.toLocaleString('en-IN')} contacted`,
      progress: {
        pct: callCoveragePct,
        barClass: "bg-amber-500",
        label: `${(totalCount - calledCount).toLocaleString('en-IN')} not yet called`,
        value: `${eventCount} events`
      },
      icon: PhoneCall,
      iconBg: "bg-amber-50 text-amber-600"
    }
  ];

  // The Cancellations card only appears when there is something to win back
  const cancellationCard = {
    label: 'Cancellations',
    value: winBack.total.toLocaleString('en-IN'),
    badgeText: winBack.uncontacted > 0 ? 'ACTION NEEDED' : 'WIN-BACK',
    badgeClass: winBack.uncontacted > 0
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200',
    valueColor: 'text-rose-700',
    subtext: winBack.uncontacted > 0
      ? `${winBack.reverted} won back • ${winBack.uncontacted} never called`
      : `${winBack.reverted} won back • ${winBack.outstanding} still open`,
    progress: {
      pct: winBack.ratePct,
      barClass: 'bg-emerald-500',
      label: `${winBack.ratePct.toFixed(0)}% won back`,
      value: `${winBack.outstanding} outstanding`
    },
    icon: XCircle,
    iconBg: 'bg-rose-50 text-rose-600'
  };

  const cardsWithWinBack = winBack.total > 0
    ? [...cards.slice(0, 3), cancellationCard, cards[3]]
    : cards;

  const syncHint = lastSyncedAt
    ? `Last Unstop sync ${new Date(lastSyncedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} • ${collegeCount.toLocaleString('en-IN')} institutions`
    : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-3">
      {cardsWithWinBack.map((card, i) => {
        const IconComponent = card.icon;
        return (
          <Card 
            key={i}
            className="p-4 relative overflow-hidden transition-all duration-200 hover:shadow-md bg-white border border-slate-200 rounded-xl"
          >
            {/* Top Row: Label + shadcn Badge */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-500 font-semibold">
                {card.label}
              </span>
              <span className={`text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-full border ${card.badgeClass}`}>
                {card.badgeText}
              </span>
            </div>

            {/* Value Row */}
            <div className="flex items-baseline justify-between my-1">
              <span className={`text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${card.valueColor}`}>
                {card.value}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-2.5">
              <ProgressBar pct={card.progress.pct} barClass={card.progress.barClass} />
              <div className="flex items-center justify-between text-[10.5px] text-slate-500 mt-1.5 font-mono">
                <span className="truncate">{card.progress.label}</span>
                <span className="shrink-0 ml-2">{card.progress.value}</span>
              </div>
            </div>

            {/* Subtitle Row */}
            <div className="text-[12px] text-slate-500 mt-2 truncate">
              {card.subtext}
            </div>
          </Card>
        );
      })}
      </div>

      {syncHint && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mb-5">
          <Clock className="w-3 h-3" />
          <span>{syncHint}</span>
        </div>
      )}
    </>
  );
}
