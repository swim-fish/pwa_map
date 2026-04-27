# Quickstart: Tile Cache Settings

**Feature**: `007-tile-cache-settings` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This is the orientation doc for an engineer implementing or
reviewing feature 007. Read [plan.md](./plan.md) and
[research.md](./research.md) first.

## TL;DR

```
Toolbar: [Go-to] [Format] [Layers] [Locale] [⚙ Settings (NEW)]
                                              │
                                              ▼
                                      ┌──────────────────────────────────┐
                                      │   <dialog> Settings              │
                                      │   ┌────────────────────────────┐ │
                                      │   │ ⚠ licence notice (always)  │ │
                                      │   └────────────────────────────┘ │
                                      │   OSM   123 / 4096   [Clear]     │
                                      │   NLSC   45 / 4096   [Clear]     │
                                      │   Google  0 / 4096   [Clear]     │
                                      │   ≈ 12.3 MB browser storage      │
                                      │   TTL: [7 days ▾]                │
                                      │   Per-source limit: [4096 ▾]     │
                                      │   [ Clear all map tile cache ]   │
                                      └──────────────────────────────────┘
```

## Run the dev server

```bash
npm install
npm run dev
# open http://localhost:5173
```

The Service Worker does NOT register in dev mode (see
`src/pwa/registerSW.ts` — early `return` if `import.meta.env.DEV`).
To exercise the cache-population path you need a production build:

```bash
npm run build
npm run preview
# open http://localhost:4173, accept SW registration
```

## Run the test suites

```bash
# Vitest unit + integration
npm test

# Playwright E2E (requires built+previewed app)
npm run test:e2e

# Bench (no new bench in this feature, but inherits the gate)
npm run bench

# Bundle-size check (the 4-KB delta gate)
npm run bundle-size
```

## Iteration order (TDD discipline)

Follow research D12. Concrete sequence:

1. **`tests/unit/pwa/cachePolicy.spec.ts`** — write all 9 INV
   assertions. Run `npm test`. Should be RED ("module not found").
2. Create `src/pwa/cachePolicy.ts` with the constant exports. Tests
   go GREEN.

3. **`tests/unit/helpers/cacheStorageFake.ts`** — write the fake
   first (it has no production analogue, no spec to follow).
4. **`tests/unit/pwa/cacheStats.spec.ts`** — 9 tests per
   `contracts/cache-stats.md` §6. RED.
5. Implement `src/pwa/cacheStats.ts`. GREEN.

6. **`tests/unit/pwa/cachePurge.spec.ts`** — 14 tests per
   `contracts/cache-purge.md` §9. The two safety properties (D9 +
   D11) MUST be in the first batch you write. RED.
7. Implement `src/pwa/cachePurge.ts`. GREEN.

8. **`tests/unit/storage/preferences-v2.spec.ts`** — 11 tests per
   `contracts/preferences-v2.md` §8. RED (because the v1 validator
   still rejects the v2 fields).
9. Amend `src/storage/preferences.ts` per the contract. GREEN.

10. **`vite.config.ts`** — replace the literal `7 * 24 * 60 * 60`
    and `4096` with imports from `cachePolicy`. Verify
    `npm run build` produces an SW that bakes 90-day +
    8192-entry ceilings.

11. **`src/app/main.ts`** — add the `enforceCachePolicy(...)`
    fire-and-forget call after `registerSW()`.

12. **`tests/unit/components/SettingsSheet.spec.ts`** — 18 tests
    per `contracts/settings-sheet.md` §6. RED.
13. Implement `src/components/SettingsSheet.svelte`. GREEN.

14. **i18n** — add the 26 new keys × 3 locales. Run
    `tests/unit/i18n/controls-keys-parity.spec.ts` (or extend it to
    cover the new namespace). GREEN.

15. **`src/app/App.svelte`** — mount the gear button + sheet.

16. **`tests/integration/settings-clear-cache.spec.ts`** — 3 tests
    per `contracts/settings-sheet.md` §6 #19–21. GREEN.

17. **`tests/e2e/story-7-settings.spec.ts`** — 4 scenarios:
    - Open → see three rows + licence notice.
    - Clear-all → confirm → rows go to zero.
    - TTL change → reload → TTL still set.
    - Max-entries change → reload → max-entries still set.

18. **Documentation** — write `docs/ui/0007-settings-tile-cache.md`
    and `docs/adr/0027-tile-cache-settings.md`. Update
    `docs/adr/README.md` and `docs/ui/README.md` indexes.

19. **Final gates** —
    `npm run format && npm run lint && npm test && npm run test:e2e
    && npm run bundle-size`. All green ⇒ ready for `/speckit.analyze`.

## Files cheat sheet

