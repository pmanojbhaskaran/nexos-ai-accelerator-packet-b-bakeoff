import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExitabilityProcedure, harnessFixtureReport } from './exitability-procedure.mjs';

test('PACKET_E harness structure is complete and candidate execution is not yet applicable', () => {
  const result = evaluateExitabilityProcedure(harnessFixtureReport());
  assert.equal(result.code, 'PACKET_E_HARNESS_READY');
});

test('PACKET_E missing required gate fails', () => {
  const report = harnessFixtureReport();
  delete report.steps.INDEPENDENT_CONTINUATION;
  const result = evaluateExitabilityProcedure(report);
  assert.equal(result.code, 'PACKET_E_GATE_MISSING');
});
