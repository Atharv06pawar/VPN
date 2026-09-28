import * as os from 'os';
import { IWireGuardDriver, WireGuardPeerInfo, WireGuardInterfaceStatus, GatewaySystemStats } from './types.js';
import { safeExec } from './safe-exec.js';
import { isValidWireGuardKey } from './keygen.js';
import { IPV4_REGEX } from '@bharattunnel/shared';

/**
 * SystemWireGuardDriver interacts directly with the Linux kernel WireGuard interface via `/usr/bin/wg`.
 * Uses safe argument execution (no shell interpolation).
 */
export class SystemWireGuardDriver implements IWireGuardDriver {
  public readonly name = 'system';
  private interfaceName: string;
  private wgBinaryPath: string;

  constructor(interfaceName = 'wg0', wgBinaryPath = '/usr/bin/wg') {
    this.interfaceName = interfaceName;
    this.wgBinaryPath = wgBinaryPath;
  }

  public async addPeer(publicKey: string, allowedIp: string, keepalive = 25): Promise<void> {
    if (!isValidWireGuardKey(publicKey)) {
      throw new Error(`Invalid WireGuard public key: ${publicKey}`);
    }

    const cleanIp = allowedIp.replace('/32', '');
    if (!IPV4_REGEX.test(cleanIp)) {
      throw new Error(`Invalid allowed IP address: ${allowedIp}`);
    }

    const args = [
      'set',
      this.interfaceName,
      'peer',
      publicKey,
      'allowed-ips',
      `${cleanIp}/32`,
      'persistent-keepalive',
      keepalive.toString(),
    ];

    const result = await safeExec(this.wgBinaryPath, args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to add WireGuard peer: ${result.stderr.trim()}`);
    }
  }

  public async removePeer(publicKey: string): Promise<void> {
    if (!isValidWireGuardKey(publicKey)) {
      throw new Error(`Invalid WireGuard public key: ${publicKey}`);
    }

    const args = ['set', this.interfaceName, 'peer', publicKey, 'remove'];
    const result = await safeExec(this.wgBinaryPath, args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to remove WireGuard peer: ${result.stderr.trim()}`);
    }
  }

  public async getPeer(publicKey: string): Promise<WireGuardPeerInfo | null> {
    const peers = await this.listPeers();
    return peers.find((p) => p.publicKey === publicKey) || null;
  }

  public async listPeers(): Promise<WireGuardPeerInfo[]> {
    const status = await this.getInterfaceStatus();
    return status.peers;
  }

  public async getInterfaceStatus(): Promise<WireGuardInterfaceStatus> {
    const args = ['show', this.interfaceName, 'dump'];
    const result = await safeExec(this.wgBinaryPath, args);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to query WireGuard interface status: ${result.stderr.trim()}`);
    }

    const lines = result.stdout.trim().split('\n');
    if (lines.length === 0 || !lines[0]) {
      throw new Error(`Empty status dump returned for interface ${this.interfaceName}`);
    }

    // Line 1 is the interface itself: [privateKey, publicKey, listenPort, fwmark]
    const ifaceParts = lines[0].split('\t');
    const ifacePubKey = ifaceParts[1] || '';
    const listenPort = parseInt(ifaceParts[2] || '51820', 10);

    const peers: WireGuardPeerInfo[] = [];

    // Subsequent lines are peers:
    // [publicKey, presharedKey, endpoint, allowedIps, latestHandshake, transferRx, transferTx, persistentKeepalive]
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 8) {
        peers.push({
          publicKey: parts[0],
          endpoint: parts[2] !== '(none)' ? parts[2] : null,
          allowedIps: parts[3],
          latestHandshake: parts[4] !== '0' ? parseInt(parts[4], 10) : null,
          transferRx: parseInt(parts[5] || '0', 10),
          transferTx: parseInt(parts[6] || '0', 10),
          persistentKeepalive: parseInt(parts[7] || '0', 10),
        });
      }
    }

    return {
      interfaceName: this.interfaceName,
      publicKey: ifacePubKey,
      listenPort,
      peers,
    };
  }

  public async getSystemStats(): Promise<GatewaySystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const uptime = os.uptime();

    // Calculate approximate CPU usage from os.loadavg()
    const loadAvg = os.loadavg()[0]; // 1 minute load average
    const cpuPercent = Math.min(100, Math.round((loadAvg / Math.max(1, cpus.length)) * 100));

    let bytesRx = 0;
    let bytesTx = 0;

    try {
      const peers = await this.listPeers();
      for (const peer of peers) {
        bytesRx += peer.transferRx || 0;
        bytesTx += peer.transferTx || 0;
      }
    } catch {
      // Fallback if interface query fails
    }

    return {
      cpuPercent,
      memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
      memoryTotalMb: Math.round(totalMem / (1024 * 1024)),
      diskUsedPercent: 25, // Fallback baseline on typical deployment
      uptimeSeconds: Math.round(uptime),
      bytesRx,
      bytesTx,
    };
  }
}

/**
 * MockWireGuardDriver maintains an in-memory peer registry for local development and CI testing.
 * Accurately simulates state transitions, handshakes, and bandwidth updates.
 */
export class MockWireGuardDriver implements IWireGuardDriver {
  public readonly name = 'mock';
  private peers: Map<string, WireGuardPeerInfo> = new Map();
  private interfaceName: string;
  private serverPublicKey: string;
  private listenPort: number;

  constructor(
    interfaceName = 'wg0',
    serverPublicKey = 'YWRtaW4td2ctcHViLWtleS1zYW1wbGUtZGF0YS0xMjM0NTY3OA==',
    listenPort = 51820
  ) {
    this.interfaceName = interfaceName;
    this.serverPublicKey = serverPublicKey;
    this.listenPort = listenPort;
  }

  public async addPeer(publicKey: string, allowedIp: string, keepalive = 25): Promise<void> {
    if (!isValidWireGuardKey(publicKey)) {
      throw new Error(`Invalid WireGuard public key: ${publicKey}`);
    }

    const cleanIp = allowedIp.includes('/') ? allowedIp : `${allowedIp}/32`;
    this.peers.set(publicKey, {
      publicKey,
      allowedIps: cleanIp,
      endpoint: '198.51.100.42:49152',
      latestHandshake: Math.floor(Date.now() / 1000) - 15, // Active handshake 15s ago
      transferRx: 1024 * 1024 * 12, // 12 MB simulated
      transferTx: 1024 * 1024 * 85, // 85 MB simulated
      persistentKeepalive: keepalive,
    });
  }

  public async removePeer(publicKey: string): Promise<void> {
    this.peers.delete(publicKey);
  }

  public async getPeer(publicKey: string): Promise<WireGuardPeerInfo | null> {
    return this.peers.get(publicKey) || null;
  }

  public async listPeers(): Promise<WireGuardPeerInfo[]> {
    return Array.from(this.peers.values());
  }

  public async getInterfaceStatus(): Promise<WireGuardInterfaceStatus> {
    return {
      interfaceName: this.interfaceName,
      publicKey: this.serverPublicKey,
      listenPort: this.listenPort,
      peers: Array.from(this.peers.values()),
    };
  }

  public async getSystemStats(): Promise<GatewaySystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let totalRx = 0;
    let totalTx = 0;
    for (const peer of this.peers.values()) {
      totalRx += peer.transferRx || 0;
      totalTx += peer.transferTx || 0;
    }

    return {
      cpuPercent: 12,
      memoryUsedPercent: Math.round((usedMem / totalMem) * 100),
      memoryTotalMb: Math.round(totalMem / (1024 * 1024)),
      diskUsedPercent: 28,
      uptimeSeconds: 86400 * 3, // 3 days simulated uptime
      bytesRx: totalRx,
      bytesTx: totalTx,
    };
  }

  // Test helper: simulate bandwidth increment
  public simulateTransfer(publicKey: string, rxDelta: number, txDelta: number): void {
    const peer = this.peers.get(publicKey);
    if (peer) {
      peer.transferRx = (peer.transferRx || 0) + rxDelta;
      peer.transferTx = (peer.transferTx || 0) + txDelta;
      peer.latestHandshake = Math.floor(Date.now() / 1000);
    }
  }
}
