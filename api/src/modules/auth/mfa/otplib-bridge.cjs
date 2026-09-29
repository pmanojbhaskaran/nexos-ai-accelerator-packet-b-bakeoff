/**
 * CommonJS TOTP bridge compatible with the otplib v13 functional surface used by MfaService.
 * Implements RFC 6238 (TOTP) + RFC 4648 (Base32) with Node crypto so Jest never loads
 * otplib's ESM-only @scure dependency graph.
 */
const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buf) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(secret) {
  const cleaned = String(secret || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter, digits = 6) {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const str = String(code % 10 ** digits);
  return str.padStart(digits, "0");
}

function totp(secret, options = {}) {
  const period = options.period ?? 30;
  const digits = options.digits ?? 6;
  const epoch = options.epoch ?? Date.now();
  const counter = Math.floor(epoch / 1000 / period);
  return hotp(decodeBase32(secret), counter, digits);
}

async function generateSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

function generateURI({ secret, label, issuer }) {
  const pathLabel = issuer ? `${issuer}:${label}` : String(label);
  const params = new URLSearchParams({
    secret: String(secret),
    issuer: String(issuer || ""),
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(pathLabel)}?${params.toString()}`;
}

async function generate({ secret }) {
  return totp(secret);
}

async function verify({ token, secret, window = 1 }) {
  const expected = String(token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(expected)) return { valid: false };
  const period = 30;
  const now = Date.now();
  for (let w = -window; w <= window; w++) {
    const candidate = totp(secret, { epoch: now + w * period * 1000, period });
    if (candidate === expected) return { valid: true };
  }
  return { valid: false };
}

module.exports = {
  generate,
  generateSecret,
  generateURI,
  verify,
};
