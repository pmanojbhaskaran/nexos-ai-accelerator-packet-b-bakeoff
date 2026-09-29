import { resolveAccessToken, resolveWebApiBase } from "@/lib/web-account-session";

export type OrganizationBootstrapRecord = {
  legalName?: string;
  displayName?: string;
  businessTypeCode?: string;
  msmeBand?: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
};

export type OrganizationFormValues = {
  displayName: string;
  legalName: string;
  msmeBand: string;
  typeOfEntity: string;
  cinLlpin: string;
  pan: string;
  tan: string;
  gstin: string;
  principalBusinessActivityNicCode: string;
  iec: string;
  professionalTaxRegistrationNumber: string;
  registrationNumber: string;
  addressLine1: string;
  addressLine2: string;
  areaLocalityName: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  language: string;
  weightUnit: string;
  supportEmail: string;
  supportPhone: string;
  logoUrl: string;
  businessTypeCode: string;
};

function metaString(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === "string" ? value : "";
}

const STATUTORY_ALPHANUMERIC_MAX10_FIELDS: ReadonlySet<keyof OrganizationFormValues> = new Set([
  "pan",
  "tan",
  "iec",
]);

const INDIAN_PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const INDIAN_TAN_PATTERN = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const IEC_PATTERN = /^[A-Z0-9]{10}$/;

