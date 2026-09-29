# NEXOS AI Accelerator Bake-off Governance

This repository is a **sanitized qualification artifact**. It is vendor-neutral (Replit, Bolt, or any other accelerator receive identical contents).

## Authority

1. NEXOS backend (API) is authoritative for domain rules in this bake-off.
2. Supplied tenant context (`x-tenant-id`) is authoritative.
3. Supplied authentication (JWT / session bootstrap patterns) is authoritative.
4. Supplied RBAC/capability rules (`CapabilityGuard`, `@RequireCapability`) are authoritative.
5. Supplied contracts under `contracts/` are authoritative **for this bake-off only**.
6. Audit and domain-event requirements must be preserved in implementations.
7. No second operational source of truth (no shadow DB, auth, or tenant model).
8. No proprietary accelerator database, authentication, or tenant system.
9. Web and Mobile must not perform direct database writes.
10. No silent schema or contract changes unless a packet explicitly authorizes them.
11. Do not weaken or remove tenant isolation checks.
12. Do not move server-side enforcement to UI-only checks.
13. No hard deletes where governed correction/audit is required.
14. No AI/LLM runtime dependency for deterministic core flows.
15. No accelerator runtime dependency in accepted production-bound code paths.
16. Unknown facts remain **UNKNOWN** — report, do not invent.
17. Do not invent production APIs, compliance claims, or certification.
18. Do not alter tests merely to force a pass.
19. No external network/services unless a packet explicitly allows them.

## BAKEOFF_ONLY_REPRESENTATION

Objects and names marked **BAKEOFF_ONLY_REPRESENTATION** (including synthetic Prisma models such as `ShipmentPackage`, `PackageDimensionCapture`, `ProofArtifact`, `MobileSyncAction`, and bake-off routes under `/api/bakeoff/v1/*`) exist solely to make this qualification self-contained.

They are **not** automatically authoritative NEXOS production schema or API names. Accelerator output against these objects requires explicit mapping and reconciliation before any production adoption.

## Provisional dimensioning

Camera-derived dimensions are **PROVISIONAL** (`billingEligible=false` by default). They are not certified freight, legal metrology, or billing truth unless a governed later acceptance state is explicitly implemented and tested.

## Evaluator-owned tests

The `evaluator/` directory is **evaluator-owned**. Candidates must **not** modify, delete, weaken, or skip these tests. Integrity is verified via `evaluator/integrity/EVALUATOR_BASELINE_SHA256_MANIFEST.json`.
