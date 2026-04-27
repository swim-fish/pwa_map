---
description: 'Task list for feature 007-tile-cache-settings'
---

# Tasks: Tile Cache Settings

**Input**: Design documents from `/specs/007-tile-cache-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{cache-policy,cache-stats,cache-purge,preferences-v2,settings-sheet}.md, quickstart.md

**Tests**: Tests are REQUIRED for every story (Constitution Principle II — TDD non-negotiable; reaffirmed in research D12). Three load-bearing safety tests in Phase 2 land RED before any production code in `cachePurge.ts`: (a) `clearAllTileCaches` MUST NOT touch `workbox-precache-v2-*` (D9); (b) `enforceMaxEntries` MUST trim oldest-first to exactly `cap` (D11); (c) `purgeExpired` MUST NOT delete fresh entries (D2).

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. Stories are ordered by spec priority (US1 P1 → US2 P2 → US3 P3 → US4 P3). Because all four user-story phases extend the **same** `SettingsSheet.svelte` file, the implementation tasks within them serialise even though the tests for each phase are independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User-story label (US1, US2, US3, US4) — present on Phase 3+ tasks only
- Include exact file paths in descriptions

## Path Conventions

Single-project layout (Option 1 from plan.md). Source under `src/`, tests under `tests/{unit,integration,e2e}`, docs under `docs/{ui,adr}`. All paths are repo-relative from the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the 26 new i18n strings every user story consumes so subsequent component code compiles against existing keys. No production source changes yet — these tasks touch only the three locale files plus a formatter pass.

- [X] T001 [P] Append the 26 new `settings.*` keys to `src/i18n/zh.json` exactly per `contracts/settings-sheet.md` §5 (Taiwan Traditional Chinese column). Keys appear in this order: `settings.title`, `settings.close`, `settings.licenceNotice`, `settings.cache.heading`, `settings.cache.source.osm`, `settings.cache.source.nlsc`, `settings.cache.source.google`, `settings.cache.entries`, `settings.cache.unavailable`, `settings.cache.clear.row`, `settings.quota.estimateLabel`, `settings.quota.unavailable`, `settings.ttl.label`, `settings.ttl.option`, `settings.maxEntries.label`, `settings.clear.all.button`, `settings.confirm.title`, `settings.confirm.body.all`, `settings.confirm.body.one`, `settings.confirm.cancel`, `settings.confirm.confirm`, `settings.status.cleared.all`, `settings.status.cleared.one`, `settings.status.purged.ttl`, `settings.status.trimmed.maxEntries`, `settings.status.error`, `settings.toolbar.button`. Constitution Locale conventions: keep the existing `zh / en / ja` codes only; the licence notice MUST use Taiwan terminology (`使用者`, `檔案`, `程式` if applicable; not `用户` / `文件` / `程序`).
- [X] T002 [P] Append the same 26 keys to `src/i18n/en.json` with the English column from `contracts/settings-sheet.md` §5.
- [X] T003 [P] Append the same 26 keys to `src/i18n/ja.json` with the Japanese column from `contracts/settings-sheet.md` §5.
- [X] T004 Run `npm run format` and `npm run lint` against `src/i18n/{zh,en,ja}.json` to confirm Constitution Principle I before any source-code work begins. Confirm `npm run typecheck` is clean (no callers reference these keys yet, but the JSON must parse).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the three new pure modules (`cachePolicy`, `cacheStats`, `cachePurge`), the test-double for `CacheStorage`, the `preferences.ts` v1→v2 migration, and the workbox-config + `main.ts` wiring that ALL of US1 / US2 / US3 / US4 transitively depend on. This phase MUST complete before any user-story phase begins because every story imports from these files.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete. Three load-bearing safety tests inside `cachePurge.spec.ts` (research D9 + D11 + D2) MUST be the first tests written and MUST be RED before the corresponding implementation tasks.

- [X] T005 [P] Create `tests/unit/pwa/cachePolicy.spec.ts` covering the 9 invariants in `contracts/cache-policy.md` §2 plus the two extra tests in §4: (INV-1) all four exported objects are `Object.isFrozen`; (INV-2) `TILE_CACHE_NAMES` is exactly `['osm-tiles', 'nlsc-tiles', 'google-tiles']` in that order; (INV-3) `TTL_OPTIONS.length === 7`, sorted ascending, all positive integers ≤ 90; (INV-4) `MAX_ENTRIES_OPTIONS.length === 6`, sorted ascending, every value a power of two between 256 and 8192 inclusive; (INV-5) `DEFAULT_TILE_TTL_DAYS === 7` and is a member of `TTL_OPTIONS`; (INV-6) `DEFAULT_TILE_MAX_ENTRIES === 4096` and is a member of `MAX_ENTRIES_OPTIONS`; (INV-7) `TILE_CACHE_MAX_AGE_DAYS_CEILING === Math.max(...TTL_OPTIONS)`; (INV-8) `TILE_CACHE_MAX_ENTRIES_CEILING === Math.max(...MAX_ENTRIES_OPTIONS)`; (INV-9) `Object.keys(SOURCE_LABEL_KEY).sort()` equals `[...TILE_CACHE_NAMES].sort()`; plus (a) `TILE_CACHE_NAMES` does NOT include `'workbox-precache-v2'`; (b) re-importing the module twice yields the same frozen objects (side-effect-free import). Each invariant is its own `it(...)` block named after its INV ID. This test set MUST land RED before T010.
- [X] T006 [P] Create `tests/unit/helpers/cacheStorageFake.ts` providing a hand-rolled `CacheStorage`-shaped fake plus its returned `Cache` shape. Required surface: `open(name)` (returns or auto-creates a `Cache` fake), `delete(name)` (whole-namespace delete; not used by production code but exposed for the safety spec to spy on), `keys()` (lists cache names), and on the `Cache` fake: `keys()` (returns request URLs in insertion order — back the storage by a `Map` to guarantee this), `match(req)` (returns the stored `Response`), `delete(req)` (returns `true` if removed), `put(req, res)` (insertion-only; preserves order; returns void). Plus a helper `seed(storage, name, entries)` that takes an array of `{ url: string, dateHeader?: string | null }` and `put`s them in order so tests can assert iteration order. Plus a helper `makeResponse(dateHeader: string | null)` returning a `Response`-shaped object exposing `.headers.get('date')` (return null when `dateHeader === null`). Module exports `createCacheStorageFake()` and the two helpers. No production import; tests-only.
- [X] T007 [P] Create `tests/unit/pwa/cacheStats.spec.ts` covering the 9 cases in `contracts/cache-stats.md` §6: (1) `countCacheEntries` returns 0 for an empty cache; (2) returns N for caches of size {1, 256, 4096}; (3) returns null when storage param undefined and `globalThis.caches` undefined; (4) returns null when `storage.open` throws; (5) `estimateQuota` returns the values from `navigator.storage.estimate`; (6) returns `{usage:null, quota:null}` when `navigator.storage` undefined; (7) returns `{usage:null, quota:null}` when `navigator.storage.estimate` undefined; (8) returns `{usage:null, quota:null}` when `estimate()` rejects; (9) `estimateQuota` does NOT log to console on rejection (spy on `console.error` and `console.warn`, expect zero calls). Use the fake from T006. This test set MUST land RED before T011.
- [X] T008 [P] Create `tests/unit/pwa/cachePurge.spec.ts` covering the 14 cases in `contracts/cache-purge.md` §9, in this exact authoring order so the safety properties go RED first: (Safety) (1) `clearAllTileCaches` does NOT delete `workbox-precache-v2-*` — fake storage with 4 caches incl. precache; after call, precache key list and per-key Response are bit-identical; (2) `enforceMaxEntries` trims to exactly `cap` — 100 entries, cap 30, expect 30 remaining; (3) `enforceMaxEntries` deletes oldest-first — keys `tile-0..tile-99` inserted in order, after trim to 30 the remaining keys are `tile-70..tile-99`; (4) `purgeExpired` keeps fresh entries — entry with `Date: now - 1d`, ttlDays 7, survives; (5) `purgeExpired` deletes stale entries — entry with `Date: now - 30d`, ttlDays 7, deleted; (6) `purgeExpired` deletes entries with missing date header (conservative fallback per D2); (Behaviour) (7) `clearCache` returns the deleted count for N ∈ {0, 1, 256}; (8) `clearCache` uses per-entry delete, NOT `storage.delete(name)` — spy on the fake storage's `delete` method, expect 0 calls; (9) `clearAllTileCaches` returns per-cache counts with `0` for empty caches; (10) `enforceCachePolicy` runs `purgeExpired` BEFORE `enforceMaxEntries` — assert via order of fake-cache `delete` calls; (Performance) (11) `enforceMaxEntries` yields the main thread — fake `setTimeout` spy, expect ≥ ⌈delta/256⌉ awaits; (12) `purgeExpired` yields the main thread — same pattern; (Resilience) (13) `clearCache` returns `deleted: 0` when storage undefined; (14) `enforceMaxEntries` no-ops when `keys.length ≤ cap` — returns `{deleted:0, kept:original}`. This test set MUST land RED before T012.
- [X] T009 [P] Create `tests/unit/storage/preferences-v2.spec.ts` covering the 11 cases in `contracts/preferences-v2.md` §8: (1) defaults populated when storage empty (`tileTtlDays===7`, `tileMaxEntries===4096`); (2) v1 record is upgraded with default v2 fields on load; (3) v2 record round-trips for each `(ttl, max) ∈ TTL_OPTIONS × MAX_ENTRIES_OPTIONS` (42 combinations via `it.each`); (4) out-of-range `tileTtlDays` reset to default; (5) out-of-range `tileMaxEntries` reset to default; (6) undefined v2 fields populated with defaults; (7) `loadTileTtlDays / saveTileTtlDays` round-trip for each preset; (8) `loadTileMaxEntries / saveTileMaxEntries` round-trip for each preset; (9) `saveTileTtlDays(30)` preserves all other prefs unchanged; (10) `saveTileMaxEntries(256)` preserves all other prefs unchanged; (11) `{version: 3, ...}` falls back to defaults via the existing validator-null path. Reuse the `safeStorage()` mocking pattern from `tests/unit/storage/recents.spec.ts`. This test set MUST land RED before T013.

> Sequencing note for the four-spec slot above: T005 / T006 / T007 / T008 / T009 are pure test-or-helper edits to disjoint files and run in parallel. After they're all RED, T010 / T011 / T012 / T013 implement disjoint files and also run in parallel. Each pair must commit test-first per Constitution Principle II.

- [X] T010 [P] Create `src/pwa/cachePolicy.ts` per `contracts/cache-policy.md` §1: export `TILE_CACHE_NAMES` (frozen tuple), `TTL_OPTIONS` (frozen tuple), `MAX_ENTRIES_OPTIONS` (frozen tuple), the corresponding `TileCacheName` / `TtlDays` / `TileMaxEntries` types via `(typeof X)[number]`, `DEFAULT_TILE_TTL_DAYS = 7`, `DEFAULT_TILE_MAX_ENTRIES = 4096`, `TILE_CACHE_MAX_AGE_DAYS_CEILING = 90` (typed as the literal `90`), `TILE_CACHE_MAX_ENTRIES_CEILING = 8192` (typed as the literal `8192`), and `SOURCE_LABEL_KEY` (frozen Record). MUST NOT import from any project module (zero deps; build-time-safe so `vite.config.ts` can `import` it). MUST NOT export any function. After this, T005 turns green.
- [X] T011 [P] Create `src/pwa/cacheStats.ts` per `contracts/cache-stats.md` §1: export `countCacheEntries(name: TileCacheName, storage?: CacheStorage)` and `estimateQuota(store?)` exactly per the contract behaviour table (§2 + §3). NEVER throws; NEVER logs to console; uses `(await storage.open(name)).keys().then(k => k.length)` for the count; uses `await store?.estimate?.()` with proper null/undefined fall-throughs. After this, T007 turns green.
- [X] T012 [P] Create `src/pwa/cachePurge.ts` per `contracts/cache-purge.md` §1: export `clearCache`, `clearAllTileCaches`, `purgeExpired`, `enforceMaxEntries`, `enforceCachePolicy` with exactly the signatures and behaviours documented. Critical implementation rules: (a) `clearAllTileCaches` MUST iterate the FIXED `TILE_CACHE_NAMES` allowlist — never `storage.keys()` (research D9); (b) `clearCache` uses per-entry `cache.delete(req)`, NOT `storage.delete(name)` (research note in cache-purge.md §2); (c) `enforceMaxEntries` deletes from the FRONT of `cache.keys()` (insertion order = oldest first, research D11); (d) every loop that may delete > 256 entries MUST yield via `await new Promise(r => setTimeout(r, 0))` every 256 deletions; (e) `purgeExpired` reads `Response.headers.get('date')`, parses with `Date.parse`, deletes when missing/unparseable (research D2 conservative fallback); (f) `enforceCachePolicy` calls `purgeExpired` THEN `enforceMaxEntries` per cache (in series), and fans out across the three caches with `Promise.all`. After this, T008 turns green — INCLUDING the three safety properties.
- [X] T013 [P] Amend `src/storage/preferences.ts` per `contracts/preferences-v2.md` §1–§5 in place: (a) rename the existing `FormatPreferences` interface to `FormatPreferencesV1`, keep it for the migration path, and add the new `FormatPreferencesV2` interface; (b) export `type FormatPreferences = FormatPreferencesV2` so all existing callers automatically pick up the v2 shape; (c) bump `PREFS_VERSION` from `1` to `2`; (d) extend `defaultPreferences()` with `tileTtlDays: DEFAULT_TILE_TTL_DAYS` and `tileMaxEntries: DEFAULT_TILE_MAX_ENTRIES` from `$pwa/cachePolicy`; (e) extend `validatePreferences` per the table in §4 — accept BOTH `version: 1` and `version: 2`, substitute defaults for missing or out-of-range v2 fields; (f) add the four new helper exports `loadTileTtlDays`, `saveTileTtlDays`, `loadTileMaxEntries`, `saveTileMaxEntries`. The `save*` helpers MUST internally `loadPreferences()` → spread → `savePreferences(...)` to keep the storage record atomic. After this, T009 turns green.
- [X] T014 Amend `vite.config.ts` per `data-model.md` §7: add `import { TILE_CACHE_MAX_AGE_DAYS_CEILING, TILE_CACHE_MAX_ENTRIES_CEILING } from './src/pwa/cachePolicy';` at the top, derive `const TILE_MAX_AGE_SECONDS = TILE_CACHE_MAX_AGE_DAYS_CEILING * 60 * 60 * 24;`, and replace the hard-coded `60 * 60 * 24 * 7` with `TILE_MAX_AGE_SECONDS` and the hard-coded `4096` with `TILE_CACHE_MAX_ENTRIES_CEILING` in all THREE `runtimeCaching` entries (`osm-tiles`, `nlsc-tiles`, `google-tiles`). Confirm `npm run build` succeeds and the generated `dist/sw.js` contains the literal `7776000` seconds (90 days) and `8192` entries.
- [X] T015 Amend `src/app/main.ts`: add `import { enforceCachePolicy } from '$pwa/cachePurge';` and `import { loadTileTtlDays, loadTileMaxEntries } from '$storage/preferences';`; immediately after the existing `registerSW();` call, add a fire-and-forget `void enforceCachePolicy(loadTileTtlDays(), loadTileMaxEntries()).catch(() => { /* swallow — surfaced via the Settings sheet on next open */ });`. The `void` and the swallowed-catch are intentional: awaiting would delay first paint; a transient enforce failure is recoverable on the next app start.
- [X] T016 Run `npm run format`, `npm run lint`, `npm run typecheck`, then `npm test -- tests/unit/pwa tests/unit/storage` — all four foundational unit-test files MUST be green. Build sanity: `npm run build` succeeds with the new constants flowing into workbox.

**Checkpoint**: Foundation in place — three pure modules + test fake + preferences v2 + workbox + main.ts. User-story phases (US1–US4) may now begin.

---

## Phase 3: User Story 1 — Inspect tile cache footprint and clear it (Priority: P1) 🎯 MVP

**Goal**: Land the Settings sheet's MVP slice — toolbar gear button, modal sheet, three rendered cache rows with counts and the shared cap, the licence notice, the quota estimate, and the "Clear all" button with its confirmation dialog. Aligns with FR-001..FR-005, FR-009, FR-011..FR-018, SC-001..SC-006, SC-008.

**Independent Test**: With two tile caches pre-populated via the test hooks, opening the Settings sheet renders three rows showing the populated counts on rows 1–2 and `0` on row 3, the licence notice is visible, and the quota estimate renders with the `≈` prefix. Tapping `[data-testid="settings-clear-all"]` opens a confirmation `<dialog>`; tapping its confirm button calls `clearAllTileCaches`; on resolve, the rows redraw with all three at `0`, the inline status banner reads the localised "All tile caches cleared", and the quota estimate is no greater than its pre-clear value.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T020.

- [X] T01& [P] [US1] Create `tests/unit/components/SettingsSheet.spec.ts` covering the US1-relevant subset of the 18 cases in `contracts/settings-sheet.md` §6: (1) sheet opens via `open=true` — `<dialog>` has `open` attribute and `data-testid="settings-sheet"` present; (2) three rows render in OSM / NLSC / Google order (assert `data-testid="settings-cache-row-osm-tiles"` precedes `nlsc-tiles` precedes `google-tiles`); (3) each row shows the count from `countCacheEntries` (use the fake from T006 to seed counts); (4) each row shows the cap from preferences (assert `data-testid="settings-cache-row-osm-tiles-count"` text contains the cap value); (5) quota estimate renders with `≈` prefix on success path; (6) quota estimate shows the localised "—" placeholder when `estimateQuota` returns `{usage:null, quota:null}`; (7) click on `settings-clear-all` opens the confirmation dialog and does NOT yet call `clearAllTileCaches` (verify spy zero calls); (8) confirm in the dialog calls `clearAllTileCaches` exactly once and re-`refresh()`es the rows; (9) cancel in the dialog leaves the caches untouched; (15) every visible button + the two `<select>` elements have `getBoundingClientRect()` width AND height ≥ 36 (the two `<select>`s render hidden in this slice but assert tap targets only on what's visible — i.e. close button + clear-all button + scrim/dismiss); (16) Escape keydown closes the sheet; (17) `<dialog>` exposes `aria-labelledby` pointing to the title element's `id`; (18) status banner uses `role="status"`. Hand-roll a stub that exposes `clearAllTileCaches`, `countCacheEntries`, `estimateQuota` so the spec is independent of the real cache modules. The TTL `<select>`, MaxEntries `<select>`, and per-row clear cases are deferred to later phases. This test set MUST land RED before T020.
- [X] T01& [P] [US1] Create `tests/integration/settings-clear-cache.spec.ts` with the US1 slice of the 3 cross-module flow cases in `contracts/settings-sheet.md` §6: (19) open → clear-all → confirm → counts go to zero → close → re-open → counts still zero, exercising the REAL `cachePurge` + `cacheStats` modules against a `tests/unit/helpers/cacheStorageFake.ts` instance pre-seeded with mixed entries on osm and nlsc, empty google. The TTL-purge and max-entries-trim cases are deferred to Phase 5 / Phase 6. This test MUST land RED before T020.
- [X] T01& [P] [US1] Create `tests/e2e/story-7-settings.spec.ts` with the US1 scenario only: (a) `await page.goto('/')`; pan the map across two layers via the existing `__mapTestHooks.startScriptedPan` to populate two caches; (b) click the toolbar gear button (`[data-testid="settings-toolbar-button"]`); (c) assert the sheet opens (`[data-testid="settings-sheet"][open]`), the three rows render with correct order, the licence notice text contains the localised "短暫離線" / "short-term offline" / "短時間" substring per the active locale, and the quota line starts with `≈`; (d) click `[data-testid="settings-clear-all"]`, then `[data-testid="settings-confirm-ok"]`; (e) assert all three row counts read `0` within 2 s; (f) collect `page.on('console','error')` + `page.on('pageerror')` across the test, assert empty (regression net per feature 005's pattern). The TTL persistence and max-entries persistence scenarios are deferred to Phase 5 / Phase 6. This test MUST land RED before T020. Mirror the `tests/e2e/story-5-install.spec.ts` pattern for hook waits and console-error collection.

### Implementation for User Story 1

- [X] T020 [US1] Create `src/components/SettingsSheet.svelte` per `contracts/settings-sheet.md` §1–§4, but only the US1-relevant subset of features: render the `<dialog>` shell with header (title + close button), the licence-notice paragraph, the three-row cache list (each row showing source label, `count / cap` text, and a placeholder per-row clear button that is `disabled` in this phase — its handler is wired in Phase 4), the quota line with `≈ X MB` formatting via `Number.prototype.toLocaleString`, the "Clear all" button at the bottom, and the `<ConfirmClearDialog>` slot driven by the `confirmTarget: ClearTarget | null` state (handle only `kind: 'all'` in this slice; per-row `kind: 'one'` is deferred). Wire: `refresh()` on `open=true` populates `rows[]` via `countCacheEntries(name)` for each `TILE_CACHE_NAMES` entry plus a single `estimateQuota()` call; the "Clear all" path sets `confirmTarget = { kind: 'all' }`; confirming calls `clearAllTileCaches()` then `refresh()` then sets `statusMessage = $tStore('settings.status.cleared.all')`; the dialog and main sheet use `<dialog>` + `dialog.showModal()` for native focus trap + Escape close + scrim. The TTL `<select>` and MaxEntries `<select>` are NOT rendered in this slice (they will be added in Phase 5 / Phase 6 with their own tests). Reduced-motion CSS rule per §3 is in place from this task — open/close transitions skipped under `prefers-reduced-motion: reduce`. After this, T017 and T018 turn green for the US1 cases. Run `npm run format`.
- [X] T021 [US1] Amend `src/app/App.svelte` to add the toolbar gear button as the rightmost child of the existing top-right toolbar (after `LocalePicker`'s opener), with `data-testid="settings-toolbar-button"`, `aria-label={$tStore('settings.toolbar.button')}`, and an inline 24×24 SVG gear icon using `currentColor`. Maintain a top-level `let settingsOpen = false;` state that the button toggles; mount `<SettingsSheet bind:open={settingsOpen} />`. The button reuses the existing toolbar-button styling from `LocalePicker.svelte`'s opener (same dimensions, same hover/focus tokens). Run `npm run format`. After this, T019 turns green for the US1 scenario.
- [X] T022 [US1] Run `npm run format`, then `npm test -- tests/unit/components/SettingsSheet.spec.ts tests/integration/settings-clear-cache.spec.ts tests/unit/pwa tests/unit/storage`. Build + preview + Playwright: `npm run build && npm run preview &` followed by `npx playwright test tests/e2e/story-7-settings.spec.ts`. Confirm SC-001 (≤ 30 s task completion in manual smoke), SC-004 (open p95 < 150 ms — measured by integration test wall-clock), SC-005 (clear-all p95 < 1.5 s for 4096 entries × 3 caches), SC-006 (no UI string contains "下載" / "download" / "ダウンロード" — extend the i18n parity spec in Phase 7 to enforce this).

**Checkpoint**: US1 fully functional. The user can open Settings, see the three caches and quota, read the licence notice, and clear all caches with confirmation. The MVP slice is shippable here. The TTL `<select>`, MaxEntries `<select>`, and per-row clear buttons are visually absent (or disabled placeholders); they land in Phase 4 / 5 / 6 incrementally.

---

## Phase 4: User Story 2 — Clear a single tile source independently (Priority: P2)

**Goal**: Promote the per-row clear placeholder buttons in `SettingsSheet.svelte` from disabled to functional. Each row's clear button opens the same confirmation dialog with body wording naming the source; confirming calls `clearCache(name)` for that one source only. Aligns with FR-010, FR-011, FR-012, SC-002, SC-008.

**Independent Test**: With all three caches pre-populated, tapping the per-row clear control on the Google row opens the confirmation dialog with body text containing `"Google"` (per active locale); tapping its confirm button calls `clearCache('google-tiles')` exactly once and `clearCache('osm-tiles')` / `clearCache('nlsc-tiles')` zero times; on resolve, only the Google row drops to `0`, the inline status banner names `"Google"`, and the OSM + NLSC rows are unchanged.

### Tests for User Story 2 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T025.

- [X] T023 [P] [US2] Amend `tests/unit/components/SettingsSheet.spec.ts` with the US2-relevant cases from `contracts/settings-sheet.md` §6: (10) per-row clear opens a confirmation dialog naming that source — assert the dialog body text contains the localised source label (e.g., `"Google"`); (11) confirm per-row calls `clearCache(name)` exactly once with the matching `name`, and `clearAllTileCaches` ZERO times. Use the same stub harness from T017. Add an additional case: (10b) per-row clear when its row's count is `0` either disables the button or the confirm path is a silent no-op (no error). This amendment MUST land RED before T025.
- [X] T024 [P] [US2] Amend `tests/integration/settings-clear-cache.spec.ts` with the US2 cross-module flow case: pre-seed all three caches with distinct entry counts (e.g., 50/30/10), invoke per-row clear on `nlsc-tiles` only, confirm, then assert OSM count unchanged at 50, NLSC at 0, Google unchanged at 10. Exercise the REAL `cachePurge` + `cacheStats` modules. This MUST land RED before T025.

### Implementation for User Story 2

- [X] T025 [US2] Amend `src/components/SettingsSheet.svelte` to: (a) enable the per-row clear button rendered in T020 — set `data-testid="settings-cache-row-{name}-clear"`, `aria-label={$tStore('settings.cache.clear.row')}` (suffixed with the source label for screen readers), and on:click sets `confirmTarget = { kind: 'one', name }`; (b) extend `<ConfirmClearDialog>`'s body to switch on `target.kind` — `'all'` keeps the existing `settings.confirm.body.all` template, `'one'` uses `$tStore('settings.confirm.body.one', { source: $tStore(SOURCE_LABEL_KEY[target.name]) })`; (c) extend the confirm-handler switch — `'all'` keeps calling `clearAllTileCaches()`, `'one'` calls `clearCache(target.name)`; (d) extend the `statusMessage` switch — `'one'` sets `$tStore('settings.status.cleared.one', { source: $tStore(SOURCE_LABEL_KEY[target.name]) })`. After this, T023 and T024 turn green. Run `npm run format`.
- [X] T026 [US2] Run `npm run format`, then `npm test -- tests/unit/components/SettingsSheet.spec.ts tests/integration/settings-clear-cache.spec.ts`. Confirm zero regression in the US1 cases.

**Checkpoint**: US1 + US2 functional. The user can clear all caches OR clear a single source independently, with confirmation. Still no TTL or MaxEntries control yet.

---

## Phase 5: User Story 3 — Adjust how long cached tiles are retained (Priority: P3)

**Goal**: Add the TTL `<select>` to `SettingsSheet.svelte` and wire the change handler so that selecting a new TTL persists via `saveTileTtlDays` and triggers `enforceCachePolicy(newTtl, currentMax)` to purge any newly-stale entries. Aligns with FR-005 (TTL part), FR-006, FR-007 (TTL part), FR-008, SC-002 (TTL change confirmation flow), SC-007 (TTL persistence).

**Independent Test**: With a tile cache pre-seeded containing both a 1-day-old entry (date header set) and a 14-day-old entry, selecting TTL = 7 days from the `<select>` triggers a purge that removes the 14-day entry and keeps the 1-day entry; the row count visibly decreases without the user pressing a clear button. Reloading the app preserves the TTL choice (assert the `<select>`'s `value` is `7` after reload).

### Tests for User Story 3 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T030.

- [X] T027 [P] [US3] Amend `tests/unit/components/SettingsSheet.spec.ts` with the US3-relevant case (12) from `contracts/settings-sheet.md` §6: TTL change calls `saveTileTtlDays(newValue)` AND `enforceCachePolicy(newValue, currentMaxEntries)` exactly once each, with the new TTL value and the CURRENT max-entries value (which in this slice is `DEFAULT_TILE_MAX_ENTRIES = 4096` from the prefs). Verify that the TTL `<select>` is `disabled` while the purge promise is in flight and re-enabled afterward. Add: the seven `<option>` elements rendered correspond to `TTL_OPTIONS` in order; the initial `value` is the current `loadTileTtlDays()` return value. Also add: status banner after purge displays the localised `settings.status.purged.ttl` template with the `{days}` and `{count}` interpolations resolved. This amendment MUST land RED before T030.
- [X] T028 [P] [US3] Amend `tests/integration/settings-clear-cache.spec.ts` with the US3 cross-module flow case (20): pre-seed `osm-tiles` with one entry having `Date: now - 1d` and one having `Date: now - 14d` (use the `seed` + `makeResponse` helpers from T006); change TTL from default 7 to 1; assert `osm-tiles` now contains exactly the freshest entry (the 1-day-old entry is also stale relative to TTL=1, so this case actually leaves zero — adjust the seed to one 12-hour-old + one 14-day-old to leave exactly the 12-hour entry). Verify `localStorage['pwa_map:prefs']` parses to a v2 record with `tileTtlDays: 1`. This MUST land RED before T030.
- [X] T029 [P] [US3] Amend `tests/e2e/story-7-settings.spec.ts` with the US3 persistence scenario: open Settings, change TTL `<select>` to `30`, close the sheet, `await page.reload()`, reopen Settings, assert the TTL `<select>`'s `value` is `30`. This MUST land RED before T030.

### Implementation for User Story 3

- [X] T030 [US3] Amend `src/components/SettingsSheet.svelte` to: (a) render the `<label>` + `<select data-testid="settings-ttl">` block per `contracts/settings-sheet.md` §1, populated from `cachePolicy.TTL_OPTIONS`; (b) bind `value` to a local `ttlDays` state initialised from `loadTileTtlDays()` on mount; (c) on:change handler `onChangeTtl` sets a `busy` flag, calls `saveTileTtlDays(newValue)`, awaits `enforceCachePolicy(newValue, maxEntries)`, then sets `statusMessage = $tStore('settings.status.purged.ttl', { days: newValue, count: totalDeleted })` where `totalDeleted` sums `result.perCache[name].deleted` for `purgeExpired`'s contribution (the result shape lets us count expired-deleted separately from max-trimmed; if the implementation cannot easily separate, sum total deletions and label the message accordingly — pick one and document in the UI doc); finally re-runs `refresh()` and clears `busy`. The `<select>` is `disabled` while `busy === true`. The TTL change does NOT require its own confirmation dialog because the destructive scope is bounded by the user's TTL choice; the licence notice + status banner are sufficient disclosure (matches SC-002 — note that "TTL change that triggers purge" emits a "confirmation step" via the inline status banner; this is the documented design choice). After this, T027 + T028 + T029 turn green. Run `npm run format`.
- [X] T031 [US3] Run `npm run format`, then the same test command from T026 plus `npx playwright test tests/e2e/story-7-settings.spec.ts`. Confirm SC-007 (TTL persists across cold restart) and FR-008 (TTL change purges on the spot).

**Checkpoint**: US1 + US2 + US3 functional. TTL is editable and persistent; a TTL reduction immediately purges newly-stale tiles.

---

## Phase 6: User Story 4 — Cap how many tiles each cache may hold (Priority: P3)

**Goal**: Add the MaxEntries `<select>` to `SettingsSheet.svelte` and wire its handler so that selecting a smaller cap persists via `saveTileMaxEntries` and triggers `enforceCachePolicy(currentTtl, newCap)` to trim each cache to the new cap, oldest-first. Aligns with FR-005 (MaxEntries part), FR-007 (MaxEntries part), FR-019, FR-020, FR-021, SC-007 (MaxEntries persistence), SC-009.

**Independent Test**: With `osm-tiles` pre-seeded with 100 entries, changing MaxEntries from default 4096 to 256 (or a value less than 100, e.g., 30) triggers a trim that leaves exactly the new cap entries — and they are the most-recently-inserted entries (oldest-first removed). Reloading the app preserves the MaxEntries choice and the sheet's `<select>` value reflects it.

### Tests for User Story 4 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T035.

- [X] T032 [P] [US4] Amend `tests/unit/components/SettingsSheet.spec.ts` with the US4-relevant case (13) from `contracts/settings-sheet.md` §6: MaxEntries change calls `saveTileMaxEntries(newValue)` AND `enforceCachePolicy(currentTtl, newValue)` exactly once each, with the CURRENT TTL value and the new cap. Verify the MaxEntries `<select>` is `disabled` while the trim promise is in flight; the six `<option>` elements correspond to `MAX_ENTRIES_OPTIONS` in order; initial value is `loadTileMaxEntries()`. Status banner after trim shows localised `settings.status.trimmed.maxEntries` template with `{cap}` and `{count}` interpolations. Critically: assert that RAISING the cap does NOT call any tile-fetch / prefetch / download function — there should be no symbol named `prefetch` / `download` / `populate` reachable from `SettingsSheet` (this is enforced by code review + the i18n string audit, but the test asserts the change-handler's side-effect set is exactly `saveTileMaxEntries + enforceCachePolicy + refresh`). This amendment MUST land RED before T035.
- [X] T033 [P] [US4] Amend `tests/integration/settings-clear-cache.spec.ts` with the US4 cross-module flow case (21): pre-seed `osm-tiles` with 100 entries `tile-0..tile-99` inserted in order; with TTL set high enough that nothing is stale (e.g., 90 days); change MaxEntries from 4096 to 30 (or to one of the preset values; pick `1024` if 30 is not a preset, then assert the trim leaves 1024 entries — adjust seed to 1500 entries to make the trim observable). Use a preset value from `MAX_ENTRIES_OPTIONS` for the new cap. Assert the surviving keys are the most-recent N (i.e., the original `tile-{count - N}..tile-{count - 1}` range). Verify `localStorage['pwa_map:prefs']` parses to a v2 record with the chosen `tileMaxEntries`. This MUST land RED before T035.
- [X] T034 [P] [US4] Amend `tests/e2e/story-7-settings.spec.ts` with the US4 persistence scenario: open Settings, change MaxEntries `<select>` to `1024`, close the sheet, `await page.reload()`, reopen Settings, assert the MaxEntries `<select>`'s `value` is `1024`. This MUST land RED before T035.

### Implementation for User Story 4

- [X] T035 [US4] Amend `src/components/SettingsSheet.svelte` to: (a) render the `<label>` + `<select data-testid="settings-max-entries">` block per `contracts/settings-sheet.md` §1, populated from `cachePolicy.MAX_ENTRIES_OPTIONS` with each option's text being `opt.toLocaleString()`; (b) bind `value` to a local `maxEntries` state initialised from `loadTileMaxEntries()` on mount; (c) on:change handler `onChangeMaxEntries` sets a `busy` flag, calls `saveTileMaxEntries(newValue)`, awaits `enforceCachePolicy(ttlDays, newValue)`, then sets `statusMessage = $tStore('settings.status.trimmed.maxEntries', { cap: newValue, count: totalTrimmed })` where `totalTrimmed` sums the trim-only deletions across the three caches (the `enforceCachePolicy` result shape from `cachePurge.ts` MUST allow distinguishing the trim contribution from the purge contribution — if not, sum total deletions and use the `settings.status.trimmed.maxEntries` template; document in UI doc); finally re-runs `refresh()` and clears `busy`. The `<select>` is `disabled` while `busy === true`. CRITICAL (FR-021): raising the cap does NOT trigger any tile fetch — the `enforceCachePolicy` call with a higher cap is a no-op for trim purposes; the only side-effects on raise are the prefs write and the cosmetic status banner. After this, T032 + T033 + T034 turn green. Run `npm run format`.
- [X] T036 [US4] Run `npm run format`, then the same test command from T031 plus `npx playwright test tests/e2e/story-7-settings.spec.ts`. Confirm SC-007 (MaxEntries persists across cold restart), SC-009 (oldest-first trim leaves the cap exactly), and FR-021 (no fetch on raise — manually confirm via DevTools Network tab that changing MaxEntries from 4096 → 8192 issues ZERO tile requests).

**Checkpoint**: US1 + US2 + US3 + US4 all functional. Settings sheet is feature-complete: inspect, clear-all, clear-one, TTL, MaxEntries.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle III + V deliverables, regression sweep against features 001–006, performance verification, the licence-language audit (SC-006), and manual smoke per `quickstart.md`.

- [X] T037 [P] Create `docs/ui/0007-settings-tile-cache.md` per Constitution Principle III. Capture: (a) screenshots of the Settings sheet in zh / en / ja in light AND dark mode (six images; check `docs/ui/screenshots/`); (b) one screenshot of the confirmation dialog for "Clear all"; (c) one screenshot of the per-row clear confirmation; (d) one screenshot of the inline status banner after a TTL change; (e) one screenshot of the MaxEntries `<select>` open with all six options visible; (f) one explicit annotation showing the licence notice's verbatim text per locale; (g) the toolbar conflict map from `research.md` D3 — describe how the gear button sits at the end of the existing top-right toolbar without colliding with feature 003's popovers; (h) acceptance-scenario references back to spec.md US1–US4. Document any new design tokens introduced (e.g., `--color-danger-bg`, `--color-danger-fg` if added in T020). Follow the established structure of `docs/ui/0006-compass.md`. Append the entry to `docs/ui/README.md`'s Index table.
- [X] T038 [P] Create `docs/adr/0027-tile-cache-settings.md` per Constitution Principle V. Document, with research-decision references: (a) TTL adjustable AND MaxEntries adjustable (research D1 + D11) — workbox bakes the user-selectable maxima as passive backstops; (b) app-level `purgeExpired` + `enforceMaxEntries` are the active enforcers (research D1); (c) `<dialog>` element + native `showModal()` for confirmation, NOT `window.confirm` (research D6); (d) MaxEntries deletion order = `cache.keys()` insertion order (research D11) and the rationale for not date-sorting; (e) `clearAllTileCaches` iterates the FIXED `TILE_CACHE_NAMES` allowlist — never `storage.keys()` — to guarantee the workbox precache stays untouched (research D9); (f) NO download / prefetch / area-export affordance under any guise (FR-013, FR-021); (g) preset lists for both knobs are FIXED in source — no free-form input (research D4 + D11). The ADR explicitly extends ADR 0021 (additive prefs evolution) — this is its first v2 bump. Append the entry to `docs/adr/README.md`'s Index table as `0027` with status `Accepted`. No existing ADR is superseded.
- [X] T039 [P] Create `tests/integration/settings-contrast.spec.ts` mirroring the source-token check pattern from `tests/integration/controls-contrast.spec.ts`. Assert that `src/components/SettingsSheet.svelte` references `var(--color-surface-elev)`, `var(--color-fg)`, `var(--color-border)` (and `var(--color-danger-bg)` / `var(--color-danger-fg)` for the destructive buttons) and DOES NOT hard-code raw hex / rgba values for `background` / `color` (allow standard `box-shadow` rgba and `currentColor`). Closes FR-018 / SC-006 (UX consistency).
- [X] T040 [P] Create `tests/unit/i18n/settings-keys-parity.spec.ts` asserting that every `settings.*` key present in `src/i18n/zh.json` is also present in `en.json` and `ja.json` (and vice versa). Plus the LICENCE-LANGUAGE AUDIT for SC-006: assert that ZERO values across the three locale files contain the substrings `"下載"`, `"download"`, `"ダウンロード"`, `"預先快取"`, `"prefetch"`, `"area download"`, `"離線地圖"`, `"offline map"`, `"オフラインマップ"`. (The licence notice itself uses the negation form — `"不提供地圖下載功能"` / `"Bulk map downloading is forbidden"` / `"地図の一括ダウンロード...禁止"` — which contains the substring on purpose; whitelist `settings.licenceNotice` from this check by key.) Closes SC-006 as a build-time regression net.
- [X] T041 Run the full automated suite — `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run build && npm run preview &` followed by `npx playwright test`. Address any regression in features 001–006 specs (per spec Assumptions: existing tests must still pass). Then `npm run bundle-size` and confirm the gzipped main-bundle delta from the feature-006 baseline is ≤ 4 KB (plan Performance Goals). After confirming, run `npm run bundle-size -- --update-baseline` ONLY IF feature 007 is being merged to main; otherwise leave the baseline at feature 006's snapshot. If over budget, identify the largest contributor among `SettingsSheet.svelte`, the three pure modules in `src/pwa/`, the `preferences.ts` amendment, and the 26 i18n strings × 3 locales; reduce by inlining the SVG more compactly, dropping non-essential `<dialog>` styling, or splitting locale strings if necessary. Document the final delta in the PR description.
- [ ] T042 Manual smoke-test against `quickstart.md` §"Smoke test (manual)" steps 1–9 in: (a) Chrome / Edge on desktop (open sheet, clear-all, change TTL, change MaxEntries, reload to verify persistence, inspect DevTools Application → Cache Storage to verify `workbox-precache-v2-*` is bit-identical before/after a clear-all); (b) Chrome on Android (touch tap on gear, scroll the sheet, tap clear with confirmation); (c) Safari on iOS (touch tap, verify `<dialog>` opens — Safari supported `<dialog>` since iOS 15.4 which is in our target). Tick every acceptance scenario in spec.md US1–US4 by hand. Capture any UX regression and file follow-up before requesting review. Confirm SC-001 (≤ 30 s task completion on first attempt without instructions).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** — No source-code dependencies; touches only the three locale JSONs.
- **Phase 2 Foundational** — Independent of Phase 1 in raw compilation terms (the new modules don't import the new i18n keys), but BLOCKS Phase 3+ because every story imports from `cachePolicy`, `cacheStats`, `cachePurge`, and the v2 preferences. Run Phase 1 first only because format / lint coverage is a Constitution Principle I gate before production-source work begins.
- **Phase 3 US1** — Depends on Phase 2 (uses `cachePolicy.TILE_CACHE_NAMES`, `cacheStats.countCacheEntries` / `estimateQuota`, `cachePurge.clearAllTileCaches`, and the v2 prefs `tileMaxEntries` for the row's cap display).
- **Phase 4 US2** — Depends on Phase 3 because it amends the SAME `SettingsSheet.svelte` file produced in T020. Cannot run in parallel with Phase 3 implementation tasks. Tests for US2 (T023, T024) CAN be authored in parallel with T020 if the test file is in a separate spec slot, but the convention here is to amend the existing US1 spec — so even the test edits serialise after T017.
- **Phase 5 US3** — Depends on Phase 3 (same component file). Independent of Phase 4 in spec terms (TTL editing does not interact with per-row clearing) — both can in principle be worked on in parallel by separate developers IF they coordinate the `SettingsSheet.svelte` merge, but for a single-developer flow run them serially in priority order.
- **Phase 6 US4** — Depends on Phase 3 (same component file). Independent of Phase 4 / 5 in spec terms.
- **Phase 7 Polish** — Depends on all four story phases finishing (so screenshots, the ADR, and the bundle-size delta describe the final state).

### Story Independence

- US1 is the MVP — all of US2 / US3 / US4 are additive enhancements on top of the same `SettingsSheet.svelte` file. Each story phase produces a shippable + testable increment.
- US2 / US3 / US4 are mutually independent in user-value terms. Each can ship without the others (and the spec's per-story Independent Test verifies this) — but because they all extend the same component file, the implementation tasks within each phase serialise.
- The foundational modules (cachePolicy, cacheStats, cachePurge, preferences-v2) are written ONCE in Phase 2 with the full surface needed for ALL four stories. There is no "incremental cachePurge" — `enforceMaxEntries` ships in T012 even though it is not consumed until Phase 6, because it lives in the same module as the safety-critical `clearAllTileCaches` and the same TDD spec covers all five exports.

### Within Each User Story

- Tests MUST land RED before the implementation tasks they cover (Constitution Principle II + research D12).
- Inside each story phase the canonical order is: unit-test amendment → integration-test amendment → (E2E amendment if applicable) → component implementation → format/lint/test verification.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).

### Parallel Opportunities

- T001 / T002 / T003 — three i18n files touched by independent tasks; run in parallel.
- T005 / T006 / T007 / T008 / T009 — five test-or-helper files for foundational modules; all paths disjoint; run in parallel.
- T010 / T011 / T012 / T013 — four production-source files for foundational modules; all paths disjoint; run in parallel after their respective tests are RED. (T010 → T011 strictly: T011 imports `TileCacheName` from cachePolicy. T010 → T012 strictly: T012 imports `TILE_CACHE_NAMES`. T010 → T013 strictly: T013 imports the constants. So in practice T010 lands first then T011 / T012 / T013 in parallel.)
- T017 / T018 / T019 — three test files for US1; all paths disjoint; run in parallel.
- T037 / T038 / T039 / T040 — four polish-phase artefacts (UI doc, ADR, contrast spec, i18n parity + licence audit); all `[P]`.

### Within-Phase Strict Sequencing (NOT parallel)

- T020 (SettingsSheet US1 implementation) → T021 (App.svelte mount) → T022 (verification).
- T025 (US2 component amendment) → T026 (US2 verification). Depends on T023 + T024 being RED first.
- T030 (US3 component amendment) → T031 (US3 verification). Depends on T027 + T028 + T029 being RED first.
- T035 (US4 component amendment) → T036 (US4 verification). Depends on T032 + T033 + T034 being RED first.

---

## Parallel Example: Phase 2 Foundational tests-then-impl

```bash
# Round 1 — all RED-first tests + the test fake, in parallel:
Task: "Create tests/unit/pwa/cachePolicy.spec.ts (T005)"
Task: "Create tests/unit/helpers/cacheStorageFake.ts (T006)"
Task: "Create tests/unit/pwa/cacheStats.spec.ts (T007)"
Task: "Create tests/unit/pwa/cachePurge.spec.ts (T008)"
Task: "Create tests/unit/storage/preferences-v2.spec.ts (T009)"

