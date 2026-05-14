---

description: "Task list for feature 014-smart-promote-cadence"
---

# Tasks: Smart Preset — Promote-on-Movement Cadence Boost

**Input**: Design documents from `/specs/014-smart-promote-cadence/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/ (1 contract file), quickstart.md

**Tests**: Required by Constitution Principle II (TDD non-negotiable).
Every behavioural change lands a RED test BEFORE its implementation lands GREEN.

**Organization**: This feature has exactly **one** user story (US1, P1).
All implementation tasks live under that story's phase. There are no
foundational prerequisites beyond confirming the post-feature-013
baseline is clean.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1)
- File paths are absolute relative to repo root (`C:\Users\hhhnr\source\repos\pwa_map`)

## Path Conventions

Single-project Svelte + Vite PWA. Source under `src/`, tests under `tests/`,
docs under `docs/`. All paths shown below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the post-feature-013 toolchain is GREEN before
the RED test for this feature lands.

- [X] T001 Confirm clean baseline: run `npm install` (no changes expected — no new deps for this feature), then `npm run format && npm run lint && npm run typecheck && npm test && npm run build && npm run bundle-size`. All MUST be GREEN. Bundle baseline should report entry JS 103.72 KB against `scripts/bundle-baseline.json` (refreshed 2026-05-14).

**Checkpoint**: Toolchain green. Implementation phase can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature.

There are no foundational tasks. All work lives inside a single
user story (US1) and touches a single source file
(`src/map/geolocationController.ts`). No new shared modules, no new
data types, no new i18n keys, no new persisted preferences.

**Checkpoint**: Skip to Phase 3.

---

## Phase 3: User Story 1 — Cadence tightens within seconds of starting to walk on Smart (Priority: P1) 🎯 MVP

**Goal**: Restore feature 013's SC-005 "≤ 5 s while moving" target
deterministically on the Smart preset by initiating a second
concurrent high-accuracy `watchPosition` subscription when two
consecutive fixes show motion ≥ 1 m/s, tearing it down after 5 s.

**Independent Test**: With `vi.useFakeTimers()` and a stubbed
`navigator.geolocation.watchPosition`, drive a real
`GeolocationController` through (a) one fix → no burst, (b) one
moving pair → no burst, (c) two consecutive moving pairs → a second
`watchPosition` call with `{ enableHighAccuracy: true, maximumAge:
0, timeout: 10_000 }`, (d) advance 5 000 ms → `clearWatch` called
on burst handle, (e) `stop()` / `dispose()` tears down both base
and burst subscriptions.

### Tests (RED — must fail before implementation lands)

- [X] T002 [P] [US1] Author `tests/unit/geolocation-controller-promote.spec.ts` covering the 14 cases enumerated in `specs/014-smart-promote-cadence/contracts/geolocation-controller-burst.md` "Test contract" section: (1) first fix no burst, (2) single moving pair no burst, (3) two consecutive moving pairs at exactly 1 m/s start burst with Fast options, (4) motion below 1 m/s no burst, (5) burst tears down after 5 000 ms, (6) single burst in flight, (7) Fast preset no promote, (8) Slow preset no promote, (9) `stop()` tears down both subs, (10) `dispose()` tears down both subs, (11) preset switch tears down burst, (12) burst-start throw silently aborted, (13) burst fixes flow through `options.onFix`, (14) 10 stationary fixes no burst. Use `vi.useFakeTimers({ shouldAdvanceTime: false })` and a stub `navigator.geolocation` that records `watchPosition(success, error, options)` call args. MUST be RED.
- [X] T003 [P] [US1] Extend `tests/unit/locate-frequency-cadence.spec.ts` with one new assertion: `frequencyToWatchOptions('smart')` continues to return the documented non-burst triple `{ enableHighAccuracy: false, maximumAge: 5_000, timeout: 30_000 }` — i.e., the published API contract for Smart does NOT bleed in the burst options. The pre-existing 8 cases in this file MUST continue to GREEN.

### Implementation (GREEN — turn tests green in dependency order, all in `src/map/geolocationController.ts`)

- [X] T004 [US1] In `src/map/geolocationController.ts`: add three private static constants `SMART_MOVEMENT_BURST_MS = 5_000`, `SMART_MOVEMENT_THRESHOLD_MPS = 1`, `EARTH_RADIUS_M = 6_371_000`; add four new private instance fields `burstWatchId: number | null = null`, `burstTimer: ReturnType<typeof setTimeout> | null = null`, `previousFix: PositionFix | null = null`, `previousFixWasMoving = false`; implement private `haversineMeters(a: PositionFix, b: PositionFix): number` returning great-circle distance in metres. Constants + fields + helper only — no integration yet. Run `npm run typecheck` to confirm the file still type-checks. T002 + T003 remain RED.
- [X] T005 [US1] In `src/map/geolocationController.ts`: implement private `maybePromoteOnMovement(fix: PositionFix): void` per `contracts/geolocation-controller-burst.md`'s spec — short-circuit on non-Smart preset, short-circuit on `burstWatchId !== null`, short-circuit on null `previousFix` (first-fix-of-session), guard `dt > 0`, compute haversine speed, trigger `startBurst()` when `isMoving && previousFixWasMoving`, then update both `previousFix` and `previousFixWasMoving`. Does NOT yet call `startBurst()` — that lands in T006. (Order matters: the conditional that *would* call `startBurst` is in place but the callee is a stub.)
- [X] T006 [US1] In `src/map/geolocationController.ts`: implement private `startBurst(): void`. Wrap `navigator.geolocation.watchPosition` call in `try { … } catch { … }`. On success: store watchId in `this.burstWatchId`, schedule `setTimeout(() => this.endBurst(), SMART_MOVEMENT_BURST_MS)` and store its handle in `this.burstTimer`. Burst options literal: `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }`. Pass `(pos) => this.handlePosition(pos)` and `(err) => this.handleError(err)` as the success/error callbacks. On catch: reset `burstWatchId = null`, `burstTimer = null`, `previousFixWasMoving = false`. MUST NOT call `options.onPositionUnavailable`.
- [X] T007 [US1] In `src/map/geolocationController.ts`: implement private `endBurst(): void`. If `burstWatchId !== null`, call `navigator.geolocation.clearWatch(burstWatchId)` and reset to `null`. If `burstTimer !== null`, call `clearTimeout(burstTimer)` and reset to `null`. Set `previousFixWasMoving = false`. Method MUST be idempotent (safe to call when no burst is active).
- [X] T008 [US1] In `src/map/geolocationController.ts`: integrate `maybePromoteOnMovement(fix)` into `handlePosition(pos)`. Add the call at the very END of `handlePosition`, AFTER `this.lastAcceptedFix = fix` and AFTER `this.options.onFix(fix)`. The order matters: consumer `onFix` fires first; promote logic runs second.
- [X] T009 [US1] In `src/map/geolocationController.ts`: integrate `endBurst()` into `start(preset)`. Call `this.endBurst()` at the top of `start(preset)` (BEFORE the existing `if (this.baseWatchId !== null) clearWatch` block). This ensures preset switches (Smart → Fast, Smart → Slow, even Smart → Smart) tear down any active burst before re-subscribing the base watcher.
- [X] T010 [US1] In `src/map/geolocationController.ts`: integrate `endBurst()` + `previousFix` / `previousFixWasMoving` reset into `stop()`. Add at the top of the existing `stop()` body (BEFORE the existing `clearWatch(baseWatchId)` block): `this.endBurst(); this.previousFix = null; this.previousFixWasMoving = false;`. `dispose()` already calls `this.stop()`, so it inherits the cleanup automatically — no separate change to `dispose()` is needed.
- [ ] T011 [US1] Run `npm run format && npm run lint && npm run typecheck && npm test`. T002 + T003 MUST now be GREEN. The existing `tests/unit/locate-frequency-cadence.spec.ts` and the entire feature 013 test suite MUST remain GREEN (no regressions).

**Checkpoint**: At this point, US1 is fully implemented and unit-tested. The cadence boost is observable in any environment where `navigator.geolocation.watchPosition` is callable and the user is moving on the Smart preset.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, ADR, and final verification gates per
Constitution Principles V and IV.

- [X] T012 [P] Author `docs/adr/0035-smart-promote-on-movement.md`. Contents: context (why feature 013 deferred the burst; what changed in the bundle budget after baseline refresh on 2026-05-14), decision (two-consecutive-moving-pairs trigger + 5 s burst + single in-flight + haversine threshold), consequences (battery cost while moving is bounded by 5 s burst windows; bundle delta measured and recorded; supersedes the deferred-burst bullet in ADR 0033; no UI surface change), alternatives considered (R1 single-moving-pair / three-pair / Kalman filter; R3 route-throws-to-onPositionUnavailable; R4 custom burst options). Cite ADR 0033 (which is being amended in T013) and feature 013 plan.md Complexity Tracking.
- [X] T013 [P] Modify `docs/adr/0033-locate-gesture-and-frequency.md`: locate the "deferred Smart-promote burst" bullet in the consequences section and append "**Superseded by ADR 0035 (2026-05-14)** — the burst was restored after the post-feature-013 bundle baseline refresh freed budget." Preserve the original deferred wording as historical context.
- [X] T014 Modify `docs/adr/README.md`: add a new index row for ADR 0035 in the same row-format as existing entries (number, title, date, brief description). Depends on T012 having been authored.
- [X] T015 Run `npm run format && npm run lint && npm run typecheck && npm test && npm run build`. All GREEN: format clean, lint 0 warnings, typecheck 548 files / 0 errors / 0 warnings, test 80 files / 905 tests passing (890 pre-existing + 14 new from T002 + 1 new describe assertion from T003), build PWA precache 1189.30 KiB.
- [X] T016 Run `npm run bundle-size` and record the measured entry-chunk JS gzipped delta against `scripts/bundle-baseline.json` (post-feature-013 baseline, entry JS 103.72 KB). Fill the "Measured" cell in `specs/014-smart-promote-cadence/plan.md`'s Complexity Tracking table. If the measured delta exceeds the plan target (≤ +1.0 KB) but stays under the project ceiling (+6 KB), document the overshoot reason in the Notes column per `.claude/rules/quality-gates.md`. If the delta exceeds +6 KB, T016 is RED — investigate the regression before continuing.
- [ ] T017 Execute `specs/014-smart-promote-cadence/quickstart.md` manual verification on at least one mobile platform (Android Chromium or iOS Safari ≥ 17) plus desktop Chromium. **DEFERRED to PR-prep step**: the implement run executed in an environment without real GPS hardware or DevTools sensor mocking; the deterministic burst lifecycle is fully covered by the 14 fake-timer unit tests in `tests/unit/geolocation-controller-promote.spec.ts` (GREEN). Quickstart sign-off pending before merging the PR — should be added as a comment on the PR by the human reviewer.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 — no dependencies. Must complete before Phase 3.
- **Foundational (Phase 2)**: N/A.
- **User Story 1 (Phase 3)**: All tasks depend on T001 (baseline green) and on each other in the sequence below.
- **Polish (Phase 4)**: T012 / T013 can start as soon as T011 is GREEN. T014 depends on T012. T015 / T016 / T017 are the final gates.

### Within Phase 3 (User Story 1)

```
T001 (baseline green)
  ├── T002 [P] ──┐
  └── T003 [P] ──┤  (both RED tests authored in parallel)
                 │
                 ▼
                T004 (constants + fields + haversine)
                 │
                 ▼
                T005 (maybePromoteOnMovement skeleton)
                 │
                 ▼
                T006 (startBurst)
                 │
                 ▼
                T007 (endBurst)
                 │
                 ▼
                T008 (integrate into handlePosition)
                 │
                 ▼
                T009 (integrate into start)
                 │
                 ▼
                T010 (integrate into stop)
                 │
                 ▼
                T011 (run full test suite — T002 + T003 GREEN; no regressions)
