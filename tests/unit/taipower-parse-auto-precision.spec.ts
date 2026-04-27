import { describe, test, expect } from 'vitest';
import { detectTaipowerPrecision } from '../../src/coord/parser';
import { parseTaipowerOnly } from '../../src/coord/parser';

// Feature 010 — invariants 1, 2, 3, 4 from
// contracts/taipower-precision-autodetect.md.

describe('detectTaipowerPrecision (FR-015)', () => {
  test('(2) length 9 → 9, length 11 → 11, length 10 → null', () => {
    expect(detectTaipowerPrecision('A12345678')).toBe(9); // 9 chars
    expect(detectTaipowerPrecision('A123456789X')).toBe(11); // 11 chars (mixed)
    expect(detectTaipowerPrecision('A1234567XX')).toBe(null); // 10 chars
    expect(detectTaipowerPrecision('A12345')).toBe(null); // 6 chars
  });

  test('(3) leading + trailing whitespace stripped before length check', () => {
    expect(detectTaipowerPrecision('  A12345678  ')).toBe(9);
    expect(detectTaipowerPrecision('\tA123456789X\n')).toBe(11);
  });

  test('(3b) documented separators (hyphen, space, underscore) stripped before length check', () => {
    expect(detectTaipowerPrecision('A1-23-45-67-8')).toBe(9);
    expect(detectTaipowerPrecision('A1_23_45_67_89_X')).toBe(11);
    expect(detectTaipowerPrecision('A1 23 45 67 8')).toBe(9);
  });

  test('(1) pure: same input → same output, no DOM / Date / localStorage required', () => {
    expect(detectTaipowerPrecision('A12345678')).toBe(detectTaipowerPrecision('A12345678'));
  });
});

describe('parseTaipowerOnly with auto-precision (FR-015)', () => {
  test('(4) accepts 9-char input as 9-precision Taipower', () => {
    // E.g. region E, sub-region 0509, 100 m letters DE, 10 m 12 — main island.
    const r = parseTaipowerOnly('E0509DE12');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsedAs).toBe('taipower');
    }
  });

  test('(4b) accepts 11-char input as 11-precision Taipower', () => {
    const r = parseTaipowerOnly('E0509DE1234');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsedAs).toBe('taipower');
    }
  });

  test('(4c) length-10 input rejects with the existing unsupported-precision rejection', () => {
    const r = parseTaipowerOnly('E0509DE123');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Existing locale key from feature 002 — never changed by this feature.
      expect(r.error.messageKey).toBe('errors.taipower.wrongLength');
    }
  });
});
