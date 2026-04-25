---

description: "Tasks: Locale Switcher + Map Layer Selector"
---

# Tasks: Locale Switcher + Map Layer Selector

**Input**: Design documents from `/specs/003-i18n-and-map-layers/`
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

Single project — `src/` and `tests/` at repo root. Continued from features 001 / 002.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Documentation skeletons and constitutional bookkeeping that
must exist before any production code lands.

- [X] T001 [P] Create `docs/ui/0003-layers-and-locale.md` skeleton — sections for the layer picker (toolbar button + grouped dropdown), locale picker (toolbar button + self-name list), attribution-bar update, failure toast, design tokens reused from `src/app/tokens.css` (Constitution Principle III)
- [X] T002 [P] Create ADR skeletons `docs/adr/0020-map-source-catalogue.md`, `docs/adr/0021-prefs-additive-evolution.md`, `docs/adr/0022-tile-failure-toast.md` populated with Status: Proposed and rationale stubs from `research.md` D1 / D4 / D5 (Constitution Principle V)
- [X] T003 [P] Update `docs/adr/README.md` and `docs/ui/README.md` indexes to include the new entries with "draft until /speckit.implement" annotations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, i18n keys, the immutable map-source catalogue,
the pure style-builder, and the additive `pwa_map:prefs` schema fields
that every user story depends on.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

- [X] T004 Create `src/types/map.ts` exporting `LayerSelection` (`{ basemap: BasemapId; overlay: boolean }`) per `data-model.md` §2
- [X] T005 [P] Add new i18n keys to `src/i18n/zh.json` (canonical key set) under `map.layers.*`, `map.layers.group.*`, `map.attribution.*`, `map.failure.*`, `locale.picker.*`, `toolbar.layers.button`, `toolbar.locale.button` — see research D9 for the namespace plan
- [X] T006 [P] Mirror the same key set in `src/i18n/en.json` with English copy
- [X] T007 [P] Mirror the same key set in `src/i18n/ja.json` with Japanese copy
- [X] T008 [P] Write failing test `tests/unit/map/sources.spec.ts` covering all 10 invariants in `contracts/map-sources.md` §3 (length, unique ids, https-only, `hl=zh-TW` rules per source, overlay count, basemap order, default basemap)
- [X] T009 Implement `src/map/sources.ts` exporting `MapLayerOption`, `BasemapId`, `OverlayId`, the frozen `MAP_SOURCES` array (7 entries verbatim per `contracts/map-sources.md` §2), `DEFAULT_BASEMAP`, `findSource`, `basemaps`, `overlays` — verify T008 passes
- [X] T010 [P] Write failing test `tests/unit/map/styleBuilder.spec.ts` covering all six obligations in `contracts/style-builder.md` §4 (OSM only, NLSC only, Google hybrid only, Google satellite + overlay, NLSC + overlay, deterministic deep-equality)
- [X] T011 Implement `src/map/styleBuilder.ts` exporting `buildStyle(basemap, overlay)` per `contracts/style-builder.md` §1–§3 (including the `{a-c}` OSM expansion rule) — verify T010 passes
- [X] T012 [P] Extend `tests/unit/storage/preferences.spec.ts` with the six new obligations in `contracts/preferences-v1.md` §5 (pre-003 blob loads, round-trip, invalid `mapLayer`, overlay-id rejection, non-boolean `overlay`, default helper) — write failing first
- [X] T013 Amend `src/storage/preferences.ts` to validate optional `mapLayer` and `overlay` fields per `contracts/preferences-v1.md` §2; update `defaultPreferences()` to set `mapLayer = 'osm-standard'`, `overlay = false` per §3 — verify T012 passes

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Switch the map layer (Priority: P1) 🎯 MVP

**Goal**: Operator picks one of six basemaps from a grouped dropdown; the map repaints with the new tiles within 1.5 s; the attribution-bar updates; the operator can independently toggle the Google road overlay on top; tile-load failures auto-revert to the previous basemap with a localised toast; selection persists across reloads.

