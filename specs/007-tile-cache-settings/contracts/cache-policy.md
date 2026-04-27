# Contract: `cachePolicy.ts` — single source of truth for tile-cache constants

**Module**: `src/pwa/cachePolicy.ts` (NEW)
**Imported from**:

- `vite.config.ts` (build-time — workbox `expiration` config)
- `src/pwa/cachePurge.ts` (runtime — fan-out across `TILE_CACHE_NAMES`)
- `src/pwa/cacheStats.ts` (runtime — accepts a `TileCacheName`)
- `src/storage/preferences.ts` (runtime — validator's allowed set)
- `src/components/SettingsSheet.svelte` (render — `<select>` options)

**Verifies**: spec FR-006, FR-019; research D1, D4, D11.

## §1. Exported surface

The module exports ONLY constants and types. No functions, no side
effects, no imports of any other project module (so it can be safely
imported from `vite.config.ts` at build time).

```ts
export const TILE_CACHE_NAMES: readonly ['osm-tiles', 'nlsc-tiles', 'google-tiles'];
export type TileCacheName = (typeof TILE_CACHE_NAMES)[number];

export const TTL_OPTIONS: readonly [1, 3, 7, 14, 30, 60, 90];
export type TtlDays = (typeof TTL_OPTIONS)[number];

export const MAX_ENTRIES_OPTIONS: readonly [256, 512, 1024, 2048, 4096, 8192];
export type TileMaxEntries = (typeof MAX_ENTRIES_OPTIONS)[number];

export const DEFAULT_TILE_TTL_DAYS: TtlDays;        // = 7
export const DEFAULT_TILE_MAX_ENTRIES: TileMaxEntries; // = 4096

export const TILE_CACHE_MAX_AGE_DAYS_CEILING: 90;     // == max(TTL_OPTIONS)
export const TILE_CACHE_MAX_ENTRIES_CEILING: 8192;    // == max(MAX_ENTRIES_OPTIONS)

export const SOURCE_LABEL_KEY: Readonly<Record<TileCacheName, string>>;
//   { 'osm-tiles': 'settings.cache.source.osm', ... }
```

## §2. Invariants enforced by `cachePolicy.spec.ts`

| ID    | Invariant                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-1 | `Object.isFrozen(TILE_CACHE_NAMES)` AND `Object.isFrozen(TTL_OPTIONS)` AND `Object.isFrozen(MAX_ENTRIES_OPTIONS)` AND `Object.isFrozen(SOURCE_LABEL_KEY)`. |
| INV-2 | `TILE_CACHE_NAMES.length === 3` and the values are exactly `'osm-tiles'`, `'nlsc-tiles'`, `'google-tiles'` in that order.                            |
| INV-3 | `TTL_OPTIONS.length === 7`, sorted ascending, all positive integers ≤ 90.                                                                            |
| INV-4 | `MAX_ENTRIES_OPTIONS.length === 6`, sorted ascending, all positive integers, all powers of two between 256 and 8192 inclusive.                       |
| INV-5 | `DEFAULT_TILE_TTL_DAYS === 7` AND `TTL_OPTIONS.includes(DEFAULT_TILE_TTL_DAYS)`.                                                                     |
| INV-6 | `DEFAULT_TILE_MAX_ENTRIES === 4096` AND `MAX_ENTRIES_OPTIONS.includes(DEFAULT_TILE_MAX_ENTRIES)`.                                                    |
| INV-7 | `TILE_CACHE_MAX_AGE_DAYS_CEILING === Math.max(...TTL_OPTIONS)`.                                                                                      |
| INV-8 | `TILE_CACHE_MAX_ENTRIES_CEILING === Math.max(...MAX_ENTRIES_OPTIONS)`.                                                                               |
| INV-9 | `Object.keys(SOURCE_LABEL_KEY).sort()` equals `[...TILE_CACHE_NAMES].sort()` (every source has a label key, no extras).                              |

## §3. What this module MUST NOT do

- MUST NOT import from any project module (zero deps; build-time-safe).
- MUST NOT export any function (constants and types only).
- MUST NOT export `'workbox-precache-v2'`, `'workbox-precache'`, or
  any other non-tile cache name. The `TILE_CACHE_NAMES` allowlist is
  the safety boundary that keeps `clearAllTileCaches` from ever
  touching the precache (research D9).

## §4. Required tests

`tests/unit/pwa/cachePolicy.spec.ts` MUST cover INV-1..INV-9 above as
nine separate `it(...)` blocks, each named after its INV ID. Plus:

- **`TILE_CACHE_NAMES does not include 'workbox-precache-v2'`** —
  defensive test that catches a future rename accident.
- **`importing the module is side-effect-free`** — repeated `await
  import('$pwa/cachePolicy')` returns the same frozen objects.
