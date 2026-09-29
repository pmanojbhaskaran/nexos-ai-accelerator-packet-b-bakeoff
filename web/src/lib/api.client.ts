import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export function tenantHeaders(tenantId: string, extra?: Record<string, string>) {
  return {
    "x-tenant-id": tenantId,
    "x-correlation-id": extra?.["x-correlation-id"] ?? `corr_web_${Date.now()}`,
    "x-actor-id": extra?.["x-actor-id"] ?? "web",
    ...(extra ?? {}),
  };
}
