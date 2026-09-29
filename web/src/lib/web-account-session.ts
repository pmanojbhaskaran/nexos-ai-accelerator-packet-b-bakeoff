/**
 * Shared WebApp account session resolution for shell + Account Settings.
 * Mirrors ProfileDropdown token/bootstrap discovery without org API coupling.
 */

import { COOKIE_ROLE, LEGACY_COOKIE_ROLE, readAliasedDocumentCookieValue } from "@/lib/auth-session";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStorageRecord(key: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function unwrapApiBody<T>(body: T | { data?: T }): T {
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data?: T }).data as T;
  }
  return body as T;
}

const SESSION_RECORD_KEYS = [
  "user",
  "currentUser",
  "authUser",
  "nexos.user",
  "nexos:user",
  "signupHandoff",
  "signup_handoff",
  "bos_auth",
  "onboardingBootstrap",
  "nexosOnboardingBootstrap",
];

const ROLE_FIELD_NAMES = [
  "primaryRoleCode",
  "roleCode",
  "roleName",
  "role",
  "userRole",
  "primaryRole",
];

function pickFirstRoleFromArray(value: unknown): string {
  if (!Array.isArray(value)) return "";
  for (const candidate of value) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const nested = findDeepField(candidate, ROLE_FIELD_NAMES);
      if (nested) return nested;
    }
    const cleaned = cleanText(candidate);
    if (cleaned) return cleaned;
  }
  return "";
}

function findDeepField(
  value: unknown,
  fieldNames: string[],
  seen = new WeakSet<object>(),
): string {
  if (typeof value === "string") return "";
  if (!value || typeof value !== "object") return "";

  if (seen.has(value)) return "";
  seen.add(value);

  if (Array.isArray(value)) {
    return pickFirstRoleFromArray(value);
  }

  const record = value as Record<string, unknown>;
  const normalizedFields = fieldNames.map((field) => field.toLowerCase());

  for (const [key, candidate] of Object.entries(record)) {
    if (normalizedFields.includes(key.toLowerCase())) {
      const cleaned = cleanText(candidate);
      if (cleaned) return cleaned;
    }
  }

  const fromRoles = pickFirstRoleFromArray(record.roles);
  if (fromRoles) return fromRoles;

  const fromRoleCodes = pickFirstRoleFromArray(record.roleCodes);
  if (fromRoleCodes) return fromRoleCodes;

  const fromAssignments = pickFirstRoleFromArray(record.roleAssignments);
  if (fromAssignments) return fromAssignments;

  for (const candidate of Object.values(record)) {
    const found = findDeepField(candidate, fieldNames, seen);
    if (found) return found;
  }

  return "";
}

function collectSessionRecords(): Record<string, unknown>[] {
  if (typeof window === "undefined") return [];

  const records: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const pushRecord = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const record = readStorageRecord(key);
    if (record) records.push(record);
  };

  SESSION_RECORD_KEYS.forEach(pushRecord);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (/user|auth|signup|onboard|bos_auth/i.test(key)) {
      pushRecord(key);
    }
  }

  return records;
}

function pickRoleCodeFromRecords(records: Record<string, unknown>[]): string {
  for (const record of records) {
    const found = findDeepField(record, ROLE_FIELD_NAMES);
    if (found) return found;
  }
  return "";
}

export function normalizeRoleCode(value: string): string {
  return cleanText(value).replace(/[\s-]+/g, "_").replace(/__+/g, "_").toUpperCase();
}

const GENERIC_ROLE_LABELS = new Set(["admin", "administrator", "tenant admin", "user", "staff"]);

export function mapRoleCodeToProfileLabel(roleCode: string): string {
  const trimmed = cleanText(roleCode);
  if (!trimmed) return "";

  const normalized = normalizeRoleCode(trimmed);

  if (normalized === "TENANT_ADMIN") return "Primary user";
  if (normalized === "ADMIN" || normalized === "OWNER") return "Administrator role";
  if (normalized === "USER" || normalized === "STAFF") return "Team member";

  if (/^[A-Z0-9_]+$/.test(normalized) && normalized.includes("_")) {
    return "Team member";
  }

  if (GENERIC_ROLE_LABELS.has(trimmed.toLowerCase())) {
    if (normalized === "ADMIN") return "Administrator role";
    if (normalized === "USER" || normalized === "STAFF") return "Team member";
    return "";
  }

  if (/^[A-Za-z][A-Za-z0-9\s-]{0,40}$/.test(trimmed)) {
    return trimmed;
  }

  return "";
}

export function resolveVisibleProfileRoleLabel(
  roleCode: string,
  context: {
    organizationName?: string;
    displayName?: string;
    email?: string;
  },
): string {
  const label = mapRoleCodeToProfileLabel(roleCode);
  if (!label) return "";

  const comparable = label.toLowerCase();
  if (context.organizationName && comparable === context.organizationName.toLowerCase()) return "";
  if (context.displayName && comparable === context.displayName.toLowerCase()) return "";
  if (context.email && comparable === context.email.toLowerCase()) return "";

  return label;
}

function roleCodesFromJwtPayload(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.roles)) {
    const fromRoles = payload.roles
      .map((entry) => cleanText(entry))
      .filter(Boolean);
    if (fromRoles.length > 0) return fromRoles;
  }

  const single = cleanText(payload.role);
  return single ? [single] : [];
}

