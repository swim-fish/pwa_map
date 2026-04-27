# Quickstart: Compass + Crosshair-Anchored Zoom (feature 006)

**Branch**: `006-compass` | **Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This is the operator-friendly walkthrough for verifying feature 006
end-to-end after `/speckit.implement` has run. Two user stories,
five acceptance paths, eight edge cases — keep this short.

## Pre-flight (one-time)

```bash
git checkout 006-compass
npm install              # if node_modules has not been refreshed
npm run lint             # zero warnings allowed (Constitution Principle I)
npm run typecheck
npm test                 # all unit + integration green
npm run build            # production bundle in dist/
npm run bundle-size      # SC-007: ≤ 3 KB gzipped delta from feature 005
```

Optional:

```bash
npm run preview          # serves dist/ on http://localhost:4173
npm run test:e2e         # Playwright (Chromium) — drives synthetic rotate + wheel
```

## Story-by-story manual verification

### US1 — Compass tracks bearing + click resets to north (P1, MVP)

1. **Setup**: open Chrome / Edge / Firefox / Safari on the preview
   URL. Note the compass icon in the bottom-right viewport
   strip (above the attribution badge, below the install banner if
   one is rendered). The `N` label should be at the top of the
   icon.
2. **Right-button-drag the map** by 90° clockwise (drag right →
   left while holding right mouse button). Within 100 ms the
   compass icon's `N` should rotate 90° counter-clockwise (so it
   now points to the LEFT of the icon — because the world rotated
   right under the compass).
3. **Tap the compass**. The map MUST animate back to north within
   600 ms; the compass returns to upright.
