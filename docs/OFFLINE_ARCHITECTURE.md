# Offline / sync (CURRENT_IMPLEMENTATION_PARTIAL)

- **Queue ownership:** Mobile client (`offline-queue.ts`, legacy `api-client.ts` alias keys).
- **Queued action shape:** path, method, body, tenantId, actorId, correlationId, deviceId, retryCount, status.
- **Idempotency:** `ops-field-gates.ts` offline keys; server `x-idempotency-key` header supported on API CORS list.
- **Sync trigger:** `flushQueue` / `syncOfflineQueue` hooks in `mobile-api-hooks.ts`.
- **Failure handling:** FAILED status retained in queue; partial upload retry via `ApiClient` in-memory pending upload queue (**PARTIAL**, not fully durable).
- **Evidence upload:** Related via bake-off `/api/bakeoff/v1/evidence` and hub scan `photoRef` pattern.

Do not claim full bidirectional sync engine — extend within these boundaries.
