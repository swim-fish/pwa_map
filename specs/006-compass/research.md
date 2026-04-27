# Phase 0 Research: Compass + Crosshair-Anchored Zoom Controls

**Feature**: `006-compass` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves every "NEEDS CLARIFICATION" implied by the plan
into concrete decisions. Decisions are numbered D1..D9 and are
referenced by ID from `data-model.md`, the `contracts/` files, and
`tasks.md`.

---

## D1. Control-group viewport anchor: bottom-right vertical strip, between the attribution badge and the install banner

**Decision**: All three new controls (compass, **+**, **−**) live in
a single vertical strip anchored at the **bottom-right** of the
viewport, **stacked vertically** in the order **+** / **−** /
compass (top to bottom), and **vertically positioned just above the
feature-005 install banner anchor** so they clear:

- the **attribution badge** (bottom-right, single-line, ~24 px tall)
- the **install banner** (anchored at
  `bottom: calc(var(--space-4) + var(--space-6))`, ~80 px tall when
  rendered)

Concretely:

```css
.map-controls {
  position: fixed;
  right: var(--space-4, 16px);
  bottom: calc(var(--space-4, 16px) + var(--space-6, 24px) + var(--install-banner-height, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  z-index: 6;
}
```

When the install banner is NOT mounted (the common case — banner is
gated by `surface ∈ {'android-chromium', 'desktop-chromium'}`), the
`--install-banner-height` custom property defaults to `0` so the
controls drop down to sit directly above the attribution.

**Rationale**: The bottom-right zone is the most "low-traffic"
quadrant for a Taiwan coordinate map (the user's eye is anchored on
the centre crosshair and the bottom-left coordinate readout). The
top-right is already saturated with the toolbar (Go-to / Format /
Layers / Locale). The top-centre is occupied by the
`UpdatePrompt` (feature 004). The bottom-centre is the toast column
(feature 001-004) plus the iOS install sheet (feature 005). Putting
the controls in the same column as the existing attribution badge
follows the Google Maps / Mapbox convention (both anchor zoom
controls at bottom-right) — operators have strong muscle memory for
this position from other map tools.

**Conflict map** (existing surfaces from features 001–005):

| Surface                                       | Anchor                            | Owner       |
| --------------------------------------------- | --------------------------------- | ----------- |
| Toolbar (Go-to / Format / Layers / Locale)    | top-right                         | feature 003 |
| `UpdatePrompt`                                | top-centre                        | feature 004 |
| Toast column (copy / zone / layer / offline)  | top-centre, ~32 px below header   | features 001–004 |
| Coordinate readout                            | bottom-left                       | feature 001 |
| Attribution badge                             | bottom-right (single-line)        | feature 003 |
| Layer / Locale picker (popovers)              | top-right (toolbar-anchored)      | feature 003 |
| Crosshair                                     | viewport centre                   | feature 001 |
| `InstallBanner` (Android/desktop)             | bottom-right above attribution    | feature 005 |
| `InstallIosSheet`                             | bottom-centre                     | feature 005 |
| **Map controls (compass + +/−)** (NEW)        | **bottom-right above install banner / attribution**   | feature 006 |

**Alternatives considered**:

- **Top-right beneath the toolbar** — rejected. Stacks below four
  existing toolbar buttons; the cluster would look disorganised and
  the layer / locale popovers (which open downward) would visually
  collide with the compass.
- **Bottom-left below the coordinate readout** — rejected. The
  readout is a multi-line text panel that already extends ~120 px
  upward; placing controls below it pushes them off the visible
  viewport on phone-height screens.
- **Top-left** — rejected. Mobile browsers' URL bar and Safari's
  bottom toolbar both occupy that vertical band intermittently; the
  controls would jump as the bars hide / show.
- **Floating in the centre on a long-press** — rejected. Two extra
  taps for a one-tap action; violates Principle III (consistency
  with existing immediate-action buttons).

---

## D2. Read map bearing reactively via the `'rotate'` event, NOT polling

