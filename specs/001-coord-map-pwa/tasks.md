---

description: "Task list for feature 001-coord-map-pwa"
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

- [ ] T001 Scaffold Vite + Svelte + TypeScript project in-place: run `npm create vite@latest . -- --template svelte-ts`, accept the overwrite, and verify `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js` land at repo root (preserve `.specify/`, `.claude/`, `CLAUDE.md`, `specs/`, `.git/`).
- [ ] T002 [P] Install runtime dependencies: `npm install maplibre-gl proj4 mgrs`.
- [ ] T003 [P] Install dev dependencies: `npm install -D vite-plugin-pwa workbox-window vitest @vitest/ui jsdom @playwright/test prettier eslint typescript-eslint eslint-plugin-svelte @types/proj4 svelte-check`.
- [ ] T004 [P] Install Playwright browsers: `npx playwright install --with-deps`.
- [ ] T005 [P] Configure Prettier at `/.prettierrc` with `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }`.
- [ ] T006 [P] Configure ESLint at `/eslint.config.js` (flat config) with `typescript-eslint` recommended + `eslint-plugin-svelte` rules; reject `any` and unused imports as errors.
- [ ] T007 [P] Configure `.editorconfig` at repo root enforcing LF line endings, UTF-8, 2-space indent, trim trailing whitespace.
- [ ] T008 Update `vite.config.ts` to register `@sveltejs/vite-plugin-svelte`, `vite-plugin-pwa` (autoUpdate, OSM tile `StaleWhileRevalidate` cache), and the Vitest `test` block (environment `jsdom`, globals on).
- [ ] T009 Configure Playwright at `/playwright.config.ts` targeting `http://localhost:4173` (preview server), Chromium + Firefox + WebKit, retries=2 on CI.
- [ ] T010 Add npm scripts to `/package.json`: `dev`, `build`, `preview`, `typecheck` (svelte-check), `lint` (eslint --max-warnings 0), `format` (prettier --write .), `format:check`, `test` (vitest run), `test:watch`, `test:e2e` (playwright test), `bench` (vitest bench --run), `bundle-size` (node scripts/check-bundle-size.js).
- [ ] T011 Create `/scripts/check-bundle-size.js` that reads `dist/assets/*.js|*.css`, computes gzipped size, and exits non-zero when JS > 200 KB or CSS > 20 KB.
- [ ] T012 Create empty source tree: `src/app/`, `src/components/`, `src/coord/`, `src/map/`, `src/i18n/`, `src/storage/`, `src/pwa/`, `src/types/`, `tests/unit/coord/`, `tests/unit/helpers/`, `tests/unit/fixtures/`, `tests/integration/`, `tests/e2e/`, `docs/adr/`, `docs/ui/`, `public/icons/` — each with a `.gitkeep` where empty.
- [ ] T013 Remove the Vite scaffold's demo files (`src/lib/Counter.svelte`, `src/app.css` default content, `src/assets/svelte.svg`) and replace `src/App.svelte` / `src/main.ts` with empty shells that will be filled by US1 tasks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure that every user story depends on — types, test harness, i18n store, storage guard, map controller skeleton, docs index stubs. No user story can start until this phase is complete.

**⚠️ CRITICAL**: Phase 3+ tasks MUST NOT begin until Phase 2 is fully green.

