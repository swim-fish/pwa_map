---
description: 'Task list for feature 006-compass'
---

# Tasks: Compass + Crosshair-Anchored Zoom Controls

**Input**: Design documents from `/specs/006-compass/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{map-controller-amendment,bearing-signal,compass,zoom-controls}.md, quickstart.md

**Tests**: Tests are REQUIRED for every story (Constitution Principle II — TDD non-negotiable; reaffirmed in research D9). Each test slot lands and is RED BEFORE the corresponding implementation slot.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. Stories are ordered by spec priority (US1 P1 → US2 P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User-story label (US1, US2) — present on Phase 3+ tasks only
- Include exact file paths in descriptions

## Path Conventions

Single-project layout (Option 1 from plan.md). Source under `src/`, tests under `tests/{unit,integration,e2e}`, docs under `docs/{ui,adr}`. All paths are repo-relative from the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the seven new i18n strings both stories need so subsequent components compile against existing keys. No production source changes yet — these tasks touch only the three locale files plus a formatter pass.

- [X] T001 [P] Append the seven new i18n keys to `src/i18n/zh.json`: `controls.compass.label` (`指南針`), `controls.compass.reset` (`重置為正北`), `controls.compass.bearingFmt` (`目前方位 {deg}°`), `controls.zoom.in.label` (`放大`), `controls.zoom.in.disabled` (`已達最大縮放`), `controls.zoom.out.label` (`縮小`), `controls.zoom.out.disabled` (`已達最小縮放`). Keys appear in this order; values are exact per `contracts/compass.md` §7 + `contracts/zoom-controls.md` §7. Constitution Locale conventions: keep the existing `zh / en / ja` codes only.
- [X] T002 [P] Append the same seven i18n keys to `src/i18n/en.json` with the English strings tabled in `contracts/compass.md` §7 + `contracts/zoom-controls.md` §7 (`Compass`, `Reset to north`, `Current bearing {deg}°`, `Zoom in`, `Maximum zoom reached`, `Zoom out`, `Minimum zoom reached`).
- [X] T003 [P] Append the same seven i18n keys to `src/i18n/ja.json` with the Japanese strings tabled in `contracts/compass.md` §7 + `contracts/zoom-controls.md` §7 (`コンパス`, `北を上に戻す`, `現在の方位 {deg}°`, `拡大`, `最大ズームに到達`, `縮小`, `最小ズームに到達`).
- [X] T004 Run `npm run format` and `npm run lint` against `src/i18n/{zh,en,ja}.json` to confirm Constitution Principle I before any source-code work begins. Confirm `npm run typecheck` is clean (no callers reference these keys yet, but the JSON must parse).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the `MapController` amendments (bearing + zoom + wheel override), the `bearingSignal` store, and the `MapView.svelte` wiring that ALL of US1 / US2 transitively depend on. This phase MUST complete before any user-story phase begins because every story imports from these files.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T005 [P] Amend `tests/unit/map/MapController.spec.ts` with the thirteen new test cases in `contracts/map-controller-amendment.md` §8: (1) `getBearing()` with no map → 0; (2) `getBearing()` proxies to underlying; (3) `onBearing(handler)` fires immediately on subscribe; (4) `onBearing` fires on every `emitBearing` with normalised value; (5) `emitBearing` normalisation matrix (-90 → 270, 450 → 90, 360 → 0); (6) `resetBearing(true)` → `easeTo({ bearing: 0, duration: 600 })`; (7) `resetBearing(false)` → `setBearing(0)`; (8) `resetBearing` silent no-op at ±0.5° (test 0.4° AND 359.6°); (9) `zoomBy(+1, true)` → `easeTo({ zoom: z+1, around: center, duration: 200 })`; (10) `zoomBy(+1, false)` → `zoomTo(z+1, { around: center, duration: 0, animate: false })`; (11) `zoomBy(±N)` clamps to `[getMinZoom, getMaxZoom]`; (12) `attachWheelOverride()` calls `scrollZoom.disable()` + installs wheel listener that triggers `zoomBy(zoomDelta, false)`; (13) `attachWheelOverride()` is idempotent. Use `vi.spyOn` on the existing stub MapLibre map per the patterns in the file. This test set MUST land RED before T007.
- [X] T006 [P] Create `tests/unit/map/bearingSignal.spec.ts` covering the six cases in `contracts/bearing-signal.md` §4: (1) initial bearing === 0; (2) `attachToController(stub)` + `stub.emitBearing(45)` → store `{ bearing: 45 }`; (3) sequential emits update store each time; (4) re-attach detaches old subscription; (5) `__resetForTests()` resets store + detaches; (6) `subscribe(handler)` fires immediately. Use a hand-rolled stub controller exposing `onBearing(handler)` so the spec is independent of MapController internals. This test MUST land RED before T008.
- [X] T007 [P] Amend `src/map/MapController.ts` with the six new methods per `contracts/map-controller-amendment.md` §1–§7: `getBearing()`, `onBearing(handler)`, `emitBearing(deg)` (normalises to `[0, 360)`, idempotent), `resetBearing(animated)` (silent no-op at ±0.5° tolerance, branches on `animated` to `easeTo` vs `setBearing`), `zoomBy(delta, animated)` (clamps target to `[getMinZoom, getMaxZoom]`, branches to `easeTo({ around: center, duration: 200 })` vs `zoomTo({ around, duration: 0, animate: false })`), `attachWheelOverride()` (calls `map.scrollZoom.disable()`, attaches `wheel` listener with `{ passive: false }` on `map.getCanvasContainer()`, idempotent guard). Add private fields `bearingHandlers: Set<...>`, `currentBearing: number`, `wheelOverrideAttached: boolean`. After this, T005's thirteen new cases turn green.
- [X] T008 [P] Create `src/map/bearingSignal.ts` per `contracts/bearing-signal.md` §1–§3: declare `BearingState` interface, the internal `writable<BearingState>`, the public `bearingSignal: Readable<BearingState>`, the `attachToController(controller)` function (subscribes via `onBearing(deg => store.set({ bearing: deg }))`, returns the unsubscribe fn, detaches any prior subscription), and `__resetForTests()` (resets store + detaches). After this, T006's six cases turn green.

> Sequencing note for the four-task slot above: T005 / T006 are pure test edits to disjoint files and run in parallel. T007 / T008 implement disjoint files and also run in parallel after their respective tests are RED. Each pair must commit test-first per Constitution Principle II.

- [X] T009 Amend `src/components/MapView.svelte` to: (a) inside the existing `onMount` block, register `map.on('rotate', () => controller?.emitBearing(map.getBearing()))` and `map.on('rotateend', () => controller?.emitBearing(map.getBearing()))` per `data-model.md` §6 sample; (b) call `controller.attachWheelOverride()` immediately after `controller.attachUnderlying(map)`; (c) extend the existing `__mapTestHooks` block (gated by `import.meta.env.DEV || import.meta.env.MODE === 'test'`) with `triggerRotate(deg: number)` (calls `map.setBearing(deg)`) and `triggerWheelZoom({ deltaY })` (dispatches a synthetic `WheelEvent` on the canvas container); (d) call `bearingSignal.attachToController(controller)` once in the same `onMount` block so the store starts subscribing as soon as the controller has an underlying map. Module compiles cleanly (`npm run typecheck` passes).
- [X] T010 Run `npm run format` and `npm run lint` against the four touched paths (`tests/unit/map/MapController.spec.ts`, `tests/unit/map/bearingSignal.spec.ts`, `src/map/MapController.ts`, `src/map/bearingSignal.ts`, `src/components/MapView.svelte`). Confirm `npm test -- tests/unit/map/MapController.spec.ts tests/unit/map/bearingSignal.spec.ts` is green and that `npm run typecheck` is clean.

**Checkpoint**: MapController amendments, bearing store, and MapView wiring all in place. User-story phases may now proceed.

---

## Phase 3: User Story 1 — Operator orients themselves after rotating the map (Priority: P1) 🎯 MVP

**Goal**: Land the compass component and its viewport-anchor wrapper so a Chromium / WebKit / Firefox operator sees a circular compass icon at bottom-right that visibly tracks the map bearing within 100 ms of a rotate event and snaps the map back to north on a tap. Aligns with FR-001..FR-005 + SC-001 + SC-002 + SC-005 + SC-006.

**Independent Test**: With the test-only window hook (`window.__mapTestHooks.triggerRotate(90)`), the compass icon's `--compass-bearing` CSS custom property becomes `-90deg` within 100 ms; tapping `[data-testid="compass"]` calls `controller.resetBearing(true)` (or `(false)` under reduced-motion), which causes MapLibre to ease bearing back to 0 within 600 ms (or snap under reduced-motion). The compass ends at `--compass-bearing: -0deg`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T012.

- [X] T011 [P] [US1] Create `tests/integration/compass.spec.ts` covering all eight cases in `contracts/compass.md` §8: (1) mount with bearing 0 → button renders, `data-testid="compass"`, en `aria-label === 'Reset to north'`, `--compass-bearing: -0deg`; (2) `controller.emitBearing(90)` → `--compass-bearing: -90deg`; (3) `emitBearing(270)` → `--compass-bearing: -270deg`; (4) click fires `controller.resetBearing(true)` when reduced-motion is OFF (verify via `vi.spyOn(controller, 'resetBearing')`); (5) click fires `controller.resetBearing(false)` when reduced-motion is ON (stub `matchMedia` such that `(prefers-reduced-motion: reduce)` matches `true`); (6) Enter / Space activates the same path as click; (7) tap target `getBoundingClientRect()` ≥ 36 × 36; (8) `setLocale('zh')` → `aria-label === '重置為正北'`; `setLocale('ja')` → `'北を上に戻す'`. Use the same Svelte testing harness pattern from `tests/integration/install-banner.spec.ts`. Hand-roll a stub `MapController` with `onBearing` / `resetBearing` spies; do not import the real one.

### Implementation for User Story 1

- [X] T012 [US1] Create `src/components/Compass.svelte` per `contracts/compass.md` §1–§6: `<button>` always renders (no `{#if}` gating); `data-testid="compass"`; `aria-label={$tStore('controls.compass.reset')}`; inline 24×24 SVG with circle / N text / arrow / centre dot using `currentColor`; CSS custom property `--compass-bearing` driven by `-$bearingSignal.bearing`; `transform: rotate(var(--compass-bearing))` with `transition: transform 200ms ease-out`; `@media (prefers-reduced-motion: reduce)` block sets `transition: none`; `min-width: 36px; min-height: 36px;` and `border-radius: 50%`; on:click handler calls `controller.resetBearing(!reducedMotion)` where `reducedMotion` is read once at script-init via `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Component takes the `MapController` instance as a prop (`export let controller: MapController`). After this, T011 turns green.
- [X] T013 [US1] Amend `src/app/App.svelte` to: (a) `import Compass from '$components/Compass.svelte';`; (b) introduce a new `<div class="map-controls">` wrapper inside `<main class="shell">` positioned at bottom-right per `contracts/zoom-controls.md` §5 (`position: fixed; right: var(--space-4); bottom: calc(var(--space-4) + var(--space-6)); z-index: 6; display: flex; flex-direction: column; gap: var(--space-2);`). This wrapper hosts both controls; in this task we mount only `<Compass {controller} />` inside it (US2's task adds the zoom buttons in the same wrapper). Run `npm run format`.
- [X] T014 [US1] Run `npm run format`, then `npm test -- tests/integration/compass.spec.ts tests/unit/map/MapController.spec.ts tests/unit/map/bearingSignal.spec.ts`. Confirm SC-001 (100 ms tracking) is exercised by the integration spec asserting `--compass-bearing` after each `emitBearing`, and SC-005 (≥ 36 × 36 px) holds.

**Checkpoint**: US1 fully functional. Operators can rotate the map, see the compass track, and tap to reset. The map-controls wrapper now exists at bottom-right but contains only the compass; US2 will add the zoom buttons to the same wrapper.

---

## Phase 4: User Story 2 — Operator zooms with crosshair-anchored zoom on every input (Priority: P2)

**Goal**: Land the `ZoomControls` component and confirm the wheel override behaviour from Phase 2 actually keeps the centre coordinate fixed across every zoom input. The +/− buttons mount in the same wrapper as the compass and call `controller.zoomBy(±1, !reducedMotion)`; the wheel path is already wired in T009 / T007 and only needs E2E + integration verification here. Aligns with FR-006..FR-009 + SC-003 + SC-004 + SC-009.

**Independent Test**: In a Vitest integration spec, mount `ZoomControls.svelte` against a stub `MapController`; assert `[data-testid="zoom-in"]` click calls `controller.zoomBy(+1, true)`. Stub the underlying MapLibre map's `getMaxZoom()` to return `currentZoom`; confirm the button flips to `aria-disabled="true"` and clicks become silent no-ops. In E2E, `window.__mapTestHooks.triggerWheelZoom({ deltaY: 100 })` MUST advance `map.getZoom()` by ≈ −1.0 with the centre coordinate drift ≤ 0.0001° — i.e., the readout text MUST stay numerically identical (within rounding tolerance) before and after.

### Tests for User Story 2 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T016.

- [X] T015 [P] [US2] Create `tests/integration/zoom-controls.spec.ts` covering all nine cases in `contracts/zoom-controls.md` §8: (1) mid-range zoom mount → both buttons render, both `aria-disabled === "false"`, en labels are `Zoom in` / `Zoom out`; (2) `+` click → `controller.zoomBy(+1, true)` spy fires with those args; (3) `−` click → `controller.zoomBy(-1, true)`; (4) reduced-motion ON → `+` click fires `controller.zoomBy(+1, false)`; (5) at-max-zoom (stub `getMaxZoom() === currentZoom`) → `aria-disabled="true"`, `aria-label === 'Maximum zoom reached'`, click is silent no-op (`zoomBy` NOT called); (6) at-min-zoom symmetric; (7) crosshair-anchored evidence — when `controller.zoomBy(+1, false)` runs through the implementation, the underlying stub map's `zoomTo` was called with `{ around: <map.getCenter()-equivalent>, duration: 0, animate: false }` (this also doubles as US2 evidence for SC-004); (8) tap targets ≥ 36 × 36 each; (9) DOM tab order — zoom-in's `tabIndex` precedes zoom-out's. Hand-roll a stub `MapController` with `getUnderlying`, `onMove`, `zoom`, and `zoomBy` spies. Use `vi.useFakeTimers` if needed for the disabled-state opacity transition.
- [X] T016 [P] [US2] Create `tests/e2e/story-6-compass-zoom.spec.ts` with three test groups: (a) `US1 compass`: synthesise `triggerRotate(90)`, assert `[data-testid="compass"]` `style.getPropertyValue('--compass-bearing') === '-90deg'` within 1 s; click, assert it returns to `-0deg` within 1 s; (b) `US2 wheel zoom`: read the readout text, call `triggerWheelZoom({ deltaY: 100 })`, assert zoom level decreased by ≈ 1 AND the readout text is numerically equal (within ≤ 0.0001° drift, parsed via regex); repeat with `deltaY: -100` for zoom-in; (c) `SC-009 console errors`: collect `page.on('console','error')` + `page.on('pageerror')` across the entire test, assert the array is empty after all interactions. Mirror the `tests/e2e/story-5-install.spec.ts` pattern for hook waits and console-error collection.

### Implementation for User Story 2

- [X] T017 [US2] Create `src/components/ZoomControls.svelte` per `contracts/zoom-controls.md` §1–§6: two `<button>` elements with `data-testid="zoom-in"` / `zoom-out`; `aria-label` swap between active and disabled variants; `aria-disabled` reactive on `currentZoom >= maxZoom - 1e-6` / `currentZoom <= minZoom + 1e-6`; click handlers call `controller.zoomBy(±1, !reducedMotion)` after early-return on at-clamp; `onMount` reads `controller.getUnderlying().getMaxZoom() / getMinZoom()` and subscribes to `controller.onMove` to track zoom; CSS pill shape (first button radius `8px 8px 0 0`, second `0 0 8px 8px`); `+` / `−` rendered as plain text glyphs (not SVG); reduced-motion override skips the disabled-opacity transition. Component takes `export let controller: MapController`. After this, T015 turns green.
- [X] T018 [US2] Amend `src/app/App.svelte` to add `<ZoomControls {controller} />` to the `.map-controls` wrapper introduced in T013, ABOVE the `<Compass {controller} />` so the DOM tab order is zoom-in → zoom-out → compass per `contracts/zoom-controls.md` §8 (9). Run `npm run format`.
- [X] T019 [US2] Run `npm run format`, then `npm test -- tests/integration/zoom-controls.spec.ts tests/integration/compass.spec.ts tests/unit/map/MapController.spec.ts`, then `npm run build && npm run preview &` followed by `npx playwright test tests/e2e/story-6-compass-zoom.spec.ts`. Confirm SC-003 (400 ms tap-to-effect), SC-004 (≤ 1 px drift) and SC-009 (zero console errors) all pass.

**Checkpoint**: US1 + US2 both functional. Compass tracks bearing and resets on tap; +/− buttons work and respect min / max clamping; mouse-wheel zoom is now crosshair-anchored across the entire app. Map shipping-ready as MVP+US2 at this point.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle III + V deliverables, regression sweep against features 001–005, performance verification, manual smoke per `quickstart.md`.

- [X] T020 [P] Create `docs/ui/0006-compass.md` per Constitution Principle III. Capture: (a) screenshots of the bottom-right control cluster (compass + +/−) in zh / en / ja in light AND dark mode (six images; check `docs/ui/screenshots/`); (b) one screenshot of the compass at a non-zero bearing (e.g., 45°) with the `N` label visible at the rotated angle; (c) one screenshot showing the at-max-zoom disabled state on the `+` button; (d) the layout-anchor diagram from `research.md` D1 — describe how the cluster clears the attribution badge and the install banner; (e) acceptance-scenario references back to spec.md US1–US2. Follow the established structure of `docs/ui/0005-pwa-installable.md`. Append the entry to `docs/ui/README.md`'s Index table.
- [X] T021 [P] Create `docs/adr/0026-compass-and-crosshair-zoom.md` per Constitution Principle V. Document: (a) the three-method MapController amendment (bearing channel + wheel override + zoomBy), referencing `contracts/map-controller-amendment.md`; (b) the wheel-override decision (`scrollZoom.disable()` + custom `wheel` listener), with the rejected alternative (`setAroundCenter` does not exist on MapLibre 3.x); (c) the bottom-right vertical-strip anchor decision from research D1 with the conflict map; (d) the bearing-zero tolerance (±0.5°) for the silent-no-op contract. Append the entry to `docs/adr/README.md`'s Index table as `0026` with status `Accepted`. No existing ADR is superseded.
- [X] T022 [P] Create `tests/integration/controls-contrast.spec.ts` mirroring the source-token check pattern feature 005's analyze remediation introduced. Assert that `src/components/Compass.svelte` and `src/components/ZoomControls.svelte` reference `var(--color-surface-elev)`, `var(--color-fg)`, `var(--color-border)` (and `var(--color-accent)` if used) and DO NOT hard-code raw hex / rgba values for `background` / `color` (allow the standard `box-shadow` rgba and any `currentColor` usage). Closes SC-006 / FR-011.
- [X] T023 [P] Create `tests/unit/i18n/controls-keys-parity.spec.ts` asserting that every `controls.compass.*` and `controls.zoom.*` key present in `src/i18n/zh.json` is also present in `en.json` and `ja.json` (and vice versa). Closes SC-008 (i18n key parity, build-time regression net).
- [X] T024 Run the full automated suite — `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run build && npm run preview &` followed by `npx playwright test`. Address any regression in features 001–005 specs (per spec Assumptions: existing tests must still pass). Confirm `npm run build` exits cleanly and that all four test directories (`tests/unit`, `tests/integration`, `tests/e2e`, plus `tests/unit/i18n`, plus `tests/unit/map`) report green.
- [X] T025 Performance verification per `quickstart.md` §Verification budgets: run `npm run bundle-size` and confirm the gzipped main-bundle delta from the feature-005 baseline is ≤ 3 KB (SC-007). After confirming, run `npm run bundle-size -- --update-baseline` ONLY IF feature 006 is being merged to main; otherwise leave the baseline at feature 005's snapshot so subsequent feature branches measure their delta against a stable reference. If over budget, identify the largest contributor among `Compass.svelte`, `ZoomControls.svelte`, `MapController.ts` additions, `bearingSignal.ts`, and the i18n strings; reduce by inlining the SVG path more compactly, or splitting locale strings, or removing dead branches. Document the final delta in the PR description.
- [ ] T026 Manual smoke-test against `quickstart.md` §US1, §US2 in: (a) Chrome / Edge on desktop (right-button drag + wheel zoom + button zoom), (b) Chrome on Android (touch tap on compass + buttons; touch pinch is out of scope so just verify it does not break), (c) Safari on iOS (touch tap + verify wheel zoom is not applicable). Tick every acceptance scenario in spec.md by hand. Capture any UX regression and file follow-up before requesting review. Confirm SC-002 (600 ms reset) and SC-003 (400 ms tap-to-effect) feel snappy on a real Android device.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** — No source-code dependencies; touches only the three locale JSONs.
- **Phase 2 Foundational** — Independent of Phase 1 in raw compilation terms (the new modules don't import the new i18n keys yet), but BLOCKS Phase 3+ because every story imports from `MapController`, `bearingSignal`, and the rotate-event channel wired in `MapView.svelte`. Run Phase 1 first only because format / lint coverage is a Constitution Principle I gate before production-source work begins.
- **Phase 3 US1** — Depends on Phase 2 (uses `MapController.resetBearing` from T007 and `bearingSignal` from T008, plus the rotate-event wiring from T009).
- **Phase 4 US2** — Depends on Phase 3 only because both stories share the `.map-controls` wrapper introduced in T013 (US2's T018 only adds a sibling element). The MapController zoom methods and wheel override that US2 verifies are already implemented in T007 (Phase 2). US2 could in principle run partially in parallel with US1 (zoom-controls.spec.ts can land RED in parallel with compass.spec.ts), but the App.svelte amendment must serialise.
- **Phase 5 Polish** — Depends on both story phases finishing (so screenshots, the ADR, and the bundle-size delta describe the final state).

### Story Independence

- US1 and US2 are independent in spec terms. Implementation-wise they share `MapController` (already amended in Phase 2 for both) and the `.map-controls` wrapper in `App.svelte`. The compass component is fully orthogonal to the zoom-controls component; they share only the wrapper and the controller import.
- Either story can ship without the other once Phase 2 is in: the wrapper in T013 is forward-compatible with US2's later addition; US2's T017 / T018 do not require US1's compass to be present.

### Within Each User Story

- Tests MUST land RED before the implementation tasks they cover (Constitution Principle II + research D9).
- Inside each story the canonical order is: integration test → component implementation → wiring (App.svelte amendments) → verification.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).

### Parallel Opportunities

- T001 / T002 / T003 — three i18n files touched by independent tasks; run in parallel.
- T005 / T006 — two unit-test files for foundational modules; run in parallel.
- T007 / T008 — two foundational source files; different paths; run in parallel after their respective tests are RED.
- T011 — single integration test for US1 (no parallel siblings inside US1).
- T015 / T016 — US2 integration spec + E2E spec; both `[P]`.
- T020 / T021 / T022 / T023 — four polish-phase artefacts (UI doc, ADR, contrast spec, i18n parity spec); all `[P]`.

---

## Parallel Example: User Story 2

```bash
# Both US2 tests can land RED in parallel before any US2 implementation:
Task: "Create tests/integration/zoom-controls.spec.ts (T015)"
Task: "Create tests/e2e/story-6-compass-zoom.spec.ts (T016)"

# After tests are RED, the implementation runs sequentially:
# T017 (ZoomControls.svelte) → T018 (App.svelte mount in wrapper) → T019 (verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1 → STOP & VALIDATE per `quickstart.md` §US1.
2. Field-test the compass on a real Android device (right-button drag is awkward on touch; verify the touch-rotate gesture also reaches the compass via `bearing` event).
3. Ship if the compass tracks within 100 ms and reset works within 600 ms.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready (MapController amended, bearing store live, MapView wired, wheel override active — note that wheel override is already in effect after T007 + T009 even before US2 ships, so wheel zoom is crosshair-anchored as soon as Phase 2 lands).
2. Add US1 → independent test → MVP demo (compass tracks + resets).
3. Add US2 → independent test → +/− buttons + E2E console-error sweep ship.
4. Phase 5 Polish → ADR + UI doc + contrast spec + i18n parity spec + perf verification + manual smoke → merge-ready.

### Parallel Team Strategy

After Phase 2 completes, the two stories can be split across reviewers:

- Developer A: US1 (T011–T014) — Compass component + integration test + App.svelte mount.
- Developer B: US2 (T015–T019) — Zoom controls + E2E + App.svelte sibling.

Both converge into Phase 5 Polish.

---

## Notes

- `[P]` tasks operate on disjoint files; verify before parallel-launching.
- `[Story]` label is REQUIRED on Phase 3 / 4 tasks and absent on Phase 1 / 2 / 5 tasks.
- Constitution Principle II is non-negotiable: every implementation task MUST follow at least one previously-failing test in the same story (or in the foundational phase for shared modules).
- Run `npm run format` after every code edit (Development Workflow).
- Update `docs/ui/` for visible UI changes — covered by T020.
- Update the ADR index after each `/speckit.analyze` and `/speckit.implement` — covered by T021.
- Persisted-schema invariants (ADR 0021): `pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1`, `pwa_map:offlineReadyShown`, `pwa_map:installDismissedUntil` are NOT modified by this feature; no new persisted keys are introduced.
- Locale-convention compliance: every new i18n key uses the existing `zh / en / ja` codes verbatim. No new locale identifier introduced.
- MapLibre 3.x APIs in use (`scrollZoom.disable`, `easeTo`, `zoomTo`, `setBearing`, `getBearing`, `getCanvasContainer`) are documented contracts; no minor-version bump required.
- Features 001–005 specs MUST keep passing — running them is part of T024.
- Wheel override is active app-wide after Phase 2 lands; if a regression appears in features 001–005's E2E tests due to the wheel re-anchoring, the fix is in `MapController.attachWheelOverride` (the contract) — NOT by patching the affected test, since the new wheel anchor is the documented behaviour going forward.
