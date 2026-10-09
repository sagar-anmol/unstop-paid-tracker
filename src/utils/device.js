// src/utils/device.js
// High-fidelity client device detection & Instagram-style IP/Location tracking
// for TechFEST '26 Operations Calling CRM & Security Audit Trail

import { 
  saveDeviceSessionToNeon, 
  fetchDeviceSessionsFromNeon, 
  terminateDeviceSessionInNeon 
} from './neonDb.js';

const CUSTOM_DEVICE_KEY = 'tf_device_custom_name';
const GEO_CACHE_KEY = 'tf_network_geo_cache';
const SESSIONS_KEY = 'tf_login_sessions_v2';

// In-memory cache for ultra-fast synchronous access
let cachedGeoInfo = null;

/**
 * Clean and format Android hardware models into recognizable consumer names
 */
function cleanAndroidModel(rawModel) {
  if (!rawModel) return 'Android Device';
  const m = rawModel.trim().replace(/Build\/.*$/, '').trim();

  // Samsung Galaxy Series
  if (/^SM-S92[0-9]/i.test(m)) return 'Samsung Galaxy S24';
  if (/^SM-S91[0-9]/i.test(m)) return 'Samsung Galaxy S23';
  if (/^SM-S90[0-9]/i.test(m)) return 'Samsung Galaxy S22';
  if (/^SM-G9[0-9]{2}/i.test(m)) return 'Samsung Galaxy S-Series';
  if (/^SM-A[0-9]{3}/i.test(m)) return `Samsung Galaxy A${m.substring(4, 6)}`;
  if (/^SM-M[0-9]{3}/i.test(m)) return `Samsung Galaxy M${m.substring(4, 6)}`;
  if (/^SM-F[0-9]{3}/i.test(m)) return 'Samsung Galaxy Z Fold/Flip';
  if (/^SM-/i.test(m)) return `Samsung Galaxy (${m})`;

  // Google Pixel Series
  if (/Pixel\s*[0-9]+[a-z\s]*/i.test(m)) {
    const match = m.match(/Pixel\s*[0-9]+[a-z\s]*/i);
    return `Google ${match[0]}`.trim();
  }

  // OPPO Series (e.g. Oppo F31, F27, F25, F21, CPH..., PCH...)
  if (/OPPO|CPH|PCH|PE[A-Z0-9]|PF[A-Z0-9]|F31|F27|F25|F21|F19/i.test(m)) {
    if (/F31/i.test(m) || /CPH2579|CPH2631|CPH2599/i.test(m)) return 'OPPO F31 5G';
    if (/F27/i.test(m)) return 'OPPO F27 5G';
    if (/F25/i.test(m)) return 'OPPO F25 Pro 5G';
    if (/F21/i.test(m)) return 'OPPO F21 Pro';
    if (/Reno/i.test(m)) return m.toUpperCase().includes('OPPO') ? m : `OPPO ${m}`;
    return m.toUpperCase().includes('OPPO') ? m : `OPPO (${m})`;
  }

  // OnePlus
  if (/OnePlus|NE2211|CPH2449|CPH2451/i.test(m)) {
    if (/OnePlus\s+[0-9]+/i.test(m)) return m;
    return `OnePlus Device (${m})`;
  }

  // Realme
  if (/realme|RMX[0-9]+/i.test(m)) {
    return m.toUpperCase().includes('REALME') ? m : `Realme (${m})`;
  }

  // Xiaomi / Redmi / POCO
  if (/Redmi/i.test(m)) return m;
  if (/POCO/i.test(m)) return m;
  if (/2201|2304|2312|2405/i.test(m)) return `Xiaomi (${m})`;

  // Vivo / iQOO
  if (/vivo|V2\d{3}|iQOO/i.test(m)) return `Vivo / iQOO (${m})`;

  // Motorola
  if (/moto|motorola/i.test(m)) return m;

  return `${m} (Android)`;
}

