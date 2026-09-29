// api-client.ts ΓÇö Phase E: Mobile API client with auth + offline queue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveMobileApiBaseUrl } from './resolve-mobile-api-base-url';

function getApiBase(): string {
  return resolveMobileApiBaseUrl();
}

interface OfflineAction {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  createdAt: string;
}

export class MobileApiClient {
  private accessToken: string | null = null;
  private tenantCode: string | null = null;
  private userId: string | null = null;

  async init() {
    this.accessToken = await AsyncStorage.getItem('bos_access_token');
    this.tenantCode = await AsyncStorage.getItem('bos_tenant_code');
    this.userId = await AsyncStorage.getItem('bos_user_id');
  }

  async login(tenantCode: string, email: string, password: string) {
    const API_BASE = getApiBase();
    const trimmedTenant = tenantCode.trim();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(trimmedTenant ? { tenantCode: trimmedTenant } : {}),
      }),
    });
    const raw = await res.json();
    const data = raw?.data && raw.data.accessToken ? raw.data : raw;
    if (!res.ok) throw new Error(data.errors?.[0]?.message || 'Login failed');
    if (!data?.accessToken || !data?.user?.id) throw new Error('AUTH_RESPONSE_INCOMPLETE');
    const resolvedTenant = String(data.user.tenantCode || data.user.tenantId || trimmedTenant || '').trim();
    if (!resolvedTenant) throw new Error('AUTH_RESPONSE_INCOMPLETE');
    this.accessToken = data.accessToken;
    this.tenantCode = resolvedTenant;
    this.userId = data.user.id;
    await AsyncStorage.setItem('bos_access_token', data.accessToken);
    await AsyncStorage.setItem('bos_refresh_token', data.refreshToken);
    await AsyncStorage.setItem('bos_tenant_code', resolvedTenant);
    await AsyncStorage.setItem('bos_user_id', data.user.id);
    await AsyncStorage.setItem('bos_user', JSON.stringify(data.user));
    return data;
  }

  async logout() {
    try { await this.fetch('/auth/logout', { method: 'POST' }); } catch {}
    await AsyncStorage.multiRemove(['bos_access_token', 'bos_refresh_token', 'bos_tenant_code', 'bos_user_id', 'bos_user']);
    this.accessToken = null; this.tenantCode = null; this.userId = null;
  }

  async fetch(path: string, options: RequestInit = {}) {
    const headers: any = { 'Content-Type': 'application/json', ...options.headers };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    if (this.tenantCode) headers['x-tenant-id'] = this.tenantCode;
    const API_BASE = getApiBase();
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(`${API_BASE}${path}`, { ...options, headers }).then(r => r.json());
      }
    }
    return res.json();
  }

  async get(path: string) {
    return this.fetch(path, { method: 'GET' });
  }

  async post(path: string, body?: unknown) {
    return this.fetch(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async patch(path: string, body?: unknown) {
    return this.fetch(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async refreshToken(): Promise<boolean> {
    const rt = await AsyncStorage.getItem('bos_refresh_token');
    if (!rt) return false;
    try {
      const API_BASE = getApiBase();
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
      const data = await res.json();
      if (res.ok) {
        this.accessToken = data.accessToken;
        await AsyncStorage.setItem('bos_access_token', data.accessToken);
        await AsyncStorage.setItem('bos_refresh_token', data.refreshToken);
        return true;
      }
    } catch {}
    return false;
  }

  // Offline queue ΓÇö store actions when offline, sync when back online
  async queueOfflineAction(endpoint: string, method: string, body: any) {
    const queue = JSON.parse(await AsyncStorage.getItem('bos_offline_queue') || '[]') as OfflineAction[];
    queue.push({ id: Date.now().toString(36), endpoint, method, body, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem('bos_offline_queue', JSON.stringify(queue));
    return queue.length;
  }

  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    const queue = JSON.parse(await AsyncStorage.getItem('bos_offline_queue') || '[]') as OfflineAction[];
    let synced = 0, failed = 0;
    const remaining: OfflineAction[] = [];
    for (const action of queue) {
      try {
        await this.fetch(action.endpoint, { method: action.method, body: JSON.stringify(action.body) });
        synced++;
      } catch { failed++; remaining.push(action); }
    }
    await AsyncStorage.setItem('bos_offline_queue', JSON.stringify(remaining));
    return { synced, failed };
  }

  async getOfflineQueueCount(): Promise<number> {
    const queue = JSON.parse(await AsyncStorage.getItem('bos_offline_queue') || '[]');
    return queue.length;
  }

  get currentTenantCode() { return this.tenantCode; }
  get currentUserId() { return this.userId; }
}

export const apiClient = new MobileApiClient();
