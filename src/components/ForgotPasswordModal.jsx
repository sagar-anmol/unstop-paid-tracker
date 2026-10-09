// src/components/ForgotPasswordModal.jsx
import React from 'react';
import { 
  X, 
  KeyRound, 
  ShieldAlert, 
  PhoneCall, 
  MessageSquare, 
  Mail
} from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ForgotPasswordModal({ 
  isOpen, 
  onClose 
}) {
  if (!isOpen) return null;

  const waRajMsg = "Hi Raj Aryan, I forgot my techFEST '26 portal password. Please reset my account from the Central Desk Password Manager.";
  const waRajUrl = `https://wa.me/919288522520?text=${encodeURIComponent(waRajMsg)}`;

  const waSagarMsg = "Hi Sagar bhaiya, I forgot my techFEST '26 portal password. Please reset my account from the Central Desk Password Manager.";
  const waSagarUrl = `https://wa.me/917366879486?text=${encodeURIComponent(waSagarMsg)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Password Reset & Support Desk
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Central Operations Security • techFEST '26
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

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Policy Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Central Security Policy:</span>
              <span>
                All organizer accounts are protected and passwords are stored only as salted hashes. If you forgot your password, contact Central Desk Admins directly below to have it reset.
              </span>
            </div>
          </div>

          {/* Contact Details Cards */}
          <div className="space-y-3 pt-1">
            
            {/* 1. Raj Aryan (Web Dev Member) */}
            <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-3 shadow-xs">
              <div>
                <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <span>Raj Aryan</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-zinc-700">
                    Web Dev Member
                  </span>
                </div>
                <div className="text-[11px] text-zinc-300 font-mono mt-0.5">
                  📞 9288522520 • ✉️ raj.aryan9242@gmail.com
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:9288522520"
                  className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Raj Aryan</span>
                </a>

                <a
                  href={waRajUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp Raj</span>
                </a>
              </div>
            </div>

            {/* 2. Sagar Anmol (Central Operations Lead) */}
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5">
                  <span>Sagar Anmol</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                    Central Desk Lead
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  📞 7366879486
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href="tel:7366879486"
                  className="p-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs transition-colors shadow-2xs"
                  title="Call Sagar Anmol"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-zinc-600" />
                </a>
                <a
                  href={waSagarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs transition-colors shadow-2xs"
                  title="WhatsApp Sagar Anmol"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                </a>
              </div>
            </div>

          </div>

          {/* Email Support */}
          <div className="pt-2 text-center text-[11px] text-zinc-500">
            Technical Support Email:{' '}
            <a
              href="mailto:raj.aryan9242@gmail.com?subject=techFEST%2026%20Password%20Reset%20Request"
              className="font-semibold text-zinc-800 underline hover:text-zinc-950 font-mono"
            >
              raj.aryan9242@gmail.com
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
          <span>techFEST '26 • SLIET Longowal</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-900 cursor-pointer"
          >
            Close
          </Button>
        </div>

      </div>
    </div>
  );
}
