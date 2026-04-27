import { describe, it, expect } from 'vitest';
import {
  TILE_CACHE_NAMES,
  TTL_OPTIONS,
  MAX_ENTRIES_OPTIONS,
  DEFAULT_TILE_TTL_DAYS,
  DEFAULT_TILE_MAX_ENTRIES,
  TILE_CACHE_MAX_AGE_DAYS_CEILING,
  TILE_CACHE_MAX_ENTRIES_CEILING,
  SOURCE_LABEL_KEY,
} from '../../../src/pwa/cachePolicy';

describe('cachePolicy invariants (contracts/cache-policy.md §2)', () => {
  it('INV-1 all four exported objects are Object.isFrozen', () => {
    expect(Object.isFrozen(TILE_CACHE_NAMES)).toBe(true);
    expect(Object.isFrozen(TTL_OPTIONS)).toBe(true);
    expect(Object.isFrozen(MAX_ENTRIES_OPTIONS)).toBe(true);
    expect(Object.isFrozen(SOURCE_LABEL_KEY)).toBe(true);
  });

  it('INV-2 TILE_CACHE_NAMES is exactly [osm-tiles, nlsc-tiles, google-tiles] in order', () => {
    expect(TILE_CACHE_NAMES).toEqual(['osm-tiles', 'nlsc-tiles', 'google-tiles']);
    expect(TILE_CACHE_NAMES.length).toBe(3);
  });

  it('INV-3 TTL_OPTIONS is length 7, sorted ascending, all positive integers ≤ 90', () => {
    expect(TTL_OPTIONS.length).toBe(7);
    for (let i = 1; i < TTL_OPTIONS.length; i++) {
      expect(TTL_OPTIONS[i]).toBeGreaterThan(TTL_OPTIONS[i - 1]);
    }
    for (const v of TTL_OPTIONS) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(90);
    }
  });

  it('INV-4 MAX_ENTRIES_OPTIONS is length 6, sorted ascending, powers of two between 256 and 8192', () => {
    expect(MAX_ENTRIES_OPTIONS.length).toBe(6);
    for (let i = 1; i < MAX_ENTRIES_OPTIONS.length; i++) {
      expect(MAX_ENTRIES_OPTIONS[i]).toBeGreaterThan(MAX_ENTRIES_OPTIONS[i - 1]);
    }
    for (const v of MAX_ENTRIES_OPTIONS) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(256);
      expect(v).toBeLessThanOrEqual(8192);
      // Power of two: only one bit set
      expect((v & (v - 1)) === 0).toBe(true);
    }
  });

  it('INV-5 DEFAULT_TILE_TTL_DAYS === 7 and is a member of TTL_OPTIONS', () => {
    expect(DEFAULT_TILE_TTL_DAYS).toBe(7);
    expect((TTL_OPTIONS as readonly number[]).includes(DEFAULT_TILE_TTL_DAYS)).toBe(true);
  });

  it('INV-6 DEFAULT_TILE_MAX_ENTRIES === 4096 and is a member of MAX_ENTRIES_OPTIONS', () => {
    expect(DEFAULT_TILE_MAX_ENTRIES).toBe(4096);
    expect((MAX_ENTRIES_OPTIONS as readonly number[]).includes(DEFAULT_TILE_MAX_ENTRIES)).toBe(
      true,
    );
  });

  it('INV-7 TILE_CACHE_MAX_AGE_DAYS_CEILING === max(TTL_OPTIONS)', () => {
    expect(TILE_CACHE_MAX_AGE_DAYS_CEILING).toBe(Math.max(...TTL_OPTIONS));
  });

  it('INV-8 TILE_CACHE_MAX_ENTRIES_CEILING === max(MAX_ENTRIES_OPTIONS)', () => {
    expect(TILE_CACHE_MAX_ENTRIES_CEILING).toBe(Math.max(...MAX_ENTRIES_OPTIONS));
  });

  it('INV-9 every TILE_CACHE_NAMES entry has a matching SOURCE_LABEL_KEY', () => {
    expect(Object.keys(SOURCE_LABEL_KEY).sort()).toEqual([...TILE_CACHE_NAMES].sort());
  });
});

describe('cachePolicy safety + side-effect-free import', () => {
  it('TILE_CACHE_NAMES does NOT include workbox-precache-v2', () => {
    expect((TILE_CACHE_NAMES as readonly string[]).includes('workbox-precache-v2')).toBe(false);
  });

  it('importing the module twice yields the same frozen object references', async () => {
    const a = await import('../../../src/pwa/cachePolicy');
    const b = await import('../../../src/pwa/cachePolicy');
    expect(a.TILE_CACHE_NAMES).toBe(b.TILE_CACHE_NAMES);
    expect(a.TTL_OPTIONS).toBe(b.TTL_OPTIONS);
    expect(a.MAX_ENTRIES_OPTIONS).toBe(b.MAX_ENTRIES_OPTIONS);
    expect(a.SOURCE_LABEL_KEY).toBe(b.SOURCE_LABEL_KEY);
  });
});
