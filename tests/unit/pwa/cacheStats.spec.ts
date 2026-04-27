import { describe, it, expect, vi, afterEach } from 'vitest';
import { countCacheEntries, estimateQuota } from '../../../src/pwa/cacheStats';
import { createCacheStorageFake, seed } from '../helpers/cacheStorageFake';

describe('countCacheEntries (contracts/cache-stats.md §2)', () => {
  it('returns 0 for an empty cache', async () => {
    const storage = createCacheStorageFake();
    await storage.open('osm-tiles');
    expect(await countCacheEntries('osm-tiles', storage as unknown as CacheStorage)).toBe(0);
  });

  it('returns N for a cache with N entries (N=1)', async () => {
    const storage = createCacheStorageFake();
    await seed(storage, 'osm-tiles', [{ url: 'tile-0' }]);
    expect(await countCacheEntries('osm-tiles', storage as unknown as CacheStorage)).toBe(1);
  });

  it('returns N for a cache with N entries (N=256)', async () => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 256 }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);
    expect(await countCacheEntries('osm-tiles', storage as unknown as CacheStorage)).toBe(256);
  });

  it('returns N for a cache with N entries (N=4096)', async () => {
    const storage = createCacheStorageFake();
    const entries = Array.from({ length: 4096 }, (_, i) => ({ url: `tile-${i}` }));
    await seed(storage, 'osm-tiles', entries);
    expect(await countCacheEntries('osm-tiles', storage as unknown as CacheStorage)).toBe(4096);
  });

  it('returns null when storage param undefined and globalThis.caches undefined', async () => {
    // jsdom does not define `globalThis.caches` by default; verify by
    // explicit deletion in case a previous test polyfilled it.
    const original = (globalThis as { caches?: unknown }).caches;
    delete (globalThis as { caches?: unknown }).caches;
    try {
      expect(await countCacheEntries('osm-tiles')).toBeNull();
    } finally {
      if (original !== undefined) (globalThis as { caches?: unknown }).caches = original;
    }
  });

  it('returns null when storage.open throws', async () => {
    const broken: CacheStorage = {
      open: () => Promise.reject(new Error('boom')),
    } as unknown as CacheStorage;
    expect(await countCacheEntries('osm-tiles', broken)).toBeNull();
  });
});

describe('estimateQuota (contracts/cache-stats.md §3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the values from navigator.storage.estimate', async () => {
    const result = await estimateQuota({
      estimate: () => Promise.resolve({ usage: 1024, quota: 4096 } as unknown as StorageEstimate),
    });
    expect(result).toEqual({ usage: 1024, quota: 4096 });
  });

  it('returns null/null when storage param is undefined', async () => {
    expect(await estimateQuota(undefined)).toEqual({ usage: null, quota: null });
  });

  it('returns null/null when estimate is undefined', async () => {
    expect(await estimateQuota({})).toEqual({ usage: null, quota: null });
  });

  it('returns null/null when estimate() rejects', async () => {
    expect(
      await estimateQuota({
        estimate: (): Promise<StorageEstimate> => Promise.reject(new Error('boom')),
      }),
    ).toEqual({ usage: null, quota: null });
  });

  it('does NOT log to console on rejection', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await estimateQuota({
      estimate: (): Promise<StorageEstimate> => Promise.reject(new Error('boom')),
    });
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
