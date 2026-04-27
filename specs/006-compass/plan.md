# Implementation Plan: Compass + Crosshair-Anchored Zoom Controls

**Branch**: `006-compass` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-compass/spec.md`

## Summary

Land three small, tightly-coupled UI controls that turn the existing
MapLibre map into a usable precision-coordinate tool:

1. **Compass** (US1, P1 / MVP) — a small circular icon whose SVG
   rotates synchronously with the map's `bearing`. Tapping it (mouse,
   touch, keyboard) calls a new `MapController.resetBearing()` that
   eases the map back to bearing 0° (or snaps under
   `prefers-reduced-motion: reduce`). The icon shows an "N" label
   plus a north-pointing arrow so the orientation is unambiguous on
   monochrome backgrounds.

2. **Zoom controls** (US2, P2) — an upright **+** / **−** button
   pair next to the compass. Tapping or keyboard-activating either
   button calls `MapController.zoomBy(±1)`, which is internally
   crosshair-anchored.

3. **Crosshair-anchored mouse-wheel zoom** (US2, P2) — re-anchor
   MapLibre's built-in wheel zoom to the visual centre of the
   viewport (the crosshair), replacing its default
   cursor-anchored behaviour. Implementation: disable
   `map.scrollZoom`, attach a custom `wheel` listener on the
   container, debounce, and call `map.zoomTo(targetZoom, { around:
   map.getCenter() })`. This is the only non-trivial implementation
   bit (see research D3).

Technical approach: keep TypeScript + Svelte 4 + Vite +
vite-plugin-pwa toolchain. **No new runtime dependency.** All work
goes through MapLibre 3.x's documented APIs (`getBearing`,
`setBearing`, `easeTo({ bearing, around })`, `zoomTo({ around })`,
`scrollZoom.disable`). The new code mirrors feature 005's pattern:
two new UI components, one Svelte store (`bearingSignal`) for
reactive bearing reads, three new `MapController` methods, plus
i18n entries in three locales. Tests are TDD-first: Vitest unit
specs for the new controller methods + the bearing store; Vitest
integration for the two components and the keyboard / reduced-motion
paths; one Playwright E2E that drives a synthetic rotate via the
test hook and asserts compass tracking + reset.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target) — inherited
from features 001–005.

**Primary Dependencies**:

- `svelte` 4.x — UI framework. The two new components reuse the
  existing toolbar / dialog / banner placement model.
- `maplibre-gl` 3.x — map engine. **No version bump.** The new
  controller methods use the documented `getBearing()`,
  `easeTo({ bearing, around })`, `setBearing()`, `zoomTo({ around })`,
  `scrollZoom.disable()`, and the `'rotate'` / `'rotateend'` event
  surface. None of these APIs have moved between 3.x minors.
- Standard browser APIs only: `window.matchMedia`,
  `requestAnimationFrame`, `KeyboardEvent`, `WheelEvent`.
- **No new runtime deps. No new test deps.**

**Storage**: **None**. Bearing and zoom are MapLibre-owned state
already round-tripped through `pwa_map:lastView` (feature 001's
`saveLastView`). This feature adds zero new persistent keys; ADR
0021 (additive prefs evolution) is unaffected.

**Testing**: Vitest (unit + integration) + Playwright (E2E).

- Unit specs run in jsdom. The new controller methods are tested
  directly against a stub MapLibre map (already used by
  `tests/unit/map/MapController.spec.ts`). The `bearingSignal`
  store is tested in isolation against `MapController` events.
- Integration specs mount the two components against a stubbed
  controller and assert: SVG transform reflects bearing; click /
  Enter / Space all trigger `resetBearing()`; reduced-motion
  override skips the easing; `+` / `−` clamping at min / max zoom
  emits `aria-disabled` and a silent no-op.
- E2E (Playwright, Chromium) drives a test-only
  `window.__mapTestHooks.triggerRotate(deg)` and
  `window.__mapTestHooks.triggerWheelZoom({ deltaY })` (gated to
  `import.meta.env.DEV || import.meta.env.MODE === 'test'`, same
  pattern as `triggerBeforeInstallPrompt` from feature 005).

**Target Platform**: Same as features 001–005:

- Chromium (desktop + Android) 120+, WebKit / iOS Safari 15+,
  Firefox 120+ desktop, Firefox Android.
- All controls (compass + zoom +/−) work identically across all
  five.

**Project Type**: Single project — extension of the existing PWA.
No backend, no new package boundary, no new top-level directory.

**Performance Goals**:

- Compass icon SVG transform updates within **100 ms** of a
  MapLibre `rotate` event (SC-001) — measured by integration test
  that fires the event and reads `transform` style.
- Bearing-reset animation completes within **600 ms** wall-clock
  under normal motion preferences (SC-002); ≤ 50 ms snap under
  `prefers-reduced-motion: reduce`.
- Zoom +/− tap-to-effect within **400 ms** (SC-003).
- Crosshair drift across any zoom interaction (wheel, button, kbd):
  ≤ **1 px on-screen** = ≤ 0.0001° at zoom 13 (SC-004).
- Cumulative bundle delta from this feature: ≤ **3 KB** gzipped on
  the entry JS bundle (SC-007). Verified by
  `scripts/check-bundle-size.js` baseline-vs-current delta gate
  (added in feature 005's analyze remediation).

**Constraints**:

- WCAG AA contrast (Principle III + ADR 0014) — all three controls
  MUST hit ≥ 4.5:1 for icon strokes / glyphs in light AND dark
  schemes, reusing the established tokens.
- Tap targets ≥ 36 × 36 px (SC-005 + ADR 0014).
- Locale conventions: every new i18n key uses `zh / en / ja` only.
- Reduced-motion compliance — both compass rotation and bearing
  reset animation MUST honour `prefers-reduced-motion: reduce`.
- Layout non-conflict — control group MUST NOT overlap the existing
  feature-003 toolbar (top-right), feature-004 update prompt
  (top-centre), feature-005 install banner (bottom-right above
  attribution) or iOS sheet (bottom-centre), feature-001
  coordinate readout (bottom-left), feature-003 attribution badge
  (bottom-right). Anchor pick documented in research D1.

**Scale/Scope**:

- 2 new components (`Compass.svelte`, `ZoomControls.svelte`).
- 1 new module: `src/map/bearingSignal.ts` — Svelte writable +
  bootstrap that subscribes to `MapController` rotate events.
- 1 amended module: `src/map/MapController.ts` — adds
  `getBearing()`, `resetBearing(animated: boolean)`,
  `zoomBy(delta: number)`, `attachWheelOverride()`, plus a
  rotate-event channel (`onBearing(handler)` /
  `emitBearing(deg)`).
- 1 amended module: `src/components/MapView.svelte` — wires the
  MapLibre `'rotate'` / `'rotateend'` events to the controller's
  emitter; calls `attachWheelOverride()` on mount; exposes the new
  test hooks under `__mapTestHooks`.
- 1 amended module: `src/app/App.svelte` — mounts `<Compass />` and
  `<ZoomControls />` in the chosen anchor.
- ~7 new i18n keys under `controls.compass.*` and `controls.zoom.*`
  × 3 locales = ~21 string additions.
- 1 new ADR (ADR 0026 — compass + crosshair-anchored zoom + wheel
  override design).
- 1 new UI record (`docs/ui/0006-compass.md`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                       | Verdict     | Justification                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **I. Code Quality & Formatting**                | PASS        | All new files (TS + Svelte) ride the existing Prettier + ESLint flat config. `npm run format` mandatory after edits per Development Workflow. No new linter rule, no new style.                                                                                                                                                                       |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | Each user story has explicit failing-tests-first slots in Phase-2 tasks: unit (`MapController` new methods, `bearingSignal`), integration (`Compass`, `ZoomControls`, reduced-motion), E2E (synthetic rotate + wheel zoom). Tests-before-implementation enforced in `tasks.md`. The wheel-override behaviour is unit-tested via a stub MapLibre handler. |
| **III. User Experience Consistency**            | PASS w/ doc | Two visible UI surfaces and one new viewport-anchor cluster. New `docs/ui/0006-compass.md` mandatory before merge. Tokens reused; no new colour value introduced. Both controls honour `prefers-reduced-motion: reduce`. Tap targets ≥ 36 × 36 px. WCAG AA contrast via the same source-token check pattern feature 004 / 005 use.                       |
| **IV. Performance Requirements**                | PASS        | Four explicit budgets in **Performance Goals**: SC-001 (100 ms compass tracking), SC-002 (600 ms reset), SC-003 (400 ms zoom action), SC-007 (≤ 3 KB gzipped bundle delta). All measurable: integration tests for SC-001..SC-004; bundle-size delta gate (added in 005's analyze remediation) for SC-007.                                                |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0026 (compass + crosshair-anchored zoom + wheel override). ADR index updated post-implement. The `docs/ui/0006-compass.md` UI record covers Principle III. No existing ADR is superseded.                                                                                                                                     |

**Locale convention compliance** — every new i18n key uses the
existing `zh / en / ja` locales verbatim (`controls.compass.*`,
`controls.zoom.*`). No new locale identifier introduced.

**Result**: All five principles pass on the planned design. No
unjustified violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-compass/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output
├── contracts/
│   ├── compass.md                         # Compass.svelte contract
│   ├── zoom-controls.md                   # ZoomControls.svelte contract
│   ├── bearing-signal.md                  # bearingSignal store API
│   └── map-controller-amendment.md        # New MapController methods + wheel override
├── checklists/
│   └── requirements.md                    # /speckit.specify output (already exists)
└── tasks.md                               # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   └── App.svelte                          # AMENDED — mount Compass + ZoomControls
├── components/
│   ├── Compass.svelte                      # NEW — bearing-reactive icon + reset button
│   ├── ZoomControls.svelte                 # NEW — +/- buttons
│   └── MapView.svelte                      # AMENDED — wire rotate event + attach wheel override + test hooks
├── map/
│   ├── MapController.ts                    # AMENDED — getBearing / resetBearing / zoomBy / attachWheelOverride / onBearing
│   └── bearingSignal.ts                    # NEW — Svelte writable + subscribe to MapController
└── i18n/
    ├── zh.json                             # AMENDED — controls.compass.* + controls.zoom.* keys
    ├── en.json                             # AMENDED — same keys
    └── ja.json                             # AMENDED — same keys

tests/
├── unit/
│   ├── map/
│   │   ├── MapController.spec.ts           # AMENDED — tests for new methods
│   │   └── bearingSignal.spec.ts           # NEW — store actions + bootstrap
├── integration/
│   ├── compass.spec.ts                     # NEW — render + click + keyboard + reduced-motion
│   └── zoom-controls.spec.ts               # NEW — buttons + clamping + crosshair drift
└── e2e/
    └── story-6-compass-zoom.spec.ts        # NEW — synthetic rotate + wheel zoom

docs/
├── ui/
│   └── 0006-compass.md                     # NEW — UI record per Principle III
└── adr/
    └── 0026-compass-and-crosshair-zoom.md  # NEW — design + wheel-override decision

vite.config.ts                              # UNCHANGED
```

**Structure Decision**: Single-project layout (Option 1 from the
template) — same as features 001–005. No new package boundaries, no
new top-level directories. Each new file lives next to existing peers
(`src/components/*`, `src/map/*`, `tests/unit/map`, `tests/integration`,
`tests/e2e`, `docs/{ui,adr}`).

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | (none)     | (none)                               |
