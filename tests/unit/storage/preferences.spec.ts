import { describe, test, expect, beforeEach } from 'vitest';
import {
  loadPreferences,
  savePreferences,
  defaultPreferences,
  __TESTING__,
} from '../../../src/storage/preferences';

const PREFS_KEY = __TESTING__.PREFS_KEY;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

describe('preferences schema (feature 003 additive evolution)', () => {
  test('pre-003 prefs blob (no mapLayer / overlay) loads successfully and consumer applies defaults', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        version: 1,
        visible: ['wgs84-dd', 'twd97-tm2'],
        mgrsPrecision: 5,
        taipowerPrecision: 9,
        locale: 'zh',
      }),
    );
    const loaded = loadPreferences();
    // Pre-003 blobs round-trip with the saved values; defaults fill any
    // absent fields at the consumer layer (loadPreferences itself returns
    // the validated blob, which may omit optional fields).
    expect(loaded.locale).toBe('zh');
    expect(loaded.visible).toEqual(['wgs84-dd', 'twd97-tm2']);
    // mapLayer / overlay may be absent on a pre-003 blob — consumers fall
    // back via `prefs.mapLayer ?? 'osm-standard'` etc.
    expect(loaded.mapLayer ?? 'osm-standard').toBe('osm-standard');
    expect(loaded.overlay ?? false).toBe(false);
  });

  test('round-trip — saving with mapLayer / overlay round-trips exactly', () => {
    const prefs = {
      ...defaultPreferences(),
      mapLayer: 'nlsc-emap5' as const,
      overlay: true as const,
    };
    savePreferences(prefs);
    const loaded = loadPreferences();
    expect(loaded.mapLayer).toBe('nlsc-emap5');
    expect(loaded.overlay).toBe(true);
  });

  test('invalid mapLayer id rejects entire blob → returns defaults', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...defaultPreferences(),
        mapLayer: 'foo-not-a-known-id',
      }),
    );
    const loaded = loadPreferences();
    expect(loaded.mapLayer).toBe('osm-standard');
  });

  test('overlay id passed as mapLayer is rejected (overlay is not a basemap)', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...defaultPreferences(),
        mapLayer: 'google-road-overlay',
      }),
    );
    const loaded = loadPreferences();
    expect(loaded.mapLayer).toBe('osm-standard');
  });

  test('non-boolean overlay rejects entire blob → returns defaults', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...defaultPreferences(),
        overlay: 'true',
      }),
    );
    const loaded = loadPreferences();
    // Falls back to defaults — i.e., overlay false.
    expect(loaded.overlay).toBe(false);
  });

  test('defaultPreferences sets mapLayer="osm-standard" and overlay=false', () => {
    const def = defaultPreferences();
    expect(def.mapLayer).toBe('osm-standard');
    expect(def.overlay).toBe(false);
  });
});
