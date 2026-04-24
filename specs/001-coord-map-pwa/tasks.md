---
description: 'Task list for feature 001-coord-map-pwa'
---

# Tasks: Taiwan Coordinate Map (PWA)

**Input**: Design documents from `/specs/001-coord-map-pwa/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: TDD is **mandatory** per Constitution Principle II (Test-First Development — NON-NEGOTIABLE). Every implementation task is preceded by tests that MUST be written first and seen to fail before the implementation starts.

**Organization**: Tasks are grouped by user story to enable independent implementation and delivery. User Story 1 alone is a shippable MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every description includes the exact file path to touch

## Path Conventions

Single-project layout (per `plan.md` Structure Decision). `src/`, `tests/`, `docs/`, `public/` all live at the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the Vite + Svelte + TypeScript PWA project and wire the review-loop toolchain required by Constitution Principles I, II, and IV.

- [x] T001 Scaffold Vite + Svelte + TypeScript project in-place: manual scaffold (avoids interactive `npm create vite` prompt) — `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `svelte.config.js`, `index.html` created; pre-existing `.specify/`, `.claude/`, `CLAUDE.md`, `specs/`, `.git/`, `MEMORY.md` preserved.
- [x] T002 [P] Install runtime dependencies: `maplibre-gl`, `proj4`, `mgrs` added to `dependencies` in `package.json` (installed via single `npm install`).
- [x] T003 [P] Install dev dependencies: full devDependencies block (`vite-plugin-pwa`, `workbox-window`, `vitest`, `@vitest/ui`, `jsdom`, `@playwright/test`, `prettier`, `prettier-plugin-svelte`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `globals`, `@types/proj4`, `@types/node`, `svelte`, `svelte-check`, `@sveltejs/vite-plugin-svelte`, `@tsconfig/svelte`, `tslib`, `typescript`, `vite`) installed via the same `npm install` run.
- [ ] T004 [P] Install Playwright browsers: `npx playwright install --with-deps` — deferred (runs after `npm install` completes; Windows ignores `--with-deps`).
- [x] T005 [P] Configure Prettier at `/.prettierrc` with `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }` + `prettier-plugin-svelte`; `.prettierignore` also written.
- [x] T006 [P] Configure ESLint at `/eslint.config.js` (flat config) with `typescript-eslint` recommended + `eslint-plugin-svelte` rules; rejects `any` and unused imports as errors; `no-console` allow-list = `warn`, `error`, `info`.
- [x] T007 [P] Configure `.editorconfig` at repo root enforcing LF line endings, UTF-8, 2-space indent, trim trailing whitespace.
- [x] T008 Update `vite.config.ts` to register `@sveltejs/vite-plugin-svelte`, `vite-plugin-pwa` (autoUpdate, OSM tile `StaleWhileRevalidate` cache), and the Vitest `test` block (environment `jsdom`, globals on) — applied at T001 scaffold time.
- [x] T009 Configure Playwright at `/playwright.config.ts` targeting `http://localhost:4173` (preview server), Chromium + Firefox + WebKit, retries=2 on CI.
- [x] T010 Add npm scripts to `/package.json`: `dev`, `build`, `preview`, `typecheck` (svelte-check), `lint` (eslint --max-warnings 0), `format` (prettier --write .), `format:check`, `test` (vitest run), `test:watch`, `test:e2e` (playwright test), `bench` (vitest bench --run), `bundle-size` (node scripts/check-bundle-size.js).
- [x] T011 Create `/scripts/check-bundle-size.js` that reads `dist/assets/*.js|*.css`, computes gzipped size, and exits non-zero when JS > 200 KB or CSS > 20 KB.
- [x] T012 Create empty source tree: `src/app/`, `src/components/`, `src/coord/`, `src/map/`, `src/i18n/`, `src/storage/`, `src/pwa/`, `src/types/`, `tests/unit/coord/`, `tests/unit/helpers/`, `tests/unit/fixtures/`, `tests/integration/`, `tests/e2e/`, `docs/adr/`, `docs/ui/`, `public/icons/` — each with a `.gitkeep` where empty.
- [x] T013 No demo files to remove (manual scaffold skipped the Counter.svelte / svelte.svg / default app.css assets entirely); `src/App.svelte` and `src/app/main.ts` are empty shells awaiting US1 fill.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure that every user story depends on — types, test harness, i18n store, storage guard, map controller skeleton, docs index stubs. No user story can start until this phase is complete.

