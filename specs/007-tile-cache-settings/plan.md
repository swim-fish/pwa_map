# Implementation Plan: Tile Cache Settings

**Branch**: `007-tile-cache-settings` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-tile-cache-settings/spec.md`

## Summary

Add a Settings sheet (a fourth toolbar button alongside Layers / Locale /
Format) that lets the user **inspect** and **release** the on-device map-
tile cache, and **adjust** the time-to-live (TTL) used to age cached
tiles out — without ever providing a "download a map" affordance, which
the upstream tile-source licences forbid.

Three reads, two writes:

1. **Inspect** (US1, P1) — open the sheet to see one row per tile
   source (OSM / NLSC / Google) with `entries / ceiling`, the current
   TTL, a rough origin-wide quota estimate, and a permanent licence
   notice.
2. **Clear all / per-source** (US1 + US2, P1 + P2) — destructive
   actions gated by a confirmation dialog; clearing operates on the
   three runtime tile caches only and never on the workbox precache
   (which holds the offline app shell).
3. **TTL** (US3, P3) — pick from a fixed preset list (1 / 3 / 7 / 14 /
   30 / 60 / 90 days); persist into the existing `pwa_map:prefs`
   localStorage record (schema bump v1 → v2, additive); on change,
   purge entries older than the new TTL by reading each cached
   `Response.headers.get('date')`.
4. **Per-cache MaxEntries** (US4, P3) — pick from a fixed preset list
   (256 / 512 / 1024 / 2048 / 4096 / 8192); persist alongside TTL in
   `pwa_map:prefs` v2; on change, trim each tile cache to the new
   limit by deleting the **oldest-first** keys (Cache API guarantees
   `cache.keys()` iterates in insertion order, which aligns with
   workbox's chronological write path).

Technical approach: keep TypeScript + Svelte 4 + Vite +
vite-plugin-pwa. **No new runtime dependency**. Build-time `workbox`
config in `vite.config.ts` is amended to lift BOTH per-cache
backstops to their user-selectable maxima — `maxAgeSeconds` to
**90 days** and `maxEntries` to **8192** — so the workbox
`ExpirationPlugin` becomes a passive ceiling and the *user-selected*
values are enforced by an app-level routine on app start + after
every TTL or limit edit. New code mirrors feature 005's
pattern (one Svelte sheet component + small storage / signal
modules + 21 string additions in three locales). Tests are TDD-first:
Vitest unit specs for the three new pure modules (`cachePolicy`,
`cacheStats`, `cachePurge`) + the `preferences` v1→v2 migration; Vitest
integration for the `SettingsSheet` and the confirm-dialog flow; one
Playwright E2E that opens the sheet, clears all, and asserts the
counts read zero on re-open.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target) — inherited from
features 001–006.

**Primary Dependencies**:

- `svelte` 4.x — UI framework. `SettingsSheet.svelte` reuses the
  modal-sheet visual language of `LocalePicker.svelte` and the
  destructive-action confirmation pattern from
  `goto/RecentChips.svelte`'s long-press delete dialog (feature 003).
- `vite-plugin-pwa` 0.20.x — already in use. Workbox config is amended
  to import `TILE_CACHE_MAX_AGE_DAYS_CEILING` from the new
  `src/pwa/cachePolicy.ts` module so the constant is the single source
  of truth.
- Standard browser APIs only: the global `caches` object (`Cache /
  CacheStorage` per Service Worker spec — supported on all PWA-target
  browsers), `navigator.storage.estimate()` (with a graceful fallback
  when undefined), `localStorage` (already used for the prefs record).
- **No new runtime deps. No new test deps.**

**Storage**:

- Read+write to `localStorage` key `pwa_map:prefs`. Schema bumps from
  v1 to v2, additively adding TWO fields: `tileTtlDays?: number` and
  `tileMaxEntries?: number`. The migration is forward-additive: a v1
  record reads as `tileTtlDays = 7` AND `tileMaxEntries = 4096` (the
  defaults); a v2 record persisted by an older app reads back fine
  because the existing v1 validator already drops unknown keys (it
  rebuilds a fresh object from validated fields). To keep the semver
  of `PREFS_VERSION` honest, the validator MUST accept BOTH `version: 1`
  (legacy) and `version: 2` (current) and only treat `tileTtlDays` /
  `tileMaxEntries` as authoritative when `version === 2`.
- Read+delete on the three Cache Storage namespaces: `osm-tiles`,
  `nlsc-tiles`, `google-tiles` (created by the `runtimeCaching` rules
  in `vite.config.ts`). NEVER touch `workbox-precache-v2-*` (the app
  shell — clearing it would hide the "ready offline" promise).

**Testing**: Vitest (unit + integration) + Playwright (E2E).

- Unit specs run in jsdom. The three new pure modules each accept an
  injected `caches`/`storage` parameter, so tests instantiate
  hand-rolled fakes (no `vi.mock` of platform globals required —
  follows the pattern of `tests/unit/storage/recents.spec.ts`).
- The `preferences` migration spec asserts: a v1 record returns
  `tileTtlDays = 7` AND `tileMaxEntries = 4096`; a v2 record's
  `tileTtlDays` and `tileMaxEntries` both round-trip; out-of-range
  values for either field are dropped (default applied).
- Integration specs mount `SettingsSheet.svelte` against fakes and
  assert: counts render; clear-all opens dialog; confirm clears all
  three; per-row clear clears only one row; TTL change triggers a
  purge; lowering the per-cache entry limit triggers an oldest-first
  trim that respects the new cap exactly; reduced-motion CSS rules
  don't break the layout.
- E2E (Playwright, Chromium) drives `tests/e2e/story-7-settings.spec.ts`:
  open sheet, clear-all → confirm → re-render shows zeros, TTL change
  persists across page reload, per-cache entry-limit change persists
  across page reload.

**Target Platform**: Same as features 001–006 — Chromium (desktop +
Android) 120+, WebKit / iOS Safari 15+, Firefox 120+ desktop, Firefox
Android. The `caches` and `navigator.storage.estimate` APIs are
available on all five; the graceful-degrade path (FR-016) covers
private-mode Safari which exposes `caches` but throws on write.

**Project Type**: Single project — extension of the existing PWA. No
new package boundary, no new top-level directory.

**Performance Goals** — explicit budgets per Constitution Principle IV:

- **Open the sheet** (entry counts + quota estimate visible): p95 <
  150 ms on a representative mid-range mobile device (SC-004). Counts
  use `(await caches.open(name)).keys().length` which is a single
  IndexedDB-backed read per cache; quota uses
  `navigator.storage.estimate()` (a single async call).
- **Clear one cache at the per-cache ceiling (4096 entries)**: p95 <
  500 ms; main-thread is yielded every ≥ 256 deletions via
  `await new Promise((r) => setTimeout(r, 0))` so scrolling stays
  smooth (SC-005 derivative).
- **Clear all three caches**: p95 < 1.5 s (SC-005).
- **TTL edit → purge complete**: p95 < 800 ms when ≤ 25 % of entries
  are aged out; never blocks the main thread > 50 ms continuously.
- **Per-cache entry-limit reduction → trim complete**: p95 < 500 ms
  when trimming a 8192-entry cache down to 256 (i.e., deleting up to
  ~7900 keys); never blocks the main thread > 50 ms continuously.
- **Bundle delta** for this feature on the entry JS bundle: ≤ 4 KB
  gzipped. Verified by `scripts/check-bundle-size.js` (the
  baseline-vs-current delta gate added in feature 005's analyze
  remediation).

**Constraints**:

- WCAG AA contrast (Principle III + ADR 0014) — the sheet, its
  destructive buttons, and the confirmation dialog MUST hit ≥ 4.5:1
  in light AND dark schemes, reusing the established `--color-*`
  tokens (no new colour value). Destructive actions get a
  `--color-danger-*` token; we'll either reuse the existing copy of it
  (`tests/integration/controls-contrast.spec.ts` knows where it lives)
  or add it to `tokens.css` if absent.
- Tap targets ≥ 36 × 36 px (SC-005 + ADR 0014).
- Locale conventions: every new i18n key uses `zh / en / ja` only.
- Reduced-motion compliance — sheet open / close uses the same
  `transform/opacity` pattern as `InstallBanner.svelte` (feature 005),
  with the same `@media (prefers-reduced-motion: reduce)` skip.
- Layout non-conflict — the new toolbar gear button MUST sit inside
  the existing top-right toolbar group (alongside Go-to / Format /
  Layers / Locale) and follow the same `--toolbar-*` spacing tokens.
  The sheet itself opens from the toolbar anchor and follows the same
  z-index ordering as `LocalePicker`.
- **Licence-of-tile-data hard rules** (FR-013, FR-014, FR-015, FR-021,
  SC-006):
  - No UI affordance, anywhere in the codebase, that batch-fetches,
    pre-fetches, or exports tiles. The `cachePurge` and `cacheStats`
    modules export *only* `clearCache`, `clearAllTileCaches`,
    `purgeExpired`, `enforceMaxEntries`, `countCacheEntries`,
    `estimateQuota` — no `prefetch*`, no `download*`, no `export*`
    symbols. Raising the per-cache entry limit MUST NOT proactively
    fetch any tile.
  - The clear paths target ONLY the three named tile caches. The
    workbox precache name (`workbox-precache-v2-*`) is explicitly
    excluded by string-prefix check inside `clearAllTileCaches` (and
    documented at the call site).
  - All UI strings frame the cache as a "performance / temporary
    fallback" — no string contains "download" / "下載" / "ダウンロード"
    in user-visible copy. Verified by an `i18n-keys-parity` test
    extension.

**Scale/Scope**:

- **1 new component**: `src/components/SettingsSheet.svelte`.
- **3 new pure modules**: `src/pwa/cachePolicy.ts`,
  `src/pwa/cacheStats.ts`, `src/pwa/cachePurge.ts` (the last one
  exports both `purgeExpired` and `enforceMaxEntries`).
- **1 amended module**: `src/storage/preferences.ts` (v1→v2 schema +
  `loadTileTtlDays` / `saveTileTtlDays` /
  `loadTileMaxEntries` / `saveTileMaxEntries` helpers).
- **1 amended config**: `vite.config.ts` (workbox `maxAgeSeconds`
  reads `TILE_CACHE_MAX_AGE_DAYS_CEILING * 86400` from cachePolicy;
  workbox `maxEntries` reads `TILE_CACHE_MAX_ENTRIES_CEILING` from
  the same module).
- **1 amended module**: `src/app/main.ts` (calls a new
  `enforceCachePolicy()` from cachePurge, fire-and-forget, after
  `registerSW()`; that helper does both expiration and max-entries
  enforcement in one pass).
- **1 amended module**: `src/app/App.svelte` (mount the gear button
  + sheet).
- **~26 new i18n keys** under `settings.*` × 3 locales.
- **1 new ADR** (ADR 0027 — "Tile cache settings: TTL and per-cache
  entry limit both adjustable; workbox bakes in user-selectable
  ceilings; app-level enforcement (purgeExpired + enforceMaxEntries)
  is the active enforcer; the workbox precache is never touched and
  no download affordance is offered."), and **1 new UI record**
  (`docs/ui/0007-settings-tile-cache.md`).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                       | Verdict     | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Code Quality & Formatting**                | PASS        | All new files (TS + Svelte) ride the existing Prettier + ESLint flat config. `npm run format` mandatory after edits per Development Workflow. No new linter rule, no new style. The three new pure modules export named functions only — no default exports, no classes (consistent with the rest of `src/pwa/*`).                                                                                                                                                       |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | Each user story has explicit failing-tests-first slots in Phase-2 tasks: unit (`cachePolicy`, `cacheStats`, `cachePurge` covering both `purgeExpired` and `enforceMaxEntries`, `preferences-v2`), integration (`SettingsSheet` mount, dialog flow, per-row clear, TTL purge, max-entries trim), E2E (`story-7-settings`). Two safety properties land their unit tests BEFORE implementation: (a) `clearAllTileCaches` MUST NOT delete `workbox-precache-v2-*`; (b) `enforceMaxEntries(cap)` MUST leave the most recently inserted `cap` keys intact and MUST delete the older surplus oldest-first.                                                                              |
| **III. User Experience Consistency**            | PASS w/ doc | Two visible UI surfaces (toolbar gear + modal sheet). New `docs/ui/0007-settings-tile-cache.md` mandatory before merge. Tokens reused; if a `--color-danger-*` token is absent, it is added to `tokens.css` (one-line addition tracked in the UI doc). Sheet honours `prefers-reduced-motion: reduce`. Tap targets ≥ 36 × 36 px. WCAG AA contrast verified via the same source-token pattern as feature 005's `tests/integration/install-contrast.spec.ts`.                |
| **IV. Performance Requirements**                | PASS        | Six explicit budgets in **Performance Goals**: SC-004 (open < 150 ms), SC-005 (clear-all < 1.5 s), TTL-edit purge < 800 ms, max-entries trim < 500 ms, no main-thread block > 50 ms, bundle delta ≤ 4 KB gzipped. All measurable: integration tests for the open / clear / trim paths via wall-clock; bundle-size gate from feature 005.                                                                                                                                                                |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0027 (cache settings: adjustable TTL, read-only ceiling, app-level purge, no precache touch, no download affordance). The licence-of-tile-data prohibition is encoded both in the ADR and as a SC (SC-006) so future contributors cannot accidentally regress it. The ADR index updated post-implement. The `docs/ui/0007-settings-tile-cache.md` UI record covers Principle III. No existing ADR is superseded; ADR 0021 (additive prefs) is *extended* — the v2 bump is its first usage. |

**Locale convention compliance** — every new i18n key uses the existing
`zh / en / ja` locales verbatim under the new `settings.*` namespace.
No new locale identifier introduced; `tileTtlDays` is a numeric field
(no locale-specific formatting needed beyond the localised `"days"`
unit string).

**Result**: All five principles pass on the planned design. No
unjustified violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-tile-cache-settings/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output
├── contracts/
│   ├── cache-policy.md                    # cachePolicy module surface
│   ├── cache-stats.md                     # cacheStats module surface
│   ├── cache-purge.md                     # cachePurge module surface (the destructive one)
│   ├── preferences-v2.md                  # preferences.ts v1→v2 amendment
│   └── settings-sheet.md                  # SettingsSheet.svelte UI contract
├── checklists/
│   └── requirements.md                    # /speckit.specify output (already exists)
└── tasks.md                               # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   ├── App.svelte                         # AMENDED — mount gear button + SettingsSheet
│   └── main.ts                            # AMENDED — call enforceCachePolicy() post registerSW()
├── components/
│   └── SettingsSheet.svelte               # NEW — sheet with 3 cache rows + TTL select + max-entries select + clear buttons
├── pwa/
│   ├── cachePolicy.ts                     # NEW — TILE_CACHE_NAMES, ceilings, defaults, TTL_OPTIONS, MAX_ENTRIES_OPTIONS
│   ├── cacheStats.ts                      # NEW — countCacheEntries, estimateQuota
│   └── cachePurge.ts                      # NEW — clearCache, clearAllTileCaches, purgeExpired, enforceMaxEntries, enforceCachePolicy
├── storage/
│   └── preferences.ts                     # AMENDED — v2 schema + tileTtlDays + tileMaxEntries + load/save helpers
└── i18n/
    ├── zh.json                            # AMENDED — settings.* keys
    ├── en.json                            # AMENDED — same keys
    └── ja.json                            # AMENDED — same keys

vite.config.ts                             # AMENDED — workbox maxAgeSeconds + maxEntries read from cachePolicy

tests/
├── unit/
│   ├── pwa/
│   │   ├── cachePolicy.spec.ts            # NEW — constants + invariants
│   │   ├── cacheStats.spec.ts             # NEW — count / estimate against fake CacheStorage
│   │   └── cachePurge.spec.ts             # NEW — clear / purgeExpired against fake CacheStorage; precache untouched
│   ├── storage/
│   │   └── preferences-v2.spec.ts         # NEW — v1→v2 migration round-trip; out-of-range drops
│   └── components/
│       └── SettingsSheet.spec.ts          # NEW — render + clear flow + TTL change
├── integration/
│   └── settings-clear-cache.spec.ts       # NEW — full sheet flow including dialog
└── e2e/
    └── story-7-settings.spec.ts           # NEW — open / clear / TTL persists across reload

docs/
├── ui/
│   └── 0007-settings-tile-cache.md        # NEW — UI record per Principle III
└── adr/
    └── 0027-tile-cache-settings.md        # NEW — TTL/maxEntries split + purge approach + licence rules
```

**Structure Decision**: Single-project layout (Option 1) — same as
features 001–006. No new package boundaries, no new top-level
directories. Each new file lives next to existing peers (`src/pwa/*`
already hosts `registerSW.ts` / `installSignal.ts` / `updateSignal.ts`;
`src/storage/preferences.ts` is amended in place; `src/components/*`
gains one new sibling; tests mirror the source tree under
`tests/unit/`, `tests/integration/`, `tests/e2e/`).

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | (none)     | (none)                               |
