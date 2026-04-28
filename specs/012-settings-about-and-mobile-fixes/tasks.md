---
description: "Tasks for feature 012-settings-about-and-mobile-fixes"
---

# Tasks: Settings About Section, README Live Link, Go-To Mobile Fit, and Map 3D / Terrain Lockdown

**Input**: Design documents from `/specs/012-settings-about-and-mobile-fixes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by Constitution Principle II (TDD non-negotiable). Every behavioural change lands a RED test BEFORE its GREEN implementation. Bug fixes (US2 Go-To overflow) lead with a regression test that fails on the pre-fix code.

**Organization**: Tasks are grouped by user story (US1–US4) so each story can be implemented and tested independently. P1 (US1) is the MVP slice; the other stories add incremental value.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1..US4) — Setup / Polish phases have no story label

## Path Conventions

Single-project Svelte + Vite PWA. Source under `src/`, tests under `tests/`, docs under `docs/`. README at repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the dev environment is on the correct branch and the existing review loop is green before any new code lands.

- [X] T001 Verify dev environment: branch is `012-settings-about-and-mobile-fixes`, `npm install` complete, `npm run format && npm run lint && npm run typecheck && npm test` all green on the unmodified `master`-equivalent baseline. No code edits in this task — purely a sanity gate.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: This feature has no genuinely foundational work — each user story is self-contained against the existing infrastructure (i18n loader, MapLibre engine, SettingsSheet section pattern, test runners). Phase 2 is intentionally empty; user stories may begin immediately after Phase 1.

**Checkpoint**: Foundation ready — user story implementation can now begin in priority order or in parallel (if multiple contributors are available).

---

## Phase 3: User Story 1 — Map 3D / Terrain lockdown register (Priority: P1) 🎯 MVP

**Goal**: A single-source-of-truth registry at `src/map/threeDLockdown.ts` exporting an immutable `LOCKDOWN_REGISTER` with six capability classes (pitch, sky, globe, terrain, fillExtrusion, hillshade). `MapView.svelte`, `styleBuilder.ts`, and `sources.ts` consume it. Pitch === 0 / projection === mercator / no terrain / no sky / no fill-extrusion / no hillshade are enforced and survive every basemap swap.

**Independent Test**: `npm test -- tests/unit/three-d-lockdown.spec.ts tests/integration/three-d-lockdown-runtime.spec.ts` — registry shape + runtime invariants assert clean. Manual: open the deployed map, exercise every pitch / terrain / projection entry point per quickstart §1c–1d, confirm locked baseline.

### Tests for User Story 1 (RED — must fail before T004 / T005 / T006 / T007)

- [X] T002 [P] [US1] RED unit test for the lockdown registry shape — write `tests/unit/three-d-lockdown.spec.ts` asserting (a) `Object.isFrozen(LOCKDOWN_REGISTER)` and each entry frozen; (b) `Object.keys(LOCKDOWN_REGISTER).sort()` equals `['fillExtrusion','globe','hillshade','pitch','sky','terrain']`; (c) each entry's `lockedValue` matches the table in `contracts/three-d-lockdown-register.md` §2; (d) each entry's `reEnableHint` is non-empty and ≤ 140 chars; (e) module source contains no `process.env` / `import.meta.env` / `localStorage` / `URLSearchParams` / `window.location` substring (read via `fs.readFileSync`). Test MUST fail because the module does not yet exist.
- [X] T003 [P] [US1] RED integration test for runtime consumption — write `tests/integration/three-d-lockdown-runtime.spec.ts` covering: (a) `map.getMaxPitch()` === 0 and `map.getProjection().name` === `'mercator'` and `map.getTerrain()` === `null` after `MapView` mount; (b) `map.setPitch(45)` then `map.getPitch()` === 0; (c) `map.setTerrain({ source: 'fake', exaggeration: 1 })` (try/catch) then `getTerrain()` === `null`; (d) `buildStyle` post-processing strips top-level `sky` and any layer with `type` of `'fill-extrusion'` or `'hillshade'`; (e) all assertions hold after a basemap swap (toggle the `layer` prop) and after an overlay toggle. Use a `__test_applyLockdown` named export (test-only) for the synthetic-input case. Test MUST fail because the consumers do not yet read the registry.

### Implementation for User Story 1

- [X] T004 [US1] GREEN: create `src/map/threeDLockdown.ts` exporting `LockdownClass`, `LockdownEntry<T>`, `LockdownRegister`, and the `Object.freeze`d `LOCKDOWN_REGISTER` const per `contracts/three-d-lockdown-register.md` §1–§2. Each entry's `reEnableHint` is the concise instruction from `data-model.md` "How re-enable works" column (e.g., for `pitch`: `'Raise lockedValue to e.g. 60; MapView reads it as maxPitch via the construction options.'`). After this task T002 turns GREEN.
- [X] T005 [P] [US1] GREEN: wire `src/components/MapView.svelte` to import `LOCKDOWN_REGISTER` and pass `maxPitch: LOCKDOWN_REGISTER.pitch.lockedValue`, `touchPitch: false`, and `projection: LOCKDOWN_REGISTER.globe.lockedValue` in the `new maplibregl.Map({...})` construction options block. Add a one-line comment `// 3D / Terrain lockdown — see threeDLockdown.ts and ADR-0032.` (the ADR cross-reference; the ADR file lands in T028).
- [X] T006 [P] [US1] GREEN: wire `src/map/styleBuilder.ts` to import `LOCKDOWN_REGISTER` and add a private `applyLockdown(style)` helper invoked after style assembly. Helper deletes `style.sky` when `LOCKDOWN_REGISTER.sky.lockedValue === false` and `Array.prototype.filter`s `style.layers` against a `Set` of disallowed types built from `LOCKDOWN_REGISTER.fillExtrusion`/`hillshade` per `contracts/style-builder-filter.md` §2. Add a test-only named export `__test_applyLockdown` (matching the existing `__resetForTests` pattern) so T003 can drive synthetic-input cases.
- [X] T007 [P] [US1] GREEN: amend `src/map/sources.ts` with a top-of-file JSDoc note that imports the `LockdownClass` type (type-only `import type`) and forbids the registration of a terrain RGB DEM source while `LOCKDOWN_REGISTER.terrain.lockedValue === null`. Cite `threeDLockdown.ts` and ADR-0032 in the JSDoc. No runtime change.
- [X] T008 [US1] Verify US1 — run `npm test -- tests/unit/three-d-lockdown.spec.ts tests/integration/three-d-lockdown-runtime.spec.ts` and confirm all cases GREEN. Run `npm run format && npm run lint && npm run typecheck`.

