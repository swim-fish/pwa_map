# Feature Specification: Compass + Crosshair-Anchored Zoom Controls

**Feature Branch**: `006-compass`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User descriptions:

1. "新增一個指南針：當操作者旋轉地圖（含 MapLibre 預設的右鍵拖曳手勢、未來可能的觸控雙指旋轉、鍵盤旋轉）時，指南針圖示同步旋轉以反映目前地圖 bearing；點擊指南針即可把 bearing 重置為 0（正北）。"
2. "地圖放大以中央的準星為主，新增放大縮小地圖按鈕 (+/-)"
3. (correction) "可以使用滑鼠與按鈕但是以地圖中心為放大縮小中心點"

## Clarifications

### Session 2026-04-26

- Q: Mouse-wheel zoom — keep MapLibre's default cursor-anchored
  behaviour or also re-anchor to the central crosshair? → A:
  **Re-anchor to the crosshair**. All zoom paths (mouse wheel,
  +/- buttons, future keyboard, future touch pinch) MUST anchor
  on the visual centre of the viewport (the crosshair position).
  This means overriding MapLibre's default `scrollZoom` to use
  `{ around: 'center' }` (or its equivalent on the active
  MapLibre version).
- Q: When the bearing-reset animation runs, should it interrupt an
  in-progress map gesture? → A: No interrupt. If a right-button
  drag is mid-rotation, the click on the compass is queued until
  the gesture finishes, then the animation runs.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Operator orients themselves after rotating the map (Priority: P1) 🎯 MVP

A field operator rotates the map (e.g., to align with their physical
heading by right-button-dragging) and after a few zoom / pan moves
loses track of which direction is north. They expect a small compass
control somewhere near the toolbar that (a) visibly tracks the
current map bearing as they rotate, and (b) snaps the map back to
north on a single tap. They never want to type degrees or remember
keyboard shortcuts.

**Why this priority**: This is the entire reason feature 006 exists.
MapLibre exposes right-button-drag rotation by default but offers no
in-app way to undo it; operators frequently end up with non-north-up
maps and cannot easily recover. Without this, power-users who use
rotation are stranded; new users who accidentally rotate (right-click
drag is easy to trigger by mistake) lose orientation entirely.

**Independent Test**: With no other change, mount the app on the
preview server, programmatically rotate the map to bearing 90° via
the test hook (or right-button-drag manually). The compass icon MUST
visibly rotate so its "N" / arrow points 90° counter-clockwise within
100 ms of the bearing change. Tapping the compass MUST animate the
map back to bearing 0° within 600 ms and the compass MUST end pointing
straight up.

**Acceptance Scenarios**:

1. **Given** a fresh page load with bearing = 0, **When** the user
   right-button-drags the map by 45°, **Then** the compass icon's
   visual rotation MUST track the new bearing within 100 ms, with no
   visual stutter.
2. **Given** the bearing is non-zero, **When** the user taps the
   compass, **Then** the map MUST animate back to bearing 0° within
   600 ms (animated easing) and the compass MUST end at the upright
   orientation.
3. **Given** `prefers-reduced-motion: reduce` is set, **When** the
   user taps the compass, **Then** the map bearing MUST snap to 0
   without an easing animation; the compass also snaps without
   transition.
4. **Given** the user activates the compass via keyboard (Tab to
   focus + Enter / Space), **Then** the same reset behaviour fires
   as a tap.
5. **Given** the bearing is already 0 (within ±0.5°), **When** the
   user taps the compass, **Then** no animation runs and no console
   error is raised; the action is a silent no-op.

---

### User Story 2 - Operator zooms the map with crosshair-anchored zoom on every input (Priority: P2)

An operator wants every zoom interaction — mouse wheel, **+** / **−**
buttons, future keyboard shortcuts, future touch-pinch — to zoom in
on the geographic point currently under the central crosshair (the
same coordinate shown in the live readout). The default MapLibre
behaviour zooms toward the cursor position on a wheel scroll, which
moves the point of interest off-centre. Operators doing precision
coordinate work want to be able to centre on a coordinate, then zoom
without losing it.

**Why this priority**: P2 because all zoom paths still work today
(mouse wheel does zoom; only +/- buttons are missing). The change is
about the *anchor point* of every zoom path. It's a measurable
improvement for precision coordinate work but does not block the
fundamental ability to navigate the map.

**Independent Test**: Open the preview, note the readout (say
`25.0336, 121.5644` at zoom 13). Scroll the mouse wheel up. Zoom
MUST increase and the readout MUST still show the same coordinate
(within ≤ 0.0001° drift). Tap the **+** button. Same outcome. Tap
**−**, same. Activate **+** via keyboard (Tab + Enter), same.

