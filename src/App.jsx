// src/App.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BentoGrid from './components/BentoGrid';
import KPIStrip from './components/KPIStrip';
import AnalyticsChart from './components/AnalyticsChart';
import DataTable from './components/DataTable';
import CandidateDrawer from './components/CandidateDrawer';
import TokenModal from './components/TokenModal';
import BookmarkletModal from './components/BookmarkletModal';
import CallRemarkModal from './components/CallRemarkModal';
import AuthModal from './components/AuthModal';
import AuditLogsModal from './components/AuditLogsModal';
import VerificationQueueModal from './components/VerificationQueueModal';
import DomainBanner from './components/DomainBanner';
import LoginScreen from './components/LoginScreen';
import PasswordManagerModal from './components/PasswordManagerModal';
import DeviceActivityModal from './components/DeviceActivityModal';
import NeonConfigModal from './components/NeonConfigModal';
import AntiGravityReportModal from './components/AntiGravityReportModal';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';
import Toast from './components/Toast';

import { exportParticipantsToCSV } from './utils/csv';
import { 
  getActiveUser, 
  setActiveUser, 
  clearActiveUser,
  getParticipantsForUser, 
  syncPasswordsWithNeon,
  isUserUsingDefaultPassword,
  DOMAINS_DIRECTORY 
} from './utils/auth';
import { 
  applyParticipantOverrides, 
  saveParticipantOverride 
} from './utils/participantOverrides';
import { 
  logCallForParticipant, 
  getPaymentVerificationQueue, 
  syncWithNeonDatabase,
  addAuditLog,
  CALL_STATUSES 
} from './utils/callStore';
import { subscribeDbStatus } from './utils/neonDb';
import { recordLoginSession } from './utils/device';

import initialData from '../data.json';

