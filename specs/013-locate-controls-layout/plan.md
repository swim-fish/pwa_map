# Implementation Plan: Top-Left Map Controls + My-Location Button with Permission, Short-Tap Toggle, Long-Press Stop, and Update-Frequency Setting

**Branch**: `013-locate-controls-layout` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-locate-controls-layout/spec.md`

## Summary

Four delivery slices ride the same branch. Each is independently
testable per the spec, but they ship together because (a) the layout
relocation needs a real new button to occupy the new slot, (b) the
gesture model and the permission flow are physically the same
component's event handlers, and (c) the frequency preset has no
meaning without a watcher to consume it.

1. **Top-left cluster relocation + new my-location slot** (US1, P1) —
   `App.svelte`'s `.map-controls` rule moves from
   `top: 50%; transform: translateY(-50%)` to a top-left anchor
   composed via `calc(var(--space-3) + var(--top-stack-zone-top))`
   (top) and `calc(var(--space-3) + var(--inline-stack-zone-left))`
   (left). DOM order changes from `<ZoomControls/> <Compass/>` to
   `<Compass/> <LocateButton/> <ZoomControls/>` so the visual
   top-to-bottom reading is compass → my-location → zoom-in →
   zoom-out. The existing safe-area token discipline from feature
   011 (and `.claude/rules/pwa-positioning.md`) is preserved verbatim
   — no `env(safe-area-inset-*)` references leak in.

2. **Permission flow on first short-tap** (US2, P1) — the geolocation
   API is **never** called at page load (FR-009). The first
   `navigator.geolocation.watchPosition` call is invoked inside the
   `pointerup` handler that fires the short-tap toggle, satisfying
   iOS Safari's user-gesture requirement (FR-010, research §R4).
   Denial / unavailable / `prompt → denied` transitions surface a zh
   notification through the existing `NotificationRegion.svelte`
   surface (FR-011 / FR-012 / FR-013) — no new toast system.

3. **Gesture model: short-tap toggle + long-press stop + keyboard
   shortcut** (US3, P1) — A new component `LocateButton.svelte`
   wraps a single `<button>` with `PointerEvent` handlers
   (`pointerdown` / `pointerup` / `pointercancel` / `pointerleave`)
   plus `keydown`. A 1.5 s long-press timer triggers Stop on
   completion (FR-014b); a release before the timer fires is treated
   as a short-tap (FR-014c, OS-native). Keyboard `Enter` / `Space`
   short-tap; `Shift+Enter` / `Shift+Space` reach Stop (FR-014d) —
   both shortcuts advertised via `aria-keyshortcuts`. Visual
   feedback during the press is a radial conic-gradient fill driven
   by a CSS custom property animated via a single
   `requestAnimationFrame` loop scoped to the press lifetime; under
   `prefers-reduced-motion: reduce` the fill is suppressed entirely
   and an `aria-live="polite"` element announces "按住停止…"
   (FR-014e, research §R6). All gesture transitions delegate to a
   pure state-machine module `src/map/locateMachine.ts` that has no
   DOM, no map, no clock dependencies — just `(state, event) →
   nextState` reducers. The state machine's three states (Off /
   Show / Follow) are reflected into the existing `MapController`
   via a small `recenterTo(...)` extension and into App.svelte's
   marker layer via a new `locateSignal` Svelte store (mirroring
   the existing `bearingSignal` pattern from feature 006).

4. **Update-frequency preset persisted in preferences v4** (US4, P2)
   — `src/storage/preferences.ts` gains `FormatPreferencesV4` with
   one new field `locateFrequency: 'smart' | 'fast' | 'slow'`.
   PREFS_VERSION bumps from 3 → 4 with additive migration
   (research §R7, ADR 0021's "additive evolution" pattern).
   `SettingsSheet.svelte` gains a new `<section class="locate">`
   with three radios — same shape as the existing tile-cache
   section. The watcher in `geolocationController.ts` consumes the
   chosen preset to derive `enableHighAccuracy` / `maximumAge` /
   `timeout` plus an internal min-dispatch interval (research §R1).
   Default is **Smart**.

What this plan deliberately does **not** do:

- It does not introduce an on-screen heading indicator (the marker
  is a position dot, not a directional cone — Assumption explicit
  in spec).
- It does not render an accuracy radius circle by default (spec
  Edge Cases marks it as future polish).
- It does not persist the my-location button's runtime state across
  reload (FR-028 — reload always returns to Off; protects iOS
  Safari user-gesture rule).
- It does not introduce a fourth Settings frequency option
  ("Stopped") — Stopped is exclusively the my-location button's
  responsibility (US4 narrative).
- It does not change the compass / zoom controls' existing
  behaviours (compass still resets bearing on click; zoom still
  anchors on the centre crosshair). Only their layout position in
  the cluster changes.
- It does not add a new persistence key or a new storage layer —
  the new field rides inside `pwa_map:prefs` (the same key feature
  007 / 010 use).

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target), Svelte 4.2 —
inherited unchanged from features 001–012. `tsconfig.json` and
`eslint.config.js` are not amended.

**Primary Dependencies**:

- `maplibre-gl` (already in deps) — `Marker` class consumed for the
  position dot; `recenterTo` calls translate to `easeTo` /
  `setCenter` on the underlying map. **No version bump.**
- `svelte` 4.2.x + `@sveltejs/vite-plugin-svelte` — already in use.
- **No new runtime deps. No new dev deps.** Geolocation, Pointer
  Events, Permissions, and `prefers-reduced-motion` are all
  platform Web APIs available on every browser in the support
  matrix (research §R2 / §R4 / §R6).

**Storage**: `pwa_map:prefs` schema bumps v3 → v4. Single new field
`locateFrequency: 'smart' | 'fast' | 'slow'` (default `'smart'`).
Additive migration following ADR 0021. The runtime tracking state
(Off / Show / Follow / last fix / press timestamps) lives in
component-local stores ONLY — not persisted (per FR-028).

**Testing**:

- Vitest unit + integration in `tests/unit/` / `tests/integration/`.
  RED-first per Constitution Principle II.
- Playwright e2e in `tests/e2e/` for real-pointer long-press timing
  + safe-area geometry on touch viewports.
- New / modified test files (estimated counts; see Project
  Structure below):
  - `tests/unit/locate-machine.spec.ts` — pure transition coverage
    for every (state, event) → next-state pair.
  - `tests/unit/locate-frequency-cadence.spec.ts` — preset → API
    options + dispatch-throttle interval mapping.
  - `tests/unit/preferences-v4-migration.spec.ts` — v3 / v2 / v1
    records migrate additively to v4 with `locateFrequency:
    'smart'`; v4 records round-trip; corrupt input falls back.
  - `tests/unit/i18n/locate-keys-parity.spec.ts` — every new key
    in `zh.json` / `en.json` / `ja.json`, no orphans.
  - `tests/unit/safe-area-tokens.spec.ts` (MODIFIED) — assert
    `.map-controls` uses the top + inline-left tokens via `calc`
    after the relocation.
  - `tests/integration/locate-button-permission.spec.ts` — first
    short-tap triggers the geolocation API synchronously inside
    the `pointerup` handler; deny → toast + Off.
  - `tests/integration/locate-button-cycle.spec.ts` — short-tap
    transitions: Off → Show → Follow → Show; map recenter only
    in Follow.
  - `tests/integration/locate-button-long-press.spec.ts` — fake
    timers + `dispatchEvent(new PointerEvent(...))`; ≥ 1.5 s →
    Stop; release at 1.0 s → toggle; cancel via `pointerleave`.
  - `tests/integration/locate-button-keyboard.spec.ts` — `Enter`
    / `Space` toggles; `Shift+Enter` / `Shift+Space` Stops;
    `aria-keyshortcuts` exposes both.
  - `tests/integration/locate-button-reduced-motion.spec.ts` —
    matchMedia stub `(prefers-reduced-motion: reduce)`; radial
    fill suppressed; `aria-live` element receives "按住停止…"
    text on press.
  - `tests/integration/locate-manual-pan-demote.spec.ts` —
    Follow + simulated user `dragstart` (with `originalEvent`
    truthy) demotes to Show; programmatic recenter (no
    `originalEvent`) does not.
  - `tests/integration/settings-locate-frequency.spec.ts` — radio
    selection persists through `pwa_map:prefs` and applies to a
    re-mounted button live.
  - `tests/integration/cluster-layout-top-left.spec.ts` — DOM
    order, anchoring tokens, no overlap with toolbar / readout /
    notification region.
  - `tests/e2e/cluster-layout.e2e.spec.ts` — real-browser
    geometry at 320 / 360 / 390 / 1440 px viewports.
  - `tests/e2e/locate-long-press.e2e.spec.ts` — real `pointerdown`
    / wait 1.6 s / `pointerup` triggers Stop; release at 1.0 s
    triggers toggle.

**Target Platform**: PWA — modern Chromium (Android 11+, Desktop),
WebKit / iOS Safari ≥ 17, Firefox 120+. Same matrix as features 005
/ 011 / 012.

**Project Type**: Single-project Svelte + Vite PWA (one
build-and-deploy artefact, GitHub Pages hosted at
`https://swim-fish.github.io/pwa_map/`). No backend tier.

