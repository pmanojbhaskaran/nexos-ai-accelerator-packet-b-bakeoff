import { getCurrentMobileSessionProfile } from './mobile-session-profile';
import { resolveMobileApiBaseUrl } from './resolve-mobile-api-base-url';

export type SessionBootstrapHomeContext = {
  landingModuleCode: string;
  landingRoute: string;
  taskQueueCodes: string[];
  visibleActionCodes?: string[];
};

export type SessionBootstrapUserContext = {
  tenantId: string;
  userId: string;
  displayName?: string;
  roleCodes: string[];
  primaryRoleCode?: string;
  stableSessionId?: string;
  branchCode?: string;
  stationCode?: string;
};

export type SessionBootstrapResponse = {
  issuedAtIso: string;
  ok: true;
  homeContext: SessionBootstrapHomeContext;
  userContext: SessionBootstrapUserContext;
};

export type MobileTaskQueueItem = {
  shipmentId: string;
  waybillNumber?: string;
  currentStatus: string;
  nextActionCode: string;
  nextActionLabel: string;
  laneCode?: string;
  branchCode?: string;
};

export type MobileTaskQueueSummary = {
  generatedAtIso: string;
  tenantId: string;
  queueCode: string;
  roleCode: string;
  totalCount: number;
  items: MobileTaskQueueItem[];
};

export type SessionBootstrapHeaderInput = {
  tenantId?: string;
  userId?: string;
  roleCodes?: string[];
  displayName?: string;
  branchCode?: string;
  stationCode?: string;
  sessionId?: string;
  stableSessionId?: string;
};

export type MobileTaskQueueFilterCode = 'PICKUP' | 'TRANSIT' | 'DELIVERY' | 'ALL';

export type MobileBootstrapRuntimeProjection = {
  tenantId: string;
  userId: string;
  sessionId: string;
  generatedAtIso: string;
  runtimeState: 'READY';
  primaryRoleCode: string;
  roleCodes: string[];
  displayName: string;
  homeContext: SessionBootstrapHomeContext;
  queueSummaries: {
    queueCode: string;
    pendingCount: number;
    inProgressCount: number;
    blockedCount: number;
    lastGeneratedAtIso: string;
    state: 'READY';
  }[];
};

function normalizeRoleCodes(roleCodes: string[] | undefined): string[] {
  const normalized = Array.isArray(roleCodes)
    ? roleCodes
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    : [];

  return normalized.length > 0 ? normalized : ['FIELD_EXECUTIVE'];
}

function deriveMobileSessionId(tenantId: string, userId: string, explicitSessionId: string | undefined): string {
  if (typeof explicitSessionId === 'string' && explicitSessionId.trim() !== '') {
    return explicitSessionId.trim();
  }

  return ('SESSION_' + tenantId + '_' + userId).replace(/[^A-Za-z0-9_]/g, '_');
}

function resolveStableSessionId(input?: SessionBootstrapHeaderInput): string {
  const tenantId = String(input?.tenantId || 'TENANT-DEMO').trim() || 'TENANT-DEMO';
  const userId = String(input?.userId || 'demo.mobile').trim() || 'demo.mobile';

  if (typeof input?.stableSessionId === 'string' && input.stableSessionId.trim() !== '') {
    return input.stableSessionId.trim();
  }

  return deriveMobileSessionId(tenantId, userId, input?.sessionId);
}

export function getApiBaseUrl(): string {
  return resolveMobileApiBaseUrl(process.env as Record<string, string | undefined>);
}

