import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPacketBOperationalTransition, diagnosePacketBCandidateCalls } from '../../api/src/common/bakeoff/packet-b-operational-transition.ts';

function ports(calls: string[]) {
  return {
    tenantCapabilityConfig: {
      findFirst: async () => ({ enabled: true }),
    },
    shipmentPackage: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
        if (where.tenantId === 'TENANT_A_QA' && where.id === 'p-a') return { id: 'p-a', packageBarcode: 'PKG-A', shipmentInternalId: 's-a' };
        if (where.tenantId === 'TENANT_B_QA' && where.id === 'p-b') return { id: 'p-b', packageBarcode: 'PKG-B', shipmentInternalId: 's-b' };
        return null;
      },
    },
    hubInboundScan: {
      findFirst: async ({ where }: { where: { tenantId: string; barcodeValue: string } }) => {
        if (where.barcodeValue === 'PKG-A' && where.tenantId === 'TENANT_A_QA') return { id: 'scan-a' };
        if (where.barcodeValue === 'PKG-B' && where.tenantId === 'TENANT_B_QA') return { id: 'scan-b' };
        return null;
      },
    },
    packageDimensionCapture: {
      findFirst: async ({ where }: { where: { correlationId: string } }) => (where.correlationId === 'idem-dup' ? { id: 'existing' } : null),
      create: async () => {
        calls.push('measurement');
        return { id: 'm-new', correlationId: 'idem-1' };
      },
    },
    proofArtifact: { create: async () => { calls.push('proof'); return { id: 'proof' }; } },
    shipmentAuditEvent: { create: async () => { calls.push('audit'); return {}; } },
    domainEventRecord: { create: async () => { calls.push('domain'); return {}; } },
  };
}

test('VALID_A_TRANSITION persists resulting state', async () => {
  const calls: string[] = [];
  const result = await applyPacketBOperationalTransition(ports(calls) as any, {
    tenantId: 'TENANT_A_QA', actorId: 'actor-a', packageId: 'p-a', priorState: 'HUB_INBOUND_RECORDED',
    idempotencyKey: 'idem-1', length: 10, width: 11, height: 12,
  });
  assert.equal(result.resultingState, 'DIMENSION_PROVISIONAL_RECORDED');
  assert.equal(result.duplicate, false);
  assert.deepEqual(calls, ['measurement', 'proof', 'audit', 'domain']);
});

test('A_ATTEMPTS_B package is denied', async () => {
  await assert.rejects(() => applyPacketBOperationalTransition(ports([]) as any, {
    tenantId: 'TENANT_A_QA', actorId: 'actor-a', packageId: 'p-b', priorState: 'HUB_INBOUND_RECORDED',
    idempotencyKey: 'idem-x', length: 1, width: 1, height: 1,
  }), (err: any) => String(err.message).includes('PACKAGE_NOT_FOUND'));
});

test('INVALID_STATE_TRANSITION fails', async () => {
  await assert.rejects(() => applyPacketBOperationalTransition(ports([]) as any, {
    tenantId: 'TENANT_A_QA', actorId: 'actor-a', packageId: 'p-a', priorState: 'CREATED',
    idempotencyKey: 'idem-y', length: 1, width: 1, height: 1,
  }), (err: any) => err.getResponse?.().code === 'INVALID_STATE_TRANSITION');
});

test('DUPLICATE_IDEMPOTENCY_KEY does not create another measurement', async () => {
  const calls: string[] = [];
  const result = await applyPacketBOperationalTransition(ports(calls) as any, {
    tenantId: 'TENANT_A_QA', actorId: 'actor-a', packageId: 'p-a', priorState: 'HUB_INBOUND_RECORDED',
    idempotencyKey: 'idem-dup', length: 1, width: 1, height: 1,
  });
  assert.equal(result.duplicate, true);
  assert.equal(calls.length, 0);
});

test('NO_OP candidate without persistence calls fails acceptance', () => {
  const diagnosed = diagnosePacketBCandidateCalls([]);
  assert.equal(diagnosed.ok, false);
  assert.equal(diagnosed.code, 'NO_OP_CANDIDATE');
});
