import { describe, test, expect, beforeEach } from 'vitest';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  loadLocateFrequency,
  saveLocateFrequency,
  __TESTING__,
  type LocateFrequencyPreset,
} from '../../src/storage/preferences';

const { PREFS_KEY, PREFS_VERSION, LOCATE_FREQUENCIES, LOCATE_FREQUENCY_DEFAULT } = __TESTING__;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

// Feature 013 — preferences v4 migration matrix
// (contracts/preferences-v4-locate-frequency.md).

describe('preferences v4 — defaults', () => {
  test('PREFS_VERSION === 4', () => {
    expect(PREFS_VERSION).toBe(4);
  });

  test('LOCATE_FREQUENCIES is the documented preset triple', () => {
    expect(LOCATE_FREQUENCIES).toEqual(['smart', 'fast', 'slow']);
  });

  test('LOCATE_FREQUENCY_DEFAULT is "smart" (FR-023)', () => {
    expect(LOCATE_FREQUENCY_DEFAULT).toBe<LocateFrequencyPreset>('smart');
  });

  test('defaultPreferences().locateFrequency === "smart"', () => {
    expect(defaultPreferences().locateFrequency).toBe<LocateFrequencyPreset>('smart');
  });

  test('defaultPreferences().version === 4', () => {
    expect(defaultPreferences().version).toBe(4);
  });
});

describe('preferences v4 — round-trip', () => {
  test.each<LocateFrequencyPreset>(['smart', 'fast', 'slow'])(
    'v4 round-trip with locateFrequency: %s',
    (preset) => {
      const prefs = { ...defaultPreferences(), locateFrequency: preset };
      savePreferences(prefs);
      const loaded = loadPreferences();
      expect(loaded.locateFrequency).toBe(preset);
      expect(loaded.version).toBe(4);
    },
  );
});

describe('preferences v4 — invalid locateFrequency falls back to "smart"', () => {
  test('v4 record with locateFrequency: "turbo" → smart', () => {
    const corrupt = { ...defaultPreferences(), locateFrequency: 'turbo' as never };
    localStorage.setItem(PREFS_KEY, JSON.stringify(corrupt));
    expect(loadPreferences().locateFrequency).toBe('smart');
  });

  test('v4 record with locateFrequency missing → smart', () => {
    // Build a v4 record with the field absent.
    const partial = { ...defaultPreferences() } as Record<string, unknown>;
    delete partial.locateFrequency;
    localStorage.setItem(PREFS_KEY, JSON.stringify(partial));
    expect(loadPreferences().locateFrequency).toBe('smart');
  });
});

describe('preferences v4 — additive migration from v3 / v2 / v1', () => {
  test('v3 record migrates additively → v4 with locateFrequency: "smart"', () => {
    const v3 = {
      version: 3,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
      formatOrder: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'twd67-tm2', 'mgrs', 'taipower'],
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v3));
    const p = loadPreferences();
    expect(p.version).toBe(4);
    expect(p.locateFrequency).toBe('smart');
    expect(p.taipowerPrecision).toBe(11);
    expect(p.locale).toBe('zh');
  });

  test('v2 record migrates → v4 with locateFrequency: "smart"', () => {
    const v2 = {
      version: 2,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 9,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v2));
    const p = loadPreferences();
    expect(p.version).toBe(4);
    expect(p.locateFrequency).toBe('smart');
    expect(p.taipowerPrecision).toBe(9);
  });

  test('v1 record migrates → v4 with locateFrequency: "smart"', () => {
    const v1 = {
      version: 1,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v1));
    const p = loadPreferences();
    expect(p.version).toBe(4);
    expect(p.locateFrequency).toBe('smart');
  });
});

describe('preferences v4 — corrupt input fallback', () => {
  test('unknown version (5) → full defaultPreferences()', () => {
    const future = { ...defaultPreferences(), version: 5 as never };
    localStorage.setItem(PREFS_KEY, JSON.stringify(future));
    const p = loadPreferences();
    expect(p).toEqual(defaultPreferences());
  });

  test('corrupt JSON → full defaultPreferences()', () => {
    localStorage.setItem(PREFS_KEY, '{not-valid-json');
    expect(loadPreferences()).toEqual(defaultPreferences());
  });

  test('empty storage → full defaultPreferences()', () => {
    expect(loadPreferences()).toEqual(defaultPreferences());
  });
});

describe('preferences v4 — convenience load/save pair', () => {
  test('loadLocateFrequency() returns "smart" by default', () => {
    expect(loadLocateFrequency()).toBe('smart');
  });

  test('saveLocateFrequency() round-trips and does not clobber other fields', () => {
    const before = loadPreferences();
    saveLocateFrequency('fast');
    const after = loadPreferences();
    expect(after.locateFrequency).toBe('fast');
    expect(after.locale).toBe(before.locale);
    expect(after.taipowerPrecision).toBe(before.taipowerPrecision);
    expect(after.formatOrder).toEqual(before.formatOrder);
    expect(after.tileTtlDays).toBe(before.tileTtlDays);
    expect(after.tileMaxEntries).toBe(before.tileMaxEntries);
  });

  test.each<LocateFrequencyPreset>(['smart', 'fast', 'slow'])(
    'saveLocateFrequency(%s) round-trips',
    (preset) => {
      saveLocateFrequency(preset);
      expect(loadLocateFrequency()).toBe(preset);
    },
  );
});
