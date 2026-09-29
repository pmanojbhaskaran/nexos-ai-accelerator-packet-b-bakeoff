import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dimensionsMateriallyEqual,
  evaluateProvisionalDimensions,
} from '../../api/src/common/bakeoff/dimension-quality-gate.ts';

test('AUTO_ACCEPT path executable under high confidence', () => {
  const r = evaluateProvisionalDimensions({ length: 10, width: 20, height: 30, confidence: 0.9 });
  assert.equal(r.decision, 'AUTO_ACCEPT');
  assert.equal(r.billingEligible, false);
});

test('RESCAN path executable under medium confidence', () => {
  const r = evaluateProvisionalDimensions({ length: 10, width: 20, height: 30, confidence: 0.6 });
  assert.equal(r.decision, 'RESCAN');
});

test('MANUAL_FALLBACK path executable under low confidence', () => {
  const r = evaluateProvisionalDimensions({ length: 10, width: 20, height: 30, confidence: 0.2 });
  assert.equal(r.decision, 'MANUAL_FALLBACK');
});

test('non-constant inputs must not always collapse to identical dimensions', () => {
  const a = { length: 10, width: 20, height: 30 };
  const b = { length: 11, width: 21, height: 31 };
  assert.equal(dimensionsMateriallyEqual(a, b), false);
});

test('billing truth protection — provisional gate never sets billingEligible true', () => {
  const r = evaluateProvisionalDimensions({ length: 100, width: 100, height: 100, confidence: 0.99 });
  assert.equal(r.billingEligible, false);
});