- [ ] T014 Create branded domain types at `src/types/coord.ts`: `Lat`, `Lon`, `Easting`, `Northing`, `Zone = 119 | 121`, `Hemisphere`, `Locale = 'zh' | 'en' | 'ja'`, plus the six discriminated `CoordinateValue` kinds from `data-model.md §2`. Export the `CoordinateKind` helper union.
- [ ] T015 [P] Create Result / Rejection types at `src/types/result.ts`: `Result<T, E>`, `RejectionCategory`, `Rejection` per `data-model.md §4`.
- [ ] T016 [P] Copy the coordinate reference test vectors: `cp ../atak_flutter_map/docs/coord-reference/test-vectors.json tests/unit/fixtures/test-vectors.json` then record its SHA-256 to `tests/unit/fixtures/vectors-digest.txt`. Add a Vitest top-level check that re-computes the digest and fails on mismatch (drift detector per `contracts/test-vectors.md §1`).
- [ ] T017 [P] Implement the tolerance-aware matcher at `tests/unit/helpers/vector-matchers.ts`: `expectWithinTolerance(actual, expected, { value, unit: 'm'|'deg'|'arcsec'|'cell' }, axis?)` per `contracts/test-vectors.md §2`. Includes NFC-normalised string equality for MGRS.
- [ ] T018 [P] Create the i18n store at `src/i18n/index.ts`: Svelte writable holding the active `Locale`, `t(key, vars?)` getter with fallback chain `ja → en → zh`, and `setLocale()` that persists through `storage/preferences.ts`.
- [ ] T019 [P] Create empty locale files at `src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json` — each containing `{}`. Per-US tasks append keys; `zh.json` is the canonical key set per Constitution Locale conventions (v1.1.0).
- [ ] T020 [P] Create `src/storage/preferences.ts` — localStorage read/write for `pwa_map:prefs` and `pwa_map:lastView`, with schema-guard validation (version check, enum narrowing, discard-on-corrupt) per `data-model.md §7` + `§10.3`. Seeds `locale` from `navigator.language` on first run.
- [ ] T021 [P] Create `src/map/MapController.ts` — lifecycle-only MapLibre wrapper (construct / destroy, exposes `move`/`moveend` callbacks). No tile-source binding yet; that happens in US1.
- [ ] T022 [P] Create `src/pwa/registerSW.ts` — Workbox-backed service-worker registration stub (called from `main.ts`); safe to call in dev mode.
- [ ] T023 [P] Create `docs/adr/README.md` — ADR index stub with the Principle V rationale and a table that will be filled during polish.
- [ ] T024 [P] Create `docs/ui/README.md` — UI docs index stub referencing the per-change write-up requirement (Principle III).

**Checkpoint**: All Phase 2 tasks green → user-story work can begin.

---

## Phase 3: User Story 1 — Live coordinate readout under a fixed center crosshair (Priority: P1) 🎯 MVP

**Goal**: Ship a Taiwan-covering map with a viewport-centered crosshair reticle and a live WGS84 DD readout that updates as the user pans. No multi-format display, no Go To — just "where is this point?".

**Independent Test**: Launch `npm run dev`, confirm the crosshair sits exactly at screen center, pan to Taipei 101, verify the readout shows `25.033611, 121.564472` within ±0.000002°, pan to mid-Pacific and confirm WGS84 DD still renders (global coverage).

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [ ] T025 [P] [US1] Write unit tests at `tests/unit/coord/wgs84.spec.ts` covering DD parse (`makeWGS84DD`), DD formatter (`formatWGS84DD`), and DD round-trip — driven by every vector in `test-vectors.json` with `direction ∈ {DD_TO_DMS, DMS_TO_DD}` restricted to DD-only assertions. Expect red on first run.
- [ ] T026 [P] [US1] Write E2E spec at `tests/e2e/story-1-crosshair-readout.spec.ts` implementing every acceptance scenario from `spec.md` US1 (AS1 Taipei 101, AS2 mid-Pacific out-of-coverage for TW-specific formats — here asserted only on readout-still-renders, AS3 ≥10 Hz during pan). Expect red.

### Implementation for User Story 1

