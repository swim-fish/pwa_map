# ADR 0012 — Taipower grid: main-island letters A–X only (Y/Z deferred)

**Status**: Superseded by 0036
**Date**: 2026-04-24
**Superseded**: 2026-05-23 — see [ADR 0036](0036-taipower-grid-anchor-and-letter-table-fix.md)
for the corrected anchor (90 km) and sparse 8 × 4 letter table.
The "main-island A–X" framing here is wrong: the ground-truth grid
omits `I`/`S`/`X` (underwater / Matsu / Penghu).

## Context

Reference §8 documents anchors for main-island Taipower region letters
A–X (8 rows × 3 columns). Letters `Y` (Penghu) and `Z` (Kinmen /
Matsu) are reserved but NOT anchor-tabled in reference v2.0.0; they
use different projection anchors and in Kinmen / Matsu a different
ellipsoid.

## Decision

- Encode/decode only the A–X main-island letters.
- Inputs with region letter `Y` or `Z` are rejected by both the
  converter (`taipowerToWgs84`, `wgs84ToTaipower`) and the parser
  (`parseTaipowerInput`) with category `out-of-coverage` and
  message key `errors.taipower.outerIsland`.
- The UI's Taipower readout renders `coverage.notInTaiwan` when the
  crosshair falls outside the A–X envelope.

## Consequences

- No silent bogus cells.
- Adding Y / Z later is additive — a future ADR + anchor-table update
  lands new letters behind the same API.

## Alternatives considered

- **Hand-add Y / Z anchors from third-party sources** — requires
  provenance review. Out of scope for MVP.