**Decision**: Subscribe to MapLibre's `'rotate'` event on the `Map`
instance. Emit a `MapBearingEvent` from `MapController` to all
registered listeners on every `'rotate'` event. The Svelte writable
in `bearingSignal.ts` is one such listener; it updates its internal
`bearing` field via `store.update`, which propagates to the
`Compass.svelte` component via Svelte's reactivity.

```ts
// MapController.ts (excerpt)
onBearing(handler: (deg: number) => void): () => void { ... }

// MapView.svelte onMount block
map.on('rotate', () => controller.emitBearing(map.getBearing()));
```

**Rationale**: MapLibre fires `'rotate'` continuously during a
right-button-drag (~60 Hz) and on every programmatic `easeTo`
animation frame. Polling via `requestAnimationFrame` would either
miss frames (if throttled) or burn CPU during idle periods.
Event-driven is cheaper and aligns with how feature 001's `move` /
`moveend` already wires the controller.

**Alternatives considered**:

- **Poll `map.getBearing()` via `requestAnimationFrame`** — rejected;
  causes redundant work when the map is idle and adds frame latency
  during active rotation.
- **Subscribe directly inside `Compass.svelte`** — rejected; bypasses
  the MapController abstraction and breaks the unit-test isolation
  pattern (MapController is mockable; raw MapLibre is not).
- **Use `'rotateend'` only** — rejected; the user's expectation
  (SC-001: ≤ 100 ms compass tracking) requires sub-frame updates
  during the rotation, not just at the end.

---

## D3. Crosshair-anchored mouse-wheel zoom: disable `scrollZoom`, attach a custom `wheel` listener

