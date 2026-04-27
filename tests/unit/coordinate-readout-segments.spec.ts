import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coordinateSegments, type CoordinateSegment } from '../../src/coord/segments';
import type { CoordinateKind, Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 009 — coordinateSegments(kind, position, prefs) parity with Go To
// (FR-004 / FR-005 / FR-006 / FR-011 / SC-004).
//
// The pure helper composes existing converters / formatters and returns a
// `{ labelKey, value }[]` whose label-key list and order mirror the Go To
// layout for the same kind. This spec asserts that mirroring AND that
// the existing `format*()` helpers — used by the readout's copy button —
// remain the canonical single-string source of truth (no key collisions,
// no duplicated formatting code-path).

const REPO = process.cwd();

// Sample position deep inside Taiwan (Sun Moon Lake) — well within every
// supported coverage zone (TM2 zone 121, MGRS 51Q, Taipower main island).
const TAICHUNG_LAKE: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 23.85 as Lat,
  lon: 120.91 as Lon,
};

// Position outside Taiwan — used to drive the out-of-coverage sentinel
// for Taipower (and TWD67 / TM2 routinely return data; only Taipower's
// `wgs84ToTaipower` returns `{ ok: false }` outside coverage).
const TOKYO: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 35.6895 as Lat,
  lon: 139.6917 as Lon,
};

const PREFS = { mgrsPrecision: 5 as const, taipowerPrecision: 9 as const };

// The label-key list each Go To layout component renders for its inputs.
// Extracted by reading the layout source files (the data-testid /
// label-text invariants are already pinned by feature 002 specs).
const GOTO_LABEL_KEYS: Record<CoordinateKind, readonly string[]> = {
  'wgs84-dd': ['goto.fields.lat', 'goto.fields.lon'],
  'wgs84-dms': [
    'goto.fields.latDeg',
    'goto.fields.latMin',
    'goto.fields.latSec',
    'goto.fields.hemNS',
    'goto.fields.lonDeg',
    'goto.fields.lonMin',
    'goto.fields.lonSec',
    'goto.fields.hemEW',
  ],
  'twd97-tm2': ['goto.fields.easting', 'goto.fields.northing', 'goto.fields.zone'],
  'twd67-tm2': ['goto.fields.easting', 'goto.fields.northing'],
  mgrs: [
    'goto.fields.gzdBand',
    'goto.fields.square',
    'goto.fields.easting',
    'goto.fields.northing',
  ],
  taipower: ['goto.fields.first5', 'goto.fields.last4or6', 'goto.fields.precision'],
};

// Feature 010 dropped the user-facing precision selector from
// TaipowerLayout (FR-015 — auto-precision from input length). The
// readout's per-format segment shape is unchanged; only the Go To input
// no longer references the `goto.fields.precision` key. This narrowed
// list is what the layout-source assertion checks for `taipower`.
const GOTO_LAYOUT_LABEL_KEYS_OVERRIDE: Partial<Record<CoordinateKind, readonly string[]>> = {
  taipower: ['goto.fields.first5', 'goto.fields.last4or6'],
};

// Confirm the label-key invariant by also reading the layout source files
// — protects against silent renaming on the Go To side.
function assertLayoutSourceUsesKeys(layoutPath: string, keys: readonly string[]): void {
  const src = readFileSync(resolve(REPO, layoutPath), 'utf8');
  for (const key of keys) {
    // Skip hemisphere group keys (hemNS / hemEW) — they appear as aria-label
    // strings in the layout, not as visible <span> labels for individual inputs.
    if (key === 'goto.fields.hemNS' || key === 'goto.fields.hemEW') {
      expect(src, `${layoutPath} should reference ${key}`).toMatch(
        new RegExp(`['"]${key.replace(/\./g, '\\.')}['"]`),
      );
      continue;
    }
    expect(src, `${layoutPath} should reference ${key} as a field label`).toMatch(
      new RegExp(`tStore\\(['"]${key.replace(/\./g, '\\.')}['"]\\)`),
    );
  }
}