**Checkpoint**: User Story 1 (the P1 MVP slice) is independently functional. The map's 2D invariant is locked across pitch / sky / globe / terrain / fill-extrusion / hillshade and survives style rebuilds. Spec FR-001..FR-009 satisfied; SC-001 + SC-010 demonstrable.

---

## Phase 4: User Story 2 — Go-To dialog narrow-viewport fit (Priority: P2)

**Goal**: Every Go-To input layout (Auto / DD / DMS / TM2 / TWD67 / MGRS / Taipower) fits inside the dialog content area at viewports 320 / 360 / 390 px with no horizontal overflow and ≥ 44 px tap targets at 320 px.

**Independent Test**: `npm test -- tests/integration/go-to-narrow-viewport.spec.ts && npm run test:e2e -- go-to-narrow-viewport.e2e.spec.ts` — 7 layouts × 3 widths = 21 jsdom cases plus the real-browser geometry sweep. Manual: open Go-To at viewport widths 320, 360, 390 and switch through every layout.

### Tests for User Story 2 (RED — must fail before T011..T016)

- [X] T009 [P] [US2] RED integration test — write `tests/integration/go-to-narrow-viewport.spec.ts` mounting each Go-To layout (`DdLayout`, `DmsLayout`, `Tm2Layout`, `Twd67Layout`, `MgrsLayout`, `TaipowerLayout`, `AutoLayout`) inside a `GoToDialog` test harness at simulated viewport widths 320, 360, 390 px. For each (layout, width) pair: assert no horizontal overflow on the dialog (`dialog.scrollWidth <= dialog.clientWidth`), assert each input's `getBoundingClientRect().height` ≥ 44 px and short-axis dimension ≥ 44 px at 320 px. Pre-fix: the multi-column layouts at 320 px MUST fail (overflow or tap-target shrinkage).
- [X] T010 [P] [US2] RED e2e test — write `tests/e2e/go-to-narrow-viewport.e2e.spec.ts` (Playwright). For each viewport 320 / 360 / 390, open the deployed dev build, click the Go-To toolbar button, switch through every format chip, screenshot + assert no horizontal scrollbar appears on the dialog, every input fully visible, tap target ≥ 44 px short axis. Pre-fix MUST fail at 320 px on at least DMS and DD.

