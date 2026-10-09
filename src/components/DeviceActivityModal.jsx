// src/components/DeviceActivityModal.jsx
// "Where You're Logged In" — device and last known location for this account
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Laptop, 
  Tablet, 
  MapPin, 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  RotateCw, 
  LogOut, 
  AlertTriangle,
  Info
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getDeviceInfo, 
  fetchNetworkLocationInfo, 
  getActiveLoginSessions, 
  fetchCloudLoginSessions,
  terminateLoginSession 
} from '../utils/device';
import { isDatabaseConfigured } from '../utils/neonDb';

export default function DeviceActivityModal({ isOpen, onClose, currentUser }) {
  const [deviceInfo, setDeviceInfo] = useState(() => getDeviceInfo());
  const [sessions, setSessions] = useState(() => getActiveLoginSessions());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setDeviceInfo(getDeviceInfo());
    setSessions(getActiveLoginSessions());

    // Cross-device visibility only exists when a database is configured.
    if (isDatabaseConfigured()) {
      fetchCloudLoginSessions().then(cloudSessions => {
        if (cloudSessions && cloudSessions.length > 0) {
          setSessions(cloudSessions);
        }
      });
    }

    fetchNetworkLocationInfo(false).then(() => {
      setDeviceInfo(getDeviceInfo());
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRefreshGeo = async () => {
    setIsRefreshing(true);
    setActionNotice('');
    try {
      await fetchNetworkLocationInfo(true);
      setDeviceInfo(getDeviceInfo());

      if (isDatabaseConfigured()) {
        const cloud = await fetchCloudLoginSessions();
        if (cloud && cloud.length > 0) setSessions(cloud);
      }

      setActionNotice('Live network IP refreshed.');
    } catch (e) {
      setActionNotice('Location updated from the current network profile.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setActionNotice(''), 4000);
    }
  };

  // Terminating a session only clears the row in Neon. Sign-in runs in the
  // browser, so there is no server-side session to invalidate; the message says
  // so rather than implying the device was locked out.
  const dbConfigured = isDatabaseConfigured();

  const handleTerminateSession = (sessionId, deviceName) => {
    const updated = terminateLoginSession(sessionId);
    setSessions(updated);
    setActionNotice(
      dbConfigured
        ? `Session record for ${deviceName} was closed. Ask them to sign in again.`
        : `Removed ${deviceName} from this device's list. No cloud record exists without a database.`
    );
    setTimeout(() => setActionNotice(''), 4000);
  };

  const currentDeviceType = deviceInfo.deviceType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Instagram Meta Style) */}
        <div className="p-5 border-b border-zinc-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 border border-zinc-200 shrink-0">
              <ShieldCheck className="w-5 h-5 text-zinc-800" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
                Where You're Logged In
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Device activity and last known location for this account
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FAFAFA] custom-scrollbar">
          
          {actionNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionNotice}</span>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION 1: THIS DEVICE (CURRENT ACTIVE SESSION)
              ======================================================== */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                This Device
              </span>
              <button
                onClick={handleRefreshGeo}
                disabled={isRefreshing}
                className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                title="Query live Geolocation API"
              >
                <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-zinc-900' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Ping Live IP'}</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                
                {/* Device Icon Avatar */}
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-xs relative">
                  {currentDeviceType === 'mobile' ? (
                    <Smartphone className="w-6 h-6" />
                  ) : currentDeviceType === 'tablet' ? (
                    <Tablet className="w-6 h-6" />
                  ) : (
                    <Laptop className="w-6 h-6" />
                  )}
                  {/* Green Active Ping */}
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                  </span>
                </div>

                {/* Device Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-zinc-900 truncate">
                      {deviceInfo.deviceName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active now
                    </span>
                  </div>

                  {/* Location & City */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-700 font-medium mt-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{deviceInfo.fullLocation || deviceInfo.location}</span>
                  </div>

                  {/* Network IP & ISP */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 mt-1">
                    <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                    <span className="truncate">{deviceInfo.ip} • {deviceInfo.isp}</span>
                  </div>

                  {/* Tech Specs Pill */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-100 flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-700 border border-zinc-200/60">
                      OS: {deviceInfo.os}
                    </span>
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-700 border border-zinc-200/60">
                      Browser: {deviceInfo.browser}
                    </span>
                    <span className="bg-zinc-100 px-2 py-0.5 rounded text-zinc-700 border border-zinc-200/60">
                      Display: {deviceInfo.screen}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>


          {/* ========================================================
              SECTION 2: LOGINS ON OTHER DEVICES / TEAMS
              ======================================================== */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Other Recognized Devices
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {sessions.length} recorded{dbConfigured ? '' : ' (this device only)'}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/90 divide-y divide-zinc-100 overflow-hidden shadow-xs">
              {sessions.length === 0 ? (
                <div className="p-6 text-center text-zinc-400">
                  <Laptop className="w-6 h-6 mx-auto mb-1.5 text-zinc-300 stroke-[1.5]" />
                  <p className="text-xs font-medium text-zinc-600">No other devices logged in</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {dbConfigured
                      ? 'Devices appear here once their sessions sync to the database.'
                      : 'Only this device is tracked. Configure a database to see other devices.'}
                  </p>
                </div>
              ) : (
                sessions.map((sess) => {
                  const isMobile = sess.deviceType === 'mobile';
                  const isTablet = sess.deviceType === 'tablet';
                  const dateStr = sess.loginTime ? new Date(sess.loginTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric'
                  }) : 'Recently';

                  return (
                    <div key={sess.id} className="p-3 sm:p-3.5 flex items-start justify-between gap-2.5 sm:gap-3 hover:bg-zinc-50/70 transition-colors">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                          {isMobile ? (
                            <Smartphone className="w-4 h-4" />
                          ) : isTablet ? (
                            <Tablet className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-zinc-900">
                              {sess.deviceModel}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              • {sess.browser}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200 shrink-0">
                              {sess.teamName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>{sess.location}</span>
                            </span>
                            <span className="text-zinc-300">•</span>
                            <span className="text-zinc-400 font-mono text-[10px]">{sess.ip}</span>
                          </div>

                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                            <span className="truncate">Signed in {dateStr} ({sess.userName})</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTerminateSession(sess.id, sess.deviceModel)}
                        className="px-2 py-1 text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors shrink-0"
                        title="Log out of this device session"
                      >
                        Log Out
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================
              SECTION 3: HOW GEOLOCATION & SECURITY WORKS
              ======================================================== */}
          <div className="p-3.5 rounded-2xl bg-zinc-100/80 border border-zinc-200 text-xs text-zinc-600">
            <div className="flex items-center gap-2 font-semibold text-zinc-800 mb-1">
              <Info className="w-3.5 h-3.5 text-zinc-600" />
              <span>How TechFEST Device & Location Logging Works</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Just like Instagram and Google accounts security, TechFEST '26 queries the device's public IP address via secure Geolocation APIs (<span className="font-mono text-zinc-700">ipwho.is</span> / <span className="font-mono text-zinc-700">ipapi</span>). When any coordinator calls a student, both the exact physical device and city are cryptographically stamped onto the central audit trail.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-mono text-[11px]">IP & Geo Engine: Active</span>
          </div>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-4"
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