- [ ] T027 [US1] Implement `makeWGS84DD`, `ddToDms`, `dmsToDd` and DD input/output helpers in `src/coord/wgs84.ts`; match signatures from `contracts/coord-api.md §2` and `§3.1`. Turn T025's DD suite green (DMS tests stay red until US2).
- [ ] T028 [US1] Create coord module public entry `src/coord/index.ts`: re-export `initCoord()`, `makeWGS84DD`, `ddToDms`, `dmsToDd`, `formatWGS84DD` for now. US2 / US3 extend this file with further exports.
- [ ] T029 [US1] Implement `initCoord()` in `src/coord/index.ts` as an idempotent no-op for now (proj4 registrations are added in US2, T046).
- [ ] T030 [US1] Configure the OSM Standard tile source at `src/map/tileSource.ts`: exports `osmTileSource` with URL template, tile size, attribution string (`© OpenStreetMap contributors`), min/max zoom per `research.md R3`.
- [ ] T031 [P] [US1] Implement `src/components/MapView.svelte` — MapLibre GL JS wrapper that mounts the map, installs the OSM style, and emits Svelte events `on:move` and `on:moveend` carrying `{ center: WGS84DD, zoom }`. Debounces `moveend` by 16 ms.
- [ ] T032 [P] [US1] Implement `src/components/Crosshair.svelte` — absolutely-positioned SVG reticle pinned to `50% / 50%` of the map container, with a 1 px dark + 1 px light halo. Exposes `aria-label` reflecting the current readout (injected as a prop from parent).
- [ ] T033 [P] [US1] Implement `src/components/AttributionBar.svelte` — bottom-right fixed `<small>` element showing the active tile source's attribution string (prop `text: string`).
- [ ] T034 [US1] Implement `src/components/CoordinateReadout.svelte` (MVP version): single-row readout showing WGS84 DD only, subscribes to the Svelte store for the current crosshair `WGS84DD`, uses `formatWGS84DD` + i18n labels (`readout.dd.lat`, `readout.dd.lon`). Wrapped in `aria-live="polite"` that announces on `moveend` only.
- [ ] T035 [US1] Author design tokens at `src/app/tokens.css` — color palette (light + dark), spacing scale (4 px base), typography scale (system UI stack), crosshair & readout tokens. Tokens are consumed by every component, so they land here before App.svelte.
- [ ] T036 [US1] Assemble `src/app/App.svelte` (depends on T031, T032, T033, T034): full-viewport layout hosting `<MapView>` + `<Crosshair>` overlay + floating `<CoordinateReadout>` panel + `<AttributionBar>`. Wires `move` events → crosshair store → readout. Restores last view from `preferences.ts`, defaults to Taipei 101 at zoom 13.
- [ ] T037 [US1] Implement `src/app/main.ts`: call `initCoord()`, mount `App`, call `registerSW()`. Imports `./tokens.css` at the top.
- [ ] T038 [US1] Seed US1 locale keys in `src/i18n/zh.json`, `en.json`, `ja.json`: `readout.dd.lat`, `readout.dd.lon`, `attribution.osm`, `a11y.crosshair.label`. `zh.json` is authoritative; `en.json` and `ja.json` are translated against it (no machine gloss between zh and ja — research R9).
- [ ] T039 [US1] Create `docs/ui/0001-coord-map-layout.md`: initial design document covering layout, crosshair spec, readout panel, attribution bar, tokens, accessibility (crosshair aria-label, readout `aria-live="polite"` on moveend only). Screenshots captured after T036.
- [ ] T040 [US1] Run the review loop: `npm run format && npm run lint && npm run typecheck && npm test && npm run test:e2e`. All green, with T025's DD tests and T026 passing. Commit.

**Checkpoint**: US1 done → MVP shippable. Pan the map, the crosshair stays centered, the WGS84 DD readout tracks it.

---

## Phase 4: User Story 2 — Multi-format coordinate display and simultaneous conversion (Priority: P2)

**Goal**: Render the crosshair position in all six supported formats simultaneously, with correct TM2 zone auto-selection at the 120° E boundary, correct TWD67 four-parameter shift, correct MGRS truncation, and correct Taipower encoding. Let the user hide/show formats with persistence.

**Independent Test**: Park crosshair at Taipei 101; verify every format matches `test-vectors.json` within tolerance. Pan to Magong; verify TWD97 zone label reads 119. Hide Taipower in FormatToggle, reload the page, verify Taipower stays hidden.

### Tests for User Story 2 ⚠️ (write first, see them fail)

