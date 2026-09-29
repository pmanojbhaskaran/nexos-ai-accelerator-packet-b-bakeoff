import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = [
  'TARGET_AUTHORITY',
  'LEGACY_SHIPMENT_DIMENSION_MEANING',
  'DUPLICATE_CONCEPT_CHECK',
  'CONTRACT_IMPACT',
  'IMPLEMENTATION_IMPACT',
  'AFFECTED_TESTS',
  'MIGRATION_IMPLICATIONS',
  'AUDIT_HISTORY_PRESERVATION',
  'ORIGINAL_EVIDENCE_PRESERVATION',
  'COMMERCIAL_TRUTH_IMPACT',
  'BILLING_TRUTH_PROTECTION',
  'ROLLBACK_OR_CORRECTION_CONSIDERATIONS',
];

export function validatePacketDArtifact(candidateRoot, artifactPath) {
  if (!artifactPath) return { ok: false, code: 'PACKET_D_ARTIFACT_MISSING' };
  const resolved = path.resolve(artifactPath);
  if (path.basename(resolved) === 'sample-packet-d-migration-impact.json') {
    return { ok: false, code: 'PACKET_D_SAMPLE_NOT_AUTHORITATIVE' };
  }
  if (!fs.existsSync(resolved)) return { ok: false, code: 'PACKET_D_ARTIFACT_MISSING' };
  const doc = JSON.parse(fs.readFileSync(resolved, 'utf8').replace(/^\uFEFF/, ''));
  for (const key of REQUIRED) {
    if (doc[key] === undefined || String(doc[key]).trim() === '') {
      return { ok: false, code: 'PACKET_D_FIELD_MISSING', field: key };
    }
  }
  if (doc.TARGET_AUTHORITY !== 'PHYSICAL_PACKAGE') {
    return { ok: false, code: 'PACKET_D_BAD_AUTHORITY' };
  }
  const impl = doc.IMPLEMENTATION_IMPACT_PATHS || [];
  for (const rel of impl) {
    if (!fs.existsSync(path.join(candidateRoot, rel))) {
      return { ok: false, code: 'PACKET_D_PATH_MISSING', path: rel };
    }
  }
  if (!Array.isArray(doc.AFFECTED_TESTS) || doc.AFFECTED_TESTS.length === 0) {
    return { ok: false, code: 'PACKET_D_MISSING_TESTS' };
  }
  for (const rel of doc.AFFECTED_TESTS) {
    if (!fs.existsSync(path.join(candidateRoot, rel))) {
      return { ok: false, code: 'PACKET_D_MISSING_TESTS', path: rel };
    }
  }
  if (/duplicate competing dimension authority|second dimension concept/i.test(String(doc.DUPLICATE_CONCEPT_CHECK)) && /proposed|introduced|yes/i.test(String(doc.DUPLICATE_CONCEPT_CHECK))) {
    return { ok: false, code: 'PACKET_D_DUPLICATE_AUTHORITY' };
  }
  if (/billingEligible\s*[:=]\s*true|silently alter billing/i.test(JSON.stringify(doc))) {
    return { ok: false, code: 'PACKET_D_BILLING_TRUTH_VIOLATION' };
  }
  if (!/billingEligible|false|not silently/i.test(String(doc.BILLING_TRUTH_PROTECTION))) {
    return { ok: false, code: 'PACKET_D_BILLING_TRUTH_VIOLATION' };
  }
  return { ok: true, code: 'PACKET_D_VALID' };
}