**Independent Test**: Open the app. Tap `圖層`. Pick `NLSC 電子地圖（等高線+門牌）` — map repaints, attribution shows NLSC. Pick `Google 衛星混合` — Google labels appear in Traditional Chinese. Toggle `Google 路網疊加層` on — road network overlays. Reload the page — both choices are restored. Block the NLSC origin in DevTools and pick NLSC — toast surfaces within 5 s and the previous basemap remains visible.

### Tests for User Story 1 (TDD — write first, verify failing)

- [X] T014 [US1] Extend `tests/unit/map/MapController.spec.ts` with the `setBasemap` + tile-failure path: (a) `setBasemap('nlsc-emap5', false)` calls `map.setStyle` with the NLSC style, (b) tile-error events within 5 s of a swap revert the basemap to the previous selection and emit a `tilefail` event with the failed id, (c) successful tile loads after a swap clear the failure snapshot
- [X] T015 [US1] Write `tests/integration/layers-and-locale.spec.ts` US1 describe block: `LayerPicker` renders 6 basemap rows in catalogue order + 1 overlay toggle row separately; active basemap row has `aria-checked="true"`; picking a different row dispatches `change` with the new basemap and unchanged overlay; toggling the overlay dispatches `change` with unchanged basemap and inverted overlay; Escape dispatches `close`

### Implementation for User Story 1

- [X] T016 [US1] Amend `src/map/MapController.ts` adding `setBasemap(basemap: BasemapId, overlay: boolean): void` that builds the style via `buildStyle` and calls `map.setStyle`; add a `tilefail` event with payload `{ failedId: BasemapId; revertedTo: BasemapId }`; implement the `TileFailureSnapshot` per `data-model.md` §6 (5 s window, ≥ 3 errors OR a CORS error → revert) — verify T014 passes
- [X] T017 [P] [US1] Implement `src/components/LayerPicker.svelte` per `contracts/layer-picker.md` §2 — toolbar button + grouped `role="menu"` with NLSC / Google / Other group headers, basemap rows as `role="menuitemradio"` with `data-testid="layer-row-{id}"` `data-layer-group={group}`, overlay row as `role="menuitemcheckbox"` `data-testid="layer-overlay"`, Escape + backdrop close
- [X] T018 [US1] Refactor `src/components/MapView.svelte`: import `buildStyle` and the catalogue, build the initial style from `(basemap, overlay)` props, expose a reactive recomputation when those props change, subscribe to MapLibre's `error` event and forward to `MapController.recordTileError(sourceId)`; remove the hardcoded `osmTileSource` import path while keeping the file's testid (`map-root`) for selector compatibility
- [X] T019 [US1] Amend `src/components/AttributionBar.svelte`: accept the active basemap + overlay as props, look up `attributionKey` for each via the catalogue, render `{basemap.attribution} | {overlay.attribution}` when overlay is on; reuses the `--color-fg` opacity token from feature 001
- [X] T020 [US1] Wire the layer-picker pipeline into `src/app/App.svelte`: read initial `LayerSelection` from `loadPreferences()` (with `'osm-standard' / false` defaults), render the new `圖層` toolbar button, mount `<LayerPicker>` open-on-demand, on `change` call `controller.setBasemap()` and persist via `savePreferences`, on `tilefail` event surface a 5 s localised toast (`map.failure.<group>`) and revert state — verify T015 passes for US1
- [X] T021 [US1] Write `tests/e2e/story-3c-layers-and-locale.spec.ts` US1 describe block covering acceptance scenarios US1.AS1–AS5 + the failure-toast edge case (block NLSC origin → expect toast within 5 s + previous basemap visible). MUST include an explicit timing assertion for SC-001: `const t0 = Date.now(); pickBasemap(...); await expect(<first new tile>).toBeVisible(); expect(Date.now() - t0).toBeLessThan(1500);` for at least one basemap-to-basemap swap.

