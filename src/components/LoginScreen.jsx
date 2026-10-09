// src/components/LoginScreen.jsx
import React, { useState } from 'react';
import { 
  User, 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tablet,
  MapPin
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authenticateUser } from '../utils/auth';
import { getDeviceInfo } from '../utils/device';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const dev = getDeviceInfo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await authenticateUser(username, password);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSuccess = (targetUser, newPass) => {
    setUsername(targetUser);
    setPassword(newPass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-zinc-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 relative select-none font-sans">
      
      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-bold text-sm mx-auto shadow-xs mb-3">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            techFEST '26
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Central Organizer Operations Command Center
          </p>
        </div>

        {/* Credentials Form Card */}
        <div className="bg-white border border-zinc-200/80 shadow-xs rounded-2xl p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Field 1: Official Email */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Official Email / Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. sumitbansal1290@gmail.com, sagaranmol@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 outline-none shadow-xs h-10 font-mono"
                />
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Field 2: Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-700">
                  Password
                </label>
                
                {/* Forgot Password / Admin Reset Link */}
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer hover:underline flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3 text-amber-500" />
                  <span>Forgot / Reset Password?</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-white border border-zinc-200 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 outline-none shadow-xs h-10 font-mono"
                />
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-400 font-mono">
                <span>Passwords are hashed &amp; admin managed</span>
                <span className="text-[10px] text-zinc-400">Forgotten? Reset below</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="shrink-0 text-[11px] font-semibold underline text-rose-800 hover:text-rose-950 cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <span>{isSubmitting ? "Authenticating..." : "Sign In to Operations Portal"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Device & Location Security Badge */}
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-white border border-zinc-200/80 flex items-center justify-between text-[11px] text-zinc-600 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-zinc-500 shrink-0">Logging from:</span>
            <span className="font-semibold text-zinc-900 font-mono flex items-center gap-1 truncate">
              {dev.deviceType === 'mobile' ? (
                <Smartphone className="w-3 h-3 text-zinc-600 shrink-0" />
              ) : dev.deviceType === 'tablet' ? (
                <Tablet className="w-3 h-3 text-zinc-600 shrink-0" />
              ) : (
                <Laptop className="w-3 h-3 text-zinc-600 shrink-0" />
              )}
              <span className="truncate max-w-[130px] sm:max-w-[180px]">{dev.deviceModel}</span>
            </span>
          </div>
          <span className="text-zinc-600 flex items-center gap-1 font-medium shrink-0 ml-2">
            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
            <span>{dev.location.split(',')[0]}</span>
          </span>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-400 mt-6">
          SLIET Longowal • techFEST '26 Core Operations Team
        </p>
      </div>

      {/* Forgot Password / Admin On-Spot Reset Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        onSuccessReset={handleResetSuccess}
      />

    </div>
  );
}