# Round 2 — implementations after Round 1 is RED:
# T010 first (the others import its types):
Task: "Create src/pwa/cachePolicy.ts (T010)"

# Then in parallel:
Task: "Create src/pwa/cacheStats.ts (T011)"
Task: "Create src/pwa/cachePurge.ts (T012)"
Task: "Amend src/storage/preferences.ts to v2 (T013)"

# Then sequentially:
# T014 (vite.config.ts) → T015 (main.ts) → T016 (verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1 → STOP & VALIDATE per `quickstart.md` §"Smoke test" steps 1–4.
2. Field-test the sheet on a real Android device (touch tap on gear; verify `<dialog>` modal opens and is dismissable; verify "Clear all" confirmation is reachable by touch with no overlap from the system gesture bar).
3. Ship if the sheet opens within 150 ms and clear-all completes within 1.5 s on a populated cache.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready (constants, stats, purge, prefs v2 all live; workbox bakes the new ceilings; main.ts enforces on every cold start).
2. Add US1 → independent test → MVP demo (open + see + clear-all).
3. Add US2 → independent test → per-row clear ships.
4. Add US3 → independent test → TTL editing + persistence ships.
5. Add US4 → independent test → MaxEntries editing + persistence ships.
6. Phase 7 Polish → ADR + UI doc + contrast spec + licence-language audit + perf verification + manual smoke → merge-ready.

