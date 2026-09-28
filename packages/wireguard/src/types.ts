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

export interface WireGuardConfigOptions {
  clientPrivateKey: string;
  clientAddress: string; // e.g. "10.50.0.2/32"
  serverPublicKey: string;
  serverEndpoint: string; // e.g. "203.0.113.1:51820"
  dnsServers?: string;    // e.g. "10.50.0.1, 1.1.1.1"
  allowedIps?: string;    // e.g. "0.0.0.0/0, ::/0"
  persistentKeepalive?: number; // e.g. 25
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
