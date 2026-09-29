import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensionsMateriallyEqual } from '../../api/src/common/bakeoff/dimension-quality-gate.ts';

export function assertNonConstantCaptureOutputs(
  a: { length: number; width: number; height: number },
  b: { length: number; width: number; height: number },
): void {
  if (dimensionsMateriallyEqual(a, b)) {
    throw new Error('HARDCODED_DIMENSION_DETECTED');
  }
}

test('HARDCODED_DIMENSION_DETECTED when outputs ignore capture inputs', () => {
  const hardcodedA = { length: 99, width: 99, height: 99 };
  const hardcodedB = { length: 99, width: 99, height: 99 };
  assert.throws(() => assertNonConstantCaptureOutputs(hardcodedA, hardcodedB), /HARDCODED_DIMENSION_DETECTED/);
});