export function buildSessionBootstrapHeaders(input?: SessionBootstrapHeaderInput): Record<string, string> {
  const profile = getCurrentMobileSessionProfile();

  const tenantId = String(input?.tenantId || profile.tenantId || 'TENANT-DEMO').trim();
  const userId = String(input?.userId || profile.userId || 'demo.mobile').trim();
  const roleCodes = normalizeRoleCodes(input?.roleCodes || profile.roleCodes);
  const displayName = String(input?.displayName || profile.displayName || 'Demo Mobile User').trim();
  const branchCode = String(input?.branchCode || profile.branchCode || '').trim();
  const stationCode = String(input?.stationCode || profile.stationCode || '').trim();
  const stableSessionId = resolveStableSessionId({
    tenantId: tenantId.length > 0 ? tenantId : 'TENANT-DEMO',
    userId: userId.length > 0 ? userId : 'demo.mobile',
    sessionId: input?.sessionId,
    stableSessionId: input?.stableSessionId,
  });

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-tenant-id': tenantId.length > 0 ? tenantId : 'TENANT-DEMO',
    'x-auth-sub': userId.length > 0 ? userId : 'demo.mobile',
    'x-role-codes': roleCodes.join(','),
    'x-client-platform': 'mobile',
    'x-session-id': stableSessionId,
  };

  if (displayName.length > 0) {
    headers['x-display-name'] = displayName;
  }

  if (branchCode.length > 0) {
    headers['x-branch-code'] = branchCode.toUpperCase();
  }

  if (stationCode.length > 0) {
    headers['x-station-code'] = stationCode.toUpperCase();
  }

  return headers;
}

export async function fetchSessionBootstrap(input?: SessionBootstrapHeaderInput): Promise<SessionBootstrapResponse> {
  const response = await fetch(getApiBaseUrl() + '/session/bootstrap', {
    method: 'GET',
    headers: buildSessionBootstrapHeaders(input),
  });

  if (!response.ok) {
    throw new Error('SESSION_BOOTSTRAP_REQUEST_FAILED|' + String(response.status));
  }

  const data = (await response.json()) as SessionBootstrapResponse;

  if (
    !data ||
    !data.homeContext ||
    typeof data.homeContext.landingRoute !== 'string' ||
    data.homeContext.landingRoute.trim() === '' ||
    !data.userContext ||
    typeof data.userContext.userId !== 'string' ||
    !Array.isArray(data.userContext.roleCodes)
  ) {
    throw new Error('SESSION_BOOTSTRAP_INVALID_RESPONSE');
  }

  if (data.homeContext.landingRoute.trim() === '') {
    throw new Error('SESSION_BOOTSTRAP_MISSING_LANDING_ROUTE');
  }

  return data;
}

export async function fetchMobileTaskQueueSummary(input?: SessionBootstrapHeaderInput): Promise<MobileTaskQueueSummary> {
  const headers = buildSessionBootstrapHeaders(input);
  const primaryRoleCode = headers['x-role-codes'].split(',')[0]?.trim();

  if (!primaryRoleCode) {
    throw new Error('MOBILE_TASK_QUEUE_ROLE_REQUIRED');
  }

  const response = await fetch(getApiBaseUrl() + '/shipments/mobile-task-queue', {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': headers['x-tenant-id'],
      'x-auth-sub': headers['x-auth-sub'],
      'x-role-code': primaryRoleCode,
      'x-client-platform': 'mobile',
    },
  });

  if (!response.ok) {
    throw new Error('MOBILE_TASK_QUEUE_REQUEST_FAILED|' + String(response.status));
  }

  const data = (await response.json()) as MobileTaskQueueSummary;

  if (!data || typeof data.queueCode !== 'string' || !Array.isArray(data.items)) {
    throw new Error('MOBILE_TASK_QUEUE_INVALID_RESPONSE');
  }

  return data;
}