**⚠️ CRITICAL**: Phase 3+ tasks MUST NOT begin until Phase 2 is fully green.

- [x] T014 Created branded domain types at `src/types/coord.ts`: `Lat`, `Lon`, `Easting`, `Northing`, `Zone`, `Hemisphere`, `Locale`, the six discriminated `CoordinateValue` kinds plus `CoordinateKind` and `ALL_COORDINATE_KINDS`.
- [x] T015 [P] Created Result / Rejection types at `src/types/result.ts` with `ok` / `err` / `reject` / `preferRejection` helpers.
- [x] T016 [P] Copied `test-vectors.json` to `tests/unit/fixtures/`; SHA-256 `6358a31d0772d00dbf96945f427c4dee3cdd2e01dd9615b9e2b8321f5e50721c` recorded to `vectors-digest.txt`; drift-detector spec `tests/unit/fixtures/vectors-digest.spec.ts` verified green.
- [x] T017 [P] Implemented tolerance-aware matcher at `tests/unit/helpers/vector-matchers.ts` (units: `m`, `deg`, `arcsec`, `cell`); NFC-normalised `expectStringEqualNFC` also exported.
- [x] T018 [P] Created i18n store at `src/i18n/index.ts`: Svelte writable `locale`, `t(key, vars?)` getter with fallback chain `ja → en → zh`, `setLocale`, `isLocale`, `tStore` derived.
- [x] T019 [P] Created empty locale files at `src/i18n/{zh,en,ja}.json` (each `{}`); US-specific keys appended per-phase; `zh.json` is the canonical key set.
- [x] T020 [P] Created `src/storage/preferences.ts` — localStorage I/O for `pwa_map:prefs` (FormatPreferences v1) and `pwa_map:lastView` (MapViewState); schema-guard validation with discard-on-corrupt; locale seeded from `navigator.language` on first run.
- [x] T021 [P] Created `src/map/MapController.ts` lifecycle skeleton (`onMove`, `onMoveEnd`, `emitMove`, `emitMoveEnd`, `attachUnderlying`, `dispose`); tile-source binding deferred to US1 T031.
- [x] T022 [P] Created `src/pwa/registerSW.ts` — Workbox-backed stub that no-ops in dev and safely handles the missing `virtual:pwa-register` module in test/SSR paths.
- [x] T023 [P] Created `docs/adr/README.md` — ADR index stub with Principle V rationale; table filled during Phase 7 (T089–T103).
- [x] T024 [P] Created `docs/ui/README.md` — UI docs index stub referencing the per-change write-up requirement (Principle III).

**Checkpoint**: All Phase 2 tasks green → user-story work can begin.

---

## Phase 3: User Story 1 — Live coordinate readout under a fixed center crosshair (Priority: P1) 🎯 MVP

**Goal**: Ship a Taiwan-covering map with a viewport-centered crosshair reticle and a live WGS84 DD readout that updates as the user pans. No multi-format display, no Go To — just "where is this point?".

**Independent Test**: Launch `npm run dev`, confirm the crosshair sits exactly at screen center, pan to Taipei 101, verify the readout shows `25.033611, 121.564472` within ±0.000002°, pan to mid-Pacific and confirm WGS84 DD still renders (global coverage).

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [x] T025 [P] [US1] Wrote `tests/unit/coord/wgs84.spec.ts` (makeWGS84DD validation, formatWGS84DD, DD round-trip via ddToDms+dmsToDd); 18 tests passing.
- [x] T026 [P] [US1] Wrote `tests/e2e/story-1-crosshair-readout.spec.ts` — AS1/AS2/AS3 all green on chromium.

### Implementation for User Story 1

