# ADR 0027 — Tile Cache Settings: adjustable TTL + MaxEntries, app-level enforcement, no download affordance

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/007-tile-cache-settings/`
**Supersedes**: —
**Extends**: ADR 0021 (`pwa_map:prefs` additive schema evolution) — this
ADR is the first v2 bump under that policy.

## Context

Features 001–006 accumulate tile data into three browser `Cache`
namespaces (`osm-tiles`, `nlsc-tiles`, `google-tiles`) via the
vite-plugin-pwa / Workbox `runtimeCaching` `StaleWhileRevalidate`
rules. Until feature 007 the user had no in-app way to inspect,
release, or shape those caches. The licences for the upstream tile
sources (OpenStreetMap, NLSC, Google) explicitly forbid bulk
download, area export, and redistribution.

Two design forces are in tension:

1. **User control over device storage** — privacy and disk-usage
   considerations argue for letting the user adjust TTL and per-cache
   entry count.
2. **Tile-source licence compliance** — these levers must NOT become
   indirect "download a region" features.

## Decision

Land a four-part design that respects both forces:

### Part 1 — Both TTL and MaxEntries are user-adjustable; the workbox config bakes the user-selectable maxima as passive backstops

`vite.config.ts` imports `TILE_CACHE_MAX_AGE_DAYS_CEILING` (= 90) and
`TILE_CACHE_MAX_ENTRIES_CEILING` (= 8192) from `src/pwa/cachePolicy.ts`
and passes them to the workbox `expiration` plugin for each of the
three runtime-cache rules. These are the maxima a user can pick from
the preset lists.

The user's _actual_ choice (e.g., TTL = 7 days, MaxEntries = 4096) is
persisted in the `pwa_map:prefs` v2 record as `tileTtlDays` /
`tileMaxEntries`. App-level enforcement (`enforceCachePolicy()` in
`src/pwa/cachePurge.ts`) runs on every app start (via `main.ts`,
fire-and-forget after `registerSW()`) and on every TTL or MaxEntries
edit (synchronously from the change handler in `SettingsSheet.svelte`).
This routine fans out across the three caches: per cache it runs
`purgeExpired(name, ttlDays, now)` then `enforceMaxEntries(name, cap)`.

`purgeExpired` reads each entry's `Response.headers.get('date')` and
deletes anything older than the user-selected TTL. Entries with a
missing or unparseable date header are deleted (conservative
fallback).

`enforceMaxEntries` walks `cache.keys()` (which the Cache API spec
guarantees iterates in **insertion order** = oldest writes first,
aligning with workbox's chronological write path) and deletes the
front `(keys.length - cap)` entries.

### Part 2 — Two preset lists, no free-form input

- `TTL_OPTIONS = [1, 3, 7, 14, 30, 60, 90]` days.
- `MAX_ENTRIES_OPTIONS = [256, 512, 1024, 2048, 4096, 8192]` (powers
  of two from a usable single-screen radius up to the workbox-
  documented ceiling).

Both rendered as `<select>` widgets — single tab stop, native
screen-reader behaviour, exhaustively testable choice space.

### Part 3 — Safety boundary: `clearAllTileCaches` iterates the fixed `TILE_CACHE_NAMES` allowlist

`clearAllTileCaches` MUST NOT call `storage.keys()` or any other
cache-name discovery API. It iterates the three-element allowlist
exported from `cachePolicy` and calls `clearCache(name)` for each.
This guarantees the workbox precache (named `workbox-precache-v2-*` —
the offline app shell from feature 004) is bit-identical before/after
any clear. A dedicated unit test
(`tests/unit/pwa/cachePurge.spec.ts` case 1) seeds a fake storage
with the precache and asserts post-clear the precache is untouched.

`clearCache` similarly uses per-entry `cache.delete(req)` rather than
`storage.delete(name)` (whole-namespace delete), to avoid the
secondary risk that workbox might recreate the cache without our
expiration config on the next fetch.

### Part 4 — Hard prohibition on any "download" affordance

The licence requirement that no bulk-download / area-export /
prefetch capability exists is enforced four ways:

a. **Source surface** — `cachePurge.ts` exports zero symbols
matching `prefetch` / `download` / `populate` / `export`. Only
`clearCache` / `clearAllTileCaches` / `purgeExpired` /
`enforceMaxEntries` / `enforceCachePolicy` are callable from
the rest of the app.

b. **Cache-name allowlist** — the safety property in Part 3 above.

c. **i18n string audit** — `tests/unit/i18n/settings-keys-parity.spec.ts`
fails the build if any `settings.*` value (excluding
`settings.licenceNotice` itself, which uses negation phrasing)
contains the substrings `下載` / `download` / `ダウンロード` /
`prefetch` / `離線地圖` / `offline map`. The licence notice is
whitelisted because the negation form is the load-bearing UI
communication.

d. **Constitution-grade ADR + UI doc** — this ADR + the
`docs/ui/0007-settings-tile-cache.md` UI record document the
prohibition so a future contributor would have to amend both
to add such a feature.

## Consequences

### Positive

- The user has direct control over device storage usage, in line with
  the spec's stated user value.
- The same constants that drive the runtime SW behaviour drive the UI
  display — they cannot drift out of sync.
- The safety property "the precache is never touched" is encoded as a
  test, not just convention. A regression here would cause the app
  to lose offline-launch capability silently; the test catches it.
- The four-layer prohibition on download-style features means a
  future PR adding such a feature would have to cross at least two of
  the layers visibly, making the licence-rule violation hard to miss
  in review.
- The schema migration is purely additive: a v1 record from a
  pre-007 build loads as `tileTtlDays = 7, tileMaxEntries = 4096` (the
  defaults); a v2 record loaded by a pre-007 build silently drops the
  v2-only fields (the existing v1 validator already rebuilds from
  validated fields and ignores unknown keys). Either rollback works.

### Negative / cost

- The split between "workbox bakes the maxima" + "app-level routine
  enforces the user's choice" is non-obvious until you understand
  that workbox config is build-time-baked. New contributors will
  reach for `setMaxAgeSeconds(...)` or similar at runtime; this ADR
  and the `cachePolicy.ts` doc comment are the explanations they
  will find.
- The `cache.keys()` insertion-order assumption is correct per spec
  but subtly weakened by partial deletes — a `purgeExpired` cycle
  followed by a refresh that re-inserts entries leaves "holes" in
  the iteration order. For the purpose of "trim near the cap" this
  is immaterial (research D11) but it deserves the explicit caveat
  here.
- Bundle delta for the feature was **+5.56 KB gzipped** vs. the
  original 4 KB plan budget. The plan was amended to ≤ 6 KB after
  the mid-plan US4 scope addition (MaxEntries adjustability — second
  `<select>`, second status template, +4 i18n keys × 3 locales).
  Total entry JS: ≈ 95 KB out of the 200 KB absolute budget.

### Neutral

- The tile-cache TTL is independent of the `Date` header semantics
  in the response. This is correct: TTL means "how long has this
  entry been on the device", which is closer to the response's
  `Date` (when the server sent it) than to `Last-Modified` (when
  the underlying tile was last edited, which can be years ago).

## Alternatives considered

1. **Re-build the SW with new `maxAgeSeconds` / `maxEntries` on every
   edit** — Workbox config is build-time-baked; runtime change
   requires regenerating + re-installing the SW, including a
   message-channel from page → SW for the edit. Far more complex than
   the value justifies.

2. **Use IndexedDB to track per-entry write timestamps** — workbox's
   own ExpirationPlugin already does this via the
   `workbox-expiration` IDB store, but reading it from page context
   couples us to workbox internals. The `Response.headers.get('date')`
   is a public, stable contract.

3. **Offer "download an area for offline use"** — REJECTED. Forbidden
   by all three upstream tile-source licences (OSM, NLSC, Google).
   Outside the spec's scope; explicitly disallowed in FR-013 + FR-021
   - SC-006.

4. **Skip per-row clear; only clear-all** — would simplify the UI by
   one button per row, but loses the "I only use Google in practice
   and want to keep my recently-cached OSM trip tiles" use case
   without enough savings to justify (US2).

5. **Free-form numeric inputs for TTL / MaxEntries** — REJECTED. The
   value space is too large to test exhaustively, the workbox
   ceiling acts as a hard upper bound regardless, and the preset
   `<select>` approach makes the UI self-describing on small screens.

6. **Use `window.confirm()` for destructive-action confirmation** —
   REJECTED. Blocks the JS event loop, breaks the concurrent-purge
   architecture, browser-controlled appearance is inconsistent
   across our targets, and cannot be localised within our i18n
   framework.

7. **Sort by date header before deleting in `enforceMaxEntries`** —
   REJECTED. Worst-case 8192 × 1 ms `cache.match` calls = ~8 seconds
   wall-clock, far over the 500 ms p95 budget. Insertion-order
   iteration is the workable approximation.

## References

- spec: `specs/007-tile-cache-settings/spec.md`
- plan: `specs/007-tile-cache-settings/plan.md`
- research: `specs/007-tile-cache-settings/research.md`
  (decisions D1, D2, D7, D9, D11, D12 are the load-bearing ones for
  this ADR)
- contracts:
  `specs/007-tile-cache-settings/contracts/{cache-policy,cache-purge,preferences-v2,settings-sheet}.md`
- UI record: `docs/ui/0007-settings-tile-cache.md`
- ADR 0021: `pwa_map:prefs` additive schema evolution (extended by
  this v2 bump)
- ADR 0023: SW registration strategy (`registerSW()` is what we
  call before `enforceCachePolicy()` in `main.ts`)
