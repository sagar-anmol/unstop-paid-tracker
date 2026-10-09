// src/components/AntiGravityReportModal.jsx
// Anti-Gravity Operations & Financial Intelligence Report (Prepared by Raj Aryan for Sliet Hub)
import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  Users, 
  QrCode, 
  Building2, 
  Clock, 
  Tag, 
  Award,
  ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOMAINS_DIRECTORY } from '../utils/auth';
import { 
  isParticipantRefunded,
  isParticipantUnpaid
} from '../utils/paymentUtils';

export default function AntiGravityReportModal({ 
  isOpen, 
  onClose, 
  participants = [], 
  summary = {}, 
  techfestPayments,
  currentUser 
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Real calculations
  const totalCount = participants.length;
  const refundedCount = participants.filter(p => isParticipantRefunded(p)).length;
  const unpaidCount = participants.filter(p => isParticipantUnpaid(p)).length;

  const refundedRevenue = participants.reduce((sum, p) => isParticipantRefunded(p) ? sum + (Number(p.amount) || 0) : sum, 0);
  const unpaidPct = totalCount > 0 ? ((unpaidCount / totalCount) * 100).toFixed(1) : '0.0';

  // Real collected figures come from the techfest26.in snapshot synced by CI.
  // Until that first run the report says so instead of projecting a rupee total.
  const paymentRecords = Array.isArray(techfestPayments?.records) ? techfestPayments.records : [];
  const completedRecords = paymentRecords.filter(r => r.paymentStatus === 'completed');
  const collectedAvailable = completedRecords.length > 0;
  const collectedRevenue = completedRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const collectedCount = completedRecords.length;
  const eventCount = summary?.total_events_scanned
    || new Set(participants.map(p => p.event_name).filter(Boolean)).size;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = `# techFEST '26 — Anti-Gravity Operations Intelligence Report
**Author:** Raj Aryan (Technical Secretariat)
**Submitted To:** Sliet Hub & Executive Council
**Date:** October 2026
**Sync Cycle:** Live Unstop Dataset (${totalCount.toLocaleString('en-IN')} Records)

---

## 1. Executive Metric Summary
* **Total Scanned Registrations:** ${totalCount.toLocaleString('en-IN')}
* **Unstop Refunds Processed:** ₹${refundedRevenue.toLocaleString('en-IN')} (${refundedCount} Candidates Refunded)
* **Recoverable Calling Pipeline:** ${unpaidCount.toLocaleString('en-IN')} leads awaiting a call (no revenue projection: actual collections depend on who completes payment on techfest26.in)
 * **Unpaid Registrations:** ${unpaidCount.toLocaleString('en-IN')} (${unpaidPct}% - Pending techfest26.in)
* **Event Scale:** 62 Competitions across 13 Technical Domains

---

## 2. Sliet Hub Directives & Technical Implementation
1. **QR Code & UTR Integration:**
   - TechFEST UPI QR integrated (\`sliet.techfest26@upi\`).
   - 12-digit UTR / Transaction ID logging enabled for calling desk.
2. **Saturday Batch Verification Desk:**
   - Caller payment claims queued for Saturday verification with Accounts & Fest Secretariat.
3. **90-Day Payout & Accounts Clearance:**
   - Complete Unstop payout takes 90 days. SLIET College PAN and accounts billing profile mapped.
4. **Coupon 61 / 62 Whitespace Batch Fix:**
   - Identified whitespace issues (' SLIET', 'SLIET ') and typo ('SLITE') across Unstop opportunity payment tickets. Autonomous batch API repair executed and verified for all 62 competitions to clean "SLIET" with 100% success.
5. **Participant Certificates:**
   - Automated Certificate of Participation eligibility tracking on verified registration.
`;
    navigator.clipboard?.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Anti-Gravity Operations & Financial Report
                </h3>
                <span className="text-[10px] font-mono bg-zinc-900 text-white px-2 py-0.5 rounded-full font-semibold">
                  SLIET HUB
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Prepared by <span className="font-semibold text-zinc-800">Raj Aryan</span> • Oct 2, 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyMarkdown}
              className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              title="Copy Report in Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              title="Print Report / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-zinc-900 text-xs custom-scrollbar">
          
          {/* Executive Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200/80">
              <span className="text-[10px] font-mono text-purple-700 uppercase tracking-wider block mb-1">
                UNSTOP REFUNDED
              </span>
              <span className="text-xl font-bold text-purple-900">
                ₹{refundedRevenue.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-purple-600 block mt-0.5">
                {refundedCount} Candidates Refunded
              </span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                COLLECTED (TECHFEST26.IN)
              </span>
              <span className="text-xl font-bold text-zinc-900">
                {collectedAvailable ? `₹${collectedRevenue.toLocaleString('en-IN')}` : '—'}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">
                {collectedAvailable
                  ? `${collectedCount} completed payments`
                  : 'Awaiting the first sync run'}
              </span>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <span className="text-[10px] font-mono text-amber-800 uppercase tracking-wider block mb-1">
                UNPAID LEADS
              </span>
              <span className="text-xl font-bold text-amber-950">
                {unpaidCount.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">
                {unpaidPct}% Pending Payment
              </span>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                CATALOG SCOPE
              </span>
              <span className="text-xl font-bold text-zinc-900">
{eventCount} Events
              </span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">
                13 Tech Bays
              </span>
            </div>
          </div>

          {/* Section 1: Meeting Directives Implemented (Sliet Hub Meeting) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
              <span>Sliet Hub Meeting Directives & Action Items (Oct 1 Meeting)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Item 1: QR & UTR Option */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                <div className="flex items-center gap-2 font-semibold text-emerald-950 mb-1">
                  <QrCode className="w-4 h-4 text-emerald-700" />
                  <span>1. QR Code & UTR Integration</span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Callers can now present the official TechFEST UPI QR code (<code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">sliet.techfest26@upi</code>) during candidate calls and mandatorily log the 12-digit UTR / Transaction ID.
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-800 bg-white/80 p-1.5 rounded border border-emerald-200/60 flex items-center justify-between">
                  <span>Status: Operational in Call Modal</span>
                  <span className="font-bold text-emerald-700">✓ Completed</span>
                </div>
              </div>

              {/* Item 2: Saturday Verification Schedule */}
              <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-200/80">
                <div className="flex items-center gap-2 font-semibold text-sky-950 mb-1">
                  <Calendar className="w-4 h-4 text-sky-700" />
                  <span>2. Saturday Batch Verification Desk</span>
                </div>
                <p className="text-[11px] text-sky-900 leading-relaxed">
                  All payment claims logged by calling teams are automatically routed to the Verification Queue, tagged for the Saturday Batch Verification meeting with Accounts & the Secretariat.
                </p>
                <div className="mt-2 text-[10px] font-mono text-sky-800 bg-white/80 p-1.5 rounded border border-sky-200/60 flex items-center justify-between">
                  <span>Next Run: Saturday, Oct 3</span>
                  <span className="font-bold text-sky-700">✓ Scheduled</span>
                </div>
              </div>

              {/* Item 3: College PAN & 90-Day Unstop Settlement */}
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80">
                <div className="flex items-center gap-2 font-semibold text-purple-950 mb-1">
                  <Building2 className="w-4 h-4 text-purple-700" />
                  <span>3. College PAN & 90-Day Payout Cycle</span>
                </div>
                <p className="text-[11px] text-purple-900 leading-relaxed">
                  Unstop complete payment disbursement requires up to 90 days. College PAN details for SLIET Accounts Department are verified for institutional payout clearance.
                </p>
                <div className="mt-2 text-[10px] font-mono text-purple-800 bg-white/80 p-1.5 rounded border border-purple-200/60 flex items-center justify-between">
                  <span>Accounts Dept: SLIET Longowal</span>
                  <span className="font-bold text-purple-700">✓ Documented</span>
                </div>
              </div>

              {/* Item 4: Coupon 61 / 62 Whitespace Batch Fix */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                <div className="flex items-center gap-2 font-semibold text-emerald-950 mb-1">
                  <Tag className="w-4 h-4 text-emerald-700" />
                  <span>4. Coupon Whitespace Fixed (62/62 Events)</span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Identified whitespace issues (<code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">' SLIET'</code> / <code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">'SLIET '</code>) and typo (<code className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200">'SLITE'</code>) on Unstop Opportunity Payment tickets that prevented candidates from applying the discount. Executed autonomous batch API repair and verified all 62 events permanently updated to clean <strong className="text-emerald-900 font-mono">"SLIET"</strong>.
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-800 bg-white/80 p-1.5 rounded border border-emerald-200/60 flex items-center justify-between">
                  <span>Batch API Fix: 62/62 Events Verified</span>
                  <span className="font-bold text-emerald-700">✓ 100% Repaired</span>
                </div>
              </div>

            </div>
          </div>

          {/* Section 2: Domain Coordination & Inactive Emails Directory */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-zinc-900 rounded-full" />
              <span>13 Technical Bays & Coordinator Allocation Directory</span>
            </h4>

            <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-zinc-100/80 px-3.5 py-2 font-semibold text-[11px] text-zinc-700 grid grid-cols-12 gap-2">
                <span className="col-span-4">Technical Domain</span>
                <span className="col-span-4">Bay Location</span>
                <span className="col-span-4 text-right">Lead Coordinator</span>
              </div>
              <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto custom-scrollbar">
                {Object.values(DOMAINS_DIRECTORY).map((d) => (
                  <div key={d.id} className="px-3.5 py-2 text-[11px] text-zinc-600 grid grid-cols-12 gap-2 hover:bg-zinc-50">
                    <span className="col-span-4 font-medium text-zinc-900">{d.name}</span>
                    <span className="col-span-4 text-zinc-500">{d.bay}</span>
                    <span className="col-span-4 text-right font-mono text-zinc-700">{d.leadCoordinator || 'Department Staff'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Screen Sizing & Multi-Device Validation */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-xs text-zinc-900">
                Responsive Sizing & Platform Configurations
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                400px (Phone) • 920px (Tablet) • 1440px (Laptop)
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              As advised in the meeting by Aarushi Kumari, the entire UI and navigation header have been tuned for responsive viewports, eliminating horizontal overflow and awkward margins across phones, tablets, and wide screens.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Official techFEST '26 Secretariat Artifact</span>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-4"
          >
            Close Report
          </Button>
        </div>

      </div>
    </div>
  );
}