**Performance Goals**:

- No regression in map first-paint or pan / zoom latency
  (feature 001 baseline holds).
- Bundle size delta gzipped (plan target): **+3 KiB JS (entry
  chunk)** / **+0.3 KiB CSS** (per spec SC-007's plan-level
  guidance). Project hard ceiling **+6 KiB**
  (`.claude/rules/quality-gates.md`).
- First geolocation fix render ≤ 5 s after permission grant on a
  network-permitting environment (SC-002).
- Permission prompt MUST appear within the same gesture turn
  (SC-003 — verified by integration test that asserts the
  geolocation API is called synchronously inside the `pointerup`
  handler before any `await` / `Promise.then` boundary).
- Frequency change takes effect within one update cycle (SC-005:
  ≤ 1 s for Fast, ≤ 5 s for Smart-while-moving, ≤ 15 s for Slow).
- Long-press detection latency ≤ 16 ms past the 1.5 s threshold
  (one frame at 60 Hz; verified by `tests/e2e/locate-long-press`).

**Constraints**:

- Constitution Principle II — TDD for every behavioural change.
  Each user story lands a RED test before its implementation lands
  GREEN. The state-machine module's transition table is built up
  test-first.
- Constitution Principle III — `docs/ui/0013-locate-controls-layout.md`
  covers visible UI changes (cluster relocation, my-location button,
  Settings frequency section) plus accessibility notes (a11y names
  per state, `aria-keyshortcuts`, reduced-motion `aria-live`).
