import { readConfiguredApiBaseUrl } from '../lib/resolve-mobile-api-base-url';

/**
 * Base API client utility for mobile MVP flows.
 *
 * Responsibilities:
 * - Propagate x-correlation-id on every API call (generate if missing)
 * - Propagate x-tenant-id when tenantId is configured (MVP bounded; not authenticated identity)
 * - Provide consistent error handling aligned with shared DTOs
 * - Base URL resolution consistent with PolicyClient pattern
 * - Expose status and body on error for governance blocked-state parity (403 + code)
 * - Wave B.5: maintain a bounded in-memory pending upload queue on transport/network failure
 *
 * Truthful non-claim:
 * - Pending queue is in-memory only for this wave; it is not durable across app restarts
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface QueuedRequestRecord {
  queueId: string;
  path: string;
  method: string;
  body: unknown;
  queuedAt: string;
  tenantId: string;
  correlationId: string;
  reason: string;
}

export interface QueuedRequestResult<T> {
  queued: true;
  queueId: string;
  queueDepth: number;
  pendingRecord: QueuedRequestRecord;
  localStatus: 'QUEUED_FOR_UPLOAD';
  message: string;
  offline: true;
  response: T | null;
}

export type CoLoaderConfig =
  | 'NOT_APPLICABLE'
  | 'PARTY_TO_PARTY'
  | 'PARTY_TO_COLOADER'
  | 'COLOADER_TO_COLOADER'
  | 'COLOADER_TO_PARTY';

export interface UpsertCoLoaderResponsibilityRequest {
  coLoaderConfig: CoLoaderConfig;
  originAirport?: string | null;
  destinationAirport?: string | null;
}

export interface CoLoaderResponsibilityResponse {
  tenantId: string;
  shipmentId: string;
  internalShipmentId: string;
  coLoaderConfig: CoLoaderConfig;
  airportLodgementResponsibleParty: 'PARTY' | 'COLOADER';
  destinationAirportRetrievalResponsibleParty: 'PARTY' | 'COLOADER';
  originAirport: string | null;
  destinationAirport: string | null;
  derivedAt: string | null;
}

const pendingUploadQueue: QueuedRequestRecord[] = [];

export function resolveApiBaseUrl(env: Record<string, string | undefined>): string {
  return readConfiguredApiBaseUrl(env);
}

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function generateQueueId(): string {
  return `queue-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function isTransportFailure(input: unknown): boolean {
  if (!(input instanceof Error)) {
    return false;
  }

  const message = input.message.toLowerCase();

  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  );
}

/**
 * Bounded MVP tenant id for operational flows: env override, else TENANT_1 (explicit placeholder).
 * Does not represent authenticated tenant identity.
 */
export function resolveOperationalTenantId(env: Record<string, string | undefined>): string {
  const keys = ['EXPO_PUBLIC_TENANT_ID', 'NEXT_PUBLIC_TENANT_ID', 'VITE_DEFAULT_TENANT_ID'] as const;
  for (const k of keys) {
    const v = env[k];
    if (v != null && String(v).trim().length > 0) {
      return String(v).trim();
    }
  }
  return 'TENANT_1';
}

export function buildCoLoaderResponsibilityPath(shipmentId: string): string {
  return `/api/nexos/coloader-responsibilities/${encodeURIComponent(shipmentId.trim())}`;
}

