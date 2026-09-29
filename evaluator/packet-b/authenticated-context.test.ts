import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedBakeoffContext } from '../../api/src/common/bakeoff/authenticated-context.ts';

function expectCode(fn: () => void, code: string) {
  assert.throws(fn, (err: unknown) => {
    const e = err as { response?: { code?: string }; getResponse?: () => { code?: string } };
    const got = e.response?.code ?? e.getResponse?.()?.code;
    assert.equal(got, code);
    return true;
  });
}

test('missing auth principal is denied', () => {
  expectCode(() => resolveAuthenticatedBakeoffContext({ headers: { 'x-tenant-id': 'TENANT_A_QA' } }), 'AUTH_REQUIRED');
});

test('spoofed tenant header is denied', () => {
  expectCode(
    () =>
      resolveAuthenticatedBakeoffContext({
        user: { userId: 'u1', tenantCode: 'TENANT_A_QA' },
        headers: { 'x-tenant-id': 'TENANT_B_QA' },
      }),
    'TENANT_CONTEXT_MISMATCH',
  );
});

test('matching tenant header is allowed', () => {
  const ctx = resolveAuthenticatedBakeoffContext({
    user: { userId: 'u1', tenantCode: 'TENANT_A_QA' },
    headers: { 'x-tenant-id': 'TENANT_A_QA' },
  });
  assert.equal(ctx.tenantId, 'TENANT_A_QA');
  assert.equal(ctx.actorId, 'u1');
});

test('actor spoofing via header is denied', () => {
  expectCode(
    () =>
      resolveAuthenticatedBakeoffContext({
        user: { userId: 'u1', tenantCode: 'TENANT_A_QA' },
        headers: { 'x-actor-id': 'attacker' },
      }),
    'ACTOR_CONTEXT_MISMATCH',
  );
});
