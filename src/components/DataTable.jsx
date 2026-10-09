// src/components/DataTable.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  X, 
  Copy, 
  Check, 
  Phone, 
  PhoneCall, 
  ArrowRight, 
  Users, 
  Sparkles, 
  Trophy, 
  HelpCircle, 
  Terminal, 
  Music, 
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShieldCheck,
  AlertCircle,
  Layers,
  UserCheck,
  XCircle
} from 'lucide-react';
import { getAvatarStyle, getInitials } from '../utils/avatar';
import { getCallRecords, getParticipantCallRecord, CALL_STATUSES, formatCallTime } from '../utils/callStore';
import { getDomainForEvent, DOMAINS_DIRECTORY } from '../utils/auth';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  isParticipantRefunded, 
  isParticipantPaid, 
  isParticipantUnpaid,
  isParticipantCancelled
} from '../utils/paymentUtils';

export default function DataTable({ 
  participants = [], 
  summary = {}, 
  currentUser,
  activeDomainId,
  selectedEventFilter = '',
  callDbVersion = 0,
  onSelectEventFilter,
  onSelectParticipant, 
  onTriggerCall,
  onTriggerToast,
  focusCancelled = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(focusCancelled ? 'cancelled' : 'all');
  const [selectedPayment, setSelectedPayment] = useState('all');
  const [selectedCallStatus, setSelectedCallStatus] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(selectedEventFilter || '');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  
  // Sync selectedEvent with prop if changed from DomainBanner
  useEffect(() => {
    setSelectedEvent(selectedEventFilter || '');
  }, [selectedEventFilter]);

  // The win-back banner jumps the table to the cancelled tab. The remount key in
  // App.jsx resets every other filter, so this only needs the initial value.
  useEffect(() => {
    if (focusCancelled) setSelectedCategory('cancelled');
  }, [focusCancelled]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Call records live in localStorage rather than React state, so the memo depends
  // on callDbVersion: App bumps it whenever a sync completes to force a re-read.
   
  const callRecords = useMemo(() => getCallRecords(), [participants, callDbVersion]);

  // Active domain info if scoped
  const activeDomain = activeDomainId ? DOMAINS_DIRECTORY[activeDomainId] : null;

  // View mode: 'grouped' (deduplicate participant into 1 row with all their events) vs 'unrolled' (raw event entries)
  const [isGroupedMode, setIsGroupedMode] = useState(true);

  // Group participants by unique candidate (email or phone)
  const uniqueCandidates = useMemo(() => {
    const map = new Map();

    participants.forEach(p => {
      const email = (p.email || '').toLowerCase().trim();
      const phoneDigits = (p.phone || '').replace(/[^0-9]/g, '').slice(-10);
      const groupKey = email || (phoneDigits ? `ph_${phoneDigits}` : `id_${p.id}`);

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ...p,
          uniqueKey: groupKey,
          candidateId: p.id,
          allIds: [p.id],
          events: [],
          totalAmountRefunded: 0,
          totalAmountPaid: 0,
          refundedEventsCount: 0,
          paidEventsCount: 0,
          unpaidEventsCount: 0,
          cancelledEventsCount: 0,
          revertedEventsCount: 0,
          cancelled_at: null,
          cancel_reason: '',
          registeredEventNames: []
        });
      }

      const candidate = map.get(groupKey);
      if (!candidate.allIds.includes(p.id)) {
        candidate.allIds.push(p.id);
      }

      const amt = Number(p.amount) || 0;
      const isCancelled = isParticipantCancelled(p);
      const isRef = isParticipantRefunded(p);
      const isPaid = isParticipantPaid(p);

      if (isCancelled) {
        candidate.cancelledEventsCount++;
        if (p.cancel_reverted) candidate.revertedEventsCount++;
        if (p.cancelled_at && !candidate.cancelled_at) candidate.cancelled_at = p.cancelled_at;
        if (p.cancel_reason) candidate.cancel_reason = p.cancel_reason;
      } else if (isRef) {
        candidate.refundedEventsCount++;
        candidate.totalAmountRefunded += amt;
      } else if (isPaid) {
        candidate.paidEventsCount++;
        candidate.totalAmountPaid += amt;
      } else {
        candidate.unpaidEventsCount++;
      }

      candidate.events.push({
        id: p.id,
        internal_id: p.internal_id,
        event_id: p.event_id,
        event_name: p.event_name,
        event_type: p.event_type,
        payment_status: isCancelled ? 'CANCELLED' : (isRef ? 'REFUNDED' : (isPaid ? 'PAID' : 'UNPAID')),
        amount: p.amount,
        is_paid: isPaid,
        is_refunded: isRef,
        is_cancelled: isCancelled,
        cancel_reverted: p.cancel_reverted === true,
        cancelled_at: p.cancelled_at,
        cancel_reason: p.cancel_reason,
        status_label: p.status_label,
        registered_at: p.registered_at,
        team_name: p.team_name,
        team_size: p.team_size,
        team_members: p.team_members
      });

      if (!candidate.registeredEventNames.includes(p.event_name)) {
        candidate.registeredEventNames.push(p.event_name);
      }
    });

    return Array.from(map.values()).map(c => {
      c.eventsCount = c.events.length;
      if (c.cancelledEventsCount > 0) {
        // A cancellation dominates the candidate's status: this is the win-back case
        c.is_cancelled = true;
        c.is_refunded = false;
        c.is_paid = false;
        c.payment_status = 'CANCELLED';
        c.status_label = c.revertedEventsCount > 0 ? 'Cancelled — Won Back' : 'Registration Cancelled';
        c.amount = 0;
      } else if (c.refundedEventsCount > 0) {
        c.is_cancelled = false;
        c.payment_status = 'REFUNDED';
        c.is_refunded = true;
        c.is_paid = false;
        c.amount = c.totalAmountRefunded;
      } else if (c.paidEventsCount > 0) {
        c.is_cancelled = false;
        c.payment_status = 'PAID';
        c.is_paid = true;
        c.is_refunded = false;
        c.amount = c.totalAmountPaid;
      } else {
        c.is_cancelled = false;
        c.payment_status = 'UNPAID';
        c.is_paid = false;
        c.is_refunded = false;
        c.amount = 0;
      }
      return c;
    });
  }, [participants]);

  const activeDataset = isGroupedMode ? uniqueCandidates : participants;

  // Category counts based on active dataset
  const categoryCounts = useMemo(() => {
    const counts = { all: activeDataset.length, competitions: 0, quizzes: 0, hackathons: 0, cultural: 0 };
    activeDataset.forEach(p => {
      if (isGroupedMode && Array.isArray(p.events)) {
        const types = p.events.map(e => (e.event_type || 'competitions').toLowerCase());
        if (types.some(t => t.includes('quiz'))) counts.quizzes++;
        if (types.some(t => t.includes('hack'))) counts.hackathons++;
        if (types.some(t => t.includes('cultur'))) counts.cultural++;
        if (types.some(t => !t.includes('quiz') && !t.includes('hack') && !t.includes('cultur'))) counts.competitions++;
      } else {
        const t = (p.event_type || 'competitions').toLowerCase();
        if (t.includes('quiz')) counts.quizzes++;
        else if (t.includes('hack')) counts.hackathons++;
        else if (t.includes('cultur')) counts.cultural++;
        else counts.competitions++;
      }
    });
    return counts;
  }, [activeDataset, isGroupedMode]);

  // Payment counts
  const paymentCounts = useMemo(() => {
    if (isGroupedMode) {
      const refunded = activeDataset.filter(p => p.refundedEventsCount > 0).length;
      const paid = activeDataset.filter(p => p.paidEventsCount > 0 && (p.refundedEventsCount === 0 || !p.refundedEventsCount)).length;
      const unpaid = activeDataset.filter(p => (!p.refundedEventsCount || p.refundedEventsCount === 0) && (!p.paidEventsCount || p.paidEventsCount === 0)).length;
      const cancelled = activeDataset.filter(p => p.cancelledEventsCount > 0).length;
      const reverted = activeDataset.filter(p => p.revertedEventsCount > 0).length;
      return { all: activeDataset.length, refunded, unpaid, paid, cancelled, reverted };
    }
    const refunded = participants.filter(p => isParticipantRefunded(p)).length;
    const paid = participants.filter(p => isParticipantPaid(p)).length;
    const unpaid = participants.filter(p => isParticipantUnpaid(p)).length;
    const cancelled = participants.filter(p => isParticipantCancelled(p) && !p.cancel_reverted).length;
    const reverted = participants.filter(p => isParticipantCancelled(p) && p.cancel_reverted).length;
    return { all: participants.length, refunded, unpaid, paid, cancelled, reverted };
  }, [activeDataset, isGroupedMode, participants]);

  // Cancellations needing a win-back attempt, sorted ahead of everything else so
  // nobody is left uncontacted. Reverted rows sit below the outstanding ones.
  const cancellationPriority = useMemo(() => {
    const priority = new Map();
    activeDataset.forEach(p => {
      const rows = isGroupedMode && Array.isArray(p.events) ? p.events : [p];
      const hasCancelled = rows.some(isParticipantCancelled);
      const isReverted = hasCancelled && rows.some(r => r.cancel_reverted);
      if (hasCancelled) {
        priority.set(p.uniqueKey || String(p.id), isReverted ? 1 : 0);
      }
    });
    return priority;
  }, [activeDataset, isGroupedMode]);

  // Calling counts for quick segmented filter (to prevent duplicate calls)
  const callCounts = useMemo(() => {
    let called = 0;
    let neverCalled = 0;
    activeDataset.forEach(p => {
      const rec = getParticipantCallRecord(p);
      if (rec && (rec.callCount || 0) > 0) {
        called++;
      } else {
        neverCalled++;
      }
    });
    return { all: activeDataset.length, called, neverCalled };
    // callDbVersion invalidates the localStorage read after a cloud sync
     
  }, [activeDataset, callDbVersion]);

  // Master events list for dropdown (guaranteed to include all domain events)
  const masterEvents = useMemo(() => {
    const eventCounts = {};
    if (activeDomain && activeDomain.events) {
      activeDomain.events.forEach(ev => {
        eventCounts[ev] = 0;
      });
    }

    participants.forEach(p => {
      const name = (p.event_name || 'Event').trim();
      let matchedKey = name;
      if (activeDomain && activeDomain.events) {
        const canonical = activeDomain.events.find(ev => ev.toLowerCase() === name.toLowerCase());
        if (canonical) matchedKey = canonical;
      }
      eventCounts[matchedKey] = (eventCounts[matchedKey] || 0) + 1;
    });

    const sortedEvents = Object.keys(eventCounts).sort((a, b) => (eventCounts[b] || 0) - (eventCounts[a] || 0));
    return { sortedEvents, eventCounts };
  }, [participants, activeDomain]);

  // Reset pagination to page 1 whenever any filter, search or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedPayment, selectedCallStatus, selectedEvent, selectedCollege, sortBy, isGroupedMode]);

  // Colleges list
  const collegesList = useMemo(() => {
    return Array.from(new Set(participants.map(p => p.college).filter(Boolean))).sort();
  }, [participants]);

  // Filter & Search logic
  const filteredParticipants = useMemo(() => {
    return activeDataset.filter(p => {
      // 1. Category. 'cancelled' is surfaced as its own tab so win-back work is reachable
      if (selectedCategory === 'cancelled') {
        const rows = isGroupedMode && Array.isArray(p.events) ? p.events : [p];
        if (!rows.some(isParticipantCancelled)) return false;
      } else if (selectedCategory !== 'all') {
        const rows = isGroupedMode && Array.isArray(p.events) ? p.events : [p];
        const hasCategory = rows.some(ev => {
          const t = (ev.event_type || 'competitions').toLowerCase();
          if (selectedCategory === 'quizzes') return t.includes('quiz');
          if (selectedCategory === 'hackathons') return t.includes('hack');
          if (selectedCategory === 'cultural') return t.includes('cultur');
          return !t.includes('quiz') && !t.includes('hack') && !t.includes('cultur');
        });
        if (!hasCategory) return false;
      }

      // 2. Payment Filter
      if (selectedPayment !== 'all') {
        if (isGroupedMode && Array.isArray(p.events)) {
          const rows = p.events;
          const isRef = rows.some(isParticipantRefunded);
          const isPaid = rows.some(isParticipantPaid);
          const isUnp = rows.some(isParticipantUnpaid);
          const isCancelled = rows.some(isParticipantCancelled);
          const isReverted = isCancelled && rows.some(r => r.cancel_reverted);

          if (selectedPayment === 'refunded' && !isRef) return false;
          if (selectedPayment === 'paid' && !isPaid) return false;
          if (selectedPayment === 'unpaid' && !isUnp) return false;
          if (selectedPayment === 'cancelled' && !isCancelled) return false;
          if (selectedPayment === 'reverted' && !isReverted) return false;
        } else {
          const isRef = isParticipantRefunded(p);
          const isPaid = isParticipantPaid(p);
          const isUnp = isParticipantUnpaid(p);
          const isCancelled = isParticipantCancelled(p);

          if (selectedPayment === 'refunded' && !isRef) return false;
          if (selectedPayment === 'paid' && !isPaid) return false;
          if (selectedPayment === 'unpaid' && !isUnp) return false;
          if (selectedPayment === 'cancelled' && !isCancelled) return false;
          if (selectedPayment === 'reverted' && !(isCancelled && p.cancel_reverted)) return false;
        }
      }

      // 3. Calling Status Filter
      if (selectedCallStatus !== 'all') {
        const record = getParticipantCallRecord(p);
        const callCount = record?.callCount || 0;
        const lastStatus = record?.lastStatus;

        if (selectedCallStatus === 'never_called' && callCount > 0) return false;
        if (selectedCallStatus === 'called' && callCount === 0) return false;
        if (selectedCallStatus === 'PAYMENT_CLAIMED' && lastStatus !== 'PAYMENT_CLAIMED') return false;
        if (selectedCallStatus === 'INTERESTED' && lastStatus !== 'INTERESTED') return false;
        if (selectedCallStatus === 'CALL_LATER' && lastStatus !== 'CALL_LATER') return false;
        if (selectedCallStatus === 'NOT_PICKED' && lastStatus !== 'NOT_PICKED') return false;
      }

      // 4. Event
      if (selectedEvent) {
        const selEv = selectedEvent.trim().toLowerCase();
        if (isGroupedMode && Array.isArray(p.registeredEventNames)) {
          const hasEvent = p.registeredEventNames.some(ev => {
            const pEv = (ev || '').trim().toLowerCase();
            return pEv === selEv || (activeDomain?.events?.some(canon => canon.toLowerCase() === selEv && (pEv === canon.toLowerCase() || pEv.includes(canon.toLowerCase()))));
          });
          if (!hasEvent) return false;
        } else {
          const pEv = (p.event_name || '').trim().toLowerCase();
          if (pEv !== selEv) {
            const isMatch = activeDomain?.events?.some(ev => ev.toLowerCase() === selEv && (pEv === ev.toLowerCase() || pEv.includes(ev.toLowerCase())));
            if (!isMatch) return false;
          }
        }
      }

      // 5. College
      if (selectedCollege && (p.college || '').trim() !== selectedCollege) return false;

      // 6. Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchEmail = (p.email || '').toLowerCase().includes(q);
        const matchPhone = (p.phone || '').toLowerCase().includes(q);
        const matchCollege = (p.college || '').toLowerCase().includes(q);
        const matchTeam = (p.team_name || '').toLowerCase().includes(q);
        const matchId = (p.id || '').toLowerCase().includes(q);

        let matchEvent = false;
        if (isGroupedMode && Array.isArray(p.registeredEventNames)) {
          matchEvent = p.registeredEventNames.some(ev => (ev || '').toLowerCase().includes(q));
        } else {
          matchEvent = (p.event_name || '').toLowerCase().includes(q);
        }

        const matchMembers = (p.team_members || []).some(m => 
          (m.name || '').toLowerCase().includes(q) ||
          (m.email || '').toLowerCase().includes(q) ||
          (m.phone || '').toLowerCase().includes(q)
        );

        if (!matchName && !matchEmail && !matchPhone && !matchCollege && !matchEvent && !matchTeam && !matchId && !matchMembers) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Cancellations needing a win-back attempt float to the top by default
      const cancelA = cancellationPriority.get(a.uniqueKey || String(a.id)) ?? 9;
      const cancelB = cancellationPriority.get(b.uniqueKey || String(b.id)) ?? 9;
      if (cancelA !== cancelB) return cancelA - cancelB;

      if (sortBy === 'date-desc') return new Date(b.registered_at || 0) - new Date(a.registered_at || 0);
      if (sortBy === 'date-asc') return new Date(a.registered_at || 0) - new Date(b.registered_at || 0);
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'event-asc') return (a.event_name || a.registeredEventNames?.[0] || '').localeCompare(b.event_name || b.registeredEventNames?.[0] || '');
      if (sortBy === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === 'calls-desc') {
        const cA = getParticipantCallRecord(a)?.callCount || 0;
        const cB = getParticipantCallRecord(b)?.callCount || 0;
        return cB - cA;
      }
      return 0;
    });
    // callRecords is the localStorage read that the calls-desc sort depends on;
    // it is listed so a cloud sync re-sorts the table
     
  }, [activeDataset, isGroupedMode, callRecords, selectedCategory, selectedPayment, selectedCallStatus, selectedEvent, selectedCollege, searchQuery, sortBy, activeDomain, cancellationPriority]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / (pageSize === 'all' ? 999999 : pageSize)));
  const effectivePage = Math.min(currentPage, totalPages);
  const startIndex = (effectivePage - 1) * (pageSize === 'all' ? 999999 : pageSize);
  const endIndex = Math.min(startIndex + (pageSize === 'all' ? 999999 : pageSize), filteredParticipants.length);
  const pageItems = filteredParticipants.slice(startIndex, endIndex);

  const isFiltering = searchQuery || selectedEvent || selectedCollege || selectedCategory !== 'all' || selectedPayment !== 'all' || selectedCallStatus !== 'all';

  const handleCopyEmail = (e, email) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    if (onTriggerToast) onTriggerToast({ type: 'success', message: `Copied ${email}` });
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedPayment('all');
    setSelectedCallStatus('all');
    setSelectedEvent('');
    if (onSelectEventFilter) onSelectEventFilter('');
    setSelectedCollege('');
    setCurrentPage(1);
  };

  const renderTrackBadge = (type) => {
    const t = String(type || 'Competitions').toLowerCase();
    if (t.includes('quiz')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Quizzes
        </span>
      );
    } else if (t.includes('hack')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-purple-800 bg-purple-50 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
          Hackathons
        </span>
      );
    } else if (t.includes('cultur')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          Cultural
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-sky-800 bg-sky-50 border border-sky-200">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
        Competition
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-zinc-200/80 shadow-xs transition-all mb-10" id="candidates-table">
      
      {/* 1. Header Bar: Category Tabs + View Switcher + Payment Segments */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 px-4 pt-2 border-b border-zinc-200/80 bg-white">
        
        {/* Category Segment Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Events', count: categoryCounts.all, countClass: 'text-slate-600 bg-slate-100', icon: Sparkles },
            { id: 'cancelled', label: 'Cancelled', count: paymentCounts.cancelled, countClass: 'text-rose-700 bg-rose-50 border border-rose-200', icon: XCircle },
            { id: 'competitions', label: 'Competitions', count: categoryCounts.competitions, countClass: 'text-sky-700 bg-sky-50', icon: Trophy },
            { id: 'quizzes', label: 'Quizzes', count: categoryCounts.quizzes, countClass: 'text-amber-700 bg-amber-50', icon: HelpCircle },
            { id: 'hackathons', label: 'Hackathons', count: categoryCounts.hackathons, countClass: 'text-purple-700 bg-purple-50', icon: Terminal },
            { id: 'cultural', label: 'Cultural & Jam', count: categoryCounts.cultural, countClass: 'text-rose-700 bg-rose-50', icon: Music },
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setSelectedCategory(tab.id); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive 
                    ? 'border-slate-900 text-slate-900 font-semibold' 
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${tab.countClass}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle + Payment Filter Tray */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-between xl:justify-end pb-2 xl:pb-0">
          
          {/* Unique Candidates vs All Registrations Segmented Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 shadow-2xs">
            <button
              onClick={() => { setIsGroupedMode(true); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                isGroupedMode 
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Show unique students with all their registered events unified in a single row"
            >
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>Unique Students</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 font-semibold">
                {uniqueCandidates.length}
              </span>
            </button>
            <button
              onClick={() => { setIsGroupedMode(false); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                !isGroupedMode 
                  ? 'bg-white text-zinc-900 shadow-xs font-semibold' 
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Show each individual competition registration as a separate row"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>All Registrations</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-200 text-zinc-700">
                {participants.length}
              </span>
            </button>
          </div>

          {/* Quick Calling Desk Filter Tray (Duplicate Call Prevention) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 overflow-x-auto scrollbar-none" title="Quick Calling Desk Filters">
            {[
              { id: 'all', label: 'All Calling', count: callCounts.all, countClass: 'text-zinc-500' },
              { id: 'never_called', label: '📞 Fresh / To Call', count: callCounts.neverCalled, countClass: 'text-emerald-700 bg-emerald-50 font-semibold px-1 rounded' },
              { id: 'called', label: '✓ Already Called', count: callCounts.called, countClass: 'text-amber-800 bg-amber-50 font-semibold px-1 rounded' }
            ].map(c => {
              const isActive = selectedCallStatus === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCallStatus(c.id); setCurrentPage(1); }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-white text-zinc-900 shadow-xs font-semibold' 
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                  title={c.id === 'never_called' ? 'Filter to fresh leads who have NOT been called yet' : c.id === 'called' ? 'Filter to leads who have already been called' : 'Show all leads'}
                >
                  <span>{c.label}</span>
                  <span className={`text-[10px] font-mono ${c.countClass}`}>({c.count})</span>
                </button>
              );
            })}
          </div>

        </div>

      </div>

      {/* 2. Operations Filter Toolbar */}
      <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-12 gap-2 sm:gap-3 items-center">
        
        {/* Instant Search Bar */}
        <div className="col-span-2 lg:col-span-4 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 z-10" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search candidate, team, college, email... (Press / to focus)"
            className="pl-9 pr-8 text-xs bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 shadow-xs h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 z-10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Event Dropdown Filter */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-3">
          <select
            value={selectedEvent}
            onChange={(e) => { 
              const val = e.target.value;
              setSelectedEvent(val);
              if (onSelectEventFilter) onSelectEventFilter(val);
              setCurrentPage(1); 
            }}
            className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-lg px-2.5 py-1.5 h-9 text-xs text-slate-800 outline-none transition-all truncate shadow-xs cursor-pointer"
          >
            <option value="">
              {activeDomain ? `All ${activeDomain.name} Events (${participants.length})` : `All Events (${participants.length})`}
            </option>
            {masterEvents.sortedEvents.map((evName, i) => (
              <option key={i} value={evName}>
                {evName} ({masterEvents.eventCounts[evName] || 0})
              </option>
            ))}
          </select>
        </div>

        {/* Calling Status Filter */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
          <select
            value={selectedCallStatus}
            onChange={(e) => { setSelectedCallStatus(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-lg px-2.5 py-1.5 h-9 text-xs text-slate-800 outline-none transition-all truncate shadow-xs cursor-pointer"
          >
            <option value="all">Call Status: All</option>
            <option value="never_called">Never Called (0)</option>
            <option value="called">Called (1+)</option>
            <option value="PAYMENT_CLAIMED">Payment Claimed</option>
            <option value="INTERESTED">Interested</option>
            <option value="CALL_LATER">Callback</option>
            <option value="NOT_PICKED">Not Picked</option>
          </select>
        </div>

        {/* College Filter Dropdown */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-2">
          <select
            value={selectedCollege}
            onChange={(e) => { setSelectedCollege(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-lg px-2.5 py-1.5 h-9 text-xs text-slate-800 outline-none transition-all truncate shadow-xs cursor-pointer"
          >
            <option value="">All Colleges ({collegesList.length})</option>
            {collegesList.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 flex items-center justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-lg px-2 py-1.5 h-9 text-xs text-slate-800 outline-none transition-all shadow-xs cursor-pointer"
            title="Sort Attendees"
          >
            <option value="date-desc">Latest</option>
            <option value="date-asc">Oldest</option>
            <option value="name-asc">Name A-Z</option>
            <option value="calls-desc">Most Calls</option>
            <option value="amount-desc">Paid First</option>
          </select>
        </div>

      </div>

      {/* Active Filter Bar Summary */}
      {isFiltering && (
        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-mono text-sky-700 font-semibold">{filteredParticipants.length}</span>
            <span>attendees matched active filters</span>
            {selectedEvent && (
              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono text-[10px]">
                Event: {selectedEvent}
              </span>
            )}
          </div>
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 text-[11px] font-mono text-sky-700 hover:text-sky-900 transition-colors cursor-pointer font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset filters</span>
          </button>
        </div>
      )}

      {/* Win-back context when the table is focused on cancelled registrations */}
      {focusCancelled && pageItems.some(isParticipantCancelled) && (
        <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center gap-2 text-[11px] text-amber-900">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            Showing cancelled registrations. Call each one to capture why they left and whether
            they re-registered with the same email.
          </span>
        </div>
      )}

      {/* 3. High Density Desktop Table */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-2.5 px-3 w-10 text-center font-mono text-[11px]">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Candidate Details</th>
              <th className="py-2.5 px-3 min-w-[190px]">Phone & Direct Calling</th>
              <th className="py-2.5 px-3 min-w-[180px]">Institution & Course</th>
              <th className="py-2.5 px-3 min-w-[180px]">Competition & Domain</th>
              <th className="py-2.5 px-3 min-w-[130px]">Team Roster</th>
              <th className="py-2.5 px-3 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-500">
                  <div className="max-w-xs mx-auto">
                    <Filter className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-800">
                      {focusCancelled ? 'No cancelled registrations' : 'No participants found'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {focusCancelled
                        ? 'Nobody has cancelled a registration in this scope.'
                        : 'Try resetting search terms or switching categories.'}
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1.5 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-all font-medium cursor-pointer"
                    >
                      Reset all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageItems.map((p, idx) => {
                const absoluteIndex = startIndex + idx + 1;
                const avatarStyle = getAvatarStyle(p.name);
                const initials = getInitials(p.name);
                const cleanPhone = (p.phone || '').replace(/[^0-9]/g, '');
                const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}` : null;
                const hasMembers = p.team_members && p.team_members.length > 0;

                // Call CRM record (checks candidate uniqueKey, allIds, and phone)
                const rec = getParticipantCallRecord(p);
                const callCount = rec?.callCount || 0;
                const statusDef = rec?.lastStatus ? CALL_STATUSES[rec.lastStatus] : null;

                // Resolve domain
                const domainInfo = getDomainForEvent(p.event_name);

                const rowIsCancelled = isParticipantCancelled(p);

                return (
                  <tr 
                    key={p.uniqueKey || p.id || idx}
                    onClick={() => onSelectParticipant(p)}
                    className={`cursor-pointer transition-colors group ${
                      rowIsCancelled
                        ? p.cancel_reverted
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                          : 'bg-rose-50/50 hover:bg-rose-50/80'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {rowIsCancelled && (
                      <td className="py-3 w-1 px-0">
                        <span
                          className={`block w-1 h-full rounded-r ${
                            p.cancel_reverted ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          aria-hidden="true"
                        />
                      </td>
                    )}
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                      {absoluteIndex}
                    </td>

                    {/* Participant Name & Email */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span 
                          style={avatarStyle}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10.5px] font-bold shrink-0 tracking-tight shadow-xs"
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 truncate max-w-[150px] text-xs group-hover:text-sky-600 transition-colors">
                              {p.name || 'Participant'}
                            </span>
                            {isGroupedMode && p.eventsCount > 1 && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0" 
                                title={`Registered for ${p.eventsCount} distinct competitions`}
                              >
                                <Layers className="w-2.5 h-2.5 text-indigo-600" />
                                <span>{p.eventsCount} Events</span>
                              </span>
                            )}
                            {callCount > 0 && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 shrink-0" 
                                title={`Already contacted ${callCount} time(s). Last by ${rec?.lastCallerName || rec?.history?.[0]?.callerName || 'Staff'} on ${formatCallTime(rec?.lastCalledAt)}`}
                              >
                                <PhoneCall className="w-2.5 h-2.5 text-amber-600" />
                                <span>Called ({callCount})</span>
                              </span>
                            )}
                            {rowIsCancelled && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9.5px] font-bold border shrink-0 ${
                                  p.cancel_reverted
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                                title={
                                  p.cancel_reverted
                                    ? 'Won back: re-registered on techfest26.in'
                                    : `Cancelled registration${p.cancelled_at ? ` on ${new Date(p.cancelled_at).toLocaleDateString('en-IN')}` : ''}. Call to capture the reason.`
                                }
                              >
                                <XCircle className="w-2.5 h-2.5" />
                                <span>{p.cancel_reverted ? 'Won Back' : 'Cancelled'}</span>
                              </span>
                            )}
                          </div>
                          <div 
                            className="flex items-center gap-1 font-mono text-[11px] text-slate-500 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate max-w-[145px]">{p.email || 'N/A'}</span>
                            {p.email && p.email !== 'N/A' && (
                              <button
                                onClick={(e) => handleCopyEmail(e, p.email)}
                                title="Copy Email"
                                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                              >
                                {copiedEmail === p.email ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone & Direct Calling */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {p.phone && p.phone !== 'N/A' ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-slate-700">
                            <span>{p.phone}</span>

                            {/* Direct Phone Call / Re-Call Button */}
                            {callCount > 0 ? (
                              <button
                                onClick={() => onTriggerCall && onTriggerCall(p)}
                                title={`Already contacted ${callCount} time(s). Last by ${rec.lastCallerName || rec.history?.[0]?.callerName || 'Staff'} on ${formatCallTime(rec.lastCalledAt)}. Click to log follow-up call.`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                              >
                                <PhoneCall className="w-3 h-3 text-amber-600" />
                                <span>Re-Call ({callCount})</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onTriggerCall && onTriggerCall(p)}
                                title="Direct Phone Call & Log Remarks"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                              >
                                <PhoneCall className="w-3 h-3 text-white" />
                                <span className="font-mono text-[10px]">Call</span>
                              </button>
                            )}

                            {/* WhatsApp Button */}
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Chat on WhatsApp"
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-xs"
                              >
                                WA
                              </a>
                            )}
                          </div>

                          {/* Dynamic Calling Status Badge, Caller Name, Time & Remark */}
                          {callCount > 0 ? (
                            <div className="p-1.5 rounded-lg bg-amber-50/70 border border-amber-200/90 space-y-1 max-w-[250px] shadow-2xs">
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono border font-semibold ${statusDef?.badge || 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusDef?.indicator || 'bg-amber-500'}`} />
                                  <span>{statusDef?.label || rec.lastStatus || 'Called'}</span>
                                </span>
                                <span className="text-[9.5px] font-medium text-amber-800 shrink-0 font-mono">
                                  {formatCallTime(rec.lastCalledAt)}
                                </span>
                              </div>

                              <div className="text-[10px] text-amber-950 font-medium flex items-center justify-between gap-1">
                                <span className="truncate">
                                  👤 By: <span className="font-semibold text-amber-900">{rec.lastCallerName || rec.history?.[0]?.callerName || 'Staff'}</span>
                                </span>
                                {rec.leadNumber && (
                                  <span className="text-[9.5px] font-mono text-amber-700 bg-amber-100/80 px-1 rounded">
                                    #{rec.leadNumber}
                                  </span>
                                )}
                              </div>

                              {rec.lastRemark && rec.lastRemark !== 'No remarks entered.' && (
                                <div className="text-[9.5px] text-slate-700 bg-white/90 p-1 rounded border border-amber-200/70 truncate italic" title={rec.lastRemark}>
                                  "{rec.lastRemark}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              <span>Never Called (Fresh Lead)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-slate-400">--</span>
                      )}
                    </td>

                    {/* College & Specialization */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 truncate max-w-[200px]" title={p.college}>
                        {p.college || 'N/A'}
                      </div>
                      {p.specialization && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px] mt-0.5">
                          <span>{p.specialization}</span>
                          {p.passing_year && <span className="text-slate-400"> • {p.passing_year}</span>}
                        </div>
                      )}
                    </td>

                    {/* Event, Track & Domain Badge (Supports Multi-Event Grouping) */}
                    <td className="py-3 px-3">
                      {isGroupedMode && p.events && p.events.length > 1 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const sortedEvents = [...p.events].sort((a, b) => {
                                if (selectedEvent && a.event_name?.toLowerCase() === selectedEvent.toLowerCase()) return -1;
                                if (selectedEvent && b.event_name?.toLowerCase() === selectedEvent.toLowerCase()) return 1;
                                return 0;
                              });
                              const firstTwo = sortedEvents.slice(0, 2);
                              const remaining = sortedEvents.length - 2;

                              return (
                                <>
                                  {firstTwo.map((ev, i) => {
                                    const dom = getDomainForEvent(ev.event_name);
                                    const isSelected = selectedEvent && ev.event_name?.toLowerCase() === selectedEvent.toLowerCase();
                                    return (
                                      <div
                                        key={i}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium border truncate max-w-[170px] ${
                                          isSelected
                                            ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold'
                                            : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                        }`}
                                        title={`${ev.event_name} (${dom?.name || 'General'})`}
                                      >
                                        <span 
                                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                                          style={{ backgroundColor: dom?.accentColor || '#64748b' }} 
                                        />
                                        <span className="truncate">{ev.event_name}</span>
                                      </div>
                                    );
                                  })}
                                  {remaining > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectParticipant(p);
                                      }}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                      title="Click to view all registered competitions in Candidate Drawer"
                                    >
                                      +{remaining} more
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {p.eventsCount} registered events
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900 truncate max-w-[170px]" title={p.event_name}>
                            {p.event_name || 'Event'}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {renderTrackBadge(p.event_type)}
                            {domainInfo && (
                              <span 
                                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-medium border"
                                style={{ 
                                  borderColor: `${domainInfo.accentColor}40`, 
                                  color: domainInfo.accentColor, 
                                  backgroundColor: `${domainInfo.accentColor}12` 
                                }}
                              >
                                {domainInfo.name}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Team Roster */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {isGroupedMode && p.eventsCount > 1 ? (
                        <div>
                          <div className="text-slate-700 truncate max-w-[110px]" title={p.team_name || 'Multiple teams'}>
                            {p.team_name ? p.team_name : `${p.eventsCount} Events`}
                          </div>
                          <div className="mt-0.5">
                            <button
                              onClick={() => onSelectParticipant(p)}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 hover:text-purple-900 font-medium cursor-pointer"
                            >
                              <Users className="w-3 h-3" />
                              <span>View Roster</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-slate-700 truncate max-w-[110px]" title={p.team_name}>
                            {p.team_name || 'Individual'}
                          </div>
                          <div className="mt-0.5">
                            {hasMembers ? (
                              <button
                                onClick={() => onSelectParticipant(p)}
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-purple-700 hover:text-purple-900 font-medium cursor-pointer"
                              >
                                <Users className="w-3 h-3" />
                                <span>{p.team_members.length} members</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">Solo</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* View Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onSelectParticipant(p)}
                        className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="View Full Candidate Profile"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Responsive Mobile Cards Feed */}
      <div className="md:hidden divide-y divide-slate-100 bg-white">
        {pageItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            {focusCancelled
              ? 'No cancelled registrations in this scope.'
              : 'No participants found matching active filters.'}
          </div>
        ) : (
          pageItems.map((p, idx) => {
            const avatarStyle = getAvatarStyle(p.name);
            const initials = getInitials(p.name);
            const cleanPhone = (p.phone || '').replace(/[^0-9]/g, '');
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}` : null;
            const rec = getParticipantCallRecord(p);
            const callCount = rec?.callCount || 0;
            const statusDef = rec?.lastStatus ? CALL_STATUSES[rec.lastStatus] : null;
            const domainInfo = getDomainForEvent(p.event_name);

            return (
              <div 
                key={p.uniqueKey || p.id || idx}
                onClick={() => onSelectParticipant(p)}
                className={`p-4 space-y-2.5 cursor-pointer active:bg-slate-50 ${
                  isParticipantCancelled(p)
                    ? p.cancel_reverted
                      ? 'bg-emerald-50/40 border-l-2 border-emerald-500'
                      : 'bg-rose-50/50 border-l-2 border-rose-500'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span 
                      style={avatarStyle}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-xs"
                    >
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 text-xs truncate max-w-[150px]">{p.name}</span>
                        {isGroupedMode && p.eventsCount > 1 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            {p.eventsCount} Events
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{p.email || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {isGroupedMode && p.events && p.events.length > 1 ? (
                  <div className="text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const sortedEvents = [...p.events].sort((a, b) => {
                          if (selectedEvent && a.event_name?.toLowerCase() === selectedEvent.toLowerCase()) return -1;
                          if (selectedEvent && b.event_name?.toLowerCase() === selectedEvent.toLowerCase()) return 1;
                          return 0;
                        });
                        const firstTwo = sortedEvents.slice(0, 2);
                        const remaining = sortedEvents.length - 2;

                        return (
                          <>
                            {firstTwo.map((ev, i) => {
                              return (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-800 truncate max-w-[160px]"
                                >
                                  {ev.event_name}
                                </span>
                              );
                            })}
                            {remaining > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                                +{remaining} more
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{p.college}</div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>{p.event_name}</span>
                      {domainInfo && (
                        <span 
                          className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border"
                          style={{ color: domainInfo.accentColor, borderColor: `${domainInfo.accentColor}30`, backgroundColor: `${domainInfo.accentColor}10` }}
                        >
                          {domainInfo.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.college}</div>
                  </div>
                )}

                {/* Call Status & Direct Action Buttons */}
                <div className="pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  {callCount > 0 ? (
                    <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/90 space-y-1 mb-2">
                      <div className="flex items-center justify-between gap-1 text-[10.5px]">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono border font-semibold ${statusDef?.badge || 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDef?.indicator || 'bg-amber-500'}`} />
                          <span>{statusDef?.label || rec.lastStatus || 'Called'}</span>
                        </span>
                        <span className="text-[10px] font-medium text-amber-900 font-mono">
                          {formatCallTime(rec.lastCalledAt)}
                        </span>
                      </div>

                      <div className="text-[10.5px] text-amber-950 font-medium flex items-center justify-between">
                        <span>👤 Called by: <strong className="text-amber-900">{rec.lastCallerName || rec.history?.[0]?.callerName || 'Staff'}</strong></span>
                        {rec.leadNumber && (
                          <span className="text-[9.5px] font-mono text-amber-800 bg-amber-100 px-1 rounded">
                            #{rec.leadNumber}
                          </span>
                        )}
                      </div>

                      {rec.lastRemark && rec.lastRemark !== 'No remarks entered.' && (
                        <div className="text-[10px] text-slate-700 bg-white/90 p-1.5 rounded border border-amber-200/60 italic" title={rec.lastRemark}>
                          "{rec.lastRemark}"
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10.5px] font-mono text-slate-400">
                      {callCount > 0 ? (
                        <span className="text-amber-800 font-semibold font-sans flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Contacted ({callCount}x)</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span>Never Called</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.phone && p.phone !== 'N/A' && (
                        <button
                          onClick={() => onTriggerCall && onTriggerCall(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 ${
                            callCount > 0
                              ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                          }`}
                        >
                          <PhoneCall className={`w-3 h-3 ${callCount > 0 ? 'text-amber-600' : 'text-white'}`} />
                          <span>{callCount > 0 ? `Re-Call (${callCount})` : 'Call'}</span>
                        </button>
                      )}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 shadow-xs"
                        >
                          WA
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Pagination Bar */}
      <div className="p-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        
        <div className="flex items-center gap-2">
          <span>Showing</span>
          <span className="font-mono text-slate-900 font-semibold">{filteredParticipants.length > 0 ? startIndex + 1 : 0}</span>
          <span>to</span>
          <span className="font-mono text-slate-900 font-semibold">{endIndex}</span>
          <span>of</span>
          <span className="font-mono text-slate-900 font-semibold">{filteredParticipants.length}</span>
          <span>{isGroupedMode ? 'unique students' : 'verified records'}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-800 outline-none shadow-xs cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center gap-1 font-mono text-xs">
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
              disabled={effectivePage <= 1 || pageSize === 'all'}
              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 text-slate-700 font-medium select-none">
              Page {effectivePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => setCurrentPage(Math.min(totalPages, effectivePage + 1))}
              disabled={effectivePage >= totalPages || pageSize === 'all'}
              className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

      </div>

    </div>
  );
}
