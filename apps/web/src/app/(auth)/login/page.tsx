'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Lock, ArrowRight, Loader2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.loginAdmin({
        email,
        password,
        totpCode: requires2fa ? totpCode : undefined,
      });

      if (res?.data?.twoFactorRequired) {
        setRequires2fa(true);
        setLoading(false);
        return;
      }

      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-lg shadow-orange-500/10">
            {requires2fa ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> : <Lock className="w-6 h-6" />}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {requires2fa ? 'Two-Factor Authentication' : 'Admin Access Only'}
          </h1>
          <p className="text-xs text-slate-400">
            {requires2fa
              ? 'Enter the 6-digit rolling code from your Authenticator App'
              : 'Strictly restricted to BharatTunnel system administration'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requires2fa ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bharattunnel.in"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                  Google Authenticator 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 bg-slate-900 border border-emerald-500/50 rounded-xl text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Open your authenticator app (Google Authenticator, Microsoft Authenticator, or Apple Passwords) and type the current code.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (requires2fa && totpCode.length !== 6)}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : requires2fa ? (
              <>
                <span>Verify & Enter Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign In to Admin</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {requires2fa && (
            <button
              type="button"
              onClick={() => {
                setRequires2fa(false);
                setTotpCode('');
              }}
              className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
            >
              ← Back to password login
            </button>
          )}
        </form>

        <div className="pt-4 border-t border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">Are you a student with a 30-day code?</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-bold transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Go to Student Voucher Claim Portal →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
