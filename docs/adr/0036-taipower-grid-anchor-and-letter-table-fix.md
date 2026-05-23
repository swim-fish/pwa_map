# ADR 0036 — Taipower grid: 8×4 sparse table anchored at TWD67 easting 90 km

**Status**: Accepted
**Date**: 2026-05-23
**Supersedes**: 0012

## Context

ADR 0012 (2026-04-24) anchored the Taipower mainland grid at TWD67
easting **170 000 m** with a dense **8 × 3** letter table assigning
`A`–`X` to row-major cells. That table came from a draft reference
document; cross-checking against three independent sources (OSGeo
wiki, Jidanni's published Perl constant, the linspace TPCToMap
conversion tool) shows the ground-truth Taiwan Power Company grid is
**8 × 4** anchored at easting **90 000 m**, sparsely populated:

```
_ABC    row 0 (north, Y = 2 750 000)
_DEF    row 1            (Y = 2 700 000)
_GH_    row 2            (Y = 2 650 000)  — I underwater
JKL_    row 3            (Y = 2 600 000)
MNO_    row 4            (Y = 2 550 000)
PQR_    row 5            (Y = 2 500 000)
_TU_    row 6            (Y = 2 450 000)  — S = Matsu (separate anchor)
_VW_    row 7 (south,    Y = 2 400 000)   — X = Penghu (separate anchor)
```

Dropping the western column from the dense 8 × 3 table shifted every
letter in rows 3-7 east by one cell. Concretely:

- `L0593 BA86` (a real Hualien-inland Taipower pole, Central Mountain
  Range) decoded into the Pacific Ocean east of Hualien.
- The Kaohsiung 85 (高雄 85 大樓) test vector was labelled `P0703 CC43`
  when ground truth is `Q0703 CC43`.

The bug was masked by the four pre-existing golden vectors all falling
in row 0/2 col 0–2 or row 5 col 0 — cells where the old and new
tables happen to emit the same letter. Reported as
[issue #8](https://github.com/swim-fish/pwa_map/issues/8) while porting
the math into a separate ATAK plugin.

## Decision

- Anchor the mainland grid at TWD67 **easting 90 000 m**, northing
  2 400 000 m (southernmost row).
- Encode/decode against a sparse **8 × 4** letter table (see diagram
  above). Cells without a letter (`null` slots) are rejected as
  `out-of-coverage` in both directions.
- Letters in use: **A,B,C,D,E,F,G,H,J,K,L,M,N,O,P,Q,R,T,U,V,W** (21
  letters). The previously-accepted `I`, `S`, `X` (and the
  already-rejected `Y`, `Z`) all return `out-of-coverage`.
- Update the Kaohsiung 85 golden vector (`P0703 CC43` → `Q0703 CC43`)
  and add five new regression vectors covering the previously-broken
  rows so future regressions surface immediately.

## Consequences

- Forward / reverse conversion for Hualien, Taitung, Pingtung and
  similar east-coast / southern cells now lands inside the correct
  TWD67 cell instead of the Pacific.
- `taipower-9char-002` (Kaohsiung 85) flips one letter; downstream
  comparisons against the old code (P0703…) are now wrong by design.
- Round-trip stability is preserved: the existing Taipei 101, Taichung,
  Hualien-station, and 11-char Taipei vectors continue to encode to
  the same canonical strings.
- The set of accepted region letters shrinks from 24 (`A`–`X`) to
  21; UI surfaces that surfaced specific region letters never
  exercised `I`/`S`/`X` in practice but their out-of-coverage path now
  fires the same `errors.taipower.outerIsland` message key.

## Alternatives considered

- **Keep the dense 8 × 3 table, document `I`/`S`/`X` as
  "out-of-coverage masked by the bug"** — preserves backward
  compatibility for one wrong test vector at the cost of every other
  east-coast / southern cell. Rejected: the bug produces visibly
  wrong coordinates and silently passes type checks.
- **Hand-add S (Matsu) and X (Penghu) anchors in this same change** —
  requires provenance for the offshore anchors and a second projection
  family. Deferred to a future ADR; the sparse table already leaves
  the slots blank.

## References

- [Issue #8](https://github.com/swim-fish/pwa_map/issues/8)
- OSGeo wiki — _Taiwan Power Company grid_:
  <https://wiki.osgeo.org/wiki/Taiwan_Power_Company_grid>
- Jidanni — `TAIWAN_MAP` Perl constant:
  <https://www.jidanni.org/geo/taipower/programs/taipowergrid>
- linspace TPCToMap conversion tool (cell-centroid verification):
  <https://linspace.somee.com/TPCToMap/>
