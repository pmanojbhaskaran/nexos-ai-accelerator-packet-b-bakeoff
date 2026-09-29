# Packet C — Dimensioning POC

Implement end-to-end integration (not a mocked-only UI):

barcode → package resolve → camera capture → provisional L×W×H → quality gate (`AUTO_ACCEPT` | `RESCAN` | `MANUAL_FALLBACK`) → evidence → `POST /api/bakeoff/v1/packages/{id}/provisional-dimensions`.

- `billingEligible` must remain false for provisional camera estimates unless explicitly testing governed acceptance.
- Extend offline queue; do not replace it.

Acceptance: `tests/acceptance/dimensioning-poc.spec.md` criteria.
