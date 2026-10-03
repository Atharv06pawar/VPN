import {
  AuthResponse,
  DeviceInfo,
  WireGuardClientConfig,
  BandwidthUsageSummary,
  GatewayHealth,
  RegisterInput,
  LoginInput,
  CreateDeviceInput,
  VoucherInfo,
  ClaimVoucherResponse,
  TwoFactorSetupResponse,
  CreateVoucherInput,
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

  // Auth & 2FA Endpoints
  public async loginAdmin(input: { email: string; password: string; totpCode?: string }): Promise<any> {
    const res = await this.request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (res && res.tokens?.accessToken) {
      this.setToken(res.tokens.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bt_user', JSON.stringify(res.user));
      }
    }
    return res;
  }

  public async setup2fa(): Promise<TwoFactorSetupResponse> {
    return this.request<TwoFactorSetupResponse>('/api/auth/2fa/setup', {
      method: 'POST',
    });
  }

  public async verify2fa(totpCode: string): Promise<any> {
    return this.request('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ totpCode }),
    });
  }

  public async get2faStatus(): Promise<{ twoFactorEnabled: boolean }> {
    return this.request<{ twoFactorEnabled: boolean }>('/api/auth/2fa/status');
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

  // ============================================================================
  // STUDENT CLAIM PORTAL (Public, zero auth)
  // ============================================================================
  public async claimVoucher(code: string): Promise<ClaimVoucherResponse> {
    return this.request<ClaimVoucherResponse>(`/api/vouchers/claim/${encodeURIComponent(code)}`);
  }

  // ============================================================================
  // ADMIN VOUCHER MANAGEMENT
  // ============================================================================
  public async listVouchers(page = 1, search = ''): Promise<{ vouchers: VoucherInfo[]; pagination: any }> {
    return this.request(`/api/vouchers?page=${page}&limit=50&search=${encodeURIComponent(search)}`);
  }

  public async createVoucher(input: CreateVoucherInput): Promise<{ voucher: VoucherInfo; claimUrl: string }> {
    return this.request<{ voucher: VoucherInfo; claimUrl: string }>('/api/vouchers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  public async renewVoucher(id: string, additionalDays = 30): Promise<any> {
    return this.request(`/api/vouchers/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ additionalDays }),
    });
  }

  public async revokeVoucher(id: string): Promise<any> {
    return this.request(`/api/vouchers/${id}/revoke`, {
      method: 'POST',
    });
  }

  public async deleteVoucher(id: string): Promise<any> {
    return this.request(`/api/vouchers/${id}`, {
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

  // Admin Metrics & Logs
  public async getAdminMetrics(): Promise<any> {
    return this.request('/api/admin/metrics');
  }

  public async getAuditLogs(page = 1): Promise<any> {
    return this.request(`/api/admin/audit-logs?page=${page}&limit=20`);
  }
}

export const api = new ApiClient();