- [ ] T041 [P] [US2] Extend `tests/unit/coord/wgs84.spec.ts` with the full `DD_TO_DMS` + `DMS_TO_DD` vector sweep, DMS formatter round-trip (Unicode and ASCII glyphs), and hemisphere-sign mismatch rejection per `contracts/go-to-grammar.md §2.2`.
- [ ] T042 [P] [US2] Write `tests/unit/coord/twd97.spec.ts` — every `WGS84_TO_TM2` and `TM2_TO_WGS84` vector for both zones, plus inverse round-trip to 0.1 m per `contracts/coord-api.md §3.2`.
- [ ] T043 [P] [US2] Write `tests/unit/coord/twd67.spec.ts` — every `TWD97_TO_TWD67` / `TWD67_TO_TWD97` vector, round-trip to 3.0 m, rejection of the deprecated two-constant offset path (assert the function name `twd97ToTwd67Simple` is NOT exported).
- [ ] T044 [P] [US2] Write `tests/unit/coord/mgrs.spec.ts` — every `WGS84_TO_MGRS` / `MGRS_TO_WGS84` vector at precision 5, precision-1-through-4 parametrised test, truncation-not-rounding assertion per `research.md R4` / reference §7.
- [ ] T045 [P] [US2] Write `tests/unit/coord/taipower.spec.ts` — anchor-table round-trip for each in-coverage region letter A–X, explicit `out-of-coverage` Rejection for Y/Z, 9-char and 11-char round-trip.
- [ ] T046 [P] [US2] Write `tests/unit/coord/zone.spec.ts` — boundary rule table: `lon < 120 → 119`, `lon ≥ 120 → 121`, `lon == 120.0` → 121 per reference §9.
- [ ] T047 [P] [US2] Write E2E spec at `tests/e2e/story-2-multi-format.spec.ts` implementing every US2 acceptance scenario from `spec.md` (Taipei 101 all six formats within tolerance, Magong zone label, boundary switch, FormatToggle persistence).

### Implementation for User Story 2

- [ ] T048 [US2] Add DMS parsing and formatting to `src/coord/wgs84.ts`: `parseDms`, `formatWGS84DMS` with Unicode glyph default and ASCII accept. Turns T041 green.
- [ ] T049 [US2] Implement `src/coord/zone.ts` — `pickZone(lon: number): Zone` applying the §9 rule. Turns T046 green.
- [ ] T050 [P] [US2] Implement `src/coord/twd97.ts` — register EPSG:3826 and EPSG:3825 via `proj4.defs`, export `wgs84ToTwd97(dd, zone?)` and `twd97ToWgs84(tm2)`. Zone auto-pick uses `pickZone` from T049. Turns T042 green.
- [ ] T051 [P] [US2] Implement `src/coord/twd67.ts` — four-parameter TWD97 ↔ TWD67 transform with the constants from reference §6 (Δx = 807.8, Δy = 248.6, a = 0.00001549, b = 0.000006521). Pipeline `wgs84ToTwd67` = WGS84 → TWD97 z121 → four-param. Turns T043 green.
- [ ] T052 [P] [US2] Implement `src/coord/mgrs.ts` — `wgs84ToMgrs(dd, precision=5)` and `mgrsToWgs84(mgrs)` wrapping the `mgrs` npm package, asserting truncation semantics. Turns T044 green.
- [ ] T053 [P] [US2] Implement `src/coord/taipower.ts` — anchor table (24 letters A–X × 3 columns × 8 rows per reference §8), `wgs84ToTaipower` pipeline WGS84 → TWD97 → TWD67 → encode, `taipowerToWgs84` inverse, Y/Z rejection via `Result<_, Rejection>`. Turns T045 green.
- [ ] T054 [US2] Extend `initCoord()` in `src/coord/index.ts` to register the two EPSG strings from `twd97.ts`. Extend exports to cover every converter + formatter from `contracts/coord-api.md §3 / §4 / §5`.
- [ ] T055 [US2] Implement `coverageOf(kind, dd)` in `src/coord/index.ts` — applies the bounding boxes from reference §4/§5/§6/§8 Coverage tables to decide `ok` vs `out-of-coverage` per `data-model.md §10.1`.
- [ ] T056 [US2] Extend `src/components/CoordinateReadout.svelte` to render up to six rows — one per `CoordinateKind` in the user's `FormatPreferences.visible`. Each row calls its formatter, shows the zone label for TM2 rows, and substitutes the `coverage.notInTaiwan` i18n string when `coverage === 'out-of-coverage'`.
- [ ] T057 [P] [US2] Implement `src/components/FormatToggle.svelte` — modal / drawer UI listing all six formats as checkboxes, wired to `preferences.ts` so changes persist to `localStorage['pwa_map:prefs']` and the readout re-renders instantly.
- [ ] T058 [US2] Wire `FormatToggle` trigger into `App.svelte` header; add keyboard shortcut (`g` → Go-To placeholder handled in US3, `f` → FormatToggle).
- [ ] T059 [US2] Extend all three locale JSONs with US2 keys: `format.labels.{dd,dms,twd97,twd67,mgrs,taipower}`, `format.zone`, `format.twd97.zone.label`, `coverage.notInTaiwan`, `toggle.title`, `toggle.hint`.
- [ ] T060 [US2] Append US2 layout/interaction notes to `docs/ui/0001-coord-map-layout.md`: multi-row readout, FormatToggle placement, coverage-label styling, responsive collapse on mobile.
- [ ] T061 [US2] Review loop green: `npm run format && npm run lint && npm run typecheck && npm test && npm run test:e2e`.

