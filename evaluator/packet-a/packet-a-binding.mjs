import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REQUIRED = [
  'API_BOUNDARY',
  'WEB_BOUNDARY',
  'MOBILE_BOUNDARY',
  'SHARED_BOUNDARY',
  'BACKEND_AUTHORITY',
  'TENANT_AUTHORITY',
  'AUTH_RBAC_AUTHORITY',
  'DATABASE_AUTHORITY',
  'AUDIT_EVENT_AUTHORITY',
  'OFFLINE_ARCHITECTURE',
  'BAKEOFF_ONLY_OBJECTS',
  'MINIMUM_CHANGE_SURFACE',
  'AFFECTED_TESTS',
  'ARCHITECTURAL_RISKS',
];

export function validatePacketAResponse(candidateRoot, responsePath) {
  if (!responsePath) {
    return { ok: false, code: 'PACKET_A_RESPONSE_MISSING' };
  }
  const resolved = path.resolve(responsePath);
  if (path.basename(resolved) === 'sample-packet-a-response.json') {
    return { ok: false, code: 'PACKET_A_SAMPLE_NOT_AUTHORITATIVE' };
  }
  if (!fs.existsSync(resolved)) {
    return { ok: false, code: 'PACKET_A_RESPONSE_MISSING' };
  }
  const response = JSON.parse(fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, ''));
  for (const key of REQUIRED) {
    const v = response[key];
    if (!v?.claim || !Array.isArray(v.evidence_paths) || v.evidence_paths.length === 0 || !v.reason) {
      return { ok: false, code: 'PACKET_A_SCHEMA_INVALID', field: key };
    }
    for (const rel of v.evidence_paths) {
      if (rel.includes('..') || path.isAbsolute(rel)) {
        return { ok: false, code: 'PACKET_A_EVIDENCE_OUT_OF_BOUNDS', path: rel };
      }
      const full = path.join(candidateRoot, rel);
      if (!full.startsWith(path.resolve(candidateRoot))) {
        return { ok: false, code: 'PACKET_A_EVIDENCE_OUT_OF_BOUNDS', path: rel };
      }
      if (!fs.existsSync(full)) {
        return { ok: false, code: 'PACKET_A_EVIDENCE_PATH_MISSING', path: rel };
      }
    }
  }
  const bakeoff = JSON.stringify(response.BAKEOFF_ONLY_OBJECTS);
  if (!/BAKEOFF_ONLY|bakeoff/i.test(bakeoff)) {
    return { ok: false, code: 'PACKET_A_BAKEOFF_ONLY_MISREPRESENTED' };
  }
  if (/production migration authority|live nexos production schema/i.test(bakeoff)) {
    return { ok: false, code: 'PACKET_A_BAKEOFF_ONLY_MISREPRESENTED' };
  }
  return { ok: true, code: 'PACKET_A_VALID' };
}

export function assertPacketAZeroMutation(candidateRoot, distributionBaseline, allowedExtraPaths = []) {
  const baseline = JSON.parse(fs.readFileSync(distributionBaseline, 'utf8'));
  const allowed = new Set(allowedExtraPaths.map((p) => p.replace(/\\/g, '/')));
  const mismatches = [];
  for (const row of baseline.files || []) {
    const rel = row.relative_path || row.RELATIVE_PATH;
    if (!rel || allowed.has(rel)) continue;
    const full = path.join(candidateRoot, rel);
    if (!fs.existsSync(full)) {
      mismatches.push({ path: rel, code: 'PACKET_A_SOURCE_MISSING' });
      continue;
    }
    const sha = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').toUpperCase();
    const expected = row.sha256 || row.SHA256;
    if (sha !== expected) mismatches.push({ path: rel, code: 'PACKET_A_SOURCE_MUTATION' });
  }
  if (mismatches.length) return { ok: false, code: 'PACKET_A_SOURCE_MUTATION', mismatches };
  return { ok: true, code: 'PACKET_A_ZERO_MUTATION' };
}
