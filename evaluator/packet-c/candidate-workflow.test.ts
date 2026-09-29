import test from 'node:test';
import assert from 'node:assert/strict';
import { runPacketCCandidateWorkflow, diagnosePacketCExecution } from '../../mobile/mobile-app/src/lib/bakeoff/packet-c-candidate-workflow.ts';
import {
  getBakeoffCameraAdapterInvocationCount,
  resetBakeoffCameraAdapter,
} from '../../mobile/mobile-app/src/lib/bakeoff/camera-dimension-adapter.ts';
import { dimensionsMateriallyEqual } from '../../api/src/common/bakeoff/dimension-quality-gate.ts';

test('candidate workflow invokes camera then API submission for two captures', async () => {
  resetBakeoffCameraAdapter();
  const submissions: string[] = [];
  const first = await runPacketCCandidateWorkflow({
    packageBarcode: 'PKG-A-001',
    frameToken: 'CAPTURE_INPUT_1',
    confidence: 0.92,
    submit: async (payload) => {
      submissions.push(payload.packageBarcode);
      return { accepted: true, measurementId: 'm1' };
    },
  });
  const second = await runPacketCCandidateWorkflow({
    packageBarcode: 'PKG-B-001',
    frameToken: 'CAPTURE_INPUT_2',
    confidence: 0.6,
    submit: async (payload) => {
      submissions.push(payload.packageBarcode);
      return { accepted: true, measurementId: 'm2' };
    },
  });
  assert.equal(getBakeoffCameraAdapterInvocationCount(), 2);
  assert.deepEqual(submissions, ['PKG-A-001', 'PKG-B-001']);
  assert.equal(dimensionsMateriallyEqual(first.capture, second.capture), false);
  assert.equal(first.gate.decision, 'AUTO_ACCEPT');
  assert.equal(second.gate.decision, 'RESCAN');
  assert.equal(first.billingEligible, false);
});

test('MANUAL_FALLBACK through candidate workflow', async () => {
  resetBakeoffCameraAdapter();
  const result = await runPacketCCandidateWorkflow({
    packageBarcode: 'PKG-A-001',
    frameToken: 'CAPTURE_INPUT_LOW',
    confidence: 0.1,
    submit: async () => ({ accepted: true }),
  });
  assert.equal(result.gate.decision, 'MANUAL_FALLBACK');
  assert.equal(result.billingEligible, false);
});

test('CAMERA_BYPASS, API_BYPASS, and HARDCODED diagnostics', () => {
  assert.equal(diagnosePacketCExecution({ cameraCallsBefore: 0, cameraCallsAfter: 0, submitted: true, capturesEqual: false }).code, 'CAMERA_BYPASS');
  assert.equal(diagnosePacketCExecution({ cameraCallsBefore: 0, cameraCallsAfter: 1, submitted: false, capturesEqual: false }).code, 'API_SUBMISSION_BYPASS');
  assert.equal(diagnosePacketCExecution({ cameraCallsBefore: 0, cameraCallsAfter: 2, submitted: true, capturesEqual: true }).code, 'HARDCODED_DIMENSIONS');
});
