// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, PhoneCall } from 'lucide-react';
import Header from './components/Header';
import BentoGrid from './components/BentoGrid';
import KPIStrip from './components/KPIStrip';
import DataTable from './components/DataTable';
import CandidateDrawer from './components/CandidateDrawer';
import TokenModal from './components/TokenModal';
import BookmarkletModal from './components/BookmarkletModal';

import CallRemarkModal from './components/CallRemarkModal';
import AuditLogsModal from './components/AuditLogsModal';
import VerificationQueueModal from './components/VerificationQueueModal';
import DomainBanner from './components/DomainBanner';
import LoginScreen from './components/LoginScreen';
import PasswordManagerModal from './components/PasswordManagerModal';
import DeviceActivityModal from './components/DeviceActivityModal';
import AntiGravityReportModal from './components/AntiGravityReportModal';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';
import Toast from './components/Toast';

// data.json is fetched at runtime (with a CDN fallback) rather than imported,
// so the multi-megabyte dataset does not ship inside the JS bundle.

import { exportParticipantsToCSV } from './utils/csv';
import { 
  getActiveUser, 
  setActiveUser, 
  clearActiveUser, 
  getParticipantsForUser, 
  syncPasswordsWithNeon,
  loadDynamicUsers,
  isUserUsingDefaultPassword,
  DOMAINS_DIRECTORY 
} from './utils/auth';
import { 
  applyParticipantOverrides, 
  saveParticipantOverride 
} from './utils/participantOverrides';
import { 
  logCallForParticipant, 
  getVerificationAlerts, 
  getCallRecords,
  syncWithNeonDatabase,
  addAuditLog,
  CALL_STATUSES 
} from './utils/callStore';
import { isParticipantCancelled, buildTechfestPaymentIndex } from './utils/paymentUtils';
import { subscribeDbStatus, isDatabaseConfigured } from './utils/neonDb';
import { recordLoginSession } from './utils/device';

