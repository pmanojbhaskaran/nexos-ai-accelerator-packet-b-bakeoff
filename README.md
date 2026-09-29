# NEXOS AI Accelerator Bake-off Repository (v1)

Controlled qualification repository for identical hands-on evaluation (Replit, Bolt, or equivalent).

## Architecture areas

| Area | Path | Role |
|------|------|------|
| Shared | `shared/` | DTOs, evaluators, cross-cutting contracts |
| API | `api/` | NestJS backend authority, Prisma, auth, tenant, audit |
| Web | `web/` | Next.js App Router slice, TenantMenuProvider, API client |
| Mobile | `mobile/mobile-app/` | Expo/RN, offline queue, field ops screens |

## Source provenance

Production-derived files were extracted **only** from pinned Git commits (see `evidence/source-provenance-ledger.json`). Dirty live worktrees were not used as source.

## BAKEOFF_ONLY_REPRESENTATION

See `GOVERNANCE.md`. Synthetic schema, migrations, fixtures, and `/api/bakeoff/v1/*` contracts are qualification-only.

## Packets

- **Packet A** — Architecture comprehension (`tests/packet-a/`). **No code changes.**
- **Packet B** — Operational workflow against supplied contracts (`tests/packet-b/`).
- **Packet C** — Mobile dimensioning POC (`tests/packet-c/`).
- **Packet D** — Controlled requirement change (`tests/packet-d/`).
- **Packet E** — Exit / continuation (`tests/packet-e/`).

## Local validation (optional)

Static validation only in P2 seal. Runtime install/build/test requires dependency installation inside this repository (not performed in P2). Use `docker-compose.bakeoff.yml` for local Postgres when running migrations in a later phase.

## Candidates may

- Implement Packet B/C/D requirements within governance boundaries.
- Extend offline queue and bake-off API integration.

## Candidates may not

- Replace NEXOS auth, tenant, or DB authority.
- Introduce proprietary runtime dependencies for core flows.
- Treat provisional measurements as billing truth.