### Implementation for User Story 2

- [X] T011 [P] [US2] GREEN: collapse DD layout at narrow viewport — append a `@media (max-width: calc(360px - 0.02px)) { .grid { grid-template-columns: 1fr; } }` block (or equivalent class targeting the existing grid selector) inside `src/components/goto/DdLayout.svelte`'s `<style>` block. Composes with the safe-area inline insets from feature 011.
- [X] T012 [P] [US2] GREEN: collapse DMS layout — same pattern in `src/components/goto/DmsLayout.svelte`. The 3-col + auto grid collapses to 1fr at narrow viewports.
- [X] T013 [P] [US2] GREEN: collapse TM2 layout — same pattern in `src/components/goto/Tm2Layout.svelte`.
- [X] T014 [P] [US2] GREEN: collapse TWD67 layout — same pattern in `src/components/goto/Twd67Layout.svelte`.
- [X] T015 [P] [US2] GREEN: collapse MGRS layout — same pattern in `src/components/goto/MgrsLayout.svelte`.
- [X] T016 [P] [US2] GREEN: collapse Taipower layout — same pattern in `src/components/goto/TaipowerLayout.svelte`.
- [X] T017 [US2] Verify-only pass on `src/components/goto/AutoLayout.svelte` — confirm the existing single-input layout already fits at 320 px with no overflow. If it does (research.md §R5 anticipates yes), no edit; if any width regression appears in T009, add an analogous `@media` block keeping the single-column shape.
- [X] T018 [US2] Verify US2 — run `npm test -- tests/integration/go-to-narrow-viewport.spec.ts` and `npm run test:e2e -- go-to-narrow-viewport.e2e.spec.ts`; confirm all 21 jsdom cases and the Playwright sweep GREEN. Run `npm run format && npm run lint && npm run typecheck`.

**Checkpoint**: User Story 2 functional independently. Go-To form usable on every commodity narrow phone. Spec FR-010..FR-014 satisfied; SC-002 + SC-003 demonstrable.

---

## Phase 5: User Story 3 — Settings About section (Priority: P3)

**Goal**: `SettingsSheet.svelte` exposes an About section with two `<a href target="_blank" rel="noopener noreferrer">` links — Live map (`https://swim-fish.github.io/pwa_map/`) and Source code (`https://github.com/swim-fish/pwa_map`) — translated in `zh` / `en` / `ja`, keyboard-accessible, contrast-clean.

**Independent Test**: `npm test -- tests/integration/settings-about-section.spec.ts tests/unit/i18n/settings-about-keys-parity.spec.ts tests/integration/settings-contrast.spec.ts` — section rendering / i18n parity / contrast regression net all GREEN. Manual: open Settings, see About area, click each link, switch locales, Tab keyboard, long-press touch.

### Tests for User Story 3 (RED — must fail before T021..T024)

