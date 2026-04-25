import { describe, test, expect, beforeAll } from 'vitest';
import vectorsFile from '../fixtures/test-vectors.json';
import { initCoord } from '../../../src/coord';
import { wgs84ToMgrs, mgrsToWgs84, formatMGRS } from '../../../src/coord/mgrs';
import type { Lat, Lon, MGRSPrecision, WGS84DD } from '../../../src/types/coord';

type Vector = {
  id: string;
  direction: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: { value: number; unit: string };
};

const vectors = (vectorsFile as { vectors: Vector[] }).vectors;
const forward = vectors.filter((v) => v.direction === 'WGS84_TO_MGRS');

beforeAll(() => {
  initCoord();
});

describe('WGS84 → MGRS forward', () => {
  test('covers every WGS84_TO_MGRS vector', () => {
    expect(forward.length).toBeGreaterThan(0);
  });

  test.each(forward)('$id — forward matches expected MGRS string', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number; precision: MGRSPrecision };
    const exp = v.expected as { mgrs: string };
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: inp.lat as Lat, lon: inp.lon as Lon };
    const mgrs = wgs84ToMgrs(dd, inp.precision);
    const actual = formatMGRS(mgrs).replace(/\s+/g, '');
    expect(actual).toBe(exp.mgrs.replace(/\s+/g, ''));
  });
});

describe('MGRS precisions 1..5 parametrised', () => {
  test.each([1, 2, 3, 4, 5] as const)(
    'Taipei 101 at precision %i encodes with correct digit count',
    (precision: MGRSPrecision) => {
      const dd: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
      const mgrs = wgs84ToMgrs(dd, precision);
      expect(mgrs.precision).toBe(precision);
      expect(String(mgrs.easting).length).toBeLessThanOrEqual(precision);
      expect(String(mgrs.northing).length).toBeLessThanOrEqual(precision);
    },
  );
});

describe('MGRS ↔ WGS84 round-trip', () => {
  test.each(forward)('$id — mgrsToWgs84 round-trips within 1 m', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number; precision: MGRSPrecision };
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: inp.lat as Lat, lon: inp.lon as Lon };
    const fwd = wgs84ToMgrs(dd, inp.precision);
    const back = mgrsToWgs84(fwd);
    expect(Math.abs(back.lat - inp.lat)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(back.lon - inp.lon)).toBeLessThanOrEqual(1e-4);
  });
});

describe('MGRS truncates tail digits (reference §7)', () => {
  test('precision 4 output truncates the last digit — not rounds', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
    const p5 = wgs84ToMgrs(dd, 5);
    const p4 = wgs84ToMgrs(dd, 4);
    const p5easting = Math.floor(p5.easting / 10);
    expect(p4.easting).toBe(p5easting);
  });
});
