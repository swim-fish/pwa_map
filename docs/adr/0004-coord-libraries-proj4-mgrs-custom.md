# ADR 0004 — Coordinate libraries: proj4 + mgrs + hand-rolled Taiwan math

**Status**: Accepted
**Date**: 2026-04-24

## Context

Six coordinate formats to support: WGS84 DD, WGS84 DMS, TWD97 TM2,
TWD67 TM2, MGRS, Taipower. Reference doc §6 warns that off-the-shelf
proj4 `EPSG:3828` entries omit the four-parameter datum shift — a
silent ~400 m error.

## Decision

- **`proj4` npm** for WGS84 ↔ TWD97 TM2 (EPSG:3826 / EPSG:3825),
  registered at boot via `registerTwd97Projections()`.
- **`mgrs` npm** for WGS84 ↔ MGRS forward and inverse (precision 1–5).
- **Hand-rolled** TWD97 ↔ TWD67 four-parameter transform (reference §6
  constants Δx=807.8, Δy=248.6, a=1.549 × 10⁻⁵, b=6.521 × 10⁻⁶).
- **Hand-rolled** Taipower encoder/decoder over the TWD67 anchor table
  (reference §8).
- **Hand-rolled** WGS84 DD ↔ DMS (trivial formula; no dep needed).

## Consequences

- Minimum trust surface: vetted global libs for well-trodden math,
  hand-rolled code for Taiwan-specific parts with ~40 lines each and
  full test-vector coverage.
- Every converter is pure, deterministic, and covered by ≥ 1 vector
  in `test-vectors.json` v2.0.0.

## Alternatives considered

- **All-in proj4** — silent 400 m TWD67 error via `EPSG:3828`. Rejected.
- **PROJ WebAssembly** — +500 KB wasm for submetre accuracy; overkill.
- **Implementing TM2 from Snyder 1987** — no maintenance win over a
  vetted proj4.
