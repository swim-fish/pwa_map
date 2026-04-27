---

description: "Task list for feature 009-mobile-ui-fixes"
---

# Tasks: Mobile UI Adjustments — Touch Targets, Segmented Coordinate Readout, Notification Stacking

**Input**: Design documents from `/specs/009-mobile-ui-fixes/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Per Constitution Principle II (Test-First Development, NON-NEGOTIABLE), every behavioural change in this feature lands a failing test BEFORE its implementation. Test tasks are explicitly listed below and MUST be created RED before their corresponding implementation tasks are picked up.

**Organization**: Tasks are grouped by user story to enable independent implementation, testing, and demo. Phases run in priority order (US1 → US2 → US3) with a Foundational phase that adds shared design tokens before US1 / US2 begin.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task in the same phase).
- **[Story]**: `[US1]`, `[US2]`, `[US3]` for the corresponding user-story phase. Setup, Foundational, and Polish phases carry no story label.
- File paths are absolute relative to repo root.

## Path Conventions

- **Source**: `src/`
- **Tests**: `tests/{unit,integration,e2e}/`
- **Docs**: `docs/{ui,adr}/`
- Single-project layout per `plan.md` §"Structure Decision".

---

## Phase 1: Setup

**Purpose**: No new build infrastructure is required by this feature (Plan §"Primary Dependencies": no new deps; §"Storage": none). Phase 1 only confirms the working tree is on the feature branch and the existing gates run cleanly so the TDD red phase can be observed.

- [X] T001 Confirm the working tree is on branch `009-mobile-ui-fixes`, formatter / lint / typecheck / Vitest all pass against the current `master`-baseline code (`npm run format && npm run lint && npm run typecheck && npm test`); record any pre-existing failures in `specs/009-mobile-ui-fixes/quickstart.md` §Troubleshooting before continuing.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the four shared design tokens declared in `data-model.md` (`--tap-min`, `--notification-zone-top`, `--notification-zone-bottom`, `--readout-clearance`) and the `.tap-target` utility class. US1 and US2 both depend on these tokens; US3 does not.

**⚠️ CRITICAL**: US1 and US2 cannot start until T002 is complete. US3 may begin in parallel with Phase 2 because it does not consume these tokens.

- [X] T002 Edit `src/app/tokens.css` to declare the four feature tokens and the `.tap-target` utility class exactly as specified in `specs/009-mobile-ui-fixes/data-model.md` §"NotificationRegionLayoutTokens" and `contracts/tap-target.md` §"Surface owned by this contract". Do NOT change any existing token; do NOT add color or typography tokens. Run `npm run format` after editing.

**Checkpoint**: Foundation ready — US1 and US2 may start.

---

## Phase 3: User Story 1 — Reliable mobile touch targets (Priority: P1) 🎯 MVP

**Goal**: Every interactive control reachable on a phone-class viewport renders at ≥ 44 × 44 CSS px with non-overlapping neighbours, no horizontal scroll at 320 px wide, and no double-tap zoom triggered. Delivers the user's primary complaint ("按鈕可以點選的到 (不能太小)").

**Independent Test**: Open the PWA on a 360 × 640 viewport, run through the 10-control walkthrough in `quickstart.md` §1; every tap registers on first try; `tests/unit/tap-target.spec.ts` and `tests/e2e/mobile-tap-targets.e2e.spec.ts` pass green.

### Tests for User Story 1 (write FIRST, RED before implementation) ⚠️

- [X] T003 [P] [US1] Create `tests/unit/tap-target.spec.ts` enforcing the five invariants in `contracts/tap-target.md` §"Invariants" at 360 × 640 and 320 × 640 viewports (jsdom). The spec MUST mount each affected component (Compass, ZoomControls, CoordinateReadout copy buttons, the toolbar shell of `App.svelte`, InstallBanner, UpdatePrompt) and assert `getBoundingClientRect()` ≥ 44 × 44, no two listed boxes intersect, no horizontal scroll, and `tokens.css` declares `--tap-min: 44px` exactly. Confirm the file lands RED before continuing.
- [X] T004 [P] [US1] Create `tests/e2e/mobile-tap-targets.e2e.spec.ts` (Playwright) running the same size + non-overlap assertion under the Mobile Chrome 120 and iOS Safari 17 viewport profiles in `playwright.config.ts`. Confirm the file lands RED before continuing.

### Implementation for User Story 1

- [X] T005 [P] [US1] In `src/components/Compass.svelte`, replace the literal `min-width: 36px; min-height: 36px; width: 36px; height: 36px;` block on the toggle root with `min-width: var(--tap-min); min-height: var(--tap-min);` (drop the fixed `width/height`). Run `npm run format` after editing.
- [X] T006 [P] [US1] In `src/components/ZoomControls.svelte`, apply the same change as T005 to both zoom buttons. Run `npm run format` after editing.
- [X] T007 [P] [US1] In `src/components/CoordinateReadout.svelte`, replace the `padding: 2px 6px;` rule on `.copy` with `padding: var(--space-2, 8px); min-width: var(--tap-min); min-height: var(--tap-min);` (preserving border / background / cursor / hover). Run `npm run format` after editing.
- [X] T008 [P] [US1] In `src/components/InstallBanner.svelte`, add `class="tap-target"` to every action `<button>` and remove any literal `min-width: 36px; min-height: 36px;` declaration. Run `npm run format` after editing.
- [X] T009 [P] [US1] In `src/components/UpdatePrompt.svelte`, do the same as T008. Run `npm run format` after editing.
- [X] T010 [P] [US1] In `src/components/goto/Disambiguator.svelte`, audit the choice buttons; if any selector renders below 44 × 44 at the 360 × 640 viewport, add `class="tap-target"` (do not edit otherwise). Run `npm run format` after editing.
- [X] T011 [US1] In `src/app/App.svelte`, add `min-height: var(--tap-min);` to the `.toolbar-btn` and `.settings-toolbar-btn` rules. Do NOT touch the four inline transient toasts in this task — that is US2's surface. Run `npm run format` after editing.
- [X] T012 [US1] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `tap-target.spec.ts` is now GREEN and no previously-green spec regressed. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta is ≤ +1 KiB.
- [ ] T013 [US1] Walk through `specs/009-mobile-ui-fixes/quickstart.md` §1 manually in a Chromium DevTools mobile emulator at 360 × 640 and 320 × 568; record the result inline in the quickstart's troubleshooting section if any tap mis-targets.

**Checkpoint**: User Story 1 is fully functional, independently testable, and ready to demo as the MVP.

---

## Phase 4: User Story 2 — Notifications never block interactive UI (Priority: P2)

**Goal**: All transient banners share one fixed stacking region; no banner overlaps the toolbar, the right-edge controls, the readout, the dialog primary action row when a dialog is open, or another banner. Delivers the user's third complaint ("通知訊息與其他元件擋住問題").

**Independent Test**: Trigger each of the six banner classes individually and pairwise on a 360 × 640 viewport per `quickstart.md` §2; `tests/integration/notification-region.spec.ts` passes green.

### Tests for User Story 2 (write FIRST, RED before implementation) ⚠️

- [X] T014 [P] [US2] Create `tests/integration/notification-region.spec.ts` enforcing the seven invariants in `contracts/notification-region.md` §"Invariants" at 360 × 640 and 640 × 360 (jsdom). The spec MUST mount `<App>`, fire each banner trigger (SW update, install prompt, copy success, layer-load failure, offline-ready, zone hint), assert the banner's bounding rect does not intersect the toolbar / compass / zoom / settings / readout / dialog primary action row, and verify the `body[data-dialog-open]` shift behaves. Confirm the file lands RED before continuing.

### Implementation for User Story 2

- [X] T015 [US2] Create `src/components/NotificationRegion.svelte` with the public surface described in `contracts/notification-region.md` §"Public component surface" and §"ARIA contract": no props, default slot, `aria-live="polite"`, fixed stacking layout with `top: var(--notification-zone-top)`, `body[data-dialog-open]` selector flipping to `bottom: var(--notification-zone-bottom)`, `pointer-events: none` on the container with `pointer-events: auto` on direct children. Run `npm run format` after editing.
- [X] T016 [P] [US2] Edit `src/components/UpdatePrompt.svelte` per `contracts/notification-region.md` §"Mounting contract for banner components": remove the outer `position: fixed; top: …; left: 50%; transform: translateX(-50%); z-index: …;` block from the root selector; keep all content, classes, dismiss buttons, ARIA roles, and persistence flow unchanged. Run `npm run format` after editing.
- [X] T017 [P] [US2] Do the same as T016 for `src/components/InstallBanner.svelte`: remove the outer `position: fixed; bottom: …; right: …; z-index: …;` block; keep `beforeinstallprompt` flow, dismissal-timestamp logic (feature 005), and ARIA unchanged. Run `npm run format` after editing.
- [X] T018 [US2] Edit `src/app/App.svelte` to (a) import `NotificationRegion` and render it once near the bottom of the component, (b) move all four inline transient toasts (zone-hint, copy-success, layer-fail, offline-ready) inside `<NotificationRegion>` and drop their per-toast `position: fixed` blocks, (c) move the `<UpdatePrompt>` and `<InstallBanner>` mounts inside the same `<NotificationRegion>`, (d) set/clear `document.body.dataset.dialogOpen = ''` (string form acceptable) when Go To dialog and Settings sheet open / close. Do NOT touch the toolbar button sizing in this task (that was US1). Run `npm run format` after editing.
- [X] T019 [US2] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `notification-region.spec.ts` is now GREEN; confirm `tap-target.spec.ts` and existing service-worker / install / toast specs (under `tests/unit/` and `tests/integration/`) all stay GREEN. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T020 [US2] Walk through `specs/009-mobile-ui-fixes/quickstart.md` §2 manually: trigger SW update, install banner, copy success, layer-load failure, offline-ready, zone hint, and the Go To-open + Settings-open dialog-shift cases. Record any visible regression inline.

**Checkpoint**: User Stories 1 AND 2 both work independently. Demo-ready.

---

## Phase 5: User Story 3 — Segmented coordinate readout matching Go To (Priority: P3)

**Goal**: The on-screen coordinate readout renders each format as labelled-field segments mirroring the corresponding Go To layout exactly; the copy button still yields the canonical single-string representation, and no new locale keys are introduced.

**Independent Test**: Pan the map to verify each format's segment count, label keys, and order match the Go To layout per `quickstart.md` §3; `tests/unit/coordinate-readout-segments.spec.ts` passes green; pasting from each row's copy button yields a string equal — character-for-character — to the pre-feature output.

### Tests for User Story 3 (write FIRST, RED before implementation) ⚠️

- [X] T021 [P] [US3] Create `tests/unit/coordinate-readout-segments.spec.ts` enforcing the seven invariants in `contracts/coordinate-segments.md` §"Invariants". For each `CoordinateKind` in `data-model.md` §"CoordinateSegment", the spec MUST: (a) extract the static input field-key list from the corresponding Go To layout component (by reading exported props names or `data-testid` attributes), (b) call `coordinateSegments(kind, sample, prefs)`, (c) assert element-wise equality of `segments[i].labelKey` with that list, (d) join `segments[i].value` with the canonical separator and assert equality with `format{Kind}(...)`, (e) feed an out-of-coverage position and assert the `{ coverage: 'out-of-coverage' }` sentinel for `taipower` (and where applicable `twd97-tm2`). Confirm the file lands RED before continuing.

### Implementation for User Story 3

- [X] T022 [US3] Create `src/coord/segments.ts` exporting `CoordinateSegment`, `CoordinateSegmentsResult`, and `coordinateSegments(kind, position, prefs)` exactly per `contracts/coordinate-segments.md` §"Public module surface". The function MUST compose the existing converters / formatters from `$coord/index` and MUST NOT call proj4 / mgrs directly. The function MUST be pure: no DOM, no `localStorage`, no `Date.now()`, no `Math.random()`. Run `npm run format` after editing.
- [X] T023 [US3] Edit `src/components/CoordinateReadout.svelte` to (a) import and call `coordinateSegments(...)` for each visible kind, (b) render each "ok" row as a CSS grid of labelled segments (`<span class="seg-label">{$tStore(seg.labelKey)}</span><span class="seg-value">{seg.value}</span>` repeated), (c) keep the existing copy button calling `formatWGS84DD/DMS/...` directly (canonical output unchanged), (d) keep the SR-only `<span class="sr-only" data-testid="readout-dd">` block at the foot. Do NOT add new i18n keys. Run `npm run format` after editing.
- [X] T024 [US3] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `coordinate-readout-segments.spec.ts` is now GREEN; confirm the existing `tests/unit/coord/format-*.spec.ts` (and any readout-positioning specs) remain GREEN — that is the regression guard for the canonical copy-string contract (FR-005). Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T025 [US3] Walk through `specs/009-mobile-ui-fixes/quickstart.md` §3 manually: switch through all six formats; verify segment-row layout matches the Go To layout for each kind; copy each row and paste into a text editor to confirm canonical string parity; switch the locale (`zh` → `en` → `ja`) and verify segment labels track the Go To layout labels in each locale.

**Checkpoint**: All three user stories independently functional. Feature is functionally complete; remaining work is documentation and the constitution doc gates.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation gates required by Constitution Principle III (UX consistency → `docs/ui/`) and Principle V (ADR), plus the deploy-gate script and the optional perf bench.

- [X] T026 [P] Create `docs/ui/0009-mobile-ui-fixes.md` describing the three visible behaviour changes (touch sizes, readout layout, banner placement) with: rationale, affected screens (toolbar, compass, zoom, settings, readout, install banner, update prompt, all four toasts), screenshots before / after at 360 × 640 (saved under `docs/ui/screenshots/` per the existing convention), explicit reference to `--tap-min: 44px` (WCAG 2.5.5 AAA) and the `NotificationRegion` pattern. Cross-link from `docs/ui/README.md`.
- [X] T027 [P] Create `docs/adr/0029-mobile-touch-target-and-notification-region.md` codifying: (a) the 44 × 44 CSS-px tap-target floor (with the rejected 24-px AA and 48-dp Material alternatives), (b) the single-region notification-stacking pattern (with the rejected per-component fixed-positioning and queue-based alternatives), (c) the rejection of a third-party toast library, (d) the relationship to ADR 0014 (Accessibility Baseline) and ADR 0017 (Go To split layout) — explicitly NOT superseding them. Update `docs/adr/README.md` to insert ADR 0029 in the index.
- [~] T028 (Optional) Create `bench/coord-segments.bench.ts` covering Invariant 7 of `contracts/coordinate-segments.md` (≤ 5 ms for all six kinds on one position). Skip if the existing `bench/` directory does not already run in CI.
- [X] T029 Run `npm run deploy:check` (the full format → lint → typecheck → test → build → bundle-size pipeline) and confirm a clean exit. Capture the bundle-size report's gzipped delta vs `master` baseline; record it in the PR description for Principle IV traceability.
- [ ] T030 Walk the entire `specs/009-mobile-ui-fixes/quickstart.md` end-to-end (§1 + §2 + §3 + §4 + §5) on a fresh Chromium-mobile emulator and confirm all five sections pass. This is the final acceptance gate before opening the PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 only. Trivial.
- **Phase 2 (Foundational)**: T002 depends on T001. T002 BLOCKS US1 and US2 because both consume the new tokens. T002 does NOT block US3.
- **Phase 3 (US1)**: All US1 tasks depend on T002.
- **Phase 4 (US2)**: All US2 tasks depend on T002. T015 (NotificationRegion creation) BLOCKS T016, T017, T018 within the story.
- **Phase 5 (US3)**: Depends only on T001 (Setup), NOT on T002 or US1/US2. May run in parallel with Phase 2 / 3 / 4 if team capacity exists.
- **Phase 6 (Polish)**: T026 / T027 may start any time after at least one user story completes (so the doc author has something concrete to document); T029 / T030 depend on all three user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After T002. Independent of US2 and US3 by design.
- **US2 (P2)**: After T002. Touches `src/app/App.svelte` for the toast-mounting refactor (T018); US1's T011 also touches `App.svelte` (toolbar button sizing). The two edits target *different* sections of the file; avoid running T011 and T018 simultaneously on the same working tree to prevent merge friction. Sequential within a single developer is the safest order (T011 first, then T018).
- **US3 (P3)**: Touches `src/components/CoordinateReadout.svelte` (T023). US1's T007 also touches the same file (the `.copy` rule in the `<style>` block). The two edits target different parts of the file; sequential ordering (T007 before T023) is the safest path. Functionally still independent.

### Within Each User Story

- Tests (T003, T004, T014, T021) MUST be written and confirmed RED before any implementation task in their story.
- Within-story implementation tasks marked `[P]` may run in parallel; non-`[P]` tasks within a story are sequenced.
- After every implementation task, `npm run format` MUST run on the touched file (Constitution Principle I + Development Workflow §"Formatting gate").

### Parallel Opportunities

- Phase 2 has only one task (T002), so no within-phase parallelism.
- Within US1: T005, T006, T007, T008, T009, T010 are all `[P]` — six small files, no shared state.
- Within US2: T016 and T017 are `[P]` after T015.
- Within US3: T021 (the test) lands first; T022 → T023 are sequential within the implementation.
- Polish: T026 and T027 are `[P]`.

---

## Parallel Example: User Story 1 implementation

```bash
# After T002 (tokens) is in and T003 + T004 (tests) are RED, fan out:
Task: "Edit src/components/Compass.svelte to replace 36px sizing with var(--tap-min)"
Task: "Edit src/components/ZoomControls.svelte to replace 36px sizing with var(--tap-min)"
Task: "Edit src/components/CoordinateReadout.svelte .copy to use var(--tap-min)"
Task: "Edit src/components/InstallBanner.svelte buttons to class='tap-target'"
Task: "Edit src/components/UpdatePrompt.svelte buttons to class='tap-target'"
Task: "Audit src/components/goto/Disambiguator.svelte choice buttons; add tap-target if needed"
# Then sequential:
Task: "Edit src/app/App.svelte .toolbar-btn / .settings-toolbar-btn min-height"
Task: "npm run format && npm run lint && npm run typecheck && npm test && npm run bundle-size"
```

## Parallel Example: Polish

```bash
Task: "Author docs/ui/0009-mobile-ui-fixes.md"
Task: "Author docs/adr/0029-mobile-touch-target-and-notification-region.md and update docs/adr/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 (foundation: tokens + utility class).
2. T003 + T004 (RED tests for tap-target).
3. T005 → T011 (apply `--tap-min` to seven button surfaces).
4. T012 (gate run) + T013 (manual quickstart §1).
5. **STOP and VALIDATE**: tap targets pass on phone emulator; this alone fixes the user's primary complaint.
6. Optionally ship as an interim PR.

