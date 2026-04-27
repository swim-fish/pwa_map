# Phase 1 Data Model: Compass + Crosshair-Anchored Zoom Controls

**Feature**: `006-compass` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature has **no persisted schema** at all. Three transient
in-memory shapes plus a small set of MapLibre-owned values. Every
shape is read-only by convention (`readonly` modifiers throughout).

---

## §1. `BearingState` (transient, in-memory, Svelte writable)

**Owner**: `src/map/bearingSignal.ts` (Svelte writable; consumers see
a `Readable<BearingState>`).

**Lifecycle**: created on module import via `initialBearingState()`,
mutated only through the named action exports
(`emitBearing`, `__resetForTests`).

```ts
export interface BearingState {
  /**
   * Current map bearing in degrees, normalised to [0, 360).
   * 0 = north up. Updated synchronously on every MapLibre 'rotate'
   * event via MapController.emitBearing(deg).
   */
  readonly bearing: number;
}
```

**State transitions**:

```text
                ┌──────────────────────────────┐
                │   initialBearingState         │
                │   bearing = 0                 │
                └──────────────┬────────────────┘
                               │
                MapController.emitBearing(deg)
                               │
                               ▼
              ┌──────────────────────────────┐
              │   bearing = normalise(deg)    │
              │   normalise(d) = ((d % 360) + │
              │                  360) % 360   │
              └───────────────────────────────┘
```

**Invariants**:

- `bearing ∈ [0, 360)` at all times. `emitBearing(-90)` normalises
  to `270`; `emitBearing(450)` normalises to `90`.
- `bearing` is the **only** field. No `pending`, no `target`, no
  `animating` flag — animation is owned by MapLibre and observed
  via subsequent `'rotate'` events; the store does not model
  in-progress easing.
- All transitions are pure: `emitBearing` returns a new state
  object; no in-place mutation.

---

## §2. `MapController` amendments (existing module, new methods)

**Owner**: `src/map/MapController.ts` (already exists from feature
001).

**New public surface** (additive — no existing method's signature
changes):

```ts
class MapController {
  // ...existing methods (constructor, onMove, onMoveEnd, flyTo, ...)

  /** Returns the underlying map's current bearing in degrees, or 0
      if no map attached. */
  getBearing(): number;

  /** Subscribe to bearing changes. Returns an unsubscribe fn.
      The handler fires on every MapLibre 'rotate' event after
      the controller's emitBearing path. */
  onBearing(handler: (deg: number) => void): () => void;

  /** Internal — called from MapView.svelte's MapLibre rotate
      listener. Normalises and dispatches to all handlers. */
  emitBearing(deg: number): void;

  /** Animate the map back to bearing 0°. Silent no-op if the
      current bearing is within ±0.5° of zero. Under animated=false,
      uses setBearing for instantaneous snap (reduced-motion path).
      Under animated=true, uses easeTo({ bearing: 0, duration:
      600 }) per research D4. */
  resetBearing(animated: boolean): void;

  /** Zoom by `delta` levels (positive = in, negative = out),
      clamped to MapLibre's [getMinZoom(), getMaxZoom()] range, and
      always anchored on the map's current centre (the visual
      crosshair). Under animated=true, uses easeTo with duration:
      200; under animated=false, snaps via zoomTo({ animate: false }). */
  zoomBy(delta: number, animated: boolean): void;

  /** Replaces MapLibre's built-in cursor-anchored scrollZoom with a
      crosshair-anchored custom wheel handler. Called once from
      MapView.svelte's onMount AFTER attachUnderlying(map). Idempotent —
      multiple calls are no-ops after the first. See research D3 for
      rationale. */
  attachWheelOverride(): void;
}
```

**Internal state additions** (private fields, not exposed):

```ts
private readonly bearingHandlers = new Set<(deg: number) => void>();
private currentBearing = 0;
private wheelOverrideAttached = false;
```

**Invariants**:

- `getBearing()` returns the same value the underlying MapLibre map
  would return (no caching drift).
- `onBearing(handler)` MUST fire `handler(currentBearing)` once
  immediately on subscribe so the consumer (e.g., `bearingSignal`)
  starts in the correct state without waiting for the next rotate.
- `emitBearing(deg)` MUST normalise `deg` to `[0, 360)` BEFORE
  dispatching to handlers and updating `currentBearing`.
- `resetBearing(animated)` is a silent no-op if
  `Math.abs(currentBearing) ≤ 0.5` AND
  `Math.abs(currentBearing - 360) ≤ 0.5` (covers both 0° and 359.5°
  which round-trip as "near zero").
- `zoomBy(delta, animated)` MUST clamp the target zoom to MapLibre's
  declared range; tapping `+` at max-zoom is a silent no-op.
- `attachWheelOverride()` is idempotent.

---

## §3. `ZoomGesture` (transient, parameter shape only)

**Owner**: an internal type inside `MapController.ts`, not exported.
Represents the shape of inputs to `zoomBy`.

```ts
interface ZoomGesture {
  /** Levels to add to current zoom. +1 from the '+' button,
      -1 from the '−' button, fractional delta from the wheel
      (typically [-1, +1] per tick). */
  readonly delta: number;

  /** True for animated easeTo (200 ms); false for instant
      zoomTo (used by wheel events and the reduced-motion path). */
  readonly animated: boolean;
}
```

**Properties**:

- `delta` is unbounded at the input level; the implementation clamps
  the *target zoom* (not the delta) to MapLibre's range.
- `animated` is the source's choice, not derived from
  `prefers-reduced-motion`. The component reads the media query
  once at script-init and passes the appropriate `animated` value;
  `zoomBy` itself is media-query-agnostic.