- [X] T019 [P] [US3] RED i18n parity test — write `tests/unit/i18n/settings-about-keys-parity.spec.ts` asserting `settings.about.heading`, `settings.about.liveMap`, and `settings.about.sourceCode` exist (non-empty string) in `src/i18n/zh.json`, `src/i18n/en.json`, and `src/i18n/ja.json`. Also assert no value contains `zh-TW` / `zh-Hant` substrings (Constitution v1.1.0). Test MUST fail because the keys do not exist yet.
- [X] T020 [P] [US3] RED integration test — write `tests/integration/settings-about-section.spec.ts` that for each locale in `['zh','en','ja']`: mounts `SettingsSheet` with `open: true`, asserts the heading text matches the locale's `settings.about.heading` translation, asserts each link's text matches the locale's translation, asserts the live-map link's `href`/`target`/`rel` exactly match `https://swim-fish.github.io/pwa_map/` / `_blank` / `noopener noreferrer`, asserts the source-code link's attributes likewise. Add a focus / keyboard activation case that synth-fires a keydown Enter on each link and asserts `defaultPrevented === false`. Test MUST fail because the section does not yet exist.

### Implementation for User Story 3

- [X] T021 [P] [US3] GREEN: add the three keys to `src/i18n/zh.json` — `settings.about.heading`: `關於`, `settings.about.liveMap`: `地圖網址`, `settings.about.sourceCode`: `原始碼`. Maintain existing JSON ordering / formatting; insert the keys under the existing `settings` namespace.
- [X] T022 [P] [US3] GREEN: add the three keys to `src/i18n/en.json` — `settings.about.heading`: `About`, `settings.about.liveMap`: `Live map`, `settings.about.sourceCode`: `Source code`.
- [X] T023 [P] [US3] GREEN: add the three keys to `src/i18n/ja.json` — `settings.about.heading`: `アプリについて`, `settings.about.liveMap`: `マップ URL`, `settings.about.sourceCode`: `ソースコード`.
- [X] T024 [US3] GREEN: render the About section in `src/components/SettingsSheet.svelte` per `contracts/settings-about-section.md` §1 — a `<section class="about" aria-labelledby="settings-about-heading">` placed after the existing install section and before the cache rows, containing an `<h3 id="settings-about-heading">` and a `<ul>` of two `<li>`-wrapped `<a>` elements. URLs are inline string literals. Use only existing tokens (`var(--color-fg)`, `var(--color-fg-muted)`, focus-ring tokens) — no hard-coded colours. Add `data-testid` attributes per the contract. Translation lookups via the existing `tStore` pattern.
- [X] T025 [US3] Verify US3 — run `npm test -- tests/integration/settings-about-section.spec.ts tests/unit/i18n/settings-about-keys-parity.spec.ts tests/integration/settings-contrast.spec.ts tests/unit/i18n/controls-keys-parity.spec.ts`; confirm GREEN (the contrast spec MUST pass unchanged — no new hard-coded colours; the broader controls-keys-parity test continues to pass). Run `npm run format && npm run lint && npm run typecheck`.

**Checkpoint**: User Story 3 functional independently. Settings exposes the canonical URLs in all three locales. Spec FR-015..FR-019 satisfied; SC-004 demonstrable.

---

## Phase 6: User Story 4 — README live demo link (Priority: P4)

**Goal**: `README.md` contains a Markdown autolink to `https://swim-fish.github.io/pwa_map/` within the first ~30 lines.

**Independent Test**: `npm test -- tests/unit/readme-live-link.spec.ts` GREEN. Manual: view README on GitHub after push, click the autolink.

### Tests for User Story 4 (RED — must fail before T027)

- [X] T026 [P] [US4] RED unit test — write `tests/unit/readme-live-link.spec.ts` that loads `README.md` as text via `fs.readFileSync`, asserts the substring `<https://swim-fish.github.io/pwa_map/>` appears within the first 30 lines, asserts the URL exactly matches the deploy-base path used by `tests/integration/deploy-base-alignment.spec.ts` (re-use any helper if available; otherwise hard-code the literal). Test MUST fail because the README does not yet contain this autolink.

### Implementation for User Story 4

- [X] T027 [US4] GREEN: edit `README.md` — insert a single line `**Live demo**: <https://swim-fish.github.io/pwa_map/>` near the top of the file, before the Quickstart section heading, ensuring the autolink lands within the first ~30 lines (per FR-020 / research §R7). After this task, T026 turns GREEN.

