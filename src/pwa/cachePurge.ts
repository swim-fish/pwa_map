import { TILE_CACHE_NAMES, type TileCacheName } from './cachePolicy';

const YIELD_EVERY = 256;
const DAY_MS = 24 * 60 * 60 * 1000;

function getDefaultStorage(): CacheStorage | undefined {
  return (globalThis as { caches?: CacheStorage }).caches;
}

async function yieldToMain(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Empty one named tile cache by deleting every entry individually
 * (NEVER `storage.delete(name)` — that whole-namespace removal can
 * cause workbox to recreate the cache without our expiration config
 * on the next fetch).
 *
 * Yields the main thread every 256 deletions so a 4096-entry clear
 * does not block scrolling.
 */
export async function clearCache(
  name: TileCacheName,
  storage: CacheStorage | undefined = getDefaultStorage(),
): Promise<{ deleted: number }> {
  if (!storage) return { deleted: 0 };
  let deleted = 0;
  try {
    const cache = await storage.open(name);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length; i++) {
      const ok = await cache.delete(keys[i]);
      if (ok) deleted++;
      if ((i + 1) % YIELD_EVERY === 0 && i + 1 < keys.length) {
        await yieldToMain();
      }
    }
  } catch {
    return { deleted };
  }
  return { deleted };
}

/**
 * Empty all three tile caches in parallel.
 *
 * SAFETY: iterates the FIXED `TILE_CACHE_NAMES` allowlist — never
 * `storage.keys()` — so the workbox precache (or any future non-tile
 * cache) is guaranteed untouched.
 */
export async function clearAllTileCaches(
  storage: CacheStorage | undefined = getDefaultStorage(),
): Promise<{ perCache: Record<TileCacheName, number> }> {
  const entries = await Promise.all(
    TILE_CACHE_NAMES.map(async (name) => {
      const r = await clearCache(name, storage);
      return [name, r.deleted] as const;
    }),
  );
  const perCache = Object.fromEntries(entries) as Record<TileCacheName, number>;
  return { perCache };
}

/**
 * Remove entries older than `ttlDays` from one tile cache.
 *
 * Reads each entry's `Response.headers.get('date')`. If missing or
 * unparseable, the entry is deleted (research D2 conservative
 * fallback — a date-less entry cannot be verified as fresh, so it
 * is forgotten when the user expressed an intent to retain only
 * fresh tiles).
 *
 * Yields the main thread every 256 entries inspected.
 */
export async function purgeExpired(
  name: TileCacheName,
  ttlDays: number,
  now: number = Date.now(),
  storage: CacheStorage | undefined = getDefaultStorage(),
): Promise<{ deleted: number; kept: number }> {
  if (!storage) return { deleted: 0, kept: 0 };
  const cutoff = now - ttlDays * DAY_MS;
  let deleted = 0;
  let kept = 0;
  try {
    const cache = await storage.open(name);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length; i++) {
      const req = keys[i];
      let shouldDelete = true;
      try {
        const res = await cache.match(req);
        if (res) {
          const dateHeader = res.headers.get('date');
          if (dateHeader) {
            const ts = Date.parse(dateHeader);
            if (Number.isFinite(ts) && ts >= cutoff) {
              shouldDelete = false;
            }
          }
        }
      } catch {
        // Treat read errors as a delete signal — same as missing date.
        shouldDelete = true;
      }
      if (shouldDelete) {
        const ok = await cache.delete(req);
        if (ok) deleted++;
      } else {
        kept++;
      }
      if ((i + 1) % YIELD_EVERY === 0 && i + 1 < keys.length) {
        await yieldToMain();
      }
    }
  } catch {
    return { deleted, kept };
  }
  return { deleted, kept };
}

/**
 * Trim a tile cache to at most `cap` entries by deleting from the
 * FRONT of `cache.keys()` (insertion order = oldest writes first per
 * the Cache API spec; aligns with workbox's chronological write
 * path). Per research D11.
 *
 * Yields the main thread every 256 deletions.
 */
export async function enforceMaxEntries(
  name: TileCacheName,
  cap: number,
  storage: CacheStorage | undefined = getDefaultStorage(),
): Promise<{ deleted: number; kept: number }> {
  if (!storage) return { deleted: 0, kept: 0 };
  try {
    const cache = await storage.open(name);
    const keys = await cache.keys();
    if (keys.length <= cap) {
      return { deleted: 0, kept: keys.length };
    }
    const surplus = keys.length - cap;
    let deleted = 0;
    for (let i = 0; i < surplus; i++) {
      const ok = await cache.delete(keys[i]);
      if (ok) deleted++;
      if ((i + 1) % YIELD_EVERY === 0 && i + 1 < surplus) {
        await yieldToMain();
      }
    }
    return { deleted, kept: keys.length - deleted };
  } catch {
    return { deleted: 0, kept: 0 };
  }
}

/**
 * For each tile cache: run `purgeExpired` THEN `enforceMaxEntries`,
 * in series per cache (so the trim sees the post-purge keyset). Fans
 * out across the three caches with `Promise.all`.
 *
 * Called from `main.ts` at app start and from `SettingsSheet.svelte`
 * after every TTL or per-cache-limit change.
 */
export async function enforceCachePolicy(
  ttlDays: number,
  cap: number,
  now: number = Date.now(),
  storage: CacheStorage | undefined = getDefaultStorage(),
): Promise<{
  perCache: Record<TileCacheName, { deleted: number; kept: number }>;
}> {
  const entries = await Promise.all(
    TILE_CACHE_NAMES.map(async (name) => {
      const purge = await purgeExpired(name, ttlDays, now, storage);
      const trim = await enforceMaxEntries(name, cap, storage);
      return [name, { deleted: purge.deleted + trim.deleted, kept: trim.kept }] as const;
    }),
  );
  const perCache = Object.fromEntries(entries) as Record<
    TileCacheName,
    { deleted: number; kept: number }
  >;
  return { perCache };
}
