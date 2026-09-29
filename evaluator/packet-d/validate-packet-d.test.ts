import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePacketDArtifact } from './packet-d-binding.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = path.dirname(fileURLToPath(import.meta.url));

test('PACKET_D candidate artifact accepted', () => {
  const result = validatePacketDArtifact(ROOT, path.join(here, 'fixtures/packet-d-candidate.json'));
  assert.equal(result.code, 'PACKET_D_VALID');
});

test('PACKET_D sample is not authoritative', () => {
  const result = validatePacketDArtifact(ROOT, path.join(here, 'sample-packet-d-migration-impact.json'));
  assert.equal(result.code, 'PACKET_D_SAMPLE_NOT_AUTHORITATIVE');
});

test('PACKET_D missing artifact fails', () => {
  assert.equal(validatePacketDArtifact(ROOT, '').code, 'PACKET_D_ARTIFACT_MISSING');
});