**Checkpoint**: US2 done. All six formats render; zone flips at the 120° E meridian; FormatToggle persists.

---

## Phase 5: User Story 3 — Go To a target coordinate (Priority: P2)

**Goal**: Accept any supported format in a Go To field, parse it deterministically, and pan the map so the crosshair lands on the target. Invalid input produces a categorised human-readable error; the map does not move on failure.

**Independent Test**: Paste `25.033611, 121.564472` → map flies to Taipei 101; paste `51R UH 55170 69437` → same destination; paste `25° 60′ 00.0″ N, 121° 00′ 00.0″ E` → error "out-of-range — minutes must be 0 to 59" and the map stays put; paste `Y1234 AB56` → "out-of-coverage — Penghu Taipower unsupported".

### Tests for User Story 3 ⚠️ (write first, see them fail)

- [ ] T062 [P] [US3] Write `tests/unit/coord/parser.spec.ts` dispatcher tests: grammar ordering (US1/US2/MGRS/TM2 explicit/TM2 inferred/TWD67/Taipower), `out-of-coverage > out-of-range > unsupported-precision > malformed` preference, worked examples 4.1–4.4 from `contracts/go-to-grammar.md §4`.
- [ ] T063 [P] [US3] Extend `tests/unit/coord/wgs84.spec.ts` with the DD and DMS Accepted/Rejected tables from `contracts/go-to-grammar.md §2.1 / §2.2`.
- [ ] T064 [P] [US3] Extend `tests/unit/coord/mgrs.spec.ts` with the MGRS input-grammar Accepted/Rejected table from `§2.3`.
- [ ] T065 [P] [US3] Extend `tests/unit/coord/twd97.spec.ts` with zone-explicit (§2.4) and zone-inferred (§2.5) Accepted/Rejected tables.
- [ ] T066 [P] [US3] Extend `tests/unit/coord/twd67.spec.ts` with the TWD67 parser Accepted/Rejected table (§2.6).
- [ ] T067 [P] [US3] Extend `tests/unit/coord/taipower.spec.ts` with the Taipower parser Accepted/Rejected table (§2.7).
- [ ] T068 [P] [US3] Write E2E spec at `tests/e2e/story-3-go-to.spec.ts` implementing all US3 acceptance scenarios including zone-auto-resolution hint (AS5) and the "map does not move on reject" invariant.

### Implementation for User Story 3

