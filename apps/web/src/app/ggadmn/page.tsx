'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import {
  VoucherInfo,
  CreateVoucherInput,
  TwoFactorSetupResponse,
} from '@bharattunnel/shared';
import {
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Clock,
  Activity,
  Server,
  Plus,
  RotateCcw,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Lock,
  ExternalLink,
  QrCode,
  X,
  Send,
  AlertTriangle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [vouchers, setVouchers] = useState<VoucherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // New Voucher Generator State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newVoucherName, setNewVoucherName] = useState('');
  const [newVoucherTelegram, setNewVoucherTelegram] = useState('');
  const [newVoucherChatId, setNewVoucherChatId] = useState('');
  const [newVoucherNotes, setNewVoucherNotes] = useState('');
  const [newVoucherDays, setNewVoucherDays] = useState(30);
  const [creatingVoucher, setCreatingVoucher] = useState(false);
  const [createdVoucherResult, setCreatedVoucherResult] = useState<{ voucher: VoucherInfo; claimUrl: string } | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [viewVoucherModal, setViewVoucherModal] = useState<any | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [vouchersRes, twoFactorRes, gwRes] = await Promise.all([
        api.listVouchers(1, search),
        api.get2faStatus().catch(() => ({ twoFactorEnabled: false })),
        api.getGatewayStatus().catch(() => null),
      ]);

      setVouchers(vouchersRes.vouchers || []);
      setTwoFactorEnabled(Boolean(twoFactorRes.twoFactorEnabled));
      setGatewayStatus(gwRes);
    } catch (err: any) {
      if (err.message.includes('403') || err.message.includes('FORBIDDEN') || err.message.includes('401')) {
        router.push('/godcode');
      } else {
        setError(err.message || 'Failed to load administrator data.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Handle 2FA Setup
  const handleOpen2faSetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    setTwoFactorModalOpen(true);
    try {
      const data = await api.setup2fa();
      setTwoFactorSetupData(data);
    } catch (err: any) {
      setTwoFactorError(err.message || 'Failed to initiate 2FA setup');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerifyCode || totpVerifyCode.length !== 6) return;

    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      await api.verify2fa(totpVerifyCode);
      setTwoFactorEnabled(true);
      setTwoFactorModalOpen(false);
      alert('Two-Factor Authentication is now active! All future logins will require your 6-digit Authenticator code.');
    } catch (err: any) {
      setTwoFactorError(err.message || 'Invalid 6-digit code. Please check your authenticator app.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Handle Create Voucher
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucherName.trim()) return;

    setCreatingVoucher(true);
    try {
      const input: CreateVoucherInput = {
        studentName: newVoucherName.trim(),
        telegramHandle: newVoucherTelegram.trim() || undefined,
        telegramChatId: newVoucherChatId.trim() || undefined,
        notes: newVoucherNotes.trim() || undefined,
        validityDays: Number(newVoucherDays) || 30,
      };

      const result = await api.createVoucher(input);
      setCreatedVoucherResult(result);
      setNewVoucherName('');
      setNewVoucherTelegram('');
      setNewVoucherChatId('');
      setNewVoucherNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Error creating voucher: ${err.message}`);
    } finally {
      setCreatingVoucher(false);
    }
  };

  // Handle Renew Voucher (+30 Days)
  const handleRenew = async (voucher: VoucherInfo) => {
    try {
      setActionLoading(voucher.id);
      await api.renewVoucher(voucher.id, 30);
      await loadData();
    } catch (err: any) {
      alert(`Failed to renew voucher: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Revoke Voucher
  const handleRevoke = async (voucher: VoucherInfo) => {
    if (!confirm(`Are you sure you want to revoke access for ${voucher.studentName} (${voucher.code})? Their VPN connection will be cut off immediately.`)) {
      return;
    }
    try {
      setActionLoading(voucher.id);
      await api.revokeVoucher(voucher.id);
      await loadData();
    } catch (err: any) {
      alert(`Failed to revoke voucher: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Delete Voucher
  const handleDelete = async (voucher: VoucherInfo) => {
    if (!confirm(`Permanently delete voucher for ${voucher.studentName}? This will free the allocated IP ${voucher.tunnelIp}.`)) {
      return;
    }
    try {
      setActionLoading(voucher.id);
      await api.deleteVoucher(voucher.id);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete voucher: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleViewConfig = async (voucher: VoucherInfo) => {
    try {
      setActionLoading(voucher.id);
      const data = await api.claimVoucher(voucher.code);
      setViewVoucherModal(data);
    } catch (err: any) {
      alert(`Failed to load config: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const activeVouchersCount = vouchers.filter((v) => v.status === 'ACTIVE' && !v.isExpired).length;
  const expiringSoonCount = vouchers.filter((v) => v.status === 'ACTIVE' && v.daysRemaining <= 3 && v.daysRemaining > 0).length;
  const expiredCount = vouchers.filter((v) => v.isExpired || v.status === 'EXPIRED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight">Admin Control Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
              MUMBAI-1
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exclusive administration dashboard for 30-day voucher subscriptions & gateway telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {twoFactorEnabled ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>2FA TOTP Active</span>
            </div>
          ) : (
            <button
              onClick={handleOpen2faSetup}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Enable 2FA Authenticator</span>
            </button>
          )}

          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setCreatedVoucherResult(null);
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New 30-Day Voucher</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Subscribers</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{vouchers.length}</div>
          <div className="text-[11px] text-slate-500">Registered student vouchers</div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Connections</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
            <span>{activeVouchersCount}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-[11px] text-slate-500">Allowed at kernel interface (wg0)</div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Expiring Soon (≤ 3 Days)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{expiringSoonCount}</div>
          <div className="text-[11px] text-slate-500">Ready for Telegram renewal alert</div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Expired / Revoked</span>
            <Lock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{expiredCount}</div>
          <div className="text-[11px] text-slate-500">Automatically disconnected</div>
        </div>
      </div>

      {/* Gateway Hardware Telemetry (Mumbai-1 ARM) */}
      {gatewayStatus && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                India Gateway (Mumbai-1 • 137.23.44.209)
              </span>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {gatewayStatus.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">CPU Load</div>
              <div className="text-base font-bold text-white">{gatewayStatus.system?.cpuPercent || 0}%</div>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">RAM Consumption</div>
              <div className="text-base font-bold text-white">{gatewayStatus.system?.memoryUsedPercent || 0}%</div>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">Active WG Peers</div>
              <div className="text-base font-bold text-white">{gatewayStatus.activePeers || 0}</div>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">Uptime</div>
              <div className="text-base font-bold text-white">
                {Math.floor((gatewayStatus.system?.uptimeSeconds || 0) / 3600)} hrs
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vouchers & Subscriptions Table Section */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-400" />
              <span>Student Subscriptions & 30-Day Vouchers</span>
            </h2>
            <p className="text-xs text-slate-400">
              Strictly 1 device per code. When expired, peers are dropped at the Linux kernel level until renewed.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, code, telegram..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Voucher Code</th>
                <th className="py-3 px-3">Telegram</th>
                <th className="py-3 px-3">Dedicated IP</th>
                <th className="py-3 px-3">Days Left</th>
                <th className="py-3 px-3">Traffic (Rx/Tx)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No vouchers found. Click &quot;New 30-Day Voucher&quot; to generate an access code.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const isExpiringSoon = v.status === 'ACTIVE' && v.daysRemaining <= 3 && v.daysRemaining > 0;
                  const isExpired = v.isExpired || v.status === 'EXPIRED';

                  return (
                    <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                      {/* Name & Notes */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{v.studentName}</div>
                        {v.notes && <div className="text-[10px] text-slate-400">{v.notes}</div>}
                      </td>

                      {/* Code + Copy Link */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {v.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(v.code)}
                            title="Copy student claim link"
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-orange-400 transition-colors"
                          >
                            {copiedCode === v.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Telegram Handle */}
                      <td className="py-3 px-3">
                        {v.telegramHandle ? (
                          <a
                            href={`https://t.me/${v.telegramHandle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>{v.telegramHandle}</span>
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Tunnel IP */}
                      <td className="py-3 px-3 font-mono text-orange-300">
                        {v.tunnelIp}
                      </td>

                      {/* Days Left */}
                      <td className="py-3 px-3 font-semibold">
                        {isExpired ? (
                          <span className="text-rose-400">0 Days (Expired)</span>
                        ) : isExpiringSoon ? (
                          <span className="text-amber-400">{v.daysRemaining} Days Left</span>
                        ) : (
                          <span className="text-emerald-400">{v.daysRemaining} Days Left</span>
                        )}
                      </td>

                      {/* Traffic */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        {(v.bytesRx / (1024 * 1024)).toFixed(0)} MB ↓ / {(v.bytesTx / (1024 * 1024)).toFixed(0)} MB ↑
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {v.status === 'ACTIVE' && !isExpired && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            EXPIRED
                          </span>
                        )}
                        {v.status === 'REVOKED' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            REVOKED
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRenew(v)}
                            disabled={actionLoading === v.id}
                            title="Add 30 Days and Reactivate"
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-colors"
                          >
                            +30 Days
                          </button>

                          <button
                            type="button"
                            onClick={() => handleViewConfig(v)}
                            disabled={actionLoading === v.id}
                            title="View QR Code & Config"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {v.status === 'ACTIVE' && !isExpired && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(v)}
                              disabled={actionLoading === v.id}
                              title="Revoke / Freeze Access"
                              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(v)}
                            disabled={actionLoading === v.id}
                            title="Delete Voucher & Free IP"
                            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NEW VOUCHER GENERATOR */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0F172A] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">Generate 30-Day Voucher</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!createdVoucherResult ? (
              <form onSubmit={handleCreateVoucher} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Student Full Name / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVoucherName}
                    onChange={(e) => setNewVoucherName(e.target.value)}
                    placeholder="e.g. Ivan Petrov (Moscow)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Telegram Username (Optional)
                    </label>
                    <input
                      type="text"
                      value={newVoucherTelegram}
                      onChange={(e) => setNewVoucherTelegram(e.target.value)}
                      placeholder="@username"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Validity Period (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={newVoucherDays}
                      onChange={(e) => setNewVoucherDays(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Payment / Sponsor Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={newVoucherNotes}
                    onChange={(e) => setNewVoucherNotes(e.target.value)}
                    placeholder="e.g. Paid 1500 INR via UPI / Sponsor Batch 1"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[11px] leading-relaxed">
                  💡 This will automatically allocate a dedicated private IP on the Mumbai gateway, generate a unique WireGuard Curve25519 keypair, and create a shareable claim link.
                </div>

                <button
                  type="submit"
                  disabled={creatingVoucher}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {creatingVoucher ? 'Generating Keys & Allocating IP...' : 'Generate 30-Day Access Code'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Voucher Generated Successfully!
                  </div>
                  <div className="text-2xl font-mono font-black text-white">
                    {createdVoucherResult.voucher.code}
                  </div>
                  <div className="text-xs text-slate-400">
                    Student: <strong className="text-slate-200">{createdVoucherResult.voucher.studentName}</strong> • Dedicated IP: <strong className="text-orange-400 font-mono">{createdVoucherResult.voucher.tunnelIp}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Student Claim Link (Share with student)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?code=${createdVoucherResult.voucher.code}`}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdVoucherResult.voucher.code)}
                      className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      {copiedCode === createdVoucherResult.voucher.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode === createdVoucherResult.voucher.code ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 2FA TOTP AUTHENTICATOR SETUP */}
      {/* ========================================================================= */}
      {twoFactorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Enable Admin 2FA (TOTP)</h3>
              </div>
              <button
                onClick={() => setTwoFactorModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {twoFactorError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {twoFactorError}
              </div>
            )}

            {twoFactorSetupData && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scan this QR code with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Apple Passwords</strong>.
                </p>

                <div className="flex justify-center p-4 bg-white rounded-2xl">
                  <img
                    src={twoFactorSetupData.qrCodeDataUrl}
                    alt="2FA QR Code"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Manual Entry Secret</span>
                  <code className="text-xs font-mono font-bold text-orange-400 select-all">
                    {twoFactorSetupData.secret}
                  </code>
                </div>

                <form onSubmit={handleVerify2fa} className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-400 text-center">
                    Enter 6-Digit Code from App
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center tracking-[0.5em] font-mono text-2xl py-2.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                  <button
                    type="submit"
                    disabled={twoFactorLoading || totpVerifyCode.length !== 6}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {twoFactorLoading ? 'Verifying...' : 'Confirm & Activate 2FA'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW VOUCHER CONFIG & QR */}
      {/* ========================================================================= */}
      {viewVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0F172A] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{viewVoucherModal.studentName}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-orange-400">
                    {viewVoucherModal.code}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dedicated IP: <span className="font-mono text-orange-400">{viewVoucherModal.tunnelIp}</span>
                </p>
              </div>
              <button
                onClick={() => setViewVoucherModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-2xl">
              <img
                src={viewVoucherModal.amneziaQrCode}
                alt="Amnezia QR"
                className="w-56 h-56 object-contain rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                AmneziaWG Client Configuration (.conf)
              </label>
              <pre className="p-3 rounded-xl bg-black/60 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-36">
                {viewVoucherModal.amneziaConfig}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCopyLink(viewVoucherModal.code)}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Student Claim Link</span>
              </button>
              <button
                onClick={() => setViewVoucherModal(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
