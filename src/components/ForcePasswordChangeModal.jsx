// src/components/ForcePasswordChangeModal.jsx
import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Lock,
  ArrowRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateUserOwnPassword,
  isUserUsingDefaultPassword,
  DEFAULT_INITIAL_PASSWORD,
  NEW_ACCOUNT_INITIAL_PASSWORD
} from '../utils/auth';
import { addAuditLog } from '../utils/callStore';

// Passwords nobody should keep: the shared initial values and legacy defaults
const WEAK_PASSWORDS = new Set([
  (DEFAULT_INITIAL_PASSWORD || '').toLowerCase(),
  (NEW_ACCOUNT_INITIAL_PASSWORD || '').toLowerCase(),
  'techfest@2026',
  'sliet@2026',
  'paisa@123',
  'password',
  '12345678'
]);

export default function ForcePasswordChangeModal({
  isOpen,
  currentUser,
  onClose,
  onTriggerToast,
  isForced = false
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !currentUser) return null;

  const isBlocking = isForced && isUserUsingDefaultPassword(currentUser.username);

  // Self-service change from the header is always allowed; the forced flow on
  // first sign-in only applies while the account is still on its default.
  if (isForced && !isUserUsingDefaultPassword(currentUser.username)) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.trim().length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('Passwords do not match. Please verify and retry.');
      return;
    }

    if (WEAK_PASSWORDS.has(newPassword.trim().toLowerCase())) {
      setError('Please choose a new, unique password instead of a default one.');
      return;
    }

// Guard against a double submit while the hash is being written
    if (isSaving) return;
    setIsSaving(true);

    try {
      await updateUserOwnPassword(currentUser.username, newPassword.trim());

      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorTeam: currentUser.teamName || 'Domain Team',
        action: 'PASSWORD_UPDATE',
        targetId: currentUser.username,
        targetName: currentUser.name,
        eventName: 'Security Setup',
        prevStatus: 'DEFAULT',
        nextStatus: 'CUSTOM',
        details: `${currentUser.name} (${currentUser.username}) set their personal password`
      });

      if (onTriggerToast) {
        onTriggerToast({
          type: 'success',
          message: 'Password updated successfully! Please save your new password.'
        });
      }

      setIsSaving(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update password');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-100 bg-zinc-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {isForced ? 'Set Your Custom Password' : 'Change Password'}
                </h3>
                <Badge variant={isForced ? 'amber' : 'outline'} className="text-[10px] font-mono">
                  {isForced ? 'First-Time Setup' : 'Security'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {currentUser.name} ({currentUser.email || currentUser.username})
              </p>
            </div>
          </div>

          {!isBlocking && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isForced && (
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                You are currently using the default fest password (<b>Techfest@2026</b>). Please set your own confidential password now.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter at least 6 characters"
                className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl text-zinc-900 placeholder:text-zinc-400 outline-none shadow-xs h-10 font-mono"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Re-type new password"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl text-zinc-900 placeholder:text-zinc-400 outline-none shadow-xs h-10 font-mono"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {isBlocking ? (
              <p className="text-[11px] text-zinc-500 max-w-[15rem] leading-relaxed">
                Set your own password to continue. This account cannot reach the
                dashboard until you do.
              </p>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer font-medium"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{isSaving ? "Saving..." : "Save Password"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
