'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import {
  Users,
  Shield,
  Activity,
  HardDrive,
  Cpu,
  Search,
  UserX,
  UserCheck,
  RotateCcw,
  Loader2,
  Server,
  FileText,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metricsData, usersData, logsData] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminUsers(1, search),
        api.getAuditLogs(1),
      ]);
      setMetrics(metricsData);
      setUsers(usersData.users);
      setAuditLogs(logsData.logs);
    } catch (err: any) {
      if (err.message.includes('403') || err.message.includes('FORBIDDEN') || err.message.includes('401')) {
        router.push('/dashboard');
      } else {
        setError(err.message || 'Failed to load administrative telemetry.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [search]);

  const handleSuspendUser = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user? All their active WireGuard tunnels will be terminated immediately.')) {
      return;
    }

    try {
      setActionLoading(userId);
      await api.suspendUser(userId, 'Administrative action');
      await loadAdminData();
    } catch (err: any) {
      alert(`Error suspending user: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      await api.unsuspendUser(userId);
      await loadAdminData();
    } catch (err: any) {
      alert(`Error unsuspending user: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-xs text-slate-400">Loading system administration telemetry...</p>
      </div>
    );
  }

  const gw = metrics?.gateway;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>Admin Control Center</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
              RESTRICTED
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry and management for BharatTunnel India Gateway nodes.
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{metrics?.totalUsers || 0}</div>
          <div className="text-[11px] text-slate-500">
            {metrics?.suspendedUsers || 0} suspended
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active VPN Peers</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metrics?.activeDevices || 0}</div>
          <div className="text-[11px] text-slate-500">Across 1 India Gateway node</div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gateway Health</span>
            <Server className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{gw?.status || 'HEALTHY'}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Endpoint: {gw?.endpoint || '203.0.113.1:51820'}
          </div>
        </div>

        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Bandwidth</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {(((metrics?.traffic?.totalBytesCombined || 0)) / (1024 * 1024 * 1024)).toFixed(2)} GB
          </div>
          <div className="text-[11px] text-slate-500">
            RX: {(((metrics?.traffic?.totalBytesRx || 0)) / (1024 * 1024)).toFixed(0)} MB • TX: {(((metrics?.traffic?.totalBytesTx || 0)) / (1024 * 1024)).toFixed(0)} MB
          </div>
        </div>
      </div>

      {/* Gateway System Health */}
      {gw && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-400" />
              <span>India Gateway (Mumbai-1) Hardware Metrics</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Uptime: {Math.floor((gw.system?.uptimeSeconds || 0) / 3600)} hrs
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">CPU Load</div>
              <div className="text-lg font-bold text-white">{gw.system?.cpuPercent || 0}%</div>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">RAM Consumption</div>
              <div className="text-lg font-bold text-white">{gw.system?.memoryUsedPercent || 0}%</div>
            </div>
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-1">Root Storage</div>
              <div className="text-lg font-bold text-white">{gw.system?.diskUsedPercent || 0}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Users Management */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-white">Registered Users</h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user email or name..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Devices</th>
                <th className="py-3 px-4 font-semibold">Bandwidth Used</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => {
                const isSuspended = u.status === 'SUSPENDED';
                const isActioning = actionLoading === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-900/50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{u.fullName}</div>
                      <div className="text-slate-400 text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{u.role}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuspended
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{u.deviceCount}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {((u.totalBandwidthBytes || 0) / (1024 * 1024)).toFixed(1)} MB
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => (isSuspended ? handleUnsuspendUser(u.id) : handleSuspendUser(u.id))}
                          disabled={isActioning}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            isSuspended
                              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                          }`}
                        >
                          {isActioning ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : isSuspended ? (
                            'Unsuspend'
                          ) : (
                            'Suspend'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span>Security Audit Trail</span>
        </h2>

        <div className="divide-y divide-slate-800/60 text-xs">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-mono text-orange-400">{log.action}</span>
                <span className="text-slate-400 ml-2">by {log.userEmail || 'System/Admin'}</span>
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
