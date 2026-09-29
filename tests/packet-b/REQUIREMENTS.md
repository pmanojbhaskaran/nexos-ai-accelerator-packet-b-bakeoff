# Packet B — Candidate operational transition

The required candidate deliverable is `applyPacketBOperationalTransition`.

Prior state: `HUB_INBOUND_RECORDED` with a hub inbound scan for the package barcode.
Resulting state: `DIMENSION_PROVISIONAL_RECORDED` with measurement, proof, audit, and domain event persistence.

UI-only enforcement does not satisfy acceptance.
Response-shaped fake persistence does not satisfy acceptance.
Caller-supplied tenant/actor headers are not authority.
A no-op that skips persistence calls fails as `NO_OP_CANDIDATE`.


Packet B PASS requires satisfying **evaluator-owned executable tests** under `evaluator/packet-b/`.

Required behaviour (not UI-only):

- authenticated principal (JWT) required
- tenant and actor bound to authenticated principal
- caller-supplied tenant/actor headers are not authority
- required capability `BAKEOFF_DIMENSION_CAPTURE` enforced server-side
- symmetric tenant matrix A/B read/mutate allow/deny
- cross-tenant nondisclosure (`PACKAGE_NOT_FOUND` equivalence)
- package identity resolution
- operational mutation persists measurement/audit/domain events where applicable
- proof/evidence persistence when registering evidence
- idempotency/offline behaviour covered in Packet C evaluator tests where applicable

Explicit non-acceptance:

- UI-only enforcement does **not** satisfy Packet B
- response-shaped fake persistence without service persistence calls does **not** satisfy Packet B

Run evaluator command via external runner (authoritative baseline outside candidate repo).