**Checkpoint**: User Story 1 is shippable as the MVP — operators can switch among six basemaps, toggle the Google road overlay, and the choice survives reload + tile failure.

---

## Phase 4: User Story 2 — Switch the interface language (Priority: P2)

**Goal**: A toolbar `語言 / Language / 言語` button opens a self-name list (`中文`, `English`, `日本語`); selecting one updates every visible UI string within 200 ms and persists the choice. Google tile labels are NOT affected (they remain `hl=zh-TW`).

**Independent Test**: Open `語言` picker — three rows visible. Pick `English` — UI flips to English; Google `Google 衛星混合` label still shows Traditional Chinese place names. Pick `日本語` — UI flips to Japanese. Reload — Japanese persists.

### Tests for User Story 2 (TDD — write first, verify failing)

- [X] T022 [US2] Extend `tests/integration/layers-and-locale.spec.ts` with US2 describe block: `LocalePicker` renders three rows in `[zh, en, ja]` order with literal self-names (`中文`, `English`, `日本語`); active locale has `aria-checked="true"`; picking `en` dispatches `change` with `'en'`; Escape dispatches `close`. MUST include a regression test that locks FR-013: snapshot every Google entry's `urlTemplate` in `MAP_SOURCES` before `setLocale('en')` / `setLocale('ja')`, then re-snapshot after, and assert deep equality (the catalogue is structurally immutable, but this test prevents a future caller from accidentally mutating templates per locale).

### Implementation for User Story 2

- [X] T023 [US2] Implement `src/components/LocalePicker.svelte` per `contracts/locale-picker.md` §2 — toolbar button + `role="menu"` with three `role="menuitemradio"` rows, each labelled by `data-testid="locale-row-{locale}"` and rendered as a literal self-name with `lang="{locale}"`, Escape + backdrop close
- [X] T024 [US2] Wire the locale-picker pipeline into `src/app/App.svelte`: render the new `語言` toolbar button, mount `<LocalePicker>`, on `change` call `setLocale()` from `$i18n/index` and persist `prefs.locale` via `savePreferences` — verify T022 passes
- [X] T025 [US2] Extend `tests/e2e/story-3c-layers-and-locale.spec.ts` with US2 describe block covering acceptance scenarios US2.AS1–AS4 (language flips, Google `hl` unchanged, reload persists). MUST include an explicit timing assertion for SC-005: `const t0 = Date.now(); page.getByTestId('locale-row-en').click(); await expect(page.getByTestId('open-locale')).toContainText('Language'); expect(Date.now() - t0).toBeLessThan(200);` Also assert no flicker: subscribe to `MutationObserver` (or use `page.evaluate(() => performance.getEntriesByType('paint'))`) and assert the previous-locale strings do not appear in any intermediate frame between click and final paint.

**Checkpoint**: Locale picker is fully functional. The MVP from Phase 3 + the picker from this phase deliver Stories 1 + 2 independently.

---

## Phase 5: User Story 3 — Cache previously-loaded tiles for offline use (Priority: P3)

**Goal**: Extend the existing service-worker `runtimeCaching` (currently a single `StaleWhileRevalidate` rule for OSM) to NLSC and Google tile origins so previously-fetched tiles render offline.

**Independent Test**: Pan area A on `NLSC 電子地圖` while online → go offline → pan within area A — cached tiles render. Switch to `Google 純衛星`, pan area B while offline — uncached tiles show the missing-tile placeholder; previously-cached tiles render.

### Tests for User Story 3 (TDD — write first, verify failing)

- [X] T026 [US3] Extend `tests/e2e/story-3c-layers-and-locale.spec.ts` with US3 describe block: load NLSC tiles online, `context.setOffline(true)`, pan within the cached area and assert tiles render; switch to Google satellite while offline and assert uncached areas show the missing-tile placeholder (no console errors, no spinner forever). The test MUST be observed failing on the current (`vite.config.ts`-only-OSM) baseline before T027 lands.

