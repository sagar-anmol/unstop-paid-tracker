import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  RefreshCw, 
  Moon, 
  Sun, 
  ShieldCheck, 
  FileText, 
  KeyRound, 
  Zap, 
  LogOut, 
  Layers, 
  ChevronDown, 
  User, 
  Crown,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  ExternalLink,
  Smartphone,
  Laptop,
  Tablet,
  MapPin,
  Database
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOMAINS_DIRECTORY } from '../utils/auth';
import { getDeviceInfo } from '../utils/device';

export default function Header({ 
  currentUser,
  onRefresh, 
  isRefreshing, 
  onLogout,
  onOpenPasswordManager,
  onOpenChangePassword,
  onOpenAuditLogs,
  onOpenVerificationQueue,
  onOpenBookmarklet,
  onOpenTokenHealth,
  onOpenDeviceActivity,
  onOpenNeonConfig,
  onOpenAntiGravityReport,
  onExportCSV,
  selectedDomainOverride,
  onSelectDomainOverride,
  verificationCount = 0,
  theme,
  onToggleTheme,
  summary,
  neonStatus
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentDev = getDeviceInfo();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isDomainHead = currentUser?.role === 'domain_head';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/80 transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        
        {/* Left: Brand + Navigation Links */}
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 tracking-tight">
                techFEST '26
              </span>
              <span className="text-[11px] font-medium text-zinc-400">/</span>
              <span className="text-xs text-zinc-600 font-medium hidden sm:inline">
                Operations
              </span>
            </div>
          </div>

          {/* Clean Horizontal Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-zinc-600">
            <span className="px-2.5 py-1 rounded-md text-zinc-900 font-semibold bg-zinc-100/80">
              Overview
            </span>
            <a 
              href="#candidates-table" 
              className="px-2.5 py-1 rounded-md hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
            >
              Attendees ({Number(summary?.total_unstop_registrations || summary?.totalCount || 3860).toLocaleString('en-IN')})
            </a>
            <button
              onClick={onOpenVerificationQueue}
              className="px-2.5 py-1 rounded-md hover:text-zinc-900 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Verification</span>
              {verificationCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-900 text-white font-semibold">
                  {verificationCount}
                </span>
              )}
            </button>
            {isSuperAdmin && (
              <>
                <button
                  onClick={onOpenPasswordManager}
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer text-xs font-medium text-zinc-600"
                  title="Super Admin: Manage and reset domain coordinator passwords"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Passwords</span>
                </button>
                <button
                  onClick={onOpenAuditLogs}
                  className="hidden xl:inline-flex px-2.5 py-1 rounded-md hover:text-zinc-900 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Audit Trail
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right: Domain Scope, Cloud Sync, and Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* Domain Scope Dropdown Pill */}
          {isSuperAdmin ? (
            <div className="flex items-center">
              <select
                value={selectedDomainOverride || 'ALL'}
                onChange={(e) => onSelectDomainOverride(e.target.value)}
                className="h-8 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-800 rounded-lg px-2 py-1 outline-none font-medium focus:border-zinc-900 cursor-pointer w-[115px] sm:w-[155px] truncate shadow-xs transition-colors"
              >
                <option value="ALL">All 13 Domains</option>
                {Object.values(DOMAINS_DIRECTORY).map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.bay})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="h-8 px-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700 flex items-center max-w-[120px] sm:max-w-[140px] truncate">
              {currentUser?.domainName || currentUser?.teamName}
            </span>
          )}

          {/* Device Pill (Shown on very wide screens to prevent navbar clutter on laptops) */}
          <button
            onClick={onOpenDeviceActivity}
            className="hidden 2xl:flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-xs text-zinc-700 transition-colors cursor-pointer"
            title="Where You're Logged In: View active device hardware, IP & location"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            {currentDev.deviceType === 'mobile' ? (
              <Smartphone className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            ) : currentDev.deviceType === 'tablet' ? (
              <Tablet className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            ) : (
              <Laptop className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            )}
            <span className="font-mono text-[11px] font-medium text-zinc-800 truncate max-w-[100px]">
              {currentDev.deviceModel}
            </span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors shadow-xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-zinc-900' : ''}`} />
          </button>

          {/* Export CSV Button */}
          <button
            onClick={onExportCSV}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="h-8 px-2 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="w-5 h-5 rounded-md bg-zinc-900 text-white font-semibold text-[10px] flex items-center justify-center">
                {currentUser?.avatar || 'TF'}
              </span>
              <span className="hidden md:inline font-medium text-zinc-700">
                {currentUser?.name?.split(' ')[0] || 'User'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-zinc-200 shadow-xl overflow-hidden py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                
                {/* User Session Info */}
                <div className="px-3.5 py-2.5 border-b border-zinc-100 bg-zinc-50/70">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-900 truncate">
                      {currentUser?.name}
                    </span>
                    {isSuperAdmin && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-900 text-white font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 mt-0.5 truncate">
                    ID: {currentUser?.username} • {currentUser?.teamName || 'Staff'}
                  </div>
                </div>

                {/* Instagram-style 'Where You're Logged In' */}
                <div className="py-1 border-b border-zinc-100">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenDeviceActivity();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">Where You're Logged In</div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          {currentDev.deviceModel} • 📍 {currentDev.location}
                        </div>
                      </div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                  </button>
                </div>

                {/* Change My Password (Available for all roles: Domain Heads, WebDev, Admins) */}
                <div className="py-1 border-b border-zinc-100">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenChangePassword();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Change My Password</span>
                  </button>
                </div>

                {/* Operations Tools (Super Admin Only) */}
                {isSuperAdmin && (
                  <div className="py-1 border-b border-zinc-100">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenPasswordManager();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-zinc-600 shrink-0" />
                      <span>Password Manager (Domain Heads)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAuditLogs();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                      <span>Audit Trail & Activity Logs</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenAntiGravityReport();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer font-medium"
                    >
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Anti-Gravity Report (Sliet Hub)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenVerificationQueue();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-zinc-600 shrink-0" />
                        <span>Payment Verification Desk</span>
                      </div>
                      {verificationCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-900 text-white font-bold">
                          {verificationCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenBookmarklet();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>1-Click Unstop Sync Tool</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenTokenHealth();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-zinc-600 shrink-0" />
                      <span>Autonomous OAuth Health</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenNeonConfig();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Neon Cloud DB Settings</span>
                    </button>
                  </div>
                )}

                {/* Mobile Export CSV */}
                <div className="sm:hidden py-1 border-b border-zinc-100">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onExportCSV();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-zinc-600 shrink-0" />
                    <span>Export CSV</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