export interface ApiClientConfig {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  correlationId?: string;
  tenantId?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private correlationId: string;
  private readonly tenantId: string;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? resolveApiBaseUrl({});
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.correlationId = config.correlationId ?? generateCorrelationId();
    const raw = config.tenantId;
    this.tenantId =
      raw != null && String(raw).trim().length > 0 ? String(raw).trim() : '';
  }

  public getCorrelationId(): string {
    return this.correlationId;
  }

  public setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getPendingUploadCount(): number {
    return pendingUploadQueue.length;
  }

  public listPendingUploads(): QueuedRequestRecord[] {
    return pendingUploadQueue.map((item) => ({ ...item }));
  }

  private buildUrl(path: string): string {
    if (!this.baseUrl) { return path; }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return this.baseUrl + cleanPath;
  }

  private enqueuePendingRequest(path: string, method: string, body: unknown, reason: string): QueuedRequestRecord {
    const record: QueuedRequestRecord = {
      queueId: generateQueueId(),
      path,
      method,
      body,
      queuedAt: new Date().toISOString(),
      tenantId: this.tenantId,
      correlationId: this.correlationId,
      reason,
    };
    pendingUploadQueue.push(record);
    return record;
  }

  public async flushPendingUploads(): Promise<{ flushed: number; remaining: number; failures: number }> {
    let flushed = 0;
    let failures = 0;
    const snapshot = [...pendingUploadQueue];
    pendingUploadQueue.length = 0;

    for (const record of snapshot) {
      try {
        await this.request(record.path, {
          method: record.method,
          body: record.body != null ? JSON.stringify(record.body) : undefined,
          headers: {
            'x-correlation-id': record.correlationId,
            ...(record.tenantId ? { 'x-tenant-id': record.tenantId } : {}),
          },
        });
        flushed = flushed + 1;
      } catch {
        failures = failures + 1;
        pendingUploadQueue.push(record);
      }
    }

    return {
      flushed,
      remaining: pendingUploadQueue.length,
      failures,
    };
  }

  public async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(path);
    const headers = new Headers(options.headers);

    if (!headers.has('x-correlation-id')) {
      headers.set('x-correlation-id', this.correlationId);
    }

    if (this.tenantId.length > 0 && !headers.has('x-tenant-id')) {
      headers.set('x-tenant-id', this.tenantId);
    }

    headers.set('Content-Type', 'application/json');

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...options,
        headers,
      });
    } catch (caughtError) {
      throw caughtError;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { message: text };
      }
      throw new ApiError(
        `API request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
        response.status,
        body
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return {} as T;
  }

  public async post<T>(path: string, body: unknown): Promise<T | QueuedRequestResult<T>> {
    try {
      return await this.request<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        throw caughtError;
      }

      if (isTransportFailure(caughtError)) {
        const pendingRecord = this.enqueuePendingRequest(
          path,
          'POST',
          body,
          caughtError instanceof Error ? caughtError.message : 'Transport failure'
        );

        return {
          queued: true,
          queueId: pendingRecord.queueId,
          queueDepth: this.getPendingUploadCount(),
          pendingRecord,
          localStatus: 'QUEUED_FOR_UPLOAD',
          message: 'Request queued for later upload due to network/transport failure.',
          offline: true,
          response: null,
        };
      }

      throw caughtError;
    }
  }

  public async put<T>(path: string, body: unknown): Promise<T | QueuedRequestResult<T>> {
    try {
      return await this.request<T>(path, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        throw caughtError;
      }

      if (isTransportFailure(caughtError)) {
        const pendingRecord = this.enqueuePendingRequest(
          path,
          'PUT',
          body,
          caughtError instanceof Error ? caughtError.message : 'Transport failure'
        );

        return {
          queued: true,
          queueId: pendingRecord.queueId,
          queueDepth: this.getPendingUploadCount(),
          pendingRecord,
          localStatus: 'QUEUED_FOR_UPLOAD',
          message: 'Request queued for later upload due to network/transport failure.',
          offline: true,
          response: null,
        };
      }

      throw caughtError;
    }
  }

  public async get<T>(path: string): Promise<T> {
    return this.request<T>(path, {
      method: 'GET',
    });
  }

  public async patch<T>(path: string, body: unknown): Promise<T | QueuedRequestResult<T>> {
    try {
      return await this.request<T>(path, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        throw caughtError;
      }

      if (isTransportFailure(caughtError)) {
        const pendingRecord = this.enqueuePendingRequest(
          path,
          'PATCH',
          body,
          caughtError instanceof Error ? caughtError.message : 'Transport failure'
        );

        return {
          queued: true,
          queueId: pendingRecord.queueId,
          queueDepth: this.getPendingUploadCount(),
          pendingRecord,
          localStatus: 'QUEUED_FOR_UPLOAD',
          message: 'Request queued for later upload due to network/transport failure.',
          offline: true,
          response: null,
        };
      }

      throw caughtError;
    }
  }

  public async upsertCoLoaderResponsibility(
    shipmentId: string,
    body: UpsertCoLoaderResponsibilityRequest
  ): Promise<CoLoaderResponsibilityResponse | QueuedRequestResult<CoLoaderResponsibilityResponse>> {
    return this.post<CoLoaderResponsibilityResponse>(
      buildCoLoaderResponsibilityPath(shipmentId),
      body
    );
  }

  public async getCoLoaderResponsibility(shipmentId: string): Promise<CoLoaderResponsibilityResponse> {
    return this.get<CoLoaderResponsibilityResponse>(
      buildCoLoaderResponsibilityPath(shipmentId)
    );
  }
}