describe('feature 009 — coordinateSegments(): label-key parity with Go To', () => {
  test('Go To layout source files use the label keys recorded above', () => {
    assertLayoutSourceUsesKeys('src/components/goto/DdLayout.svelte', GOTO_LABEL_KEYS['wgs84-dd']);
    assertLayoutSourceUsesKeys(
      'src/components/goto/DmsLayout.svelte',
      GOTO_LABEL_KEYS['wgs84-dms'],
    );
    assertLayoutSourceUsesKeys(
      'src/components/goto/Tm2Layout.svelte',
      GOTO_LABEL_KEYS['twd97-tm2'],
    );
    assertLayoutSourceUsesKeys(
      'src/components/goto/Twd67Layout.svelte',
      GOTO_LABEL_KEYS['twd67-tm2'],
    );
    assertLayoutSourceUsesKeys('src/components/goto/MgrsLayout.svelte', GOTO_LABEL_KEYS.mgrs);
    assertLayoutSourceUsesKeys(
      'src/components/goto/TaipowerLayout.svelte',
      GOTO_LAYOUT_LABEL_KEYS_OVERRIDE.taipower ?? GOTO_LABEL_KEYS.taipower,
    );
  });

  for (const kind of [
    'wgs84-dd',
    'wgs84-dms',
    'twd97-tm2',
    'twd67-tm2',
    'mgrs',
    'taipower',
  ] as const) {
    test(`coordinateSegments('${kind}', …) returns segments whose labelKey order matches Go To`, () => {
      const result = coordinateSegments(kind, TAICHUNG_LAKE, PREFS);
      if (!('coverage' in result) || result.coverage !== 'ok') {
        throw new Error(
          `expected coverage: ok for ${kind} at Taichung sample, got ${JSON.stringify(result)}`,
        );
      }
      const segs: readonly CoordinateSegment[] = result.segments;
      expect(segs.map((s) => s.labelKey)).toEqual(GOTO_LABEL_KEYS[kind]);
      // Every value is a non-empty string.
      for (const s of segs) {
        expect(typeof s.value).toBe('string');
        expect(s.value.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('feature 009 — coordinateSegments(): out-of-coverage sentinel', () => {
  test('Taipower returns { coverage: "out-of-coverage" } when the position is outside Taiwan', () => {
    const r = coordinateSegments('taipower', TOKYO, PREFS);
    expect(r).toEqual({ coverage: 'out-of-coverage' });
  });
});

describe('feature 009 — coordinateSegments(): purity & input-immutability', () => {
  test('does not mutate position or prefs', () => {
    const pos: WGS84DD = { ...TAICHUNG_LAKE };
    const prefs = { ...PREFS };
    coordinateSegments('wgs84-dms', pos, prefs);
    expect(pos).toEqual(TAICHUNG_LAKE);
    expect(prefs).toEqual(PREFS);
  });

  test('two calls with the same input produce structurally identical output', () => {
    const a = coordinateSegments('mgrs', TAICHUNG_LAKE, PREFS);
    const b = coordinateSegments('mgrs', TAICHUNG_LAKE, PREFS);
    expect(a).toEqual(b);
  });
});

describe('feature 009 — CoordinateReadout regression net (FR-005 canonical copy)', () => {
  test('CoordinateReadout.svelte still imports the canonical format*() helpers for the copy button', () => {
    const src = readFileSync(resolve(REPO, 'src/components/CoordinateReadout.svelte'), 'utf8');
    // The copy path MUST go through format*() (preserving the existing
    // canonical single-string contract — pasting after this feature lands
    // produces the same string as before).
    expect(src).toMatch(/formatWGS84DD/);
    expect(src).toMatch(/formatWGS84DMS/);
    expect(src).toMatch(/formatTWD97TM2/);
    expect(src).toMatch(/formatTWD67TM2/);
    expect(src).toMatch(/formatMGRS/);
    expect(src).toMatch(/formatTaipower/);
  });

  test('CoordinateReadout.svelte calls coordinateSegments for the displayed rows', () => {
    const src = readFileSync(resolve(REPO, 'src/components/CoordinateReadout.svelte'), 'utf8');
    expect(src).toMatch(/coordinateSegments/);
  });
});
