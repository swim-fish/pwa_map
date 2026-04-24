# ADR 0011 — TM2 zone ambiguity: back-project both zones and pick per §9

**Status**: Accepted
**Date**: 2026-04-24

## Context

Go-To input like `306962.887, 2769619.124` (no zone declaration) is
ambiguous — zone 119 and zone 121 have overlapping easting ranges,
and the two back-projections differ by ~205 km (§9 worked example).

## Decision

`parseTm2Inferred` applies reference §9:

1. Invert both zone candidates (`twd97ToWgs84` for 119 and 121).
2. Filter candidates whose back-projected `(lat, lon)` sits inside
   Taiwan's broader bounding box (20–27° lat, 118–123° lon).
3. Among the remaining candidates, pick the one whose longitude
   satisfies its own rule (`lon ≥ 120° → 121`, else 119). If both
   satisfy, prefer **zone 121** (§9 default).
4. Surface `zoneAutoResolved` on the returned `GoToRequestOk` so the
   UI can show a toast ("interpreted as TWD97 zone 121" — FR-016).

If no candidate projects inside Taiwan's plausible band, return
`out-of-range` with `errors.tm2.bothZonesFail`.

## Consequences

- Never silently switches zones — users always see which zone the
  system chose.
- Inverse-projection cost is small (2 proj4 calls per ambiguous input).

## Alternatives considered

- **Require explicit zone** — grammar §5 says SHOULD, not MUST;
  rejecting would be over-strict.
- **Guess by easting magnitude alone** — breaks at the Penghu / main
  overlap.
