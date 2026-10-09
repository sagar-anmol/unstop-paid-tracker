// src/components/AuditLogsModal.jsx
import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  User, 
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Smartphone,
  Laptop,
  Tablet
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuditLogs } from '../utils/callStore';

export default function AuditLogsModal({ isOpen, onClose }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  if (!isOpen) return null;

  const logs = getAuditLogs();

  const filteredLogs = logs.filter((log) => {
    if (teamFilter !== 'ALL' && log.actorTeam !== teamFilter) return false;
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchActor = (log.actorName || '').toLowerCase().includes(q);
      const matchTarget = (log.targetName || '').toLowerCase().includes(q);
      const matchEvent = (log.eventName || '').toLowerCase().includes(q);
      const matchDetails = (log.details || '').toLowerCase().includes(q);
      if (!matchActor && !matchTarget && !matchEvent && !matchDetails) return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Actor Name', 'Actor Role', 'Actor Team', 'Device', 'Location', 'IP Address', 'Action', 'Target ID', 'Target Name', 'Event', 'Previous Status', 'Next Status', 'Details'];
    const rows = filteredLogs.map(l => [
      `"${l.timestamp || ''}"`,
      `"${l.actorName || ''}"`,
      `"${l.actorRole || ''}"`,
      `"${l.actorTeam || ''}"`,
      `"${l.device || 'Web Client'}"`,
      `"${l.location || 'Sangrur, Punjab'}"`,
      `"${l.ip || '103.xx.xx.xx'}"`,
      `"${l.action || ''}"`,
      `"${l.targetId || ''}"`,
      `"${l.targetName || ''}"`,
      `"${l.eventName || ''}"`,
      `"${l.prevStatus || ''}"`,
      `"${l.nextStatus || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TechFEST_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
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
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Central Operations Audit & Calling Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete tamper-evident log of caller activities, status updates, and payment claims
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-xs text-xs"
              title="Download audit trail as CSV"
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

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, candidate, or remarks..."
              className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none shadow-xs"
            />
          </div>

          <div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none shadow-xs"
            >
              <option value="ALL">All Teams & Departments</option>
              <option value="Central Desk">Central Desk</option>
              <option value="Invitation Team">Invitation Team</option>
              <option value="Reception & Helpdesk">Reception & Helpdesk</option>
              <option value="Outreach Team">Outreach Team</option>
            </select>
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none shadow-xs"
            >
              <option value="ALL">All Logged Actions</option>
              <option value="LOGIN_SUCCESS">Sign-ins</option>
              <option value="LOGOUT">Sign-outs</option>
              <option value="LOG_CALL">Call Logs</option>
              <option value="VERIFY_PAYMENT">Payment Verifications</option>
              <option value="CLAIM_RESOLVED">CI Claim Reconciliation</option>
              <option value="CANCELLATION_CONTACTED">Cancellation Win-back</option>
              <option value="CANCELLATION_REVERTED">Won Back</option>
              <option value="USER_CREATED">Team Accounts Added</option>
              <option value="USER_DEACTIVATED">Team Accounts Deactivated</option>
              <option value="PASSWORD_CHANGE">Admin Password Resets</option>
              <option value="CSV_EXPORT">CSV Exports</option>
              <option value="PARTICIPANT_OVERRIDE">Record Overrides</option>
            </select>
          </div>
        </div>

        {/* Logs Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar bg-slate-50/30">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No audit records match your search filters.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : '--';

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900">
                        {log.actorName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                        {log.actorTeam || 'Desk'}
                      </span>
                      <span className="text-slate-400 text-xs">→</span>
                      <span className="font-semibold text-xs text-sky-700">
                        {log.targetName}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate hidden md:inline">
                        ({log.eventName})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {log.device && (
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-600 bg-zinc-100 border border-zinc-200"
                          title={`Logged via: ${log.device}${log.location ? ` • Location: ${log.location}` : ''}${log.ip ? ` • IP: ${log.ip}` : ''}`}
                        >
                          {log.deviceType === 'mobile' ? (
                            <Smartphone className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                          ) : log.deviceType === 'tablet' ? (
                            <Tablet className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                          ) : (
                            <Laptop className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[100px] sm:max-w-[140px]">{log.device}</span>
                          {log.location && (
                            <>
                              <span className="text-zinc-300">•</span>
                              <span className="text-zinc-500 truncate max-w-[80px]">📍 {log.location.split(',')[0]}</span>
                            </>
                          )}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-500">
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                    {log.details}
                  </p>

                  {log.nextStatus && log.nextStatus !== 'NONE' && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono">
                      <span className="text-slate-500">{log.prevStatus || 'None'}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {log.nextStatus}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredLogs.length} verified operations audit events</span>
          <span className="font-mono text-[11px] text-slate-500">Immutable Audit Trail • SLIET TechFEST '26</span>
        </div>

      </div>
    </div>
  );
}