### Incremental Delivery

1. MVP (US1) → demo / ship.
2. Add US2 (notification region) → demo / ship.
3. Add US3 (segmented readout) → demo / ship.
4. Polish (docs/ui/, ADR, deploy:check).

Each story adds value without breaking previous stories. Each test green stays green for the rest of the feature.

### Parallel Team Strategy

With multiple developers after T002 lands:

1. Developer A: US1 (T003 → T013).
2. Developer B: US3 (T021 → T025) — *can start in parallel with A*; no shared file collision.
3. Developer C: US2 (T014 → T020) — *coordinate with A on `src/app/App.svelte`*: A finishes T011 before C starts T018, or rebase / merge once A's PR lands.
4. Polish (T026–T030) once two of the three stories merge.

---

## Notes

- `[P]` tasks = different files, no incomplete dependency in the same phase.
- `[Story]` label maps task to user story for traceability and for the `/speckit.analyze` cross-check.
- Each user story is independently testable per its checkpoint; ship one at a time if needed.
- TDD is non-negotiable per Constitution Principle II — every implementation task has a corresponding RED test that lands first.
- Run `npm run format` after every code edit per Constitution Principle I and the project's Development Workflow §"Formatting gate".
- No new i18n keys, no new persisted state, no new runtime deps — `npm run bundle-size` should report ≤ +1 KiB gzipped at every gate run.
- After `/speckit.analyze` and `/speckit.implement`: update `docs/adr/README.md` per Constitution Principle V.