- [ ] T069 [P] [US3] Add `parseDd` and `parseDms` sub-parsers to `src/coord/wgs84.ts` per grammar §2.1 / §2.2.
- [ ] T070 [P] [US3] Add `parseMgrs` to `src/coord/mgrs.ts` per grammar §2.3 (whitespace tolerated, case-insensitive, even-digit-tail required, I/O forbidden).
- [ ] T071 [P] [US3] Add `parseTm2Explicit` and `parseTm2Inferred` to `src/coord/twd97.ts` per grammar §2.4 / §2.5. `parseTm2Inferred` applies the R11 back-project-and-check algorithm and sets `zoneAutoResolved`.
- [ ] T072 [P] [US3] Add `parseTm2` (TWD67) to `src/coord/twd67.ts` per grammar §2.6 (requires `TWD67` / `twd67=true` qualifier).
- [ ] T073 [P] [US3] Add `parseTaipower` to `src/coord/taipower.ts` per grammar §2.7 (Y/Z → out-of-coverage, I forbidden in 100 m letters).
- [ ] T074 [US3] Implement the dispatcher at `src/coord/parser.ts`: `parseGoTo(raw: string): GoToRequest` that normalises NFC, tries sub-parsers in R10 order, and returns the best Rejection per the §3 preference rule. Depends on T069–T073.
- [ ] T075 [US3] Export `parseGoTo` and the parser-level types from `src/coord/index.ts`.
- [ ] T076 [US3] Extend `src/map/MapController.ts` with `flyTo(target: WGS84DD, options?)` wrapping `map.flyTo` at a sensible zoom (keep current zoom if ≥ 10, else 15).
- [ ] T077 [US3] Implement `src/components/GoToDialog.svelte`: modal with input `<textarea>`, submit button, `aria-live="assertive"` error region. On success, calls `MapController.flyTo` and closes; on failure, shows the localised message for `Rejection.messageKey` and keeps the dialog open.
- [ ] T078 [US3] Wire `GoToDialog` into `App.svelte` with a trigger button and `g` keyboard shortcut. Show a toast "interpreted as TWD97 zone 121" when `zoneAutoResolved` is set (satisfies FR-016).
- [ ] T079 [US3] Extend all three locale JSONs with the complete `errors.*` key catalogue from `contracts/go-to-grammar.md §3` (21 keys × 3 locales = 63 entries). `zh.json` is authoritative; CJK terms translated independently (no zh→ja gloss — research R9).
- [ ] T080 [US3] Append US3 interaction notes to `docs/ui/0001-coord-map-layout.md`: GoToDialog layout, error surface, zone-auto toast copy, keyboard shortcuts table.
- [ ] T081 [US3] Review loop green. Commit.

**Checkpoint**: US3 done. Go To now accepts every format, rejects with meaningful categories, and auto-resolves zone ambiguity.

---

## Phase 6: User Story 4 — Copy current coordinate to clipboard (Priority: P3)

**Goal**: Let the user copy any visible readout row to the clipboard with one tap/click. Fall back to a selectable text field when clipboard permission is denied.

**Independent Test**: Park crosshair at Taipei 101; tap the copy button next to MGRS; paste into a text editor → exactly `51R UH 55170 69437`; paste the copied MGRS back into Go To → returns to Taipei 101 within 1 m.

### Tests for User Story 4 ⚠️

- [ ] T082 [P] [US4] Write `tests/unit/components/copy.spec.ts` — tests a `copyReadout(display: string)` helper against a mocked `navigator.clipboard.writeText` (success + rejected permission).
- [ ] T083 [P] [US4] Write E2E spec at `tests/e2e/story-4-copy.spec.ts` implementing both US4 acceptance scenarios (DMS Unicode-glyph copy, MGRS copy → Go-To round-trip).

### Implementation for User Story 4

