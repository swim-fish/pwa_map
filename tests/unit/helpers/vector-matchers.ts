import { expect } from 'vitest';

export type ToleranceUnit = 'm' | 'deg' | 'arcsec' | 'cell';

export interface ToleranceSpec {
  value: number;
  unit: ToleranceUnit;
}

export type Axis = 'lat' | 'lon' | 'easting' | 'northing' | 'all';

type Scalar = number | string | undefined;
type RecordLike = Record<string, Scalar | Record<string, Scalar>>;

function nfc(s: string): string {
  return s.normalize('NFC');
}

function axesFor(axis: Axis | undefined): readonly string[] {
  switch (axis) {
    case 'lat':
      return ['lat'];
    case 'lon':
      return ['lon'];
    case 'easting':
      return ['easting'];
    case 'northing':
      return ['northing'];
    case 'all':
    case undefined:
      return ['lat', 'lon', 'easting', 'northing', 'dd', 'deg', 'min', 'sec'];
  }
}

function pickNumber(src: RecordLike, field: string): number | undefined {
  const v = (src as Record<string, unknown>)[field];
  if (typeof v === 'number') return v;
  return undefined;
}

function arcsecDelta(actual: RecordLike, expected: RecordLike): number {
  const da = (pickNumber(actual, 'deg') ?? 0) * 3600;
  const ma = (pickNumber(actual, 'min') ?? 0) * 60;
  const sa = pickNumber(actual, 'sec') ?? 0;
  const de = (pickNumber(expected, 'deg') ?? 0) * 3600;
  const me = (pickNumber(expected, 'min') ?? 0) * 60;
  const se = pickNumber(expected, 'sec') ?? 0;
  return Math.abs(da + ma + sa - (de + me + se));
}

function cellPrefix(code: string): { prefix: string; digits: string } {
  const compact = code.replace(/\s+/g, '');
  // Taipower canonical: L NNNN LL DD [DD] — first char + 4 digits + 2 letters + 2|4 digits
  // Prefix = first char + 4 digits + 2 letters + first 2 digits (fixed part)
  const prefix = compact.slice(0, 9);
  const digits = compact.slice(9);
  return { prefix, digits };
}

export function expectWithinTolerance(
  actualRaw: unknown,
  expectedRaw: unknown,
  tolerance: ToleranceSpec,
  axis?: Axis,
): void {
  const actual = actualRaw as RecordLike;
  const expected = expectedRaw as RecordLike;

  if (tolerance.unit === 'arcsec') {
    const delta = arcsecDelta(actual, expected);
    expect(delta, `arcsec delta ${delta} > tolerance ${tolerance.value}`).toBeLessThanOrEqual(
      tolerance.value,
    );

    const expHem = (expected as Record<string, Scalar>).hemisphere;
    const actHem = (actual as Record<string, Scalar>).hemisphere;
    if (typeof expHem === 'string') {
      expect(typeof actHem === 'string' ? actHem : '', 'hemisphere must match').toBe(expHem);
    }
    return;
  }

  if (tolerance.unit === 'cell') {
    const expCode = String((expected as Record<string, Scalar>).code ?? '');
    const actCode = String((actual as Record<string, Scalar>).code ?? '');
    const exp = cellPrefix(nfc(expCode));
    const act = cellPrefix(nfc(actCode));
    expect(act.prefix, `taipower prefix mismatch: ${act.prefix} vs ${exp.prefix}`).toBe(exp.prefix);
    // Tail digits may differ by up to 1 cell at the digit's resolution.
    if (exp.digits || act.digits) {
      const maxLen = Math.max(exp.digits.length, act.digits.length);
      const padExp = exp.digits.padStart(maxLen, '0');
      const padAct = act.digits.padStart(maxLen, '0');
      const diff = Math.abs(
        Number.parseInt(padAct || '0', 10) - Number.parseInt(padExp || '0', 10),
      );
      expect(
        diff,
        `taipower tail digits differ by ${diff} cells (> 1 cell tolerance)`,
      ).toBeLessThanOrEqual(1);
    }
    return;
  }

  // unit = 'm' or 'deg'
  const axes = axesFor(axis);
  for (const field of axes) {
    const a = pickNumber(actual, field);
    const e = pickNumber(expected, field);
    if (a === undefined || e === undefined) continue;
    const delta = Math.abs(a - e);
    expect(
      delta,
      `axis ${field}: delta ${delta} > tolerance ${tolerance.value} ${tolerance.unit}`,
    ).toBeLessThanOrEqual(tolerance.value);
  }
}

export function expectStringEqualNFC(actual: string, expected: string): void {
  expect(nfc(actual)).toBe(nfc(expected));
}
