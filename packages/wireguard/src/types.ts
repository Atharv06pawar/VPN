export interface WireGuardPeerInfo {
  publicKey: string;
  allowedIps: string;
  endpoint?: string | null;
  latestHandshake?: number | null; // Unix timestamp seconds
  transferRx?: number; // Bytes
  transferTx?: number; // Bytes
  persistentKeepalive?: number;
}

export interface WireGuardInterfaceStatus {
  interfaceName: string;
  publicKey: string;
  listenPort: number;
  peers: WireGuardPeerInfo[];
}

export interface GatewaySystemStats {
  cpuPercent: number;
  memoryUsedPercent: number;
  memoryTotalMb: number;
  diskUsedPercent: number;
  uptimeSeconds: number;
  bytesRx: number;
  bytesTx: number;
}

export interface AmneziaWgParams {
  jc?: number;    // Junk packet count (default: 4)
  jmin?: number;  // Junk packet minimum size (default: 40)
  jmax?: number;  // Junk packet maximum size (default: 70)
  s1?: number;    // Init packet junk prefix length (default: 15)
  s2?: number;    // Response packet junk prefix length (default: 30)
  h1?: number;    // Under-cover header 1 (default: 1)
  h2?: number;    // Under-cover header 2 (default: 2)
  h3?: number;    // Under-cover header 3 (default: 3)
  h4?: number;    // Under-cover header 4 (default: 4)
}

export interface WireGuardConfigOptions {
  clientPrivateKey: string;
  clientAddress: string; // e.g. "10.50.0.2/32"
  serverPublicKey: string;
  serverEndpoint: string; // e.g. "203.0.113.1:51820"
  dnsServers?: string;    // e.g. "10.50.0.1, 1.1.1.1"
  allowedIps?: string;    // e.g. "0.0.0.0/0, ::/0"
  persistentKeepalive?: number; // e.g. 25
  enableAmneziaWg?: boolean;
  amneziaParams?: AmneziaWgParams;
}

export interface IWireGuardDriver {
  name: string;
  addPeer(publicKey: string, allowedIp: string, keepalive?: number): Promise<void>;
  removePeer(publicKey: string): Promise<void>;
  getPeer(publicKey: string): Promise<WireGuardPeerInfo | null>;
  listPeers(): Promise<WireGuardPeerInfo[]>;
  getInterfaceStatus(): Promise<WireGuardInterfaceStatus>;
  getSystemStats(): Promise<GatewaySystemStats>;
}