/**
 * Intelligent fallback location based on regional timezone (e.g. SLIET Punjab campus)
 */
function getFallbackLocation() {
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';
  let city = 'Sangrur';
  let region = 'Punjab';
  let country = 'India';

  if (tz.includes('Kolkata')) {
    city = 'Sangrur / Longowal';
    region = 'Punjab';
    country = 'India';
  }

  return {
    ip: '103.24.120.45 (Local Campus)',
    city,
    region,
    country,
    countryCode: 'IN',
    isp: 'SLIET Wi-Fi / Cellular',
    formattedLocation: `${city}, ${region}`,
    fullLocation: `${city}, ${region}, ${country}`,
    isLive: false,
    cachedAt: Date.now()
  };
}

/**
 * Synchronous getter for current network and location info (instant UI render)
 */
export function getNetworkLocationInfo() {
  if (cachedGeoInfo) return cachedGeoInfo;

  try {
    const stored = localStorage.getItem(GEO_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.formattedLocation) {
        cachedGeoInfo = parsed;
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  cachedGeoInfo = getFallbackLocation();
  return cachedGeoInfo;
}

/**
 * Real-time Geolocation API fetcher (like Instagram Login Activity)
 * Uses ipwho.is with fallback to ipapi.co and local timezone
 */
export async function fetchNetworkLocationInfo(forceRefresh = false) {
  if (!forceRefresh) {
    const current = getNetworkLocationInfo();
    // Cache is valid for 1 hour
    if (current && current.isLive && Date.now() - (current.cachedAt || 0) < 1000 * 60 * 60) {
      return current;
    }
  }

  try {
    // 1. Primary: ipwho.is (Free, CORS-friendly, reliable)
    const res = await fetch('https://ipwho.is/', { cache: 'no-cache' });
    const data = await res.json();

    if (data && data.success) {
      const info = {
        ip: data.ip || '103.xx.xx.xx',
        city: data.city || 'Sangrur',
        region: data.region || 'Punjab',
        country: data.country || 'India',
        countryCode: data.country_code || 'IN',
        isp: data.connection?.isp || data.connection?.org || 'Broadband / 5G',
        formattedLocation: `${data.city || 'Sangrur'}, ${data.region || 'Punjab'}`,
        fullLocation: `${data.city || 'Sangrur'}, ${data.region || 'Punjab'}, ${data.country || 'India'}`,
        isLive: true,
        cachedAt: Date.now()
      };

      cachedGeoInfo = info;
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(info));
      return info;
    }
  } catch (err) {
    // Try secondary fallback if primary fails
    try {
      const fRes = await fetch('https://ipapi.co/json/');
      const fData = await fRes.json();
      if (fData && fData.city) {
        const info = {
          ip: fData.ip,
          city: fData.city,
          region: fData.region,
          country: fData.country_name,
          countryCode: fData.country_code,
          isp: fData.org || 'Broadband',
          formattedLocation: `${fData.city}, ${fData.region}`,
          fullLocation: `${fData.city}, ${fData.region}, ${fData.country_name}`,
          isLive: true,
          cachedAt: Date.now()
        };
        cachedGeoInfo = info;
        localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(info));
        return info;
      }
    } catch (e) {
      // offline or sandboxed
    }
  }

  // Fallback to regional campus defaults
  const fallback = getFallbackLocation();
  cachedGeoInfo = fallback;
  return fallback;
}

// Auto-initialize geolocation in background on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchNetworkLocationInfo().catch(() => {});
  }, 500);
}

/**
 * Analyze navigator and userAgent to identify exact physical hardware, OS & browser
 */
