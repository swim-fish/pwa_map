import type { TileCacheName } from './cachePolicy';

/**
 * Returns the entry count for the named tile cache, or null when the
 * underlying browser-storage layer is unavailable / throws (private
 * mode, very old browsers — graceful-degrade per spec FR-016).
 *
 * Read-only. NEVER throws. NEVER logs to console.
 */
export async function countCacheEntries(
  name: TileCacheName,
  storage: CacheStorage | undefined = (globalThis as { caches?: CacheStorage }).caches,
): Promise<number | null> {
  if (!storage) return null;
  try {
    const cache = await storage.open(name);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return null;
  }
}

/**
 * Returns a coarse origin-wide storage estimate. Both fields are null
 * when the underlying API is missing or throws.
 *
 * NEVER throws. NEVER logs to console.
 */
export async function estimateQuota(
  store: { estimate?: () => Promise<StorageEstimate> } | undefined = (
    globalThis as {
      navigator?: { storage?: { estimate?: () => Promise<StorageEstimate> } };
    }
  ).navigator?.storage,
): Promise<{ usage: number | null; quota: number | null }> {
  if (!store?.estimate) return { usage: null, quota: null };
  try {
    const r = await store.estimate();
    return { usage: r.usage ?? null, quota: r.quota ?? null };
  } catch {
    return { usage: null, quota: null };
  }
}
