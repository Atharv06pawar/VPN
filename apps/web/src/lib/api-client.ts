import {
  AuthResponse,
  DeviceInfo,
  WireGuardClientConfig,
  BandwidthUsageSummary,
  GatewayHealth,
  RegisterInput,
  LoginInput,
  CreateDeviceInput,
} from '@bharattunnel/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('bt_access_token');
  }

  public setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bt_access_token', token);
    }
  }

  public clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bt_access_token');
      localStorage.removeItem('bt_user');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = body?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return body.data as T;
  }

  // Auth Endpoints
  public async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.setToken(res.tokens.accessToken);
    localStorage.setItem('bt_user', JSON.stringify(res.user));
    return res;
  }

  public async login(input: LoginInput): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.setToken(res.tokens.accessToken);
    localStorage.setItem('bt_user', JSON.stringify(res.user));
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  public async getMe(): Promise<any> {
    return this.request('/api/auth/me');
  }

  public async deleteAccount(): Promise<void> {
    await this.request('/api/auth/me', { method: 'DELETE' });
    this.clearToken();
  }

  // Device Endpoints
  public async getDevices(): Promise<DeviceInfo[]> {
    return this.request<DeviceInfo[]>('/api/devices');
  }

  public async createDevice(input: CreateDeviceInput): Promise<WireGuardClientConfig> {
    return this.request<WireGuardClientConfig>('/api/devices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public async getDeviceConfig(deviceId: string): Promise<WireGuardClientConfig> {
    return this.request<WireGuardClientConfig>(`/api/devices/${deviceId}/config`);
  }

  public async revokeDevice(deviceId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  // Usage & Telemetry
  public async getUsage(): Promise<BandwidthUsageSummary> {
    return this.request<BandwidthUsageSummary>('/api/usage');
  }

  public async getGatewayStatus(gatewayId = 'india-mumbai-1'): Promise<GatewayHealth> {
    return this.request<GatewayHealth>(`/api/gateways/${gatewayId}/status`);
  }

  // Admin Endpoints
  public async getAdminMetrics(): Promise<any> {
    return this.request('/api/admin/metrics');
  }

  public async getAdminUsers(page = 1, search = ''): Promise<any> {
    return this.request(`/api/admin/users?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
  }

  public async suspendUser(userId: string, reason?: string): Promise<any> {
    return this.request(`/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async unsuspendUser(userId: string): Promise<any> {
    return this.request(`/api/admin/users/${userId}/unsuspend`, {
      method: 'POST',
    });
  }

  public async revokeAdminDevice(deviceId: string): Promise<any> {
    return this.request(`/api/admin/devices/${deviceId}/revoke`, {
      method: 'POST',
    });
  }

  public async getAuditLogs(page = 1): Promise<any> {
    return this.request(`/api/admin/audit-logs?page=${page}&limit=20`);
  }
}

export const api = new ApiClient();
