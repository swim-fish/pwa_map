# Contract: `ZoomControls.svelte` — crosshair-anchored +/− buttons

**Component**: `src/components/ZoomControls.svelte`
**Mounted from**: `src/app/App.svelte` (unconditionally; same
viewport-anchor cluster as `Compass.svelte`).
**Verifies**: spec FR-006..FR-009, FR-010..FR-015; research D1, D4, D6.

## §1. Render contract

The component MUST render TWO `<button>` elements at all times — one
for zoom-in (`+`) and one for zoom-out (`−`). No `{#if}` gating.

```svelte
<div class="zoom-controls">
  <button
    type="button"
    class="zoom-btn zoom-in"
    data-testid="zoom-in"
    aria-label={inLabel}
    aria-disabled={atMaxZoom}
    on:click={onZoomIn}
  >+</button>
  <button
    type="button"
    class="zoom-btn zoom-out"
    data-testid="zoom-out"
    aria-label={outLabel}
    aria-disabled={atMinZoom}
    on:click={onZoomOut}
  >−</button>
</div>
```

The buttons reactively swap their `aria-label` between the active
label and the disabled label depending on whether the current map
zoom is at the clamp boundary.

## §2. Zoom-state subscription

The component MUST track current zoom level reactively. It does so
via `controller.onMove(handler)` — every `'move'` event fires after
a zoom change, and `MapMoveEvent` already carries the new zoom.
The component derives `atMaxZoom` and `atMinZoom` by comparing
`currentZoom` against `controller.getUnderlying()?.getMaxZoom()` and
`getMinZoom()` (or `Infinity` / `-Infinity` if no map is attached).

```svelte
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { MapController, MapMoveEvent } from '$map/MapController';

  export let controller: MapController;

  let currentZoom = controller.zoom;
  let maxZoom = Infinity;
  let minZoom = -Infinity;

  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  $: atMaxZoom = currentZoom >= maxZoom - 1e-6;
  $: atMinZoom = currentZoom <= minZoom + 1e-6;
  $: inLabel = atMaxZoom
    ? $tStore('controls.zoom.in.disabled')
    : $tStore('controls.zoom.in.label');
  $: outLabel = atMinZoom
    ? $tStore('controls.zoom.out.disabled')
    : $tStore('controls.zoom.out.label');

  let unsub: (() => void) | null = null;

  onMount(() => {
    const map = controller.getUnderlying() as
      | { getMaxZoom?: () => number; getMinZoom?: () => number }
      | null;
    if (map) {
      if (typeof map.getMaxZoom === 'function') maxZoom = map.getMaxZoom();
      if (typeof map.getMinZoom === 'function') minZoom = map.getMinZoom();
    }
    unsub = controller.onMove((ev: MapMoveEvent) => {
      currentZoom = ev.zoom;
    });
  });

  onDestroy(() => {
    unsub?.();
  });

  function onZoomIn(): void {
    if (atMaxZoom) return;
    controller.zoomBy(+1, !reducedMotion);
  }

  function onZoomOut(): void {
    if (atMinZoom) return;
    controller.zoomBy(-1, !reducedMotion);
  }
</script>
```

## §3. Behaviour

| Trigger                                 | Action                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `on:click` of zoom-in (`+`)             | If `!atMaxZoom`, call `controller.zoomBy(+1, !reducedMotion)`. If `atMaxZoom`, the click is a silent no-op (FR-009). The controller's own clamp logic is also a defence-in-depth; the component's own clamp avoids the unnecessary controller call.                                                                                                              |
| `on:click` of zoom-out (`−`)            | Symmetric: `controller.zoomBy(-1, !reducedMotion)` if `!atMinZoom`.                                                                                                                                                                                                                                                                                              |
| `on:keydown` with `Enter` or `Space`    | Default `<button>` semantics handle this; no explicit handler. The `:active` CSS handles tap feedback.                                                                                                                                                                                                                                                          |
| `on:click` while `atMaxZoom` (resp. `atMinZoom`) | Component returns early; no controller call. `aria-disabled="true"` on the button surfaces the state to AT.                                                                                                                                                                                                                                                |

## §4. Visual / layout

The two buttons sit in the same `.map-controls` wrapper as
`Compass.svelte` (research D1). They stack vertically (zoom-in on
top, zoom-out below) and the compass is below them in the strip.

| Property        | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Size            | `width: 36px; height: 36px;` per button                                                                                |
| Background      | `var(--color-surface-elev, rgba(255, 255, 255, 0.95))`                                                                 |
| Foreground      | `var(--color-fg, #0f172a)` for the `+` / `−` glyph                                                                     |
| Border          | `1px solid var(--color-border, #cbd5e1)`                                                                               |
| Border radius   | First button (`+`) `8px 8px 0 0`; second (`−`) `0 0 8px 8px` so they form a single rounded pill, like Google Maps' zoom widget |
| Glyph           | `font-size: 18px; font-weight: 600; line-height: 1;` — render `+` and `−` as plain text, NOT inline SVG (saves bytes) |
| `aria-disabled` | When `atMaxZoom` / `atMinZoom`, also apply `opacity: 0.5; cursor: not-allowed;` via CSS                               |
| Transition      | `transition: opacity 120ms;` for the disabled-state opacity swap                                                       |