- Constitution Principle V — `docs/adr/0033-locate-gesture-and-frequency.md`
  codifies the gesture model (Q1–Q5 outcomes) + frequency-preset
  architecture; ADR index updated.
- Constitution v1.1.0 — all new i18n strings use `zh` / `en` / `ja`
  only; no `zh-TW` / `zh-Hant` substring anywhere.
- `.claude/rules/pwa-positioning.md` — `.map-controls` cluster MUST
  compose `var(--space-3) + var(--top-stack-zone-top)` and
  `var(--space-3) + var(--inline-stack-zone-left)` via `calc(...)`;
  no the-device-safe-area-inset env() function references.
- `.claude/rules/pwa-component-state.md` — `LocateButton.svelte`
  is component-local; the parent App.svelte does NOT pass an `open`
  prop. Long-press timer + press-start timestamp are reset on every
  `pointercancel` / `pointerleave` / `pointerup` / component
  destroy. The radial-progress visual flag is reset alongside.
- `.claude/rules/pwa-tokens-and-contrast.md` — no hard-coded
  colours in `LocateButton.svelte` or its CSS; reuse
  `--color-surface-elev` / `--color-fg` / `--color-border` /
  focus-ring tokens.

**Scale/Scope**:

- 3 new modules: `src/map/locateMachine.ts`,
  `src/map/geolocationController.ts`, `src/map/locateSignal.ts`.
