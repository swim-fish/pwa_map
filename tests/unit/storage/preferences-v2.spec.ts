import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPreferences,
  savePreferences,
  defaultPreferences,
  loadTileTtlDays,
  saveTileTtlDays,
  loadTileMaxEntries,
  saveTileMaxEntries,
  __TESTING__,
} from '../../../src/storage/preferences';
import {
  TTL_OPTIONS,
  MAX_ENTRIES_OPTIONS,
  DEFAULT_TILE_TTL_DAYS,
  DEFAULT_TILE_MAX_ENTRIES,
} from '../../../src/pwa/cachePolicy';

const { PREFS_KEY } = __TESTING__;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

describe('preferences v1→v2 migration (contracts/preferences-v2.md §8)', () => {
  it('(1) loadPreferences returns defaults when storage empty', () => {
    const p = loadPreferences();
    expect(p.tileTtlDays).toBe(DEFAULT_TILE_TTL_DAYS);
    expect(p.tileMaxEntries).toBe(DEFAULT_TILE_MAX_ENTRIES);
    // Feature 010 bumped the schema to v3; the validator always normalises
    // to the current PREFS_VERSION on every successful path.
    expect(p.version).toBe(3);
  });

  it('(2) v1 record is upgraded with default v2 fields on load', () => {
    const v1Record = {
      version: 1,
      visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs'],
      mgrsPrecision: 5,
      taipowerPrecision: 9,
      locale: 'zh',
      mapLayer: 'nlsc-emap5',
      overlay: false,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v1Record));

    const p = loadPreferences();

    expect(p.tileTtlDays).toBe(DEFAULT_TILE_TTL_DAYS);
    expect(p.tileMaxEntries).toBe(DEFAULT_TILE_MAX_ENTRIES);
    // Feature 010: v1 → v3 in one hop (additive evolution, ADR 0021).
    expect(p.version).toBe(3);
    expect(p.locale).toBe('zh');
    expect(p.mapLayer).toBe('nlsc-emap5');
    expect(p.mgrsPrecision).toBe(5);
  });

  describe('(3) v2 record round-trips for every (ttl, max) combination', () => {
    for (const ttl of TTL_OPTIONS) {
      for (const max of MAX_ENTRIES_OPTIONS) {
        it(`tileTtlDays=${ttl} tileMaxEntries=${max}`, () => {
          const base = defaultPreferences();
          savePreferences({ ...base, tileTtlDays: ttl, tileMaxEntries: max });
          const p = loadPreferences();
          expect(p.tileTtlDays).toBe(ttl);
          expect(p.tileMaxEntries).toBe(max);
        });
      }
    }
  });

  it('(4) out-of-range tileTtlDays is reset to default', () => {
    const base = defaultPreferences();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...base, tileTtlDays: 45 }));
    const p = loadPreferences();
    expect(p.tileTtlDays).toBe(DEFAULT_TILE_TTL_DAYS);
    // Other v2 fields preserved.
    expect(p.tileMaxEntries).toBe(base.tileMaxEntries);
    expect(p.locale).toBe(base.locale);
  });

  it('(5) out-of-range tileMaxEntries is reset to default', () => {
    const base = defaultPreferences();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...base, tileMaxEntries: 9999 }));
    const p = loadPreferences();
    expect(p.tileMaxEntries).toBe(DEFAULT_TILE_MAX_ENTRIES);
    expect(p.tileTtlDays).toBe(base.tileTtlDays);
  });

  it('(6) undefined v2 fields populated with defaults', () => {
    const v2Partial = {
      version: 2,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 9,
      locale: 'zh',
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v2Partial));
    const p = loadPreferences();
    expect(p.tileTtlDays).toBe(DEFAULT_TILE_TTL_DAYS);
    expect(p.tileMaxEntries).toBe(DEFAULT_TILE_MAX_ENTRIES);
  });

  describe('(7) loadTileTtlDays / saveTileTtlDays round-trip', () => {
    for (const ttl of TTL_OPTIONS) {
      it(`ttl=${ttl}`, () => {
        saveTileTtlDays(ttl);
        expect(loadTileTtlDays()).toBe(ttl);
      });
    }
  });

  describe('(8) loadTileMaxEntries / saveTileMaxEntries round-trip', () => {
    for (const max of MAX_ENTRIES_OPTIONS) {
      it(`max=${max}`, () => {
        saveTileMaxEntries(max);
        expect(loadTileMaxEntries()).toBe(max);
      });
    }
  });

  it('(9) saveTileTtlDays preserves the rest of the prefs', () => {
    const base = defaultPreferences();
    savePreferences({ ...base, locale: 'ja', mgrsPrecision: 3 });
    saveTileTtlDays(30);
    const p = loadPreferences();
    expect(p.locale).toBe('ja');
    expect(p.mgrsPrecision).toBe(3);
    expect(p.tileTtlDays).toBe(30);
  });

  it('(10) saveTileMaxEntries preserves the rest of the prefs', () => {
    const base = defaultPreferences();
    savePreferences({ ...base, locale: 'en' });
    saveTileMaxEntries(256);
    const p = loadPreferences();
    expect(p.locale).toBe('en');
    expect(p.tileMaxEntries).toBe(256);
  });

  it('(11) unknown version (3) falls back to defaults', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 3, locale: 'en' }));
    const p = loadPreferences();
    expect(p).toEqual(defaultPreferences());
  });
});
