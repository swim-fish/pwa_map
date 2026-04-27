# Contract: `cachePurge.ts` — destructive cache operations (the safety-critical module)

**Module**: `src/pwa/cachePurge.ts` (NEW)
**Imported from**:

- `src/components/SettingsSheet.svelte` (clear buttons, TTL change,
  max-entries change).
- `src/app/main.ts` (`enforceCachePolicy()` post `registerSW()`).

**Verifies**: spec FR-008, FR-009, FR-010, FR-014, FR-020, FR-021;
research D1, D2, D8, D9, D11, D12.

This module is the **load-bearing safety boundary** for the feature.
Every exported function is destructive; every one has a unit test that
runs RED before any production code lands (research D12).

## §1. Exported surface

```ts
import { TILE_CACHE_NAMES, type TileCacheName } from '$pwa/cachePolicy';

/** Empties one named tile cache. Returns the count of entries deleted.
    NEVER opens a cache whose name is not in TILE_CACHE_NAMES. */
export async function clearCache(
  name: TileCacheName,
  storage?: CacheStorage,
): Promise<{ deleted: number }>;

/** Empties all three tile caches. Returns per-cache deletion counts.
    Iterates the FIXED `TILE_CACHE_NAMES` allowlist; NEVER iterates
    `storage.keys()`; therefore CANNOT touch the workbox precache or
    any future non-tile cache. */
export async function clearAllTileCaches(
  storage?: CacheStorage,
): Promise<{ perCache: Record<TileCacheName, number> }>;

/** Removes entries older than `ttlDays` from one named tile cache.
    Reads each entry's `Response.headers.get('date')` to determine age.
    If the date header is missing or unparseable, the entry is deleted
    (research D2 conservative-fallback rule). Yields the main thread
    every 256 deletions. */
export async function purgeExpired(
  name: TileCacheName,
  ttlDays: number,
  now?: number,
  storage?: CacheStorage,
): Promise<{ deleted: number; kept: number }>;

/** Trims a tile cache to at most `cap` entries by deleting from the
    FRONT of `cache.keys()` (which the Cache API guarantees is
    insertion order — i.e., oldest writes first). Yields the main
    thread every 256 deletions. */
export async function enforceMaxEntries(
  name: TileCacheName,
  cap: number,
  storage?: CacheStorage,
): Promise<{ deleted: number; kept: number }>;

/** Convenience: runs purgeExpired then enforceMaxEntries on each
    TILE_CACHE_NAMES entry, in that order, with shared parameters.
    Used by main.ts at app start and by SettingsSheet on every TTL or
    max-entries change. */
export async function enforceCachePolicy(
  ttlDays: number,
  cap: number,
  now?: number,
  storage?: CacheStorage,
): Promise<{
  perCache: Record<TileCacheName, { deleted: number; kept: number }>;
}>;
```

## §2. Behaviour (`clearCache`)

| Scenario                                | Returns                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cache holds N entries                    | `{ deleted: N }`. Cache exists but is empty afterwards.                                       |
| Cache is empty                           | `{ deleted: 0 }`.                                                                            |
| `storage` undefined AND `globalThis.caches` undefined | `{ deleted: 0 }`. Graceful degrade — no throw.                                                |
| `storage.open(name)` throws              | `{ deleted: 0 }`. The error is silently swallowed (surfaced via `deleted: 0`, not via console). |

`clearCache` MUST use the per-entry `cache.delete(req)` path (NOT
`storage.delete(name)` which removes the entire cache). The reason:
removing the cache namespace itself can cause the SW to re-create it
on next fetch with a default `expiration` config that ignores our
`maxEntries` ceiling on the first re-write.

## §3. Behaviour (`clearAllTileCaches`)

| Scenario                                                                       | Returns                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| All three caches hold entries                                                  | `{ perCache: { 'osm-tiles': N1, 'nlsc-tiles': N2, 'google-tiles': N3 } }`.                        |
| Mix of empty and populated caches                                              | Same shape; `0` for any empty cache.                                                              |
| Storage layer throws on one cache only                                         | The two surviving caches still report their `deleted` counts; the failing cache reports `0`.      |

**SAFETY** (research D9): The function MUST iterate `TILE_CACHE_NAMES`
and call `clearCache(name)` for each. It MUST NOT call
`storage.keys()` or any other cache-name discovery API. A fake
storage containing
`['osm-tiles', 'nlsc-tiles', 'google-tiles', 'workbox-precache-v2-1234']`
MUST leave the precache cache **bit-identical** after a call.

## §4. Behaviour (`purgeExpired`)

| Entry's `Response.headers.get('date')`              | Decision                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Parseable HTTP-date, age ≤ `ttlDays * 86400_000` ms | KEEP.                                                               |
| Parseable HTTP-date, age > `ttlDays * 86400_000` ms | DELETE.                                                             |
| Missing OR unparseable                              | DELETE (conservative fallback per D2).                              |
| `cache.match(req)` returns undefined                | DELETE (an entry whose response cannot be retrieved is unusable).   |

Returns `{ deleted, kept }` such that `deleted + kept` equals the
initial entry count.

**Performance** (research D2): the implementation walks
`cache.keys()` in batches of 256, awaiting `setTimeout(0)` between
batches, so a 4096-entry purge yields the main thread at least 16
times. Worst-case wall-clock ≤ 800 ms (plan budget).

## §5. Behaviour (`enforceMaxEntries`)