export function getDeviceInfo() {
  const geo = getNetworkLocationInfo();

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceName: 'Central Operations Terminal',
      deviceModel: 'Web Terminal',
      browser: 'Web App',
      os: 'Cloud',
      deviceType: 'desktop',
      isMobile: false,
      location: geo.formattedLocation,
      fullLocation: geo.fullLocation,
      ip: geo.ip,
      isp: geo.isp,
      fullDeviceString: `Central Terminal • 📍 ${geo.formattedLocation}`
    };
  }

  const ua = navigator.userAgent || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // OS & Device Type flags
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isWindows = /Windows NT/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  let os = 'Unknown OS';
  let deviceModel = 'Unknown Device';
  let deviceType = 'desktop';

  // 1. Device Hardware Identification
  if (/iPhone/i.test(ua)) {
    deviceModel = 'Apple iPhone';
    deviceType = 'mobile';
    os = 'iOS';
  } else if (/iPad/i.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1)) {
    deviceModel = 'Apple iPad';
    deviceType = 'tablet';
    os = 'iPadOS';
  } else if (isAndroid) {
    deviceType = /Mobile/i.test(ua) ? 'mobile' : 'tablet';
    os = 'Android';
    const match = ua.match(/Android[^;]+;\s*([^;)]+)/i);
    deviceModel = match && match[1] ? cleanAndroidModel(match[1]) : 'Android Device';
  } else if (isMac) {
    deviceModel = 'MacBook / Mac';
    deviceType = 'desktop';
    os = 'macOS';
  } else if (isWindows) {
    if (ua.includes('Windows NT 10.0')) {
      deviceModel = 'Windows 11/10 PC';
    } else {
      deviceModel = 'Windows PC';
    }
    deviceType = 'desktop';
    os = 'Windows';
  } else if (isLinux) {
    deviceModel = 'Linux Workstation';
    deviceType = 'desktop';
    os = 'Linux';
  }

  // 2. Browser Identification
  let browser = 'Web Browser';
  if (/Edg\//i.test(ua) || /EdgiOS\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/CriOS\//i.test(ua)) {
    browser = 'Chrome (iOS)';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/FxiOS\//i.test(ua)) {
    browser = 'Firefox (iOS)';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(ua)) {
    browser = 'Safari';
  }

  const baseDeviceName = `${deviceModel} • ${browser}`;

  // Check if user set a custom station nickname (e.g. "Plexus Desk #1" or "Sagar's Phone")
  let customStation = '';
  try {
    customStation = localStorage.getItem(CUSTOM_DEVICE_KEY) || '';
  } catch (e) {
    // ignore
  }

  const finalDeviceName = customStation.trim() 
    ? `${customStation.trim()} (${baseDeviceName})` 
    : baseDeviceName;

  const screenResolution = typeof window !== 'undefined' && window.screen 
    ? `${window.screen.width}x${window.screen.height}` 
    : 'Standard Screen';

  const fullDeviceString = `${finalDeviceName} • 📍 ${geo.formattedLocation}`;

  return {
    deviceName: finalDeviceName,
    baseDeviceName,
    customStation: customStation.trim(),
    deviceModel,
    browser,
    os,
    deviceType,
    isMobile: deviceType === 'mobile' || deviceType === 'tablet',
    screen: screenResolution,
    location: geo.formattedLocation,
    fullLocation: geo.fullLocation,
    ip: geo.ip,
    isp: geo.isp,
    fullDeviceString
  };
}

/**
 * Get custom device nickname if set
 */
export function getCustomDeviceName() {
  try {
    return localStorage.getItem(CUSTOM_DEVICE_KEY) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Set custom device nickname
 */
export function setCustomDeviceName(name) {
  try {
    if (!name || !name.trim()) {
      localStorage.removeItem(CUSTOM_DEVICE_KEY);
    } else {
      localStorage.setItem(CUSTOM_DEVICE_KEY, name.trim());
    }
  } catch (e) {
    console.error('Error saving device nickname:', e);
  }
}

// -----------------------------------------------------------------
// Instagram-style "Where You're Logged In" Session Tracking Engine
// -----------------------------------------------------------------

const SEED_LOGIN_SESSIONS = [];

export function getActiveLoginSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        return list.filter(s => s && s.id !== 'sess_seed_2' && s.id !== 'sess_oppo_f31_plexus' && s.id !== 'sess_macbook_raj');
      }
    }
  } catch (e) {
    // ignore
  }
  return [];
}

