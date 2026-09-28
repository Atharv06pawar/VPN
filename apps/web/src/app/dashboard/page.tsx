'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { DeviceInfo, WireGuardClientConfig, BandwidthUsageSummary } from '@bharattunnel/shared';
import {
  Laptop,
  Smartphone,
  Plus,
  Download,
  QrCode,
  Trash2,
  Server,
  Activity,
  HardDrive,
  ShieldAlert,
  Loader2,
  CheckCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [usage, setUsage] = useState<BandwidthUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Device Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [customPubKey, setCustomPubKey] = useState('');
  const [addingDevice, setAddingDevice] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Config / QR View Modal State
  const [selectedConfig, setSelectedConfig] = useState<WireGuardClientConfig | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [devicesData, usageData] = await Promise.all([api.getDevices(), api.getUsage()]);
      setDevices(devicesData);
      setUsage(usageData);
    } catch (err: any) {
      if (err.message.includes('401') || err.message.includes('UNAUTHORIZED')) {
        router.push('/login');
      } else {
        setError(err.message || 'Failed to load dashboard telemetry.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingDevice(true);
    setAddError(null);

    try {
      const config = await api.createDevice({
        name: newDeviceName,
        publicKey: customPubKey.trim() ? customPubKey.trim() : undefined,
      });

      setNewDeviceName('');
      setCustomPubKey('');
      setIsAddModalOpen(false);
      setSelectedConfig(config);
      await loadData();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add device.');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to revoke '${deviceName}'? This immediately disconnects its VPN tunnel.`)) {
      return;
    }

    try {
      await api.revokeDevice(deviceId);
      await loadData();
    } catch (err: any) {
      alert(`Error revoking device: ${err.message}`);
    }
  };

  const handleViewConfig = async (deviceId: string) => {
    try {
      const config = await api.getDeviceConfig(deviceId);
      setSelectedConfig(config);
    } catch (err: any) {
      alert(`Error loading configuration: ${err.message}`);
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && devices.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-xs text-slate-400">Loading your Indian VPN gateway status...</p>
      </div>
    );
  }

  const activeDeviceCount = devices.filter((d) => d.status === 'ACTIVE').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Gateway Status */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">BharatTunnel India Gateway 🇮🇳</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Region: Mumbai, India • Protocol: WireGuard (UDP:51820) • Traffic Exits via Indian IPv4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={activeDeviceCount >= (usage?.maxDevices || 2)}
            className="w-full md:w-auto px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device ({activeDeviceCount}/{usage?.maxDevices || 2})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bandwidth Usage */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Monthly Fair-Use Quota</span>
            <HardDrive className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {((usage?.usedBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
              <span className="text-xs font-normal text-slate-400 ml-1">
                / {((usage?.monthlyLimitBytes || 50 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(0)} GB
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                style={{ width: `${usage?.percentageUsed || 0}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Resets automatically on 1st of next month. Zero throttling up to 50 GB.
          </div>
        </div>

        {/* Active Devices */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Connected Devices</span>
            <Laptop className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {activeDeviceCount} <span className="text-xs font-normal text-slate-400">/ {usage?.maxDevices || 2} Allowed</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Supports Windows, macOS, Android, iOS, and Linux via WireGuard client.
            </div>
          </div>
        </div>

        {/* Security & Verification */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Privacy Status</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" /> Zero-Logging Policy Active
            </div>
            <div className="text-xs text-slate-400 mt-2">
              No DNS lookups, browsing history, or visited domains are stored on this server.
            </div>
          </div>
        </div>
      </div>

      {/* Devices Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">My Devices</h2>
          <span className="text-xs text-slate-400">{devices.length} registered</span>
        </div>

        {devices.length === 0 ? (
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">No devices connected yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Add your phone or laptop to generate your Indian WireGuard tunnel configuration.
              </p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-orange-500/20"
            >
              Add First Device
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => {
              const isRevoked = device.status === 'REVOKED';
              return (
                <div
                  key={device.id}
                  className={`bg-[#0F172A] border rounded-2xl p-5 space-y-4 transition-all ${
                    isRevoked ? 'border-slate-800 opacity-60' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                        {device.name.toLowerCase().includes('phone') ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Laptop className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{device.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isRevoked
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {device.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          Tunnel IP: {device.tunnelIp}
                        </div>
                      </div>
                    </div>

                    {!isRevoked && (
                      <button
                        onClick={() => handleRevokeDevice(device.id, device.name)}
                        title="Revoke device"
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Transferred: {((device.bytesRx || 0) + (device.bytesTx || 0) > 0) ? `${(((device.bytesRx || 0) + (device.bytesTx || 0)) / (1024 * 1024)).toFixed(1)} MB` : '0 MB'}</span>
                    <span>Created {new Date(device.createdAt).toLocaleDateString()}</span>
                  </div>

                  {!isRevoked && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleViewConfig(device.id)}
                        className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700/80 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Config & QR</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Device</h3>
            <p className="text-xs text-slate-400">
              Provisions a dedicated WireGuard peer and assigns a private tunnel IP on the Indian Gateway.
            </p>

            {addError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Device Name</label>
                <input
                  type="text"
                  required
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Russian Dorm Laptop"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Client Public Key <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customPubKey}
                  onChange={(e) => setCustomPubKey(e.target.value)}
                  placeholder="Leave empty to auto-generate secure keypair"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-orange-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  If left blank, Curve25519 keys will be generated automatically for you to download.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDevice}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  {addingDevice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Create & Download</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WireGuard Config & QR Modal */}
      {selectedConfig && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedConfig.deviceName} Tunnel Config</h3>
                <p className="text-xs text-slate-400">Assigned Tunnel IP: {selectedConfig.tunnelIp}</p>
              </div>
              <button
                onClick={() => setSelectedConfig(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* QR Code for Mobile App */}
            {selectedConfig.qrCodeDataUrl && (
              <div className="bg-white p-4 rounded-xl flex flex-col items-center justify-center max-w-[240px] mx-auto shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedConfig.qrCodeDataUrl}
                  alt="WireGuard QR Code"
                  className="w-48 h-48"
                />
                <span className="text-[11px] font-bold text-slate-800 mt-2">
                  Scan with WireGuard Android/iOS
                </span>
              </div>
            )}

            {/* Raw Configuration Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>WireGuard Configuration (.conf)</span>
                <button
                  onClick={() => copyToClipboard(selectedConfig.rawConfig)}
                  className="text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto">
                {selectedConfig.rawConfig}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() =>
                  handleDownloadFile(
                    `bharattunnel-${selectedConfig.deviceName.replace(/\s+/g, '-').toLowerCase()}.conf`,
                    selectedConfig.rawConfig
                  )
                }
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Download .conf File</span>
              </button>
              <button
                onClick={() => setSelectedConfig(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl"
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