### Parallel Team Strategy

For a single-developer flow, run the four story phases serially in priority order. With multiple developers after Phase 2 completes:

- Developer A: Phase 3 US1 (T017–T022) — gets the MVP shipping.
- Developer B (after A's T020 lands): Phase 5 US3 (T027–T031) — TTL slice on top.
- Developer C (after A's T020 lands): Phase 6 US4 (T032–T036) — MaxEntries slice on top.
- Phase 4 US2 (T023–T026) is the cheapest follow-on — typically the same developer as US1 ships it as the next iteration.

All converge into Phase 7 Polish.

---

## Notes

- `[P]` tasks operate on disjoint files; verify before parallel-launching.
- `[Story]` label is REQUIRED on Phase 3 / 4 / 5 / 6 tasks and absent on Phase 1 / 2 / 7 tasks.
- Constitution Principle II is non-negotiable: every implementation task MUST follow at least one previously-failing test in the same story (or in the foundational phase for shared modules).
- Run `npm run format` after every code edit (Development Workflow).
- Update `docs/ui/` for visible UI changes — covered by T037.
- Update the ADR index after each `/speckit.analyze` and `/speckit.implement` — covered by T038.
- Persisted-schema invariants (ADR 0021): `pwa_map:lastView`, `pwa_map:gotoHistory_v1`, `pwa_map:offlineReadyShown`, `pwa_map:installDismissedUntil` are NOT modified by this feature; only `pwa_map:prefs` is touched, additively (v1 → v2 with two new optional fields).
- Locale-convention compliance: every new i18n key uses the existing `zh / en / ja` codes verbatim. No new locale identifier introduced. Taiwan terminology in `zh` (`使用者`, `檔案`) — NOT `用户` / `文件`.
- Licence-of-tile-data hard rules (FR-013, FR-014, FR-015, FR-021): enforced as
  (a) source-code surface — `cachePurge.ts` exports zero `prefetch` / `download` / `populate` symbols (research D8);
  (b) cache-name allowlist — `clearAllTileCaches` iterates `TILE_CACHE_NAMES` only (research D9);
  (c) UI string audit — T040's licence-language audit fails the build if any user-visible string outside `settings.licenceNotice` contains a "download" / "下載" / "ダウンロード" / "prefetch" / "離線地圖" substring;
  (d) ADR — T038 documents the rules so a future contributor cannot accidentally regress them without amending the ADR.
- Workbox precache (`workbox-precache-v2-*`) MUST stay bit-identical across every clear / purge / trim path. Verified in T008 case (1) and asserted manually in T042 step (a).
- Features 001–006 specs MUST keep passing — running them is part of T041.
- The mid-`/speckit.plan` scope addition of US4 (MaxEntries adjustable) is fully reflected in this task list — no follow-up amendment required.