**Acceptance Scenarios**:

1. **Given** the map is at zoom Z and centred on point P, **When**
   the user scrolls the mouse wheel up while the cursor is in any
   off-centre position, **Then** the zoom level MUST become Z + Δ
   (where Δ is MapLibre's wheel sensitivity, typically ~0.5 per
   wheel tick) and the geographic point under the central crosshair
   MUST still be P (within ≤ 1 px on-screen drift), regardless of
   where the cursor was.
2. **Given** the same starting state, **When** the user taps **+**,
   **Then** the zoom MUST become Z + 1 (clamped at MapLibre's
   `getMaxZoom()`) with the same crosshair-fixed property.
3. **Given** the same starting state, **When** the user taps **−**,
   **Then** the zoom MUST become Z − 1 (clamped at `getMinZoom()`)
   with the same crosshair-fixed property.
4. **Given** the user activates **+** or **−** via keyboard, **Then**
   the same crosshair-anchored zoom MUST apply.
5. **Given** the map is at the maximum zoom level, **When** the
   user taps **+** or scrolls the wheel up, **Then** the action
   MUST be a silent no-op; the **+** button MUST visually indicate
   disabled state and `aria-disabled="true"`. No console error MUST
   fire.
6. **Given** the map is at the minimum zoom level, the same inverse
   case applies for **−** and wheel-down.

---

### Edge Cases

- **Bearing wrap-around**: If the bearing crosses 360° / 0° during a
  rotation, the compass icon MUST take the shortest visual path
  (e.g., 350° → 10° rotates +20°, not −340°).
- **Reset during active rotation**: If the user is mid-right-button
  drag and clicks the compass control on a separate input, the
  reset MUST queue and run after the current gesture ends; no torn
  state.
- **Bearing reset interrupts an existing easeTo**: If a previous
  `easeTo({ bearing: ... })` is still animating when the user
  clicks the compass, the new reset MUST take precedence (cancel
  the previous animation, start fresh).
- **Zoom + simultaneous pan**: If the user is mid-pan-drag and taps
  **+**, the pan completes first; the zoom queues. No torn state.
- **Min/max zoom clamping**: Already covered in US2 acceptance, but
  also: scrolling the wheel past the max zoom MUST be a silent
  no-op (no console error, no toast); same for the buttons.
- **Touch pinch-to-zoom (future)**: When MapLibre's pinch gesture
  fires, it currently anchors at the midpoint between the two
  fingers. Re-anchoring pinch to the crosshair is OUT OF SCOPE for
  this feature (see Out of Scope), but documented here for future
  reference.