- [x] T027 [US1] Implemented `src/coord/wgs84.ts` with `makeLat`, `makeLon`, `makeWGS84DD`, `formatWGS84DD`, `ddToDms`, `dmsToDd` (US2 T048 later appended `formatWGS84DMS`, `wgs84DdToDms`).
- [x] T028 [US1] Created `src/coord/index.ts` with `initCoord` + WGS84 DD/DMS re-exports.
- [x] T029 [US1] `initCoord()` is idempotent; US2 extended it to call `registerTwd97Projections()`.
- [x] T030 [US1] Configured OSM Standard tile source at `src/map/tileSource.ts` with three-subdomain URL list, 256 tile size, min/max zoom 0–19, attribution, plus `buildOsmStyle()` helper.
- [x] T031 [P] [US1] Implemented `src/components/MapView.svelte` — MapLibre GL JS wrapper, OSM style, `move` coalesced via rAF, `moveend` wired to controller.
- [x] T032 [P] [US1] Implemented `src/components/Crosshair.svelte` — 48 px SVG reticle, dark stroke + light halo, role="img", aria-label from parent prop.
- [x] T033 [P] [US1] Implemented `src/components/AttributionBar.svelte` — bottom-right fixed `<small>`.
- [x] T034 [US1] Implemented `src/components/CoordinateReadout.svelte` — MVP single-row; US2 T056 later upgraded to multi-row with coverage handling.
- [x] T035 [US1] Authored `src/app/tokens.css` with light/dark palettes, 4 px spacing scale, system UI + CJK-fallback typography, crosshair + readout tokens.
- [x] T036 [US1] Assembled `src/app/App.svelte` — layout wires MapView + Crosshair + CoordinateReadout + AttributionBar, restores last view, defaults to Taipei 101 zoom 13; US2 T058 later added FormatToggle and the toolbar.
- [x] T037 [US1] Implemented `src/app/main.ts` — imports tokens, calls `initCoord()`, mounts `App`, calls `registerSW()`.
- [x] T038 [US1] Seeded US1 locale keys in all three JSONs (`readout.dd.lat`, `readout.dd.lon`, `attribution.osm`, `a11y.crosshair.label`); translations authored independently.
- [x] T039 [US1] Created `docs/ui/0001-coord-map-layout.md`; US2 later appended the multi-row readout + FormatToggle section (see T060).
- [x] T040 [US1] Review loop green — format / lint / svelte-check (0 errors, 0 warnings) / vitest (19 tests) / playwright story-1 (3 tests on chromium). Bundle split via `manualChunks.maplibre`; entry JS 7.20 KB, CSS 9.85 KB, async maplibre chunk 203 KB. Commit deferred to user request.

**Checkpoint**: US1 done → MVP shippable. Pan the map, the crosshair stays centered, the WGS84 DD readout tracks it.

---

## Phase 4: User Story 2 — Multi-format coordinate display and simultaneous conversion (Priority: P2)

**Goal**: Render the crosshair position in all six supported formats simultaneously, with correct TM2 zone auto-selection at the 120° E boundary, correct TWD67 four-parameter shift, correct MGRS truncation, and correct Taipower encoding. Let the user hide/show formats with persistence.

**Independent Test**: Park crosshair at Taipei 101; verify every format matches `test-vectors.json` within tolerance. Pan to Magong; verify TWD97 zone label reads 119. Hide Taipower in FormatToggle, reload the page, verify Taipower stays hidden.

### Tests for User Story 2 ⚠️ (write first, see them fail)

- [x] T041 [P] [US2] Extend `tests/unit/coord/wgs84.spec.ts` with the full `DD_TO_DMS` + `DMS_TO_DD` vector sweep, DMS formatter round-trip (Unicode and ASCII glyphs), and hemisphere-sign mismatch rejection per `contracts/go-to-grammar.md §2.2`.
- [x] T042 [P] [US2] Write `tests/unit/coord/twd97.spec.ts` — every `WGS84_TO_TM2` and `TM2_TO_WGS84` vector for both zones, plus inverse round-trip to 0.1 m per `contracts/coord-api.md §3.2`.
- [x] T043 [P] [US2] Write `tests/unit/coord/twd67.spec.ts` — every `TWD97_TO_TWD67` / `TWD67_TO_TWD97` vector, round-trip to 3.0 m, rejection of the deprecated two-constant offset path (assert the function name `twd97ToTwd67Simple` is NOT exported).
- [x] T044 [P] [US2] Write `tests/unit/coord/mgrs.spec.ts` — every `WGS84_TO_MGRS` / `MGRS_TO_WGS84` vector at precision 5, precision-1-through-4 parametrised test, truncation-not-rounding assertion per `research.md R4` / reference §7.
- [x] T045 [P] [US2] Write `tests/unit/coord/taipower.spec.ts` — anchor-table round-trip for each in-coverage region letter A–X, explicit `out-of-coverage` Rejection for Y/Z, 9-char and 11-char round-trip.
- [x] T046 [P] [US2] Write `tests/unit/coord/zone.spec.ts` — boundary rule table: `lon < 120 → 119`, `lon ≥ 120 → 121`, `lon == 120.0` → 121 per reference §9.
- [x] T047 [P] [US2] Write E2E spec at `tests/e2e/story-2-multi-format.spec.ts` implementing every US2 acceptance scenario from `spec.md` (Taipei 101 all six formats within tolerance, Magong zone label, boundary switch, FormatToggle persistence).