export function resolveVisibleActionCodesFromBootstrap(data: SessionBootstrapResponse): string[] {
  const raw = Array.isArray(data.homeContext.visibleActionCodes) ? data.homeContext.visibleActionCodes : [];
  const normalized: string[] = [];
  for (const item of raw) {
    const code = typeof item === 'string' ? item.trim() : '';
    if (code !== '' && !normalized.includes(code)) {
      normalized.push(code);
    }
  }
  return normalized;
}
export function projectMobileBootstrapRuntimeSnapshot(
  data: SessionBootstrapResponse,
  queueSummary?: MobileTaskQueueSummary,
): MobileBootstrapRuntimeProjection {
  const primaryRoleCode =
    typeof data.userContext.primaryRoleCode === 'string' && data.userContext.primaryRoleCode.trim() !== ''
      ? data.userContext.primaryRoleCode.trim()
      : data.userContext.roleCodes[0] || 'FIELD_EXECUTIVE';

  const stableSessionId =
    typeof data.userContext.stableSessionId === 'string' && data.userContext.stableSessionId.trim() !== ''
      ? data.userContext.stableSessionId.trim()
      : deriveMobileSessionId(data.userContext.tenantId, data.userContext.userId, undefined);

  return {
    tenantId: data.userContext.tenantId,
    userId: data.userContext.userId,
    sessionId: stableSessionId,
    generatedAtIso: data.issuedAtIso,
    runtimeState: 'READY',
    primaryRoleCode,
    roleCodes: normalizeRoleCodes(data.userContext.roleCodes),
    displayName:
      typeof data.userContext.displayName === 'string' && data.userContext.displayName.trim() !== ''
        ? data.userContext.displayName.trim()
        : data.userContext.userId,
    homeContext: data.homeContext,
    queueSummaries: queueSummary
      ? [
          {
            queueCode: queueSummary.queueCode,
            pendingCount: queueSummary.totalCount,
            inProgressCount: 0,
            blockedCount: 0,
            lastGeneratedAtIso: queueSummary.generatedAtIso,
            state: 'READY',
          },
        ]
      : [],
  };
}

export function resolveMobileExecutionHref(nextActionCode: string): '/pickup-scan' | '/transit-event' | '/delivery-pod' {
  switch (String(nextActionCode || '').trim().toUpperCase()) {
    case 'SCHEDULE_PICKUP':
    case 'RECORD_PICKUP':
      return '/pickup-scan';
    case 'LINEHAUL_HANDOFF':
    case 'RECORD_TRANSIT':
    case 'RAISE_EXCEPTION':
      return '/transit-event';
    case 'OUT_FOR_DELIVERY':
    case 'COMPLETE_DELIVERY':
      return '/delivery-pod';
    default:
      return '/transit-event';
  }
}

export function resolveExpoLandingRoute(data: SessionBootstrapResponse): '/(tabs)' | '/pickup-scan' | '/transit-event' | '/delivery-pod' {
  const landingRoute = data.homeContext.landingRoute.trim();

  switch (landingRoute) {
    case '/mobile/pickups':
      return '/pickup-scan';
    case '/mobile/transit':
      return '/transit-event';
    case '/mobile/delivery':
      return '/delivery-pod';
    case '/mobile/tasks':
    case '/control-tower/workload-board':
    default:
      return '/(tabs)';
  }
}

export async function fetchFilteredMobileTaskQueueSummary(
  filterCode: MobileTaskQueueFilterCode,
  input?: SessionBootstrapHeaderInput,
): Promise<MobileTaskQueueSummary> {
  const headers = buildSessionBootstrapHeaders(input);
  const primaryRoleCode = headers['x-role-codes'].split(',')[0]?.trim();

  if (!primaryRoleCode) {
    throw new Error('MOBILE_TASK_QUEUE_ROLE_REQUIRED');
  }

  const normalizedFilterCode = String(filterCode || 'ALL').trim().toUpperCase() as MobileTaskQueueFilterCode;

  const response = await fetch(getApiBaseUrl() + '/shipments/mobile-task-queue/' + normalizedFilterCode, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': headers['x-tenant-id'],
      'x-auth-sub': headers['x-auth-sub'],
      'x-role-code': primaryRoleCode,
      'x-client-platform': 'mobile',
    },
  });

  if (!response.ok) {
    throw new Error('MOBILE_FILTERED_TASK_QUEUE_REQUEST_FAILED|' + String(response.status));
  }

  const data = (await response.json()) as MobileTaskQueueSummary;

  if (!data || typeof data.queueCode !== 'string' || !Array.isArray(data.items)) {
    throw new Error('MOBILE_FILTERED_TASK_QUEUE_INVALID_RESPONSE');
  }

  return data;
}
export type MobileAccessFoundationSessionState = 'active' | 'expired' | 'logged-out' | 'revoked';