function hydrateStoredUserRolesFromToken(): void {
  if (typeof window === "undefined") return;

  const userRecord = readStorageRecord("user");
  if (userRecord && findDeepField(userRecord, ROLE_FIELD_NAMES)) return;

  const token = resolveAccessToken();
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload) return;

  const roleCodes = roleCodesFromJwtPayload(payload);
  if (roleCodes.length === 0) return;

  const nextUser: Record<string, unknown> = { ...(userRecord ?? {}), roles: roleCodes };
  if (payload.email && !cleanText(nextUser.email)) nextUser.email = payload.email;
  if (payload.sub && !cleanText(nextUser.id)) nextUser.id = payload.sub;

  localStorage.setItem("user", JSON.stringify(nextUser));

  const bosAuth = readStorageRecord("bos_auth");
  if (bosAuth) {
    const nestedUser =
      bosAuth.user && typeof bosAuth.user === "object" && !Array.isArray(bosAuth.user)
        ? (bosAuth.user as Record<string, unknown>)
        : {};
    localStorage.setItem(
      "bos_auth",
      JSON.stringify({ ...bosAuth, user: { ...nestedUser, roles: roleCodes } }),
    );
  }
}

export function resolveStoredRoleCode(): string {
  hydrateStoredUserRolesFromToken();
  return resolveStoredRoleCodeWithSource().roleCode;
}

function resolveStoredRoleCodeWithSource(): { roleCode: string; sourceName: string } {
  const recordKeys = listSessionRecordKeys();
  for (const key of recordKeys) {
    const record = readStorageRecord(key);
    if (!record) continue;
    const found = findDeepField(record, ROLE_FIELD_NAMES);
    if (found) return { roleCode: found, sourceName: `localStorage:${key}` };
  }

  const fromCookie = readAliasedDocumentCookieValue(COOKIE_ROLE, LEGACY_COOKIE_ROLE);
  if (fromCookie) return { roleCode: fromCookie, sourceName: `cookie:${COOKIE_ROLE}` };

  const token = resolveAccessToken();
  if (token) {
    const payload = decodeJwtPayload(token);
    const fromJwt = payload ? findDeepField(payload, ROLE_FIELD_NAMES) : "";
    if (fromJwt) return { roleCode: fromJwt, sourceName: "accessTokenClaims" };
  }

  return { roleCode: "", sourceName: "" };
}

function listSessionRecordKeys(): string[] {
  if (typeof window === "undefined") return [];

  const keys: string[] = [];
  const seen = new Set<string>();

  const pushKey = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  SESSION_RECORD_KEYS.forEach(pushKey);

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (/user|auth|signup|onboard|bos_auth/i.test(key)) {
      pushKey(key);
    }
  }

  return keys;
}

export async function fetchRoleCodeFromAuthMe(token: string): Promise<string> {
  const resolvedToken = cleanText(token) || resolveAccessToken();
  if (!resolvedToken) return "";

  try {
    const response = await fetch(buildAuthApiUrl("/auth/me"), {
      headers: {
        Authorization: `Bearer ${resolvedToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) return "";

    const payload = unwrapApiBody<Record<string, unknown>>(await response.json());
    return findDeepField(payload, ROLE_FIELD_NAMES);
  } catch {
    return "";
  }
}

export async function resolveProfileRoleCode(token?: string): Promise<string> {
  hydrateStoredUserRolesFromToken();
  const stored = resolveStoredRoleCodeWithSource().roleCode;
  if (stored) return stored;
  return fetchRoleCodeFromAuthMe(token || resolveAccessToken());
}

export async function resolveProfileRoleLabel(context: {
  organizationName?: string;
  displayName?: string;
  email?: string;
}, token?: string): Promise<string> {
  const roleCode = await resolveProfileRoleCode(token);
  return resolveVisibleProfileRoleLabel(roleCode, context);
}

export function resolveWebApiBase(): string {
  const maybeEnv = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const cleaned = cleanText(maybeEnv).replace(/\/$/, "");
  return cleaned || "http://localhost:3001/api";
}

export function buildAuthApiUrl(path: string): string {
  const base = resolveWebApiBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api")) return `${base}${normalizedPath}`;
  return `${base}/api${normalizedPath}`;
}

export function resolveAccessToken(): string {
  if (typeof window === "undefined") return "";

  const storageKeys = ["accessToken", "access_token", "token", "authToken", "jwt"];
  for (const key of storageKeys) {
    const value = cleanText(window.localStorage.getItem(key));
    if (value) return value;
  }

  for (const recordKey of ["user", "currentUser", "authUser", "nexos.user", "signupHandoff", "signup_handoff", "bos_auth"]) {
    const record = readStorageRecord(recordKey);
    if (!record) continue;
    for (const field of storageKeys) {
      const value = cleanText(record[field]);
      if (value) return value;
    }
  }

  return "";
}

export type StoredAccountProfile = {
  displayName: string;
  email: string;
  phone: string;
};

function findField(record: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = cleanText(record[field]);
    if (value) return value;
  }
  return "";
}

export function readStoredAccountProfile(): StoredAccountProfile {
  const records = [
    readStorageRecord("user"),
    readStorageRecord("currentUser"),
    readStorageRecord("authUser"),
    readStorageRecord("signupHandoff"),
    readStorageRecord("signup_handoff"),
  ].filter((record): record is Record<string, unknown> => !!record);

  let displayName = "";
  let email = "";
  let phone = "";

  for (const record of records) {
    if (!displayName) {
      displayName = findField(record, ["displayName", "fullName", "name", "adminName", "contactName"]);
    }
    if (!email) {
      email = findField(record, ["email", "userEmail", "adminEmail", "contactEmail", "primaryEmail"]);
    }
    if (!phone) {
      phone = findField(record, ["mobileNumber", "phone", "contactPhone", "primaryPhone"]);
    }
  }

  return { displayName, email, phone };
}
