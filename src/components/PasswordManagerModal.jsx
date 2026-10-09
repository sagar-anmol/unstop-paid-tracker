// src/components/PasswordManagerModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  Search, 
  RotateCcw, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Lock, 
  Sparkles,
  ArrowRight,
  Copy,
  CheckCircle2,
  Share2,
  Users,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  OFFICIAL_ACCOUNTS, 
  DOMAINS_DIRECTORY, 
  setAccountPassword, 
  resetAccountPasswordToDefault, 
  hasAccountCustomPassword,
  isUserUsingDefaultPassword,
  upsertPanelUser,
  deactivatePanelUser,
  reactivatePanelUser,
  removePanelUser,
  loadDynamicUsers,
  NEW_ACCOUNT_INITIAL_PASSWORD,
  DEFAULT_INITIAL_PASSWORD
} from '../utils/auth';
import { isDatabaseConfigured } from '../utils/neonDb';
import { addAuditLog } from '../utils/callStore';

// Shared defaults an admin must not set as a real password
const WEAK_PASSWORDS = new Set([
  (DEFAULT_INITIAL_PASSWORD || '').toLowerCase(),
  (NEW_ACCOUNT_INITIAL_PASSWORD || '').toLowerCase(),
  'sliet@2026',
  'paisa@123',
  'password',
  '12345678'
]);

const TEAM_ROLES = [
  { value: 'operations_calling', label: 'Operations Calling (all 13 domains)' },
  { value: 'domain_head', label: 'Domain Head (single domain)' },
  { value: 'webdev', label: 'WebDev (edit records)' },
  { value: 'super_admin', label: 'Super Admin (full control)' }
];