| State                                          | Action                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `keys.length ≤ cap`                            | No-op. Returns `{ deleted: 0, kept: keys.length }`.                                                                                   |
| `keys.length > cap`                            | Deletes the FIRST `(keys.length - cap)` entries from `cache.keys()` (oldest-first per insertion order; research D11).                |

**Critical safety property** (research D12 #3): asserted by the unit
spec **before** implementation lands:

```ts
it('keeps exactly the most-recent `cap` keys', async () => {
  const cache = makeFakeCache();
  for (let i = 0; i < 100; i++) await cache.put(`tile-${i}`, ...);
  const { deleted, kept } = await enforceMaxEntries('osm-tiles', 30, fakeStorage);
  expect(deleted).toBe(70);
  expect(kept).toBe(30);
  const remaining = await (await fakeStorage.open('osm-tiles')).keys();
  expect(remaining.map(r => r.url)).toEqual(
    Array.from({ length: 30 }, (_, i) => expect.stringContaining(`tile-${i + 70}`)),
  );
});
```

## §6. Behaviour (`enforceCachePolicy`)

For each `name` in `TILE_CACHE_NAMES`:

1. Call `purgeExpired(name, ttlDays, now, storage)` — get `{deleted: e1, kept: k1}`.
2. Call `enforceMaxEntries(name, cap, storage)` — get `{deleted: e2, kept: k2}`.
3. Record `{ deleted: e1 + e2, kept: k2 }` for that name.

The two phases run in series (not parallel) per cache, so the second
phase sees the post-purge keyset. The three caches' work runs in
parallel via `Promise.all`.

## §7. What this module MUST NOT do

- MUST NOT delete `workbox-precache-v2-*` (or any cache name not in
  `TILE_CACHE_NAMES`). Enforced by INV in `cachePolicy.spec.ts` plus
  a dedicated test in `cachePurge.spec.ts` (see §9).
- MUST NOT call `storage.delete(name)` (whole-namespace delete) — uses
  per-entry `cache.delete(req)` only.
- MUST NOT pre-fetch any tile (FR-021). The module exports zero
  symbols whose name contains `prefetch` / `download` / `export` /
  `populate`.
- MUST NOT block the main thread > 50 ms continuously. The yield
  pattern `await new Promise(r => setTimeout(r, 0))` every 256
  deletions is mandatory.

## §8. Performance contract

| Function                            | Budget                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearCache(N entries)`             | p95 < 500 ms for N=4096; p95 < 1 s for N=8192.                                                                                                       |
| `clearAllTileCaches`                | p95 < 1.5 s when each cache holds 4096 entries (3 caches in parallel; the slowest dictates the wall-clock).                                          |
| `purgeExpired(N entries)`           | p95 < 800 ms for N=4096 with 25 % aged out.                                                                                                          |
| `enforceMaxEntries(8192 → 256)`     | p95 < 500 ms (deletes ~7900 entries; insertion-order delete is O(delta) on the iterator + per-delete IDB transaction).                               |
| `enforceCachePolicy`                | Driven by the per-cache budgets above; the parallel fan-out across 3 caches doesn't materially change the wall-clock.                                |

## §9. Required tests

`tests/unit/pwa/cachePurge.spec.ts` MUST cover, using
`tests/unit/helpers/cacheStorageFake.ts`:

### Safety (TDD — RED before implementation)

1. **`clearAllTileCaches does not delete workbox-precache-v2-*`** —
   given a fake storage with 4 caches (the 3 tile + 1 precache), call
   `clearAllTileCaches` and assert the precache's keys are untouched
   (count + URLs identical).
2. **`enforceMaxEntries trims to exactly cap`** — given a 100-entry
   cache, `enforceMaxEntries('osm-tiles', 30)` leaves exactly 30
   entries.
3. **`enforceMaxEntries deletes oldest-first`** — given keys
   `[tile-0..tile-99]` inserted in order, after a trim to 30 the
   remaining keys are `[tile-70..tile-99]`.
4. **`purgeExpired keeps fresh entries`** — given a cache with one
   entry that has `Date: <now - 1 day>` and TTL = 7, the entry
   survives.
5. **`purgeExpired deletes stale entries`** — given a cache with one
   entry that has `Date: <now - 30 days>` and TTL = 7, the entry is
   deleted.
6. **`purgeExpired deletes entries with missing date header`** —
   conservative fallback (research D2).

### Behaviour

7. **`clearCache returns the deleted count`** for N ∈ {0, 1, 256}.
8. **`clearCache uses per-entry delete, NOT storage.delete(name)`** —
   spy on the fake storage's `delete` method, expect 0 calls.
9. **`clearAllTileCaches returns per-cache counts`** — populate two of
   three caches; assert the unpopulated cache reports `0`.
10. **`enforceCachePolicy runs purgeExpired before enforceMaxEntries`**
    — sequence asserted by inserting a stale entry and asserting it
    is in the `purgeExpired` deletion bucket, not the
    `enforceMaxEntries` bucket.

### Performance

11. **`enforceMaxEntries yields the main thread`** — uses a fake
    `setTimeout` spy and asserts ≥ ⌈delta / 256⌉ awaits.
12. **`purgeExpired yields the main thread`** — same pattern.

### Resilience

13. **`clearCache returns deleted=0 when storage is undefined`**.
14. **`enforceMaxEntries no-ops when keys.length ≤ cap`** — returns
    `{ deleted: 0, kept: original }`.