---

## §4. `WheelOverride` (transient, internal contract)

**Owner**: a private function inside `MapController.attachWheelOverride()`.

The wheel handler is conceptually:

```ts
function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const map = this.underlying as maplibregl.Map | null;
  if (!map) return;
  // Convert deltaY to a zoom delta (research D3).
  // Standard MapLibre sensitivity = 1 zoom level per 100 px scroll.
  const zoomDelta = clamp(-event.deltaY / 100, -1, 1);
  const target = clamp(
    map.getZoom() + zoomDelta,
    map.getMinZoom(),
    map.getMaxZoom(),
  );
  if (Math.abs(target - map.getZoom()) < 1e-6) return; // silent no-op at clamp
  map.zoomTo(target, { around: map.getCenter(), duration: 0, animate: false });
}
```

Properties:

- The handler is attached to the map's `_canvasContainer` (or the
  outer container, whichever MapLibre exposes via `getCanvasContainer()`),
  with `{ passive: false }` so `preventDefault()` is honoured.
- It is the **only** wheel listener after `attachWheelOverride()`
  fires — MapLibre's built-in `ScrollZoomHandler` is disabled in the
  same call.
- It is NOT exported; the contract is opaque to test code, which
  drives wheel via `__mapTestHooks.triggerWheelZoom({ deltaY })` (research
  D7).

---

## §5. Cross-shape relationship diagram

```text
                ┌─────────────────────────────────┐
                │   MapView.svelte (existing)     │
                │   - mounts maplibregl.Map       │
                │   - on('rotate'): controller    │
                │       .emitBearing(getBearing)  │
                │   - controller.attachWheel-     │
                │       Override() on mount       │
                │   - test hooks:                 │
                │       triggerRotate(deg),       │
                │       triggerWheelZoom({...})   │
                └────────────┬────────────────────┘
                             │
                             ▼
                ┌─────────────────────────────────┐
                │   MapController.ts (amended)    │
                │   - getBearing / emitBearing /  │
                │       onBearing                 │
                │   - resetBearing(animated)      │
                │   - zoomBy(delta, animated)     │
                │   - attachWheelOverride()       │
                │     ↳ disable scrollZoom        │
                │     ↳ install custom wheel hdl  │
                └────────────┬────────────────────┘
                             │ rotate-events
                             ▼
                ┌─────────────────────────────────┐
                │   bearingSignal.ts              │
                │   - Svelte writable<BearingState> │
                │   - subscribes to              │
                │     controller.onBearing on    │
                │     module-init                │
                │   - normalises into [0, 360)    │
                └────────────┬────────────────────┘
                             │ Readable<BearingState>
                             ▼
                ┌─────────────────────────────────┐
                │   Compass.svelte                │
                │   - $bearingSignal.bearing      │
                │   - <button transform=rotate(  │
                │       -bearing deg)>            │
                │   - onClick: controller         │
                │       .resetBearing(!reduced)  │
                └─────────────────────────────────┘

                ┌─────────────────────────────────┐
                │   ZoomControls.svelte           │
                │   - 2 buttons (+ / −)            │
                │   - onClick: controller         │
                │       .zoomBy(±1, !reduced)     │
                │   - subscribes to controller's  │
                │     internal min/max zoom +     │
                │     current zoom for aria-      │
                │     disabled state              │
                └─────────────────────────────────┘
```

**Trust boundary**: Both components trust `MapController` absolutely
for bearing reads and zoom writes. No component reads
`map.getBearing()` / `map.getZoom()` directly. This keeps the
testable surface (MapController) the only thing tests need to mock.

---

## §6. Sample code: `MapView.svelte` rotate-event amendment

For clarity (this is the Phase 3 task):

```svelte
<!-- src/components/MapView.svelte (excerpt) -->
onMount(() => {
  // ...existing mount block (style, center, zoom, on('move')...)

  map.on('rotate', () => {
    if (!controller) return;
    controller.emitBearing(map.getBearing());
  });
  map.on('rotateend', () => {
    if (!controller) return;
    controller.emitBearing(map.getBearing());
  });

  if (controller) {
    controller.attachUnderlying(map);
    controller.attachWheelOverride();
  }

  // ...existing test hook block

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const w = window as unknown as Record<string, unknown>;
    w.__mapTestHooks ??= {};
    const mapHooks = w.__mapTestHooks as Record<string, unknown>;
    mapHooks.triggerRotate = (deg: number): void => {
      map.setBearing(deg);
    };
    mapHooks.triggerWheelZoom = (opts: { deltaY: number }): void => {
      const evt = new WheelEvent('wheel', {
        deltaY: opts.deltaY,
        bubbles: true,
        cancelable: true,
      });
      const target = (map.getCanvasContainer?.() ?? container) as HTMLElement;
      target.dispatchEvent(evt);
    };
  }
});
```

---

## §7. What this feature does NOT add

- **No new persisted shape**. `pwa_map:prefs`,
  `pwa_map:lastView`, `pwa_map:gotoHistory_v1`,
  `pwa_map:offlineReadyShown`, `pwa_map:installDismissedUntil`
  are all untouched.
- **No new SW cache rule**. The runtime caching from feature 003
  (osm-tiles / nlsc-tiles / google-tiles) and the workbox-precache
  for the app shell are unchanged.
- **No new manifest field**. The manifest in `vite.config.ts` is
  identical to feature 005.
- **No new runtime dependency**. All work uses MapLibre 3.x +
  Svelte 4 + standard browser APIs.
- **No telemetry / analytics**. Compass / zoom usage is observed
  via manual smoke; no persisted counters.
