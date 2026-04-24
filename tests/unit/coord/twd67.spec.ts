import { describe, test, expect, beforeAll } from 'vitest';
import vectorsFile from '../fixtures/test-vectors.json';
import { initCoord } from '../../../src/coord';
import { twd97ToTwd67, twd67ToTwd97 } from '../../../src/coord/twd67';
import type { Easting, Northing, TWD97TM2 } from '../../../src/types/coord';
import * as twd67module from '../../../src/coord/twd67';

type Vector = {
  id: string;
  direction: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  tolerance: { value: number; unit: string };
};

const vectors = (vectorsFile as { vectors: Vector[] }).vectors;
const forward = vectors.filter((v) => v.direction === 'TWD97_TO_TWD67');

beforeAll(() => {
  initCoord();
});

describe('TWD97 → TWD67 (four-parameter)', () => {
  test('covers every TWD97_TO_TWD67 vector', () => {
    expect(forward.length).toBeGreaterThan(0);
  });

  test.each(forward)('$id — forward matches within 3 m', (v: Vector) => {
    const inp = v.input as { easting: number; northing: number };
    const exp = v.expected as { easting: number; northing: number };
    const tm2: TWD97TM2 = {
      kind: 'twd97-tm2',
      easting: inp.easting as Easting,
      northing: inp.northing as Northing,
      zone: 121,
    };
    const actual = twd97ToTwd67(tm2);
    expect(Math.abs(actual.easting - exp.easting)).toBeLessThanOrEqual(v.tolerance.value);
    expect(Math.abs(actual.northing - exp.northing)).toBeLessThanOrEqual(v.tolerance.value);
  });

  test.each(forward)('$id — inverse round-trips within 6 m', (v: Vector) => {
    const exp = v.expected as { easting: number; northing: number };
    const back = twd67ToTwd97({
      kind: 'twd67-tm2',
      easting: exp.easting as Easting,
      northing: exp.northing as Northing,
    });
    const inp = v.input as { easting: number; northing: number };
    expect(Math.abs(back.easting - inp.easting)).toBeLessThanOrEqual(2 * v.tolerance.value);
    expect(Math.abs(back.northing - inp.northing)).toBeLessThanOrEqual(2 * v.tolerance.value);
  });
});

describe('deprecated two-constant offset path is not exposed', () => {
  test('twd97ToTwd67Simple must NOT be exported (research R4)', () => {
    const mod = twd67module as Record<string, unknown>;
    expect(mod.twd97ToTwd67Simple).toBeUndefined();
  });
});