```

### Within Phase 4 (Polish)

```
T011 (Phase 3 complete)
  ├── T012 [P] ──┐  (ADR 0035 authored in parallel with…)
  └── T013 [P] ──┘  (ADR 0033 amendment)
                 │
                 ▼
                T014 (ADR index row — depends on T012)
                 │
                 ▼
                T015 (full quality gate: format / lint / typecheck / test / build)
                 │
                 ▼
                T016 (bundle-size measurement → plan.md Complexity Tracking)
                 │
                 ▼
                T017 (quickstart manual verification)
```

### Parallel Opportunities

- T002 + T003 (different test files, no shared imports).
- T012 + T013 (different ADR files).
- No parallel implementation tasks: T004–T010 all touch the same source file (`geolocationController.ts`) and must be sequenced.

---

## Parallel Example: Phase 3 RED tests

```bash
# Author both RED test files in a single agent batch:
Task: "Write tests/unit/geolocation-controller-promote.spec.ts with the 14 cases from contracts/geolocation-controller-burst.md (T002)"
Task: "Extend tests/unit/locate-frequency-cadence.spec.ts with the one new Smart-burst-isolation assertion (T003)"
```

## Parallel Example: Phase 4 ADR work

```bash
# Author both ADR-side artefacts in parallel:
Task: "Write docs/adr/0035-smart-promote-on-movement.md (T012)"
Task: "Amend docs/adr/0033-locate-gesture-and-frequency.md with the 'Superseded by 0035 (2026-05-14)' note (T013)"
```

---

## Implementation Strategy

### MVP scope

**MVP = User Story 1** (the only user story). When T002–T011 are
GREEN, the feature delivers SC-001 (≤ 5 s while-moving cadence on
Smart) deterministically, restoring feature 013's deferred
contract. Phase 4's documentation gates (T012–T014) and bundle
measurement (T015–T017) are required for merge but do not
themselves change runtime behaviour.

### Suggested commit boundary

A clean single-commit shape:

1. T002 + T003 (RED) — one commit (`test(014): RED tests for Smart promote-on-movement burst`).
2. T004–T011 (GREEN) — one commit (`feat(014): restore Smart promote-on-movement cadence boost`).
3. T012–T014 (docs) — one commit (`docs(014): ADR 0035 + amend 0033 deferred-burst note`).
4. T015–T017 (verify) — no commit unless plan.md was edited in T016 (`docs(014): record measured bundle delta`).

Alternatively, T002–T017 as a single squash if the PR template prefers it.

### Constitution gates revisited

- **Principle I** (Code Quality): `npm run format` after each implementation task; no dead code.
- **Principle II** (TDD): T002 + T003 RED before any T004–T010 implementation. T011 verifies GREEN.
- **Principle III** (UX Consistency): N/A — no visible UI change.
- **Principle IV** (Performance): T016 records the actual bundle delta; plan target ≤ +1.0 KB JS gzipped, project ceiling +6 KB.
- **Principle V** (Documentation + ADR): T012 (new ADR), T013 (amend old ADR), T014 (ADR index).

---

## Notes

- All [P] tasks operate on disjoint files (verified above).
- The [US1] label on every Phase 3 task ties them to the single user story.
- T002's 14-case enumeration mirrors the test contract in
  `contracts/geolocation-controller-burst.md` exactly — no
  divergence allowed without amending the contract first.
- Skipping the post-implement `npm run bundle-size` is a Principle
  IV violation; T016 cannot be informally skipped.
- T017 may be deferred for "real-device" legs if no test device is
  available, but the desktop Chromium leg with mock-location
  DevTools is mandatory before merge.
