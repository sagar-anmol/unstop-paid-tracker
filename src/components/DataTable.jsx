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
  AlertCircle
} from 'lucide-react';
import { getAvatarStyle, getInitials } from '../utils/avatar';
import { getCallRecords, CALL_STATUSES } from '../utils/callStore';
import { getDomainForEvent, DOMAINS_DIRECTORY } from '../utils/auth';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  onTriggerToast 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState('all');
  const [selectedCallStatus, setSelectedCallStatus] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(selectedEventFilter || '');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  
  // Sync selectedEvent with prop if changed from DomainBanner
  useEffect(() => {
    setSelectedEvent(selectedEventFilter || '');
  }, [selectedEventFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedEmail, setCopiedEmail] = useState(null);

  // Fetch call records database (reactive to callDbVersion from Neon cloud)
  const callRecords = useMemo(() => getCallRecords(), [participants, callDbVersion]);

  // Active domain info if scoped
  const activeDomain = activeDomainId ? DOMAINS_DIRECTORY[activeDomainId] : null;

  // Category counts based on accessible participants
  const categoryCounts = useMemo(() => {
    const counts = { all: participants.length, competitions: 0, quizzes: 0, hackathons: 0, cultural: 0 };
    participants.forEach(p => {
      const t = (p.event_type || 'competitions').toLowerCase();
      if (t.includes('quiz')) counts.quizzes++;
      else if (t.includes('hack')) counts.hackathons++;
      else if (t.includes('cultur')) counts.cultural++;
      else counts.competitions++;
    });
    return counts;
  }, [participants]);

  // Payment counts
  const paymentCounts = useMemo(() => {
    const paid = participants.filter(p => p.is_paid === true || p.payment_status === 'PAID' || Number(p.amount) > 0).length;
    const incomplete = participants.filter(p => p.is_paid === false || p.payment_status === 'INCOMPLETE' || p.payment_status === 'UNPAID' || (p.status_label && p.status_label.toLowerCase().includes('not paid'))).length;
    return { all: participants.length, paid, incomplete, free: Math.max(0, participants.length - paid - incomplete) };
  }, [participants]);

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
  }, [searchQuery, selectedCategory, selectedPayment, selectedCallStatus, selectedEvent, selectedCollege, sortBy]);

  // Colleges list
  const collegesList = useMemo(() => {
    return Array.from(new Set(participants.map(p => p.college).filter(Boolean))).sort();
  }, [participants]);

  // Filter & Search logic
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      // 1. Category
      if (selectedCategory !== 'all') {
        const t = (p.event_type || 'competitions').toLowerCase();
        if (selectedCategory === 'quizzes' && !t.includes('quiz')) return false;
        if (selectedCategory === 'hackathons' && !t.includes('hack')) return false;
        if (selectedCategory === 'cultural' && !t.includes('cultur')) return false;
        if (selectedCategory === 'competitions' && (t.includes('quiz') || t.includes('hack') || t.includes('cultur'))) return false;
      }

      // 2. Payment
      const isPaid = p.is_paid === true || p.payment_status === 'PAID' || Number(p.amount) > 0;
      const isIncomplete = p.is_paid === false || p.payment_status === 'INCOMPLETE' || p.payment_status === 'UNPAID' || (p.status_label && p.status_label.toLowerCase().includes('not paid'));
      if (selectedPayment === 'paid' && !isPaid) return false;
      if (selectedPayment === 'incomplete' && !isIncomplete) return false;
      if (selectedPayment === 'free' && (isPaid || isIncomplete)) return false;

      // 3. Calling Status Filter
      if (selectedCallStatus !== 'all') {
        const record = callRecords[String(p.id)];
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
        const pEv = (p.event_name || '').trim().toLowerCase();
        const selEv = selectedEvent.trim().toLowerCase();
        if (pEv !== selEv) {
          const isMatch = activeDomain?.events?.some(ev => ev.toLowerCase() === selEv && (pEv === ev.toLowerCase() || pEv.includes(ev.toLowerCase())));
          if (!isMatch) return false;
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
        const matchEvent = (p.event_name || '').toLowerCase().includes(q);
        const matchTeam = (p.team_name || '').toLowerCase().includes(q);
        const matchId = (p.id || '').toLowerCase().includes(q);

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
      if (sortBy === 'date-desc') return new Date(b.registered_at || 0) - new Date(a.registered_at || 0);
      if (sortBy === 'date-asc') return new Date(a.registered_at || 0) - new Date(b.registered_at || 0);
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'event-asc') return (a.event_name || '').localeCompare(b.event_name || '');
      if (sortBy === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === 'calls-desc') {
        const cA = callRecords[String(a.id)]?.callCount || 0;
        const cB = callRecords[String(b.id)]?.callCount || 0;
        return cB - cA;
      }
      return 0;
    });
  }, [participants, callRecords, selectedCategory, selectedPayment, selectedCallStatus, selectedEvent, selectedCollege, searchQuery, sortBy]);

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
      
      {/* 1. Header Bar: Category Tabs + Payment Segments */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 px-4 pt-2 border-b border-zinc-200/80 bg-white">
        
        {/* Category Segment Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Events', count: categoryCounts.all, countClass: 'text-slate-600 bg-slate-100', icon: Sparkles },
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

        {/* Payment Filter Segmented Tray */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 w-full md:w-auto overflow-x-auto justify-between md:justify-start mb-2 md:mb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All', count: paymentCounts.all, countClass: 'text-zinc-500' },
            { id: 'paid', label: 'Complete', count: paymentCounts.paid, countClass: 'text-zinc-900 font-semibold' },
            { id: 'incomplete', label: 'Incomplete', count: paymentCounts.incomplete, countClass: 'text-zinc-700 font-semibold' },
            { id: 'free', label: 'Free', count: paymentCounts.free, countClass: 'text-zinc-500' }
          ].map(p => {
            const isActive = selectedPayment === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { setSelectedPayment(p.id); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span>{p.label}</span>
                <span className={`text-[10px] font-mono ${p.countClass}`}>({p.count})</span>
              </button>
            );
          })}
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
              <th className="py-2.5 px-3 min-w-[120px] text-right">Payment Status</th>
              <th className="py-2.5 px-3 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-500">
                  <div className="max-w-xs mx-auto">
                    <Filter className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-slate-800">No participants found</p>
                    <p className="text-xs text-slate-500 mt-1">Try resetting search terms or switching categories.</p>
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
                const amt = Number(p.amount) || 0;
                const hasMembers = p.team_members && p.team_members.length > 0;

                // Call CRM record
                const rec = callRecords[String(p.id)] || (p.internal_id ? callRecords[String(p.internal_id)] : null);
                const callCount = rec?.callCount || 0;
                const statusDef = rec?.lastStatus ? CALL_STATUSES[rec.lastStatus] : null;

                // Resolve domain
                const domainInfo = getDomainForEvent(p.event_name);

                return (
                  <tr 
                    key={p.id || idx}
                    onClick={() => onSelectParticipant(p)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
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
                          <div className="font-semibold text-slate-900 truncate max-w-[190px] text-xs group-hover:text-sky-600 transition-colors">
                            {p.name || 'Participant'}
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-slate-700">
                            <span>{p.phone}</span>

                            {/* Direct Phone Call Button */}
                            <button
                              onClick={() => onTriggerCall && onTriggerCall(p)}
                              title="Direct Phone Call & Log Remarks"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white bg-zinc-900 hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
                            >
                              <PhoneCall className="w-3 h-3 text-white" />
                              <span className="font-mono text-[10px]">{callCount > 0 ? `${callCount} calls` : 'Call'}</span>
                            </button>

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

                          {/* Dynamic Calling Status Badge & Remark */}
                          {statusDef ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium ${statusDef.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusDef.indicator}`} />
                                  <span>{statusDef.label || statusDef.shortLabel}</span>
                                </span>
                                {rec.leadNumber && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    #{rec.leadNumber}
                                  </span>
                                )}
                              </div>
                              {rec.lastRemark && rec.lastRemark !== 'No remarks entered.' && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[190px] italic" title={rec.lastRemark}>
                                  "{rec.lastRemark}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              <span>Never Called</span>
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

                    {/* Event, Track & Domain Badge */}
                    <td className="py-3 px-3">
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
                    </td>

                    {/* Team Roster */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
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
                    </td>

                    {/* Payment Status Pill */}
                    <td className="py-3 px-3 text-right">
                      {amt > 0 || p.payment_status === 'PAID' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <span>{amt > 0 ? `₹${amt.toLocaleString('en-IN')}` : 'Paid'}</span>
                          </span>
                        </div>
                      ) : p.payment_status === 'INCOMPLETE' || (p.status_label && p.status_label.toLowerCase().includes('not paid')) ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200" title="Registration Fee Pending">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Incomplete</span>
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
                          Free Entry
                        </span>
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
            No participants found matching active filters.
          </div>
        ) : (
          pageItems.map((p, idx) => {
            const avatarStyle = getAvatarStyle(p.name);
            const initials = getInitials(p.name);
            const cleanPhone = (p.phone || '').replace(/[^0-9]/g, '');
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}` : null;
            const amt = Number(p.amount) || 0;
            const rec = callRecords[String(p.id)] || (p.internal_id ? callRecords[String(p.internal_id)] : null);
            const callCount = rec?.callCount || 0;
            const statusDef = rec?.lastStatus ? CALL_STATUSES[rec.lastStatus] : null;
            const domainInfo = getDomainForEvent(p.event_name);

            return (
              <div 
                key={p.id || idx}
                onClick={() => onSelectParticipant(p)}
                className="p-4 space-y-2.5 active:bg-slate-50 cursor-pointer"
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
                      <div className="font-semibold text-slate-900 text-xs truncate">{p.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">{p.email || 'N/A'}</div>
                    </div>
                  </div>

                  {amt > 0 || p.payment_status === 'PAID' ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 shrink-0">
                      {amt > 0 ? `₹${amt}` : 'Paid'}
                    </span>
                  ) : p.payment_status === 'INCOMPLETE' || (p.status_label && p.status_label.toLowerCase().includes('not paid')) ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 shrink-0">
                      Incomplete
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 shrink-0">
                      Free
                    </span>
                  )}
                </div>

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

                {/* Call Status & Direct Action Buttons */}
                <div className="flex items-center justify-between pt-1 gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="min-w-0 flex-1 pr-1">
                    {statusDef ? (
                      <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border font-medium ${statusDef.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDef.indicator}`} />
                          <span>{statusDef.label || statusDef.shortLabel}</span>
                        </span>
                        {rec.lastRemark && rec.lastRemark !== 'No remarks entered.' && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[170px] italic mt-0.5" title={rec.lastRemark}>
                            "{rec.lastRemark}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span>Never Called</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.phone && p.phone !== 'N/A' && (
                      <button
                        onClick={() => onTriggerCall && onTriggerCall(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <PhoneCall className="w-3 h-3 text-white" />
                        <span>Call {callCount > 0 ? `(${callCount})` : ''}</span>
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
          <span>verified records</span>
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