4. **Re-rotate to 45°, enable `prefers-reduced-motion: reduce`** in
   DevTools (Rendering tab → "Emulate CSS media feature
   prefers-reduced-motion: reduce"). Tap compass — the bearing MUST
   snap to 0 in under 50 ms with no easing animation.
5. **Tap the compass when bearing is already 0**: nothing happens
   (no animation, no console error). This confirms FR-005.

Acceptance: SC-001 (100 ms tracking) + SC-002 (600 ms reset; 50 ms
under reduced motion).

**If the compass does not track**: confirm `MapView.svelte`'s
MapLibre `'rotate'` event listener is calling
`controller.emitBearing(map.getBearing())`. If yes, confirm
`bearingSignal.attachToController(...)` was called once at module
init; if you replaced the controller in tests via
`__resetForTests()`, you may need to re-attach.

### US2 — Crosshair-anchored zoom on every input (P2)

1. **Setup**: open the preview, note the readout (e.g.,
   `25.0336, 121.5644` at zoom 13).
2. **Mouse wheel up**: zoom MUST increase and the readout MUST still
   show the same coordinate (within ≤ 0.0001° drift). Try wheel-down
   too.
3. **Move the cursor to the bottom-right corner of the viewport,
   then wheel up**: the zoom anchor MUST still be the centre
   crosshair, NOT the cursor. Confirm by watching the readout —
   the same coordinate stays under the crosshair.
4. **Tap the `+` button**: zoom level + 1; readout still matches.
5. **Tap the `−` button**: zoom level − 1; readout still matches.
6. **Activate `+` via keyboard** (Tab to focus → Enter or Space):
   same crosshair-anchored behaviour.
7. **Zoom to MapLibre's max (default 22)**: the `+` button MUST
   appear disabled (lower opacity, `aria-disabled="true"`); a click
   MUST be a silent no-op (no console error).
8. **Symmetric `−` at min zoom (default 0)**: same.

Acceptance: SC-003 (400 ms tap-to-effect) + SC-004 (≤ 1 px drift).

**Cross-check on touch devices**: the `+` / `−` buttons MUST be
≥ 36 × 36 px tap targets (manual smoke on a real Pixel / iPhone, or
DevTools "Pixel 8" emulation with `Mobile` toggle).

## Smoke checks for edge cases (spec §Edge Cases)

| Scenario                                            | Expected outcome                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bearing wraps 359° → 0° during a long drag         | Compass icon takes the shortest visual path (a slight clockwise rotation, not a 359° counter-clockwise spin).                                          |
| Compass clicked during an active right-button drag  | Reset queues; runs after the drag ends. No torn state.                                                                                                  |
| Compass clicked during a previous easeTo            | New reset cancels the previous animation cleanly.                                                                                                      |
| Pan + zoom button tapped simultaneously              | Pan completes first; zoom queues. No torn state.                                                                                                       |
| Wheel scroll past max zoom                          | Silent no-op. No console error. No visible easing.                                                                                                     |
| Wheel scroll past min zoom                          | Same.                                                                                                                                                  |
| Standalone PWA mode (launched from home-screen icon) | Both controls render and work identically.                                                                                                              |
| Reduced motion enabled                              | Compass icon snaps without `transform` transition; reset bearing snaps via `setBearing(0)` rather than `easeTo`. `+` / `−` zoom is `zoomTo({ animate: false })`. |

## Verification budgets (Constitution Principle IV)

| Budget                                                       | Source       | Verified by                                                                  |
| ------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------- |
| Compass tracks bearing within 100 ms                          | SC-001       | `tests/integration/compass.spec.ts` (asserts `--compass-bearing` after emit) |
| Bearing reset animation ≤ 600 ms (≤ 50 ms reduced-motion)    | SC-002       | Manual smoke + `tests/unit/map/MapController.spec.ts` (asserts `easeTo` args) |
| `+` / `−` tap-to-effect ≤ 400 ms                              | SC-003       | `tests/integration/zoom-controls.spec.ts` (asserts `zoomBy` args)             |
| Crosshair drift ≤ 1 px on any zoom interaction                | SC-004       | `tests/unit/map/MapController.spec.ts` + `tests/integration/zoom-controls.spec.ts` |
| Tap targets ≥ 36 × 36 px                                     | SC-005       | Both integration specs                                                       |
| WCAG AA contrast (≥ 4.5:1) on glyph / icon                    | SC-006       | Source-token check spec (mirrors feature-005 `install-contrast.spec.ts`)     |
| Bundle delta ≤ 3 KB gzipped                                   | SC-007       | `npm run bundle-size` (delta gate from baseline)                              |
| 100 % i18n coverage on new keys (zh / en / ja)                 | SC-008       | i18n key-parity spec (mirrors feature-005 i18n parity check if added)         |
| 0 console errors across 7 paths                              | SC-009       | Playwright E2E + manual smoke                                                |

## Rollback path

The feature is purely additive:

- No manifest change → uninstalling the feature affects no PWA state.
- No SW change → offline-first behaviour from feature 004 stays intact.
- No prefs schema change → `pwa_map:prefs` is untouched.
- The wheel override is reversible by removing
  `controller.attachWheelOverride()` from `MapView.svelte`'s
  `onMount` — MapLibre's built-in `scrollZoom` re-enables itself.

To roll back: revert the merge commit. The two new components, the
new store, and the controller method additions disappear; existing
tests for features 001–005 continue to pass.

## Where to look first when something breaks

- **Compass does not rotate**: `MapView.svelte`'s `'rotate'` event
  listener missing or not calling `controller.emitBearing`.
- **Compass tap does nothing**: the `Compass.svelte` `onClick`
  handler isn't calling `controller.resetBearing(...)`. Check
  `bearingSignal` subscribed; check the silent-no-op tolerance
  (`Math.abs(bearing) ≤ 0.5°`) isn't triggering for non-zero bearings.
- **Wheel zoom still cursor-anchored**: `attachWheelOverride()` not
  being called in `MapView.svelte`'s `onMount` after
  `attachUnderlying`. Verify by running
  `__mapTestHooks.triggerWheelZoom({ deltaY: 100 })` from DevTools
  console — if the readout drifts, the override hasn't installed.
- **`+` / `−` does not anchor on crosshair**: `zoomBy` not passing
  `{ around: map.getCenter() }`. Check `MapController.zoomBy` source.
- **`aria-disabled` not flipping at clamp**: `ZoomControls.svelte`
  not subscribed to `controller.onMove`. Check the `onMount` block.
