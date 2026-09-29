import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOfflineStorageAliases,
  enqueue,
  flushQueue,
  loadQueue,
  setOfflineQueueStorageBackend,
} from '../../mobile/mobile-app/src/lib/offline-queue.ts';
import { evaluateDuplicateOfflineEvent, evaluateOfflineIdempotentKey } from '../../mobile/mobile-app/src/lib/ops-field-gates.ts';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
}

test('offline enqueue uses supplied offline-queue path', async () => {
  setOfflineQueueStorageBackend(memoryStorage());
  await clearOfflineStorageAliases();
  const item = await enqueue({
    path: '/api/bakeoff/v1/packages/p1/provisional-dimensions',
    method: 'POST',
    body: { length: 1, width: 2, height: 3 },
    tenantId: 'TENANT_A_QA',
    actorId: 'actor-a',
    correlationId: 'corr-1',
  });
  const q = await loadQueue();
  assert.equal(q.length, 1);
  assert.equal(item.status, 'QUEUED');
  setOfflineQueueStorageBackend(null);
});

test('replay and idempotency via supplied queue + ops-field-gates', async () => {
  setOfflineQueueStorageBackend(memoryStorage());
  await clearOfflineStorageAliases();
  const key = evaluateOfflineIdempotentKey({ shipmentId: 'sh1', action: 'CAPTURE', evidenceHash: 'hash1' }).key;
  const dup = evaluateDuplicateOfflineEvent({ queuedKeys: [key], candidateKey: key });
  assert.equal(dup.duplicate, true);

  await enqueue({
    path: '/api/bakeoff/v1/packages/p1/provisional-dimensions',
    method: 'POST',
    body: { idempotencyKey: key },
    tenantId: 'TENANT_A_QA',
    actorId: 'actor-a',
    correlationId: 'corr-2',
  });

  let calls = 0;
  const first = await flushQueue(async () => {
    calls += 1;
    if (calls === 1) throw new Error('UPLOAD_FAILURE');
    return { ok: true };
  });
  assert.equal(first.failed, 1);

  const second = await flushQueue(async () => ({ ok: true }));
  assert.equal(second.synced, 1);
  const after = await loadQueue();
  assert.equal(after.filter((i) => i.status === 'SYNCED').length, 1);
  setOfflineQueueStorageBackend(null);
});

test('partial sync failure does not mark failed item as synced', async () => {
  setOfflineQueueStorageBackend(memoryStorage());
  await clearOfflineStorageAliases();
  await enqueue({
    path: '/api/bakeoff/v1/packages/p1/provisional-dimensions',
    method: 'POST',
    body: { n: 1 },
    tenantId: 'TENANT_A_QA',
    actorId: 'actor-a',
    correlationId: 'corr-partial-1',
  });
  await enqueue({
    path: '/api/bakeoff/v1/packages/p2/provisional-dimensions',
    method: 'POST',
    body: { n: 2 },
    tenantId: 'TENANT_A_QA',
    actorId: 'actor-a',
    correlationId: 'corr-partial-2',
  });
  let n = 0;
  const partial = await flushQueue(async () => {
    n += 1;
    if (n === 2) throw new Error('PARTIAL_SYNC_FAILURE');
    return { ok: true };
  });
  assert.equal(partial.synced, 1);
  assert.equal(partial.failed, 1);
  const q = await loadQueue();
  assert.equal(q.some((i) => i.status === 'FAILED'), true);
  assert.equal(q.some((i) => i.status === 'SYNCED'), true);
  setOfflineQueueStorageBackend(null);
});
