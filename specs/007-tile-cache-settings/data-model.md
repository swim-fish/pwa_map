# Phase 1 Data Model: Tile Cache Settings

**Feature**: `007-tile-cache-settings` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature touches **one persisted shape** (extending the existing
`pwa_map:prefs` localStorage record from v1 to v2 with two additive
fields) and introduces **four transient in-memory shapes** (cache
policy constants, cache stats per source, the destructive-action
target descriptor, and the confirmation-dialog state). Every shape is
read-only by convention (`readonly` modifiers throughout).

---

## §1. `FormatPreferencesV2` (persisted, localStorage `pwa_map:prefs`)

**Owner**: `src/storage/preferences.ts` (extended in place — no new
storage key).

**Lifecycle**: created with defaults on first launch (or whenever
`localStorage` returns `null` for the key); replaced wholesale by
`savePreferences(...)`; never mutated in place.

```ts
import type { TtlDays, TileMaxEntries } from '$pwa/cachePolicy';

export interface FormatPreferencesV2 {
  readonly version: 2;

  // === inherited from v1 (unchanged) ===
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;

  // === new in v2 ===
  readonly tileTtlDays: TtlDays;          // [1, 3, 7, 14, 30, 60, 90]
  readonly tileMaxEntries: TileMaxEntries; // [256, 512, 1024, 2048, 4096, 8192]
}

export type FormatPreferences = FormatPreferencesV2;
```

**Validator behaviour** (per research D7):

| Input shape                           | Returns                                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `null` / not in storage                | `defaultPreferences()` — fresh object, version `2`, `tileTtlDays: 7`, `tileMaxEntries: 4096`.                                                                                                                                                          |
| `{ version: 1, ... v1 fields ... }`   | Object reconstructed with all v1 fields validated as before, `version: 2`, `tileTtlDays: 7`, `tileMaxEntries: 4096`.                                                                                                                                   |
| `{ version: 2, ..., tileTtlDays: 7, tileMaxEntries: 4096 }` | Round-tripped exactly.                                                                                                                                                                                                                                  |
| `{ version: 2, ..., tileTtlDays: 999, ... }` | `tileTtlDays` reset to `7` (default); other fields preserved.                                                                                                                                                                                          |
| `{ version: 2, ..., tileMaxEntries: 9999, ... }` | `tileMaxEntries` reset to `4096` (default); other fields preserved.                                                                                                                                                                                    |
| `{ version: 3, ... }` (future)        | `null` from validator → caller falls back to `defaultPreferences()`.                                                                                                                                                                                   |

**Invariants**:

- `tileTtlDays ∈ TTL_OPTIONS` (one of the seven preset values)
  whenever the value is read back from `loadPreferences()`.
- `tileMaxEntries ∈ MAX_ENTRIES_OPTIONS` (one of the six preset
  values) whenever the value is read back.
