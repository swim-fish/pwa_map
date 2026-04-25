import { describe, test, expect, beforeAll } from 'vitest';
import { initCoord } from '../../../src/coord';
import { candidates } from '../../../src/coord/disambiguate';

beforeAll(() => {
  initCoord();
});

describe('disambiguate.candidates', () => {
  test('TWD97 dual-zone TM2 pair yields ≥ 2 candidates incl. zone 119 + 121', () => {
    const list = candidates('306962.887, 2769619.124');
    expect(list.length).toBeGreaterThanOrEqual(2);
    const subs = list.map((c) => c.sub);
    expect(subs).toContain('twd97-zone-121');
    expect(subs).toContain('twd97-zone-119');
  });

  test('unambiguous DD yields exactly one wgs84-dd candidate', () => {
    const list = candidates('25.033611, 121.564472');
    expect(list.length).toBe(1);
    expect(list[0].sub).toBe('wgs84-dd');
  });

  test('Taipower B7039 BD32 yields exactly one taipower candidate', () => {
    const list = candidates('B7039 BD32');
    expect(list.length).toBe(1);
    expect(list[0].sub).toBe('taipower');
  });

  test('garbage input yields an empty list', () => {
    const list = candidates('this is not a coordinate');
    expect(list).toEqual([]);
  });

  test('every candidate target lies inside the WGS84 DD bounds (sanity coverage check)', () => {
    const list = candidates('306962.887, 2769619.124');
    for (const c of list) {
      expect(c.target.lat).toBeGreaterThanOrEqual(20);
      expect(c.target.lat).toBeLessThanOrEqual(27);
      expect(c.target.lon).toBeGreaterThanOrEqual(118);
      expect(c.target.lon).toBeLessThanOrEqual(123);
    }
  });

  test('order: candidates returned in canonical sub-parser preference order', () => {
    const list = candidates('306962.887, 2769619.124');
    const order: readonly string[] = [
      'wgs84-dd',
      'wgs84-dms',
      'mgrs',
      'twd97-zone-119',
      'twd97-zone-121',
      'twd67',
      'taipower',
    ];
    let lastIdx = -1;
    for (const c of list) {
      const idx = order.indexOf(c.sub);
      expect(idx).toBeGreaterThanOrEqual(lastIdx);
      lastIdx = idx;
    }
  });
});
