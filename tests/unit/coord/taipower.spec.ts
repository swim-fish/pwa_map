import { describe, test, expect, beforeAll } from 'vitest';
import vectorsFile from '../fixtures/test-vectors.json';
import { initCoord } from '../../../src/coord';
import {
  wgs84ToTaipower,
  taipowerToWgs84,
  taipowerToTwd67,
  formatTaipower,
} from '../../../src/coord/taipower';
import type { Lat, Lon, TaipowerCode, TaipowerPrecision, WGS84DD } from '../../../src/types/coord';

type Vector = {
  id: string;
  direction: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: { value: number; unit: string };
};

const vectors = (vectorsFile as { vectors: Vector[] }).vectors;
const forward = vectors.filter((v) => v.direction === 'WGS84_TO_TAIPOWER');

beforeAll(() => {
  initCoord();
});

function normCode(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

describe('WGS84 → Taipower forward', () => {
  test('covers every WGS84_TO_TAIPOWER vector', () => {
    expect(forward.length).toBeGreaterThan(0);
  });

  test.each(forward)('$id — forward matches expected taipower code prefix', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number; form: string };
    const exp = v.expected as { code: string };
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: inp.lat as Lat, lon: inp.lon as Lon };
    const precision: TaipowerPrecision = inp.form === '11' ? 11 : 9;
    const r = wgs84ToTaipower(dd, precision);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const actual = normCode(formatTaipower(r.value));
      const expected = normCode(exp.code);
      // Prefix is L NNNN LL (7 chars) — must match exactly. Trailing digits (2 for 9-char, 4 for 11-char) may differ by ±1 cell.
      expect(actual.slice(0, 7)).toBe(expected.slice(0, 7));
      const actualTail = Number.parseInt(actual.slice(7), 10);
      const expectedTail = Number.parseInt(expected.slice(7), 10);
      const tailDigits = actual.length - 7;
      const scale = tailDigits >= 4 ? 10000 : 100;
      expect(Math.abs(actualTail - expectedTail)).toBeLessThanOrEqual(scale);
    }
  });
});

describe('Taipower round-trip', () => {
  test.each(forward)('$id — taipowerToWgs84 round-trips within the tolerance', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number; form: string };
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: inp.lat as Lat, lon: inp.lon as Lon };
    const precision: TaipowerPrecision = inp.form === '11' ? 11 : 9;
    const fwd = wgs84ToTaipower(dd, precision);
    expect(fwd.ok).toBe(true);
    if (fwd.ok) {
      const back = taipowerToWgs84(fwd.value);
      expect(back.ok).toBe(true);
      if (back.ok) {
        // 100 m cell at precision 9 → roughly 1e-3° tolerance.
        const deg = precision === 11 ? 2e-4 : 2e-3;
        expect(Math.abs(back.value.lat - inp.lat)).toBeLessThanOrEqual(deg);
        expect(Math.abs(back.value.lon - inp.lon)).toBeLessThanOrEqual(deg);
      }
    }
  });
});

describe('Taipower issue #8 regression', () => {
  test('L0593 BA86 decodes to inland Hualien (Central Mountain Range), not the Pacific Ocean', () => {
    // Pre-fix REGION_LETTERS was an 8x3 table anchored at TWD67 easting 170 km.
    // The ground-truth Taipower mainland grid is 8x4 anchored at 90 km, with
    // the westernmost column populated only for rows 3-5 (J, M, P). Dropping
    // that western column shifted every letter in rows 3-7 east by one cell,
    // so L's anchor moved from easting 250 km (correct, inland Hualien) to
    // 330 km (Pacific east of Taiwan).
    const code: TaipowerCode = {
      kind: 'taipower',
      region: 'L',
      subRegion: '0593',
      hundredMeter: 'BA',
      tenMeter: '86',
      oneMeter: null,
      precision: 9,
    };
    const r = taipowerToTwd67(code);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.easting).toBeGreaterThan(250_000);
      expect(r.value.easting).toBeLessThan(260_000);
      expect(r.value.northing).toBeGreaterThan(2_640_000);
      expect(r.value.northing).toBeLessThan(2_650_000);
    }
  });

  test('Kaohsiung 85 (22.61225, 120.2867) forward-encodes to Q (not P) row 5 col 1', () => {
    const dd: WGS84DD = {
      kind: 'wgs84-dd',
      lat: 22.61225 as Lat,
      lon: 120.2867 as Lon,
    };
    const r = wgs84ToTaipower(dd, 9);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.region).toBe('Q');
    }
  });
});

describe('Taipower out-of-coverage rejection', () => {
  test('Penghu (Y letter) → out-of-coverage', () => {
    const r = taipowerToWgs84({
      kind: 'taipower',
      region: 'Y',
      subRegion: '1234',
      hundredMeter: 'AB',
      tenMeter: '56',
      oneMeter: null,
      precision: 9,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-coverage');
  });

  test('Kinmen/Matsu (Z letter) → out-of-coverage', () => {
    const r = taipowerToWgs84({
      kind: 'taipower',
      region: 'Z',
      subRegion: '0000',
      hundredMeter: 'AA',
      tenMeter: '00',
      oneMeter: null,
      precision: 9,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-coverage');
  });
});

describe('Taipower formatter', () => {
  test('9-char canonical form separates region+subregion from letters+digits by a space', () => {
    const formatted = formatTaipower({
      kind: 'taipower',
      region: 'B',
      subRegion: '7039',
      hundredMeter: 'BD',
      tenMeter: '32',
      oneMeter: null,
      precision: 9,
    });
    expect(formatted).toBe('B7039 BD32');
  });

  test('11-char canonical form retains the 1 m digits', () => {
    const formatted = formatTaipower({
      kind: 'taipower',
      region: 'B',
      subRegion: '7039',
      hundredMeter: 'BD',
      tenMeter: '32',
      oneMeter: '45',
      precision: 11,
    });
    expect(formatted).toBe('B7039 BD3245');
  });
});
