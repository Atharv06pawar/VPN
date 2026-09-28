export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type DeviceStatus = 'ACTIVE' | 'REVOKED';
export type IpAllocationStatus = 'ALLOCATED' | 'RELEASED';
export type GatewayStatusState = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  deviceCount?: number;
  totalBandwidthBytes?: number;
}

export interface DeviceInfo {
  id: string;
  userId: string;
  name: string;
  status: DeviceStatus;
  tunnelIp: string;
  publicKey: string;
  createdAt: string;
  revokedAt?: string | null;
  lastHandshakeAt?: string | null;
  bytesRx?: number;
  bytesTx?: number;
}

export interface WireGuardClientConfig {
  deviceId: string;
  deviceName: string;
  tunnelIp: string;
  publicKey: string;
  privateKey?: string; // Only returned once on initial generation if generated server-side
  rawConfig: string;
  qrCodeDataUrl?: string;
  serverEndpoint: string;
  serverPublicKey: string;
  dnsServer: string;
  allowedIps: string;
}

export interface GatewayHealth {
  id: string;
  name: string;
  status: GatewayStatusState;
  endpoint: string;
  wireguardInterface: string;
  activePeers: number;
  totalPeers: number;
  system: {
    cpuPercent: number;
    memoryUsedPercent: number;
    memoryTotalMb: number;
    diskUsedPercent: number;
    uptimeSeconds: number;
  };
  traffic: {
    bytesRx: number;
    bytesTx: number;
  };
  lastCheckAt: string;
}

export interface BandwidthUsageSummary {
  userId: string;
  monthlyLimitBytes: number;
  usedBytes: number;
  percentageUsed: number;
  bytesRx: number;
  bytesTx: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  deviceCount: number;
  maxDevices: number;
}

export interface AuditEventRecord {
  id: string;
  userId?: string | null;
  adminId?: string | null;
  action: string;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: UserSummary;
  tokens: AuthTokens;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
