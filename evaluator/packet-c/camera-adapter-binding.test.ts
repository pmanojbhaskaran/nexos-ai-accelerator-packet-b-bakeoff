import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureProvisionalDimensionsViaCamera,
  getBakeoffCameraAdapterInvocationCount,
  resetBakeoffCameraAdapter,
} from '../../mobile/mobile-app/src/lib/bakeoff/camera-dimension-adapter.ts';
import { dimensionsMateriallyEqual } from '../../api/src/common/bakeoff/dimension-quality-gate.ts';

test('CAMERA_ADAPTER_CALLED with CAPTURE_INPUT_1 and CAPTURE_INPUT_2', async () => {
  resetBakeoffCameraAdapter();
  const a = await captureProvisionalDimensionsViaCamera({ packageBarcode: 'PKG-A-001', frameToken: 'CAPTURE_INPUT_1' });
  const b = await captureProvisionalDimensionsViaCamera({ packageBarcode: 'PKG-B-001', frameToken: 'CAPTURE_INPUT_2' });
  assert.equal(getBakeoffCameraAdapterInvocationCount(), 2);
  assert.equal(a.packageBarcode, 'PKG-A-001');
  assert.equal(b.packageBarcode, 'PKG-B-001');
  assert.equal(dimensionsMateriallyEqual(a, b), false);
});

