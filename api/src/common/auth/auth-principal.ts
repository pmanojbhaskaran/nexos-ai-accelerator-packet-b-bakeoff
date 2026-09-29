import { createHmac } from "node:crypto";

export interface AuthPrincipal {
  readonly sub: string;
  readonly tenantId: string;
}

function b64urlToUtf8(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  return Buffer.from(padded, "base64").toString("utf8");
}

function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Bounded SEC-IMP-001 token format:
 * Authorization: Bearer <base64url(jsonPayload)>.<hexHmacSignature>
 * payload JSON: { "sub": "...", "tenantId": "TENANT_X" }
 */
export function parseBoundAuthPrincipal(authHeader: string | undefined, secret: string): AuthPrincipal | null {
  if (!authHeader) return null;
  const raw = String(authHeader).trim();
  if (!raw.startsWith("Bearer ")) return null;
  const token = raw.slice("Bearer ".length).trim();
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const signatureHex = token.slice(dot + 1);
  if (!/^[a-fA-F0-9]{64}$/.test(signatureHex)) return null;
  const expected = hmacSha256Hex(secret, payloadB64);
  if (signatureHex.toLowerCase() !== expected.toLowerCase()) return null;
  let payload: any;
  try {
    payload = JSON.parse(b64urlToUtf8(payloadB64));
  } catch {
    return null;
  }
  const sub = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  const tenantId = typeof payload?.tenantId === "string" ? payload.tenantId.trim() : "";
  if (!sub || !tenantId) return null;
  return { sub, tenantId };
}
