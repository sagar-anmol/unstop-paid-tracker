import React, { useMemo } from 'react';
import { DOMAINS_DIRECTORY, getDomainStats } from '../utils/auth';
import { getCallRecords } from '../utils/callStore';

export default function DomainBanner({ 
  domainId, 
  currentUser, 
  participants, 
  onSelectEventFilter,
  selectedEvent 
}) {
  const domain = DOMAINS_DIRECTORY[domainId];
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const stats = useMemo(
    () => (domain ? getDomainStats(domainId, participants) : null),
    [domain, domainId, participants]
  );

  // Real call coverage scoped to this domain's participants
  const callCoverage = useMemo(() => {
    if (!participants.length) return { called: 0, pct: 0 };
    const records = getCallRecords();
    const ids = new Set(participants.map(p => String(p.id)));
    const called = [...ids].filter(id => (records[id]?.callCount || 0) > 0).length;
    return { called, pct: Math.round((called / ids.size) * 100) };
  }, [participants]);

  // Per-event call coverage, computed once for all event chips
  const eventCalledPct = useMemo(() => {
    const records = getCallRecords();
    const byEvent = {};
    participants.forEach(p => {
      const ev = p.event_name;
      if (!ev) return;
      if (!byEvent[ev]) byEvent[ev] = { total: 0, called: 0 };
      byEvent[ev].total += 1;
      if ((records[String(p.id)]?.callCount || 0) > 0) byEvent[ev].called += 1;
    });
    const out = {};
    Object.entries(byEvent).forEach(([ev, v]) => {
      out[ev] = v.total > 0 ? Math.round((v.called / v.total) * 100) : 0;
    });
    return out;
  }, [participants]);

  // Early return: everything above must stay unconditional so hook order is stable
  if (!domain || !stats) return null;

  return (
    <div className="bg-white rounded-xl p-5 mb-6 border border-slate-200 shadow-sm relative overflow-hidden">
      <div className="relative z-10 space-y-4">
        
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div 
              className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs border"
              style={{ 
                backgroundColor: `${domain.accentColor}15`,
                color: domain.accentColor || '#0284C7',
                borderColor: `${domain.accentColor}30`
              }}
            >
              {domain.bay?.split('-')[1] || domain.name.substring(0, 2).toUpperCase()}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {domain.name.toUpperCase()}
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {domain.bay}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase text-sky-700 bg-sky-50 border border-sky-200">
                  {domain.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {domain.department} • <span className="text-slate-700 font-medium">{domain.tagline}</span>
              </p>
            </div>
          </div>

          {/* Session Status Pill */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {isSuperAdmin ? (
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5 shadow-xs">
                <span>👑 Super Admin Filter View</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Logged In as {currentUser?.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Domain Metrics Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                {selectedEvent ? 'Event Attendees' : 'Domain Attendees'}
              </div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {selectedEvent ? (stats.eventCounts?.[selectedEvent] ?? 0) : stats.totalParticipants}
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                {selectedEvent ? `Part of ${stats.totalParticipants} domain total` : `Across ${stats.uniqueColleges} colleges`}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-semibold">Paid Revenue</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="text-[10px] font-mono text-emerald-800/80 mt-0.5">{stats.paidCount} Paid • {stats.freeCount} Free</div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50/60 border border-sky-200/80">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-800 font-semibold">Competitions</div>
              <div className="text-xl font-bold text-sky-800 mt-0.5">{stats.eventsCount}</div>
              <div className="text-[10px] font-mono text-sky-700/80 mt-0.5">Active TechFEST Events</div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-800 font-semibold">Outreach Conversion</div>
              <div className="text-xl font-bold text-amber-800 mt-0.5">
                {stats.totalParticipants > 0 ? Math.round((stats.paidCount / stats.totalParticipants) * 100) : 0}%
              </div>
              <div className="text-[10px] font-mono text-amber-700 mt-0.5">Paid Conversion Ratio</div>
              {/* Real progress bar: paid vs total for this domain */}
              <div className="w-full h-1 rounded-full bg-amber-100 overflow-hidden mt-1.5">
                <div
                  style={{ width: `${stats.totalParticipants > 0 ? Math.round((stats.paidCount / stats.totalParticipants) * 100) : 0}%` }}
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-sky-50/60 border border-sky-200/80">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-800 font-semibold">Call Coverage</div>
              <div className="text-xl font-bold text-sky-800 mt-0.5">{callCoverage.pct}%</div>
              <div className="text-[10px] font-mono text-sky-700/80 mt-0.5">
                {callCoverage.called} of {participants.length} contacted
              </div>
              <div className="w-full h-1 rounded-full bg-sky-100 overflow-hidden mt-1.5">
                <div
                  style={{ width: `${callCoverage.pct}%` }}
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Domain Events Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
              Assigned Competitions & Tracks ({domain.events.length})
            </span>
            {selectedEvent && (
              <button
                onClick={() => onSelectEventFilter && onSelectEventFilter('')}
                className="text-[10px] font-mono text-sky-600 hover:text-sky-800 cursor-pointer font-medium"
              >
                Clear Event Filter ({selectedEvent})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {domain.events.map((ev, i) => {
              const isSelected = selectedEvent === ev;
              const evCount = stats?.eventCounts?.[ev] ?? 0;
              // Per-event progress: share of this event's attendees who have been contacted
              const evCalled = eventCalledPct[ev] ?? 0;
              return (
                <button
                  key={i}
                  onClick={() => onSelectEventFilter && onSelectEventFilter(isSelected ? '' : ev)}
                  title={`${evCount} registered • ${evCalled}% contacted`}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  <span>{ev}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {evCount}
                  </span>
                  {evCount > 0 && (
                    <span className={`w-1 h-1 rounded-full ${
                      evCalled >= 60 ? 'bg-emerald-500' : evCalled > 0 ? 'bg-amber-400' : 'bg-zinc-300'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