**Checkpoint**: User Story 4 functional independently. Spec FR-020..FR-021 satisfied; SC-005 demonstrable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle V (ADR + UI record) compliance, full review-loop verification, manual quickstart walkthrough.

- [X] T028 [P] Write `docs/adr/0032-three-d-lockdown-register.md` covering Context (why a registry rather than scattered options), Decision (single immutable module imported by three call sites — no escape hatch), Consequences (bundle delta, re-enable cost, future MapLibre upgrade hazard), Alternatives considered (distributed config; ADR-only documentation; debug toggle). Cite features 005 / 011 / ADR-0020 / ADR-0031 where relevant. Status: Accepted.
- [X] T029 [P] Write `docs/ui/0012-settings-about-and-mobile-fixes.md` covering visible changes (About section, Go-To narrow-viewport collapse), affected screens (Settings, Go-To dialog), tokens added (none — token reuse only), accessibility notes (≥ 44 px tap targets, keyboard reachability, focus ring, long-press semantics on real anchors), locale changes (3 new `settings.about.*` keys × 3 locales).
- [X] T030 Update `docs/adr/README.md` index — append a row for ADR-0032 with title `Three-D / Terrain lockdown register (single source of truth)` and Status `Accepted`. Maintain the existing table column order.
- [X] T031 Run the project review loop end-to-end: `npm run format && npm run lint && npm run typecheck && npm test && npm run build && npm run bundle-size`. All must pass. Investigate and fix any regression before proceeding.
- [X] T032 Run the e2e suite: `npm run test:e2e`. The new `go-to-narrow-viewport.e2e.spec.ts` plus existing mobile / install / story specs must all pass without flake.
- [X] T033 Run the deploy-readiness pipeline: `npm run deploy:check`. Verifies the deploy-base alignment between `vite.config.ts` and the README live link.
- [X] T034 Manual quickstart walkthrough — execute `specs/012-settings-about-and-mobile-fixes/quickstart.md` §§ 1–7 and confirm every checklist item. Capture any divergence as a follow-up issue (do not silently fix).
- [X] T035 Confirm bundle delta against the baseline — record gzipped entry-chunk and CSS deltas in `specs/012-settings-about-and-mobile-fixes/plan.md`'s Performance Goals block. Plan target +1 KiB JS / +0.5 KiB CSS; project ceiling +6 KiB. If exceeded, document in `Complexity Tracking` BEFORE merging.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: No external dependencies. Run first.
- **Foundational (Phase 2)**: Empty for this feature. Skip.
- **User stories (Phases 3–6)**: Each depends only on Phase 1's sanity gate. Stories are independent of each other and may proceed in parallel by different contributors. Sequential MVP-first execution proceeds in priority order P1 → P2 → P3 → P4.
- **Polish (Phase 7)**: Depends on all four user stories being complete (or on the subset of stories shipping in a given delivery slice).

### User Story Dependencies

- **US1** (T002–T008): Self-contained. No dependency on US2 / US3 / US4.
- **US2** (T009–T018): Self-contained. No dependency on US1 / US3 / US4.
- **US3** (T019–T025): Self-contained. No dependency on US1 / US2 / US4.
- **US4** (T026–T027): Self-contained. No dependency on the in-app stories.

### Within Each User Story

- RED tests land BEFORE GREEN implementation (Constitution Principle II).
- US1: T002 / T003 (RED, parallel) → T004 (registry exists; T002 turns GREEN) → T005 / T006 / T007 (parallel; T003 turns GREEN incrementally) → T008 (verify all GREEN).
- US2: T009 / T010 (RED, parallel) → T011..T016 (six parallel CSS edits) + T017 (verify-only AutoLayout) → T018 (verify all GREEN).
- US3: T019 / T020 (RED, parallel) → T021..T023 (three parallel locale edits) → T024 (SettingsSheet edit; T020 turns GREEN) → T025 (verify all GREEN).
- US4: T026 (RED) → T027 (README edit; T026 turns GREEN).

### Polish phase

