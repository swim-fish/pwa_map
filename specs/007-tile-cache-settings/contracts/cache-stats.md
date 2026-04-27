# Contract: `cacheStats.ts` — read-only inspection of tile-cache state

**Module**: `src/pwa/cacheStats.ts` (NEW)
**Imported from**:

- `src/components/SettingsSheet.svelte` (render — populates the three
  `CacheRowState` rows on open + after every clear / TTL / max-entries
  change).

**Verifies**: spec FR-003, FR-004, FR-016; research D5, D8.

## §1. Exported surface

```ts
import type { TileCacheName } from '$pwa/cachePolicy';

/**
 * Returns the number of entries currently in the named cache, or
 * null if the underlying browser-storage layer threw on access.
 *
 * Implementation: `(await storage.open(name)).keys()` then
 * `array.length`. The Cache API guarantees `keys()` returns a
 * fresh array snapshot.
 */
export async function countCacheEntries(
  name: TileCacheName,
  storage?: CacheStorage,
): Promise<number | null>;

/**
 * Returns a coarse origin-wide storage estimate. Both fields are
 * null when the underlying API is missing or throws.
 *
 * Implementation: `await navigator.storage.estimate()` then map
 * `usage`/`quota` to bytes. NEVER throws.
 */
export async function estimateQuota(
  store?: { estimate?: () => Promise<StorageEstimate> },
): Promise<{ usage: number | null; quota: number | null }>;
```

## §2. Behaviour (`countCacheEntries`)

| Scenario                                      | Returns                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Cache exists with N entries                   | `N` (an integer ≥ 0).                                                                            |
| Cache does not exist (never written to)       | `0` (the Cache API auto-creates an empty cache on `storage.open`).                               |
| `storage` is undefined AND `globalThis.caches` is undefined | `null` (graceful degrade, FR-016).                                                                |
| `storage.open(...)` throws (private mode)     | `null` (graceful degrade, FR-016). The error is swallowed silently — surfaced via the `null` return value, not via `console.error`. |

## §3. Behaviour (`estimateQuota`)

| Scenario                                      | Returns                                                              |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `navigator.storage.estimate()` returns `{ usage, quota }` | `{ usage, quota }` verbatim (both numbers).                            |
| `navigator.storage` is undefined              | `{ usage: null, quota: null }`.                                       |
| `navigator.storage.estimate` is undefined     | `{ usage: null, quota: null }`.                                       |
| `estimate()` rejects                          | `{ usage: null, quota: null }` (caught + swallowed).                  |

The function is intentionally non-throwing: a render path that depends
on the result must not have to `try/catch` on every open of the sheet.

## §4. Performance contract

- `countCacheEntries(name)` is a single `(await storage.open(name)).keys()`
  call — O(1) wrapper around an O(N) internal walk. For N ≤ 8192 the
  total wall-clock is sub-10 ms in jsdom and sub-30 ms in real
  Chromium.
- `estimateQuota()` is a single async call — sub-50 ms wall-clock on
  real browsers; jsdom returns instantly because the function path
  resolves to "undefined → null return".

## §5. What this module MUST NOT do

- MUST NOT mutate any cache. Both functions are read-only.
- MUST NOT iterate cache entry contents (that would be O(N) of `match`
  calls — see research D5 alternatives section). Only `.keys().length`
  for `countCacheEntries`.
- MUST NOT make any network request.
- MUST NOT log to `console`. Errors are surfaced via the `null` return
  values.

## §6. Required tests

`tests/unit/pwa/cacheStats.spec.ts` MUST cover, using a fake
`CacheStorage` (see `tests/unit/helpers/cacheStorageFake.ts`):

1. **`countCacheEntries returns 0 for an empty cache`**.
2. **`countCacheEntries returns N for a cache with N entries`** with
   N ∈ {1, 256, 4096} (boundary + scale).
3. **`countCacheEntries returns null when storage parameter is undefined and globalThis.caches is undefined`**.
4. **`countCacheEntries returns null when storage.open throws`**.
5. **`estimateQuota returns the values from navigator.storage.estimate`**.
6. **`estimateQuota returns null/null when navigator.storage is undefined`**.
7. **`estimateQuota returns null/null when navigator.storage.estimate is undefined`**.
8. **`estimateQuota returns null/null when estimate() rejects`** — uses
   a stub that returns `Promise.reject(new Error('boom'))`.
9. **`estimateQuota does not log to console on rejection`** — spy on
   `console.error` / `console.warn` and assert zero calls.
