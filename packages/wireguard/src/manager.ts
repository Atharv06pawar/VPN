import { IWireGuardDriver, WireGuardPeerInfo, GatewaySystemStats, AmneziaWgParams } from './types.js';
import { IpAllocator } from './allocator.js';
import { generateWireGuardKeyPair, isValidWireGuardKey } from './keygen.js';
import { generateWireGuardClientConfig, generateQrCodeDataUrl } from './config-generator.js';
import { GatewayHealth, GatewayStatusState } from '@bharattunnel/shared';

export interface WireGuardManagerConfig {
  driver: IWireGuardDriver;
  allocator: IpAllocator;
  serverHost: string;
  serverPort: number;
  serverPublicKey: string;
  dnsServer: string;
  allowedIps?: string;
  gatewayId?: string;
  gatewayName?: string;
  enableAmneziaWg?: boolean;
  amneziaParams?: AmneziaWgParams;
}

export interface ProvisionPeerResult {
  publicKey: string;
  privateKey?: string;
  tunnelIp: string;
  rawConfig: string;
  qrCodeDataUrl: string;
}

export class WireGuardManager {
  private driver: IWireGuardDriver;
  private allocator: IpAllocator;
  private serverHost: string;
  private serverPort: number;
  private serverPublicKey: string;
  private dnsServer: string;
  private allowedIps: string;
  private gatewayId: string;
  private gatewayName: string;
  private enableAmneziaWg: boolean;
  private amneziaParams?: AmneziaWgParams;

  constructor(config: WireGuardManagerConfig) {
    this.driver = config.driver;
    this.allocator = config.allocator;
    this.serverHost = config.serverHost;
    this.serverPort = config.serverPort;
    this.serverPublicKey = config.serverPublicKey;
    this.dnsServer = config.dnsServer;
    this.allowedIps = config.allowedIps || '0.0.0.0/0, ::/0';
    this.gatewayId = config.gatewayId || 'india-gw-1';
    this.gatewayName = config.gatewayName || 'BharatTunnel India Gateway (Mumbai-1)';
    this.enableAmneziaWg = config.enableAmneziaWg ?? true;
    this.amneziaParams = config.amneziaParams;
  }

  public getDriverName(): string {
    return this.driver.name;
  }

  public getDriver(): IWireGuardDriver {
    return this.driver;
  }

  public getAllocator(): IpAllocator {
    return this.allocator;
  }

  public async addPeer(publicKey: string, allowedIp: string): Promise<void> {
    await this.driver.addPeer(publicKey, allowedIp);
  }

  /**
   * Provisions a new WireGuard peer: allocates an IP, installs peer into interface, and returns configuration.
   */
  public async provisionPeer(params: {
    deviceId: string;
    deviceName: string;
    clientPublicKey?: string;
    existingAllocatedIps: string[];
  }): Promise<ProvisionPeerResult> {
    let clientPublicKey = params.clientPublicKey;
    let clientPrivateKey: string | undefined = undefined;

    if (clientPublicKey) {
      if (!isValidWireGuardKey(clientPublicKey)) {
        throw new Error('Provided client public key is invalid');
      }
    } else {
      const generated = generateWireGuardKeyPair();
      clientPublicKey = generated.publicKey;
      clientPrivateKey = generated.privateKey;
    }

    // Allocate next available IP
    const tunnelIp = this.allocator.allocateNextIp(params.existingAllocatedIps);

    // Register peer in WireGuard interface
    await this.driver.addPeer(clientPublicKey, tunnelIp);

    // Generate client config
    const serverEndpoint = `${this.serverHost}:${this.serverPort}`;
    const rawConfig = generateWireGuardClientConfig({
      clientPrivateKey: clientPrivateKey || 'INSERT_YOUR_PRIVATE_KEY_HERE',
      clientAddress: `${tunnelIp}/32`,
      serverPublicKey: this.serverPublicKey,
      serverEndpoint,
      dnsServers: this.dnsServer,
      allowedIps: this.allowedIps,
      enableAmneziaWg: this.enableAmneziaWg,
      amneziaParams: this.amneziaParams,
    });

    const qrCodeDataUrl = await generateQrCodeDataUrl(rawConfig);

    return {
      publicKey: clientPublicKey,
      privateKey: clientPrivateKey,
      tunnelIp,
      rawConfig,
      qrCodeDataUrl,
    };
  }

  /**
   * Revokes a peer from the WireGuard interface.
   */
  public async revokePeer(publicKey: string): Promise<void> {
    await this.driver.removePeer(publicKey);
  }

  /**
   * Retrieves active peer information from the interface.
   */
  public async getPeer(publicKey: string): Promise<WireGuardPeerInfo | null> {
    return this.driver.getPeer(publicKey);
  }

  /**
   * Lists all active peers configured on the gateway.
   */
  public async listPeers(): Promise<WireGuardPeerInfo[]> {
    return this.driver.listPeers();
  }

  /**
   * Gathers comprehensive gateway health status and traffic telemetry.
   */
  public async getGatewayHealth(): Promise<GatewayHealth> {
    let state: GatewayStatusState = 'HEALTHY';
    let stats: GatewaySystemStats;
    let peersCount = 0;

    try {
      stats = await this.driver.getSystemStats();
      const iface = await this.driver.getInterfaceStatus();
      peersCount = iface.peers.length;

      if (stats.cpuPercent > 90 || stats.memoryUsedPercent > 90) {
        state = 'DEGRADED';
      }
    } catch {
      state = 'DOWN';
      stats = {
        cpuPercent: 0,
        memoryUsedPercent: 0,
        memoryTotalMb: 0,
        diskUsedPercent: 0,
        uptimeSeconds: 0,
        bytesRx: 0,
        bytesTx: 0,
      };
    }

    return {
      id: this.gatewayId,
      name: this.gatewayName,
      status: state,
      endpoint: `${this.serverHost}:${this.serverPort}`,
      wireguardInterface: 'wg0',
      activePeers: peersCount,
      totalPeers: peersCount,
      system: {
        cpuPercent: stats.cpuPercent,
        memoryUsedPercent: stats.memoryUsedPercent,
        memoryTotalMb: stats.memoryTotalMb,
        diskUsedPercent: stats.diskUsedPercent,
        uptimeSeconds: stats.uptimeSeconds,
      },
      traffic: {
        bytesRx: stats.bytesRx,
        bytesTx: stats.bytesTx,
      },
      lastCheckAt: new Date().toISOString(),
    };
  }
}