export function saveActiveLoginSessions(sessions) {
  try {
    const clean = Array.isArray(sessions) 
      ? sessions.filter(s => s && s.id !== 'sess_seed_2' && s.id !== 'sess_oppo_f31_plexus' && s.id !== 'sess_macbook_raj')
      : [];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Error saving login sessions:', e);
  }
}

/**
 * Fetch all sessions from Neon Cloud database and merge with local device sessions
 */
export async function fetchCloudLoginSessions() {
  try {
    const rawCloudSessions = await fetchDeviceSessionsFromNeon();
    const cloudSessions = (rawCloudSessions || []).filter(s => s && s.id !== 'sess_seed_2' && s.id !== 'sess_oppo_f31_plexus' && s.id !== 'sess_macbook_raj');
    if (cloudSessions.length > 0) {
      const local = getActiveLoginSessions();
      const currentDev = getDeviceInfo();
      
      const mergedMap = new Map();
      // Put cloud sessions first
      cloudSessions.forEach(cs => mergedMap.set(cs.id, cs));
      // Put any local session not present in cloud
      local.forEach(ls => {
        if (!mergedMap.has(ls.id)) mergedMap.set(ls.id, ls);
      });
      
      const merged = Array.from(mergedMap.values());
      // Re-evaluate current device flag
      merged.forEach(s => {
        if (s.deviceModel === currentDev.deviceModel && (s.ip === currentDev.ip || s.isCurrentDevice)) {
          s.isCurrentDevice = true;
        }
      });

      saveActiveLoginSessions(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Could not sync cloud login sessions:', err);
  }
  return getActiveLoginSessions();
}

/**
 * Record a new login session when a user signs in (like Instagram Login Activity)
 * Syncs synchronously to local storage and asynchronously to Neon PostgreSQL Cloud
 */
/**
 * Records a login session. When the same user already has an active session on
 * this device, it is refreshed instead of creating a duplicate row, so a
 * re-render or a manual sync does not inflate the session list.
 */
export function recordLoginSession(user) {
  if (!user || !user.username) return;

  const dev = getDeviceInfo();
  const geo = getNetworkLocationInfo();
  const sessions = getActiveLoginSessions();

  const existing = sessions.find(s => s.username === user.username && s.isCurrentDevice);
  if (existing) {
    existing.lastActive = new Date().toISOString();
    saveDeviceSessionToNeon(existing).catch(err => {
      console.warn('Failed to refresh session in Neon:', err);
    });
    return existing;
  }

  const newSession = {
    id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    username: user.username,
    userName: user.name || user.username,
    teamName: user.teamName || user.department || 'Central Operations',
    role: user.role || 'domain_head',
    deviceModel: dev.deviceModel,
    browser: dev.browser,
    os: dev.os,
    deviceType: dev.deviceType,
    ip: geo.ip,
    location: geo.formattedLocation,
    fullLocation: geo.fullLocation,
    isp: geo.isp,
    loginTime: new Date().toISOString(),
    isCurrentDevice: true
  };

  // Mark all older sessions for this user as not current
  const updated = sessions.map(s => (s.username === user.username ? { ...s, isCurrentDevice: false } : s));
  updated.unshift(newSession);

  // Retain up to 25 latest active sessions
  saveActiveLoginSessions(updated.slice(0, 25));

  // Sync to Neon cloud database in background
  saveDeviceSessionToNeon(newSession).catch(err => {
    console.warn('Failed to push session to Neon:', err);
  });

  return newSession;
}

/**
 * Terminate/Log out a specific device session
 */
export function terminateLoginSession(sessionId) {
  const sessions = getActiveLoginSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveActiveLoginSessions(filtered);
  
  // Terminate in Neon Cloud
  terminateDeviceSessionInNeon(sessionId).catch(() => {});
  
  return filtered;
}

