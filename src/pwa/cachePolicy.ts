/**
 * Single source of truth for tile-cache constants.
 *
 * Imported by:
 *   - vite.config.ts (build-time, workbox `expiration` config)
 *   - src/pwa/cachePurge.ts (runtime, fan-out across the named caches)
 *   - src/pwa/cacheStats.ts (runtime, accepts a TileCacheName)
 *   - src/storage/preferences.ts (runtime, validator's allowed sets)
 *   - src/components/SettingsSheet.svelte (render, <select> options)
 *
 * MUST NOT import from any project module so it remains build-time
 * safe for vite.config.ts.
 */

export const TILE_CACHE_NAMES = Object.freeze(['osm-tiles', 'nlsc-tiles', 'google-tiles'] as const);

export type TileCacheName = (typeof TILE_CACHE_NAMES)[number];

export const TTL_OPTIONS = Object.freeze([1, 3, 7, 14, 30, 60, 90] as const);
export type TtlDays = (typeof TTL_OPTIONS)[number];

export const MAX_ENTRIES_OPTIONS = Object.freeze([256, 512, 1024, 2048, 4096, 8192] as const);
export type TileMaxEntries = (typeof MAX_ENTRIES_OPTIONS)[number];

export const DEFAULT_TILE_TTL_DAYS: TtlDays = 7;
export const DEFAULT_TILE_MAX_ENTRIES: TileMaxEntries = 4096;

/** Workbox bakes this as runtimeCaching.options.expiration.maxAgeSeconds. */
export const TILE_CACHE_MAX_AGE_DAYS_CEILING = 90 as const;

/** Workbox bakes this as runtimeCaching.options.expiration.maxEntries. */
export const TILE_CACHE_MAX_ENTRIES_CEILING = 8192 as const;

/** i18n key per cache for the source label rendered in the Settings sheet. */
export const SOURCE_LABEL_KEY: Readonly<Record<TileCacheName, string>> = Object.freeze({
  'osm-tiles': 'settings.cache.source.osm',
  'nlsc-tiles': 'settings.cache.source.nlsc',
  'google-tiles': 'settings.cache.source.google',
});