### Implementation for User Story 2

- [x] T048 [US2] Added DMS formatting helpers (`formatWGS84DMS`, `wgs84DdToDms`) to `src/coord/wgs84.ts` with Unicode glyph default. NOTE: the `parseDms` sub-parser ultimately landed in `src/coord/parser.ts` (see ADR 0010) — its regex accepts Unicode (°′″) and ASCII (d'") glyphs and rejects the U+00BA ordinal indicator. Turns T041 green.
- [x] T049 [US2] Implement `src/coord/zone.ts` — `pickZone(lon: number): Zone` applying the §9 rule. Turns T046 green.
- [x] T050 [P] [US2] Implement `src/coord/twd97.ts` — register EPSG:3826 and EPSG:3825 via `proj4.defs`, export `wgs84ToTwd97(dd, zone?)` and `twd97ToWgs84(tm2)`. Zone auto-pick uses `pickZone` from T049. Turns T042 green.
- [x] T051 [P] [US2] Implement `src/coord/twd67.ts` — four-parameter TWD97 ↔ TWD67 transform with the constants from reference §6 (Δx = 807.8, Δy = 248.6, a = 0.00001549, b = 0.000006521). Pipeline `wgs84ToTwd67` = WGS84 → TWD97 z121 → four-param. Turns T043 green.
- [x] T052 [P] [US2] Implement `src/coord/mgrs.ts` — `wgs84ToMgrs(dd, precision=5)` and `mgrsToWgs84(mgrs)` wrapping the `mgrs` npm package, asserting truncation semantics. Turns T044 green.
- [x] T053 [P] [US2] Implement `src/coord/taipower.ts` — anchor table (24 letters A–X × 3 columns × 8 rows per reference §8), `wgs84ToTaipower` pipeline WGS84 → TWD97 → TWD67 → encode, `taipowerToWgs84` inverse, Y/Z rejection via `Result<_, Rejection>`. Turns T045 green.
- [x] T054 [US2] Extend `initCoord()` in `src/coord/index.ts` to register the two EPSG strings from `twd97.ts`. Extend exports to cover every converter + formatter from `contracts/coord-api.md §3 / §4 / §5`.
- [x] T055 [US2] Implement `coverageOf(kind, dd)` in `src/coord/index.ts` — applies the bounding boxes from reference §4/§5/§6/§8 Coverage tables to decide `ok` vs `out-of-coverage` per `data-model.md §10.1`.
- [x] T056 [US2] Extend `src/components/CoordinateReadout.svelte` to render up to six rows — one per `CoordinateKind` in the user's `FormatPreferences.visible`. Each row calls its formatter, shows the zone label for TM2 rows, and substitutes the `coverage.notInTaiwan` i18n string when `coverage === 'out-of-coverage'`.
- [x] T057 [P] [US2] Implement `src/components/FormatToggle.svelte` — modal / drawer UI listing all six formats as checkboxes, wired to `preferences.ts` so changes persist to `localStorage['pwa_map:prefs']` and the readout re-renders instantly.
- [x] T058 [US2] Wire `FormatToggle` trigger into `App.svelte` header; add keyboard shortcut (`g` → Go-To placeholder handled in US3, `f` → FormatToggle).
- [x] T059 [US2] Extend all three locale JSONs with US2 keys: `format.labels.{dd,dms,twd97,twd67,mgrs,taipower}`, `format.zone`, `format.twd97.zone.label`, `coverage.notInTaiwan`, `toggle.title`, `toggle.hint`.
- [x] T060 [US2] Append US2 layout/interaction notes to `docs/ui/0001-coord-map-layout.md`: multi-row readout, FormatToggle placement, coverage-label styling, responsive collapse on mobile.
- [x] T061 [US2] Review loop green: `npm run format && npm run lint && npm run typecheck && npm test && npm run test:e2e`.

**Checkpoint**: US2 done. All six formats render; zone flips at the 120° E meridian; FormatToggle persists.

---

## Phase 5: User Story 3 — Go To a target coordinate (Priority: P2)

**Goal**: Accept any supported format in a Go To field, parse it deterministically, and pan the map so the crosshair lands on the target. Invalid input produces a categorised human-readable error; the map does not move on failure.

**Independent Test**: Paste `25.033611, 121.564472` → map flies to Taipei 101; paste `51R UH 55170 69437` → same destination; paste `25° 60′ 00.0″ N, 121° 00′ 00.0″ E` → error "out-of-range — minutes must be 0 to 59" and the map stays put; paste `Y1234 AB56` → "out-of-coverage — Penghu Taipower unsupported".

### Tests for User Story 3 ⚠️ (write first, see them fail)

- [x] T062 [P] [US3] Write `tests/unit/coord/parser.spec.ts` dispatcher tests: grammar ordering (US1/US2/MGRS/TM2 explicit/TM2 inferred/TWD67/Taipower), `out-of-coverage > out-of-range > unsupported-precision > malformed` preference, worked examples 4.1–4.4 from `contracts/go-to-grammar.md §4`.
- [x] T063 [P] [US3] Extend `tests/unit/coord/wgs84.spec.ts` with the DD and DMS Accepted/Rejected tables from `contracts/go-to-grammar.md §2.1 / §2.2`.
- [x] T064 [P] [US3] Extend `tests/unit/coord/mgrs.spec.ts` with the MGRS input-grammar Accepted/Rejected table from `§2.3`.
- [x] T065 [P] [US3] Extend `tests/unit/coord/twd97.spec.ts` with zone-explicit (§2.4) and zone-inferred (§2.5) Accepted/Rejected tables.
- [x] T066 [P] [US3] Extend `tests/unit/coord/twd67.spec.ts` with the TWD67 parser Accepted/Rejected table (§2.6).
- [x] T067 [P] [US3] Extend `tests/unit/coord/taipower.spec.ts` with the Taipower parser Accepted/Rejected table (§2.7).
- [x] T068 [P] [US3] Write E2E spec at `tests/e2e/story-3-go-to.spec.ts` implementing all US3 acceptance scenarios including zone-auto-resolution hint (AS5) and the "map does not move on reject" invariant.

### Implementation for User Story 3

- [x] T069 [P] [US3] Add `parseDd` and `parseDms` sub-parsers to `src/coord/wgs84.ts` per grammar §2.1 / §2.2.
- [x] T070 [P] [US3] Add `parseMgrs` to `src/coord/mgrs.ts` per grammar §2.3 (whitespace tolerated, case-insensitive, even-digit-tail required, I/O forbidden).
- [x] T071 [P] [US3] Add `parseTm2Explicit` and `parseTm2Inferred` to `src/coord/twd97.ts` per grammar §2.4 / §2.5. `parseTm2Inferred` applies the R11 back-project-and-check algorithm and sets `zoneAutoResolved`.
- [x] T072 [P] [US3] Add `parseTm2` (TWD67) to `src/coord/twd67.ts` per grammar §2.6 (requires `TWD67` / `twd67=true` qualifier).
- [x] T073 [P] [US3] Add `parseTaipower` to `src/coord/taipower.ts` per grammar §2.7 (Y/Z → out-of-coverage, I forbidden in 100 m letters).
- [x] T074 [US3] Implement the dispatcher at `src/coord/parser.ts`: `parseGoTo(raw: string): GoToRequest` that normalises NFC, tries sub-parsers in R10 order, and returns the best Rejection per the §3 preference rule. Depends on T069–T073.
- [x] T075 [US3] Export `parseGoTo` and the parser-level types from `src/coord/index.ts`.
- [x] T076 [US3] Extend `src/map/MapController.ts` with `flyTo(target: WGS84DD, options?)` wrapping `map.flyTo` at a sensible zoom (keep current zoom if ≥ 10, else 15).
- [x] T077 [US3] Implement `src/components/GoToDialog.svelte`: modal with input `<textarea>`, submit button, `aria-live="assertive"` error region. On success, calls `MapController.flyTo` and closes; on failure, shows the localised message for `Rejection.messageKey` and keeps the dialog open.
- [x] T078 [US3] Wire `GoToDialog` into `App.svelte` with a trigger button and `g` keyboard shortcut. Show a toast "interpreted as TWD97 zone 121" when `zoneAutoResolved` is set (satisfies FR-016).
- [x] T079 [US3] Extend all three locale JSONs with the complete `errors.*` key catalogue from `contracts/go-to-grammar.md §3` (21 keys × 3 locales = 63 entries). `zh.json` is authoritative; CJK terms translated independently (no zh→ja gloss — research R9).
- [x] T080 [US3] Append US3 interaction notes to `docs/ui/0001-coord-map-layout.md`: GoToDialog layout, error surface, zone-auto toast copy, keyboard shortcuts table.
- [x] T081 [US3] Review loop green. Commit.

**Checkpoint**: US3 done. Go To now accepts every format, rejects with meaningful categories, and auto-resolves zone ambiguity.

---

## Phase 6: User Story 4 — Copy current coordinate to clipboard (Priority: P3)

**Goal**: Let the user copy any visible readout row to the clipboard with one tap/click. Fall back to a selectable text field when clipboard permission is denied.

**Independent Test**: Park crosshair at Taipei 101; tap the copy button next to MGRS; paste into a text editor → exactly `51R UH 55170 69437`; paste the copied MGRS back into Go To → returns to Taipei 101 within 1 m.

### Tests for User Story 4 ⚠️

- [x] T082 [P] [US4] Write `tests/unit/components/copy.spec.ts` — tests a `copyReadout(display: string)` helper against a mocked `navigator.clipboard.writeText` (success + rejected permission).
- [x] T083 [P] [US4] Write E2E spec at `tests/e2e/story-4-copy.spec.ts` implementing both US4 acceptance scenarios (DMS Unicode-glyph copy, MGRS copy → Go-To round-trip).

### Implementation for User Story 4

- [x] T084 [US4] Implement `copyReadout(display: string): Promise<Result<void, Rejection>>` in `src/components/CoordinateReadout.svelte` (or split into `src/components/copy.ts` if the file grows). Adds a copy button to each readout row; on success fires a toast, on permission-denied opens the fallback modal.
- [x] T085 [US4] Implement `src/components/CopyFallback.svelte` — modal with a `<textarea readonly>` preselected for manual Ctrl+C / Cmd+C copying.
- [x] T086 [US4] Extend all three locale JSONs with `copy.button.aria`, `copy.toast.success`, `copy.fallback.title`, `copy.fallback.hint`.
- [x] T087 [US4] Append US4 UI notes to `docs/ui/0001-coord-map-layout.md`: copy affordance placement, toast, fallback modal.
- [x] T088 [US4] Review loop green. Commit.

**Checkpoint**: US4 done. All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Settle the cross-story debt — ADRs for every research decision, performance verification, accessibility sweep, README, final format / lint / test.

- [x] T089 [P] Author `docs/adr/0001-ui-framework-svelte.md` from research R1.
- [x] T090 [P] Author `docs/adr/0002-map-engine-maplibre.md` from research R2.
- [x] T091 [P] Author `docs/adr/0003-tile-source-osm-default.md` from research R3.
- [x] T092 [P] Author `docs/adr/0004-coord-libraries-proj4-mgrs-custom.md` from research R4.
- [x] T093 [P] Author `docs/adr/0005-build-tooling-vite.md` from research R5.
- [x] T094 [P] Author `docs/adr/0006-testing-vitest-playwright.md` from research R6.
- [x] T095 [P] Author `docs/adr/0007-prettier-eslint.md` from research R7.
- [x] T096 [P] Author `docs/adr/0008-storage-localstorage.md` from research R8.
- [x] T097 [P] Author `docs/adr/0009-i18n-three-locale-zh-en-ja.md` from research R9 (explicitly records that the Chinese locale tag is `zh`, per Constitution v1.1.0 Locale conventions).
- [x] T098 [P] Author `docs/adr/0010-go-to-parser-dispatch.md` from research R10.
- [x] T099 [P] Author `docs/adr/0011-tm2-zone-auto-resolve.md` from research R11.
- [x] T100 [P] Author `docs/adr/0012-taipower-main-island-only.md` from research R12.
- [x] T101 [P] Author `docs/adr/0013-performance-verification-pipeline.md` from research R13.
- [x] T102 [P] Author `docs/adr/0014-accessibility-baseline.md` from research R14.
- [x] T103 Update `docs/adr/README.md` — fill the ADR index table with the 14 entries from T089–T102.
- [x] T104 [P] Created Vitest benchmark suite at `bench/coord.bench.ts` — 15 benches (10 converters + 5 parser dispatch). Local: all converters ≥ 172k ops/sec (~0.006 ms); parser dispatch 96k–997k ops/sec. Well inside the ≤ 1 ms budget. Run via `npx vitest bench --run`.
- [x] T105 [P] Added Lighthouse CI workflow at `.github/workflows/lighthouse.yml` — PR-into-main + push-to-001-coord-map-pwa; builds + `npm run preview` + `lhci autorun` asserting PWA category ≥ 0.9, first-contentful-paint + interactive medians ≤ 3000 ms; includes bundle-size job. Activation needs `LHCI_GITHUB_APP_TOKEN` secret.
- [x] T106 [P] Created Playwright perf probe at `tests/e2e/perf-pan.spec.ts` — 5 s scripted pan asserts ≥ 10 unique readout values and median innerText round-trip ≤ 50 ms.
- [x] T107 Accessibility sweep: verify every interactive element reachable by keyboard in the `Tab` order (MapView → Go To trigger → FormatToggle trigger → per-row copy), contrast ratios pass WCAG AA on both light and dark tiles, crosshair aria-label reflects current readout. Fix any gaps in the touched components.
- [x] T108 Author `/README.md` at repo root: project summary, quickstart reference, link to `.specify/memory/constitution.md`, link to `specs/001-coord-map-pwa/`, contribution workflow, licence statement for bundled `test-vectors.json` (MIT, attribution intact per reference LICENSE).
- [x] T109 Run the full `specs/001-coord-map-pwa/quickstart.md §7` checklist end-to-end: format, lint, typecheck, unit, e2e, bench, bundle-size, UI/ADR docs updated. Record evidence (commit hashes, CI run URLs) in a new `docs/adr/0015-release-readiness-001-coord-map-pwa.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — no upstream dependency; starts immediately.
- **Phase 2 (Foundational)** — depends on Phase 1 complete; **blocks every user story**.
- **Phase 3 (US1 MVP)** — depends on Phase 2.
- **Phase 4 (US2)** — depends on Phase 2; independent of US1 code but integrates with the US1 UI shell (CoordinateReadout extension).
- **Phase 5 (US3)** — depends on Phase 2 (parser works on its own); can run concurrently with US2 at the coord-module level, but shares `src/coord/*.ts` files so same-file edits are serialised within each file.
- **Phase 6 (US4)** — depends on Phase 3 (copy button lives on the readout); independent of US2/US3 at the UI level.
- **Phase 7 (Polish)** — depends on Phase 3 for MVP release, on all desired US phases for full release.

### User Story Dependencies

- **US1 (P1)**: zero cross-story dependency — the MVP.
- **US2 (P2)**: appends to US1's readout; uses the same `CoordinateReadout.svelte` and adds a new `FormatToggle.svelte`. Can ship without US3 / US4.
- **US3 (P2)**: needs US2's converters for round-trip verification in E2E, but the parser module itself can be developed in parallel with US2 if the team splits. For a single developer, do US2 first so Go-To tests can exercise real converters.
- **US4 (P3)**: attaches to US1's readout rows; if only US1 is shipped, US4 still works.

### Within Each User Story

- Tests (Phase `n.tests`) MUST be written first and seen to fail (Red) before implementation (Green) — Constitution Principle II.
- Types / pure functions before UI components.
- UI components before App-level integration.
- Every story ends with a review-loop task that runs the full format / lint / test / e2e suite.

### Parallel Opportunities

- **Phase 1**: T002–T007 all `[P]`; T008–T011 are small and mostly sequential (edit `vite.config.ts` and `package.json` in one pass each).
- **Phase 2**: T015 through T024 are all `[P]` because they touch different files.
- **Phase 3 (US1)**: T025 and T026 `[P]` (different test files). T031, T032, T033 `[P]` (independent components). T036 serialises (imports all three).
- **Phase 4 (US2)**: T041 through T047 `[P]` (each test file is independent). T050, T051, T052, T053 `[P]` (independent coord modules). T054 and beyond serialise (touch shared files).
- **Phase 5 (US3)**: T062–T068 `[P]`. T069–T073 `[P]` (different coord files). T074 serialises. T077–T081 mostly serial.
- **Phase 6 (US4)**: T082 and T083 `[P]`. T084+ serial.
- **Phase 7 (Polish)**: T089–T106 all `[P]` (independent files). T107 onward serial.

---

## Parallel Examples

### Phase 2 — all foundational tasks launched together

```bash
# Multiple files, no cross-dependencies.
Task: T015 Create Result/Rejection types in src/types/result.ts
Task: T016 Copy test-vectors.json + write digest file
Task: T017 Implement vector-matchers.ts
Task: T018 Create i18n store in src/i18n/index.ts
Task: T019 Create empty locale JSONs (zh / en / ja)
Task: T020 Create preferences.ts with schema guard
Task: T021 Create MapController.ts lifecycle skeleton
Task: T022 Create registerSW.ts
Task: T023 Seed docs/adr/README.md
Task: T024 Seed docs/ui/README.md
```

### Phase 4 — US2 tests written in parallel

```bash
Task: T041 Extend wgs84.spec.ts with DMS
Task: T042 Write twd97.spec.ts (zones 119/121)
Task: T043 Write twd67.spec.ts (four-parameter)
Task: T044 Write mgrs.spec.ts (all precisions)
Task: T045 Write taipower.spec.ts (anchor table)
Task: T046 Write zone.spec.ts (boundary rule)
Task: T047 Write story-2 E2E spec
```

### Phase 4 — US2 implementation (same-file edits serialised, different files parallel)

```bash
# These four coord modules touch different files → parallel.
Task: T050 Implement twd97.ts (proj4 zones)
Task: T051 Implement twd67.ts (four-param)
Task: T052 Implement mgrs.ts (npm wrap)
Task: T053 Implement taipower.ts (anchor table)

# T054 (extends index.ts / initCoord) waits for all four.
```

---

## Implementation Strategy

### MVP First (ship after Phase 3)

1. Phase 1 Setup.
2. Phase 2 Foundational.
3. Phase 3 US1.
4. STOP, validate with the `story-1` E2E spec, capture screenshots into `docs/ui/0001-coord-map-layout.md`, tag release candidate.
5. Optionally deploy the MVP before returning for US2.

### Incremental Delivery

- MVP (US1) → ship.
- Increment 1 (US2) → multi-format readout → ship.
- Increment 2 (US3) → Go-To → ship.
- Increment 3 (US4) → copy affordance → ship.
- Polish (Phase 7) before the final 1.0 release.

### Parallel Team Strategy

With two engineers after Phase 2:

- Engineer A owns US2 (converters + readout extension).
- Engineer B owns US3 (parser + GoToDialog).
- US4 picks up whichever engineer finishes first.
- Shared-file conflicts (`src/coord/index.ts`, locale JSONs, `App.svelte`) resolved by merging daily against a trunk branch.

---

## Notes

- `[P]` = different file AND no dependency on an incomplete task in the same phase.
- Test tasks precede implementation tasks within every story — Red → Green → Refactor is a hard rule (Constitution Principle II, non-negotiable).
- After every implementation task, run at least `npm run format` and `npm run typecheck` before moving on (Constitution Principle I + Development Workflow "Formatting gate").
- Every UI-touching task MUST update `docs/ui/0001-coord-map-layout.md` before the story's review-loop task runs (Constitution Principle III).
- Every ADR task is a separate entry under `docs/adr/` following the project ADR template; the ADR index in `docs/adr/README.md` is updated by T103 after they all land (Constitution Principle V).
- Chinese locale tag is `zh` everywhere in code, JSON keys, and file names (Constitution v1.1.0 Locale conventions). `zh-TW`, `zh-Hant`, `zh-CN` are forbidden by the constitution and by this task list.
- Commit after each task or at every explicit Checkpoint; avoid amending commits once pushed.
- Avoid: vague tasks, same-file edits marked `[P]`, story dependencies that break independent shippability.