The reduced-motion override mirrors `Compass.svelte`:

```css
@media (prefers-reduced-motion: reduce) {
  .zoom-btn {
    transition: none !important;
  }
}
```

## §5. Parent wrapper layout (`App.svelte`)

The component is mounted inside a sibling wrapper that
`App.svelte` adds:

```svelte
<div class="map-controls">
  <ZoomControls {controller} />
  <Compass />
</div>
```

CSS (in `App.svelte`):

```css
.map-controls {
  position: fixed;
  right: var(--space-4, 16px);
  bottom: calc(var(--space-4, 16px) + var(--space-6, 24px));
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  z-index: 6;
}
```

The `bottom` calc clears the attribution badge (research D1). When
the install banner is mounted, the controls' bottom offset MAY
visually crowd the banner — this is acceptable since the banner is
transient (operator dismisses it within a session) and the controls
remain usable.

## §6. Accessibility (FR-007, FR-010..FR-015)

| Aspect              | Requirement                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Element             | Real `<button type="button">` for both. Keyboard activation by browser default.                                                                          |
| `aria-label`        | Bound to `$tStore('controls.zoom.in.label')` / `controls.zoom.out.label` when active, swapped to `.disabled` variant when at clamp.                     |
| `aria-disabled`     | `true` when at clamp boundary; `false` otherwise. NOT `disabled` HTML attribute (so the button stays focusable for AT navigation).                     |
| Tap target          | ≥ 36 × 36 px each (SC-005).                                                                                                                              |
| Keyboard            | Tab cycles through both; Enter / Space activates. Tab order MUST be in (zoom-in → zoom-out → compass) so spatial order matches DOM order.               |
| Contrast            | `+` / `−` glyph MUST meet ≥ 4.5:1 against `--color-surface-elev` in both schemes. Verified by source-token check (same as Compass §5).                  |
| Reduced motion      | Opacity transition skipped per §4 CSS.                                                                                                                  |

## §7. i18n keys

The component reads four keys via `$tStore(...)`:

| Key                            | zh                  | en                          | ja                          |
| ------------------------------ | ------------------- | --------------------------- | --------------------------- |
| `controls.zoom.in.label`       | `放大`              | `Zoom in`                   | `拡大`                      |
| `controls.zoom.in.disabled`    | `已達最大縮放`      | `Maximum zoom reached`      | `最大ズームに到達`          |
| `controls.zoom.out.label`      | `縮小`              | `Zoom out`                  | `縮小`                      |
| `controls.zoom.out.disabled`   | `已達最小縮放`      | `Minimum zoom reached`      | `最小ズームに到達`          |

## §8. Required tests

`tests/integration/zoom-controls.spec.ts` MUST cover:

1. **Mount with mid-range zoom**: both buttons render, both
   `aria-disabled === "false"`, labels are 'Zoom in' / 'Zoom out' (en).
2. **Click `+` at non-max zoom**: `controller.zoomBy(+1, true)` was
   called with those exact args (verify via spy on a stub controller).
3. **Click `−` at non-min zoom**: `controller.zoomBy(-1, true)`.
4. **Click `+` when reduced-motion is ON**: `controller.zoomBy(+1,
   false)`.
5. **At max zoom (mock the stub map's `getMaxZoom()` to return
   `currentZoom`)**: `aria-disabled` flips to `"true"`, `aria-label`
   becomes `'Maximum zoom reached'`, and clicking is a silent no-op
   (controller's `zoomBy` is NOT called).
6. **At min zoom**: symmetric.
7. **Crosshair drift assertion**: drive `controller.zoomBy(+1, false)`
   on a stub map; assert that the spy on `map.zoomTo` was called with
   `{ around: <map.getCenter()-equivalent>, ... }`. This is the
   integration-level evidence for SC-004; the actual crosshair-drift
   measurement (≤ 1 px) is verified inside the MapController unit
   spec via stub assertions.
8. **Tap targets**: both buttons' `getBoundingClientRect()` ≥ 36 × 36.
9. **Tab order**: zoom-in's `tabIndex` precedes zoom-out's in the
   DOM, so the natural Tab cycle hits them in the correct order.

## §9. Out of scope

- The component does NOT read `map.getZoom()` directly; it tracks
  zoom via the existing `controller.onMove` channel.
- The component does NOT animate its glyphs (no `+` rotating, no
  `−` flipping). The transition is purely on the disabled-state
  opacity.
- The component does NOT support multi-tap acceleration (e.g., hold
  `+` to zoom in continuously). Each tap = one zoom level. Operators
  who need continuous zoom can use the wheel.
