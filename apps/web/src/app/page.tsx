'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  KeyRound,
  ShieldCheck,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Radio,
  Smartphone,
  Laptop,
  Apple,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { ClaimVoucherResponse } from '@bharattunnel/shared';

function ClaimPortalContent() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucherData, setVoucherData] = useState<ClaimVoucherResponse | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<'amnezia' | 'standard'>('amnezia');
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android' | 'windows' | 'macos'>('ios');
  const [copied, setCopied] = useState(false);
  const [showRawConfig, setShowRawConfig] = useState(false);

  // Auto-fetch if code is passed via URL query e.g. /?code=BT-XXXX-XXXX
  useEffect(() => {
    const queryCode = searchParams.get('code');
    if (queryCode && !voucherData && !loading) {
      setCode(queryCode);
      handleClaim(queryCode);
    }
  }, [searchParams]);

  const handleClaim = async (codeToClaim?: string) => {
    const targetCode = (codeToClaim || code).trim().toUpperCase();
    if (!targetCode) {
      setError('Please enter your access code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.claimVoucher(targetCode);
      setVoucherData(data);
    } catch (err: any) {
      setVoucherData(null);
      setError(err.message || 'Failed to claim voucher. Please verify your code.');
    } finally {
      setLoading(false);
    }
  };

  const activeConfig = selectedProfile === 'amnezia' ? voucherData?.amneziaConfig : voucherData?.standardConfig;
  const activeQrCode = selectedProfile === 'amnezia' ? voucherData?.amneziaQrCode : voucherData?.standardQrCode;

  const handleCopy = () => {
    if (!activeConfig) return;
    navigator.clipboard.writeText(activeConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!activeConfig || !voucherData) return;
    const blob = new Blob([activeConfig], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharattunnel-${voucherData.code.toLowerCase()}-${selectedProfile}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-12">
      {/* Header Banner */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold">
          <span>🇮🇳 Mumbai Gateway Egress</span>
          <span>•</span>
          <span className="text-slate-300">30-Day High Speed Access</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          BharatTunnel Access Portal
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
          Enter your 30-day voucher code to download your private Indian WireGuard / AmneziaWG configuration.
        </p>
      </div>

      {/* Code Input Card */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleClaim();
            }}
            className="space-y-4"
          >
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Voucher / Access Code
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="BT-XXXX-XXXX-XXXX"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {loading ? 'Validating...' : 'Unlock Tunnel'}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Unable to claim code:</span> {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Claimed Voucher View */}
      {voucherData && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 animate-fadeIn">
          {/* Status & Validity Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Student Subscription
              </div>
              <div className="text-2xl font-black text-white mt-1 flex items-center gap-2">
                <span>{voucherData.studentName}</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {voucherData.code}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Dedicated Gateway IP: <span className="font-mono text-orange-400">{voucherData.tunnelIp}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${
                  voucherData.daysRemaining > 5
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : voucherData.daysRemaining > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    voucherData.daysRemaining > 5
                      ? 'bg-emerald-400 animate-pulse'
                      : voucherData.daysRemaining > 0
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span>
                  {voucherData.daysRemaining > 0
                    ? `${voucherData.daysRemaining} Days Remaining`
                    : 'Subscription Expired'}
                </span>
              </div>
            </div>
          </div>

          {/* Single Device Policy Warning */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Strictly 1 Device per Code:</span> Your VPN configuration is
              cryptographically tied to your assigned Indian IP ({voucherData.tunnelIp}). Sharing this configuration
              or connecting from multiple devices simultaneously will drop active connections.
            </div>
          </div>

          {/* Profile Selector (AmneziaWG vs Standard WireGuard) */}
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Step 1: Choose Your Connection Profile
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedProfile('amnezia')}
                className={`p-5 rounded-2xl border text-left transition-all relative ${
                  selectedProfile === 'amnezia'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-2">
                    <span>🇷🇺 Russia / Anti-DPI (AmneziaWG)</span>
                  </span>
                  {selectedProfile === 'amnezia' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">
                      SELECTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Includes junk packets and header obfuscation to bypass Russian TSPU (ТСПУ) WireGuard blocks.
                  Use with official <strong>AmneziaVPN</strong> client.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedProfile('standard')}
                className={`p-5 rounded-2xl border text-left transition-all relative ${
                  selectedProfile === 'standard'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-lg shadow-orange-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-2">
                    <span>🌍 Worldwide / Global (Standard WG)</span>
                  </span>
                  {selectedProfile === 'standard' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">
                      SELECTED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Clean, standard WireGuard configuration for maximum speed and compatibility across Europe, USA,
                  Middle East, and native WireGuard apps.
                </p>
              </button>
            </div>
          </div>

          {/* Step 2: Download or Scan QR */}
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Step 2: Connect Your Device
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
              {/* QR Code Column */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-white rounded-2xl shadow-xl">
                  {activeQrCode ? (
                    <img
                      src={activeQrCode}
                      alt="WireGuard Configuration QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-medium text-center">
                  Scan with <strong>AmneziaVPN</strong> or <strong>WireGuard</strong> mobile app
                </span>
              </div>

              {/* Actions Column */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">Direct Profile Import</div>
                  <p className="text-xs text-slate-400">
                    On mobile, scan the QR code directly inside the app. On desktop or laptop, download the configuration file.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .conf</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="flex-1 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRawConfig(!showRawConfig)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 pt-2 transition-colors"
                >
                  {showRawConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{showRawConfig ? 'Hide raw config text' : 'View raw config text'}</span>
                </button>

                {showRawConfig && activeConfig && (
                  <pre className="p-3 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                    {activeConfig}
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Platform Setup Guides */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              Step 3: Setup Instructions for Your Device
            </div>

            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedPlatform('ios')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedPlatform === 'ios'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Apple className="w-4 h-4" />
                <span>iOS (iPhone/iPad)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('android')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedPlatform === 'android'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Android</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('windows')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedPlatform === 'windows'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Windows</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('macos')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedPlatform === 'macos'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Apple className="w-4 h-4" />
                <span>macOS</span>
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-sm text-slate-300 space-y-3">
              {selectedPlatform === 'ios' && (
                <div className="space-y-2">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>iPhone / iPad Setup</span>
                    <a
                      href="https://apps.apple.com/app/amneziavpn/id1600529900"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-orange-400 hover:underline flex items-center gap-1"
                    >
                      <span>App Store</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>Install <strong>AmneziaVPN</strong> (recommended for Russia) or <strong>WireGuard</strong> from the App Store.</li>
                    <li>Open the app, tap <strong>Add / +</strong>, then choose <strong>Scan QR code</strong>.</li>
                    <li>Scan the QR code displayed above, allow adding VPN Configuration when prompted, and tap <strong>Connect</strong>.</li>
                  </ol>
                </div>
              )}

              {selectedPlatform === 'android' && (
                <div className="space-y-2">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Android Phone / Tablet Setup</span>
                    <a
                      href="https://play.google.com/store/apps/details?id=org.amnezia.vpn"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-orange-400 hover:underline flex items-center gap-1"
                    >
                      <span>Google Play</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>Install <strong>AmneziaVPN</strong> from Google Play (or download the APK from GitHub if restricted).</li>
                    <li>Open AmneziaVPN, tap the <strong>+</strong> button, and tap <strong>Scan QR Code</strong>.</li>
                    <li>Scan the QR code above, grant VPN permission, and toggle the switch to connect.</li>
                  </ol>
                </div>
              )}

              {selectedPlatform === 'windows' && (
                <div className="space-y-2">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Windows 10 / 11 Setup</span>
                    <a
                      href="https://github.com/amnezia-vpn/amnezia-client/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-orange-400 hover:underline flex items-center gap-1"
                    >
                      <span>Download Amnezia Client</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>Download & install <strong>AmneziaVPN for Windows</strong> (or official WireGuard for Windows).</li>
                    <li>Click <strong>Download .conf</strong> above to save the configuration file to your PC.</li>
                    <li>In AmneziaVPN, click <strong>Import Connection / File</strong> and select your downloaded <code className="text-orange-400">.conf</code> file.</li>
                    <li>Click <strong>Connect</strong>. All your internet traffic now exits through Mumbai, India.</li>
                  </ol>
                </div>
              )}

              {selectedPlatform === 'macos' && (
                <div className="space-y-2">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Mac (Apple Silicon & Intel) Setup</span>
                    <a
                      href="https://github.com/amnezia-vpn/amnezia-client/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-orange-400 hover:underline flex items-center gap-1"
                    >
                      <span>Download Amnezia DMG</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                    <li>Install <strong>AmneziaVPN for Mac</strong> (or WireGuard from the Mac App Store).</li>
                    <li>Click <strong>Download .conf</strong> above to save your configuration file.</li>
                    <li>Open the app, click <strong>Import Tunnel from File</strong>, and select the downloaded file.</li>
                    <li>Click <strong>Activate</strong>. Verify your connection at <a href="https://whatismyipaddress.com" target="_blank" rel="noreferrer" className="text-orange-400 underline">whatismyipaddress.com</a> (shows Mumbai, India).</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Network Architecture & Security Information */}
      <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Radio className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Censorship-Resistant Anti-DPI</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Engineered specifically to withstand TSPU deep-packet inspection boxes in Russia and other hostile
            networks using randomized packet junk padding and modified protocol headers.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Zero Browsing Activity Logs</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            We collect zero browsing logs, no DNS history, and no packet destination records. Tunnels are strictly
            kernel-level NAT masquerades directly to Indian tier-1 transit.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Mumbai 4 Gbps Datacenter</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Hosted in Mumbai (ap-mumbai-1) with native Indian IP space, enabling access to banking apps, university
            portals, state services, and OTT platforms.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Loading Access Portal...</div>}>
      <ClaimPortalContent />
    </Suspense>
  );
}