### Implementation for User Story 3

- [X] T027 [US3] Amend `vite.config.ts` to extend `VitePWA({ workbox: { runtimeCaching } })` with two new `StaleWhileRevalidate` rules per `contracts/service-worker-cache.md` §2: NLSC (`/^https:\/\/wmts\.nlsc\.gov\.tw\/.*/i`, `cacheName: 'nlsc-tiles'`) and Google (`/^https:\/\/mt\d?\.google\.com\/.*/i`, `cacheName: 'google-tiles'`); same expiration policy as the OSM rule — verify T026 passes

**Checkpoint**: All three user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation finalisation, and the constitutional review loop (Principles I, IV, V).

- [X] T028 [P] Run `npm run format` on the worktree (Constitution Principle I + Development Workflow formatting gate)
- [X] T029 Run `npm run lint` and fix any warnings (`--max-warnings 0`)
- [X] T030 Run `npm run typecheck` and resolve any errors
- [X] T031 Run `npm run test` (all Vitest unit + integration) — all green
- [X] T032 Run `npm run test:e2e` — all green including the new `story-3c-layers-and-locale.spec.ts`
- [X] T033 [P] Run `npm run bundle-size` — confirm JS gzipped delta vs feature 002's 77.61 KB is ≤ 5 KB (SC-007 + Constitution Principle IV); profile and trim if breached
- [X] T034 [P] Finalize `docs/ui/0003-layers-and-locale.md` with screenshots, the layer-picker grouped dropdown spec, locale picker spec, attribution-bar update behaviour, failure-toast timing diagram
- [X] T035 [P] Finalize `docs/adr/0020-map-source-catalogue.md` with the realised catalogue + https-upgrade decision, `0021-prefs-additive-evolution.md` with the additive-vs-version-bump rationale, `0022-tile-failure-toast.md` with the 5 s / 3-errors detection rule + auto-revert outcome
- [X] T036 Update `docs/adr/README.md` to mark 0020 / 0021 / 0022 Accepted (Constitution Principle V — index updated after `/speckit.implement`)
- [X] T037 Walk through `specs/003-i18n-and-map-layers/quickstart.md` US1 / US2 / US3 + edge-case smoke tests on a clean `npm run dev` and record any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No external dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — independently testable thereafter
- **Phase 4 (US2)**: Depends on Phase 2 — independently testable; integrates with the existing toolbar but does NOT depend on US1's layer picker (the locale picker is the only new surface)
- **Phase 5 (US3)**: Depends on Phase 2 — independently testable; the SW runtime-cache rules work for any origin in the catalogue regardless of whether the picker UI is wired
- **Phase 6 (Polish)**: Depends on whichever user stories are scheduled into the release cut

### Within Each User Story

- Tests written first; implementation MUST NOT begin until the matching test is observed failing
- Pure modules (`sources.ts`, `styleBuilder.ts`) before their UI consumers
- `LayerPicker.svelte` (T017) is independent of `MapView.svelte` (T018) and `AttributionBar.svelte` (T019), so the three can be parallelised within US1
- The `App.svelte` wiring (T020 / T024) sequences AFTER the picker components within each story
- The `tilefail` event flow (T016) must land before T020 because T020's `App.svelte` listens to it

### Parallel Opportunities

- All Phase 1 tasks are `[P]` (different files: docs/ui, docs/adr, README updates)
- Phase 2 i18n tasks (T005 / T006 / T007) are `[P]` across three locale files
- Phase 2 sources test (T008) and styleBuilder test (T010) and prefs test (T012) are `[P]` (different files), independent of each other; their impl tasks (T009 / T011 / T013) sequence after their tests
- Within US1 (Phase 3): T017 (LayerPicker), T018 (MapView refactor), T019 (AttributionBar) are `[P]` — independent files
- Phase 6 verification tasks (T028 / T033 / T034 / T035) are `[P]` once they have no upstream blockers

### Sequential Hot Spots