- 1 new Svelte component: `src/components/LocateButton.svelte`.
- 5 modified files: `src/app/App.svelte` (cluster relocation +
  marker mount), `src/components/SettingsSheet.svelte` (frequency
  section), `src/storage/preferences.ts` (v4 migration),
  `src/map/MapController.ts` (`recenterTo` extension), and the 3
  i18n catalogues.
- ~12 new test files; ~600–800 new test lines.
- 1 new ADR (0033) and 1 new `docs/ui/` record (0013).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality & Formatting Discipline

- Every touched file is run through `npm run format` and
  `npm run lint --max-warnings 0` before each commit.
- New modules follow the project's existing TS conventions:
  `locateMachine.ts` is pure (no side-effects at import);
  `geolocationController.ts` exports a class with explicit
  `dispose()` like `MapController`; `locateSignal.ts` exports a
  Svelte readable store like `bearingSignal`.
- Self-explanatory naming: `LocateState`, `LocateEvent`,
  `LocateMachine.transition()`, `LocateFrequencyPreset`,
  `frequencyToWatchOptions(...)`. JSDoc on the public surface only;
  no inline rationale paragraphs in implementation code.
- No dead code: every exported symbol has at least one consumer in
  the source tree (or one in tests).

✅ **Pass.**

### II. Test-First Development (NON-NEGOTIABLE)

- Each FR (FR-001 .. FR-029) maps to at least one regression test in
  the Testing block above.
- Each user story lands its RED test before its GREEN
  implementation per the `tasks.md` ordering produced by
  `/speckit.tasks`.
- US1 (cluster relocation): `tests/integration/cluster-layout-top-left.spec.ts`
  + `tests/unit/safe-area-tokens.spec.ts` extension fail on the
  pre-relocation App.svelte CSS, then go GREEN.
- US2 (permission flow): mock `navigator.geolocation` and
  `navigator.permissions.query`; assert the API is invoked
  synchronously inside the `pointerup` handler before any
  microtask.
- US3 (gesture model): the state-machine unit tests are the
  fastest RED loop; integration tests then exercise pointer +
  keyboard + reduced-motion paths.
- US4 (frequency preset): `tests/unit/preferences-v4-migration.spec.ts`
  is RED before `FormatPreferencesV4` is added; the
  `tests/integration/settings-locate-frequency.spec.ts` is RED
  before `SettingsSheet.svelte` gains the section.

✅ **Pass.**

### III. User Experience Consistency

- Visible UI changes covered in
  `docs/ui/0013-locate-controls-layout.md`: cluster relocation,
  my-location button (3 visual states + radial progress visual +
  reduced-motion fallback), Settings frequency radio section.
- Accessibility:
  - ≥ 44 px tap targets on the my-location button (via
    `--tap-min`).
  - Three distinct accessible names per state (FR-020).
  - `aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"` on
    the button.
  - `aria-live="polite"` element for the reduced-motion long-press
    announcement.
  - Keyboard reachability: button is in tab order; focus ring
    inherits the existing token.
- No new design tokens introduced — `--color-surface-elev`,
  `--color-fg`, `--color-border`, `--color-accent`, focus-ring
  token, and `--tap-min` are all reused.

✅ **Pass.**

### IV. Performance Requirements

