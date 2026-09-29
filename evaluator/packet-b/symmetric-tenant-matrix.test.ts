import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedBakeoffContext } from '../../api/src/common/bakeoff/authenticated-context.ts';
import {
  createBakeoffFixtureStore,
  createBakeoffService,
  packageNotFoundMessage,
  errorCode,
} from '../support/bakeoff-service-fixture.ts';

const TENANT_A = 'TENANT_A_QA';
const TENANT_B = 'TENANT_B_QA';
const PKG_A = 'PKG-A-001';
const PKG_B = 'PKG-B-001';

function baseStore() {
  return createBakeoffFixtureStore({
    packagesByTenantBarcode: {
      [`${TENANT_A}:${PKG_A}`]: { id: 'p-a', packageBarcode: PKG_A, shipmentInternalId: 'ship-a' },
      [`${TENANT_B}:${PKG_B}`]: { id: 'p-b', packageBarcode: PKG_B, shipmentInternalId: 'ship-b' },
    },
    packagesByTenantId: {
      [`${TENANT_A}:p-a`]: { id: 'p-a', packageBarcode: PKG_A, shipmentInternalId: 'ship-a' },
      [`${TENANT_B}:p-b`]: { id: 'p-b', packageBarcode: PKG_B, shipmentInternalId: 'ship-b' },
    },
  });
}

test('A_READ_A=ALLOW', async () => {
  const svc = createBakeoffService(baseStore());
  const r = await svc.resolvePackage(TENANT_A, PKG_A, 'actor-a');
  assert.equal(r.packageId, 'p-a');
});

test('A_MUTATE_A=ALLOW_WHEN_AUTHORIZED', async () => {
  const store = baseStore();
  const svc = createBakeoffService(store);
  const r = await svc.submitProvisional(TENANT_A, 'actor-a', 'p-a', {
    length: 10,
    width: 11,
    height: 12,
    confidence: 0.9,
  });
  assert.equal(r.billingEligible, false);
  assert.ok(store.prismaCalls.includes('packageDimensionCapture.create'));
});

test('A_READ_B=DENY', async () => {
  const svc = createBakeoffService(baseStore());
  await assert.rejects(() => svc.resolvePackage(TENANT_A, PKG_B, 'actor-a'), (err) => {
    assert.equal(packageNotFoundMessage(err), 'PACKAGE_NOT_FOUND');
    return true;
  });
});

test('A_MUTATE_B=DENY', async () => {
  const svc = createBakeoffService(baseStore());
  await assert.rejects(
    () => svc.submitProvisional(TENANT_A, 'actor-a', 'p-b', { length: 1, width: 1, height: 1 }),
    (err) => {
      assert.equal(packageNotFoundMessage(err), 'PACKAGE_NOT_FOUND');
      return true;
    },
  );
});

test('B_READ_B=ALLOW', async () => {
  const svc = createBakeoffService(baseStore());
  const r = await svc.resolvePackage(TENANT_B, PKG_B, 'actor-b');
  assert.equal(r.packageId, 'p-b');
});

test('B_MUTATE_B=ALLOW_WHEN_AUTHORIZED', async () => {
  const store = baseStore();
  const svc = createBakeoffService(store);
  await svc.submitProvisional(TENANT_B, 'actor-b', 'p-b', { length: 5, width: 6, height: 7, confidence: 0.88 });
  assert.ok(store.prismaCalls.includes('shipmentAuditEvent.create'));
});

test('B_READ_A=DENY', async () => {
  const svc = createBakeoffService(baseStore());
  await assert.rejects(() => svc.resolvePackage(TENANT_B, PKG_A, 'actor-b'), (err) => {
    assert.equal(packageNotFoundMessage(err), 'PACKAGE_NOT_FOUND');
    return true;
  });
});

test('B_MUTATE_A=DENY', async () => {
  const svc = createBakeoffService(baseStore());
  await assert.rejects(
    () => svc.submitProvisional(TENANT_B, 'actor-b', 'p-a', { length: 1, width: 2, height: 3 }),
    (err) => {
      assert.equal(packageNotFoundMessage(err), 'PACKAGE_NOT_FOUND');
      return true;
    },
  );
});

test('UNAUTHENTICATED_REQUEST=DENY', () => {
  assert.throws(
    () => resolveAuthenticatedBakeoffContext({ headers: { 'x-tenant-id': TENANT_A } }),
    (err: unknown) => {
      const e = err as { getResponse?: () => { code?: string } };
      assert.equal(e.getResponse?.()?.code, 'AUTH_REQUIRED');
      return true;
    },
  );
});

test('TENANT_A_WITHOUT_REQUIRED_CAPABILITY=DENY', async () => {
  const store = baseStore();
  store.capabilityEnabled[TENANT_A] = false;
  const svc = createBakeoffService(store);
  await assert.rejects(() => svc.resolvePackage(TENANT_A, PKG_A, 'actor-a'), (err) => {
    assert.equal(errorCode(err), 'CAPABILITY_NOT_ENABLED');
    return true;
  });
});

test('TENANT_B_WITHOUT_REQUIRED_CAPABILITY=DENY', async () => {
  const store = baseStore();
  store.capabilityEnabled[TENANT_B] = false;
  const svc = createBakeoffService(store);
  await assert.rejects(() => svc.submitProvisional(TENANT_B, 'actor-b', 'p-b', { length: 1, width: 1, height: 1 }), (err) => {
    assert.equal(errorCode(err), 'CAPABILITY_NOT_ENABLED');
    return true;
  });
});

test('SPOOFED_TENANT_HEADER=DENY', () => {
  assert.throws(
    () =>
      resolveAuthenticatedBakeoffContext({
        user: { userId: 'u1', tenantCode: TENANT_A },
        headers: { 'x-tenant-id': TENANT_B },
      }),
    (err: unknown) => {
      const e = err as { getResponse?: () => { code?: string } };
      assert.equal(e.getResponse?.()?.code, 'TENANT_CONTEXT_MISMATCH');
      return true;
    },
  );
});

test('SPOOFED_ACTOR_HEADER=DENY', () => {
  assert.throws(
    () =>
      resolveAuthenticatedBakeoffContext({
        user: { userId: 'u1', tenantCode: TENANT_A },
        headers: { 'x-actor-id': 'attacker' },
      }),
    (err: unknown) => {
      const e = err as { getResponse?: () => { code?: string } };
      assert.equal(e.getResponse?.()?.code, 'ACTOR_CONTEXT_MISMATCH');
      return true;
    },
  );
});

test('NONDISCLOSURE: foreign-tenant vs nonexistent resource equivalent denial', async () => {
  const svc = createBakeoffService(baseStore());
  let foreignMsg = '';
  let missingMsg = '';
  try {
    await svc.resolvePackage(TENANT_B, PKG_A, 'actor-b');
  } catch (e) {
    foreignMsg = packageNotFoundMessage(e);
  }
  try {
    await svc.resolvePackage(TENANT_B, 'DOES-NOT-EXIST', 'actor-b');
  } catch (e) {
    missingMsg = packageNotFoundMessage(e);
  }
  assert.equal(foreignMsg, 'PACKAGE_NOT_FOUND');
  assert.equal(missingMsg, 'PACKAGE_NOT_FOUND');
  assert.equal(foreignMsg, missingMsg);
});