**Decision**: On `MapController.attachWheelOverride()` (called once
from `MapView.svelte`'s `onMount`):

1. Call `map.scrollZoom.disable()` to remove MapLibre's built-in
   cursor-anchored wheel handler.
2. Attach a `wheel` event listener (with `{ passive: false }`) to
   the map's container element.
3. In the listener:
   a. Call `event.preventDefault()` to suppress page scroll.
   b. Convert `deltaY` to a zoom delta using MapLibre's standard
      sensitivity: `zoomDelta = -event.deltaY / 100` (clamped to
      `[-1, 1]` per wheel tick — same as MapLibre's default).
   c. Compute `targetZoom = clamp(map.getZoom() + zoomDelta,
      map.getMinZoom(), map.getMaxZoom())`.
   d. If `targetZoom === currentZoom`, return (silent no-op at
      clamp).
   e. Call `map.zoomTo(targetZoom, { around: map.getCenter(),
      duration: 0, animate: false })` so the change is
      crosshair-anchored AND instantaneous (matching the wheel's
      perceived directness).

**Rationale**: MapLibre 3.x's `ScrollZoomHandler` is
hard-coded to use the cursor's pointer position as the zoom anchor
via `aroundPoint` internally; the public `setZoomRate` /
`setWheelZoomRate` knobs adjust sensitivity but NOT the anchor. The
documented escape hatch for custom anchoring is to disable the
built-in handler and reimplement the wheel path. This is the
approach used by major MapLibre integrations (e.g., Mapbox Studio's
"zoom from centre" preference, the deck.gl
`MapView.controller.scrollZoom = { around: 'center' }` shim).

The `duration: 0, animate: false` flags match the wheel's
psycho-visual expectation: wheel scrolls feel like direct
manipulation, not animations. (Button taps will use `duration: 200`
for a smooth zoom — see D4.)

**Alternatives considered**:

- **`map.scrollZoom.setAroundCenter(true)`** — does not exist in
  MapLibre 3.x. (Mapbox GL JS has a similar option that MapLibre
  did not port.)
- **Patch MapLibre's `ScrollZoomHandler` source** — rejected;
  forking a vendor library is a maintenance burden and breaks on
  every minor version bump.
- **Wrap wheel events at the container level via Svelte's
  `on:wheel`** — works, but moves the override into a UI component
  (`MapView.svelte`) that should be presentation-only. Keeping the
  override inside `MapController` matches the constitutional
  testability boundary (MapController is mockable; raw MapLibre +
  DOM events are not).
- **Zoom via `easeTo({ zoom, around })` for the wheel path too** —
  rejected; `easeTo` always animates (default 300 ms); chaining
  multiple wheel ticks would visibly stutter as one easeTo
  cancelled the next. The button path uses a short `easeTo` (200 ms)
  because button taps are discrete; the wheel path uses
  `zoomTo({ animate: false })` because wheel ticks are continuous.

---

## D4. Bearing-reset animation: `easeTo({ bearing: 0, duration: 600 })`, snap under reduced motion

**Decision**: `MapController.resetBearing(animated: boolean)`
implementation:

```ts
resetBearing(animated: boolean): void {
  const map = this.underlying as maplibregl.Map | null;
  if (!map) return;
  if (Math.abs(map.getBearing()) <= 0.5) return; // FR-005 silent no-op
  if (animated) {
    map.easeTo({ bearing: 0, duration: 600 });
  } else {
    map.setBearing(0);
  }
}
```

The component (`Compass.svelte`) decides which mode to call by
reading `prefers-reduced-motion: reduce` at script-init (mirrors the
feature-005 `InstallBanner.svelte` pattern). Wheel-anchored zoom uses
`zoomTo({ animate: false })` (D3); button-driven zoom uses
`zoomBy(±1)` which internally calls `easeTo({ zoom: ..., around:
center, duration: 200 })` for a perceptible smooth transition under
normal motion, snap under reduced motion.

**Rationale**: 600 ms is the documented MapLibre default for
`easeTo` and matches feature 002's flyTo duration — same vocabulary
of motion. The 0.5° tolerance for "is bearing zero?" means a tap
when bearing is already 0° (within float-rounding noise) does not
trigger a no-op animation, satisfying FR-005's silent-no-op
requirement.

**Alternatives considered**:

- **`flyTo`** — overkill; `flyTo` does centre + zoom + bearing
  changes in one camera-flight; we only want bearing.
- **Custom `requestAnimationFrame` easing** — rejected; reinvents
  the wheel and creates a code path MapLibre's own internals don't
  expect.
- **`rotateTo({ duration })`** — rotateTo exists but is internally
  `easeTo({ bearing })`; we use the more explicit form.

---

## D5. Compass icon design: SVG with N label + arrow, slate fill in light mode, white-stroke in dark mode

**Decision**: The compass icon is an inline SVG inside
`Compass.svelte` that renders a circle (24 px radius, viewBox
`0 0 48 48`), an upright **N** label centred at the top, a north-
pointing chevron / arrow above the centre, and a small centre dot.
The arrow + N text use `currentColor` so they track the surrounding
button's foreground colour. The whole `<svg>` element is wrapped in
a `<button>` with `min-width: 36px; min-height: 36px;` (SC-005);
the button rotates (NOT the SVG inner content) via
`transform: rotate(-bearing deg)` so the rotation centre is the
icon's geometric centre, and the rotation matches the visual
expectation that "the compass rotates against the world" (i.e.,
when bearing = 90°, the N points to the LEFT).

**Rationale**: A single-element rotation (the button's transform)
is far simpler than rotating the inner `<g>`. It also lets the
button's focus / hover ring stay aligned with the viewport rather
than tilting with the bearing. Using `currentColor` for strokes
means dark mode "just works" via the existing token scheme — no
duplicate icons, no media-query forks.

The N label is non-negotiable: an arrow alone is ambiguous (does
it point in the heading direction or in the "you should go this
way to face north" direction?). The N + arrow combination matches
the universal in-vehicle compass convention.

**Alternatives considered**:

- **Apple-style "pizza slice" compass** (red half + grey half) —
  rejected; introduces a non-token red colour and is less
  recognisable on a 36 px target.
- **Pure arrow without N** — rejected; ambiguous direction
  semantics (see above).
- **Bitmap PNG** — rejected; doesn't scale with retina, costs more
  bytes than the inline SVG (~150 bytes vs ~3 KB).

---

## D6. Reduced-motion: skip easing on bearing reset AND on button-driven zoom; CSS animation override on the components

**Decision**: Three separate motion paths, all gated by
`prefers-reduced-motion: reduce`:

1. **Compass icon rotation** — under normal motion, the
   `transform: rotate(...)` change has a `transition: transform
   200ms ease-out` for visual smoothness as the bearing animates
   during a right-drag. Under reduced motion, the transition is set
   to `none` via a `@media (prefers-reduced-motion: reduce)` block
   — the rotation snaps in place.

2. **Bearing reset** — when the compass is tapped under reduced
   motion, `resetBearing(animated=false)` is called, which uses
   `setBearing(0)` (instantaneous) instead of `easeTo({ bearing:
   0, duration: 600 })`. The compass's CSS rule from path 1
   ensures the icon also snaps to upright.

3. **Button-driven zoom** — `zoomBy(±1)` under normal motion uses
   `easeTo({ zoom: target, around: centre, duration: 200 })`; under
   reduced motion uses `zoomTo({ animate: false })`. The button's
   own click feedback (e.g., a subtle scale-down on `:active`) also
   has a `transition: transform 80ms` that is gated.

**Rationale**: Honouring reduced-motion is Principle III
non-negotiable (from feature 002's accessibility baseline ADR
0014). The pattern of "JS reads the media query at mount, decides
which API path to call; CSS @media block also overrides any
remaining transitions" is identical to feature 005's
`InstallBanner.svelte` and `InstallIosSheet.svelte` — keeping the
mental model consistent across the codebase.

**Alternatives considered**:

- **Skip animations entirely (no reduced-motion check)** — rejected;
  loses the polish of smooth rotation during a drag for normal-
  motion users. The drag itself emits dozens of `'rotate'` events;
  a 200 ms ease-out smooths the visual interpolation.
- **Always animate, even under reduced motion** — rejected;
  violates FR-014 / SC-002.

---

## D7. Test-only window hooks: `triggerRotate(deg)` and `triggerWheelZoom({ deltaY })`

**Decision**: `MapView.svelte`'s `onMount` block extends the
existing `__mapTestHooks` object (already used by feature 001's
`setCenter` / `startScriptedPan` and feature 005's
`triggerBeforeInstallPrompt`) with two new entries, gated by
`import.meta.env.DEV || import.meta.env.MODE === 'test'`:

```ts
hooks.triggerRotate = (deg: number): void => {
  map.setBearing(deg);
};
hooks.triggerWheelZoom = (opts: { deltaY: number }): void => {
  const evt = new WheelEvent('wheel', { deltaY: opts.deltaY, bubbles: true });
  container.dispatchEvent(evt);
};
```

**Rationale**: Real `wheel` events from a Playwright page-level
`mouse.wheel()` call do work, but their delta values are
platform-dependent (Linux line scroll vs macOS pixel scroll vs
Windows). Synthetic events with explicit `deltaY: 100` give the
E2E spec deterministic input. Real right-button-drag is hard to
script reliably across browsers; `setBearing(deg)` lets the spec
verify the compass tracking + reset path without dragging.

The synthetic events flow through the same custom wheel handler
(D3) as real events, so this exercises the actual production code
path — it is not "testing the test hook".

**Alternatives considered**:

- **Drive Playwright's `mouse.wheel()`** — rejected; deltaY is
  platform-dependent and our wheel handler converts deltaY → zoom
  via a fixed `/100` divisor that won't see consistent input.
- **Mock `MapLibre.Map.scrollZoom`** — rejected; we DISABLE
  scrollZoom in this feature, so mocking the original module is
  irrelevant.

---

## D8. i18n keys: `controls.compass.*` and `controls.zoom.*`

**Decision**: Seven new keys total (across the two control families),
each in `zh / en / ja`:

| Key                            | zh                    | en                                      | ja                              |
| ------------------------------ | --------------------- | --------------------------------------- | ------------------------------- |
| `controls.compass.label`       | `指南針`              | `Compass`                               | `コンパス`                      |
| `controls.compass.reset`       | `重置為正北`          | `Reset to north`                        | `北を上に戻す`                  |
| `controls.compass.bearingFmt`  | `目前方位 {deg}°`     | `Current bearing {deg}°`                | `現在の方位 {deg}°`             |
| `controls.zoom.in.label`       | `放大`                | `Zoom in`                               | `拡大`                          |
| `controls.zoom.out.label`      | `縮小`                | `Zoom out`                              | `縮小`                          |
| `controls.zoom.in.disabled`    | `已達最大縮放`        | `Maximum zoom reached`                  | `最大ズームに到達`              |
| `controls.zoom.out.disabled`   | `已達最小縮放`        | `Minimum zoom reached`                  | `最小ズームに到達`              |

The `bearingFmt` key uses `{deg}` interpolation (already supported
by `src/i18n/index.ts`) so the announced value updates with the
current bearing.

**Rationale**: Naming follows the `<group>.<surface>.<role>`
pattern established by feature 003's `map.layers.*` and feature 005's
`pwa.install.*` keys. `controls.zoom.in.disabled` lets the
component swap the `aria-label` at clamp without re-keying the
entire button.

**Alternatives considered**:

- **One `controls.zoom.label` with `{action: 'in' | 'out'}`
  interpolation** — rejected; the i18n module's interpolation
  helper is single-template-per-key, and combining "in" / "out"
  would force every locale to handle string-concat which is
  error-prone in zh / ja word order.
- **Reuse `goto.*` namespace** — rejected; goto is "navigate to a
  point", not "manipulate camera".

---

## D9. TDD ordering reaffirmation

**Decision**: Constitution Principle II (Test-First Development —
NON-NEGOTIABLE) is restated explicitly because feature 006 introduces
a custom wheel handler (D3) and bearing-reset logic (D4) that are
both tempting to implement first and test later. The TDD discipline
is:

1. Write the unit / integration spec for the behaviour.
2. Run `npm test` and confirm the spec is **RED** (it must fail
   because the behaviour is not yet implemented).
3. Implement only enough production code to turn the spec green.
4. Refactor with the test green.

The custom wheel handler MUST land its unit test (asserting
crosshair drift = 0 after a synthetic wheel event) BEFORE the
implementation lands. The bearing-reset MUST land its unit test
asserting `easeTo({ bearing: 0, duration: 600 })` is called with
those exact arguments (via spy on the stub MapLibre map) BEFORE the
controller implementation lands.

**Rationale**: The wheel handler is the highest-risk piece of
this feature (it overrides a vendor handler). A regression here
would silently break crosshair-anchored zoom for every operator on
every load, with no console error. Test-first is the cheapest
preventive measure.

**Alternatives considered**: None. TDD is non-negotiable per
constitution.

---

## Cross-decision matrix

| ID | Affects                                                                             |
| -- | ----------------------------------------------------------------------------------- |
| D1 | `Compass.svelte`, `ZoomControls.svelte`, `App.svelte`, `docs/ui/0006-compass.md`    |
| D2 | `MapController.ts`, `bearingSignal.ts`, `MapView.svelte`                            |
| D3 | `MapController.ts` (`attachWheelOverride`), `MapView.svelte`, integration tests     |
| D4 | `MapController.ts` (`resetBearing`, `zoomBy`)                                       |
| D5 | `Compass.svelte` (SVG + CSS), `docs/ui/0006-compass.md`                             |
| D6 | both new components, `docs/ui/0006-compass.md`                                      |
| D7 | `MapView.svelte` (test hook block), all integration + E2E tests                     |
| D8 | `src/i18n/{zh,en,ja}.json`, both new components                                     |
| D9 | `tasks.md` ordering                                                                 |