function stripAlphanumeric(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

export function normalizeOrganizationProfileFieldValue(
  name: keyof OrganizationFormValues,
  value: string,
): string {
  if (name === "pincode") {
    return value.replace(/\D/g, "").slice(0, 6);
  }
  if (STATUTORY_ALPHANUMERIC_MAX10_FIELDS.has(name)) {
    return stripAlphanumeric(value).toUpperCase().slice(0, 10);
  }
  if (name === "cinLlpin") {
    return stripAlphanumeric(value).toUpperCase();
  }
  return value;
}

export function validateOrganizationStatutoryIdentifiers(
  form: Pick<OrganizationFormValues, "pan" | "tan" | "iec">,
): string | null {
  const pan = form.pan.trim().toUpperCase();
  if (pan && !INDIAN_PAN_PATTERN.test(pan)) {
    return "PAN must be 10 characters in the format AAAAA9999A.";
  }

  const tan = form.tan.trim().toUpperCase();
  if (tan && !INDIAN_TAN_PATTERN.test(tan)) {
    return "TAN must be 10 characters in the format AAAA99999A.";
  }

  const iec = form.iec.trim().toUpperCase();
  if (iec && !IEC_PATTERN.test(iec)) {
    return "IEC must be exactly 10 alphanumeric characters.";
  }

  return null;
}

type PincodeOverviewRecord = {
  decision?: string;
  globalMaster?: { pin_city_code?: string } | null;
  tenantPincodeMaster?: { pin_city_code?: string } | null;
  tenantLocalException?: { city_name?: string; state_name?: string } | null;
};

type CityMasterRecord = {
  pin_city_code?: string;
  city_name?: string;
  state_name?: string;
  is_active?: boolean;
};

function buildTenantAuthHeaders(): Record<string, string> | null {
  const tenantId = resolveStoredTenantId();
  const token = resolveStoredAccessToken();
  if (!tenantId || !token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "x-tenant-id": tenantId,
    Accept: "application/json",
  };
}

export type PincodeMasterValidationResult =
  | { ok: true; city?: string; state?: string }
  | { ok: false; error: string };

type PlatformPincodeProjectionPayload = {
  pincode: string;
  countryCode: string | null;
  cityName: string | null;
  districtName: string | null;
  stateUtName: string | null;
  districtCode: string | null;
  stateCode: string | null;
  cityIataCode: string | null;
  nearestAirportIataCode: string | null;
  originTransitHubsNormal: string | null;
  destinationTransitHubsNormal: string | null;
  publishedVersion: string | null;
  status: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type PlatformPincodeLookupResult =
  | {
      ok: true;
      found: true;
      city: string;
      state: string;
      areaLocalities: string[];
      district: string;
      districtName?: string;
      talukaName?: string;
      countryName?: string;
      districtCode?: string;
      stateCode?: string;
      cityIataCode?: string;
      nearestAirportIataCode?: string;
      originTransitHubsNormal?: string;
      destinationTransitHubsNormal?: string;
      publishedVersion?: string;
      projectionStatus?: string;
      countryCode?: string;
      /** Full tenant-safe projection when available from Courier API. */
      projection?: PlatformPincodeProjectionPayload | null;
    }
  | { ok: true; found: false; areaLocalities: string[]; reason?: string }
  | { ok: false; error: string; networkError?: boolean };

type PlatformPincodeLookupPayload = {
  pincode?: string;
  found?: boolean;
  cityName?: string;
  stateName?: string;
  stateUtName?: string;
  districtName?: string;
  talukaName?: string;
  countryName?: string;
  areaLocalityNames?: string[];
  districtCode?: string;
  stateCode?: string;
  cityIataCode?: string;
  nearestAirportIataCode?: string;
  originTransitHubsNormal?: string;
  destinationTransitHubsNormal?: string;
  publishedVersion?: string;
  status?: string;
  countryCode?: string;
  reason?: string;
  projection?: PlatformPincodeProjectionPayload | null;
};

export const PINCODE_NOT_FOUND_WARNING =
  "Pincode not found in platform reference. Mark for review ΓÇö national reference data is not created here.";

export const PINCODE_VERIFY_ERROR_WARNING =
  "Unable to verify pincode right now. You can continue, but please confirm the address is correct.";

export function mapFoundPlatformPincodeLookupPayload(
  payload: PlatformPincodeLookupPayload,
  areaLocalities: string[],
): Extract<PlatformPincodeLookupResult, { ok: true; found: true }> {
  const projection = payload.projection ?? null;
  const district = cleanText(projection?.districtName ?? payload.districtName);
  const city = cleanText(projection?.cityName ?? payload.cityName);
  const state = cleanText(projection?.stateUtName ?? payload.stateUtName ?? payload.stateName);
  return {
    ok: true,
    found: true,
    city,
    state,
    areaLocalities,
    district,
    districtName: district || undefined,
    talukaName: cleanText(payload.talukaName) || undefined,
    countryName: cleanText(payload.countryName) || undefined,
    districtCode: cleanText(projection?.districtCode ?? payload.districtCode) || undefined,
    stateCode: cleanText(projection?.stateCode ?? payload.stateCode) || undefined,
    cityIataCode: cleanText(projection?.cityIataCode ?? payload.cityIataCode) || undefined,
    nearestAirportIataCode:
      cleanText(projection?.nearestAirportIataCode ?? payload.nearestAirportIataCode) || undefined,
    originTransitHubsNormal:
      cleanText(projection?.originTransitHubsNormal ?? payload.originTransitHubsNormal) || undefined,
    destinationTransitHubsNormal:
      cleanText(projection?.destinationTransitHubsNormal ?? payload.destinationTransitHubsNormal) ||
      undefined,
    publishedVersion: cleanText(projection?.publishedVersion ?? payload.publishedVersion) || undefined,
    projectionStatus: cleanText(projection?.status ?? payload.status) || undefined,
    countryCode: cleanText(projection?.countryCode ?? payload.countryCode) || undefined,
    projection: projection ?? undefined,
  };
}

function normalizePincodeLookupError(message: string, status: number): string {
  const text = cleanText(message);
  if (/Unknown master/i.test(text)) {
    return PINCODE_VERIFY_ERROR_WARNING;
  }
  if (/Cannot GET \/api\//i.test(text) || status === 404) {
    return PINCODE_VERIFY_ERROR_WARNING;
  }
  if (status === 401 || status === 403 || status >= 500) {
    return PINCODE_VERIFY_ERROR_WARNING;
  }
  return text || PINCODE_VERIFY_ERROR_WARNING;
}

export async function lookupPlatformPincodeForAddress(
  postalCode: string,
): Promise<PlatformPincodeLookupResult> {
  if (!/^[0-9]{6}$/.test(postalCode)) {
    return { ok: false, error: "Pincode must be exactly 6 digits." };
  }

  const headers = buildTenantAuthHeaders();
  if (!headers) {
    return {
      ok: false,
      error: "Sign in again to look up pincode against NEXOS master.",
      networkError: true,
    };
  }

  try {
    // Courier API tenant-safe projection (not Admin API / not SaaS geography-only lookup).
    const lookupUrl = buildApiUrl(
      `/tenant/setup/pincodes/${encodeURIComponent(postalCode)}/reference`,
    );
    const response = await fetch(lookupUrl, { headers, cache: "no-store" });
    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as {
        message?: string;
        errors?: Array<{ message?: string }>;
      } | null;
      const rawMessage =
        errBody?.errors?.[0]?.message ||
        errBody?.message ||
        "Pincode could not be looked up against platform reference.";
      return {
        ok: false,
        error: normalizePincodeLookupError(rawMessage, response.status),
        networkError: response.status >= 500,
      };
    }

    const raw = await response.json();
    const payload =
      unwrapApiBody<PlatformPincodeLookupPayload>(raw) ?? (raw as PlatformPincodeLookupPayload);
    const areaLocalities = Array.isArray(payload?.areaLocalityNames)
      ? payload.areaLocalityNames.map((name) => cleanText(name)).filter(Boolean)
      : [];
    if (!payload?.found) {
      return {
        ok: true,
        found: false,
        areaLocalities,
        reason: cleanText(payload?.reason) || undefined,
      };
    }

    return mapFoundPlatformPincodeLookupPayload(payload, areaLocalities);
  } catch {
    return {
      ok: false,
      error: PINCODE_VERIFY_ERROR_WARNING,
      networkError: true,
    };
  }
}

export async function validatePincodeAgainstMaster(
  postalCode: string,
): Promise<PincodeMasterValidationResult> {
  const headers = buildTenantAuthHeaders();
  if (!headers) {
    return { ok: false, error: "Sign in again to validate pincode against master." };
  }

  try {
    const overviewUrl = buildApiUrl(
      `/masters/pincode-serviceability/overview?postalCode=${encodeURIComponent(postalCode)}`,
    );
    const overviewResponse = await fetch(overviewUrl, { headers, cache: "no-store" });
    if (!overviewResponse.ok) {
      const errBody = await overviewResponse.json().catch(() => null) as {
        message?: string;
        errors?: Array<{ message?: string }>;
      } | null;
      const message =
        errBody?.errors?.[0]?.message ||
        errBody?.message ||
        "Pincode could not be validated against master.";
      return { ok: false, error: message };
    }

    const overviewRaw = await overviewResponse.json();
    const overview = unwrapApiBody<PincodeOverviewRecord>(overviewRaw) ?? (overviewRaw as PincodeOverviewRecord);
    const decision = cleanText(overview?.decision);

    if (decision === "NOT_CONFIGURED" || !decision) {
      return { ok: false, error: "Pincode not found in NEXOS or tenant pincode master." };
    }

    const localException = overview?.tenantLocalException;
    const localCity = cleanText(localException?.city_name);
    const localState = cleanText(localException?.state_name);
    if (localCity || localState) {
      return { ok: true, city: localCity, state: localState };
    }

    const pinCityCode =
      cleanText(overview?.tenantPincodeMaster?.pin_city_code) ||
      cleanText(overview?.globalMaster?.pin_city_code);

    if (pinCityCode) {
      const cityUrl = buildApiUrl(`/masters/city?q=${encodeURIComponent(pinCityCode)}`);
      const cityResponse = await fetch(cityUrl, { headers, cache: "no-store" });
      if (cityResponse.ok) {
        const cityRaw = await cityResponse.json();
        const cities = unwrapApiBody<CityMasterRecord[]>(cityRaw) ?? (cityRaw as CityMasterRecord[]);
        if (Array.isArray(cities)) {
          const match = cities.find(
            (row) => cleanText(row.pin_city_code) === pinCityCode && row.is_active !== false,
          );
          if (match) {
            return {
              ok: true,
              city: cleanText(match.city_name),
              state: cleanText(match.state_name),
            };
          }
        }
      }
    }

    if (decision === "GLOBAL_PINCODE_AVAILABLE" || decision === "TENANT_LOCAL_PINCODE") {
      return { ok: true };
    }

    return { ok: false, error: "Pincode not found in master." };
  } catch {
    return { ok: false, error: "Could not reach pincode master validation. Check your connection and retry." };
  }
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBearerToken(raw: unknown): string {
  const trimmed = cleanText(raw);
  if (!trimmed) return "";
  return trimmed.replace(/^Bearer\s+/i, "").trim();
}

function decodeAuthTokenPayload(token: string): Record<string, unknown> | null {
  const normalized = normalizeBearerToken(token);
  if (!normalized) return null;

  const jwtParts = normalized.split(".");
  if (jwtParts.length === 3) {
    try {
      const base64 = jwtParts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const json = atob(padded);
      const parsed: unknown = JSON.parse(json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* may be bounded HMAC token */
    }
  }

  const dot = normalized.lastIndexOf(".");
  if (dot > 0 && dot < normalized.length - 1) {
    const signature = normalized.slice(dot + 1);
    if (/^[a-fA-F0-9]{64}$/.test(signature)) {
      try {
        const payloadB64 = normalized.slice(0, dot);
        const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const json = atob(padded);
        const parsed: unknown = JSON.parse(json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

function readBosAuthRecord(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("bos_auth");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function tenantBindingFromPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  return cleanText(payload.tenantId) || cleanText(payload.tenantCode);
}

function buildApiUrl(path: string): string {
  const base = resolveWebApiBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/**
 * Canonical access token for SaaS tenant-bound requests.
 * Prefers bos_auth (AuthProvider refresh target) over legacy accessToken key.
 */
export function resolveStoredAccessToken(): string {
  if (typeof window === "undefined") return "";

  const bosAuth = readBosAuthRecord();
  const bosToken = normalizeBearerToken(bosAuth?.accessToken);
  if (bosToken) return bosToken;

  return normalizeBearerToken(resolveAccessToken());
}

/**
 * Tenant code/id used for x-tenant-id and /saas/organization/:tenantId routes.
 * API JWT tenantId claim is user.tenantCode; Organization.tenantId column stores tenant code.
 */
export function resolveStoredTenantId(): string {
  const token = resolveStoredAccessToken();
  const fromToken = tenantBindingFromPayload(decodeAuthTokenPayload(token));
  if (fromToken) return fromToken;

  if (typeof window === "undefined") return "";

  const tenantCode = cleanText(localStorage.getItem("tenantCode"));
  if (tenantCode) return tenantCode;

  const bosAuth = readBosAuthRecord();
  const bosUser =
    bosAuth?.user && typeof bosAuth.user === "object" && !Array.isArray(bosAuth.user)
      ? (bosAuth.user as Record<string, unknown>)
      : null;
  const fromBosUser = cleanText(bosUser?.tenantCode) || cleanText(bosUser?.tenantId);
  if (fromBosUser) return fromBosUser;

  return cleanText(localStorage.getItem("tenantId"));
}

export function resolveStoredUserEmail(): string {
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem("user");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { email?: unknown };
    return typeof parsed.email === "string" ? parsed.email : "";
  } catch {
    return "";
  }
}

export function unwrapApiBody<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(body, "data")) {
    return (body as { data?: T }).data ?? null;
  }
  return body as T;
}

function mapMsmeBand(raw: string | null | undefined): string {
  const value = (raw || "").trim().toUpperCase();
  const aliases: Record<string, string> = {
    MSME_MICRO: "MICRO",
    MSME_SMALL: "SMALL",
    MSME_MEDIUM: "MEDIUM",
    MICRO: "MICRO",
    SMALL: "SMALL",
    MEDIUM: "MEDIUM",
    LARGE: "LARGE",
  };
  return aliases[value] || "";
}

export function createEmptyOrganizationForm(userEmail = ""): OrganizationFormValues {
  return {
    displayName: "",
    legalName: "",
    msmeBand: "SMALL",
    typeOfEntity: "",
    cinLlpin: "",
    pan: "",
    tan: "",
    gstin: "",
    principalBusinessActivityNicCode: "",
    iec: "",
    professionalTaxRegistrationNumber: "",
    registrationNumber: "",
    addressLine1: "",
    addressLine2: "",
    areaLocalityName: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    country: "IN",
    contactEmail: userEmail,
    contactPhone: "",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    currency: "INR",
    language: "en",
    weightUnit: "kg",
    supportEmail: "",
    supportPhone: "",
    logoUrl: "",
    businessTypeCode: "",
  };
}

export function mapOrganizationToForm(
  org: OrganizationBootstrapRecord | null,
  userEmail = ""
): OrganizationFormValues {
  const base = createEmptyOrganizationForm(userEmail);
  if (!org) return base;

  const meta = org.metadata || {};
  const legacyRegistration = metaString(meta, "registrationNumber");
  const cinLlpin =
    metaString(meta, "cinLlpin") ||
    metaString(meta, "cin") ||
    metaString(meta, "llpin") ||
    legacyRegistration;
  const principalBusinessActivityNicCode =
    metaString(meta, "principalBusinessActivityNicCode") ||
    metaString(meta, "nicCode") ||
    metaString(meta, "principalBusinessActivity");
  return {
    ...base,
    legalName: org.legalName || "",
    displayName: org.displayName || "",
    businessTypeCode: org.businessTypeCode || "",
    msmeBand: mapMsmeBand(org.msmeBand) || base.msmeBand,
    typeOfEntity: metaString(meta, "typeOfEntity"),
    cinLlpin,
    pan: metaString(meta, "pan"),
    tan: metaString(meta, "tan"),
    gstin: metaString(meta, "gstin"),
    principalBusinessActivityNicCode,
    iec: metaString(meta, "iec"),
    professionalTaxRegistrationNumber: metaString(meta, "professionalTaxRegistrationNumber"),
    registrationNumber: cinLlpin || legacyRegistration,
    logoUrl: metaString(meta, "logoUrl"),
    timezone: metaString(meta, "timezone") || base.timezone,
    dateFormat: metaString(meta, "dateFormat") || base.dateFormat,
    currency: metaString(meta, "currency") || base.currency,
    addressLine1: metaString(meta, "addressLine1"),
    addressLine2: metaString(meta, "addressLine2"),
    areaLocalityName: metaString(meta, "areaLocalityName"),
    city: metaString(meta, "city"),
    district: metaString(meta, "district") || metaString(meta, "districtName"),
    state: metaString(meta, "state"),
    pincode: metaString(meta, "pincode"),
    country: metaString(meta, "country") || "IN",
    contactEmail: org.contactEmail || metaString(meta, "contactEmail") || userEmail || "",
    contactPhone:
      org.contactPhone || metaString(meta, "phone") || metaString(meta, "contactPhone") || "",
  };
}

export function buildOrganizationMetadata(
  form: Partial<OrganizationFormValues> & Pick<OrganizationFormValues, "legalName" | "displayName">,
): Record<string, unknown> {
  const merged: OrganizationFormValues = { ...createEmptyOrganizationForm(), ...form };
  const cinLlpin = (merged.cinLlpin.trim() || merged.registrationNumber.trim()).toUpperCase();
  const principalBusinessActivityNicCode = merged.principalBusinessActivityNicCode.trim();
  const metadata: Record<string, unknown> = {
    logoUrl: merged.logoUrl.trim(),
    typeOfEntity: merged.typeOfEntity.trim(),
    cinLlpin,
    registrationNumber: cinLlpin,
    pan: merged.pan.trim().toUpperCase(),
    tan: merged.tan.trim().toUpperCase(),
    principalBusinessActivityNicCode,
    nicCode: principalBusinessActivityNicCode,
    principalBusinessActivity: principalBusinessActivityNicCode,
    iec: merged.iec.trim().toUpperCase(),
    timezone: merged.timezone.trim(),
    dateFormat: merged.dateFormat.trim(),
    currency: merged.currency.trim(),
    addressLine1: merged.addressLine1.trim(),
    addressLine2: merged.addressLine2.trim(),
    areaLocalityName: merged.areaLocalityName.trim(),
    city: merged.city.trim(),
    district: merged.district.trim(),
    districtName: merged.district.trim(),
    state: merged.state.trim(),
    pincode: merged.pincode.trim(),
    country: merged.country.trim() || "IN",
    contactEmail: merged.contactEmail.trim(),
    contactPhone: merged.contactPhone.trim(),
    phone: merged.contactPhone.trim(),
  };
  if (merged.gstin.trim()) {
    metadata.gstin = merged.gstin.trim();
  }
  return metadata;
}

export type OrganizationBootstrapResult =
  | { ok: true; org: OrganizationBootstrapRecord; form: OrganizationFormValues }
  | { ok: false; error: string };

export async function fetchOrganizationBootstrap(): Promise<OrganizationBootstrapResult> {
  const tenantId = resolveStoredTenantId();
  const token = resolveStoredAccessToken();
  const userEmail = resolveStoredUserEmail();

  if (!tenantId || !token) {
    return { ok: false, error: "Sign in again to load your Organization Profile." };
  }

  try {
    const response = await fetch(buildApiUrl(`/saas/organization/${encodeURIComponent(tenantId)}`), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-tenant-id": tenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null) as {
        message?: string;
        errors?: Array<{ message?: string }>;
      } | null;
      const message =
        errBody?.errors?.[0]?.message ||
        errBody?.message ||
        `Organization Profile could not be loaded (${response.status}).`;
      return { ok: false, error: message };
    }

    const raw = await response.json();
    const org = unwrapApiBody<OrganizationBootstrapRecord>(raw);
    if (!org) {
      return { ok: false, error: "Organization Profile response was empty." };
    }

    return { ok: true, org, form: mapOrganizationToForm(org, userEmail) };
  } catch {
    return { ok: false, error: "Could not reach the API. Check your connection and retry." };
  }
}
