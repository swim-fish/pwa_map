import { describe, it, expect, vi } from 'vitest';
import {
  clearCache,
  clearAllTileCaches,
  purgeExpired,
  enforceMaxEntries,
  enforceCachePolicy,
} from '../../../src/pwa/cachePurge';
import { TILE_CACHE_NAMES } from '../../../src/pwa/cachePolicy';
import { createCacheStorageFake, seed } from '../helpers/cacheStorageFake';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateHeaderAt(epochMs: number): string {
  return new Date(epochMs).toUTCString();
}

// ============================================================================
// SAFETY (TDD — these MUST land RED before any production code in cachePurge)
// ============================================================================

describe('SAFETY (research D9 + D11 + D2)', () => {
  it('(1) clearAllTileCaches does NOT delete workbox-precache-v2-*', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'tile-osm-1' }, { url: 'tile-osm-2' }]);
    await seed(storage, 'nlsc-tiles', [{ url: 'tile-nlsc-1' }]);
    await seed(storage, 'google-tiles', [{ url: 'tile-google-1' }]);
    await seed(storage, 'workbox-precache-v2-1234', [
      { url: '/index.html' },
      { url: '/main.js' },
      { url: '/main.css' },
    ]);

    await clearAllTileCaches(storage as unknown as CacheStorage);

    const precache = await storage.open('workbox-precache-v2-1234');
    const precacheKeys = await precache.keys();
    expect(precacheKeys.map((k) => k.url)).toEqual(['/index.html', '/main.js', '/main.css']);
  });

  it('(2) enforceMaxEntries trims to exactly cap', async () => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 100 }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);

    const result = await enforceMaxEntries('osm-tiles', 30, storage as unknown as CacheStorage);

    expect(result.deleted).toBe(70);
    expect(result.kept).toBe(30);
    const cache = await storage.open('osm-tiles');
    const keys = await cache.keys();
    expect(keys.length).toBe(30);
  });

  it('(3) enforceMaxEntries deletes oldest-first (insertion order)', async () => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 100 }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);

    await enforceMaxEntries('osm-tiles', 30, storage as unknown as CacheStorage);

    const cache = await storage.open('osm-tiles');
    const keys = await cache.keys();
    const urls = keys.map((k) => k.url);
    // The newest 30 should remain: tile-70..tile-99
    expect(urls).toEqual(Array.from({ length: 30 }, (_, i) => `tile-${i + 70}`));
  });

  it('(4) purgeExpired keeps fresh entries', async () => {
    const now = 100 * DAY_MS;
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [
      { url: 'fresh', dateHeader: dateHeaderAt(now - 1 * DAY_MS) },
    ]);

    const result = await purgeExpired('osm-tiles', 7, now, storage as unknown as CacheStorage);

    expect(result.kept).toBe(1);
    expect(result.deleted).toBe(0);
    const cache = await storage.open('osm-tiles');
    const keys = await cache.keys();
    expect(keys.length).toBe(1);
  });

  it('(5) purgeExpired deletes stale entries', async () => {
    const now = 100 * DAY_MS;
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [
      { url: 'stale', dateHeader: dateHeaderAt(now - 30 * DAY_MS) },
    ]);

    const result = await purgeExpired('osm-tiles', 7, now, storage as unknown as CacheStorage);

    expect(result.kept).toBe(0);
    expect(result.deleted).toBe(1);
    const cache = await storage.open('osm-tiles');
    expect((await cache.keys()).length).toBe(0);
  });

  it('(6) purgeExpired deletes entries with missing date header (D2 fallback)', async () => {
    const now = 100 * DAY_MS;
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'no-date', dateHeader: null }]);

    const result = await purgeExpired('osm-tiles', 7, now, storage as unknown as CacheStorage);

    expect(result.deleted).toBe(1);
  });
});

// ============================================================================
// BEHAVIOUR
// ============================================================================

describe('clearCache', () => {
  it.each([0, 1, 256])('(7) returns the deleted count for N=%i', async (n) => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: n }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);

    const result = await clearCache('osm-tiles', storage as unknown as CacheStorage);

    expect(result.deleted).toBe(n);
    const cache = await storage.open('osm-tiles');
    expect((await cache.keys()).length).toBe(0);
  });

  it('(8) uses per-entry delete, NOT storage.delete(name)', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'a' }, { url: 'b' }]);
    const storageDeleteSpy = vi.spyOn(storage, 'delete');

    await clearCache('osm-tiles', storage as unknown as CacheStorage);

    expect(storageDeleteSpy).not.toHaveBeenCalled();
  });

  it('(13) returns deleted=0 when storage is undefined', async () => {
    const original = (globalThis as { caches?: unknown }).caches;
    delete (globalThis as { caches?: unknown }).caches;
    try {
      const result = await clearCache('osm-tiles');
      expect(result.deleted).toBe(0);
    } finally {
      if (original !== undefined) (globalThis as { caches?: unknown }).caches = original;
    }
  });
});

