---
description: "Task list for feature 010-mobile-collapsed-readout"
---

# Tasks: Mobile Collapsed Coordinate Readout, Drag-to-Reorder Priority, Taipower Auto-Precision, and TWD Zone Geographic Hints

**Input**: Design documents from `/specs/010-mobile-collapsed-readout/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Per Constitution Principle II (Test-First Development, NON-NEGOTIABLE), every behavioural change in this feature lands a failing test BEFORE its implementation. Test tasks are explicitly listed below and MUST be created RED before their corresponding implementation tasks are picked up.

**Organization**: Tasks are grouped by user story. Phases run in priority order (US1 P1 → US2 P2 → US4 P2 → US3 P3 → US5 P3) with a Foundational phase that lands the shared schema / token / locale changes that multiple user stories depend on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task in the same phase).
- **[Story]**: `[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]` for the corresponding user-story phase. Setup, Foundational, and Polish phases carry no story label.
- File paths are absolute relative to repo root.

## Path Conventions

- **Source**: `src/`
- **Tests**: `tests/{unit,integration,e2e}/`
- **Docs**: `docs/{ui,adr}/`
- Single-project layout per `plan.md` §"Structure Decision".

---

## Phase 1: Setup

**Purpose**: No new build infrastructure is required (Plan §"Primary Dependencies": no new deps). Phase 1 only confirms the working tree is on the feature branch and the existing gates run cleanly so the TDD red phase can be observed.

- [ ] T001 Confirm the working tree is on branch `010-mobile-collapsed-readout`; run `npm run format && npm run lint && npm run typecheck && npm test` against the current `master`-baseline code; record any pre-existing failures in `specs/010-mobile-collapsed-readout/quickstart.md` §Troubleshooting before continuing.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the three shared additive changes that downstream user stories consume — the new design token (US1 + US3), the prefs schema bump (US2 + US4), and the two new i18n keys (US5). Each is on its own file so they can ship in parallel.

**⚠️ CRITICAL**: User-story phases cannot start until their respective foundational task is complete:

- US1, US3 depend on T002 (token).
- US2, US4 depend on T003 (prefs schema).
- US5 depends on T004 (i18n keys).

- [ ] T002 [P] Edit `src/app/tokens.css` to declare `--readout-collapse-bp: 600px` exactly as specified in `specs/010-mobile-collapsed-readout/data-model.md` §"Tokens added". Do NOT change any existing token. Run `npm run format` after editing.
- [ ] T003 [P] Edit `src/storage/preferences.ts` to land the v2 → v3 schema bump per `contracts/format-priority-schema.md`: add `FormatPreferencesV3` interface (extends V2 with `formatOrder: readonly CoordinateKind[]` of length 6); export `DEFAULT_FORMAT_ORDER`; bump `PREFS_VERSION` from `2` to `3`; update `defaultPreferences()` to ship `taipowerPrecision: 11` and `formatOrder: DEFAULT_FORMAT_ORDER`; update `validatePreferences()` to fill `formatOrder` from default on v1/v2 records, fall back to default on malformed v3 `formatOrder`, and preserve any stored `taipowerPrecision` verbatim. Run `npm run format` after editing.
- [ ] T004 [P] Edit `src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json` to add the two new keys per `contracts/zone-label-i18n.md` §"New locale keys": `goto.fields.zoneTagMainIsland` and `goto.fields.zoneTagPenghu`. Use the seed values from the contract (`本島`/`Main Island`/`本島` and `澎湖`/`Penghu`/`澎湖列島`); do NOT modify any existing key. Run `npm run format` after editing.

**Checkpoint**: Foundation ready — US1, US2, US3, US4, US5 may start (per their token / schema / i18n dependencies above).

---

## Phase 3: User Story 1 — Phone-class readout no longer overlaps the zoom controls (Priority: P1) 🎯 MVP

**Goal**: When the viewport is narrower than 600 CSS pixels AND ≥ 2 coordinate formats are enabled, the readout collapses to a single-row form showing only the priority-one enabled format; its bounding rect does not intersect the zoom controls.

**Independent Test**: Open the PWA on 360 × 640; collapsed readout visible with one row; rect non-overlapping with zoom controls; `tests/unit/coordinate-readout-collapse.spec.ts` and the US1 portion of `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` pass green.

### Tests for User Story 1 (write FIRST, RED before implementation) ⚠️

- [ ] T005 [P] [US1] Create `tests/unit/coordinate-readout-collapse.spec.ts` enforcing invariants 1, 2, 6 from `contracts/readout-collapse-mode.md` at viewport widths 320 / 360 / 599 / 600 / 1024 CSS px (jsdom + matchMedia stub). Mount `<CoordinateReadout>` with `formatOrder=[…6 kinds…]` and `visible=[wgs84-dd, wgs84-dms, mgrs]`; assert exactly one row at width 360 (collapsed), three rows at width 1024 (expanded), and one row at width 360 with `visible=[wgs84-dd]` (single-format escape — no collapse styling). Confirm the file lands RED before continuing.
- [ ] T006 [P] [US1] Create `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` (Playwright) under the Mobile Chrome 120 and iOS Safari 17 viewport profiles in `playwright.config.ts`. Assert the readout's `getBoundingClientRect()` does not intersect `.zoom-controls` rect (`contracts/readout-collapse-mode.md` Invariant 7 / SC-001). The same file will host the US3 tap-expand assertions in T024; for US1 keep its first `describe` block focused on collapse + non-overlap. Confirm the file lands RED before continuing.

### Implementation for User Story 1

- [ ] T007 [US1] Edit `src/components/CoordinateReadout.svelte` to (a) accept a new `formatOrder: readonly CoordinateKind[]` prop, (b) compute `enabled = formatOrder.filter(k => visible.includes(k))` for row order, (c) compute `viewMode` per `contracts/readout-collapse-mode.md` §"State machine" (using `window.matchMedia('(max-width: calc(var(--readout-collapse-bp) - 0.02px))')` reactive subscription), (d) set `data-mode="collapsed" | "expanded" | "tap-expanded"` on the root, (e) hide non-priority-one rows in collapsed mode via CSS `display: none` keyed off `data-mode` and a `.row--priority-one` marker on the first rendered row. Do NOT introduce tap-to-expand handler in this task — that is US3's surface. Run `npm run format` after editing.
- [ ] T008 [US1] Edit `src/app/App.svelte` to pass `formatOrder={prefs.formatOrder}` to `<CoordinateReadout>`. Wire only the prop pass; no business logic. Run `npm run format` after editing.
- [ ] T009 [US1] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `coordinate-readout-collapse.spec.ts` is now GREEN and no previously-green spec regressed (especially `tests/unit/coord/format-*.spec.ts` and feature 009's `coordinate-readout-segments.spec.ts`). Run `npm run bundle-size` and confirm the entry-bundle gzipped delta vs `master` baseline is ≤ +1 KiB.
- [ ] T010 [US1] Walk through `specs/010-mobile-collapsed-readout/quickstart.md` §1 manually in a Chromium DevTools mobile emulator at 360 × 640 and 320 × 568; record the result inline in the quickstart's troubleshooting section if any tap mis-targets or the readout overlaps the zoom controls.

**Checkpoint**: User Story 1 (MVP) is fully functional, independently testable, and ready to demo. The user's primary complaint ("較窄的畫面會因為座標顯示與地圖控制(+/-) 互相重疊") is resolved.

---

## Phase 4: User Story 2 — Drag-to-reorder priority list in Settings (Priority: P2)

**Goal**: The format-toggle drawer (`FormatToggle.svelte`) renders every supported format as a draggable row; reordering updates `prefs.formatOrder` and the readout (collapsed or expanded) reflects the new order within 200 ms.

**Independent Test**: Open the format-toggle drawer; drag any row to a new position; readout updates within 200 ms; reload preserves the new order; `tests/unit/format-priority-list.spec.ts`, `tests/unit/preferences-format-order.spec.ts`, and `tests/integration/settings-format-priority.spec.ts` pass green.

### Tests for User Story 2 (write FIRST, RED before implementation) ⚠️

- [ ] T011 [P] [US2] Create `tests/unit/preferences-format-order.spec.ts` enforcing invariants 1, 2, 3, 4, 6 from `contracts/format-priority-schema.md`. Cases: v1 record loads → v3 with `formatOrder = DEFAULT_FORMAT_ORDER`; v2 record loads → same; v3 record with malformed `formatOrder` (length 5, dup, unknown kind) → fall back to default; v3 record with valid `formatOrder` round-trips through `savePreferences` / `loadPreferences`. Confirm the file lands RED before continuing.
- [ ] T012 [P] [US2] Create `tests/unit/format-priority-list.spec.ts` enforcing invariants 1, 4, 5, 6 from `contracts/drag-reorder-interaction.md` AND the purity of `reorderArray`. Cases: pointerdown → pointermove → pointerup commits with new index; pointerdown → pointercancel does NOT commit; pointerup at same index does NOT emit `reorder`; disabled-row drag still emits `reorder`; `reorderArray` is a permutation. Use synthetic `PointerEvent` instances per Pointer Events API. Confirm the file lands RED before continuing.
- [ ] T013 [P] [US2] Create `tests/integration/settings-format-priority.spec.ts` mounting `<App>` (jsdom), opening `<FormatToggle>`, dispatching a synthetic drag from row 3 → row 1, and asserting the readout's first visible row matches the new priority-1 kind within 200 ms (SC-002). Confirm the file lands RED before continuing.

### Implementation for User Story 2

- [ ] T014 [US2] Create `src/components/FormatPriorityRow.svelte` with the public surface described in `contracts/drag-reorder-interaction.md` §"Public surfaces": props `kind`, `enabled`; events `reorderRequest`, `toggle`. Render the drag handle with `class="tap-target drag-handle"` and `touch-action: none`. Implement the `pointerdown` / `pointermove` / `pointerup` / `pointercancel` lifecycle inline; emit `reorderRequest` only on commit (Invariants 4, 5). Reuse `format.labels.<kind>` for the label and the existing checkbox pattern from today's `FormatToggle`. Run `npm run format` after editing.
- [ ] T015 [US2] Edit `src/components/FormatToggle.svelte` to (a) accept a new `formatOrder: readonly CoordinateKind[]` prop, (b) replace the `{#each ALL_COORDINATE_KINDS …}` with `{#each formatOrder …}` rendering `<FormatPriorityRow>`, (c) handle the `reorderRequest` event by computing the new order via `reorderArray(formatOrder, from, to)` and dispatching `reorder` to the parent, (d) keep the existing `change` event firing on the per-row checkbox toggle, (e) add the visually-hidden `aria-live="polite"` announcer span per `contracts/drag-reorder-interaction.md` §"A11y contract" and update its text after every commit. Run `npm run format` after editing.
- [ ] T016 [US2] Edit `src/app/App.svelte` to (a) pass `formatOrder={prefs.formatOrder}` to `<FormatToggle>`, (b) handle the new `reorder` event by calling `savePreferences({ ...currentPrefs, formatOrder: e.detail.formatOrder })`. Do NOT touch `<CoordinateReadout>` in this task — its `formatOrder` prop wiring already came from US1's T008. Run `npm run format` after editing.
- [ ] T017 [US2] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `preferences-format-order.spec.ts`, `format-priority-list.spec.ts`, and `settings-format-priority.spec.ts` are GREEN; confirm `coordinate-readout-collapse.spec.ts` and all prior specs stay GREEN. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T018 [US2] Walk through `specs/010-mobile-collapsed-readout/quickstart.md` §2 manually: drag rows in the format-toggle drawer; observe the readout updating; reload to confirm persistence; cancel a drag mid-gesture and confirm no commit. Record any visible regression inline.

**Checkpoint**: User Stories 1 AND 2 both work independently. The user can both see (US1) AND control (US2) which format appears as the priority-one row.

---

## Phase 5: User Story 4 — Taipower coordinate uses auto-precision (Priority: P2)

**Goal**: A fresh installation defaults to `taipowerPrecision: 11`; the Go To Taipower input parser determines precision from the trimmed, separator-stripped input length (9 → 9-precision, 11 → 11-precision, anything else → existing localised "unsupported precision" rejection); the input layout drops the user-facing precision selector.

**Independent Test**: Fresh install → readout's Taipower row is 11 chars; Go To accepts both 9- and 11-char codes without precision dialog; existing user with stored `taipowerPrecision: 9` keeps 9 after upgrade; `tests/unit/preferences-defaults.spec.ts` and `tests/unit/taipower-parse-auto-precision.spec.ts` pass green.

### Tests for User Story 4 (write FIRST, RED before implementation) ⚠️

- [ ] T019 [P] [US4] Create `tests/unit/preferences-defaults.spec.ts` asserting (a) `defaultPreferences().taipowerPrecision === 11` (FR-014), (b) loading a v2 record with `taipowerPrecision: 9` produces a v3 result with `taipowerPrecision: 9` preserved (Invariant 5 of `contracts/format-priority-schema.md`), (c) loading a v2 record with `taipowerPrecision: 11` yields v3 with 11. Confirm the file lands RED before continuing.
- [ ] T020 [P] [US4] Create `tests/unit/taipower-parse-auto-precision.spec.ts` asserting invariants 1, 2, 3, 4 from `contracts/taipower-precision-autodetect.md`. Cases: `detectTaipowerPrecision('xxxxxxxxx') === 9`; `detectTaipowerPrecision('xxxxxxxxxxx') === 11`; `detectTaipowerPrecision('xxxxxxxxxx') === null`; whitespace + separator stripped before length check; the parser surfaces the existing `'unsupported-precision'` rejection (rejection key unchanged from feature 002) on null detect. Confirm the file lands RED before continuing.

### Implementation for User Story 4

- [ ] T021 [US4] Edit the Go To Taipower parser (file path verified at implementation time per `research.md` §R7 — likely `src/coord/parse/taipower.ts` or the equivalent module exported from `$coord/index`) to (a) drop its `precision` parameter, (b) call `detectTaipowerPrecision(input)` as the first step, (c) reject with the existing `'unsupported-precision'` rejection if detection returns `null`, (d) continue parsing with the detected precision otherwise. Update every internal call site in lockstep — no backwards-compat shim. Run `npm run format` after editing.
- [ ] T022 [US4] Edit `src/components/goto/TaipowerLayout.svelte` to remove the user-facing precision selector. The component still accepts a length-9 OR length-11 code in a single input. Do NOT add new locale keys; the existing `'unsupported-precision'` rejection text is what surfaces on length-10 and other invalid lengths. Run `npm run format` after editing.
- [ ] T023 [US4] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `preferences-defaults.spec.ts` and `taipower-parse-auto-precision.spec.ts` are GREEN; confirm the existing `tests/unit/coord/format-taipower.spec.ts` (or equivalent regression guard for canonical Taipower output) remains GREEN. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T024 [US4] Walk through `specs/010-mobile-collapsed-readout/quickstart.md` §4 manually: clear `localStorage`, confirm fresh install shows 11-char Taipower; paste 9-char and 11-char codes through Go To; verify a stored v2 record with `taipowerPrecision: 9` upgrades without losing the user's choice. Record any visible regression inline.

**Checkpoint**: All P2 user stories (US2 drag-reorder + US4 Taipower auto-precision) ship. P3 stories follow.

---

## Phase 6: User Story 3 — Tap collapsed readout to expand (Priority: P3)

**Goal**: When the readout is collapsed (US1's surface) and ≥ 2 formats are enabled, tapping the readout body (excluding copy button) flips a transient `tapExpanded` state showing every enabled row in priority order; tapping again returns to single row; resize past 600 px clears the state; reload does not preserve it; the copy button remains a one-tap operation.

**Independent Test**: Mobile Chrome 360 × 640 collapsed readout → tap → expanded → tap → collapsed; resize ≥ 600 px clears state; reload starts collapsed; copy never triggers expand; `tests/unit/coordinate-readout-tap-expand.spec.ts` passes green.

### Tests for User Story 3 (write FIRST, RED before implementation) ⚠️

- [ ] T025 [P] [US3] Create `tests/unit/coordinate-readout-tap-expand.spec.ts` enforcing invariants 3, 4, 5 from `contracts/readout-collapse-mode.md`. Cases: tap on body in `collapsed` → `data-mode === 'tap-expanded'`; tap again → back to `collapsed`; tap on `[data-testid="copy-{kind}"]` does NOT change `data-mode` (Invariant 3); resize matchMedia stub from match → no-match clears `tapExpanded` (Invariant 5); `aria-expanded` toggles between `false` and `true` correctly. Confirm the file lands RED before continuing.

### Implementation for User Story 3

- [ ] T026 [US3] Edit `src/components/CoordinateReadout.svelte` to (a) add `let tapExpanded = false` reactive state, (b) attach `on:click={onBodyTap}` to the readout root with `onBodyTap` flipping `tapExpanded` only when the current `viewMode === 'collapsed'`, (c) use a `$:` reactive block to clear `tapExpanded` when the matchMedia query becomes false, (d) add `event.stopPropagation()` to every copy button's click handler so copy does NOT bubble to the body tap (Invariant 3), (e) add `role="button"` and `aria-expanded` keyed off `data-mode` per `contracts/readout-collapse-mode.md` §"A11y contract", (f) handle keyboard `Enter` / `Space` on the readout root mirroring the tap behaviour. Run `npm run format` after editing.
- [ ] T027 [US3] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `coordinate-readout-tap-expand.spec.ts` is GREEN and `coordinate-readout-collapse.spec.ts` (US1) plus all other prior specs stay GREEN. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T028 [US3] Walk through `specs/010-mobile-collapsed-readout/quickstart.md` §3 manually: tap collapsed readout → expanded; tap again → collapsed; tap copy → never expands; resize past 600 px → clears state; reload → starts collapsed. Record any visible regression inline.

**Checkpoint**: User Stories 1, 2, 3, 4 all functional. The user can collapse, reorder, expand on demand, and use Taipower without manual precision selection.

---

## Phase 7: User Story 5 — TWD zone selector shows geographic context (Priority: P3)

**Goal**: The Go To dialog's TWD97-TM2 and TWD67-TM2 zone selectors render the `121` and `119` options with a localised geographic tag (`本島` / `Main Island` / `本島` and `澎湖` / `Penghu` / `澎湖列島`); the `auto` option label is unchanged.

**Independent Test**: Open Go To, switch to TWD97-TM2; zone option `121` shows "121 (Main Island)" / "121 本島" / similar per locale; option `119` shows the Penghu tag; option `auto` is unchanged; switch to TWD67-TM2 — same labels. `tests/unit/zone-label.spec.ts` passes green.

### Tests for User Story 5 (write FIRST, RED before implementation) ⚠️

- [ ] T029 [P] [US5] Create `tests/unit/zone-label.spec.ts` enforcing invariants 1, 2, 3, 4 from `contracts/zone-label-i18n.md`. For each locale (`zh`, `en`, `ja`), mount `<Tm2Layout>` and `<Twd67Layout>`, open the zone selector, and assert: (a) the option representing zone 121 contains the locale's `goto.fields.zoneTagMainIsland` text, (b) the option representing zone 119 contains the locale's `goto.fields.zoneTagPenghu` text, (c) the option representing `auto` is unchanged from feature 002 (snapshot of `goto.fields.zoneAuto`). Confirm the file lands RED before continuing.

### Implementation for User Story 5

- [ ] T030 [US5] Edit `src/components/goto/Tm2Layout.svelte` to compose each non-`auto` zone option's visible label per `contracts/zone-label-i18n.md` §"Composition rule": option `121` → `${tStore('goto.fields.zone121')} ${tStore('goto.fields.zoneTagMainIsland')}` (or the locale-appropriate composition; use existing interpolatable key if found, else the simple concatenation pattern). Option `119` → analogous with `zoneTagPenghu`. Option `auto` (`goto.fields.zoneAuto`) is unchanged. Run `npm run format` after editing.
- [ ] T031 [US5] Edit `src/components/goto/Twd67Layout.svelte` to apply the same composition rule as T030 (FR-017). Run `npm run format` after editing.
- [ ] T032 [US5] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `zone-label.spec.ts` is GREEN and existing Go To layout specs (under `tests/unit/goto/` or equivalent) remain GREEN. Run `npm run bundle-size` and confirm the entry-bundle gzipped delta from the master baseline is still ≤ +1 KiB.
- [ ] T033 [US5] Walk through `specs/010-mobile-collapsed-readout/quickstart.md` §5 manually: open Go To with TWD97-TM2, then TWD67-TM2; verify the option labels in `zh`, `en`, `ja` locales by switching the active locale; verify the `auto` option label is unchanged. Record any visible regression inline.

**Checkpoint**: All five user stories independently functional. Feature is functionally complete; remaining work is documentation and the constitution doc gates.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation gates required by Constitution Principle III (UX consistency → `docs/ui/`) and Principle V (ADR), plus the deploy-gate script and the final acceptance walkthrough.

- [ ] T034 [P] Create `docs/ui/0010-mobile-collapsed-readout.md` covering all five user-visible changes: collapsed-on-narrow readout (US1), drag-to-reorder priority list (US2), tap-to-expand collapsed readout (US3), Taipower auto-precision input + 11-char fresh default (US4), TWD zone geographic-tag labels (US5). Include rationale, affected screens (readout, format-toggle drawer, Go To dialog's TM2/TWD67/Taipower layouts), screenshots before / after at 360 × 640 AND 1024 × 768 (saved under `docs/ui/screenshots/`), explicit reference to `--readout-collapse-bp: 600px`, the `formatOrder` schema field, and the two new locale keys. Cross-link from `docs/ui/README.md`.
- [ ] T035 [P] Create `docs/adr/0030-format-priority-and-collapse.md` codifying: (a) the `formatOrder` schema field and v2 → v3 migration, (b) the `--readout-collapse-bp: 600px` collapse threshold, (c) the rejection of `svelte-dnd-action` and the choice of self-contained Pointer Events drag, (d) the deferral of keyboard reordering to a future feature, (e) the Taipower auto-precision rule (length-based dispatch + `taipowerPrecision: 11` fresh default), (f) the explicit two-key i18n exception (`zoneTagMainIsland`, `zoneTagPenghu`), (g) the relationship to ADR 0014 (Accessibility Baseline), ADR 0017 (Go To split layout), ADR 0021 (additive prefs evolution), and ADR 0029 (mobile touch-target) — explicitly NOT superseding them. Update `docs/adr/README.md` to insert ADR 0030 in the index.
- [ ] T036 Run `npm run deploy:check` (the full format → lint → typecheck → test → build → bundle-size pipeline + the deploy-base-alignment integration spec) and confirm a clean exit. Capture the bundle-size report's gzipped delta vs `master` baseline; record it in the PR description for Principle IV traceability.
- [ ] T037 Walk the entire `specs/010-mobile-collapsed-readout/quickstart.md` end-to-end (§1 + §2 + §3 + §4 + §5 + §6) on a fresh Chromium-mobile emulator and confirm all six sections pass; sign off the table at the bottom of `quickstart.md`. This is the final acceptance gate before opening the PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 only.
- **Phase 2 (Foundational)**: T002, T003, T004 are mutually `[P]` (three different files). T002 BLOCKS US1 + US3. T003 BLOCKS US2 + US4. T004 BLOCKS US5.
- **Phase 3 (US1)**: All US1 tasks depend on T002. T007 + T008 do NOT touch the same line block within `App.svelte` as US2's T016, but to avoid working-tree friction sequence T008 before T016 on a single dev's machine.
- **Phase 4 (US2)**: All US2 tasks depend on T003. T014 (FormatPriorityRow creation) BLOCKS T015. T015 BLOCKS T016.
- **Phase 5 (US4)**: All US4 tasks depend on T003. Independent of US1 / US2 / US3.
- **Phase 6 (US3)**: All US3 tasks depend on T002 AND on US1's T007 (the collapse logic must already exist before tap-expand layers on top — they share `CoordinateReadout.svelte`).
- **Phase 7 (US5)**: All US5 tasks depend on T004. Independent of every other US.
- **Phase 8 (Polish)**: T034 / T035 may start any time after at least one user story completes; T036 / T037 depend on all five user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After T002. Independent of US2 / US3 / US4 / US5 by design.
- **US2 (P2)**: After T003. Touches `App.svelte` (T016) — share with US1's T008. Sequence T008 before T016 to avoid merge friction. Otherwise independent.
- **US4 (P2)**: After T003. Independent of every other US (different files: parser + TaipowerLayout).
- **US3 (P3)**: After US1's T007 (shared file `CoordinateReadout.svelte`). Within-story sequential.
- **US5 (P3)**: After T004. Independent of every other US (different files: TM2/TWD67 layouts).

### Within Each User Story

- Tests (T005, T006, T011, T012, T013, T019, T020, T025, T029) MUST be written and confirmed RED before any implementation task in their story.
- Within-story implementation tasks marked `[P]` may run in parallel; non-`[P]` tasks within a story are sequenced.
- After every implementation task, `npm run format` MUST run on the touched file (Constitution Principle I + Development Workflow §"Formatting gate").

### Parallel Opportunities

- Phase 2: T002, T003, T004 are all `[P]`.
- Within US1: T005, T006 are `[P]` (test files).
- Within US2: T011, T012, T013 are `[P]`.
- Within US4: T019, T020 are `[P]`.
- Within US3: T025 stands alone (only one test file).
- Within US5: T029 stands alone (one test). T030 + T031 could be `[P]` (different files) but conventionally sequence them so the test author can confirm both layouts in the same iteration.
- Polish: T034 and T035 are `[P]`.

---

## Parallel Example: User Story 2 implementation

```bash
# After T003 (prefs schema) is in and T011/T012/T013 (tests) are RED, fan out:
Task: "Create src/components/FormatPriorityRow.svelte with Pointer Events drag handle"
# Then sequential:
Task: "Edit src/components/FormatToggle.svelte to render FormatPriorityRow rows + handle reorderRequest"
Task: "Edit src/app/App.svelte to handle reorder event and persist via savePreferences"
Task: "npm run format && npm run lint && npm run typecheck && npm test && npm run bundle-size"
```

## Parallel Example: Polish

```bash
Task: "Author docs/ui/0010-mobile-collapsed-readout.md"
Task: "Author docs/adr/0030-format-priority-and-collapse.md and update docs/adr/README.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 (foundation: token + ensure gates clean).
2. T005 + T006 (RED tests for collapse).
3. T007 → T008 (apply collapse to readout + wire prop).
4. T009 (gate run) + T010 (manual quickstart §1).
5. **STOP and VALIDATE**: collapsed readout no longer overlaps zoom controls on phone emulator; this alone fixes the user's primary complaint.
6. Optionally ship as an interim PR.

### Incremental Delivery

1. MVP (US1) → demo / ship.
2. Add US2 (drag-to-reorder) → demo / ship.
3. Add US4 (Taipower auto-precision) → demo / ship.
4. Add US3 (tap-to-expand) → demo / ship.
5. Add US5 (TWD zone hints) → demo / ship.
6. Polish (docs/ui/, ADR, deploy:check, quickstart sign-off).

Each story adds value without breaking previous stories. Each test green stays green for the rest of the feature.

### Parallel Team Strategy

With multiple developers after T002 / T003 / T004 (all foundational) land:

1. Developer A: US1 (T005 → T010).
2. Developer B: US4 (T019 → T024) — *can start in parallel with A*; no shared file.
3. Developer C: US5 (T029 → T033) — *can start in parallel with A*; no shared file.
4. Developer D: US2 (T011 → T018) — *coordinate with A on `src/app/App.svelte`*: A finishes T008 before D starts T016, or rebase / merge once A's PR lands.
5. US3 (T025 → T028) waits for A's T007 to land (shared `CoordinateReadout.svelte`).
6. Polish (T034–T037) once all five stories merge.

---

## Notes

- `[P]` tasks = different files, no incomplete dependency in the same phase.
- `[Story]` label maps task to user story for traceability and for the `/speckit.analyze` cross-check.
- Each user story is independently testable per its checkpoint; ship one at a time if needed.
- TDD is non-negotiable per Constitution Principle II — every implementation task has a corresponding RED test that lands first.
- Run `npm run format` after every code edit per Constitution Principle I and the project's Development Workflow §"Formatting gate".
- Two new i18n keys (`goto.fields.zoneTagMainIsland`, `goto.fields.zoneTagPenghu`) × 3 locales = 6 new strings. Every other UI string reuses existing keys.
- `npm run bundle-size` should report ≤ +1 KiB gzipped at every gate run.
- After `/speckit.analyze` and `/speckit.implement`: update `docs/adr/README.md` per Constitution Principle V.
