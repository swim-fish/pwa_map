import { describe, test, expect, beforeAll } from 'vitest';
import { initCoord, parseGoTo } from '../../../src/coord';

beforeAll(() => {
  initCoord();
});

describe('parseGoTo — top-level dispatcher', () => {
  test('empty input → malformed / emptyInput', () => {
    const r = parseGoTo('');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.category).toBe('malformed');
      expect(r.error.messageKey).toBe('errors.emptyInput');
    }
  });

  test('WGS84 DD comma form — Taipei 101', () => {
    const r = parseGoTo('25.033611, 121.564472');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsedAs).toBe('wgs84-dd');
      expect(r.target.lat).toBeCloseTo(25.033611, 5);
      expect(r.target.lon).toBeCloseTo(121.564472, 5);
    }
  });

  test('WGS84 DD hemisphere-prefixed', () => {
    const r = parseGoTo('N 25.033611, E 121.564472');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('wgs84-dd');
  });

  test('WGS84 DD signed southern', () => {
    const r = parseGoTo('-23.500000, 121.000000');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.target.lat).toBeCloseTo(-23.5, 5);
  });

  test('WGS84 DD third token → unsupported-precision', () => {
    const r = parseGoTo('25.033611 121.564472 500');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('unsupported-precision');
  });

  test('WGS84 DD lat out of range', () => {
    const r = parseGoTo('95.000000, 121.000000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('WGS84 DMS Unicode glyphs', () => {
    const r = parseGoTo('25°02′01.0″ N, 121°33′52.099″ E');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('wgs84-dms');
  });

  test('WGS84 DMS ASCII glyphs', () => {
    const r = parseGoTo(`25° 02' 01.000" N, 121° 33' 52.099" E`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('wgs84-dms');
  });

  test('WGS84 DMS minutes out of range → out-of-range', () => {
    const r = parseGoTo('25°60′00.0″ N, 121°00′00.0″ E');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.category).toBe('out-of-range');
      expect(r.error.messageKey).toBe('errors.dms.minutesOutOfRange');
    }
  });

  test('WGS84 DMS seconds out of range → out-of-range', () => {
    const r = parseGoTo('25°02′60.0″ N, 121°00′00.0″ E');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.category).toBe('out-of-range');
      expect(r.error.messageKey).toBe('errors.dms.secondsOutOfRange');
    }
  });

  test('WGS84 DMS unknown hemisphere letter → malformed', () => {
    const r = parseGoTo('25°02′01.0″ Z, 121°33′52.099″ E');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('WGS84 DMS ordinal indicator (U+00BA) → malformed', () => {
    const r = parseGoTo('25º02′01.0″ N, 121°33′52.099″ E');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('MGRS canonical 5-precision', () => {
    const r = parseGoTo('51R UH 55170 69437');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('mgrs');
  });

  test('MGRS joined-no-spaces, lowercase', () => {
    const r = parseGoTo('51ruh5517069437');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('mgrs');
  });

  test('MGRS odd tail → malformed', () => {
    const r = parseGoTo('51R UH 12345 6789');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('MGRS forbidden I letter → malformed', () => {
    const r = parseGoTo('51R II 12345 67890');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('TWD97 zone-declared — explicit 121', () => {
    const r = parseGoTo('306962.887, 2769619.124 (zone 121)');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsedAs).toBe('twd97-tm2');
      expect(r.target.lat).toBeCloseTo(25.033611, 3);
      expect(r.target.lon).toBeCloseTo(121.564472, 3);
    }
  });

  test('TWD97 zone-inferred — Taipei 101 pair → zone 121', () => {
    const r = parseGoTo('306962.887, 2769619.124');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsedAs).toBe('twd97-tm2');
      expect(r.zoneAutoResolved).toBe(121);
    }
  });

  test('TWD97 unknown zone (120) → out-of-range', () => {
    const r = parseGoTo('306962.887, 2769619.124, zone=120');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('TWD97 both zones outside Taiwan → out-of-range', () => {
    const r = parseGoTo('99999.999, 9999999.999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-range');
  });

  test('TWD67 with qualifier', () => {
    const r = parseGoTo('TWD67 306132.271, 2769822.821');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('twd67-tm2');
  });

  test('TWD67 with km unit → malformed', () => {
    const r = parseGoTo('TWD67 306.132 km, 2769.822 km');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('malformed');
  });

  test('Taipower 9-char', () => {
    const r = parseGoTo('B7039 BD32');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsedAs).toBe('taipower');
  });

  test('Taipower Y-letter → out-of-coverage', () => {
    const r = parseGoTo('Y1234 AB56');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-coverage');
  });

  test('Taipower Z-letter → out-of-coverage', () => {
    const r = parseGoTo('Z0000 AA00');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-coverage');
  });

  test('rejection preference: out-of-coverage beats malformed', () => {
    // A nonsense-but-shapes-as-Taipower-with-Y input should surface the
    // Y letter out-of-coverage rather than a generic malformed.
    const r = parseGoTo('Y5555 AB12');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.category).toBe('out-of-coverage');
  });
});
