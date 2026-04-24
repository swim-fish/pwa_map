import { describe, test, expect } from 'vitest';
import vectorsFile from '../fixtures/test-vectors.json';
import {
  makeWGS84DD,
  formatWGS84DD,
  ddToDms,
  dmsToDd,
  type AxisKind,
} from '../../../src/coord/wgs84';
import type { DMSPart, Lat, Lon, WGS84DD } from '../../../src/types/coord';

type Vector = {
  id: string;
  direction: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: { value: number; unit: string };
};

const vectors = (vectorsFile as { vectors: Vector[] }).vectors;

const ddToDmsVectors = vectors.filter((v) => v.direction === 'DD_TO_DMS');
const dmsToDdVectors = vectors.filter((v) => v.direction === 'DMS_TO_DD');

const ROUND_TRIP_TOLERANCE_DEG = 1e-7;

function axisKind(v: Vector): AxisKind {
  return v.input.axis === 'lat' || v.expected.axis === 'lat' ? 'lat' : 'lon';
}

describe('makeWGS84DD', () => {
  test('accepts a valid Taiwan coordinate', () => {
    const r = makeWGS84DD(25.033611, 121.564472);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe('wgs84-dd');
      expect(r.value.lat).toBeCloseTo(25.033611, 6);
      expect(r.value.lon).toBeCloseTo(121.564472, 6);
    }
  });

  test('accepts the origin (0,0)', () => {
    const r = makeWGS84DD(0, 0);
    expect(r.ok).toBe(true);
  });

  test('accepts the latitude boundary exactly', () => {
    expect(makeWGS84DD(90, 0).ok).toBe(true);
    expect(makeWGS84DD(-90, 0).ok).toBe(true);
  });

  test('accepts the longitude boundary exactly', () => {
    expect(makeWGS84DD(0, 180).ok).toBe(true);
    expect(makeWGS84DD(0, -180).ok).toBe(true);
  });

  test('rejects lat > 90 as out-of-range', () => {
    const r = makeWGS84DD(95, 121);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('rejects lat < -90 as out-of-range', () => {
    const r = makeWGS84DD(-95, 121);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('rejects lon > 180 as out-of-range', () => {
    const r = makeWGS84DD(25, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('rejects NaN latitude as malformed', () => {
    const r = makeWGS84DD(Number.NaN, 121);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('rejects +Infinity as malformed', () => {
    const r = makeWGS84DD(Number.POSITIVE_INFINITY, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });
});

describe('formatWGS84DD', () => {
  test('formats Taipei 101 to the canonical 6-decimal string', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
    expect(formatWGS84DD(dd)).toBe('25.033611, 121.564472');
  });

  test('formats negative values with the minus sign', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: -23.5 as Lat, lon: -121 as Lon };
    expect(formatWGS84DD(dd)).toBe('-23.500000, -121.000000');
  });

  test('output round-trips through makeWGS84DD after re-parsing', () => {
    const dd: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
    const formatted = formatWGS84DD(dd);
    const [latStr, lonStr] = formatted.split(',').map((s) => s.trim());
    const reparse = makeWGS84DD(Number.parseFloat(latStr), Number.parseFloat(lonStr));
    expect(reparse.ok).toBe(true);
    if (reparse.ok) {
      expect(reparse.value.lat).toBeCloseTo(dd.lat, 6);
      expect(reparse.value.lon).toBeCloseTo(dd.lon, 6);
    }
  });
});

// expected.dd in the reference vectors is rounded to 6 decimal places (HULP = 5e-7°).
// Effective comparison bound = vector.tolerance + HULP.
const DD_HULP = 5e-7;

describe('DMS → DD (DD-side assertions only)', () => {
  test('covers every DMS_TO_DD vector', () => {
    expect(dmsToDdVectors.length).toBeGreaterThan(0);
  });

  test.each(dmsToDdVectors)('$id — dmsToDd output DD matches input.dd', (v: Vector) => {
    const exp = v.expected as { dd: number };
    const inp = v.input as {
      deg: number;
      min: number;
      sec: number;
      hemisphere: 'N' | 'S' | 'E' | 'W';
    };
    const part: DMSPart = {
      deg: inp.deg,
      min: inp.min,
      sec: inp.sec,
      hemisphere: inp.hemisphere,
    };
    const actual = dmsToDd(part);
    const bound = v.tolerance.value + DD_HULP;
    expect(Math.abs(actual - exp.dd)).toBeLessThanOrEqual(bound);
  });
});

describe('DD → DMS round-trip via ddToDms + dmsToDd (US1 DD-only)', () => {
  test.each(ddToDmsVectors)('$id — dd round-trips within ~1e-7°', (v: Vector) => {
    const inp = v.input as { dd: number; axis: 'lat' | 'lon' };
    const axis = axisKind(v);
    const dms = ddToDms(inp.dd, axis);
    const recovered = dmsToDd(dms);
    expect(Math.abs(recovered - inp.dd)).toBeLessThanOrEqual(ROUND_TRIP_TOLERANCE_DEG);
  });
});
