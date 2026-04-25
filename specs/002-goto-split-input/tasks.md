---

description: "Tasks: Go-To Split-Field Input"
---

# Tasks: Go-To Split-Field Input

**Input**: Design documents from `/specs/002-goto-split-input/`
**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is non-negotiable per Constitution v1.1.0 Principle II — every production
code task is paired with a preceding test task. Each test MUST be written first and
verified failing before its implementation task is started.

**Organization**: Tasks are grouped by user story so each story is independently
implementable and testable. The MVP corresponds to **Phase 3 — User Story 1** alone.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to a user story from spec.md (US1 / US2 / US3)
- File paths are absolute relative to the repo root

## Path Conventions

Single project — `src/` and `tests/` at repo root. Adjusted from plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Documentation skeletons and constitutional bookkeeping that
must exist before any production code lands.

- [X] T001 [P] Create `docs/ui/0002-goto-split-input.md` skeleton — sections for chip rack, layout grids, recents row, disambiguator, destination indicator, design tokens reused from `src/app/tokens.css` (Constitution Principle III)
- [X] T002 [P] Create ADR skeletons `docs/adr/0017-goto-split-layout-architecture.md`, `docs/adr/0018-recents-storage-schema.md`, `docs/adr/0019-flyto-zoom-preservation.md` populated with Status: Proposed and the rationale stubs from `research.md` D1 / D3 / D5 (Constitution Principle V)
- [X] T003 [P] Update `docs/adr/README.md` and `docs/ui/README.md` indexes to include the new entries with "draft until /speckit.implement" annotations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, i18n keys, parser surface, and `flyTo` semantics that every user story depends on.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

