import { describe, test, expect, beforeAll } from 'vitest';
import vectorsFile from '../fixtures/test-vectors.json';
import { initCoord } from '../../../src/coord';
import { wgs84ToTwd97, twd97ToWgs84 } from '../../../src/coord/twd97';
import type { Easting, Lat, Lon, Northing, WGS84DD, Zone } from '../../../src/types/coord';

type Vector = {
  id: string;
  direction: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: { value: number; unit: string };
  notes?: string;
};

const vectors = (vectorsFile as { vectors: Vector[] }).vectors;
const forward = vectors.filter((v) => v.direction === 'WGS84_TO_TM2');

function asZone(s: unknown): Zone {
  const n = typeof s === 'string' ? Number.parseInt(s, 10) : (s as number);
  if (n !== 119 && n !== 121) throw new Error(`unexpected zone ${String(s)}`);
  return n as Zone;
}

beforeAll(() => {
  initCoord();
});

describe('WGS84 → TWD97 TM2', () => {
  test('covers every WGS84_TO_TM2 vector', () => {
    expect(forward.length).toBeGreaterThan(0);
  });

  test.each(forward)('$id — forward matches within tolerance', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number };
    const exp = v.expected as { easting: number; northing: number; zone: string | number };
    const zone = asZone(exp.zone);
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: inp.lat as Lat, lon: inp.lon as Lon };
    const actual = wgs84ToTwd97(dd, zone);
    expect(actual.zone).toBe(zone);
    expect(Math.abs(actual.easting - exp.easting)).toBeLessThanOrEqual(v.tolerance.value);
    expect(Math.abs(actual.northing - exp.northing)).toBeLessThanOrEqual(v.tolerance.value);
  });
});

describe('TWD97 TM2 → WGS84 (round-trip)', () => {
  test.each(forward)('$id — inverse round-trips within 0.1 m equivalent (≈ 1e-6°)', (v: Vector) => {
    const inp = v.input as { lat: number; lon: number };
    const exp = v.expected as { easting: number; northing: number; zone: string | number };
    const zone = asZone(exp.zone);
    const tm2 = {
      kind: 'twd97-tm2' as const,
      easting: exp.easting as Easting,
      northing: exp.northing as Northing,
      zone,
    };
    const back = twd97ToWgs84(tm2);
    expect(Math.abs(back.lat - inp.lat)).toBeLessThanOrEqual(1e-5);
    expect(Math.abs(back.lon - inp.lon)).toBeLessThanOrEqual(1e-5);
  });
});

describe('zone auto-pick on wgs84ToTwd97', () => {
  test('omitted zone → picks 121 for lon >= 120', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
    const actual = wgs84ToTwd97(dd);
    expect(actual.zone).toBe(121);
  });

  test('omitted zone → picks 119 for lon < 120 (Magong)', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: 23.565 as Lat, lon: 119.566 as Lon };
    const actual = wgs84ToTwd97(dd);
    expect(actual.zone).toBe(119);
  });
});
