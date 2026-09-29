import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePacketAResponse } from './packet-a-binding.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = path.dirname(fileURLToPath(import.meta.url));

test('PACKET_A valid candidate response is accepted', () => {
  const result = validatePacketAResponse(ROOT, path.join(here, 'fixtures/packet-a-candidate-response.json'));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'PACKET_A_VALID');
});

test('PACKET_A missing response fails', () => {
  const result = validatePacketAResponse(ROOT, '');
  assert.equal(result.code, 'PACKET_A_RESPONSE_MISSING');
});

test('PACKET_A bundled sample is not authoritative', () => {
  const result = validatePacketAResponse(ROOT, path.join(here, 'sample-packet-a-response.json'));
  assert.equal(result.code, 'PACKET_A_SAMPLE_NOT_AUTHORITATIVE');
});

test('PACKET_A bad evidence path fails', () => {
  const result = validatePacketAResponse(ROOT, path.join(here, 'fixtures/packet-a-bad-path.json'));
  assert.equal(result.code, 'PACKET_A_EVIDENCE_PATH_MISSING');
});
