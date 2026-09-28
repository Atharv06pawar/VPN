import Link from 'next/link';
import { Shield, Zap, Lock, Globe, Server, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-24 py-12 md:py-20">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold">
          <span>🇮🇳 Built for Indian Students Living Abroad</span>
          <span>•</span>
          <span className="text-slate-300">Free Open Gateway</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
          Direct Encrypted Tunnel to an{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-400">
            Indian Internet Gateway
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          Access your Indian university portals, banking apps, state services, and local internet resources from
          Russia and around the world via official WireGuard tunnels.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 group"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-colors"
          >
            Open Dashboard
          </Link>
        </div>

        {/* Real Network Path Diagram */}
        <div className="pt-8 max-w-3xl mx-auto">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4 text-left">
              Data Routing Architecture
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-left">
              <div className="bg-[#1E293B] p-4 rounded-xl border border-slate-700/50">
                <div className="text-xs text-orange-400 font-semibold">Step 1: Your Device</div>
                <div className="text-sm font-bold text-white mt-1">Student Laptop / Phone</div>
                <div className="text-xs text-slate-400 mt-1">ChaCha20-Poly1305 Encrypted (WireGuard)</div>
              </div>

              <div className="text-center flex sm:flex-col items-center justify-center gap-1 text-slate-500">
                <span className="hidden sm:inline text-xs text-slate-400 font-mono">UDP:51820</span>
                <span className="text-xl">➔</span>
              </div>

              <div className="bg-[#1E293B] p-4 rounded-xl border border-slate-700/50">
                <div className="text-xs text-emerald-400 font-semibold">Step 2: India Gateway</div>
                <div className="text-sm font-bold text-white mt-1">Mumbai-1 Datacenter 🇮🇳</div>
                <div className="text-xs text-slate-400 mt-1">Kernel NAT Egress to Indian Internet</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Production-Grade Infrastructure</h2>
          <p className="text-slate-400 text-sm mt-2">Zero proprietary gimmicks. 100% Linux networking stack.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">WireGuard Kernel Protocol</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              We never implement custom encryption. We utilize Linux kernel WireGuard with state-of-the-art
              Curve25519 key exchange and ChaCha20 encryption.
            </p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Zero Browsing Activity Logs</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              We collect zero browsing logs, no DNS history, and no packet destination tracking. Operational telemetry
              is restricted to bandwidth quotas and handshake status.
            </p>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">50 GB / Month Fair Share</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Every verified student receives 50 GB per month of high-speed egress and up to 2 active devices
              (laptop and smartphone) with zero subscription fees.
            </p>
          </div>
        </div>
      </section>

      {/* Honest Limitations Notice */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>Technical Accuracy & Realistic Transparency</span>
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            BharatTunnel is an encrypted proxy and VPN tunnel. It is designed to provide an Indian public IP address
            for legitimate academic, personal, and connectivity needs. We do not claim &quot;100% untraceability&quot; or
            guarantee circumvention of all hostile deep-packet inspection systems. WireGuard UDP packets (port 51820)
            may be subject to local network policies.
          </p>
        </div>
      </section>
    </div>
  );
}