- [X] T004 Create `src/types/goto.ts` exporting `FormatSelection`, `LayoutFields` (discriminated union per format), `RecentEntry`, `RecentList`, `Candidate`, `DestinationIndicator` per `data-model.md` §1–§5
- [X] T005 [P] Add new i18n keys to `src/i18n/zh.json` (canonical key set) under `goto.chips.*`, `goto.fields.*`, `goto.recent.*`, `goto.errors.*`, `goto.disambig.*`, `goto.indicator.*` — see research D9 for the namespace plan
- [X] T006 [P] Mirror the same key set in `src/i18n/en.json` with English copy
- [X] T007 [P] Mirror the same key set in `src/i18n/ja.json` with Japanese copy
- [X] T008 [P] Write failing test for parser sub-parser named exports — extend `tests/unit/coord/parser.spec.ts` to assert `parseDdOnly`, `parseDmsOnly`, `parseMgrsOnly`, `parseTm2InferredOnly`, `parseTm2ExplicitOnly`, `parseTwd67Only`, `parseTaipowerOnly` exist and each returns the same `GoToRequest` shape as the dispatcher (per `contracts/composer.md` §3)
- [X] T009 Add the named sub-parser exports to `src/coord/parser.ts` as thin re-exports of the existing internal functions (no grammar change — feature 001's parser contract MUST stay unchanged)
- [X] T010 [P] Write failing test for zoom preservation in a new `tests/unit/map/MapController.spec.ts` covering: (a) currentZoom 5 + no `options.zoom` → underlying `flyTo` receives `zoom: 5`, (b) currentZoom 18 + no `options.zoom` → `zoom: 18`, (c) explicit `options.zoom: 12` overrides current zoom (per `contracts/flyto-zoom.md` §4)
- [X] T011 Amend `src/map/MapController.ts` `flyTo` so the default `nextZoom` is `currentZoom` rather than the snap-to-15 fallback from feature 001

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Pick a format, type into labelled fields (Priority: P1) 🎯 MVP

**Goal**: Operator taps one of seven format chips; the modal body re-lays into per-format split fields; values are composed into a canonical raw string; the parser accepts; the map flies to the target without changing zoom.

**Independent Test**: Open the Go-To modal. Tap each of the seven chips. Verify the body reconfigures per `docs/ui/007-goto-modal-and-taipower-rows.md` (one field per semantic component, except `自動偵測` which keeps the single free-text field). Type the canonical values for each format from `tests/unit/fixtures/test-vectors.json` and submit; the map MUST land on the published coordinate.

### Tests for User Story 1 (TDD — write first, verify failing)

- [X] T012 [US1] Write `tests/unit/coord/composer.spec.ts` covering the seven cases in `contracts/composer.md` §2 (auto / dd / dms / twd97-tm2 / twd67-tm2 / mgrs / taipower), each-field empty rejections (`§4 obligation 2`), MGRS / Taipower upper-casing (`§4 obligation 3`), TWD67 prefix exactness (`§4 obligation 4`), TWD97 zone-explicit vs inferred raw + hint distinction (`§4 obligation 5`), discriminant-mismatch rejection (`§4 obligation 6`), and the round-trip property against `tests/unit/fixtures/test-vectors.json`
- [X] T013 [US1] Implement `src/coord/composer.ts` exporting `composeRaw(selection, fields): ComposeResult` per `contracts/composer.md` §1 — verify T012 passes
- [X] T014 [US1] Write `tests/integration/go-to-split.spec.ts` US1 describe block: chip rack renders 7 chips in order, switching chip re-lays the body, each layout submits through the matching sub-parser hint, format-specific rejection messages surface (FR-012)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `src/components/goto/ChipRack.svelte` with `role="tablist"` and chip buttons using `role="tab"` + `aria-selected` per research D6
- [X] T016 [P] [US1] Implement `src/components/goto/AutoLayout.svelte` (single `<textarea>` mirroring the current `goto-input` testid for selector compatibility)
- [X] T017 [P] [US1] Implement `src/components/goto/DdLayout.svelte` (`緯度` and `經度` numeric fields with `inputmode="decimal"`)
- [X] T018 [P] [US1] Implement `src/components/goto/DmsLayout.svelte` with deg/min/sec × 2 fields and a two-segment N/S, E/W `role="radiogroup"` selector per research D8 + FR-005
- [X] T019 [P] [US1] Implement `src/components/goto/Tm2Layout.svelte` with easting / northing fields plus a `zone` selector (`auto | 119 | 121`) for TWD97
- [X] T020 [P] [US1] Implement `src/components/goto/Twd67Layout.svelte` with easting / northing fields only (no zone, per `data-model.md` §2 validation rules)
- [X] T021 [P] [US1] Implement `src/components/goto/MgrsLayout.svelte` — GZD+band field auto-uppercased, 100 km square auto-uppercased, easting/northing digit-filtered per research D7 + FR-004
- [X] T022 [P] [US1] Implement `src/components/goto/TaipowerLayout.svelte` with `前 5 碼` and `後 4 或 6 碼` fields plus a 9 / 11 precision toggle
- [X] T023 [US1] Rewrite `src/components/GoToDialog.svelte` to: host `ChipRack`, render the active layout component, manage per-layout field state, on submit call `composeRaw()` then route through the hint-named sub-parser per `contracts/composer.md` §3, surface format-specific localised errors, dispatch `submit` with the existing `GoToRequestOk` shape — verify T014 passes
- [X] T024 [US1] Update `tests/e2e/story-3-go-to.spec.ts` selectors / flows where they assumed the old single-textarea dialog (the auto-detect path keeps its `goto-input` testid via `AutoLayout.svelte`); the existing acceptance scenarios MUST still pass
- [X] T025 [US1] Write `tests/e2e/story-3b-split-and-recents.spec.ts` US1 describe block covering each chip's happy path against the published test-vectors (Taipei 101 for DD/DMS/MGRS/TWD97/TWD67, Taipower B7039 BD32 for the Taipower layout)

**Checkpoint**: User Story 1 is shippable as the MVP — operators can enter coordinates via labelled fields for any of the seven formats.

---

## Phase 4: User Story 2 — Re-use a recent coordinate in one tap (Priority: P2)

**Goal**: A persistent recent-inputs row at most 10 entries, dedup by `(format, raw)`, FIFO-evicted, MRU-ordered. Tap = re-submit; long-press = delete-with-confirm. Survives reloads; corrupt data → empty list.

**Independent Test**: Submit three distinct entries in three formats. Reload the page. Re-open the modal — recents row shows the three entries MRU-first. Tap the middle one — modal closes, map pans, entry rises to top on next open. Long-press another, confirm delete — entry removed; others intact. Long-press, cancel — list unchanged.

### Tests for User Story 2 (TDD — write first, verify failing)

- [X] T026 [US2] Write `tests/unit/storage/recents.spec.ts` covering all 11 obligations in `contracts/recents-storage.md` §5 (empty load, round-trip, version mismatch, corrupt JSON, bad entry shape, add-empty, add-LRU, add-FIFO-eviction, add-distinct-identity, remove, persistence size sanity)
- [X] T027 [US2] Implement `src/storage/recents.ts` exporting `loadRecents`, `saveRecents`, `addRecent`, `removeRecent`, `RECENTS_KEY = 'pwa_map:gotoHistory_v1'`, `MAX_RECENTS = 10` per `contracts/recents-storage.md` §3 — verify T026 passes
- [X] T028 [US2] Extend `tests/integration/go-to-split.spec.ts` with US2 describe block: recents row renders MRU-ordered, tap-submit closes the modal and emits `submit`, long-press 500 ms with no ≥ 6 px movement opens the delete confirmation, confirm removes the entry, cancel leaves it, reload-resilience (write a fixture into localStorage and assert it renders)

### Implementation for User Story 2

- [X] T029 [US2] Implement `src/components/goto/RecentChips.svelte` with `goto.recent.tooltip` localised hover/focus copy and `pointerdown`/`pointerup`/`pointermove` long-press detection per research D10
- [X] T030 [US2] Wire the recents pipeline into `src/components/GoToDialog.svelte`: call `loadRecents()` when `open` flips to `true`, render `<RecentChips>` above the chip rack when entries exist, on submit call `addRecent()` and persist, on long-press confirmation call `removeRecent()` and persist — verify T028 passes
- [X] T031 [US2] Extend `tests/e2e/story-3b-split-and-recents.spec.ts` with US2 describe block covering acceptance scenarios US2.AS1–AS6 (insert order, FIFO at 10, dedup move-to-front, long-press delete confirm, long-press cancel, reload persistence)

**Checkpoint**: Recents row is fully functional. The MVP from Phase 3 + the recents row from this phase deliver Stories 1 + 2 independently.

---

## Phase 5: User Story 3 — Disambiguate ambiguous numeric input + confirm landing (Priority: P3)

**Goal**: When `自動偵測` produces ≥ 2 plausible interpretations, a Disambiguator bottom sheet opens; the operator picks one and the map flies. Successful Go-Tos overlay a fading destination indicator for 3 s (or until pan/zoom). Zoom is preserved across every Go-To.

**Independent Test**: With `自動偵測` active, submit `306962.887, 2769619.124` — Disambiguator lists ≥ 2 candidates including TWD97 zone 121, TWD97 zone 119, and TWD67. Pick zone 121 — modal closes, map flies to Taipei 101 with the destination indicator appearing for 3 s. Set zoom to 18, fly to a target 100 km away — final zoom is still 18.

### Tests for User Story 3 (TDD — write first, verify failing)

- [X] T032 [US3] Write `tests/unit/coord/disambiguate.spec.ts` covering all six obligations in `contracts/disambiguator.md` §3 (TWD97 dual-zone case yields ≥ 2 candidates; unambiguous DD yields exactly 1; Taipower yields exactly 1; garbage yields []; every candidate's `target` lies inside `coverageOf`'s Taiwan box; sub-parser preference ordering DD → DMS → MGRS → TWD97-119 → TWD97-121 → TWD67 → Taipower)
- [X] T033 [US3] Implement `src/coord/disambiguate.ts` exporting `candidates(raw): readonly Candidate[]` per `contracts/disambiguator.md` §1 — verify T032 passes
- [X] T034 [US3] Extend `tests/integration/go-to-split.spec.ts` with US3 describe block: 1-candidate auto-submit goes straight to flyTo with no Disambiguator render; ≥ 2-candidate submit opens the sheet without moving the map; pick → flyTo to the picked target; cancel → no map movement; destination indicator becomes visible after a successful flyTo and hides on a user `move` within 150 ms; current zoom is preserved across the flyTo

### Implementation for User Story 3

- [X] T035 [P] [US3] Implement `src/components/goto/Disambiguator.svelte` per `contracts/disambiguator.md` §2 — `role="dialog"` bottom sheet, candidate rows as `data-testid="disambig-row-{i}"` buttons with localised label + back-projected DD preview, Escape and backdrop cancel, focus trapped while open
- [X] T036 [P] [US3] Implement `src/components/goto/DestinationIndicator.svelte` per `contracts/destination-indicator.md` §2 — DOM overlay, `aria-hidden="true"`, `pointer-events: none`, fade-in 200 ms / hold 3 s / fade-out 300 ms, exposes `start()` / `stop()` (or backed by a writable store under `src/components/goto/destinationStore.ts`); user-vs-program-initiated `move` distinguished per `contracts/destination-indicator.md` §3 buffer rule
- [X] T037 [US3] Wire the Disambiguator into `src/components/GoToDialog.svelte`: on `auto`-chip submit, call `candidates(raw)`; if `length ≥ 2` open the sheet with the candidate list and suspend dispatching `submit` until the user picks; pick dispatches `submit` with the picked candidate's target; cancel keeps the modal open and the map unchanged
- [X] T038 [US3] Wire the DestinationIndicator into `src/app/App.svelte` (or wherever `flyTo` is currently triggered): on every successful `flyTo` resolution call `start()`; subscribe to `MapController.onMove` to call `stop()` on user-initiated moves only — verify T034 passes
- [X] T039 [US3] Extend `tests/e2e/story-3b-split-and-recents.spec.ts` with US3 describe block including (a) the AS1 ambiguous-DD case end-to-end, (b) AS2 cancel-leaves-map-untouched, (c) AS3 indicator visibility window (3 s + fade), (d) AS4 indicator dismiss-on-pan within 150 ms (SC-007), (e) AS5/SC-003 zoom-preservation sweep across 100 random starting zooms in `[2, 18]`

**Checkpoint**: All three user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation finalisation, and the constitutional review loop (Principles I, IV, V).

- [X] T040 [P] Run `npm run format` on the worktree (Constitution Principle I + Development Workflow formatting gate)
- [X] T041 Run `npm run lint` and fix any warnings (`--max-warnings 0`)
- [X] T042 Run `npm run typecheck` and resolve any errors
- [X] T043 Run `npm run test` (all Vitest unit + integration) — all green
- [X] T044 Run `npm run test:e2e` — all green including the new `story-3b-split-and-recents.spec.ts`
- [X] T045 [P] Run `npm run bundle-size` — confirm JS gzipped ≤ 200 KB and CSS gzipped ≤ 22 KB (Performance Goals + Constitution Principle IV); profile and trim if a budget is breached
- [X] T046 [P] Finalize `docs/ui/0002-goto-split-input.md` with screenshots, the chip-rack design tokens reused, the layout grid spec, recents-row visual, disambiguator sheet, and destination-indicator timing diagram
- [X] T047 [P] Finalize `docs/adr/0017-goto-split-layout-architecture.md` with the realised composer + sub-parser-routing design notes; finalize `0018-recents-storage-schema.md` with the on-disk schema + corrupt-load fallback rationale; finalize `0019-flyto-zoom-preservation.md` with the call-site impact analysis
- [X] T048 Update `docs/adr/README.md` to mark 0017 / 0018 / 0019 Accepted (Constitution Principle V — index updated after `/speckit.implement`)
- [X] T049 Walk through `specs/002-goto-split-input/quickstart.md` US1 / US2 / US3 smoke tests on a clean `npm run dev` and record any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No external dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — independently testable thereafter
- **Phase 4 (US2)**: Depends on Phase 2 — independently testable; integrates with the existing modal but does NOT depend on US1's per-format layouts to be complete (the auto-layout shipped in T016 is sufficient to demonstrate recents)
- **Phase 5 (US3)**: Depends on Phase 2 — independently testable; the Disambiguator only opens for the auto-detect path so it does NOT depend on US1's per-format layouts; the destination indicator + zoom preservation work for any successful flyTo
- **Phase 6 (Polish)**: Depends on whichever user stories are scheduled into the release cut

### Within Each User Story

- Tests written first; implementation MUST NOT begin until the matching test is observed failing
- Pure modules (composer, recents, disambiguate) before their UI consumers
- Layout components within US1 are mutually independent — the seven `[P]` impl tasks parallelise
- The `GoToDialog` rewrite consumes both the composer and every layout, so it lands AFTER all of them within US1

### Parallel Opportunities

- All Phase 1 tasks are `[P]` (different files: docs/ui, docs/adr, README updates)
- Phase 2 i18n tasks (T005 / T006 / T007) are `[P]` across three locale files
- Phase 2 parser-test (T008) and flyTo-test (T010) are `[P]` (different files), independent of T004 / T005–T007
- Within US1 (Phase 3): T015–T022 (seven layout components) are `[P]`
- Within US3 (Phase 5): T035 (Disambiguator) and T036 (DestinationIndicator) are `[P]`
- Phase 6 verification tasks (T040 / T045 / T046 / T047) are `[P]` once they have no upstream blockers

### Sequential Hot Spots

- `tests/integration/go-to-split.spec.ts` is a single file extended in T014, T028, T034 — those three tasks edit the same file across stories, so they MUST run sequentially across phase boundaries
- `tests/e2e/story-3b-split-and-recents.spec.ts` is similarly extended in T025, T031, T039 — sequential across phase boundaries
- `src/components/GoToDialog.svelte` is touched by T023 (US1 rewrite), T030 (US2 wiring), T037 (US3 wiring) — sequential

---

## Parallel Example: User Story 1 layout components

```bash
# After T013 (composer.ts) lands, these seven implementations can run in parallel:
Task: "Implement src/components/goto/ChipRack.svelte"
Task: "Implement src/components/goto/AutoLayout.svelte"
Task: "Implement src/components/goto/DdLayout.svelte"
Task: "Implement src/components/goto/DmsLayout.svelte"
Task: "Implement src/components/goto/Tm2Layout.svelte"
Task: "Implement src/components/goto/Twd67Layout.svelte"
Task: "Implement src/components/goto/MgrsLayout.svelte"
Task: "Implement src/components/goto/TaipowerLayout.svelte"

# T023 (GoToDialog rewrite) blocks until all of the above have landed.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup): T001–T003
2. Complete Phase 2 (Foundational): T004–T011 (CRITICAL — blocks all stories)
3. Complete Phase 3 (User Story 1): T012–T025
4. **STOP and validate**: Run the US1 walkthrough in `quickstart.md`. The dialog now offers seven chips, every chip's split layout works, and the map flies to published targets without changing zoom.
5. Run minimal Polish (T040–T044) to ensure formatter / linter / typecheck / tests are clean.
6. Deploy / demo as MVP.

### Incremental Delivery

- After MVP: add Phase 4 (US2 recents) for repeat-target ergonomics → demo
- Then add Phase 5 (US3 disambiguator + indicator + zoom preservation) for the safety + polish layer → demo
- Phase 6 polish runs at the end of each increment to keep CI green

### Parallel Team Strategy

Once Phase 2 completes, US1 / US2 / US3 can be staffed to three developers:

- Dev A → Phase 3 (US1, the largest phase by component count)
- Dev B → Phase 4 (US2, smallest phase — recents store + one component + dialog wiring)
- Dev C → Phase 5 (US3, includes the disambiguator + indicator + zoom-preservation sweep)

Coordination point: the three sequential hot spots (`go-to-split.spec.ts`, `story-3b-split-and-recents.spec.ts`, `GoToDialog.svelte`) must be merged in a serialised order; agree on a merge cadence (e.g., US1 first, then US2, then US3) up front.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks
- `[Story]` label maps each task to its user story for traceability
- TDD ordering is enforced: every implementation task has a preceding test task in the same phase, and tests MUST be observed failing before implementation begins
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow)
- Update `docs/adr/README.md` after `/speckit.implement` (Principle V)
- Update `docs/ui/0002-goto-split-input.md` for any visible UI change (Principle III)
- All user-facing strings resolve through `src/i18n/{zh,en,ja}.json` with `zh` as the canonical key set (Constitution v1.1.0 Locale conventions)