- `tests/integration/layers-and-locale.spec.ts` is a single file extended in T015, T022 — those two tasks edit the same file across stories, so they MUST run sequentially across phase boundaries
- `tests/e2e/story-3c-layers-and-locale.spec.ts` is similarly extended in T021, T025, T026 — sequential across phase boundaries
- `src/app/App.svelte` is touched by T020 (US1 wiring), T024 (US2 wiring) — sequential
- `tests/unit/storage/preferences.spec.ts` is extended in T012 only (Phase 2)
- `vite.config.ts` is touched by T027 only (Phase 5)

---

## Parallel Example: Foundational i18n + sources/styleBuilder/prefs tests

```bash
# Phase 2 i18n + tests can run in parallel:
Task: "Add new i18n keys to src/i18n/zh.json" (T005)
Task: "Mirror the same key set in src/i18n/en.json" (T006)
Task: "Mirror the same key set in src/i18n/ja.json" (T007)
Task: "Write failing test tests/unit/map/sources.spec.ts" (T008)
Task: "Write failing test tests/unit/map/styleBuilder.spec.ts" (T010)
Task: "Extend tests/unit/storage/preferences.spec.ts" (T012)

# Then their impl tasks sequence:
Task: "Implement src/map/sources.ts" (T009 — after T008)
Task: "Implement src/map/styleBuilder.ts" (T011 — after T010 and T009 if it imports MAP_SOURCES)
Task: "Amend src/storage/preferences.ts" (T013 — after T012)
```

```bash
# After Phase 2 (Foundational) lands, US1 implementation parallelises:
Task: "Implement src/components/LayerPicker.svelte" (T017)
Task: "Refactor src/components/MapView.svelte" (T018)
Task: "Amend src/components/AttributionBar.svelte" (T019)

# T020 (App.svelte wiring) blocks until all three above + T016 land.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup): T001–T003
2. Complete Phase 2 (Foundational): T004–T013 (CRITICAL — blocks all stories)
3. Complete Phase 3 (User Story 1): T014–T021
4. **STOP and validate**: Run the US1 walkthrough in `quickstart.md`. The toolbar offers a `圖層` button, all six basemaps render, the Google overlay stacks correctly, the failure path reverts gracefully, and the choice persists across reload.
5. Run minimal Polish (T028–T031, T033) to ensure formatter / linter / typecheck / tests / bundle-size are clean.
6. Deploy / demo as MVP.

### Incremental Delivery

- After MVP: add Phase 4 (US2 locale picker) for in-app language switching → demo
- Then add Phase 5 (US3 offline tile cache) for the offline-parity polish layer → demo
- Phase 6 polish runs at the end of each increment to keep CI green

### Parallel Team Strategy

Once Phase 2 completes, US1 / US2 / US3 can be staffed to three developers:

- Dev A → Phase 3 (US1, the largest phase by component count)
- Dev B → Phase 4 (US2, smallest phase — locale picker + dialog wiring)
- Dev C → Phase 5 (US3, just a `vite.config.ts` change + an E2E describe)

Coordination points: the three sequential hot spots
(`layers-and-locale.spec.ts`, `story-3c-layers-and-locale.spec.ts`,
`App.svelte`) must be merged in a serialised order; agree on a merge
cadence (e.g., US1 first, then US2, then US3) up front.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks
- `[Story]` label maps each task to its user story for traceability
- TDD ordering is enforced: every implementation task has a preceding test task in the same phase, and tests MUST be observed failing before implementation begins
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow)
- Update `docs/adr/README.md` after `/speckit.implement` (Principle V)
- Update `docs/ui/0003-layers-and-locale.md` for any visible UI change (Principle III)
- All user-facing strings resolve through `src/i18n/{zh,en,ja}.json` with `zh` as the canonical key set (Constitution v1.1.0 Locale conventions)
- Service-worker config (`vite.config.ts`) has no automated test — manual verification per `contracts/service-worker-cache.md` §4
