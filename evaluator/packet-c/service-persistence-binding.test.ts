import test from 'node:test';
import assert from 'node:assert/strict';
import { createBakeoffFixtureStore, createBakeoffService } from '../support/bakeoff-service-fixture.ts';
import { evaluateProvisionalDimensions } from '../../api/src/common/bakeoff/dimension-quality-gate.ts';

test('submitProvisional invokes measurement, audit, and domain persistence', async () => {
  const store = createBakeoffFixtureStore({
    packagesByTenantId: {
      'TENANT_A_QA:p-a': { id: 'p-a', packageBarcode: 'PKG-A-001', shipmentInternalId: 's-a' },
    },
  });
  const svc = createBakeoffService(store);
  await svc.submitProvisional('TENANT_A_QA', 'actor-a', 'p-a', {
    length: 12,
    width: 13,
    height: 14,
    confidence: 0.91,
    correlationId: 'corr-test-1',
  });
  assert.ok(store.prismaCalls.includes('packageDimensionCapture.create'));
  assert.ok(store.prismaCalls.includes('shipmentAuditEvent.create'));
  assert.ok(store.prismaCalls.includes('domainEventRecord.create'));
});

test('registerEvidence invokes proof artifact persistence', async () => {
  const store = createBakeoffFixtureStore();
  const svc = createBakeoffService(store);
  await svc.registerEvidence('TENANT_A_QA', 'actor-a', { entityId: 'meas-1', storageKey: 'local://x' });
  assert.ok(store.prismaCalls.includes('proofArtifact.create'));
});

test('AUTO_ACCEPT, RESCAN, MANUAL_FALLBACK via supplied gate + service path', async () => {
  const auto = evaluateProvisionalDimensions({ length: 10, width: 10, height: 10, confidence: 0.9 });
  const rescan = evaluateProvisionalDimensions({ length: 10, width: 10, height: 10, confidence: 0.6 });
  const manual = evaluateProvisionalDimensions({ length: 10, width: 10, height: 10, confidence: 0.1 });
  assert.equal(auto.decision, 'AUTO_ACCEPT');
  assert.equal(rescan.decision, 'RESCAN');
  assert.equal(manual.decision, 'MANUAL_FALLBACK');
  assert.equal(auto.billingEligible, false);
  assert.equal(rescan.billingEligible, false);
  assert.equal(manual.billingEligible, false);
});