- [ ] T084 [US4] Implement `copyReadout(display: string): Promise<Result<void, Rejection>>` in `src/components/CoordinateReadout.svelte` (or split into `src/components/copy.ts` if the file grows). Adds a copy button to each readout row; on success fires a toast, on permission-denied opens the fallback modal.
- [ ] T085 [US4] Implement `src/components/CopyFallback.svelte` — modal with a `<textarea readonly>` preselected for manual Ctrl+C / Cmd+C copying.
- [ ] T086 [US4] Extend all three locale JSONs with `copy.button.aria`, `copy.toast.success`, `copy.fallback.title`, `copy.fallback.hint`.
- [ ] T087 [US4] Append US4 UI notes to `docs/ui/0001-coord-map-layout.md`: copy affordance placement, toast, fallback modal.
- [ ] T088 [US4] Review loop green. Commit.

**Checkpoint**: US4 done. All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Settle the cross-story debt — ADRs for every research decision, performance verification, accessibility sweep, README, final format / lint / test.

- [ ] T089 [P] Author `docs/adr/0001-ui-framework-svelte.md` from research R1.
- [ ] T090 [P] Author `docs/adr/0002-map-engine-maplibre.md` from research R2.
- [ ] T091 [P] Author `docs/adr/0003-tile-source-osm-default.md` from research R3.
- [ ] T092 [P] Author `docs/adr/0004-coord-libraries-proj4-mgrs-custom.md` from research R4.
- [ ] T093 [P] Author `docs/adr/0005-build-tooling-vite.md` from research R5.
- [ ] T094 [P] Author `docs/adr/0006-testing-vitest-playwright.md` from research R6.
- [ ] T095 [P] Author `docs/adr/0007-prettier-eslint.md` from research R7.
- [ ] T096 [P] Author `docs/adr/0008-storage-localstorage.md` from research R8.
- [ ] T097 [P] Author `docs/adr/0009-i18n-three-locale-zh-en-ja.md` from research R9 (explicitly records that the Chinese locale tag is `zh`, per Constitution v1.1.0 Locale conventions).
- [ ] T098 [P] Author `docs/adr/0010-go-to-parser-dispatch.md` from research R10.
- [ ] T099 [P] Author `docs/adr/0011-tm2-zone-auto-resolve.md` from research R11.
- [ ] T100 [P] Author `docs/adr/0012-taipower-main-island-only.md` from research R12.
- [ ] T101 [P] Author `docs/adr/0013-performance-verification-pipeline.md` from research R13.
- [ ] T102 [P] Author `docs/adr/0014-accessibility-baseline.md` from research R14.
- [ ] T103 Update `docs/adr/README.md` — fill the ADR index table with the 14 entries from T089–T102.
- [ ] T104 [P] Implement the Vitest benchmark suite at `bench/coord.bench.ts` — asserts single-point conversion ≤ 1 ms median per `plan.md` Performance Goals.
- [ ] T105 [P] Add Lighthouse CI config at `.github/workflows/lighthouse.yml` (or equivalent CI surface) asserting PWA score ≥ 90, TTI ≤ 3 s on simulated fast-3G.
- [ ] T106 [P] Add a Playwright perf probe at `tests/e2e/perf-pan.spec.ts` — scripts a 5-second pan, asserts median readout updates ≥ 10 Hz (SC-007).
- [ ] T107 Accessibility sweep: verify every interactive element reachable by keyboard in the `Tab` order (MapView → Go To trigger → FormatToggle trigger → per-row copy), contrast ratios pass WCAG AA on both light and dark tiles, crosshair aria-label reflects current readout. Fix any gaps in the touched components.
- [ ] T108 Author `/README.md` at repo root: project summary, quickstart reference, link to `.specify/memory/constitution.md`, link to `specs/001-coord-map-pwa/`, contribution workflow, licence statement for bundled `test-vectors.json` (MIT, attribution intact per reference LICENSE).
- [ ] T109 Run the full `specs/001-coord-map-pwa/quickstart.md §7` checklist end-to-end: format, lint, typecheck, unit, e2e, bench, bundle-size, UI/ADR docs updated. Record evidence (commit hashes, CI run URLs) in a new `docs/adr/0015-release-readiness-001-coord-map-pwa.md`.

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