- Bundle budget: plan target **+3 KiB JS / +0.3 KiB CSS** gzipped
  (per SC-007 plan-level guidance). Project hard ceiling **+6 KiB**
  per `.claude/rules/quality-gates.md`. `npm run bundle-size` runs
  after every commit during the feature, not just at the end.
- The state machine is a O(1) transition lookup; the long-press
  timer is one `setTimeout`; the radial progress visual is a single
  CSS conic-gradient driven by a custom property — no per-frame JS
  for the visual path. No new runtime work in the map's pan / zoom
  hot paths.
- The watcher is started ONLY on user gesture (FR-009), so the
  feature contributes zero idle cost when Off.

✅ **Pass.**

### V. Documentation & Architectural Decision Records

- New ADR: `docs/adr/0033-locate-gesture-and-frequency.md`.
  Contents: context (why a 2-gesture model rather than a 3-tap
  cycle; why three frequency presets rather than user-tunable
  intervals), decision (state machine + preset enum + Permissions
  pre-flight), consequences (bundle delta, accessibility surface,
  iOS Safari user-gesture coupling), alternatives considered
  (3-tap cycle; intervals as numeric sliders; auto-resume on
  reload — all rejected per `/speckit.clarify` 2026-04-28).
- ADR index amended (`docs/adr/README.md` adds the row for 0033).
- New UI record: `docs/ui/0013-locate-controls-layout.md`.
  Contents: visible changes (cluster relocation, my-location
  button, frequency section), affected screens (App shell,
  Settings), tokens added (none), accessibility notes (a11y names
  per state, `aria-keyshortcuts`, reduced-motion announcement),
  locale changes (~10 new keys × 3 locales).

✅ **Pass.**

### Workflow gate — Locale conventions (Constitution v1.1.0)

- All new i18n keys land in `zh.json`, `en.json`, `ja.json`
  simultaneously. No `zh-TW` / `zh-Hant` substring appears in any
  new code, test, or documentation.
- `tests/unit/i18n/locate-keys-parity.spec.ts` asserts parity for
  every new key.

✅ **Pass.**

**All gates pass — no Complexity Tracking entries required at
plan time.**

## Project Structure

### Documentation (this feature)

```text
specs/013-locate-controls-layout/
├── plan.md              # this file (/speckit.plan output)
├── research.md          # Phase 0 — decisions + alternatives considered
├── data-model.md        # Phase 1 — runtime state machine + persisted preset
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   ├── locate-machine.md             # state-machine module surface + transitions
│   ├── geolocation-controller.md     # watcher wrapper surface + permission semantics
│   ├── locate-button-component.md    # Svelte component contract: events, a11y, visuals
│   ├── cluster-layout.md             # App.svelte .map-controls geometry contract
│   └── preferences-v4-locate-frequency.md  # storage v4 migration + field contract
├── checklists/
│   └── requirements.md  # spec-quality checklist (already produced)
└── tasks.md             # Phase 2 — emitted by /speckit.tasks (not produced here)
```

### Source code (repository root) — files this feature touches