- **Standalone PWA mode**: All controls MUST work identically;
  the compass and zoom buttons are NOT install-affordance surfaces
  (so feature 005's standalone gate does not affect them).
- **Reduced motion**: The compass rotation animation, the bearing-
  reset easing, and any zoom animation MUST all skip their motion
  under `prefers-reduced-motion: reduce`.

## Requirements _(mandatory)_

### Functional Requirements

#### Compass control (US1)

- **FR-001**: A compass control MUST render in the viewport at all
  times that the map is mounted (i.e., NOT hidden behind a "show
  compass" preference).
- **FR-002**: The compass icon's visual rotation MUST track the
  current map bearing reactively, updating within 100 ms of any
  bearing change.
- **FR-003**: Activating the compass (mouse click, touch tap, or
  keyboard Enter / Space while focused) MUST reset the map bearing
  to 0° using an animated easing under normal motion preferences,
  or an instantaneous snap under `prefers-reduced-motion: reduce`.
- **FR-004**: The compass MUST be focusable via the keyboard `Tab`
  cycle, and MUST expose an `aria-label` localised in `zh / en / ja`
  that describes the action (e.g., "Compass — tap to reset to
  north"); the current bearing MAY also be conveyed via a live
  region (e.g., `aria-valuenow` if implemented as `role="slider"`,
  or a separate `aria-live="polite"` announcement) but is OPTIONAL
  for AA compliance.
- **FR-005**: When `bearing === 0` (within ±0.5° tolerance), the
  compass MUST be rendered in its upright orientation and a tap
  MUST be a silent no-op (no console error, no animation).

#### Zoom controls (US2)

- **FR-006**: Two zoom controls (**+** to zoom in, **−** to zoom
  out) MUST render in the viewport at all times the map is mounted.
- **FR-007**: Activating **+** MUST increase the zoom level by 1
  (clamped at MapLibre's `getMaxZoom()`); activating **−** MUST
  decrease by 1 (clamped at `getMinZoom()`). Activation methods
  include mouse click, touch tap, and keyboard Enter / Space.
- **FR-008**: **All zoom interactions** — mouse wheel, **+**/**−**
  buttons, keyboard shortcuts, future touch pinch — MUST anchor
  the zoom on the visual centre of the viewport (the crosshair
  position), NOT on cursor position or any other point. The
  geographic coordinate under the central crosshair before the
  zoom MUST equal the coordinate under the crosshair after the
  zoom (within ≤ 1 px on-screen drift). This requires overriding
  MapLibre's default cursor-anchored `scrollZoom` behaviour.
- **FR-009**: When the zoom level is at max (resp. min), the **+**
  (resp. **−**) button MUST appear in a visually disabled state
  (per existing token contracts), MUST set `aria-disabled="true"`,
  and MUST NOT fire a zoom action when activated. Mouse-wheel
  scrolls past the limit MUST also be silent no-ops (no console
  error).

#### Cross-cutting (a11y / i18n / layout)

- **FR-010**: All three controls (compass, +, −) MUST measure
  ≥ 36 × 36 px tap targets (Constitution Principle III + ADR 0014).
- **FR-011**: All three controls MUST meet WCAG AA contrast
  (≥ 4.5:1 for any iconography stroke against the control's
  background) in both light and dark colour schemes, reusing the
  existing tokens (`--color-surface-elev`, `--color-fg`,
  `--color-border`, `--color-accent`).
- **FR-012**: The control group MUST NOT visually overlap the
  feature 003 toolbar (top-right), the feature 005 install banner
  (bottom-right above attribution), the feature 005 iOS sheet
  (bottom-centre), the feature 004 update prompt (top-centre), the
  feature 003 attribution badge (bottom-right single-line), the
  feature 001 coordinate readout (bottom-left), or any of the
  feature 001-004 transient toast surfaces (top-centre / bottom-
  centre, z-index 50). The picked viewport anchor MUST be
  documented in `docs/ui/0006-*.md`.
- **FR-013**: All control labels and `aria-label` text MUST be
  localised in `zh / en / ja` per Constitution v1.1.0 Locale
  conventions; new keys live under `controls.compass.*` and
  `controls.zoom.*`.
- **FR-014**: All control animations (compass rotation, bearing-
  reset easing, button press / hover transitions, zoom animation)
  MUST honour `prefers-reduced-motion: reduce` and skip the motion
  when set.
- **FR-015**: No console error MUST be raised by feature 006's own
  code path during normal operation (load, rotate, reset, wheel
  zoom in/out, button zoom in/out, min/max clamp, reduced-motion
  path).

### Key Entities

- **CompassState**: A transient in-memory record `{ bearing: number
  /* current bearing in degrees, [0, 360) */ }`. Not persisted;
  rebuilt every page load from the MapLibre map's current bearing
  on mount and refreshed via the `rotate` event.
- **ZoomGesture**: A transient action triggered by the wheel,
  **+**, **−**, or keyboard. Inputs vary per source (delta from
  the wheel event, fixed +1 / −1 for the buttons / keyboard); the
  implementation derives the target zoom from the current map
  zoom, clamped to MapLibre's `[getMinZoom(), getMaxZoom()]` range.
  The zoom call MUST always pass the equivalent of `{ around:
  <viewport-centre> }` so the anchor is the crosshair, not the
  cursor.
- **MapBearing**: The current bearing of the underlying MapLibre
  map. Read via `map.getBearing()`; written via
  `map.easeTo({ bearing: 0 })` (animated) or `map.setBearing(0)`
  (instantaneous, reduced-motion path).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The compass icon MUST visually reflect a bearing
  change within **100 ms** of the underlying map's `rotate` event
  in **100 %** of measurements (verified by an integration test
  that programmatically rotates the map and asserts the icon's
  transform).
- **SC-002**: Clicking the compass when bearing ≠ 0 MUST complete
  the bearing-reset animation within **600 ms** under normal
  motion; under `prefers-reduced-motion: reduce` the bearing MUST
  become 0 within **50 ms** of the click.
- **SC-003**: Tapping **+** MUST advance the zoom level by exactly
  **+1.0** (resp. −1.0 for **−**), measured as `map.getZoom()`-
  after − `map.getZoom()`-before, within **400 ms** of the tap.
- **SC-004**: The geographic point under the central crosshair MUST
  drift by ≤ **1 px** on-screen (≤ 0.0001° at zoom 13) across a
  single zoom interaction — wheel tick, button tap, or keyboard
  activation. Verified by integration tests for each input source.
- **SC-005**: All three controls (compass, +, −) MUST measure
  ≥ **36 × 36 px** tap targets in jsdom integration tests.
- **SC-006**: WCAG AA contrast (≥ **4.5:1**) MUST hold for the
  compass icon stroke and the **+** / **−** glyph against the
  control surface in both colour schemes.
- **SC-007**: Cumulative bundle-size delta from this feature MUST
  be ≤ **3 KB** gzipped on the main bundle (one compass component,
  one zoom-controls component, one MapController amendment, ≤ 8
  i18n strings × 3 locales).
- **SC-008**: **100 %** of new control copy MUST be localised in
  `zh / en / ja` — verified by a build-time check that all
  `controls.compass.*` and `controls.zoom.*` keys exist in all
  three locale files.
- **SC-009**: **0** browser-console errors MUST be raised across
  all seven paths: (a) load with bearing 0, (b) rotate via right-
  drag, (c) tap compass to reset, (d) wheel zoom in/out at non-
  limit, (e) wheel zoom past the limit (no-op), (f) tap **+** at
  non-max zoom, (g) tap **+** at max zoom (no-op).

## Assumptions

- **MapLibre's `easeTo`, `setBearing`, and `scrollZoom` APIs are
  stable**. MapLibre 3.x is the active engine (per ADR 0002); the
  `bearing` event, `getBearing()` / `setBearing()` /
  `easeTo({ bearing })`, and `scrollZoom.setZoomRate` /
  `scrollZoom.disable` / custom wheel handler are documented
  contracts that this feature relies on.
- **The MapController abstraction (feature 001) MUST gain
  several methods**: `getBearing()`, `resetBearing(animated:
  boolean)`, `zoomBy(delta: number)` (always crosshair-anchored
  internally), and possibly `setScrollZoomAnchor('center' |
  'cursor')` to override MapLibre's default. The actual MapLibre
  calls live inside the MapController; the components are
  MapLibre-agnostic and only call the controller's methods. This
  keeps the Constitution's testability boundary intact.
- **Re-anchoring mouse-wheel zoom MAY require disabling
  MapLibre's built-in `scrollZoom` and reimplementing the wheel
  handler**. MapLibre 3.x's `ScrollZoomHandler` does not directly
  expose an `around: 'center'` option for wheel events — the
  default is cursor-anchored and the documented escape hatch is to
  intercept the wheel event manually. This is an implementation
  concern but called out here so the planner does not assume a
  one-line `setOption` fix.
- **The compass and zoom buttons share one viewport anchor
  group**. Treating them as one cluster (e.g., a vertical strip
  in one corner) keeps the layout single-column and avoids
  introducing two new anchors; the layout decision is recorded
  in `docs/ui/0006-*.md`.
- **No persistent state**. Bearing and zoom are MapLibre-owned
  state already round-tripped through `pwa_map:lastView`
  (feature 001's saveLastView). This feature adds NO new
  localStorage key.
- **Touch pinch-zoom is out of scope for this feature**.
  MapLibre handles it natively (cursor / midpoint-anchored).
  Re-anchoring it to the crosshair is a future feature.
- **Existing tests for features 001-005 MUST continue to pass**.
  Specifically: feature 001's MapController unit tests, feature
  005's install affordance, and feature 003's layer / locale
  pickers MUST not regress. The toolbar's existing top-right
  anchor MUST not be visually crowded by the new control group
  (anchor decision: bottom-right vertical strip below the
  attribution badge OR top-right beneath the toolbar — to be
  ratified at `/speckit.plan`).

## Out of Scope

- **Touch pinch-to-zoom re-anchoring** to the crosshair (still
  uses MapLibre's default midpoint anchor).
- **Compass tilt indicator** (3D pitch). The current map is
  always pitch = 0; this feature does not introduce a tilt UI.
- **Custom rotation gestures** (e.g., two-finger rotate on
  touch screens). MapLibre handles touch rotation natively;
  this feature only re-uses that bearing through the compass
  display.
- **Persisting compass on/off state**. The compass is always
  visible; no preference toggle.
- **Auto-rotate based on device heading** (compass alignment
  with device sensor). Out of scope; this feature's compass
  reflects the *map* bearing, not the device.
- **Shift-drag-to-zoom box selection** (some MapLibre default).
  Out of scope; the wheel + buttons + keyboard cover the zoom
  surface.