- `version === 2` for every record `savePreferences` writes.
- A stored record is forward-compatible: removing the v2-only fields
  must yield a valid v1 record (both fields ARE strictly additive,
  no v1 fields' meaning has changed).

---

## §2. `cachePolicy` constants (compile-time, source-of-truth)

**Owner**: `src/pwa/cachePolicy.ts` (NEW).

**Lifecycle**: module-level `const` exports; never mutated; consumed
by `vite.config.ts` (build-time), `cachePurge`, `cacheStats`,
`preferences.ts` (runtime), and `SettingsSheet.svelte` (render).

```ts
export const TILE_CACHE_NAMES = Object.freeze([
  'osm-tiles',
  'nlsc-tiles',
  'google-tiles',
] as const);

export type TileCacheName = (typeof TILE_CACHE_NAMES)[number];

export const TTL_OPTIONS = Object.freeze([1, 3, 7, 14, 30, 60, 90] as const);
export type TtlDays = (typeof TTL_OPTIONS)[number];

export const MAX_ENTRIES_OPTIONS = Object.freeze([256, 512, 1024, 2048, 4096, 8192] as const);
export type TileMaxEntries = (typeof MAX_ENTRIES_OPTIONS)[number];

export const DEFAULT_TILE_TTL_DAYS: TtlDays = 7;
export const DEFAULT_TILE_MAX_ENTRIES: TileMaxEntries = 4096;

/** Workbox bakes this as runtimeCaching.options.expiration.maxAgeSeconds. */
export const TILE_CACHE_MAX_AGE_DAYS_CEILING: 90 = 90;
/** Workbox bakes this as runtimeCaching.options.expiration.maxEntries. */
export const TILE_CACHE_MAX_ENTRIES_CEILING: 8192 = 8192;

/** Source-label key per cache, looked up via the i18n catalogue. */
export const SOURCE_LABEL_KEY: Readonly<Record<TileCacheName, string>> =
  Object.freeze({
    'osm-tiles': 'settings.cache.source.osm',
    'nlsc-tiles': 'settings.cache.source.nlsc',
    'google-tiles': 'settings.cache.source.google',
  });
```

**Invariants**:

- `TILE_CACHE_NAMES` order is stable and is the order rendered in the
  Settings sheet (OSM, NLSC, Google — alphabetical-by-attribution).
- `DEFAULT_TILE_TTL_DAYS ∈ TTL_OPTIONS` always.
- `DEFAULT_TILE_MAX_ENTRIES ∈ MAX_ENTRIES_OPTIONS` always.
- `TILE_CACHE_MAX_AGE_DAYS_CEILING === max(TTL_OPTIONS)`.
- `TILE_CACHE_MAX_ENTRIES_CEILING === max(MAX_ENTRIES_OPTIONS)`.
- A unit test (`tests/unit/pwa/cachePolicy.spec.ts`) asserts each of
  the four invariants above. If a future change adds a TTL / max
  preset above the current ceiling, the test forces a corresponding
  workbox-config bump in the same PR.

---

## §3. `CacheRowState` (transient, in-memory, render-only)

**Owner**: a private type inside `SettingsSheet.svelte`. Built once
per sheet open (and after each clear / TTL / max-entries change) by
calling `countCacheEntries(name)` for each `TILE_CACHE_NAMES` entry.

```ts
interface CacheRowState {
  /** One of TILE_CACHE_NAMES. */
  readonly name: TileCacheName;
  /** Display label (already localised). */
  readonly label: string;
  /** Current entry count from CacheStorage; null if cache inspection
      is unavailable in this browsing context (private mode). */
  readonly count: number | null;
  /** Per-cache cap from preferences. Always present; null only
      while the prefs are still loading on first paint. */
  readonly cap: TileMaxEntries | null;
}
```

**State transitions**:

```text
                ┌──────────────────────────────────┐
                │   sheet opens / TTL changes /    │
                │   max-entries changes /          │
                │   any clear succeeds              │
                └──────────────┬───────────────────┘
                               │
                refresh(): for each TILE_CACHE_NAMES → countCacheEntries
                               │
                               ▼
              ┌──────────────────────────────────┐
              │   rows: readonly CacheRowState[]  │
              │   (3 entries, name-ordered)       │
              └───────────────────────────────────┘
```

**Invariants**:

- `rows.length === TILE_CACHE_NAMES.length === 3`.
- `rows[i].name === TILE_CACHE_NAMES[i]` (preserves render order).
- `rows[i].count === null` IFF the underlying browser-storage layer
  threw on `caches.open(name)` (graceful-degrade per FR-016).
- `rows[i].cap` is the same value across all three rows (per-cache
  cap is a single shared preference).

---

## §4. `ClearTarget` (transient, parameter shape only)

**Owner**: a private type inside `SettingsSheet.svelte`. Used to
parameterise the confirmation dialog and the destructive action.

```ts
type ClearTarget =
  | { readonly kind: 'all' }
  | { readonly kind: 'one'; readonly name: TileCacheName };
```

**Properties**:

- `kind === 'all'` → confirm body and action use the localised
  "Clear all" wording; on confirm, calls
  `clearAllTileCaches(storage)`.
- `kind === 'one'` → confirm body names the source label
  (`SOURCE_LABEL_KEY[name]`); on confirm, calls
  `clearCache(name, storage)`.
- The `<dialog>` element's `open` state is bound to "is `target` non-
  null"; clearing the target dismisses the dialog.

---

## §5. `ConfirmDialogState` (transient, in-memory, dialog open/close)

**Owner**: a private state object inside `SettingsSheet.svelte`.

```ts
interface ConfirmDialogState {
  /** When non-null, the dialog is open and asking about this target. */
  readonly target: ClearTarget | null;
  /** True while the destructive action is mid-execution. Used to
      disable both Cancel and Confirm buttons to prevent the user
      from double-firing. */
  readonly busy: boolean;
}
```

**State transitions**:

```text
        ┌──────────────────────────┐
        │ idle  { target: null,    │
        │         busy: false }    │
        └────────────┬─────────────┘
                     │ user taps "Clear (one|all)"
                     ▼
        ┌──────────────────────────┐
        │ asking { target: T,      │
        │         busy: false }    │
        └─────────┬─────────┬──────┘
       cancel    │         │  confirm
                 │         ▼
                 │  ┌──────────────────────────┐
                 │  │ working { target: T,     │
                 │  │           busy: true }   │
                 │  └─────────┬────────────────┘
                 │            │ clear succeeds / fails
                 ▼            ▼
        ┌──────────────────────────┐
        │ idle  { target: null,    │
        │         busy: false }    │
        └──────────────────────────┘
```

**Invariants**:

- `busy === true` implies `target !== null`.
- The `<dialog>` element is open IFF `target !== null`.
- After a confirm, `target` is reset to `null` whether the action
  succeeded or threw; failure paths surface the error via an inline
  banner (NOT an alert).

---

## §6. Cross-shape relationship diagram

```text
                ┌──────────────────────────────────┐
                │   App.svelte                     │
                │   - mounts toolbar gear button   │
                │   - mounts <SettingsSheet />     │
                └────────────┬─────────────────────┘
                             │ open / close
                             ▼
                ┌──────────────────────────────────┐
                │   SettingsSheet.svelte           │
                │   - rows: CacheRowState[]         │
                │   - confirm: ConfirmDialogState  │
                │   - reads: tileTtlDays,          │
                │            tileMaxEntries from    │
                │            preferences          │
                │   - <dialog> open ↔ target≠null  │
                └────┬───────────────┬─────────────┘
                     │               │
            ┌────────┘               └──────────┐
            ▼                                   ▼
  ┌──────────────────────┐           ┌──────────────────────┐
  │   cacheStats.ts      │           │   cachePurge.ts      │
  │   - countCacheEntries│           │   - clearCache       │
  │   - estimateQuota    │           │   - clearAllTileCaches│
  └─────┬────────────────┘           │   - purgeExpired     │
        │                            │   - enforceMaxEntries│
        │                            │   - enforceCachePolicy│
        │                            └─────┬────────────────┘
        │                                  │
        ▼                                  ▼
  ┌──────────────────────────────────────────────────┐
  │         globalThis.caches (CacheStorage)         │
  │     osm-tiles | nlsc-tiles | google-tiles        │
  │                                                  │
  │   workbox-precache-v2-* (the app shell)          │
  │   ── EXPLICITLY NEVER TOUCHED by this feature ──│
  └──────────────────────────────────────────────────┘

                ┌──────────────────────────────────┐
                │   main.ts                        │
                │   - registerSW()                 │
                │   - enforceCachePolicy(          │
                │       loadTileTtlDays(),         │
                │       loadTileMaxEntries(),      │
                │     )  // fire-and-forget        │
                └──────────────────────────────────┘
```

**Trust boundary**: `SettingsSheet.svelte` trusts `cachePolicy` for
constants and `cachePurge` / `cacheStats` for all CacheStorage I/O.
The component never touches `globalThis.caches` directly. This
keeps the testable surface (the three pure modules) the only thing
component tests need to fake.

---

## §7. Sample code: `vite.config.ts` amendment

For clarity (this is the Phase 3 task):

```ts
// vite.config.ts (excerpt)
import {
  TILE_CACHE_MAX_AGE_DAYS_CEILING,
  TILE_CACHE_MAX_ENTRIES_CEILING,
} from './src/pwa/cachePolicy';

const TILE_MAX_AGE_SECONDS =
  TILE_CACHE_MAX_AGE_DAYS_CEILING * 60 * 60 * 24;

// runtimeCaching entries — both values now flow from one source
{
  urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
  handler: 'StaleWhileRevalidate',
  options: {
    cacheName: 'osm-tiles',
    expiration: {
      maxEntries: TILE_CACHE_MAX_ENTRIES_CEILING,
      maxAgeSeconds: TILE_MAX_AGE_SECONDS,
    },
    cacheableResponse: { statuses: [0, 200] },
  },
},
// ... same shape for nlsc-tiles, google-tiles
```

---

## §8. What this feature does NOT add

- **No new storage key**. Only `pwa_map:prefs` is touched (additively).
  `pwa_map:lastView`, `pwa_map:gotoHistory_v1`,
  `pwa_map:offlineReadyShown`, `pwa_map:installDismissedUntil`
  are all untouched.
- **No new SW cache name**. The three runtime cache names
  (`osm-tiles`, `nlsc-tiles`, `google-tiles`) are unchanged. The
  workbox precache name (`workbox-precache-v2-*`) is unchanged AND
  explicitly out-of-bounds for this feature's clear / purge /
  enforce code paths.
- **No new manifest field**. The PWA manifest in `vite.config.ts` is
  identical to feature 005.
- **No new runtime dependency**. All work uses standard browser APIs +
  Svelte 4 + the existing vite-plugin-pwa setup.
- **No telemetry / analytics**. Cache size and the user's TTL /
  max-entries choices are private to the device; no persisted
  counters; no remote upload.
- **No tile-prefetch / tile-download / area-export code path**, in
  any module. The licence rule (FR-013, FR-021) is enforced as a
  scope discipline plus a SC-006 audit trail.