```text
src/
├── components/
│   ├── LocateButton.svelte                # NEW — 3-state button + gestures + a11y
│   └── SettingsSheet.svelte               # MODIFIED — frequency-preset radio section
├── map/
│   ├── locateMachine.ts                   # NEW — pure state-machine module
│   ├── geolocationController.ts           # NEW — watchPosition wrapper + permission
│   ├── locateSignal.ts                    # NEW — Svelte store: state + lastFix + permission
│   └── MapController.ts                   # MODIFIED — recenterTo + locate-marker helpers
├── storage/
│   └── preferences.ts                     # MODIFIED — FormatPreferencesV4 + locateFrequency
├── i18n/
│   ├── zh.json                            # MODIFIED — locate.* + settings.locate.* keys
│   ├── en.json                            # MODIFIED — locate.* + settings.locate.* keys
│   └── ja.json                            # MODIFIED — locate.* + settings.locate.* keys
└── app/
    └── App.svelte                         # MODIFIED — cluster relocation + marker mount

tests/
├── unit/
│   ├── locate-machine.spec.ts                          # NEW
│   ├── locate-frequency-cadence.spec.ts                # NEW
│   ├── preferences-v4-migration.spec.ts                # NEW
│   ├── safe-area-tokens.spec.ts                        # MODIFIED — top-left assertions
│   └── i18n/
│       └── locate-keys-parity.spec.ts                  # NEW
├── integration/
│   ├── locate-button-permission.spec.ts                # NEW
│   ├── locate-button-cycle.spec.ts                     # NEW
│   ├── locate-button-long-press.spec.ts                # NEW
│   ├── locate-button-keyboard.spec.ts                  # NEW
│   ├── locate-button-reduced-motion.spec.ts            # NEW
│   ├── locate-manual-pan-demote.spec.ts                # NEW
│   ├── settings-locate-frequency.spec.ts               # NEW
│   └── cluster-layout-top-left.spec.ts                 # NEW
└── e2e/
    ├── cluster-layout.e2e.spec.ts                      # NEW
    └── locate-long-press.e2e.spec.ts                   # NEW

docs/
├── adr/
│   ├── 0033-locate-gesture-and-frequency.md            # NEW
│   └── README.md                                       # MODIFIED — index row
└── ui/
    └── 0013-locate-controls-layout.md                  # NEW
```

**Structure Decision**: Single-project Svelte + Vite PWA. The
layout above is the actual repository structure — no separate
backend / mobile / API tier. Three new TS modules sit under
`src/map/` to keep the geolocation / state / signal trio next to
the existing `MapController.ts` and `bearingSignal.ts` patterns
(feature 006 / ADR 0026).

## Phase 0: Outline & Research

See [research.md](./research.md). Decisions resolved:

- **R1** — Frequency-preset cadences (Smart / Fast / Slow) and
  their mapping to `PositionOptions` + internal dispatch throttle.
- **R2** — Long-press detection mechanism: `PointerEvent` +
  `setTimeout` over `touchstart` + manual delta; cancellation
  events; cross-browser support matrix.
- **R3** — Marker rendering choice: MapLibre `Marker` (DOM-based)
  vs symbol layer; pick DOM Marker for state-driven CSS hooks and
  reduced-motion overrides.
- **R4** — Permission API usage: `navigator.permissions.query` for
  pre-flight (best-effort, iOS Safari ≥ 17 supports it); always
  fall back to `watchPosition`'s error callback as ground truth;
  user-gesture invocation rule.
- **R5** — Manual-pan-detection in Follow: discriminate user pan
  vs programmatic recenter by inspecting `originalEvent` on the
  `dragstart` / `movestart` events; guard our own `recenterTo`
  with a transient flag.
- **R6** — Reduced-motion strategy: suppress radial progress
  fill; announce via `aria-live="polite"`; for Follow recenter use
  `setCenter` instead of `easeTo` (existing pattern from
  Compass.svelte / ZoomControls.svelte).
- **R7** — Preferences v4 additive migration following ADR 0021.

All entries resolve any `NEEDS CLARIFICATION` placeholder. None
remain open.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/](./contracts/),
and [quickstart.md](./quickstart.md).

- **data-model.md** — Runtime state-machine shape (`LocateState`
  enum, `LocateEvent` discriminated union, `LocateMachineSnapshot`
  type), persisted preset (`FormatPreferencesV4` field +
  default), notification-region message catalog (zh keys per
  failure mode).
- **contracts/locate-machine.md** — Pure module surface;
  transition table; invariants (no DOM / no clock / no map);
  test contract.
- **contracts/geolocation-controller.md** — `watchPosition`
  options derived from frequency preset; permission pre-flight;
  error normalisation; `dispose()` semantics; user-gesture
  contract.
