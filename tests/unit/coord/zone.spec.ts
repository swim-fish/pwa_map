import { describe, test, expect } from 'vitest';
import { pickZone } from '../../../src/coord/zone';

describe('pickZone — §9 boundary rule', () => {
  test('lon strictly less than 120 → zone 119', () => {
    expect(pickZone(119.5)).toBe(119);
    expect(pickZone(119.999999)).toBe(119);
  });

  test('lon exactly 120 → zone 121 (§9 default)', () => {
    expect(pickZone(120)).toBe(121);
    expect(pickZone(120.0)).toBe(121);
  });

  test('lon greater than 120 → zone 121', () => {
    expect(pickZone(121.564472)).toBe(121);
    expect(pickZone(122)).toBe(121);
  });

  test('negative lon falls in zone 119 (as any lon < 120)', () => {
    expect(pickZone(0)).toBe(119);
    expect(pickZone(-150)).toBe(119);
  });
});
