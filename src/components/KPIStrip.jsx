import React from 'react';
import { Users, DollarSign, Trophy, School, RotateCcw } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isParticipantPaid, isParticipantRefunded, isParticipantUnpaid } from '../utils/paymentUtils';

export default function KPIStrip({ summary, participants }) {
  const totalCount = participants.length;
  const paidCount = participants.filter(p => isParticipantPaid(p)).length;
  const refundedCount = participants.filter(p => isParticipantRefunded(p)).length;
  const unpaidCount = participants.filter(p => isParticipantUnpaid(p)).length;
  
  const totalRevenue = participants.reduce((sum, p) => isParticipantPaid(p) ? sum + (Number(p.amount) || 0) : sum, 0);
  const refundedRevenue = participants.reduce((sum, p) => isParticipantRefunded(p) ? sum + (Number(p.amount) || 0) : sum, 0);
  
  const totalEvents = summary?.total_events_scanned || 62;
  const eventsWithPaid = summary?.events_with_paid || new Set(participants.map(p => p.event_name)).size;
  const zeroPaidCount = Math.max(0, totalEvents - eventsWithPaid);

  const collegeCount = summary?.total_colleges || new Set(participants.map(p => p.college).filter(Boolean)).size;

  const cards = [
    {
      label: "Total Registrations",
      value: totalCount.toLocaleString('en-IN'),
      badgeText: "LIVE SYNC",
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
      valueColor: "text-slate-900",
      subtext: `${refundedCount.toLocaleString('en-IN')} Refunded • ${unpaidCount.toLocaleString('en-IN')} Unpaid`,
      icon: Users,
      iconBg: "bg-sky-50 text-sky-600"
    },
    paidCount > 0 ? {
      label: "Paid Revenue",
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      badgeText: "GATEWAY",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      valueColor: "text-emerald-700",
      subtext: `${paidCount.toLocaleString('en-IN')} verified paid candidates`,
      icon: DollarSign,
      iconBg: "bg-emerald-50 text-emerald-600"
    } : {
      label: "Unstop Refunded",
      value: `₹${refundedRevenue.toLocaleString('en-IN')}`,
      badgeText: "REFUNDED",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      valueColor: "text-purple-700",
      subtext: `${refundedCount.toLocaleString('en-IN')} refunded • techfest26 pending`,
      icon: RotateCcw,
      iconBg: "bg-purple-50 text-purple-600"
    },
    {
      label: "Total Competitions",
      value: totalEvents,
      badgeText: "CATALOG",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      valueColor: "text-slate-900",
      subtext: `${eventsWithPaid} with entries • ${zeroPaidCount} awaiting`,
      icon: Trophy,
      iconBg: "bg-purple-50 text-purple-600"
    },
    {
      label: "Institutions",
      value: collegeCount,
      badgeText: "PAN-INDIA",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      valueColor: "text-slate-900",
      subtext: `Across ${collegeCount} colleges & universities`,
      icon: School,
      iconBg: "bg-amber-50 text-amber-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {cards.map((card, i) => {
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

            {/* Subtitle Row */}
            <div className="text-[12px] text-slate-500 mt-1 truncate">
              {card.subtext}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