export default function App() {
  const [participants, setParticipants] = useState(() => {
    if (initialData && Array.isArray(initialData.participants)) {
      return applyParticipantOverrides(initialData.participants);
    }
    return [];
  });

  const [summary, setSummary] = useState(() => {
    if (initialData && initialData.summary) {
      return initialData.summary;
    }
    return {};
  });

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isVerificationQueueOpen, setIsVerificationQueueOpen] = useState(false);
  const [isPasswordManagerOpen, setIsPasswordManagerOpen] = useState(false);
  const [isDeviceActivityOpen, setIsDeviceActivityOpen] = useState(false);
  const [isNeonConfigOpen, setIsNeonConfigOpen] = useState(false);
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

  // Trigger toast with auto-hide
  const triggerToast = useCallback((toastData) => {
    setToast(toastData);
    setTimeout(() => {
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
    else if (participants.length === 0) setIsLoading(true);

    try {
      const timestamp = Date.now();
      const urls = [
        `./data.json?t=${timestamp}`,
        `data.json?t=${timestamp}`,
        './data/summary.json',
        'https://raw.githubusercontent.com/sagar-anmol/unstop-paid-tracker/main/data.json'
      ];

      let loaded = false;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.participants && Array.isArray(data.participants)) {
              setParticipants(applyParticipantOverrides(data.participants));
              if (data.summary) setSummary(data.summary);
              loaded = true;
              break;
            } else if (Array.isArray(data)) {
              setParticipants(applyParticipantOverrides(data));
              loaded = true;
              break;
            }
          }
        } catch (e) {
          // try next URL
        }
      }

      if (isManual) {
        syncWithNeonDatabase();
        syncPasswordsWithNeon();
        triggerToast({ type: 'success', message: 'Dashboard & Neon Database synced!' });
      }
    } catch (err) {
      if (isManual) {
        triggerToast({ type: 'error', message: 'Failed to refresh data' });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [participants.length, triggerToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to Neon DB connection status
  useEffect(() => {
    const unsubscribe = subscribeDbStatus(setNeonStatus);
    return () => unsubscribe();
  }, []);

  // Initial cloud sync & periodic polling every 12 seconds
  useEffect(() => {
    const doSync = () => {
      syncWithNeonDatabase();
      syncPasswordsWithNeon();
    };

    doSync();
    const interval = setInterval(doSync, 12000);

    const handleVisibilityChange = () => {
      if (!document.hidden) doSync();
    };
    window.addEventListener('focus', doSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleNeonSynced = () => {
      setCallDbVersion(v => v + 1);
    };
    window.addEventListener('tf_neon_synced', handleNeonSynced);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', doSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('tf_neon_synced', handleNeonSynced);
    };
  }, []);

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
    triggerToast({
      type: 'success',
      message: `Welcome, ${user.name}! Operations dashboard unlocked.`
    });

    // Check if user is on default password, prompt to change
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

  // Sync active user session on load
  useEffect(() => {
    if (currentUser) {
      recordLoginSession(currentUser);
    }
  }, []);

  // Handle Explicit Logout
  const handleLogout = useCallback(() => {
    clearActiveUser();
    setCurrentUser(null);
    setSelectedDomainOverride('ALL');
    setSelectedEventFilter('');
    triggerToast({
      type: 'info',
      message: 'Logged out successfully.'
    });
  }, [triggerToast]);

  // Switch Active User / RBAC Persona
  const handleSelectUser = (user) => {
    handleLoginSuccess(user);
  };

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
  const handleSaveCall = useCallback(({ participant, callerUser, remark, leadNumber, status }) => {
    try {
      logCallForParticipant({
        participant,
        callerUser,
        remark,
        leadNumber,
        status
      });

      setCallDbVersion(v => v + 1);

      const statusDef = CALL_STATUSES[status];
      if (status === 'PAYMENT_CLAIMED') {
        triggerToast({
          type: 'success',
          message: `Payment claimed for ${participant.name}! Queued to Verification Desk.`
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
  }, [triggerToast]);

  // Compute pending verifications count for header badge
  const pendingVerificationCount = useMemo(() => {
    const queue = getPaymentVerificationQueue(participants);
    return queue.filter(q => q.verificationState === 'PENDING_SYNC' || q.verificationState === 'DEFAULTER').length;
  }, [participants, callDbVersion]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
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

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-[#18181B] font-sans selection:bg-zinc-200 selection:text-zinc-900">
      
      {/* 1. Header with RBAC Profile, 13 Domain Switcher & Verification Badges */}
      <Header
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        onLogout={handleLogout}
        onOpenPasswordManager={() => setIsPasswordManagerOpen(true)}
        onOpenChangePassword={() => setIsForcePasswordModalOpen(true)}
        onOpenBookmarklet={() => setIsBookmarkletOpen(true)}
        onOpenTokenHealth={() => setIsTokenHealthOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onOpenVerificationQueue={() => setIsVerificationQueueOpen(true)}
        onOpenDeviceActivity={() => setIsDeviceActivityOpen(true)}
        onOpenNeonConfig={() => setIsNeonConfigOpen(true)}
        onOpenAntiGravityReport={() => setIsAntiGravityReportOpen(true)}
        onExportCSV={handleExportCSV}
        currentUser={currentUser}
        selectedDomainOverride={selectedDomainOverride}
        onSelectDomainOverride={(d) => {
          setSelectedDomainOverride(d);
          setSelectedEventFilter('');
        }}
        verificationCount={pendingVerificationCount}
        attendeeCount={scopedParticipants.length}
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
        ) : (
          <>
            {/* DOMAIN HERO BANNER: Shown when logged in as Domain Head or when Super Admin filters to a domain */}
            {activeDomainId && (
              <DomainBanner
                domainId={activeDomainId}
                currentUser={currentUser}
                participants={scopedParticipants}
                selectedEvent={selectedEventFilter}
                onSelectEventFilter={setSelectedEventFilter}
              />
            )}

            {/* 2. Modern 3-Column Bento Grid Dashboard directly matching ui.shadcn.com */}
            <BentoGrid
              participants={displayedParticipants}
              summary={summary}
              currentUser={currentUser}
              activeDomainId={activeDomainId}
              onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
              onOpenVerificationQueue={() => setIsVerificationQueueOpen(true)}
            />

            {/* 4. Master Operations Data Table with Direct Calling & Domain Awareness */}
            <DataTable
              key={activeDomainId || 'all'}
              callDbVersion={callDbVersion}
              participants={scopedParticipants}
              summary={summary}
              currentUser={currentUser}
              activeDomainId={activeDomainId}
              selectedEventFilter={selectedEventFilter}
              onSelectEventFilter={setSelectedEventFilter}
              onSelectParticipant={setSelectedParticipant}
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
        onClose={() => {
          setIsCallModalOpen(false);
          setCallingCandidate(null);
        }}
        onSubmit={handleSaveCall}
      />

      {/* Operations 17 Logins & Credentials Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        currentUser={currentUser}
        onClose={() => setIsAuthModalOpen(false)}
        onSelectUser={handleSelectUser}
      />

      {/* Caller Activity & Access Control Audit Logs Modal */}
      <AuditLogsModal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      {/* Payment Verification & Defaulter Desk Modal */}
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

      {/* Zero-Leak Neon Cloud Database Configuration & Password Rotation Modal */}
      <NeonConfigModal
        isOpen={isNeonConfigOpen}
        onClose={() => setIsNeonConfigOpen(false)}
        onTriggerToast={triggerToast}
      />

      {/* Anti-Gravity Operations & Financial Intelligence Report (Sliet Hub Meeting) */}
      <AntiGravityReportModal
        isOpen={isAntiGravityReportOpen}
        onClose={() => setIsAntiGravityReportOpen(false)}
        participants={participants}
        summary={summary}
        currentUser={currentUser}
      />

      {/* Floating Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>
  );
}
