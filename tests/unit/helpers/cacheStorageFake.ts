/**
 * Test double for the global `CacheStorage` + `Cache` Web APIs.
 *
 * Backed by `Map` so insertion order is preserved (the Cache API spec
 * guarantees `cache.keys()` returns request keys in insertion order;
 * the production code relies on this for `enforceMaxEntries`'s
 * oldest-first deletion). Used by the `cacheStats` and `cachePurge`
 * unit specs to inject a deterministic CacheStorage without touching
 * `globalThis.caches`.
 */

export interface FakeResponseInit {
  /** Date header to return from `response.headers.get('date')`. Pass null to omit. */
  readonly dateHeader?: string | null;
}

export interface FakeRequest {
  readonly url: string;
}

export interface FakeResponse {
  readonly headers: { readonly get: (name: string) => string | null };
}

export interface FakeCache {
  keys: () => Promise<readonly FakeRequest[]>;
  match: (req: FakeRequest) => Promise<FakeResponse | undefined>;
  delete: (req: FakeRequest) => Promise<boolean>;
  put: (req: FakeRequest, res: FakeResponse) => Promise<void>;
}

export interface FakeCacheStorage {
  open: (name: string) => Promise<FakeCache>;
  delete: (name: string) => Promise<boolean>;
  keys: () => Promise<readonly string[]>;
  /** Tests-only escape hatch to peek at the underlying caches map. */
  __raw: () => Map<string, Map<string, FakeResponse>>;
}

export function makeResponse(dateHeader: string | null = new Date().toUTCString()): FakeResponse {
  return {
    headers: {
      get: (name: string): string | null => {
        if (name.toLowerCase() === 'date') return dateHeader;
        return null;
      },
    },
  };
}

function makeCacheBackedBy(store: Map<string, FakeResponse>): FakeCache {
  return {
    keys: async (): Promise<readonly FakeRequest[]> => Array.from(store.keys(), (url) => ({ url })),
    match: async (req: FakeRequest): Promise<FakeResponse | undefined> => store.get(req.url),
    delete: async (req: FakeRequest): Promise<boolean> => store.delete(req.url),
    put: async (req: FakeRequest, res: FakeResponse): Promise<void> => {
      store.set(req.url, res);
    },
  };
}

export function createCacheStorageFake(): FakeCacheStorage {
  const caches = new Map<string, Map<string, FakeResponse>>();
  return {
    open: async (name: string): Promise<FakeCache> => {
      let bucket = caches.get(name);
      if (!bucket) {
        bucket = new Map<string, FakeResponse>();
        caches.set(name, bucket);
      }
      return makeCacheBackedBy(bucket);
    },
    delete: async (name: string): Promise<boolean> => caches.delete(name),
    keys: async (): Promise<readonly string[]> => Array.from(caches.keys()),
    __raw: (): Map<string, Map<string, FakeResponse>> => caches,
  };
}

/**
 * Convenience: pre-populate a named cache with a sequence of entries.
 * Insertion order is preserved (so the resulting `cache.keys()` lists
 * the entries in the order passed here).
 */
export async function seed(
  storage: FakeCacheStorage,
  name: string,
  entries: ReadonlyArray<{ readonly url: string; readonly dateHeader?: string | null }>,
): Promise<void> {
  const cache = await storage.open(name);
  for (const e of entries) {
    await cache.put({ url: e.url }, makeResponse(e.dateHeader ?? null));
  }
}
