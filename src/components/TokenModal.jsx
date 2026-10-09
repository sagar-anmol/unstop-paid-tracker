import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TokenModal({ summary, isOpen, onClose }) {
  const isAuto = summary?.auth_mode === 'automated_login';
  const expiresAt = summary?.token_expires_at ? new Date(summary.token_expires_at) : null;
  const now = new Date();
  // An expired token is fine: the scraper signs in again before fetching.
  const hoursLeft = expiresAt ? Math.round((expiresAt - now) / (1000 * 60 * 60)) : null;
  const tokenValid = hoursLeft !== null && hoursLeft > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-600" />
            <DialogTitle className="text-base font-semibold text-slate-900">
              Unstop Sync Status
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Unstop token health and manual synchronization status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 text-xs text-slate-600 py-2">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">Manual Trigger Only</div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                The scheduled sync was turned off when Unstop payments were refunded. Run the
                workflow from the Actions tab whenever registrations need refreshing.
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Authentication Mode:</span>
              <Badge variant="success" className="font-mono text-[11px]">
                {isAuto ? 'Email/Password Auto-Login' : 'Static Bearer Token'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Token Status:</span>
              <span className={`font-mono font-semibold ${tokenValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                {tokenValid ? 'Active' : 'Expired (auto re-login)'}
              </span>
            </div>
            {expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Current Session Expiry:</span>
                <span className="font-mono text-slate-800">
                  {expiresAt.toLocaleString('en-IN')} ({hoursLeft}h remaining)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Registration Sync:</span>
              <span className="font-mono text-amber-700 font-medium">Manual (Actions tab)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Payment Sync:</span>
              <span className="font-mono text-sky-700 font-medium">Hourly (sync-payments)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            When a manual run starts without a fresh token, the scraper signs in with the
            configured credentials and acquires a new session before fetching. Payment status is
            no longer read from Unstop; it comes from the hourly sync-payments workflow.
          </p>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
