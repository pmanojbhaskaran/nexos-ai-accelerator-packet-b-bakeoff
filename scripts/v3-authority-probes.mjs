import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyAddedDependency, scanAuthorityDelta } from '../evaluator/integrity/second-authority-scan.mjs';

const expected = [
  ['mysql2', 'PROHIBITED_DB_CLIENT'],
  ['mongodb', 'PROHIBITED_DB_CLIENT'],
  ['better-sqlite3', 'PROHIBITED_DB_CLIENT'],
  ['@clerk/backend', 'PROHIBITED_AUTH_PROVIDER'],
  ['@azure/cosmos', 'PROHIBITED_CLOUD_BACKEND'],
  ['@google-cloud/firestore', 'PROHIBITED_CLOUD_BACKEND'],
  ['acme-vendor-backend-sdk', 'REVIEW_REQUIRED_AUTHORITY_DELTA'],
  ['openai', 'PROHIBITED_AI_RUNTIME'],
];

const results = [];
let wrong = 0;
for (const [name, code] of expected) {
  let finding;
  try {
    finding = classifyAddedDependency(name);
  } catch (error) {
    results.push({ name, expected: code, actual: 'SCAN_RUNTIME_FAILURE', message: String(error?.code || error?.message) });
    wrong += 1;
    continue;
  }
  const ok = finding.code === code && finding.classification !== 'ALLOWED';
  if (!ok) wrong += 1;
  results.push({ name, expected: code, actual: finding.code, classification: finding.classification, ok });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexos-auth-'));
for (const rel of ['api/package.json', 'web/package.json', 'mobile/mobile-app/package.json', 'shared/package.json', 'package.json']) {
  fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp, rel), '{"dependencies":{}}\n');
}
fs.mkdirSync(path.join(tmp, 'api/prisma'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'api/src/modules'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'api/prisma/schema.prisma'), 'datasource db { provider = "mysql" url = env("DATABASE_URL") }\n');
fs.writeFileSync(path.join(tmp, 'api/src/modules/parallel-api.controller.ts'), 'export class ParallelApiController {}\n');
fs.writeFileSync(path.join(tmp, 'api/src/modules/endpoint.ts'), 'export const url = "https://api.openai.com/v1";\n');
const structural = scanAuthorityDelta({ dependencies: { root: [], api: [], web: [], mobile: [], shared: [] }, prismaSchemaSha256: '0'.repeat(64) }, tmp);
const codes = new Set(structural.findings.map((f) => f.code));
for (const code of ['NEW_PRISMA_AUTHORITY', 'PARALLEL_API_ROUTE', 'NEW_AI_OR_EXTERNAL_ENDPOINT']) {
  const ok = codes.has(code);
  if (!ok) wrong += 1;
  results.push({ name: code, expected: code, actual: ok ? code : 'MISSING', ok });
}
fs.rmSync(tmp, { recursive: true, force: true });

const summary = { EXPECTED_DIAGNOSTIC_MATCH: wrong === 0 ? 'YES' : 'NO', GENERIC_CRASH_COUNTED_AS_DETECTION: 'NO', wrong, results };
console.log(JSON.stringify(summary, null, 2));
process.exit(wrong === 0 ? 0 : 1);
