# Packet A — Architecture Comprehension Gate

**Make ZERO source modifications until explicitly authorized.**

1. Inspect the repository and identify API / Web / Mobile / Shared boundaries.
2. Identify backend authority, tenant authority, database authority, auth/RBAC authority, audit/event authority.
3. Identify offline architecture (`offline-queue.ts`, sync hooks, idempotency gates). Mark partial areas as `CURRENT_IMPLEMENTATION_PARTIAL`.
4. List all `BAKEOFF_ONLY_REPRESENTATION` objects (see `GOVERNANCE.md`, bake-off Prisma models, `/api/bakeoff/v1/*`).
5. For the assigned change scenario, identify the smallest safe file set to modify and tests that must change.
6. List architectural risks (tenant leakage, UI-only enforcement, provisional measurement as billing truth).

## Acceptance criteria (evaluator)

- Correct four-area map.
- Correct authority ordering (API + contracts over clients).
- Explicit BAKEOFF_ONLY list.
- Zero code diffs in submission phase.
