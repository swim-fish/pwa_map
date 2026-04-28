import { describe, test, expect, beforeEach } from 'vitest';
import { defaultPreferences, loadPreferences, __TESTING__ } from '../../src/storage/preferences';

const { PREFS_KEY } = __TESTING__;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

// Feature 010 — invariants 4 (taipowerPrecision) and 5 from
// contracts/format-priority-schema.md and contracts/taipower-precision-autodetect.md.

describe('feature 010 — preferences defaults & taipowerPrecision migration', () => {
  test('(a) defaultPreferences().taipowerPrecision === 11 (FR-014)', () => {
    expect(defaultPreferences().taipowerPrecision).toBe(11);
  });

  test('(b) v2 record with taipowerPrecision: 9 → v3 keeps 9 (preserve-on-upgrade)', () => {
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
    expect(p.taipowerPrecision).toBe(9);
  });

  test('(c) v2 record with taipowerPrecision: 11 → v3 keeps 11', () => {
    const v2 = {
      version: 2,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v2));
    const p = loadPreferences();
    expect(p.taipowerPrecision).toBe(11);
  });

  test('(d) loadPreferences with empty storage returns the new default (11)', () => {
    const p = loadPreferences();
    expect(p.taipowerPrecision).toBe(11);
    expect(p.version).toBe(4);
  });
});