| Path                                                 | Status   | Purpose                                                                           |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `src/pwa/cachePolicy.ts`                             | NEW      | Constants, types — single source of truth.                                         |
| `src/pwa/cacheStats.ts`                              | NEW      | Read-only inspection (`countCacheEntries`, `estimateQuota`).                       |
| `src/pwa/cachePurge.ts`                              | NEW      | Destructive ops (`clearCache`, `clearAllTileCaches`, `purgeExpired`, `enforceMaxEntries`, `enforceCachePolicy`). |
| `src/storage/preferences.ts`                         | AMENDED  | v1→v2 schema bump with two additive fields.                                        |
| `src/components/SettingsSheet.svelte`                | NEW      | Modal sheet UI.                                                                    |
| `src/app/App.svelte`                                 | AMENDED  | Mount toolbar gear button + sheet.                                                 |
| `src/app/main.ts`                                    | AMENDED  | Call `enforceCachePolicy(...)` post `registerSW()`.                                |
| `src/i18n/{zh,en,ja}.json`                           | AMENDED  | 26 new `settings.*` keys per locale.                                               |
| `vite.config.ts`                                     | AMENDED  | Workbox `maxAgeSeconds` + `maxEntries` come from `cachePolicy`.                    |
| `tests/unit/helpers/cacheStorageFake.ts`             | NEW      | Test double for `CacheStorage` + `Cache`.                                          |
| `tests/unit/pwa/cachePolicy.spec.ts`                 | NEW      | 9 INV tests + the precache exclusion test.                                          |
| `tests/unit/pwa/cacheStats.spec.ts`                  | NEW      | 9 tests per the contract.                                                          |
| `tests/unit/pwa/cachePurge.spec.ts`                  | NEW      | 14 tests per the contract; the two safety properties land first.                   |
| `tests/unit/storage/preferences-v2.spec.ts`          | NEW      | 11 migration / round-trip tests.                                                    |
| `tests/unit/components/SettingsSheet.spec.ts`        | NEW      | 18 component tests.                                                                |
| `tests/integration/settings-clear-cache.spec.ts`     | NEW      | 3 cross-module flow tests.                                                          |
| `tests/e2e/story-7-settings.spec.ts`                 | NEW      | 4 user-flow scenarios.                                                              |
| `docs/ui/0007-settings-tile-cache.md`                | NEW      | UI record per Principle III.                                                       |
| `docs/adr/0027-tile-cache-settings.md`               | NEW      | ADR per Principle V.                                                               |

## Tripwires (what NOT to do)

- ❌ **Do NOT** call `caches.delete('osm-tiles')` (whole-namespace
  delete) — use `clearCache('osm-tiles')` which iterates per-entry.
  See `contracts/cache-purge.md` §2.
- ❌ **Do NOT** iterate `caches.keys()` to find what to clear — use
  the fixed `TILE_CACHE_NAMES` allowlist. The precache uses a name
  that starts with `workbox-precache-v2-`; iterating `keys()` would
  reach it.
- ❌ **Do NOT** add a "Refresh tile cache" / "Pre-fetch this region"
  / "Download for offline" affordance under any name. The licence
  rule (FR-013, FR-021) is the load-bearing scope discipline of this
  feature; SC-006's audit will catch a regression.
- ❌ **Do NOT** sort `cache.keys()` by `Response.date` for
  `enforceMaxEntries` — that's the perf-cliff alternative explicitly
  rejected in research D11. Insertion-order delete is the design.
- ❌ **Do NOT** block the main thread > 50 ms — the
  `await new Promise(r => setTimeout(r, 0))` yield every 256
  deletions is mandatory.
- ❌ **Do NOT** use `window.confirm()` for the destructive
  confirmation — use the `<dialog>` pattern (research D6).
- ❌ **Do NOT** add a free-form numeric input for TTL or max-entries
  — the preset `<select>` lists are the design (research D4 + D11).
- ❌ **Do NOT** introduce a new locale identifier (e.g. `zh-TW`,
  `zh-Hant`). The project uses `zh` only.

## Smoke test (manual)

After all the above is green:

1. `npm run build && npm run preview`. Open
   `http://localhost:4173`.
2. Pan the map across NLSC and Google layers to populate two
   caches.
3. Tap the new gear button. Sheet should open showing three rows,
   the licence notice at top, and a non-zero quota estimate.
4. Tap "Clear all map tile cache" → confirmation dialog appears →
   tap "Clear". Rows redraw with zeros; status banner reads "All
   tile caches cleared"; quota estimate decreases.
5. Change TTL to 1 day. Status banner reports "TTL updated to 1
   day; 0 expired entries removed" (no entries are old enough yet).
6. Reload the page. Reopen Settings. TTL is still 1 day.
7. Change Per-source limit to 256. Status banner reports the
   trim count.
8. Reload. Reopen Settings. Per-source limit is still 256.
9. Use DevTools → Application → Cache Storage. Verify the three
   tile caches respect the 256 cap. Verify
   `workbox-precache-v2-*` is **untouched**.

## Where to look for prior art

- The dialog / confirmation pattern is established in
  `src/components/goto/RecentChips.svelte` (long-press delete).
- The toolbar-button pattern is established in
  `src/components/LocalePicker.svelte` (`{#if open}` + outside-
  click + Escape close).
- The `pwa_map:prefs` schema-bump pattern is documented in
  ADR 0021 (additive prefs evolution).
- The licence-content-scoping and "no download" discipline mirrors
  feature 003's NLSC ADR 0020 (map-source catalogue), which
  similarly forbade certain operations on tile data.
- The reduced-motion CSS pattern is established in feature 005's
  `InstallBanner.svelte` and feature 006's `Compass.svelte`.