- T028, T029 are parallel (different files).
- T030 depends on T028 (the ADR file must exist before its index row is appended).
- T031..T035 run sequentially as a final gate.

### Parallel Opportunities

- All `[P]` tasks across the same phase can run in parallel.
- Within US2, the six layout edits (T011..T016) can be authored concurrently — they touch six independent Svelte files.
- Within US3, the three locale catalogue edits (T021..T023) are concurrent.
- US1 / US2 / US3 / US4 themselves are independent and may be worked by parallel contributors after Phase 1.

---

## Parallel Example: User Story 1

```bash
# Step 1 — RED tests in parallel:
Task: "Write tests/unit/three-d-lockdown.spec.ts (T002)"
Task: "Write tests/integration/three-d-lockdown-runtime.spec.ts (T003)"

# Step 2 — sequential gate:
Task: "Create src/map/threeDLockdown.ts (T004)"

# Step 3 — three consumers in parallel:
Task: "Wire src/components/MapView.svelte (T005)"
Task: "Wire src/map/styleBuilder.ts (T006)"
Task: "Amend src/map/sources.ts JSDoc (T007)"

# Step 4 — verification gate:
Task: "Verify US1 GREEN (T008)"
```

## Parallel Example: User Story 2

```bash
# Step 1 — RED tests in parallel:
Task: "Write tests/integration/go-to-narrow-viewport.spec.ts (T009)"
Task: "Write tests/e2e/go-to-narrow-viewport.e2e.spec.ts (T010)"

# Step 2 — six layout edits in parallel:
Task: "Collapse DdLayout (T011)"
Task: "Collapse DmsLayout (T012)"
Task: "Collapse Tm2Layout (T013)"
Task: "Collapse Twd67Layout (T014)"
Task: "Collapse MgrsLayout (T015)"
Task: "Collapse TaipowerLayout (T016)"

# Step 3 — verification:
Task: "Verify AutoLayout (T017)"
Task: "Verify US2 GREEN (T018)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (T001).
2. Skip Phase 2 (empty for this feature).
3. Complete Phase 3: User Story 1 (T002–T008).
4. **STOP and VALIDATE**: run quickstart §1; confirm pitch / projection / terrain locked baseline.
5. Optionally ship as a P1-only delivery, then continue.

### Incremental Delivery (recommended for solo contributor)

1. Setup (T001) → Phase 2 skipped.
2. US1 (T002–T008) → ship MVP.
3. US2 (T009–T018) → ship narrow-viewport fix.
4. US3 (T019–T025) → ship About section.
5. US4 (T026–T027) → ship README update.
6. Polish (T028–T035) → write docs, verify gates, walk through quickstart, confirm bundle budget, open PR.

### Parallel team strategy (if multiple contributors)

After Phase 1 (T001):

- Contributor A: US1 (T002–T008) — touches `src/map/`, `src/components/MapView.svelte`, two test files.
- Contributor B: US2 (T009–T018) — touches `src/components/goto/*.svelte`, two test files.
- Contributor C: US3 + US4 (T019–T027) — touches `src/components/SettingsSheet.svelte`, `src/i18n/*.json`, `README.md`, three test files.

Stories merge independently. Polish phase (T028–T035) runs after the last story merges.

---

## Notes

- Every `[P]` task touches a different file from every other `[P]` task in the same step.
- Every implementation task names its source-file path explicitly.
- TDD: every behavioural change has its RED test in the same phase, BEFORE the GREEN implementation — Constitution Principle II.
- `npm run format` runs after every code edit (Constitution Principle I + Development Workflow); it is implicit in T008 / T018 / T025 / T031 verification gates but should also run after any single-task-scope edit per CLAUDE.md guidance.
- `docs/ui/0012-*.md` (T029) covers Principle III; ADR 0032 (T028) + index update (T030) cover Principle V.
- Bundle budget: track gzipped delta after every commit (per `.claude/rules/quality-gates.md`), not just at T035 — discovery at PR-open time is too late.
- The `i18n` `zh` value is Traditional Chinese (台灣正體中文) per Constitution v1.1.0; never `zh-TW` / `zh-Hant`.
