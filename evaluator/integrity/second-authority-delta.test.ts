import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDependencyBaseline, scanAuthorityDelta } from './second-authority-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('current bakeoff authority delta is clean against its own baseline', () => {
  const baseline = buildDependencyBaseline(ROOT);
  const result = scanAuthorityDelta(baseline, ROOT);
  assert.equal(result.code, 'AUTHORITY_DELTA_CLEAN');
});

test('known prohibited and unknown authority dependencies classify explicitly', async () => {
  const { classifyAddedDependency } = await import('./second-authority-scan.mjs');
  assert.equal(classifyAddedDependency('mysql2').code, 'PROHIBITED_DB_CLIENT');
  assert.equal(classifyAddedDependency('@clerk/backend').code, 'PROHIBITED_AUTH_PROVIDER');
  assert.equal(classifyAddedDependency('acme-vendor-backend-sdk').code, 'REVIEW_REQUIRED_AUTHORITY_DELTA');
  assert.equal(classifyAddedDependency('acme-vendor-backend-sdk').classification, 'REVIEW_REQUIRED');
});
