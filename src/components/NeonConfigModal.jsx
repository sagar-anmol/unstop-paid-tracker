// src/components/NeonConfigModal.jsx
// Secure Neon PostgreSQL Database Configuration & Password Rotation Manager
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  ExternalLink, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  getActiveDatabaseUrl, 
  setActiveDatabaseUrl, 
  testNeonConnection
} from '../utils/neonDb';

export default function NeonConfigModal({ isOpen, onClose, onTriggerToast }) {
  const [dbUrl, setDbUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDbUrl(getActiveDatabaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!dbUrl || !dbUrl.trim()) {
      setTestResult({ success: false, error: 'Please enter a valid PostgreSQL connection string.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const res = await testNeonConnection(dbUrl.trim());
    setIsTesting(false);
    setTestResult(res);
  };

  const handleSave = () => {
    setActiveDatabaseUrl(dbUrl.trim());
    if (onTriggerToast) {
      onTriggerToast({
        title: 'Database Configuration Saved',
        description: dbUrl.trim() ? 'Neon PostgreSQL connection updated in local storage.' : 'Reset to local storage mode.',
        type: 'success'
      });
    }
    onClose();
  };

  const handleClear = () => {
    setActiveDatabaseUrl('');
    setDbUrl('');
    setTestResult(null);
    if (onTriggerToast) {
      onTriggerToast({
        title: 'Connection Cleared',
        description: 'App will operate in offline / local storage mode.',
        type: 'info'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Neon Cloud Database Configuration
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Secure credentials management & password rotation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          
          {/* Security Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Zero-Leak Security Architecture</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              Your database password is stored securely in your browser's local storage and is <strong>never committed to public GitHub repositories</strong>.
            </p>
          </div>

          {/* Connection String Input */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
              PostgreSQL Connection String
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={dbUrl}
                onChange={(e) => {
                  setDbUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="postgresql://neondb_owner:password@ep-...pooler...neon.tech/neondb?sslmode=require"
                className="w-full bg-white border border-zinc-300 focus:border-zinc-900 rounded-xl pl-3.5 pr-10 py-2 text-xs text-zinc-900 font-mono outline-none shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Connection successful! Neon PostgreSQL is live and responsive.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">Failed: {testResult.error}</span>
                </>
              )}
            </div>
          )}

          {/* Password Rotation Instructions */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 space-y-2">
            <div className="font-semibold text-zinc-800 flex items-center justify-between">
              <span>How to rotate password in Neon Console:</span>
              <a 
                href="https://console.neon.tech" 
                target="_blank" 
                rel="noreferrer"
                className="text-[11px] text-zinc-900 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Neon Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside text-[11px] text-zinc-500 space-y-1">
              <li>Open your project (<strong>damp-recipe-51922375</strong>).</li>
              <li>Go to <strong>Roles</strong> or <strong>Connection Details</strong>.</li>
              <li>Click <strong>Reset Password</strong> to invalidate the old key.</li>
              <li>Copy the new connection string and paste it above!</li>
            </ol>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-rose-600 hover:bg-rose-50 text-xs flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear / Offline</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || !dbUrl}
              className="text-xs border-zinc-200 text-zinc-700 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isTesting ? 'animate-spin' : ''}`} />
              <span>Test Connection</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs shadow-xs"
            >
              Save & Apply
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
