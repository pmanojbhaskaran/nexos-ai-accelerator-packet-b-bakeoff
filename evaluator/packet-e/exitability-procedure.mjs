import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STEPS = [
  'FRESH_COPY',
  'DEPENDENCY_SETUP',
  'LOCKFILE',
  'BUILD',
  'TYPECHECK',
  'TESTS',
  'EVALUATOR',
  'RUNTIME_DEPENDENCIES',
  'DATABASE_DEPENDENCIES',
  'AUTH_DEPENDENCIES',
  'NETWORK_ENDPOINTS',
  'VENDOR_METADATA',
  'METADATA_REMOVAL',
  'POST_REMOVAL_REGRESSION',
  'INDEPENDENT_CONTINUATION',
  'NO_VENDOR_RUNTIME',
];

export function evaluateExitabilityProcedure(report) {
  const missing = STEPS.filter((step) => !report?.steps?.[step]);
  if (missing.length) return { ok: false, code: 'PACKET_E_GATE_MISSING', missing };
  for (const step of STEPS) {
    const status = report.steps[step].status;
    if (!['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(status)) {
      return { ok: false, code: 'PACKET_E_BAD_STATUS', step };
    }
    if (status === 'NOT_APPLICABLE' && !report.steps[step].reason) {
      return { ok: false, code: 'PACKET_E_NA_WITHOUT_REASON', step };
    }
  }
  if (report.candidateExecution !== 'NOT_YET_APPLICABLE') {
    return { ok: false, code: 'PACKET_E_CANDIDATE_EXECUTION_REQUIRED' };
  }
  return { ok: true, code: 'PACKET_E_HARNESS_READY' };
}

export function harnessFixtureReport() {
  const steps = {};
  for (const step of STEPS) steps[step] = { status: 'NOT_APPLICABLE', reason: 'REAL_CANDIDATE_EXECUTION=NOT_YET_APPLICABLE' };
  steps.LOCKFILE.status = 'PASS';
  steps.LOCKFILE.reason = 'lockfiles present in bakeoff distribution';
  return { candidateExecution: 'NOT_YET_APPLICABLE', steps };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = evaluateExitabilityProcedure(harnessFixtureReport());
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}
