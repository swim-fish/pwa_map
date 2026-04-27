# Contract: `MapController` — bearing & crosshair-anchored zoom

**Module**: `src/map/MapController.ts` (amended)
**Consumed by**: `src/map/bearingSignal.ts`, `src/components/Compass.svelte`,
`src/components/ZoomControls.svelte`, `src/components/MapView.svelte`,
all unit / integration tests under feature 006.
**Verifies**: spec FR-001..FR-009, FR-015; research D2, D3, D4.

## §1. Public surface (additive — existing methods unchanged)

```ts
class MapController {
  // ===== existing methods unchanged =====
  // constructor, onMove, onMoveEnd, emitMove, emitMoveEnd,
  // attachUnderlying, getUnderlying, layerSelection,
  // setLayerSelection, setBasemap, onTileFail,
  // recordTileError, flyTo, dispose, isDisposed
  // (see src/map/MapController.ts pre-006)

  // ===== new methods =====

  getBearing(): number;
  onBearing(handler: (deg: number) => void): () => void;
  emitBearing(deg: number): void;
  resetBearing(animated: boolean): void;
  zoomBy(delta: number, animated: boolean): void;
  attachWheelOverride(): void;
}
```

The amended class MUST keep all existing fields and methods
binary-compatible with feature 001-005's tests. Only **additive**
fields and methods land in this feature.

## §2. `getBearing(): number`

- Returns the underlying MapLibre map's current bearing in degrees,
  normalised to `[0, 360)`.
- Returns `0` if no underlying map is attached (`this.underlying ===
  null`) — same null-safe pattern as `flyTo`.

## §3. `onBearing(handler): () => void`

- Registers a handler. Returns an unsubscribe function (same shape
  as `onMove` / `onMoveEnd`).
- MUST fire `handler(getBearing())` once **immediately** (before
  returning the unsubscribe fn) so the consumer starts in sync.
- All registered handlers fire in registration order on every
  subsequent `emitBearing` call.

## §4. `emitBearing(deg: number): void`

- Internal — called from `MapView.svelte`'s MapLibre `'rotate'` /
  `'rotateend'` listeners.
- MUST normalise `deg` to `[0, 360)` via `((deg % 360) + 360) % 360`
  BEFORE updating `currentBearing` and dispatching to handlers.
- Idempotent: if the normalised value equals `currentBearing`, the
  call is a no-op (handlers do NOT fire). This avoids redundant
  reactivity when MapLibre fires multiple `rotate` events with the
  same bearing.

## §5. `resetBearing(animated: boolean): void`

Per research D4:

| Branch                                                 | Action                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| `this.underlying === null`                             | Silent no-op.                                                          |
| `Math.min(currentBearing, 360 - currentBearing) ≤ 0.5` | Silent no-op (FR-005 — already at north within tolerance).             |
| `animated === true`                                    | `map.easeTo({ bearing: 0, duration: 600 })` — uses MapLibre default easing curve. |
| `animated === false`                                   | `map.setBearing(0)` — instantaneous.                                   |

In both animated and non-animated paths, the actual `'rotate'`
event(s) MapLibre fires will trigger `emitBearing(...)`, which will
update `currentBearing` and notify handlers. The component does NOT
manually update `currentBearing` — it relies on MapLibre's event
loop.

## §6. `zoomBy(delta: number, animated: boolean): void`

Per research D3 + D4:

```ts
zoomBy(delta: number, animated: boolean): void {
  const map = this.underlying as maplibregl.Map | null;
  if (!map) return;
  const target = clamp(
    map.getZoom() + delta,
    map.getMinZoom(),
    map.getMaxZoom(),
  );
  if (Math.abs(target - map.getZoom()) < 1e-6) return; // silent no-op at clamp

  const center = map.getCenter();
  if (animated) {
    map.easeTo({ zoom: target, around: center, duration: 200 });
  } else {
    map.zoomTo(target, { around: center, duration: 0, animate: false });
  }
}
```

The contract:

- `delta` is unbounded; clamping happens on the **target** zoom.
- `around: map.getCenter()` is non-negotiable — that's the
  crosshair-anchored guarantee (FR-008).
- The 200 ms `easeTo` duration matches feature 002's `flyTo`
  vocabulary; the wheel-driven path passes `animated: false` for
  instantaneous response (research D3).

## §7. `attachWheelOverride(): void`

Per research D3:

```ts
attachWheelOverride(): void {
  if (this.wheelOverrideAttached) return;          // idempotent
  const map = this.underlying as maplibregl.Map | null;
  if (!map) return;                                // null-safe

  map.scrollZoom.disable();                        // remove cursor-anchored handler

  const target = (map.getCanvasContainer?.() ?? null) as HTMLElement | null;
  if (!target) return;                             // shouldn't happen, but null-safe

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const zoomDelta = clamp(-event.deltaY / 100, -1, 1);
    this.zoomBy(zoomDelta, false);                 // wheel = animated false
  };
  target.addEventListener('wheel', onWheel, { passive: false });

  this.wheelOverrideAttached = true;
}
```

Properties:

- Idempotent: a second call after the first MUST be a no-op (do not
  install a second listener).
- Disposable via `dispose()` — the wheel listener MUST be removed
  along with the underlying map (covered by the existing
  `dispose()` removing `this.underlying`).
- The listener calls `this.zoomBy(zoomDelta, false)` — meaning the
  wheel zoom always uses the snap path (`animated: false` → `zoomTo`
  with `duration: 0, animate: false`). This matches research D3's
  finding that wheel ticks should feel like direct manipulation.

## §8. Required test cases

`tests/unit/map/MapController.spec.ts` MUST cover the following
new cases:

1. **`getBearing()` with no map attached returns 0**.
2. **`getBearing()` with attached map returns map.getBearing()**
   (verified via stub map whose getBearing returns a known value).
3. **`onBearing(handler)` fires handler immediately on subscribe**
   with the current bearing.
4. **`onBearing(handler)` fires handler on every `emitBearing(deg)`
   call with the normalised value**. Cover: positive, negative,
   > 360, and exact 0. Verify no double-fire for repeated identical
   values.
5. **`emitBearing(deg)` normalises**. `emitBearing(-90)` → handler
   sees 270; `emitBearing(450)` → 90; `emitBearing(360)` → 0.
6. **`resetBearing(true)` calls `map.easeTo({ bearing: 0,
   duration: 600 })` exactly once** (verify via spy on stub map).
7. **`resetBearing(false)` calls `map.setBearing(0)`**.
8. **`resetBearing(*)` is a silent no-op when bearing is within
   ±0.5° of zero** (test both 0.4° and 359.6°).
9. **`zoomBy(+1, true)` calls `map.easeTo({ zoom: currentZoom + 1,
   around: currentCenter, duration: 200 })`** (verify args).
10. **`zoomBy(+1, false)` calls `map.zoomTo(currentZoom + 1,
    { around: currentCenter, duration: 0, animate: false })`**.
11. **`zoomBy(±N)` clamps target to `[getMinZoom(),
    getMaxZoom()]`**. Cover: at-max + 1 → no-op; at-min − 1 → no-op;
    halfway + 5 → clamped to max.
12. **`attachWheelOverride()` calls `map.scrollZoom.disable()` and
    installs a `wheel` listener on the canvas container**. Verify
    via stub map's `scrollZoom.disable` spy and a manual
    `dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }))` that
    triggers `zoomBy(-1, false)`.
13. **`attachWheelOverride()` is idempotent** — calling twice does
    NOT install two listeners (verified by counting
    `dispatchEvent` triggers).

## §9. Stability commitment

The five new public methods (`getBearing`, `onBearing`,
`emitBearing`, `resetBearing`, `zoomBy`, `attachWheelOverride`) are
the public contract. New methods MAY be added; existing methods MUST
NOT change signature without a feature-006-superseding spec.