export default function PasswordManagerModal({ 
  isOpen, 
  currentUser, 
  onClose, 
  onTriggerToast 
}) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('DOMAINS'); // 'ALL' | 'DOMAINS' | 'STAFF' | 'ADMINS' | 'TEAM'
  const [editingUsername, setEditingUsername] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  // Passwords are stored as salted hashes, so an admin can set or reset one but
  // never read back what a user chose.
  // Toggles the explanation of how credentials are stored.
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);

  // Runtime-managed team accounts (stored in Neon)
  const [dynamicUsers, setDynamicUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    role: 'operations_calling',
    domainId: 'ALL',
    teamName: 'Central Operations',
    email: '',
    phone: '',
    canVerifyPayments: false,
    initialPassword: NEW_ACCOUNT_INITIAL_PASSWORD,
    notes: ''
  });

  // Hooks must run before any early return, so the load effect is declared first
  // and the visibility guards follow.
  useEffect(() => {
    if (!isOpen) return;
    if (!isDatabaseConfigured()) {
      setDynamicUsers([]);
      return;
    }
    loadDynamicUsers()
      .then(users => setDynamicUsers(users))
      .catch(() => setDynamicUsers([]));
  }, [isOpen]);

  if (!isOpen) return null;

  // Guard against a non-super-admin who somehow renders this modal
  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs">
        <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl shadow-2xl p-6 text-center">
          <p className="text-sm font-semibold text-zinc-900">Super Admin access required</p>
          <p className="text-xs text-zinc-500 mt-1">Password and team account management is restricted.</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Filter accounts based on tab and search
  const filteredAccounts = OFFICIAL_ACCOUNTS.filter(acc => {
    // Tab filter
    if (activeTab === 'TEAM') return false;
    if (activeTab === 'DOMAINS' && acc.role !== 'domain_head') return false;
    if (activeTab === 'STAFF' && acc.role !== 'webdev' && acc.role !== 'operations_calling') return false;
    if (activeTab === 'ADMINS' && acc.role !== 'super_admin') return false;

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = (acc.name || '').toLowerCase().includes(q);
      const matchUser = (acc.username || '').toLowerCase().includes(q);
      const matchEmail = (acc.email || '').toLowerCase().includes(q);
      const matchDomain = (acc.domainName || '').toLowerCase().includes(q);
      const matchBay = (acc.bay || '').toLowerCase().includes(q);
      const matchAlias = (acc.aliasUsername || '').toLowerCase().includes(q);
      return matchName || matchUser || matchEmail || matchDomain || matchBay || matchAlias;
    }

    return true;
  });

  const domainCount = OFFICIAL_ACCOUNTS.filter(a => a.role === 'domain_head').length;
  const staffCount = OFFICIAL_ACCOUNTS.filter(a => a.role === 'webdev' || a.role === 'operations_calling').length;
  const dbConfigured = isDatabaseConfigured();
  const adminCount = OFFICIAL_ACCOUNTS.filter(a => a.role === 'super_admin').length;
  const activeTeamCount = dynamicUsers.filter(u => u.isActive !== false).length;
  const customCount = OFFICIAL_ACCOUNTS.filter(a => hasAccountCustomPassword(a.username)).length;
  const defaultCount = OFFICIAL_ACCOUNTS.length - customCount;

  const filteredTeamUsers = dynamicUsers.filter(u => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.teamName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const togglePasswordVisibility = (username) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  /**
   * Reveals a password only when it is still the shared default. Once a user
   * sets their own password it is stored as a hash and cannot be displayed, so
   * the control switches to a reset hint instead of pretending to show it.
   */
  const getDisplayPassword = (acc) => {
    if (!hasAccountCustomPassword(acc.username)) {
      return { value: acc.defaultPassword || '', revealable: true };
    }
    return { value: '', revealable: false };
  };

  const reloadDynamicUsers = async () => {
    if (!isDatabaseConfigured()) {
      setDynamicUsers([]);
      return;
    }
    const users = await loadDynamicUsers();
    setDynamicUsers(users);
  };

  const handleStartEdit = (acc) => {
    setEditingUsername(acc.username);
    // Start blank: the current value is a hash and cannot be read back.
    setNewPassword('');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!isDatabaseConfigured()) {
      setFormError('Team accounts need a configured database. Set VITE_NEON_DATABASE_URL and rebuild.');
      return;
    }

    try {
      await upsertPanelUser(currentUser, form);
      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Central Desk',
        action: 'USER_CREATED',
        targetId: form.username.toLowerCase().trim(),
        targetName: form.displayName,
        eventName: 'Access Control',
        prevStatus: 'NONE',
        nextStatus: form.role,
        details: `${currentUser.name} added ${form.displayName} (${form.username}) as ${form.role}${form.canVerifyPayments ? ' with payment verification rights' : ''}. The account must replace its initial password at first sign-in.`
      });
      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: `${form.displayName} added. Initial password must be changed at first sign-in.`
        });
      }
      setShowAddForm(false);
      setForm({
        username: '',
        displayName: '',
        role: 'operations_calling',
        domainId: 'ALL',
        teamName: 'Central Operations',
        email: '',
        phone: '',
        canVerifyPayments: false,
        initialPassword: NEW_ACCOUNT_INITIAL_PASSWORD,
        notes: ''
      });
      await reloadDynamicUsers();
    } catch (err) {
      setFormError(err.message || 'Could not add user.');
    }
  };

  const handleToggleUser = async (username, isActive) => {
    setFormError('');

    if (!isDatabaseConfigured()) {
      setFormError('Team accounts need a configured database.');
      return;
    }

    try {
      if (isActive) {
        await reactivatePanelUser(currentUser, username);
      } else {
        await deactivatePanelUser(currentUser, username);
      }
      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Central Desk',
        action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
        targetId: username,
        targetName: username,
        eventName: 'Access Control',
        prevStatus: isActive ? 'INACTIVE' : 'ACTIVE',
        nextStatus: isActive ? 'ACTIVE' : 'INACTIVE',
        details: `${currentUser.name} ${isActive ? 'reactivated' : 'deactivated'} the account ${username}`
      });
      await reloadDynamicUsers();
      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: `${username} ${isActive ? 'reactivated' : 'deactivated'}`
        });
      }
    } catch (err) {
      setFormError(err.message || 'Could not update user.');
    }
  };

  const handleDeleteUser = async (username) => {
    setFormError('');

    if (!isDatabaseConfigured()) {
      setFormError('Team accounts need a configured database.');
      return;
    }

    try {
      await removePanelUser(currentUser, username);
      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Central Desk',
        action: 'USER_REMOVED',
        targetId: username,
        targetName: username,
        eventName: 'Access Control',
        prevStatus: 'ACTIVE',
        nextStatus: 'REMOVED',
        details: `${currentUser.name} removed the account ${username}`
      });
      await reloadDynamicUsers();
      if (onTriggerToast) {
        onTriggerToast({ type: 'success', message: `${username} removed` });
      }
    } catch (err) {
      setFormError(err.message || 'Could not remove user.');
    }
  };

  const handleCancelEdit = () => {
    setEditingUsername(null);
    setNewPassword('');
  };

  const handleSavePassword = async (e, acc) => {
    e.preventDefault();
    if (!acc || !newPassword.trim()) return;

    if (newPassword.trim().length < 6) {
      if (onTriggerToast) {
        onTriggerToast({
          type: 'error',
          message: 'Password must be at least 6 characters long.'
        });
      }
      return;
    }

    if (WEAK_PASSWORDS.has(newPassword.trim().toLowerCase())) {
      if (onTriggerToast) {
        onTriggerToast({
          type: 'error',
          message: 'That password is a shared default. Choose something unique.'
        });
      }
      return;
    }

    if (acc.username.toLowerCase() === currentUser.username.toLowerCase()) {
      if (onTriggerToast) {
        onTriggerToast({
          type: 'error',
          message: 'Use "Change My Password" from the profile menu for your own account.'
        });
      }
      return;
    }

    try {
      // mustChange=true forces the account holder to pick their own password
      // at next sign-in, so an admin-set value never becomes permanent.
      await setAccountPassword(currentUser, acc.username, newPassword.trim(), true);

      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Central Desk',
        action: 'PASSWORD_CHANGE',
        targetId: acc.username,
        targetName: acc.name,
        eventName: 'Central Access Control',
        prevStatus: hasAccountCustomPassword(acc.username) ? 'CUSTOM' : 'DEFAULT',
        nextStatus: 'UPDATED',
        details: `Super Admin ${currentUser.name} updated password for ${acc.name} (${acc.username})`
      });

      setEditingUsername(null);
      setNewPassword('');

      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: `Password updated successfully for ${acc.name}`
        });
      }
    } catch (err) {
      if (onTriggerToast) {
        onTriggerToast({
          type: 'error',
          message: err.message || 'Failed to update password'
        });
      }
    }
  };

  const handleResetToDefault = (acc) => {
    try {
      resetAccountPasswordToDefault(currentUser, acc.username);

      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Central Desk',
        action: 'PASSWORD_RESET',
        targetId: acc.username,
        targetName: acc.name,
        eventName: 'Central Access Control',
        prevStatus: 'CUSTOM',
        nextStatus: 'DEFAULT_INITIAL',
        details: `Super Admin ${currentUser.name} reset ${acc.name} to the default initial password. The value is not recorded in the audit log.`
      });

      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: `Password reset to the default initial value for ${acc.name}`
        });
      }
    } catch (err) {
      if (onTriggerToast) {
        onTriggerToast({
          type: 'error',
          message: err.message || 'Failed to reset password'
        });
      }
    }
  };

  const copyToClipboard = (text, key) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: 'Copied to clipboard!'
        });
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const copyWhatsAppCredentials = (acc) => {
    const display = getDisplayPassword(acc);
    const domainText = acc.domainName ? `Domain: ${acc.domainName} (${acc.bay || ''})\n` : '';
    const passLine = display.revealable
      ? `Temporary Password: ${display.value}`
      : 'Password: (already changed by the user — reset it here to send a new one)';
    const msg = `techFEST '26 Operations Portal Login\n${domainText}Coordinator: ${acc.name}\nOfficial Email: ${acc.username}\n${passLine}\n\n⚠️ Must be changed at first sign-in.`;
    copyToClipboard(msg, `full_${acc.username}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-4xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900">
                  Central Desk Password & Credentials Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 text-white font-semibold">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Full authority to change or reset passwords for any of the 13 Domain Leads and Staff
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats Strip */}
        <div className="px-4 py-2.5 bg-zinc-100/70 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-zinc-600">
            <span>
              Total Accounts: <strong className="text-zinc-900 font-mono">{OFFICIAL_ACCOUNTS.length}</strong>
            </span>
            <span className="text-zinc-300">•</span>
            <span>
              13 Domain Heads: <strong className="text-zinc-900 font-mono">{domainCount}</strong>
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Custom Active: <strong className="text-emerald-700 font-mono">{customCount}</strong></span>
            </span>
            <span className="text-zinc-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Default Initial: <strong className="text-amber-800 font-mono">{defaultCount}</strong></span>
            </span>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono">
            Team Accounts: <span className="font-semibold text-zinc-700">{activeTeamCount}</span>
          </div>
        </div>

        {/* Controls: Search & Tabs */}
        <div className="p-3 sm:p-4 bg-white border-b border-zinc-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('DOMAINS')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'DOMAINS' 
                    ? 'bg-white text-zinc-900 shadow-xs' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                13 Domain Heads ({domainCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('STAFF')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'STAFF' 
                    ? 'bg-white text-zinc-900 shadow-xs' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Staff & Ops ({staffCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ADMINS')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'ADMINS' 
                    ? 'bg-white text-zinc-900 shadow-xs' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Central Admins ({adminCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'ALL' 
                    ? 'bg-white text-zinc-900 shadow-xs' 
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All ({OFFICIAL_ACCOUNTS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('TEAM')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'TEAM'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Team ({activeTeamCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search domain, lead name, email..."
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-zinc-900 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none shadow-xs"
              />
            </div>
          </div>
        </div>

        {activeTab === 'TEAM' && !dbConfigured && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            No database URL is configured, so team accounts cannot be stored. Set
            VITE_NEON_DATABASE_URL at build time, then run the migration.
          </div>
        )}

        {activeTab === 'TEAM' && dbConfigured && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={async () => { await reloadDynamicUsers(); if (onTriggerToast) onTriggerToast({ type: 'success', message: 'Team list refreshed' }); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
            >
              Refresh from Neon
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(s => !s); setFormError(''); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
            >
              {showAddForm ? 'Close Form' : '+ Add Team Member'}
            </button>
          </div>
        )}

        {activeTab === 'TEAM' && dbConfigured && showAddForm && (
          <form onSubmit={handleCreateUser} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
            {formError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Full name</span>
                <input
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Neha Rani"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Username</span>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="email or handle"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900 font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Role</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                >
                  {TEAM_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              {form.role === 'domain_head' && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Domain</span>
                  <select
                    value={form.domainId}
                    onChange={(e) => setForm({ ...form, domainId: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-zinc-900"
                  >
                    {Object.keys(DOMAINS_DIRECTORY).map(d => (
                      <option key={d} value={d}>{DOMAINS_DIRECTORY[d].name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Team label</span>
                <input
                  type="text"
                  value={form.teamName}
                  onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-600 block mb-1">Initial password</span>
                <input
                  type="text"
                  value={form.initialPassword}
                  onChange={(e) => setForm({ ...form, initialPassword: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-zinc-900 font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-0.5 block">User must change this at first sign-in.</span>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={form.canVerifyPayments}
                onChange={(e) => setForm({ ...form, canVerifyPayments: e.target.checked })}
                className="accent-zinc-900"
              />
              Allow approving/rejecting payment verifications
            </label>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
            >
              Create account
            </button>
          </form>
        )}

        {/* Accounts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-zinc-50/50">
          {activeTab === 'TEAM' ? (
            !dbConfigured ? (
              <div className="py-12 text-center text-zinc-400 text-xs font-mono">
                Team management needs a configured database.
              </div>
            ) : filteredTeamUsers.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs font-mono">
                No team accounts yet. Use &quot;+ Add Team Member&quot; to create one.
              </div>
            ) : (
              filteredTeamUsers.map((u) => {
                const domainMeta = u.domainId && DOMAINS_DIRECTORY[u.domainId];
                const isActive = u.isActive !== false;
                return (
                  <div
                    key={u.username}
                    className={`p-3.5 rounded-xl border shadow-2xs ${
                      isActive ? 'bg-white border-zinc-200' : 'bg-zinc-100/70 border-zinc-200 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                          style={{
                            backgroundColor: domainMeta?.accentColor ? `${domainMeta.accentColor}15` : '#F4F4F5',
                            borderColor: domainMeta?.accentColor ? `${domainMeta.accentColor}40` : '#E4E4E7',
                            color: domainMeta?.accentColor || '#18181B'
                          }}
                        >
                          {(u.displayName || 'TF').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-xs sm:text-sm text-zinc-900">{u.displayName}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-zinc-200 bg-zinc-100 text-zinc-600">
                              {TEAM_ROLES.find(r => r.value === u.role)?.label || u.role}
                            </span>
                            {u.canVerifyPayments && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">
                                can verify
                              </span>
                            )}
                            {!isActive && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                                deactivated
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            {u.username} • {u.teamName}
                            {domainMeta ? ` • ${domainMeta.name}` : ' • All 13 domains'}
                          </p>
                          {u.notes && <p className="text-[11px] text-zinc-500 mt-0.5">{u.notes}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleUser(u.username, !isActive)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                        >
                          {isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.username)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : filteredAccounts.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs font-mono">
              No matching accounts found for "{search}".
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const display = getDisplayPassword(acc);
              const isRevealed = visiblePasswords[acc.username];
              const isEditing = editingUsername === acc.username;
              const hasCustom = hasAccountCustomPassword(acc.username);
              const mustChange = isUserUsingDefaultPassword(acc.username);
              const domainMeta = acc.domainId ? DOMAINS_DIRECTORY[acc.domainId] : null;

              return (
                <div
                  key={acc.username}
                  className="p-3.5 sm:p-4 rounded-xl bg-white border border-zinc-200/90 shadow-2xs hover:border-zinc-300 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    
                    {/* Left: Account Identity & Domain */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <span 
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
                        style={{
                          backgroundColor: domainMeta?.accentColor ? `${domainMeta.accentColor}15` : '#F4F4F5',
                          borderColor: domainMeta?.accentColor ? `${domainMeta.accentColor}40` : '#E4E4E7',
                          color: domainMeta?.accentColor || '#18181B'
                        }}
                      >
                        {acc.avatar || 'TF'}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-zinc-900 truncate">
                            {acc.name}
                          </span>
                          
                          {acc.domainName && (
                            <span 
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: `${domainMeta?.accentColor || '#38BDF8'}15`,
                                borderColor: `${domainMeta?.accentColor || '#38BDF8'}30`,
                                color: domainMeta?.accentColor || '#0284C7'
                              }}
                            >
                              {acc.domainName}
                            </span>
                          )}

                          {acc.bay && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                              {acc.bay}
                            </span>
                          )}

                          {/* Credential state */}
                          {mustChange ? (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                              title="This account is still on its initial password and will be forced to change it at next sign-in"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>Initial Default</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="The user has set their own password (stored as a salted hash)"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Password Set</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>Login Email: <strong className="text-zinc-800 font-semibold">{acc.username}</strong></span>
                          {acc.aliasUsername && (
                            <span className="text-zinc-400">
                              (Alias: <code className="text-zinc-600">{acc.aliasUsername}</code>)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Password Box & Actions */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                      
                      {/* Password Box: the value is only readable while it is still the shared
                          default. Once set, the hash cannot be reversed, so the
                          box explains that instead of showing dots forever. */}
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono shadow-2xs">
                        <Lock className="w-3.5 h-3.5 text-zinc-400" />
                        {display.revealable ? (
                          <>
                            <span className="text-zinc-800 font-medium select-all">
                              {isRevealed ? display.value : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(acc.username)}
                              className="text-zinc-400 hover:text-zinc-800 ml-1 cursor-pointer transition-colors"
                              title={isRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(display.value, `pass_${acc.username}`)}
                              className="text-zinc-400 hover:text-zinc-800 ml-0.5 cursor-pointer transition-colors"
                              title="Copy Password"
                            >
                              {copiedKey === `pass_${acc.username}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-500 font-sans">
                            Set by the user — stored as a hash, not readable
                          </span>
                        )}
                      </div>

                      {/* WhatsApp Share / Copy Full Creds */}
                      <button
                        type="button"
                        onClick={() => copyWhatsAppCredentials(acc)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Copy complete formatted credentials for WhatsApp"
                      >
                        {copiedKey === `full_${acc.username}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="hidden sm:inline">Copy Card</span>
                          </>
                        )}
                      </button>

                      {/* Change Password Button */}
                      <button
                        type="button"
                        onClick={() => isEditing ? handleCancelEdit() : handleStartEdit(acc)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                          isEditing
                            ? 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                        }`}
                      >
                        {isEditing ? 'Cancel' : 'Change'}
                      </button>

                      {/* Reset to Default Button */}
                      <button
                        type="button"
                        onClick={() => handleResetToDefault(acc)}
                        disabled={!hasCustom}
                        title={hasCustom ? 'Reset password to the default initial value' : 'Already on the default initial password'}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          hasCustom
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-2xs'
                            : 'bg-zinc-50 text-zinc-300 border-zinc-200 cursor-not-allowed'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* A reset forces the user to choose a new password next sign-in */}
                      {hasCustom && (
                        <span className="text-[10px] font-mono text-zinc-500 self-center">
                          resets &amp; forces a change
                        </span>
                      )}

                    </div>

                  </div>

                  {/* Inline Edit Form */}
                  {isEditing && (
                    <form 
                      onSubmit={(e) => handleSavePassword(e, acc)} 
                      className="mt-3 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in duration-100"
                    >
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          required
                          autoFocus
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter the new password (min 4 chars)"
                          className="w-full bg-white border border-zinc-300 focus:border-zinc-900 rounded-xl px-3 py-2 text-xs text-zinc-900 outline-none font-mono shadow-xs"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Set Password</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Passwords are stored as salted SHA-256 hashes, so they cannot be read back — set or reset, never viewed. Changes sync with Neon PostgreSQL and land in the audit trail.
            </span>
            <button
              type="button"
              onClick={() => setShowPasswordHelp(s => !s)}
              className="ml-2 text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900 cursor-pointer shrink-0"
            >
              {showPasswordHelp ? 'Hide' : 'Details'}
            </button>
          </div>

          {showPasswordHelp && (
            <div className="px-3.5 py-2.5 bg-amber-50 border-t border-amber-200 text-[11px] text-amber-900 space-y-1">
              <p>
                Every credential is stored as <code className="font-mono">SHA-256(salt + password)</code>
                {' '}with a per-user random salt. The plaintext is discarded immediately, so nobody —
                including a Super Admin — can recover a password a user has already set.
              </p>
              <p>
                Setting or resetting a password flags the account as needing a change, so the user
                picks their own at next sign-in. Accounts left on the shared initial value are
                prompted automatically on every login.
              </p>
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-zinc-700 bg-white hover:bg-zinc-100 border-zinc-200 shadow-xs self-end sm:self-auto cursor-pointer"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
