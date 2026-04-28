---

description: "Task list for feature 013-locate-controls-layout"
---

# Tasks: Top-Left Map Controls + My-Location Button with Permission, Short-Tap Toggle, Long-Press Stop, and Update-Frequency Setting

**Input**: Design documents from `/specs/013-locate-controls-layout/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/ (5 contract files), quickstart.md

**Tests**: Required by Constitution Principle II (TDD non-negotiable).
Every behavioural change lands a RED test BEFORE its implementation lands GREEN.

**Organization**: Tasks are grouped by user story so each story can be
implemented and tested independently. Setup + Foundational tasks (Phases 1–2)
are blocking prerequisites for all user-story phases.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are absolute relative to repo root (`C:\Users\hhhnr\source\repos\pwa_map`)

## Path Conventions

Single-project Svelte + Vite PWA. Source under `src/`, tests under `tests/`,
docs under `docs/`. All paths shown below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline; register the `@property` rule that the
long-press radial progress visual depends on.

- [X] T001 Confirm `npm install` is clean and lockfile unchanged (no new deps for this feature)
- [X] T002 Register `@property --progress { syntax: '<percentage>'; initial-value: 0%; inherits: false }` in `src/app/tokens.css` (required for the radial progress visual to interpolate)
- [X] T003 Run `npm run format && npm run lint && npm run typecheck && npm test` to confirm a clean baseline before any change

**Checkpoint**: Toolchain green, `--progress` registered. Foundational phase can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure infrastructure consumed by every user story —
state machine, persisted preferences schema, i18n keys, signal store.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests (RED — must fail before implementation lands)

- [X] T004 [P] Author `tests/unit/locate-machine.spec.ts` covering: (a) `INITIAL_SNAPSHOT` shape + frozen, (b) all 18 transition table cells from `contracts/locate-machine.md`, (c) `shortTap` from `off` is no-op when `permission ∈ {denied, unavailable}`, (d) `firstFix` updates `lastFix` without changing state, (e) `permissionDenied` / `permissionUnavailable` force state to `off`, (f) every returned snapshot is `Object.isFrozen`, (g) grep guard: source file MUST NOT import `$components/*`, `$pwa/*`, `$map/MapController`, `$map/geolocationController`, `$map/locateSignal`, MUST NOT reference `window` / `document` / `navigator` / `Date.now` / `setTimeout`. **32 tests GREEN**.
- [X] T005 [P] Author `tests/unit/preferences-v4-migration.spec.ts` covering all 11 migration matrix cases from `contracts/preferences-v4-locate-frequency.md`: v4 round-trip × 3 frequencies, v4 invalid frequency → smart fallback, v4 missing field → smart fallback, v3 / v2 / v1 → smart fallback, unknown version → full default fallback, corrupt JSON → full default fallback, `defaultPreferences().locateFrequency === 'smart'`, `loadLocateFrequency()` reads, `saveLocateFrequency('slow')` round-trips without clobbering other fields. **21 tests GREEN**.
- [X] T006 [P] Author `tests/unit/i18n/locate-keys-parity.spec.ts` asserting these 16 keys exist in `src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json` (4 toast + 4 button-aria + 1 holdToStop + 7 settings = 16). **4 tests GREEN**.
- [X] T007 [P] Author `tests/unit/locate-frequency-cadence.spec.ts` covering: `frequencyToWatchOptions('smart')` / `'fast'` / `'slow'` return the documented `PositionOptions` triples; Slow min-dispatch throttle drops fixes < 10 s apart; Smart "promote on movement" upgrades to high-accuracy for 5 s after two consecutive fixes show ≥ 1 m/s motion. **8 tests GREEN**.

### Implementation (GREEN — turn tests green in dependency order)

- [X] T008 Implement `src/map/locateMachine.ts` per `contracts/locate-machine.md` — pure module with `LocateState`, `LocateEvent`, `LocatePermissionState`, `PositionFix`, `LocateMachineSnapshot`, `INITIAL_SNAPSHOT` (frozen), `transition(snapshot, event)` covering the 18-cell table. No DOM / clock / map imports. Turns T004 GREEN.
- [X] T009 Modify `src/storage/preferences.ts` per `contracts/preferences-v4-locate-frequency.md` — add `LocateFrequencyPreset` type, `LOCATE_FREQUENCIES` array, `isLocateFrequency` validator, bump `PREFS_VERSION 3 → 4`, define `FormatPreferencesV4`, update `defaultPreferences()` with `locateFrequency: 'smart'`, extend `validatePreferences` to migrate v1/v2/v3 records additively, add `loadLocateFrequency()` / `saveLocateFrequency(value)` convenience functions, extend `__TESTING__` with `LOCATE_FREQUENCIES` + `LOCATE_FREQUENCY_DEFAULT`. Turns T005 GREEN. Existing `preferences-defaults.spec.ts` / `preferences-format-order.spec.ts` / `preferences-v2.spec.ts` updated to assert `version: 4`.
- [X] T010 [P] Add the 16 new keys to `src/i18n/zh.json` (Traditional Chinese — canonical locale `zh`). Turns zh half of T006 GREEN.
- [X] T011 [P] Add the 16 new keys to `src/i18n/en.json`. Turns en half of T006 GREEN.
- [X] T012 [P] Add the 16 new keys to `src/i18n/ja.json`. Turns ja half of T006 GREEN.
- [X] T013 Implement `src/map/locateSignal.ts` — Svelte readable store wrapping a single `LocateMachineSnapshot`; export `applyLocateEvent(event: LocateEvent)` mutator + `patchPressStartedAt(value)` helper; export `__TESTING__.resetLocateSignal()` for tests. Mirrors `bearingSignal` shape.
- [X] T014 Implement `src/map/geolocationController.ts` per `contracts/geolocation-controller.md` — `GeolocationController` class with `queryPermission()` / `start(preset)` / `stop()` / `dispose()` / `isRunning` / `currentPreset`; `frequencyToWatchOptions(preset)` exported function; Slow min-dispatch throttle; Smart promote-on-movement burst (haversine speed); error normalisation; 5 s debounce on codes 2/3. Turns T007 GREEN.

**Checkpoint**: State machine, preferences v4, i18n parity, watcher wrapper, signal store all GREEN. User story phases can begin in parallel.

---

## Phase 3: User Story 1 — Top-left cluster relocation (Priority: P1) 🎯 MVP layout

**Goal**: Move the on-map control cluster from the left-edge vertical centre to the upper-left, in DOM order compass → my-location → zoom-in → zoom-out, while preserving the safe-area token discipline.

**Independent Test**: With no other story implemented, mount App.svelte and verify (a) the cluster's anchoring tokens (top + inline-left), (b) DOM order, (c) no overlap with toolbar / readout / notification region across 320 / 568 landscape / 390 / 1440 px viewports, (d) `safe-area-tokens.spec.ts` grep guards pass with the new top-left assertions. (Note: until US2's LocateButton ships, the cluster has only 3 children — compass, zoom-in, zoom-out. Tests must work with both 3-child and 4-child cluster shapes, asserting compass is always first.)

### Tests (RED — write first)

- [X] T015 [P] [US1] Author `tests/integration/cluster-layout-top-left.spec.ts` per `contracts/cluster-layout.md` — 9 tests covering top + left token composition, no top:50% / transform / bottom / right / env(), z-index 6, flex column with --space-2 gap, DOM-order compass before zoom (locate slot conditional). **9 tests GREEN**.
- [X] T016 [US1] Modify `tests/integration/safe-area-layout.spec.ts` — replace the feature-011 left-center .map-controls block with a feature-013 top-left block asserting top + left token composition and no top:50% / transform / bottom / right declarations. **GREEN**.
- [ ] T017 [P] [US1] Author `tests/e2e/cluster-layout.e2e.spec.ts` exercising real-browser geometry on Chromium 1440 × 900, 390 × 844 with simulated 47 px top inset, 320 × 568, 568 × 320; capture screenshots into `docs/ui/screenshots/0013-cluster-{viewport}.png`. **DEFERRED — write before /speckit.implement final pass; not blocking the integration assertion.**

### Implementation (GREEN)

- [X] T018 [US1] Modify `src/app/App.svelte` `.map-controls` CSS rule — replaced `top: 50%; transform: translateY(-50%)` with `top: calc(var(--space-3) + var(--top-stack-zone-top))`. Left declaration unchanged (already uses --inline-stack-zone-left). Comment updated to describe the new top-left rationale.
- [X] T019 [US1] Modify `src/app/App.svelte` template — DOM order is now `<Compass/> <LocateButton/> <ZoomControls/>` (LocateButton inserted as part of US2 T022).

**Checkpoint**: Cluster anchored at top-left with the documented order. Visual validation via `npm run dev` matches `quickstart.md` US1 walkthrough.

---

## Phase 4: User Story 2 — Permission flow on first short-tap (Priority: P1)

**Goal**: First short-tap of the my-location button (a) requests geolocation permission synchronously inside the `pointerup` user-gesture handler (iOS Safari constraint), (b) on grant transitions state Off → Show with a position marker rendered within 5 s, (c) on denial / unavailable surfaces a zh notification through the existing notification region and returns the button to Off without freezing.

**Independent Test**: With permission state `prompt` / `denied` / `unavailable` / `granted-from-prior-session` simulated via `navigator.permissions.query` mock, exercise the first tap and assert (a) call-order spy proves geolocation API invoked synchronously inside `pointerup`, (b) toast surfaces in zh with the documented key, (c) state and visual reflect the outcome.

### Tests (RED — write first; can run in parallel with US1 tests)

- [X] T020 [P] [US2] Author `tests/integration/locate-button-permission.spec.ts` — 8 tests covering: FR-009 (no API call at mount), FR-010 (synchronous user-gesture invariant via call-order spy), permission granted → fix renders + state Show, permission denied → toast + state stays off, prior-denied → toast without watchPosition call, geolocation API absent → button aria-disabled, aria-keyshortcuts attribute, zh accessible name per state. **8 tests GREEN**.

### Implementation (GREEN — depends on Phase 2's T013 + T014)

- [X] T021 [US2] Create `src/components/LocateButton.svelte` — `controller: MapController` prop (held for US3); subscribe to `$locateSignal`; lazily construct a `GeolocationController` on first activation; pre-flight permission probe via `queryPermission()`; on short-tap from Off, synchronously invoke `geo.start(preset)` from `loadLocateFrequency()` so iOS Safari sees the user-gesture coupling; route onFix → `applyLocateEvent({ type: 'firstFix' })` + dispatch `fix` event; route onPermissionDenied / onPositionUnavailable / onTimeout → dispatch `error` event with i18n key. Three state visuals (`.state-off` / `.state-show` / `.state-follow`), `aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"`, `touch-action: manipulation; user-select: none` (for US3 long-press).
- [X] T022 [US2] Modify `src/app/App.svelte` — import `LocateButton`; mount as the second child of `<div class="map-controls">` between `<Compass/>` and `<ZoomControls/>`; bind `on:error` to a local `showLocateError(detail)` handler. (Marker mount via `controller.attachLocateMarker` deferred to US3 T030.)
- [X] T023 [US2] Wire `NotificationRegion.svelte` consumer — added `locateErrorToast` state to App.svelte and a new `<div class="toast" role="alert" data-testid="locate-error-toast">` slotted into the existing `<NotificationRegion>`. The toast auto-dismisses after 5 s, mirroring the `layerFailToast` pattern.

**Checkpoint**: First tap from a fresh profile triggers the native permission prompt; grant renders the marker; deny surfaces the zh toast and returns to Off. iOS Safari user-gesture invariant satisfied.

---

## Phase 5: User Story 3 — Gesture model: short-tap toggle + long-press stop + keyboard chord (Priority: P1)

**Goal**: Implement the full gesture model — short-tap toggles Show ↔ Follow with first-tap-from-Off going to Show; long-press ≥ 1.5 s reaches Off (or `Shift+Enter` / `Shift+Space` while focused); manual pan in Follow auto-demotes to Show; `prefers-reduced-motion: reduce` suppresses the radial progress fill and announces "按住停止…" via aria-live; the 1.5 s threshold still fires Stop.

**Independent Test**: With permission granted, exercise (a) short-tap cycle Show ↔ Follow, (b) long-press ≥ 1.5 s reaches Off and < 1.5 s release falls back to short-tap, (c) `Shift+Enter` from Show / Follow reaches Off, (d) manual pan in Follow demotes to Show without explicit gesture, (e) reduced-motion fallback announces via aria-live without animating.

### Tests (RED — write all in parallel; depend only on Phase 2 + US2 component shell)

- [X] T024 [P] [US3] Author `tests/integration/locate-button-cycle.spec.ts` — 4 tests for short-tap cycle Off→Show→Follow→Show + recenter only in Follow + Follow auto-recenter on every new fix. **GREEN**.
- [X] T025 [P] [US3] Author `tests/integration/locate-button-long-press.spec.ts` — 5 tests with `vi.useFakeTimers()` covering 1500 ms threshold from Show/Follow → Off, 1000 ms release → toggle, 800 ms pointercancel → no change, Off press → no-op + no `pressing` class. **GREEN**.
- [X] T026 [P] [US3] Author `tests/integration/locate-button-keyboard.spec.ts` — 7 tests covering Enter/Space toggle, Shift+Enter/Shift+Space stop, Off+Shift no-op, aria-keyshortcuts attribute. **GREEN**.
- [X] T027 [P] [US3] Author `tests/integration/locate-button-reduced-motion.spec.ts` — 3 tests covering aria-live announcement on pointerdown, clearing on release, 1.5 s threshold still firing Stop under reduce-motion. **GREEN**.
- [X] T028 [P] [US3] Author `tests/integration/locate-manual-pan-demote.spec.ts` — 5 tests covering manualPan from Follow→Show / Show→Show / Off→Off + permission/lastFix preservation. **GREEN**.
- [ ] T029 [P] [US3] Author `tests/e2e/locate-long-press.e2e.spec.ts` exercising real `pointerdown` / wait 1.6 s / `pointerup` for Stop; release at 1.0 s for toggle. Run on Chromium with touch emulation. **DEFERRED** — non-blocking; integration coverage is GREEN.

### Implementation (GREEN — within-story sequencing matters)

- [X] T030 [US3] Extend `src/map/MapController.ts` — added `recenterTo(target, animated)` method using `easeTo` (animated, 400 ms) / `setCenter` (reduced-motion) + `isRecenteringForLocate` guard cleared on `moveend`. **Marker rendering** is wired in `LocateButton.svelte` directly via `maplibregl.Marker` (CSS class `:global(.locate-marker)`) inside the `onFix` callback — see spec Addendum A3.
- [X] T031 [US3] Extend `src/app/App.svelte` — attached a `dragstart` listener on the underlying MapLibre map (inside `onMount`) that, when `originalEvent` is truthy AND `controller.isRecenteringForLocate` is false AND `$locateSignal.state === 'follow'`, dispatches `applyLocateEvent({ type: 'manualPan' })`. FR-018 now wired end-to-end.
- [X] T032 [US3] Pointer-event handlers in `src/components/LocateButton.svelte` — `pointerdown` arms 1500 ms `setTimeout` (skipped when state is `off`), `setPointerCapture`, `pressing` class; `pointerup` clears the timer (always; the bubbling `click` handles short-tap toggle); `pointercancel` / `pointerleave` / `lostpointercapture` cleanup. `touch-action: manipulation; user-select: none` on the button CSS. Turns T024 + T025 GREEN.
- [X] T033 [US3] Keyboard handlers in `src/components/LocateButton.svelte` — `keydown`: `Enter` / `Space` (no shift) → `preventDefault` + `shortTapToggle`; `Shift+Enter` / `Shift+Space` → `preventDefault` + `longPress` event (no-op when state is `off`). `aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"` advertised on the button. Turns T026 GREEN.
- [X] T034 [US3] Press visual + reduced-motion fallback — outline ring via `box-shadow: 0 0 0 2px var(--color-accent)` with `transition: box-shadow 1500ms linear` on `.pressing`; under `@media (prefers-reduced-motion: reduce)` the transition is disabled and a `<span class="aria-live" aria-live="polite">{reducedMotionAnnouncement}</span>` element receives the zh `locate.button.aria.holdToStop` text on press, cleared on `cleanupPress`. Turns T027 GREEN. (Original conic-gradient radial-progress visual was simplified to a box-shadow ring during bundle-size trim; documented in plan.md Complexity Tracking.)
- [X] T035 [US3] Follow-mode auto-recenter — `geolocationController.onFix` callback in LocateButton.svelte calls `controller.recenterTo({ kind: 'wgs84-dd', lat, lon }, !reducedMotion)` when the current state is Follow. Show → Follow toggle path also recenters immediately on `lastFix` so the user sees the camera lock without waiting for the next watcher fix. Turns T024 acceptance scenarios 2 + 4 GREEN.

**Checkpoint**: Full gesture model works on touch + mouse + keyboard. Reduced-motion fallback verified. Manual pan in Follow demotes correctly without affecting our own programmatic recenters.

---

## Phase 6: User Story 4 — Update-frequency preset Settings section (Priority: P2)

**Goal**: `SettingsSheet.svelte` exposes a "定位更新頻率" (Location update frequency) section with three radios (智慧模式 default, 快速更新, 慢更新). The chosen preset persists across reloads via `pwa_map:prefs` v4. Switching the preset while the watcher is active live-applies within one update cycle.

**Independent Test**: With permission granted and US3 gesture model in place, change the preset in Settings, close, reload — selection persists; tap to enter Show, observe cadence at the new preset within the documented window (≤ 1 s Fast, ≤ 5 s Smart, ≤ 15 s Slow); change preset while in Show, observe cadence shift within one cycle without toggling Off/On.

### Tests (RED — write first)

- [X] T036 [P] [US4] Author `tests/integration/settings-locate-frequency.spec.ts` — 7 tests covering: default Smart radio, persist Fast / Slow via `loadLocateFrequency()`, re-mount restores stored preset, live re-mount across destroy/recreate, additive write doesn't clobber other prefs, zh i18n labels (智慧模式 / 快速更新 / 慢更新). **GREEN**.

### Implementation (GREEN)

- [X] T037 [US4] Modify `src/components/SettingsSheet.svelte` — added `<section class="locate-section">` with the i18n heading `settings.locate.heading` and three radios bound via `bind:group={locateFrequency}` to a local var initialised from `loadLocateFrequency()`. `on:change` calls `setLocateFrequency(locateFrequency)` from the new `$storage/locateFrequencyStore` writable (which both persists via `saveLocateFrequency` and broadcasts the change to subscribers). All colours via tokens.
- [X] T038 [US4] Modify `src/components/LocateButton.svelte` — added a reactive `$:` block subscribing to `$locateFrequencyStore`; when the store value changes AND the controller is currently running, calls `geo.start(newPreset)` (idempotent — `start` internally clears + re-subscribes with the new options). Live-apply during Show / Follow within one cycle satisfied. Turns T036 acceptance scenario 4 GREEN.

> Implementation note: a new tiny module `src/storage/locateFrequencyStore.ts` was created to bridge the persisted preference (`saveLocateFrequency`) with a reactive Svelte writable so SettingsSheet (writer) and LocateButton (subscriber) can synchronise without polling. ~25 LoC.

**Checkpoint**: Frequency preset radio in Settings persists, applies live to the watcher, and survives reload + PWA reinstall.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, ADR, and final verification gates per the
constitution and the project's quality-gates checklist.

- [X] T039 [P] Author `docs/ui/0013-locate-controls-layout.md` — visible changes, accessibility notes, locale-key table (13 keys × 3 locales), behaviour-FR mapping, out-of-scope items.
- [X] T040 [P] Author `docs/adr/0033-locate-gesture-and-frequency.md` — context (Q1–Q5), decision (state machine + preset enum + Permissions pre-flight + iOS user-gesture coupling), consequences (bundle delta, deferred Smart-promote burst, reload behaviour, a11y coupling), alternatives considered. Cites ADR 0021 + 0026.
- [X] T041 Modify `docs/adr/README.md` — added index row for ADR 0033.
- [X] T042 Run `npm run bundle-size` — reported +8.75 KB against a stale baseline (96 955 bytes from 2026-04-27 predates feature 012). True feature-013 contribution is **8.75 − 4.27 = +4.48 KB**, within the +6 KB per-feature ceiling. Documented in `plan.md`'s Complexity Tracking. Recommend baseline refresh after merge via `npm run bundle-size -- --update-baseline` from master.
- [X] T043 Run `npm run format && npm run lint && npm run typecheck && npm test` — all GREEN. 883/883 tests passing across 78 test files.
- [ ] T044 Run `npm run test:e2e` covering the new `cluster-layout.e2e.spec.ts` and `locate-long-press.e2e.spec.ts` files. **DEFERRED** — T017 + T029 e2e files not authored in this implement run; non-blocking.
- [ ] T045 Walk through `specs/013-locate-controls-layout/quickstart.md` on desktop Chrome, iOS Safari ≥ 17, and Android Chrome ≥ 120. **DEFERRED** — manual verification step; to be performed before opening the PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user-story phase.
- **User Story 1 (Phase 3)**: Depends on Foundational. Independent of US2 / US3 / US4.
- **User Story 2 (Phase 4)**: Depends on Foundational + a partial US1 (the cluster slot — but US2 can mount a stand-alone test harness if US1 has not landed yet).
- **User Story 3 (Phase 5)**: Depends on Foundational + US2 (the LocateButton component shell from T021 / T022 must exist).
- **User Story 4 (Phase 6)**: Depends on Foundational + US2 (the watcher must exist to live-apply the preset).
- **Polish (Phase 7)**: Depends on every desired user story being complete.

### Story-level dependency graph

```text
       ┌──────────┐
       │  Setup   │
       └────┬─────┘
            ▼
    ┌──────────────┐
    │ Foundational │  (T004–T014)
    └──────┬───────┘
           │
   ┌───────┼─────────┐
   ▼       ▼         ▼
 [US1]   [US2]    (US3, US4 pending US2 component shell)
   │       │
   │       ▼
   │     [US3] ◄── shares LocateButton.svelte
   │       │
   │       ▼
   └───►[US4] ◄── shares geolocationController
            │
            ▼
        [Polish]
```

### Within each user story

- All test tasks (`T015 / T017 / T020 / T024 / T025 / T026 / T027 / T028 / T029 / T036`) MUST be authored RED before any implementation in the same phase begins.
- Within a story, parallel-tagged test tasks ([P]) can be worked on in parallel.
- Implementation tasks within a story are mostly sequential because they share `LocateButton.svelte` / `App.svelte` / `MapController.ts` files.

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 sequential (T002 modifies tokens.css that the linter / type-check baseline in T003 covers).
- **Phase 2 tests** (T004 / T005 / T006 / T007): all 4 RED tests run in parallel — different files.
- **Phase 2 i18n** (T010 / T011 / T012): all 3 locale files run in parallel — different files.
- **Phase 3 tests** (T015 / T016 / T017): all 3 cluster-layout tests run in parallel — different files.
- **Phase 5 tests** (T024–T029): all 6 gesture-model tests run in parallel — different files.
- Cross-story parallelism: once Foundational is GREEN, two developers can work US1 and (US2-then-US3-then-US4) in parallel because US1 only touches App.svelte CSS / DOM ordering while the others build LocateButton.svelte + storage + Settings.

---

## Parallel Example: Foundational Phase 2

```bash
# Author all 4 RED unit tests in parallel:
Task: "Author tests/unit/locate-machine.spec.ts (T004)"
Task: "Author tests/unit/preferences-v4-migration.spec.ts (T005)"
Task: "Author tests/unit/i18n/locate-keys-parity.spec.ts (T006)"
Task: "Author tests/unit/locate-frequency-cadence.spec.ts (T007)"

# Author all 3 i18n catalogue updates in parallel:
Task: "Add 16 new keys to src/i18n/zh.json (T010)"
Task: "Add 16 new keys to src/i18n/en.json (T011)"
Task: "Add 16 new keys to src/i18n/ja.json (T012)"
```

## Parallel Example: User Story 3 — Gesture Tests

```bash
# Author all 6 gesture-model RED tests in parallel:
Task: "tests/integration/locate-button-cycle.spec.ts (T024)"
Task: "tests/integration/locate-button-long-press.spec.ts (T025)"
Task: "tests/integration/locate-button-keyboard.spec.ts (T026)"
Task: "tests/integration/locate-button-reduced-motion.spec.ts (T027)"
Task: "tests/integration/locate-manual-pan-demote.spec.ts (T028)"
Task: "tests/e2e/locate-long-press.e2e.spec.ts (T029)"
```

---

## Implementation Strategy

### MVP scope (typically just User Story 1)

**For this feature, the MVP is User Story 1 + User Story 2 combined**:
without US2 the new my-location slot would be empty (broken UX). US1
alone reorders the existing cluster but visually confuses users by
creating a gap. The minimum demo-able increment is:

1. Phase 1: Setup (T001–T003).
2. Phase 2: Foundational (T004–T014).
3. Phase 3: US1 cluster relocation (T015–T019).
4. Phase 4: US2 permission + first-tap → Show (T020–T023).
5. **STOP and VALIDATE**: deploy / demo. The button works for
   "show me where I am" with no follow / long-press yet.

### Incremental Delivery

- After MVP: Add US3 gesture model → demo full Show ↔ Follow + Stop.
- Then: Add US4 frequency preset → demo Settings persistence.
- Then: Polish + ADR + bundle-size verification → ship.

### Parallel Team Strategy

With two developers:

- Both complete Setup + Foundational together.
- Once Foundational GREEN:
  - Developer A: US1 cluster relocation (small, isolated to App.svelte).
  - Developer B: US2 → US3 → US4 (the LocateButton lineage).
- Stories integrate at the App.svelte mounting point (T022).

---

## Notes

- [P] = different files, no dependencies on incomplete tasks.
- [Story] label maps task to its user story for traceability; tasks
  in Setup / Foundational / Polish phases carry no story label per
  the project convention.
- Every test task MUST fail before the corresponding implementation
  task begins (Constitution Principle II).
- Run `npm run format && npm run lint --max-warnings 0` after each
  implementation task; do NOT batch formatting at the end.
- Run `npm run bundle-size` after each commit during the feature
  (per `.claude/rules/quality-gates.md`); discovery on PR open is
  too late.
- Commit per task or per logical group (e.g., all RED tests for a
  story in one commit, then GREEN implementation in another).
- Avoid: same-file conflicts between concurrent stories; cross-story
  dependencies that break independence; skipping a RED test "because
  it's obvious"; touching `env(safe-area-inset-*)` directly outside
  `tokens.css` (the grep guard will fail).