- **contracts/locate-button-component.md** — `LocateButton.svelte`
  Svelte component public props, emitted events, internal state
  fields, a11y attributes, CSS custom properties, reduced-motion
  branch.
- **contracts/cluster-layout.md** — `.map-controls` CSS contract
  (anchoring tokens, DOM order, gap, no overlap with toolbar /
  readout / notification region) + grep guard scope for
  `safe-area-tokens.spec.ts`.
- **contracts/preferences-v4-locate-frequency.md** — schema diff,
  validator coverage, migration table v1 / v2 / v3 / v4 + corrupt.
- **quickstart.md** — 15-minute manual verification walkthrough
  covering all 4 user stories on iOS Safari, Android Chrome, and
  desktop Chrome.

CLAUDE.md `<!-- SPECKIT START -->` block is updated to point to
this plan.

### Post-design Constitution re-check

After Phase 1 artefacts are written, the Constitution Check above
is re-evaluated:

- The state machine is a single pure module imported by exactly
  one component (`LocateButton.svelte`) and one signal store
  (`locateSignal.ts`). Principle I (no speculative abstraction)
  holds.
- Each contract maps 1:1 to at least one test file in the Project
  Structure table. Principle II holds.
- Visible UI: cluster + button + Settings frequency section —
  every surface accounted for in `docs/ui/0013-*.md`. Principle
  III holds.
- Bundle delta projection still under +3 KiB JS / +0.3 KiB CSS at
  the contract surface area (see Complexity Tracking). Principle
  IV holds.
- ADR + UI record + ADR index update remain the only
  documentation artefacts. Principle V holds.

✅ **Re-check passes.**

## Complexity Tracking

> Constitution Check passed at plan time. After `/speckit.implement`
> the actual bundle delta exceeded the plan target (+3 KiB) and is
> documented here per `.claude/rules/quality-gates.md`'s "exceed
> plan target but stay under +6 KB ceiling → document before
> merging" rule.

| Item | Plan target | Measured | Project ceiling | Notes |
|------|-------------|----------|-----------------|-------|
| Entry-chunk JS delta gzipped | +3 KiB | **+4.48 KB** (true feature-013 contribution) | +6 KB | `npm run bundle-size` reports +8.75 KB against the stored baseline (96 955 bytes from 2026-04-27, predates feature 012). Subtracting feature 012's measured +4.27 KB delta yields the actual feature-013 contribution: 8.75 − 4.27 = **+4.48 KB**, within the +6 KB per-feature ceiling. The stale baseline is a missing hygiene step from feature 012's merge — it should be refreshed by running `npm run bundle-size -- --update-baseline` from master after feature 013 merges. |
| Stylesheet delta gzipped | +0.3 KiB | +0.43 KB | (no separate ceiling) | LocateButton CSS (3 state visuals + box-shadow press feedback + reduced-motion override) ≈ 0.30 KB; SettingsSheet locate-section styles ≈ 0.10 KB; cluster-layout adjustments in App.svelte ≈ 0.03 KB. |
| Permission-prompt latency | Synchronous w/ user gesture | ✓ verified | (hard requirement, not a budget) | `tests/integration/locate-button-permission.spec.ts` asserts the geolocation API is invoked inside the `pointerup`/`click` handler before any `Promise.resolve().then` boundary. |
| Smart "promote on movement" cadence boost (research §R1) | included | **deferred** | — | Original research called for a 5 s high-accuracy burst when two consecutive Smart-preset fixes show ≥ 1 m/s motion. Dropped from the implementation to fit the +6 KB per-feature budget. The Smart preset now relies on `maximumAge: 5_000` + the browser's built-in cadence governance. Revisit if telemetry shows users notice cadence drops while moving on Smart. |
| US3 e2e cluster-layout / long-press tests (T017 + T029) | included | **deferred** | — | Real-pointer + real-viewport e2e specs deferred from this implement run. They are non-blocking (the corresponding integration tests with jsdom polyfills are GREEN); to be authored before merge. |