describe('clearAllTileCaches', () => {
  it('(9) returns per-cache counts with 0 for empty caches', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'a' }, { url: 'b' }]);
    await seed(storage, 'nlsc-tiles', [{ url: 'c' }]);
    // google-tiles is unpopulated.

    const result = await clearAllTileCaches(storage as unknown as CacheStorage);

    expect(result.perCache['osm-tiles']).toBe(2);
    expect(result.perCache['nlsc-tiles']).toBe(1);
    expect(result.perCache['google-tiles']).toBe(0);
  });
});

describe('enforceCachePolicy', () => {
  it('(10) runs purgeExpired BEFORE enforceMaxEntries (per cache)', async () => {
    const now = 100 * DAY_MS;
    const storage = createCacheStorageFake();
    // 60 fresh + 60 stale → after purge=60, after trim(50)=50.
    // If trim ran first, it would keep 50 of the original 120 (mixed),
    // and then purge would remove the stale ones from those 50, ending
    // with fewer than 50. The order matters; purge-first → trim leaves
    // exactly cap (when fresh count ≥ cap) or fresh count (when below).
    const entries = Array.from({ length: 120 }, (_, i) => ({
      url: `tile-${i}`,
      // Even-indexed are fresh, odd are stale, in interleaved order.
      dateHeader: dateHeaderAt(i % 2 === 0 ? now - 1 * DAY_MS : now - 30 * DAY_MS),
    }));
    await seed(storage, 'osm-tiles', entries);

    const result = await enforceCachePolicy(7, 50, now, storage as unknown as CacheStorage);

    // purge removes 60 stale → 60 fresh remain → trim to 50 → kept = 50
    expect(result.perCache['osm-tiles'].kept).toBe(50);
    expect(result.perCache['osm-tiles'].deleted).toBe(70); // 60 stale + 10 trimmed
  });
});

// ============================================================================
// PERFORMANCE
// ============================================================================

describe('PERFORMANCE — main-thread yields', () => {
  it('(11) enforceMaxEntries yields the main thread every 256 deletions', async () => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 1000 }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    // Trim to 100 → delete 900 entries → at least floor(900/256) = 3 yields.
    await enforceMaxEntries('osm-tiles', 100, storage as unknown as CacheStorage);

    // setTimeout(_, 0) is the yield pattern. There may be other
    // setTimeout calls from elsewhere, so use ≥ as the lower bound.
    const zeroDelayCalls = setTimeoutSpy.mock.calls.filter((c) => c[1] === 0);
    expect(zeroDelayCalls.length).toBeGreaterThanOrEqual(3);

    setTimeoutSpy.mockRestore();
  });

  it('(12) purgeExpired yields the main thread every 256 entries', async () => {
    const now = 100 * DAY_MS;
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 1000 }, (_, i) => ({
      url: `tile-${i}`,
      dateHeader: dateHeaderAt(now - 30 * DAY_MS),
    }));
    await seed(storage, 'osm-tiles', entries);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await purgeExpired('osm-tiles', 7, now, storage as unknown as CacheStorage);

    const zeroDelayCalls = setTimeoutSpy.mock.calls.filter((c) => c[1] === 0);
    expect(zeroDelayCalls.length).toBeGreaterThanOrEqual(3);

    setTimeoutSpy.mockRestore();
  });
});

// ============================================================================
// RESILIENCE
// ============================================================================

describe('RESILIENCE', () => {
  it('(14) enforceMaxEntries no-ops when keys.length ≤ cap', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'a' }, { url: 'b' }, { url: 'c' }]);

    const result = await enforceMaxEntries('osm-tiles', 10, storage as unknown as CacheStorage);

    expect(result.deleted).toBe(0);
    expect(result.kept).toBe(3);
    const cache = await storage.open('osm-tiles');
    expect((await cache.keys()).length).toBe(3);
  });
});

// Sanity: the safety contract uses TILE_CACHE_NAMES as the allowlist.
describe('TILE_CACHE_NAMES integrity', () => {
  it('clearAllTileCaches operates on exactly the three tile caches', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'a' }]);
    await seed(storage, 'nlsc-tiles', [{ url: 'b' }]);
    await seed(storage, 'google-tiles', [{ url: 'c' }]);

    const result = await clearAllTileCaches(storage as unknown as CacheStorage);

    expect(Object.keys(result.perCache).sort()).toEqual([...TILE_CACHE_NAMES].sort());
  });
});
