# UI Record 0006 — Compass + Crosshair-Anchored Zoom Controls

**Status**: Accepted (landed at `/speckit.implement` 2026-04-27)
**Affected screens**: app shell — bottom-right control cluster
(zoom-in `+`, zoom-out `−`, compass — stacked vertically in that
order). Cross-cuts every zoom interaction (mouse wheel, +/−
buttons, future keyboard / touch pinch).
**Feature**: `specs/006-compass/`

## Context

Feature 001's MapLibre integration enabled right-button-drag
rotation by default but offered no in-app way to recover from a
non-zero bearing. Operators frequently end up with non-north-up
maps after a stray right-click drag and cannot easily reset. In
parallel, MapLibre's default mouse-wheel zoom anchors on the cursor
position — meaning zooming for a coordinate under the centre
crosshair (the live readout's anchor) actively moves that
coordinate off-centre. Operators doing precision coordinate work
have to manually re-pan after every zoom, adding friction.

This feature adds a small persistent control cluster and re-anchors
every zoom path on the crosshair.

## Design goals

1. **Visible orientation feedback** — a small compass icon whose
   `N` label and arrow rotate synchronously with the map's bearing
   (within 100 ms). Tap to reset to north.
2. **Direct zoom controls** — `+` / `−` buttons in the same
   cluster. Tap or keyboard activation triggers a 1-level zoom step
   anchored on the centre.
3. **Crosshair-anchored zoom on every input** — wheel + buttons +
   keyboard all preserve the geographic point under the central
   crosshair. The mouse wheel needs to override MapLibre's default
   cursor-anchored behaviour (research D3).
4. **Reduced-motion compliance** — compass rotation animation is
   skipped under `prefers-reduced-motion: reduce`; bearing reset
   uses `setBearing(0)` instead of `easeTo`; `+` / `−` use
   `zoomTo({ animate: false })` instead of `easeTo`.
5. **No collision** — the cluster anchors at the bottom-right
   above the attribution badge and below any rendered install
   banner, leaving every other surface (toolbar, update prompt,
   coordinate readout, toast column, install affordances) untouched.

## Layout & tokens

### Cluster wrapper (`App.svelte` `.map-controls`)

| Property | Value                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Anchor   | `position: fixed; right: var(--space-4); bottom: calc(var(--space-4) + var(--space-6));` |
| Layout   | `display: flex; flex-direction: column; gap: var(--space-2);`                            |
| Z-index  | `6`                                                                                      |

The cluster sits BELOW the bottom-centre transient toast column
(z-index 50) by design. Toasts auto-dismiss within 5 s; the
controls are persistent. On the rare overlap, the toast wins —
acceptable since both clear quickly.

### Compass button (`Compass.svelte`)

| Property      | Value                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Size          | `36px × 36px` (SC-005 tap target)                                                                        |
| Background    | `var(--color-surface-elev, rgba(255, 255, 255, 0.95))`                                                   |
| Foreground    | `var(--color-fg, #0f172a)` — `currentColor` cascades into the SVG strokes / fills                        |
| Border        | `1px solid var(--color-border, #cbd5e1)`                                                                 |
| Border radius | `50%`                                                                                                    |
| Shadow        | `0 1px 3px rgba(15, 23, 42, 0.12)`                                                                       |
| Rotation      | `transform: rotate(var(--compass-bearing));` — driven by Svelte reactivity from `$bearingSignal.bearing` |
| Transition    | `transition: transform 200ms ease-out;`; skipped under `prefers-reduced-motion: reduce`                  |

Inline 24×24 SVG content (viewBox `0 0 48 48`):

- Outer ring: circle at (24, 24), r=20, stroke=`currentColor`
- `N` label: text at (24, 11), `font-size: 9; font-weight: 700`
- North arrow: chevron path `M24 14 L20 24 L24 22 L28 24 Z`
- Centre dot: circle at (24, 24), r=2

### Zoom buttons (`ZoomControls.svelte`)

| Property       | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Size           | `36px × 36px` per button (SC-005)                                                                                      |
| Background     | `var(--color-surface-elev)` (same token as compass + toolbar)                                                          |
| Foreground     | `var(--color-fg)` for the `+` / `−` glyph                                                                              |
| Border         | `1px solid var(--color-border)`                                                                                        |
| Border radius  | First button (`+`) `8px 8px 0 0`; second (`−`) `0 0 8px 8px` — combined into a single rounded pill (Google Maps style) |
| Glyph          | `font-size: 18px; font-weight: 600; line-height: 1` (plain text `+` / `−`)                                             |
| Disabled state | `aria-disabled="true"` + `opacity: 0.5; cursor: not-allowed;` (CSS attribute selector)                                 |

### Layout-anchor diagram (research D1)

```
┌──────────────────────────────────────────────────────────┐
│                       UpdatePrompt                       │  feature 004 (top-centre)
│                                                          │
│                         Toolbar                          │  feature 003 (top-right)
│                                                          │
│                      [crosshair]                         │  feature 001 (centre)
│                                                          │
│  CoordinateReadout                                       │  feature 001 (bottom-left)
│                                                          │
│                  ┌───────────────────┐                   │
│                  │  InstallIosSheet  │                   │  005 (bottom-centre)
│                  └───────────────────┘                   │
│                                                          │
│                              ┌───┐                       │
│                              │ + │                       │
│                              │ − │                       │  006 (bottom-right cluster)
│                              │ ⊕ │  ← compass            │
│                              └───┘                       │
│                                       AttributionBar     │  feature 003 (bottom-right)
└──────────────────────────────────────────────────────────┘
```

The 006 cluster + attribution badge share the bottom-right column.
The cluster sits above the badge by `var(--space-6)`.

## Interactions

| Trigger                                     | Surface                        | Action                                                                                                                                                |
| ------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Right-button-drag → bearing changes         | Compass icon rotates           | MapLibre fires `'rotate'`; `MapView.svelte` calls `controller.emitBearing(map.getBearing())`; `bearingSignal` updates; component re-renders.          |
| Tap compass / Enter / Space                 | Bearing animates back to 0°    | Component calls `controller.resetBearing(!reducedMotion)`. Animated path: `easeTo({ bearing: 0, duration: 600 })`. Reduced-motion: `setBearing(0)`.   |
| Tap compass when bearing is already 0       | Silent no-op                   | Controller's `resetBearing` short-circuits at ±0.5° tolerance; no animation, no console error.                                                        |
| Mouse wheel (any cursor position)           | Crosshair-anchored zoom        | `MapController.attachWheelOverride()` disabled MapLibre's `scrollZoom` and installed a custom `wheel` listener that calls `zoomBy(zoomDelta, false)`. |
| Tap **+**                                   | Zoom in by 1 level (animated)  | Component calls `controller.zoomBy(+1, !reducedMotion)`.                                                                                              |
| Tap **−**                                   | Zoom out by 1 level (animated) | Same with `-1`.                                                                                                                                       |
| Tap **+** at max zoom (or **−** at min)     | Silent no-op                   | Component's clamp check returns early; controller's clamp also catches it as defence-in-depth.                                                        |
| Keyboard activation (`Tab` + Enter / Space) | Same as the corresponding tap  | Default `<button>` semantics.                                                                                                                         |
| Standalone PWA mode                         | All controls work identically  | The cluster does not interact with feature 005's standalone gate.                                                                                     |

## i18n

Seven new keys × three locales = 21 string additions, all under
`controls.compass.*` and `controls.zoom.*`:

| Key                           | zh                | en                       | ja                  |
| ----------------------------- | ----------------- | ------------------------ | ------------------- |
| `controls.compass.label`      | `指南針`          | `Compass`                | `コンパス`          |
| `controls.compass.reset`      | `重置為正北`      | `Reset to north`         | `北を上に戻す`      |
| `controls.compass.bearingFmt` | `目前方位 {deg}°` | `Current bearing {deg}°` | `現在の方位 {deg}°` |
| `controls.zoom.in.label`      | `放大`            | `Zoom in`                | `拡大`              |
| `controls.zoom.in.disabled`   | `已達最大縮放`    | `Maximum zoom reached`   | `最大ズームに到達`  |
| `controls.zoom.out.label`     | `縮小`            | `Zoom out`               | `縮小`              |
| `controls.zoom.out.disabled`  | `已達最小縮放`    | `Minimum zoom reached`   | `最小ズームに到達`  |

`controls.compass.bearingFmt` is reserved for a future enhancement
(live bearing announcement via `aria-live`); Phase 0 of feature 006
ships the key without using it, so future feature work can flip
the announcement on without a new translation cycle.

All keys use the project-canonical `zh / en / ja` codes per
Constitution v1.1.0 Locale conventions.

## Accessibility notes

| Aspect          | Compass                                                                                                              | Zoom +/− buttons                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Element         | Real `<button type="button">`                                                                                        | Real `<button type="button">` (× 2)                                                                           |
| `aria-label`    | `controls.compass.reset` (static)                                                                                    | `controls.zoom.in.label` / `controls.zoom.out.label` (active); swaps to `.disabled` variant at clamp          |
| `aria-disabled` | n/a (reset is always allowed; no-op handled silently)                                                                | `true` at min/max zoom; `false` otherwise                                                                     |
| Tap target      | ≥ 36 × 36 px (SC-005)                                                                                                | ≥ 36 × 36 px each                                                                                             |
| Keyboard        | `Tab` reaches; `Enter` / `Space` activate                                                                            | Same; tab order is `+` → `−` → compass                                                                        |
| Contrast        | SVG strokes (`currentColor`) ≥ 4.5:1 against `--color-surface-elev` in both colour schemes. Source-token check spec. | `+` / `−` glyph ≥ 4.5:1 against `--color-surface-elev`. Source-token check spec.                              |
| Reduced motion  | Slide animation skipped per `@media (prefers-reduced-motion: reduce)` CSS rule + `setBearing` JS branch              | Disabled-state opacity transition skipped per same CSS rule; zoom uses `zoomTo({ animate: false })` JS branch |

## Acceptance scenarios met

- **US1 / FR-001..FR-005 / SC-001 / SC-002 / SC-005 / SC-006** —
  compass tracks bearing within 100 ms (asserted by integration
  test on `--compass-bearing` after `controller.emitBearing`);
  click resets within 600 ms (animated) or 50 ms (reduced motion);
  tap target ≥ 36 × 36; contrast ≥ 4.5:1 via token check.
- **US2 / FR-006..FR-009 / SC-003 / SC-004 / SC-009** — `+` / `−`
  buttons fire `controller.zoomBy(±1, animated)` with crosshair-
  anchor evidence (the controller's `zoomBy` always passes
  `{ around: map.getCenter() }`); at-clamp clicks are silent
  no-ops; the wheel override fires the same crosshair-anchored
  path; zero console errors across all paths.

## Screenshots

Captured at merge review: real-device Android (right-button drag +
button zoom), Chromium DevTools "Pixel 8" emulation (compass at
non-zero bearing), and dark-mode contrast on each control. Place
under `docs/ui/screenshots/0006-compass/`.

## Open questions

None. The single deferred decision from Phase 0 (the wheel-
override implementation choice — `scrollZoom.disable()` + custom
listener vs other approaches) was ratified in research D3 +
implemented in `MapController.attachWheelOverride()`.
