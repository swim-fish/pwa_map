import { describe, test, expect, beforeEach } from 'vitest';
import {
  loadPreferences,
  savePreferences,
  defaultPreferences,
  DEFAULT_FORMAT_ORDER,
  __TESTING__,
} from '../../src/storage/preferences';
import type { CoordinateKind } from '../../src/types/coord';

const { PREFS_KEY } = __TESTING__;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

// Feature 010 — invariants 1, 2, 3, 4, 6 from contracts/format-priority-schema.md.

describe('feature 010 — preferences v3 formatOrder migration', () => {
  test('(1) v1 record loads with formatOrder = DEFAULT_FORMAT_ORDER', () => {
    const v1Record = {
      version: 1,
      visible: ['wgs84-dd', 'mgrs'],
      mgrsPrecision: 5,
      taipowerPrecision: 9,
      locale: 'zh',
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v1Record));
    const p = loadPreferences();
    expect(p.version).toBe(4);
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
  });

  test('(2) v2 record loads with formatOrder = DEFAULT_FORMAT_ORDER', () => {
    const v2Record = {
      version: 2,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 9,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v2Record));
    const p = loadPreferences();
    expect(p.version).toBe(4);
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
  });

  test('(3) v3 record with malformed formatOrder (wrong length) → fall back to default', () => {
    const v3Bad = {
      version: 3,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
      formatOrder: ['wgs84-dd'], // length 1, invalid
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v3Bad));
    const p = loadPreferences();
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
  });

  test('(3b) v3 record with duplicate kinds → fall back to default', () => {
    const v3Dup = {
      version: 3,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
      formatOrder: ['wgs84-dd', 'wgs84-dd', 'twd97-tm2', 'twd67-tm2', 'mgrs', 'taipower'],
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v3Dup));
    const p = loadPreferences();
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
  });

  test('(3c) v3 record with unknown kind → fall back to default', () => {
    const v3Unknown = {
      version: 3,
      visible: ['wgs84-dd'],
      mgrsPrecision: 5,
      taipowerPrecision: 11,
      locale: 'zh',
      tileTtlDays: 7,
      tileMaxEntries: 200,
      formatOrder: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'twd67-tm2', 'mgrs', 'unknown-format'],
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(v3Unknown));
    const p = loadPreferences();
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
  });

  test('(4) v3 record with valid formatOrder round-trips through save/load', () => {
    const newOrder: readonly CoordinateKind[] = [
      'mgrs',
      'taipower',
      'twd97-tm2',
      'twd67-tm2',
      'wgs84-dms',
      'wgs84-dd',
    ];
    const base = defaultPreferences();
    savePreferences({ ...base, formatOrder: newOrder });
    const p = loadPreferences();
    expect(p.formatOrder).toEqual(newOrder);
  });

  test('(6) defaultPreferences().formatOrder deep-equals DEFAULT_FORMAT_ORDER', () => {
    const p = defaultPreferences();
    expect(p.formatOrder).toEqual(DEFAULT_FORMAT_ORDER);
    expect(p.formatOrder.length).toBe(6);
  });

  test('(6b) DEFAULT_FORMAT_ORDER is a permutation of all 6 coordinate kinds', () => {
    expect(new Set(DEFAULT_FORMAT_ORDER).size).toBe(6);
    expect([...DEFAULT_FORMAT_ORDER].sort()).toEqual(
      ['mgrs', 'taipower', 'twd67-tm2', 'twd97-tm2', 'wgs84-dd', 'wgs84-dms'].sort(),
    );
  });
});
