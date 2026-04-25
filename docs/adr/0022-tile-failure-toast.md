# ADR 0022 — Tile-failure detection + auto-revert toast

**Status**: Accepted (landed 2026-04-26)
**Date**: 2026-04-25
**Feature**: `003-i18n-and-map-layers`

## Context

When the operator picks a basemap whose tiles fail to load (network
policy block, origin outage, CORS), feature 003's spec FR-009 +
SC-006 require:

- The failure must be surfaced to the operator within 5 s.
- The previous basemap must remain visible — the canvas MUST NOT
  go blank.
- The toast must localise.

## Decision

Implement detection inside `MapController` via a
`TileFailureSnapshot` taken at every basemap swap:

```ts
interface TileFailureSnapshot {
  previous: LayerSelection;
  attemptedBasemap: BasemapId;
  errorCount: number;
  windowStartedAt: number;
}
```

Subscribe to MapLibre's `error` event and the snapshot's
`recordTileError(sourceId)` method:

- A basemap is "failing" if **≥ 3 of its tile requests** in the
  first 5 s after a swap return non-2xx, OR a single CORS / network
  error fires.
- On detection, the controller calls `setBasemap(snapshot.previous)`
  to roll back the visible style, then emits a `tilefail` event with
  `{ failedId, revertedTo }`.
- The dialog / app translates the event into a 5 s `aria-live`
  toast that names the failing source via the localised
  `map.failure.<group>` key.

## Consequences

- Operators are never stuck with a blank map — the previous basemap
  is restored automatically.
- The 5 s window matches the spec's SC-006 budget exactly.
- The 3-error-debounce prevents one transient flake from triggering
  a revert.
- The localised toast keeps Principle V (locale parity) consistent.

## Alternatives considered

- **Auto-retry the failed basemap with exponential backoff** —
  rejected: complexity for marginal gain; SWR cache already retries
  on next pan / zoom.
- **Show an in-picker error banner; stay on the failing source** —
  rejected: contradicts FR-009 ("previous basemap MUST remain
  visible"). A blank canvas is worse than an automatic revert.
- **Trust MapLibre's built-in error handling** — rejected:
  MapLibre's default behaviour for tile errors is to show the
  missing-tile placeholder, not to revert; the operator would have
  to undo manually.

## Implementation outcome

`MapController.recordTileError(sourceId, { fatal })` implements the
debounced detection (5 s window, 3-error threshold or single fatal).
On revert, the controller emits `tilefail` and `App.svelte` surfaces a
5 s `aria-live="polite"` toast (`map.failure.<group>`). Six unit
tests in `tests/unit/map/MapController.spec.ts` cover swap → setStyle,
threshold revert, fatal revert, post-window ignore, cross-source
ignore, and overlay-toggle invariance. **Refinement during impl**:
`MapView.svelte` only forwards `error` events that look like real
fetch failures (HTTP ≥ 400 / 0, or undefined-status fetch/network/
abort messages). Decode / style-validation errors no longer trigger a
revert — preventing false positives we hit in chromium E2E.

## References

- Research: `specs/003-i18n-and-map-layers/research.md` §D5
- Contract:
  `specs/003-i18n-and-map-layers/contracts/service-worker-cache.md`
  (handles the _cache_ policy; this ADR handles _detection_)
- Spec: FR-009 + SC-006
