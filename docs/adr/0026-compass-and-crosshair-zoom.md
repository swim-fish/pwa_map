# ADR 0026 — Compass + Crosshair-Anchored Zoom + Wheel Override

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/006-compass/`

## Context

Feature 001's MapLibre integration enabled `dragRotate` and
`scrollZoom` with their default behaviours: right-button drag
rotates the map; mouse wheel zooms toward the cursor position. Two
operator complaints accumulated across features 001-005:

1. **Lost orientation after rotation** — accidental right-button
   drags produce non-zero bearings; there is no in-app way to
   recover. The browser's reload restores via `pwa_map:lastView`,
   but only with whatever bearing was last saved (often non-zero).
2. **Coordinate drifts off centre during zoom** — wheel zoom
   anchors on the cursor; for precision coordinate work an operator
   centres on a target with the crosshair, then a wheel zoom moves
   the target off-centre. The operator has to re-pan after every
   zoom, adding friction.

Feature 006 addresses both with a small bottom-right control
cluster and a wheel-handler override.

## Decision

### A. Three-method `MapController` amendment + bearing channel

Add the following public surface to `MapController` (additive — no
existing method's signature changes):

```ts
class MapController {
  // ===== existing methods unchanged =====

  // ===== feature 006 additions =====
  getBearing(): number;
  onBearing(handler: (deg: number) => void): () => void;
  emitBearing(deg: number): void;
  resetBearing(animated: boolean): void;
  zoomBy(delta: number, animated: boolean): void;
  attachWheelOverride(): void;
}
```

Plus a new singleton `bearingSignal` Svelte store
(`src/map/bearingSignal.ts`) that subscribes to `controller.onBearing`
and exposes a reactive `Readable<{ bearing: number }>`. UI components
(`Compass.svelte`) read bearing via the store; they NEVER call
`map.getBearing()` directly.

### B. Bearing reset semantics

`resetBearing(animated)` is a silent no-op when the current bearing
is within ±0.5° of zero (FR-005 — covers both `0.4°` and `359.6°`,
which round-trip as "near zero"). Otherwise:

- `animated === true` — calls `map.easeTo({ bearing: 0, duration: 600 })`. The 600 ms duration matches feature 002's `flyTo` vocabulary.
- `animated === false` — calls `map.setBearing(0)` for instantaneous snap. Used under `prefers-reduced-motion: reduce`.

### C. Crosshair-anchored zoom on every input

`zoomBy(delta, animated)` clamps the target zoom to MapLibre's
`[getMinZoom(), getMaxZoom()]` and ALWAYS passes
`{ around: map.getCenter() }` to either `easeTo` (animated, 200 ms)
or `zoomTo({ animate: false })` (snap). The `around` parameter is
the crosshair-anchored guarantee.

`attachWheelOverride()` re-anchors mouse-wheel zoom by:

1. Calling `map.scrollZoom.disable()` to remove MapLibre's built-in
   cursor-anchored handler.
2. Attaching a `wheel` event listener on `map.getCanvasContainer()`
   with `{ passive: false }` so `preventDefault()` is honoured.
3. The listener computes `zoomDelta = clamp(-event.deltaY / 100, -1, 1)`
   and calls `this.zoomBy(zoomDelta, false)` — instantaneous,
   crosshair-anchored.

The override is idempotent: a second call after the first is a
no-op.

### D. Bottom-right vertical strip anchor

The control cluster (`+` / `−` / compass — top to bottom) anchors
at:

```css
position: fixed;
right: var(--space-4, 16px);
bottom: calc(var(--space-4, 16px) + var(--space-6, 24px));
z-index: 6;
```

This places it in the bottom-right column shared with feature 003's
attribution badge (single-line) and feature 005's install banner
(when rendered). The cluster sits ABOVE the attribution and below
any rendered install banner.

The cluster is at `z-index: 6` — deliberately below the
bottom-centre transient toast column (z-index 50). Toasts
auto-dismiss within 5 s; the cluster is persistent. On the rare
overlap the toast wins, which is acceptable.

### E. Test-only window hooks

`MapView.svelte`'s `onMount` block extends the existing
`__mapTestHooks` object with two new entries (gated by
`import.meta.env.DEV || import.meta.env.MODE === 'test'`):

- `triggerRotate(deg: number)` — calls `map.setBearing(deg)`. Used
  by E2E to drive deterministic rotation without scripting a
  right-button drag.
- `triggerWheelZoom({ deltaY })` — dispatches a synthetic
  `WheelEvent` on the canvas container so the override's wheel
  listener fires with controlled `deltaY`.

These hooks flow through the production code paths; they do not
replace or shortcut the override.

## Consequences

- **Wheel zoom is now crosshair-anchored app-wide.** Once Phase 2
  of feature 006 lands, the override is in effect for every map
  load. Any user-facing change to wheel zoom anchoring after this
  point is a regression.
- **`MapController` is the only place where MapLibre `bearing` /
  `zoom` mutating APIs are called.** Components do not call
  `easeTo` / `setBearing` / `zoomTo` directly; they go through the
  controller. This keeps the testable surface narrow — one mockable
  controller instead of a raw MapLibre map per spec.
- **`bearingSignal` is a singleton.** Re-attaching to a different
  controller (e.g., in tests) detaches the prior subscription
  cleanly via `attachToController`. `__resetForTests()` resets
  bearing to 0 and detaches.
- **Reduced motion is respected at three layers**: (1) the compass
  icon's CSS `transition` is `none` under reduced motion; (2) the
  bearing reset uses `setBearing(0)` instead of `easeTo`; (3) the
  zoom buttons pass `animated: false` so `zoomBy` uses the
  `zoomTo({ animate: false })` snap path.
- **Touch pinch-zoom and shift-drag-zoom remain MapLibre-default.**
  Only the wheel handler is overridden. Re-anchoring touch pinch is
  out of scope for this feature; if added later, the same pattern
  (controller-owned override) applies.

## Alternatives considered

- **`map.scrollZoom.setAroundCenter(true)`** — does not exist in
  MapLibre 3.x. Mapbox GL JS has a similar option that MapLibre did
  not port. Rejected as non-existent.
- **Patch MapLibre's `ScrollZoomHandler` source** — rejected;
  forking a vendor library is a maintenance burden and breaks on
  every minor version bump.
- **Wrap wheel events at the Svelte component level
  (`MapView.svelte`'s `on:wheel`)** — works, but moves the override
  into a UI component that should be presentation-only. Keeping the
  override inside `MapController` matches the constitutional
  testability boundary (controllers are mockable; raw MapLibre + DOM
  events are not).
- **Apple-style "pizza slice" compass** (red half + grey half) —
  rejected; introduces a non-token red colour and is less
  recognisable on a 36 px target. The chosen N + arrow design
  matches the universal in-vehicle compass convention.
- **Continuous zoom via long-press on `+` / `−`** — rejected for
  this feature; one tap = one zoom level. Operators wanting
  continuous zoom can use the wheel.
- **Polling `map.getBearing()` via `requestAnimationFrame`** —
  rejected; causes redundant work when the map is idle and adds
  frame latency during active rotation. Event-driven (`'rotate'`
  event → `controller.emitBearing` → `bearingSignal`) is cheaper
  and aligns with how feature 001's `move` / `moveend` already
  wires the controller.
