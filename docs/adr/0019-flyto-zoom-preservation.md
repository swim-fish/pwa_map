# ADR 0019 — `MapController.flyTo` zoom preservation

**Status**: Accepted (landed 2026-04-25)
**Date**: 2026-04-25
**Feature**: `002-goto-split-input`

## Context

Feature 001 shipped `MapController.flyTo` with an MVP convenience: when
the caller did not pass `options.zoom` and the current zoom was below
10, the map snapped to zoom 15. This violates feature 002's FR-011 +
SC-003: a Go-To MUST NOT change the operator's chosen zoom.

## Decision

Amend `MapController.flyTo` so that when `options.zoom` is omitted, the
**current zoom** is forwarded as the target zoom — no snap-to-15, no
floor, no ceiling. The signature is unchanged; explicit
`{ zoom: n }` callers are unaffected.

```ts
flyTo(target, options = {}) {
  const currentZoom = map.getZoom();
  const nextZoom = options.zoom ?? currentZoom; // <-- preserve
  // ... animate
}
```

## Consequences

- A user at zoom 5 stays at zoom 5 after Go-To; at zoom 18 stays at
  zoom 18.
- Single production call site (`App.svelte` Go-To submit) — already
  passes no `zoom`, so the behaviour change is observed only at the
  Go-To path.
- Future Go-To-like features (search, share-link landing) inherit the
  correct semantics for free.
- Backwards-compatible for any caller that already passed
  `options.zoom` explicitly.

## Alternatives considered

- **Read current zoom in App.svelte and pass it explicitly** —
  rejected: spreads the rule across call sites; future call sites
  re-discover the bug.
- **Add a separate `flyToPreservingZoom(target)` helper** —
  rejected: two near-identical methods invite call-site mistakes.

## Implementation outcome

Single-line change in `src/map/MapController.ts :: flyTo` —
`const nextZoom = options.zoom ?? currentZoom;`. Verified by four unit
tests in `tests/unit/map/MapController.spec.ts` (zoom 5 / 9 / 18, plus
explicit override). Also surfaced an unrelated latent bug in
`parser.ts :: parseTwd67Input` where the digits inside `TWD67` were
captured as the easting; fixed at the same time so the new TWD67 chip
back-projects correctly.

## References

- Research: `specs/002-goto-split-input/research.md` §D5
- Contract: `specs/002-goto-split-input/contracts/flyto-zoom.md`
- Spec: FR-011 + SC-003