export type MobileAccessFoundationSessionRecord = {
  sessionToken: string;
  sessionId: string;
  stableSessionId: string;
  userId: string;
  tenantCode: string;
  tenantId: string;
  role: string;
  primaryRoleCode: string;
  roleCodes: string[];
  authToken: string;
  state: MobileAccessFoundationSessionState;
  createdAt: string;
  lastUpdatedAt: string;
};

function normalizeValidatedMobileRoleCodes(role: string): string[] {
  const trimmed = String(role || '').trim().toUpperCase();
  return trimmed !== '' ? [trimmed] : ['FIELD_EXECUTIVE'];
}

export function normalizeValidatedMobileAccessSession(data: {
  sessionToken: string;
  userId: string;
  tenantCode: string;
  role: string;
  authToken: string;
  state: MobileAccessFoundationSessionState;
  createdAt: string;
  lastUpdatedAt: string;
}): MobileAccessFoundationSessionRecord {
  const sessionToken = data.sessionToken.trim();
  const tenantCode = data.tenantCode.trim();
  const role = String(data.role || '').trim();
  const primaryRoleCode = role !== '' ? role.trim().toUpperCase().replace(/-/g, '_') : 'FIELD_EXECUTIVE';

  return {
    sessionToken,
    sessionId: sessionToken,
    stableSessionId: sessionToken,
    userId: data.userId.trim(),
    tenantCode,
    tenantId: tenantCode,
    role,
    primaryRoleCode,
    roleCodes: normalizeValidatedMobileRoleCodes(role),
    authToken: data.authToken.trim(),
    state: data.state,
    createdAt: data.createdAt,
    lastUpdatedAt: data.lastUpdatedAt,
  };
}

export async function validateMobileAccessSession(sessionToken: string, tenantCode: string): Promise<MobileAccessFoundationSessionRecord> {
  const response = await fetch(getApiBaseUrl() + '/access-foundation/session/validate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sessionToken,
      tenantCode,
    }),
  });

  if (!response.ok) {
    throw new Error('MOBILE_SESSION_VALIDATE_REQUEST_FAILED|' + String(response.status));
  }

  const data = (await response.json()) as {
    sessionToken: string;
    userId: string;
    tenantCode: string;
    role: string;
    authToken: string;
    state: MobileAccessFoundationSessionState;
    createdAt: string;
    lastUpdatedAt: string;
  };

  if (!data || typeof data.sessionToken !== 'string' || typeof data.tenantCode !== 'string' || typeof data.userId !== 'string') {
    throw new Error('MOBILE_SESSION_VALIDATE_INVALID_RESPONSE');
  }

  return normalizeValidatedMobileAccessSession(data);
}

export function buildBootstrapInputFromValidatedMobileSession(
  session: MobileAccessFoundationSessionRecord,
  input?: {
    displayName?: string;
    branchCode?: string;
    stationCode?: string;
  },
): SessionBootstrapHeaderInput {
  return {
    tenantId: session.tenantId,
    userId: session.userId,
    roleCodes: session.roleCodes,
    displayName:
      typeof input?.displayName === 'string' && input.displayName.trim() !== ''
        ? input.displayName.trim()
        : session.userId,
    branchCode:
      typeof input?.branchCode === 'string' && input.branchCode.trim() !== ''
        ? input.branchCode.trim()
        : undefined,
    stationCode:
      typeof input?.stationCode === 'string' && input.stationCode.trim() !== ''
        ? input.stationCode.trim()
        : undefined,
    sessionId: session.sessionId,
    stableSessionId: session.stableSessionId,
  };
}
