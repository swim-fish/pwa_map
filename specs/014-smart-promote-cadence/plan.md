# Implementation Plan: Smart Preset — Promote-on-Movement Cadence Boost

**Branch**: `014-smart-promote-cadence` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-smart-promote-cadence/spec.md`

## Summary

Retro-fits the deferred *promote-on-movement* adaptive branch into
`src/map/geolocationController.ts` (feature 013 Addendum A2). When
the active preset is `smart` and two consecutive position fixes show
motion ≥ 1 m/s (computed via haversine great-circle distance over
the timestamp delta), the controller starts a second concurrent
`watchPosition` subscription with high-accuracy options for a 5 s
window, then tears it down. This restores feature 013's SC-005
"≤ 5 s while moving" target deterministically on the Smart preset.

The change is invisible to the user beyond the cadence boost — no
new UI, no new i18n strings, no new persisted preference, no
changes to consumers (`LocateButton.svelte`, `locateSignal.ts`,
`App.svelte`). All bookkeeping lives in `GeolocationController`
instance memory; reload starts fresh.

What this plan deliberately does **not** do:

- It does not change the published `frequencyToWatchOptions(...)`
  mapping — the base Smart subscription still receives
  `{ enableHighAccuracy: false, maximumAge: 5_000, timeout: 30_000 }`.
- It does not introduce a "Smart-aggressive" or fourth preset.
  Smart is one preset whose internal cadence governance becomes
  adaptive.
- It does not adapt Fast or Slow. Fast already runs high accuracy;
  Slow's in-app throttle would defeat the burst's purpose.
- It does not persist promote-on-movement state across reload.
- It does not surface a toast / aria announcement when the burst
  fires — the user sees only the cadence change.
- It does not change `PREFS_VERSION` (stays 4).
- It does not amend or supersede feature 013's `LocateMachine`
  contract or `locateSignal` snapshot shape. The state machine
  remains DOM- and clock-free.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target), Svelte 4.2 —
inherited unchanged from features 001–013. `tsconfig.json` and
`eslint.config.js` are not amended.

**Primary Dependencies**:

- `navigator.geolocation.watchPosition` / `clearWatch` — platform
  Web API, same one feature 013 consumes. No SDK or library
  surface.
- `setTimeout` / `clearTimeout` — platform timer API.
- **No new runtime deps. No new dev deps. No version bumps.**

**Storage**: Unchanged. `pwa_map:prefs` schema remains v4. No new
field. Runtime promote-on-movement state lives in
`GeolocationController` instance fields only.

**Testing**:

- Vitest unit (jsdom env). RED-first per Constitution Principle II.
- No new Playwright e2e in this feature — the burst behaviour is
  not visually distinct from a fast normal fix; the real-pointer
  / real-viewport surface area is unchanged from feature 013.
- New / modified test files:
  - `tests/unit/geolocation-controller-promote.spec.ts` (NEW) —
    drives a real `GeolocationController` against a stubbed
    `navigator.geolocation` and `vi.useFakeTimers()`; asserts
    the burst lifecycle: first-fix-no-burst, single-moving-pair
    no-burst, two-consecutive-moving-pairs starts burst,
    burst tear-down at 5 000 ms, single burst at a time,
    `stop()` / `dispose()` tears down burst, preset switch
    tears down burst, non-Smart preset does not promote,
    `watchPosition` throw on burst start is swallowed.
  - `tests/unit/locate-frequency-cadence.spec.ts` (MODIFIED) —
    the existing test file already has placeholder coverage
    for "Smart promote on movement" (feature 013 T007). This
    feature ungates and tightens those assertions. The existing
    expectations stay GREEN; new assertions extend them.

**Target Platform**: PWA — modern Chromium (Android 11+, Desktop),
WebKit / iOS Safari ≥ 17, Firefox 120+. Same matrix as feature 013.

**Project Type**: Single-project Svelte + Vite PWA. No structural
change.

**Performance Goals**:

- Bundle-size delta (entry-chunk JS gzipped): **≤ +1.0 KB** against
  the post-feature-013 baseline (`scripts/bundle-baseline.json`,
  entry JS 103.72 KB as of 2026-05-14). Project hard ceiling
  remains +6 KB per `.claude/rules/quality-gates.md`.
- CSS delta: **0 KB** (no styling).
- No regression in map first-paint or pan / zoom latency
  (feature 001 baseline holds — the promote logic only runs on
  position-fix callbacks, which the existing pipeline already
  processes).
- SC-001 cadence target: ≤ 5 s for Smart-while-moving on
  ≥ 95 % of trials across the support matrix — verified by
  fake-timer unit tests; real-device measurement is left to
  manual quickstart verification (no automated metric).
- The burst's high-accuracy subscription costs more battery than
  the base Smart subscription; SC-004 asserts the burst MUST NOT
  fire when stationary.

**Constraints**:

- Constitution Principle II — TDD for every behavioural change.
  Each FR-001..FR-011 maps to at least one assertion in the new /
  modified test files.
- Constitution Principle III — No visible UI change; `docs/ui/`
  is NOT updated (the cadence boost is invisible beyond the
  on-screen dot refreshing more often, which is not a UI
  pattern change).
- Constitution Principle V — `docs/adr/0035-smart-promote-on-movement.md`
  supersedes the "deferred" line in ADR 0033's consequences
  section; ADR index updated. ADR 0033 itself is amended
  in-place with a "Superseded by 0035 (2026-05-14)" note on the
  deferred-burst bullet.
- Constitution v1.1.0 — no i18n strings added; locale convention
  vacuously holds.
- `.claude/rules/pwa-component-state.md` — `GeolocationController`
  remains responsible for resetting all of its instance state
  (base + burst watchers, burst timer, promote-state cluster) on
  `stop()` / `dispose()`. The existing reset discipline extends
  to the new burst fields.
- `.claude/rules/quality-gates.md` — `npm run bundle-size` runs
  after EVERY commit during this feature; not just at the end.

**Scale/Scope**:

- 0 new modules.
- 0 new Svelte components.
- 1 modified TS file: `src/map/geolocationController.ts` (~60
  lines added, ~5 lines modified inside `stop()` and
  `handlePosition`).
- 1 new test file (~150 test lines, ~8–10 vi cases).
- 1 modified test file (~30 test lines added).
- 1 new ADR (0035), 1 amended ADR (0033 superseded-line note),
  1 modified ADR index (`docs/adr/README.md`).
- No new `docs/ui/` record.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality & Formatting Discipline

- `geolocationController.ts` is the only edited source file;
  `npm run format` runs after every edit.
- Naming follows the existing module style:
  `SMART_MOVEMENT_BURST_MS`, `SMART_MOVEMENT_THRESHOLD_MPS`,
  `EARTH_RADIUS_M` for constants; `haversineMeters(a, b)` for
  the geodesic helper; `maybePromoteOnMovement(fix)`,
  `startBurst()`, `endBurst()` for the lifecycle methods.
- Comments are reserved for non-obvious rationale: the haversine
  formula gets one explanatory line; the "two-consecutive moving
  pairs" guard gets one. No paragraph blocks.
- No dead code: every new private method is called from
  `handlePosition` / `start` / `stop` / `dispose`.

✅ **Pass.**

### II. Test-First Development (NON-NEGOTIABLE)

- RED first: `tests/unit/geolocation-controller-promote.spec.ts`
  is authored and fails (the methods don't exist yet) before any
  implementation lands.
- The existing `tests/unit/locate-frequency-cadence.spec.ts`
  already exercises the published `frequencyToWatchOptions`
  triple; the new assertions extend it without breaking the
  feature 013 coverage that's currently GREEN.
- Bug-fix flavour: this is also a regression fix against
  feature 013's SC-005 deferred contract. A regression test
  pinned to that contract (`promote-on-movement triggers a
  high-accuracy burst within 5 s of sustained motion`) lands
  BEFORE the controller implements it.

✅ **Pass.**

### III. User Experience Consistency

- No visible UI change. The on-screen position dot uses the same
  styling, the same accent token, and the same pulsing halo
  (motion-respect). It simply refreshes faster while the user
  is moving on Smart.
- No new design tokens, no new accessible-name strings, no new
  Settings UI, no new toast.
- `docs/ui/` is NOT amended; Principle III requires updates only
  for *visible UI changes*.

✅ **Pass (no UI surface).**

### IV. Performance Requirements

- Bundle budget: plan target **≤ +1.0 KB JS gzipped** against
  post-feature-013 baseline. Project hard ceiling +6 KB still
  applies. `npm run bundle-size` runs after every commit.
- The promote logic is O(1) per fix: one haversine call, one
  comparison, at most one `setTimeout` / `clearTimeout` pair,
  at most one `watchPosition` / `clearWatch` pair. No allocation
  on the fix-callback hot path beyond a single `PositionFix`
  object (already allocated by the existing path).
- Battery: the burst MUST NOT fire when stationary (SC-004,
  verified by a 10-stationary-fix unit test). The burst's
  high-accuracy subscription is bounded to 5 s and at most one
  in flight.
- The base Smart subscription's `enableHighAccuracy: false`
  options are unchanged, so idle battery on Smart is unchanged
  vs feature 013.

✅ **Pass.**

### V. Documentation & Architectural Decision Records

- New ADR: `docs/adr/0035-smart-promote-on-movement.md`. Contents:
  context (why feature 013 deferred the burst; what changed in the
  bundle budget after baseline refresh on 2026-05-14), decision
  (two-consecutive-moving-pairs trigger + 5 s burst + single
  in-flight), consequences (battery cost while moving, bundle
  delta, supersedes line in ADR 0033), alternatives considered
  (Geolocation.speed, single-moving-pair trigger, dynamic burst
  duration — all rejected per research §R1 / R3 / R4).
- ADR 0033 amended: the "deferred Smart-promote burst" bullet in
  consequences gains a "Superseded by 0035 (2026-05-14)" inline
  note. The original deferred record is preserved as historical.
- ADR index amended (`docs/adr/README.md` adds the row for 0035).
- `docs/ui/` NOT amended (no visible UI change — see Principle III
  above).
- This plan, `research.md`, `data-model.md`, `contracts/*.md`, and
  `quickstart.md` are this feature's spec-kit artefacts.

✅ **Pass.**

### Workflow gate — Locale conventions (Constitution v1.1.0)

- No new i18n keys. The convention applies vacuously.

✅ **Pass.**

**All gates pass — Complexity Tracking is empty at plan time.**

## Project Structure

### Documentation (this feature)

```text
specs/014-smart-promote-cadence/
├── plan.md                                 # this file (/speckit.plan output)
├── spec.md                                 # feature spec (already written)
├── research.md                             # Phase 0 — decisions + alternatives
├── data-model.md                           # Phase 1 — promote-state cluster shape
├── quickstart.md                           # Phase 1 — manual verification walk-through
├── contracts/
│   └── geolocation-controller-burst.md     # Phase 1 — controller surface diff + invariants
└── tasks.md                                # Phase 2 — emitted by /speckit.tasks (not produced here)
```

### Source code (repository root) — files this feature touches

```text
src/
└── map/
    └── geolocationController.ts            # MODIFIED — promote-on-movement burst

tests/
└── unit/
    ├── geolocation-controller-promote.spec.ts  # NEW
    └── locate-frequency-cadence.spec.ts        # MODIFIED — tighten existing promote assertions

docs/
└── adr/
    ├── 0033-locate-gesture-and-frequency.md  # MODIFIED — "Superseded by 0035" note
    ├── 0035-smart-promote-on-movement.md     # NEW
    └── README.md                             # MODIFIED — index row for 0035
```

**Structure Decision**: Single-project Svelte + Vite PWA, same as
feature 013. All edits localised to `src/map/geolocationController.ts`
plus its tests and ADR documentation.

## Phase 0: Outline & Research

See [research.md](./research.md). Decisions resolved:

- **R1** — Motion threshold + two-consecutive-pairs guard
  (1 m/s, requires two pairs to avoid jitter false-positives).
- **R2** — Burst initiation site: inside the success-callback of
  the base watcher, NOT from a user-gesture handler. iOS Safari
  ≥ 17 permits this because permission was already granted for
  the base subscription.
- **R3** — `watchPosition` throw handling for the burst differs
  from the base subscription's: throws silently abort the burst,
  do NOT route to `onPositionUnavailable`. The base watcher
  retains its `try { … } catch { onPositionUnavailable() }`
  pattern.
- **R4** — Burst options: reuse the Fast preset's documented
  triple (`enableHighAccuracy: true, maximumAge: 0,
  timeout: 10_000`) for surface-area parsimony.
- **R5** — Test strategy: a single new vitest unit file with
  `vi.useFakeTimers()` covering all FR-001..FR-011 cases.

All entries resolve any `NEEDS CLARIFICATION` placeholder. None
remain open.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/](./contracts/),
and [quickstart.md](./quickstart.md).

- **data-model.md** — Promote-state cluster (4 fields on
  `GeolocationController` instance); no persisted change; no
  change to feature 013's `LocateMachineSnapshot` or
  `FormatPreferencesV4`.
- **contracts/geolocation-controller-burst.md** — Public surface
  is unchanged (no new exports); internal contract: the burst
  lifecycle, the haversine formula, the two-consecutive-pairs
  guard, the single-in-flight invariant, the tear-down
  obligations under `stop()` / `dispose()` / preset switch, and
  the burst-specific error policy. Test contract enumerated.
- **quickstart.md** — 8-minute manual verification walk-through
  for iOS Safari, Android Chrome, and desktop Chrome: confirm
  cadence boost while walking; confirm no boost while stationary;
  confirm preset switch tears down burst.

CLAUDE.md `<!-- SPECKIT START -->` block is updated to point to
this plan.

### Post-design Constitution re-check

After Phase 1 artefacts are written, the Constitution Check above
is re-evaluated:

- The change touches one source file; the contract surface is
  internal (private methods + private fields). Principle I (no
  speculative abstraction) holds — every new symbol has exactly
  one caller.
- Each FR maps 1:1 to at least one assertion in
  `tests/unit/geolocation-controller-promote.spec.ts`.
  Principle II holds.
- No visible UI surface (Principle III vacuously holds).
- Bundle delta projected ≤ +1.0 KB JS gzipped at the contract
  surface area (haversine + maybePromote + startBurst + endBurst
  + integration into existing methods). Principle IV holds.
- ADR 0035 + ADR 0033 amendment + ADR index update are the only
  documentation artefacts. Principle V holds.

✅ **Re-check passes.**

## Complexity Tracking

> Constitution Check passed at plan time. This table is filled
> after `/speckit.implement` if measured bundle delta exceeds the
> plan target (≤ +1.0 KB) but stays under the +6 KB project
> ceiling, per `.claude/rules/quality-gates.md`.

| Item | Plan target | Measured | Project ceiling | Notes |
|------|-------------|----------|-----------------|-------|
| Entry-chunk JS delta gzipped | ≤ +1.0 KB | **+0.45 KB** | +6 KB | Baseline is `scripts/bundle-baseline.json` refreshed 2026-05-14 (entry JS 103.72 KB), post-feature-013. Post-implement entry JS = 104.17 KB. Comfortably within plan target. |
| Stylesheet delta gzipped | 0 KB | **+0.00 KB** | (no separate ceiling) | CSS gzipped stayed at 14.56 KB — no new selectors. |
| SC-001 ≤ 5 s while-moving cadence | restored to ≥ 95 % deterministic | _(quickstart manual verification deferred — see T017 note)_ | (hard requirement, not a budget) | Replaces feature 013 Addendum A2's "best-effort, device-dependent" caveat. Unit tests (14 cases in `tests/unit/geolocation-controller-promote.spec.ts`) verify the lifecycle deterministically; real-device measurement is a manual `quickstart.md` step. |