// Both data.json and the techfest26.in payments snapshot are fetched at
// runtime, so the multi-megabyte dataset never ships inside the JS bundle.
export default function App() {
  const [participants, setParticipants] = useState([]);
  const [summary, setSummary] = useState({});
  const [dataError, setDataError] = useState(null);
  const [techfestPayments, setTechfestPayments] = useState({ records: [] });

  const [currentUser, setCurrentUser] = useState(() => getActiveUser());
  const [selectedDomainOverride, setSelectedDomainOverride] = useState('ALL');
  const [selectedEventFilter, setSelectedEventFilter] = useState('');
  const [callDbVersion, setCallDbVersion] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  
  // Modals state
  const [isForcePasswordModalOpen, setIsForcePasswordModalOpen] = useState(false);
  const [isBookmarkletOpen, setIsBookmarkletOpen] = useState(false);
  const [isTokenHealthOpen, setIsTokenHealthOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isVerificationQueueOpen, setIsVerificationQueueOpen] = useState(false);
  // Removed: the NeonConfigModal let any visitor paste a database URL into the
  // shared bundle. Connection settings now come from the build environment.
  const [isPasswordManagerOpen, setIsPasswordManagerOpen] = useState(false);
  const [isDeviceActivityOpen, setIsDeviceActivityOpen] = useState(false);
  const [isAntiGravityReportOpen, setIsAntiGravityReportOpen] = useState(false);
  
  // Active call logging modal state
  const [callingCandidate, setCallingCandidate] = useState(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tf_theme_v2');
    if (saved) return saved;
    return 'light';
  });
  const [neonStatus, setNeonStatus] = useState({ isConnected: false, isSyncing: false });

  // Without a configured URL the panel runs fully on localStorage; the UI says
  // so rather than silently pretending to be synced.
  const dbConfigured = isDatabaseConfigured();
  const neonDbConfigured = dbConfigured;

  // Sync theme with document root
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#F4F4F5';
      document.body.style.color = '#18181B';
    } else {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0B0D11';
      document.body.style.color = '#F5F7FA';
    }
  }, [theme]);

  // Keep a ref to the toast timeout so a rapid second toast does not clear early
  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const triggerToast = useCallback((toastData) => {
    setToast(toastData);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(current => current === toastData ? null : current);
    }, 3200);
  }, []);

  // Theme toggle
  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tf_theme_v2', next);
  }, [theme]);

  // Load live data
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const timestamp = Date.now();
      // Fetched at runtime rather than imported so the multi-megabyte dataset stays
      // out of the JS bundle. The raw.githubusercontent mirror is a fallback for
      // when Pages is serving a stale copy.
      const urls = [
        `./data.json?t=${timestamp}`,
        'https://raw.githubusercontent.com/sagar-anmol/unstop-paid-tracker/main/data.json'
      ];

      // Payment snapshot is small (kilobytes) and drives the rupee figures
      try {
        const payRes = await fetch(`./data/techfest26_payments.json?t=${timestamp}`);
        if (payRes.ok) {
          const payData = await payRes.json();
          if (payData && typeof payData === 'object') setTechfestPayments(payData);
        }
      } catch (e) {
        // Keep the previous snapshot rather than blanking the KPI card
      }

      let loaded = false;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.participants && Array.isArray(data.participants)) {
              setParticipants(applyParticipantOverrides(data.participants));
              if (data.summary) setSummary(data.summary);
              setDataError(null);
              loaded = true;
              break;
            } else if (Array.isArray(data)) {
              setParticipants(applyParticipantOverrides(data));
              setDataError(null);
              loaded = true;
              break;
            }
          }
        } catch (e) {
          // try next URL
        }
      }

      if (!loaded) {
        setDataError(
          'Could not load the registration dataset. Check your connection and retry from the header.'
        );
        triggerToast({ type: 'error', message: 'Dataset unavailable.' });
        return;
      }

      if (isManual) {
        // Refresh credentials and ops state; the dataset above was just refetched
        await Promise.allSettled([syncWithNeonDatabase(), syncPasswordsWithNeon()]);
        triggerToast({
          type: neonDbConfigured ? 'success' : 'info',
          message: neonDbConfigured
            ? 'Dashboard & Neon Database synced!'
            : 'Dashboard reloaded. Neon sync is off because no database URL is configured.'
        });
      }
    } catch (err) {
      if (isManual) {
        triggerToast({ type: 'error', message: 'Failed to refresh data' });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [triggerToast, neonDbConfigured]);

  // Load once on mount. Re-running on every participants change would refetch
  // the multi-megabyte dataset on each poll.
  useEffect(() => {
    fetchData();
     
  }, []);

  // Subscribe to Neon DB connection status
  useEffect(() => {
    const unsubscribe = subscribeDbStatus(setNeonStatus);
    return () => unsubscribe();
  }, []);

  // Sync ops state with Neon on load, on focus, and on a backed-off interval
  useEffect(() => {
    const doSync = () => {
      if (!neonDbConfigured) return;
      syncWithNeonDatabase();
      syncPasswordsWithNeon();
    };

    doSync();

    // Start at 60s and relax to 5min after the tab has been idle, so a desk left
    // open all day does not hammer the database every minute.
    const FAST_MS = 60000;
    const SLOW_MS = 300000;
    let pollMs = FAST_MS;
    let slowTimer = null;

    const clearSlowTimer = () => {
      if (slowTimer) {
        clearTimeout(slowTimer);
        slowTimer = null;
      }
    };

    const setPoll = (ms) => {
      clearInterval(interval);
      pollMs = ms;
      interval = setInterval(doSync, pollMs);
    };

    const armSlowDown = () => {
      clearSlowTimer();
      slowTimer = setTimeout(() => setPoll(SLOW_MS), 5 * 60 * 1000);
    };

    const resetToFast = () => {
      if (pollMs === FAST_MS) return;
      setPoll(FAST_MS);
      armSlowDown();
    };

    let interval = setInterval(() => { doSync(); armSlowDown(); }, FAST_MS);
    armSlowDown();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetToFast();
        doSync();
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleNeonSynced = () => {
      setCallDbVersion(v => v + 1);
    };
    window.addEventListener('tf_neon_synced', handleNeonSynced);

    return () => {
      clearInterval(interval);
      clearSlowTimer();
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('tf_neon_synced', handleNeonSynced);
    };
  }, [neonDbConfigured]);

  // Load runtime-managed team accounts so new logins resolve without a redeploy
  useEffect(() => {
    if (neonDbConfigured) {
      loadDynamicUsers().catch(() => {});
    }
  }, [neonDbConfigured]);

  // Active domain identification
  const activeDomainId = useMemo(() => {
    if (currentUser?.role === 'domain_head') {
      return currentUser.domainId;
    }
    if (currentUser?.role === 'super_admin' && selectedDomainOverride !== 'ALL') {
      return selectedDomainOverride;
    }
    return null;
  }, [currentUser, selectedDomainOverride]);

  // Scoped participants according to active user & domain
  const scopedParticipants = useMemo(() => {
    return getParticipantsForUser(currentUser, participants, selectedDomainOverride);
  }, [currentUser, participants, selectedDomainOverride]);

  // Displayed participants (applying event filter if set)
  const displayedParticipants = useMemo(() => {
    if (!selectedEventFilter) return scopedParticipants;
    const query = selectedEventFilter.toLowerCase().trim();
    const exactMatches = scopedParticipants.filter(p => (p.event_name || '').toLowerCase().trim() === query);
    if (exactMatches.length > 0) return exactMatches;
    return scopedParticipants.filter(p => {
      const target = (p.event_name || '').toLowerCase().trim();
      return target.includes(query) || query.includes(target);
    });
  }, [scopedParticipants, selectedEventFilter]);

  // Handle CSV Export
  const handleExportCSV = () => {
    const success = exportParticipantsToCSV(displayedParticipants);
    if (success) {
      addAuditLog({
        actorName: currentUser?.name || 'Staff',
        actorRole: currentUser?.role || 'editor',
        actorTeam: currentUser?.teamName || 'Operations',
        action: 'CSV_EXPORT',
        targetId: selectedDomainOverride || 'ALL',
        targetName: `${displayedParticipants.length} participant records`,
        eventName: 'Data Export',
        prevStatus: 'IN_VIEW',
        nextStatus: 'EXPORTED',
        details: `${currentUser?.name || 'Staff'} exported ${displayedParticipants.length} participant records (domain: ${activeDomainId || 'ALL'}) as CSV`
      });
      triggerToast({ type: 'success', message: `Exported ${displayedParticipants.length} attendees to CSV` });
    }
  };

  // Handle Login & Session Initialization
  const handleLoginSuccess = useCallback((user) => {
    setActiveUser(user);
    setCurrentUser(user);
    setSelectedDomainOverride('ALL');
    setSelectedEventFilter('');
    recordLoginSession(user);

    addAuditLog({
      actorName: user.name,
      actorRole: user.role,
      actorTeam: user.teamName || 'Operations',
      action: 'LOGIN_SUCCESS',
      targetId: user.username,
      targetName: user.name,
      eventName: 'Access Control',
      prevStatus: 'SIGNED_OUT',
      nextStatus: 'SIGNED_IN',
      details: `${user.name} (${user.username}) signed in as ${user.role}`
    });

    triggerToast({
      type: 'success',
      message: `Welcome, ${user.name}! Operations dashboard unlocked.`
    });

    // Every new account must replace its initial password at first sign-in
    if (isUserUsingDefaultPassword(user.username)) {
      setTimeout(() => {
        setIsForcePasswordModalOpen(true);
      }, 500);
    }
  }, [triggerToast]);

  // Handle Participant Record Edit by WebDev / Super Admin
  const handleUpdateParticipant = useCallback((participantId, updatedFields) => {
    saveParticipantOverride(participantId, updatedFields, currentUser);
    
    setParticipants(prev => {
      return prev.map(p => {
        if (String(p.id) === String(participantId)) {
          const merged = { ...p, ...updatedFields };
          if (updatedFields.payment_status) {
            merged.is_paid = updatedFields.payment_status === 'PAID';
            merged.is_refunded = updatedFields.payment_status === 'REFUNDED';
            merged.is_cancelled = updatedFields.payment_status === 'CANCELLED';
          }
          if (updatedFields.amount !== undefined) {
            merged.amount = Number(updatedFields.amount);
          }
          merged._hasCustomOverride = true;
          merged._overrideMeta = {
            updatedBy: currentUser?.name || 'Staff',
            updatedAt: new Date().toISOString()
          };
          return merged;
        }
        return p;
      });
    });

    setSelectedParticipant(curr => {
      if (curr && String(curr.id) === String(participantId)) {
        const merged = { ...curr, ...updatedFields };
        if (updatedFields.payment_status) {
          merged.is_paid = updatedFields.payment_status === 'PAID';
          merged.is_refunded = updatedFields.payment_status === 'REFUNDED';
          merged.is_cancelled = updatedFields.payment_status === 'CANCELLED';
        }
        if (updatedFields.amount !== undefined) {
          merged.amount = Number(updatedFields.amount);
        }
        merged._hasCustomOverride = true;
        merged._overrideMeta = {
          updatedBy: currentUser?.name || 'Staff',
          updatedAt: new Date().toISOString()
        };
        return merged;
      }
      return curr;
    });

    addAuditLog({
      actorName: currentUser?.name || 'Staff',
      actorRole: currentUser?.role || 'editor',
      actorTeam: currentUser?.teamName || 'Operations',
      action: 'PARTICIPANT_OVERRIDE',
      targetId: String(participantId),
      targetName: `Participant #${participantId}`,
      eventName: 'Operations Override',
      prevStatus: 'ORIGINAL',
      nextStatus: updatedFields.payment_status || 'MODIFIED',
      details: `Updated participant: status ${updatedFields.payment_status || 'N/A'}, amount ₹${updatedFields.amount ?? 0}`
    });

    triggerToast({
      type: 'success',
      message: 'Participant record updated successfully!'
    });
  }, [currentUser, triggerToast]);

  // Record the device session whenever the active user changes
  useEffect(() => {
    if (currentUser) {
      recordLoginSession(currentUser);
    }
  }, [currentUser]);

  // Handle Explicit Logout
  const handleLogout = useCallback(() => {
    if (currentUser) {
      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Operations',
        action: 'LOGOUT',
        targetId: currentUser.username,
        targetName: currentUser.name,
        eventName: 'Access Control',
        prevStatus: 'SIGNED_IN',
        nextStatus: 'SIGNED_OUT',
        details: `${currentUser.name} (${currentUser.username}) signed out`
      });
    }
    clearActiveUser();
    setCurrentUser(null);
    setSelectedDomainOverride('ALL');
    setSelectedEventFilter('');
    triggerToast({
      type: 'info',
      message: 'Logged out successfully.'
    });
  }, [currentUser, triggerToast]);

  // Initiate Direct Phone Call & Open Post-Call Remark Modal
  const handleTriggerCall = useCallback((participant) => {
    if (!participant) return;
    
    // 1. Direct phone connection
    if (participant.phone && participant.phone !== 'N/A') {
      window.open(`tel:${participant.phone}`, '_self');
    }

    // 2. Open pop box for remark, lead number & status
    setCallingCandidate(participant);
    setIsCallModalOpen(true);
  }, []);

  // Save Call Record & Log
  const handleSaveCall = useCallback(({ participant, callerUser, remark, leadNumber, status, cancelReason, revertOutcome }) => {
    try {
      logCallForParticipant({
        participant,
        callerUser,
        remark,
        leadNumber,
        status
      });

      // Win-back outcome for a cancelled registration is persisted as a record
      // override so the row turns green and stays that way across reloads.
      if (participant?.is_cancelled) {
        const reverted = revertOutcome === 'REVERT_WON';
        saveParticipantOverride(
          participant.id,
          {
            is_cancelled: true,
            cancel_reason: cancelReason || '',
            cancel_reverted: reverted,
            status_label: reverted ? 'Cancelled — Won Back' : 'Registration Cancelled'
          },
          currentUser
        );

        setParticipants(prev => prev.map(p => (
          String(p.id) === String(participant.id)
            ? {
                ...p,
                is_cancelled: true,
                cancel_reason: cancelReason || '',
                cancel_reverted: reverted,
                status_label: reverted ? 'Cancelled — Won Back' : 'Registration Cancelled'
              }
            : p
        )));

        setSelectedParticipant(curr => (
          curr && String(curr.id) === String(participant.id)
            ? {
                ...curr,
                is_cancelled: true,
                cancel_reason: cancelReason || '',
                cancel_reverted: reverted,
                status_label: reverted ? 'Cancelled — Won Back' : 'Registration Cancelled'
              }
            : curr
        ));

        addAuditLog({
          actorName: callerUser?.name || 'Staff',
          actorRole: callerUser?.role || 'caller',
          actorTeam: callerUser?.teamName || 'Central Desk',
          action: reverted ? 'CANCELLATION_REVERTED' : 'CANCELLATION_CONTACTED',
          targetId: String(participant.id),
          targetName: participant.name,
          eventName: participant.event_name || 'Win-back',
          prevStatus: 'CANCELLED',
          nextStatus: reverted ? 'REVERTED' : 'STILL_CANCELLED',
          details: `Reason: ${cancelReason || 'unknown'}. Outcome: ${revertOutcome || 'unknown'}`
        });
      }

      setCallDbVersion(v => v + 1);

      const statusDef = CALL_STATUSES[status];
      if (participant?.is_cancelled) {
        triggerToast({
          type: revertOutcome === 'REVERT_WON' ? 'success' : 'info',
          message: revertOutcome === 'REVERT_WON'
            ? `Win-back recorded for ${participant.name}. Marked as won back.`
            : `Win-back attempt logged for ${participant.name}.`
        });
      } else if (status === 'PAYMENT_CLAIMED') {
        triggerToast({
          type: 'success',
          message: dbConfigured
            ? `Payment claimed for ${participant.name}! Queued for reconciliation.`
            : `Payment claimed for ${participant.name}. Tracked on this device only.`
        });
      } else {
        triggerToast({
          type: 'success',
          message: `Call logged for ${participant.name} (${statusDef?.label || status})`
        });
      }
    } catch (err) {
      triggerToast({
        type: 'error',
        message: err.message || 'Failed to save call record'
      });
    }
  }, [currentUser, triggerToast, dbConfigured]);

  // Claims needing attention: disputes plus matches awaiting human confirmation.
  const verificationAlerts = useMemo(() => {
    return getVerificationAlerts(participants);
  }, [participants, callDbVersion]);

  const pendingVerificationCount = verificationAlerts.disputeCount + verificationAlerts.reviewCount;

  // techfest26.in payments indexed by email so the calling desk can read a
  // candidate's payment state without leaving the call modal.
  const techfestPaymentIndex = useMemo(
    () => buildTechfestPaymentIndex(techfestPayments),
    [techfestPayments]
  );

  // Cancellations nobody has called yet: the win-back work that is still open
  const [selectedCancelledOnly, setSelectedCancelledOnly] = useState(false);
  const cancelledAwaitingCall = useMemo(() => {
    const records = getCallRecords();
    return displayedParticipants.filter(p => {
      if (!isParticipantCancelled(p) || p.cancel_reverted) return false;
      return (records[String(p.id)]?.callCount || 0) === 0;
    }).length;
  }, [displayedParticipants]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Gate dashboard behind dedicated Login Screen on load
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] font-sans selection:bg-zinc-200 selection:text-zinc-900">
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  // While an account is still on its initial password the dashboard is withheld
  // entirely: the dashboard data never renders behind the change form, and the
  // admin tools do not exist yet.
  const accountLocked = isUserUsingDefaultPassword(currentUser?.username);

  if (accountLocked) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] font-sans">
        <ForcePasswordChangeModal
          isOpen
          currentUser={currentUser}
          // Login also schedules the self-service modal via a timeout. Clearing
          // the flag here stops that instance from surviving as a stray
          // "Change Password" dialog over the dashboard once this forced change
          // completes and unblocks the account.
          onClose={() => setIsForcePasswordModalOpen(false)}
          onTriggerToast={triggerToast}
          isForced
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] font-sans selection:bg-zinc-200 selection:text-zinc-900">
      
      {/* Header with RBAC profile, 13-domain switcher and verification badges */}
      <Header
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        onLogout={handleLogout}
        onOpenPasswordManager={() => setIsPasswordManagerOpen(true)}
        onOpenChangePassword={() => setIsForcePasswordModalOpen(true)}
        onOpenBookmarklet={() => setIsBookmarkletOpen(true)}
        onOpenTokenHealth={() => setIsTokenHealthOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onOpenVerificationQueue={() => setIsVerificationQueueOpen(true)}
        onOpenDeviceActivity={() => setIsDeviceActivityOpen(true)}
        onOpenAntiGravityReport={() => setIsAntiGravityReportOpen(true)}
        techfestPayments={techfestPayments}
        onExportCSV={handleExportCSV}
        currentUser={currentUser}
        selectedDomainOverride={selectedDomainOverride}
        onSelectDomainOverride={(d) => {
          if (currentUser) {
            addAuditLog({
              actorName: currentUser.name,
              actorRole: currentUser.role,
              actorTeam: currentUser.teamName || 'Operations',
              action: 'DOMAIN_SWITCH',
              targetId: d,
              targetName: d === 'ALL' ? 'All Domains' : (DOMAINS_DIRECTORY[d]?.name || d),
              eventName: 'Scope Change',
              prevStatus: selectedDomainOverride === 'ALL' ? 'All Domains' : (DOMAINS_DIRECTORY[selectedDomainOverride]?.name || selectedDomainOverride),
              nextStatus: d === 'ALL' ? 'All Domains' : (DOMAINS_DIRECTORY[d]?.name || d),
              details: `${currentUser.name} switched the dashboard scope`
            });
          }
          setSelectedDomainOverride(d);
          setSelectedEventFilter('');
        }}
        verificationCount={pendingVerificationCount}
        attendeeCount={scopedParticipants.length}
        disputeCount={verificationAlerts.disputeCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        summary={summary}
        neonStatus={neonStatus}
      />

      {/* Main Container */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Loading Spinner Indicator */}
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-mono text-slate-400">Loading verified techFEST '26 records...</p>
          </div>
        ) : dataError && participants.length === 0 ? (
          <div className="py-24 text-center">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Dataset unavailable</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{dataError}</p>
          </div>
        ) : (
          <>
            {dataError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800">
                Showing the last successfully loaded dataset. {dataError}
              </div>
            )}

            {/* KPI Strip: Registrations, Collected, Verification Desk, Cancellations */}
            <KPIStrip
              summary={summary}
              participants={displayedParticipants}
              techfestPayments={techfestPayments}
            />

            {activeDomainId && (
              <DomainBanner
                domainId={activeDomainId}
                currentUser={currentUser}
                participants={scopedParticipants}
                selectedEvent={selectedEventFilter}
                onSelectEventFilter={setSelectedEventFilter}
              />
            )}

            {/* Dispute alert banner: claims the API could not confirm */}
            {verificationAlerts.disputeCount > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-rose-800">
                    {verificationAlerts.disputeCount} payment claim{verificationAlerts.disputeCount === 1 ? '' : 's'} could not be confirmed on techfest26.in
                  </p>
                  <p className="text-[11px] text-rose-700/80 mt-0.5">
                    Matched by email. Review them in the Verification Desk before the next calling round.
                  </p>
                </div>
                <button
                  onClick={() => setIsVerificationQueueOpen(true)}
                  className="ml-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                >
                  Review
                </button>
              </div>
            )}

            {/* Win-back alert: cancelled registrations still awaiting a call */}
            {cancelledAwaitingCall > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <PhoneCall className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900">
                    {cancelledAwaitingCall} cancelled registration{cancelledAwaitingCall === 1 ? '' : 's'} still to contact
                  </p>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">
                    Call them to capture why they cancelled and whether they re-registered.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedEventFilter('');
                    setSelectedCancelledOnly(v => !v);
                  }}
                  className="ml-auto shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer"
                >
                  {selectedCancelledOnly ? 'Show all' : 'Show'}
                </button>
              </div>
            )}

            {/* 2. Modern 3-Column Bento Grid Dashboard directly matching ui.shadcn.com */}
            <BentoGrid
              key={`grid_${activeDomainId || 'all'}`}
              callDbVersion={callDbVersion}
              participants={displayedParticipants}
              summary={summary}
              currentUser={currentUser}
              activeDomainId={activeDomainId}
              onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
              onOpenVerificationQueue={() => setIsVerificationQueueOpen(true)}
            />

            {/* Master Operations Data Table with Direct Calling & Domain Awareness */}
            <DataTable
              key={`${activeDomainId || 'all'}_${selectedCancelledOnly}`}
              callDbVersion={callDbVersion}
              participants={scopedParticipants}
              summary={summary}
              currentUser={currentUser}
              activeDomainId={activeDomainId}
              focusCancelled={selectedCancelledOnly}
              selectedEventFilter={selectedEventFilter}
              onSelectEventFilter={setSelectedEventFilter}
              onSelectParticipant={(p) => {
          if (currentUser && p) {
            addAuditLog({
              actorName: currentUser.name,
              actorRole: currentUser.role,
              actorTeam: currentUser.teamName || 'Operations',
              action: 'PARTICIPANT_VIEW',
              targetId: String(p.id),
              targetName: p.name || 'Participant',
              eventName: p.event_name || 'Event',
              prevStatus: 'LIST',
              nextStatus: 'RECORD_OPENED',
              details: `${currentUser.name} opened the record for ${p.name} (${p.event_name || 'unknown event'})`
            });
          }
          setSelectedParticipant(p);
        }}
              onTriggerCall={handleTriggerCall}
              onTriggerToast={triggerToast}
            />
          </>
        )}

      </main>

      {/* Slide-over Candidate Inspector Drawer */}
      <CandidateDrawer
        key={`drawer_${selectedParticipant?.id}`}
        callDbVersion={callDbVersion}
        participant={selectedParticipant}
        currentUser={currentUser}
        onClose={() => setSelectedParticipant(null)}
        onTriggerCall={handleTriggerCall}
        onUpdateParticipant={handleUpdateParticipant}
      />

      {/* Force / Prompt Password Change Modal (First login or self-service) */}
      <ForcePasswordChangeModal
        isOpen={isForcePasswordModalOpen}
        currentUser={currentUser}
        onClose={() => setIsForcePasswordModalOpen(false)}
        onTriggerToast={triggerToast}
        isForced={isUserUsingDefaultPassword(currentUser?.username)}
      />

      {/* Pop-up Box for Call Remarks, Lead Number & Status (As requested by Sagar) */}
      <CallRemarkModal
        isOpen={isCallModalOpen}
        participant={callingCandidate}
        currentUser={currentUser}
        techfestPaymentIndex={techfestPaymentIndex}
        onClose={() => {
          setIsCallModalOpen(false);
          setCallingCandidate(null);
        }}
        onSubmit={handleSaveCall}
      />

      {/* Caller Activity & Access Control Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      {/* Payment Verification Desk */}
      <VerificationQueueModal
        isOpen={isVerificationQueueOpen}
        participants={participants}
        currentUser={currentUser}
        onClose={() => setIsVerificationQueueOpen(false)}
        onTriggerCall={handleTriggerCall}
        onTriggerToast={triggerToast}
      />

      {/* Autonomous Token Health Modal */}
      <TokenModal
        summary={summary}
        isOpen={isTokenHealthOpen}
        onClose={() => setIsTokenHealthOpen(false)}
      />

      {/* 1-Click Sync Tool Bookmarklet Modal */}
      <BookmarkletModal
        isOpen={isBookmarkletOpen}
        onClose={() => setIsBookmarkletOpen(false)}
      />

      {/* Super Admin Password Manager & Reset Tool */}
      <PasswordManagerModal
        isOpen={isPasswordManagerOpen}
        currentUser={currentUser}
        onClose={() => setIsPasswordManagerOpen(false)}
        onTriggerToast={triggerToast}
      />

      {/* Instagram-style 'Where You're Logged In' Device & Location Activity Modal */}
      <DeviceActivityModal
        isOpen={isDeviceActivityOpen}
        currentUser={currentUser}
        onClose={() => setIsDeviceActivityOpen(false)}
      />

      {/* Operations & Financial Intelligence Report (Sliet Hub submission) */}
      <AntiGravityReportModal
        isOpen={isAntiGravityReportOpen}
        onClose={() => setIsAntiGravityReportOpen(false)}
        participants={participants}
        summary={summary}
        techfestPayments={techfestPayments}
        currentUser={currentUser}
      />

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>
  );
}
