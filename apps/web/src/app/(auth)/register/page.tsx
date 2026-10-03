'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, KeyRound, ArrowRight, Lock } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">Public Registration Closed</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            BharatTunnel is an exclusive, admin-managed service. Access to our India-exit WireGuard and AmneziaWG
            servers is provided via <strong>30-Day Access Codes</strong>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-2 text-xs text-slate-300">
          <div className="font-bold text-white flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-orange-400" />
            <span>How to access:</span>
          </div>
          <p className="text-slate-400">
            Once you acquire your access code from the administrator, go to the Student Claim Portal to unlock your
            dedicated configuration and QR code instantly.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <span>Go to Student Claim Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs border border-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
