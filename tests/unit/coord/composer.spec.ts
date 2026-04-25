import { describe, test, expect, beforeAll } from 'vitest';
import { initCoord, parseGoTo } from '../../../src/coord';
import { composeRaw } from '../../../src/coord/composer';
import {
  parseDdOnly,
  parseDmsOnly,
  parseMgrsOnly,
  parseTm2InferredOnly,
  parseTm2ExplicitOnly,
  parseTwd67Only,
  parseTaipowerOnly,
} from '../../../src/coord/parser';
import type { FormatSelection, LayoutFields } from '../../../src/types/goto';

beforeAll(() => {
  initCoord();
});

describe('composeRaw — happy paths produce parser-accepted raw', () => {
  test('auto: passes raw verbatim with hint auto', () => {
    const sel: FormatSelection = { kind: 'auto' };
    const fields: LayoutFields = { kind: 'auto', raw: '25.033611, 121.564472' };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('25.033611, 121.564472');
      expect(r.value.hint.kind).toBe('auto');
      const p = parseGoTo(r.value.raw);
      expect(p.ok).toBe(true);
    }
  });

  test('wgs84-dd: composes "lat, lon" and parses', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'wgs84-dd' };
    const fields: LayoutFields = { kind: 'wgs84-dd', lat: '25.033611', lon: '121.564472' };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('25.033611, 121.564472');
      expect(r.value.hint.kind).toBe('wgs84-dd');
      expect(parseDdOnly(r.value.raw).ok).toBe(true);
    }
  });

  test('wgs84-dms: composes Unicode glyph form and parses', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'wgs84-dms' };
    const fields: LayoutFields = {
      kind: 'wgs84-dms',
      latDeg: '25',
      latMin: '02',
      latSec: '01.0',
      latHem: 'N',
      lonDeg: '121',
      lonMin: '33',
      lonSec: '52.099',
      lonHem: 'E',
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('25°02′01.0″ N, 121°33′52.099″ E');
      expect(r.value.hint.kind).toBe('wgs84-dms');
      expect(parseDmsOnly(r.value.raw).ok).toBe(true);
    }
  });

  test('twd97-tm2 zone auto: omits qualifier, hint zone="auto"', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'twd97-tm2' };
    const fields: LayoutFields = {
      kind: 'twd97-tm2',
      easting: '306962.887',
      northing: '2769619.124',
      zone: 'auto',
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('306962.887, 2769619.124');
      expect(r.value.hint.kind).toBe('twd97-tm2');
      if (r.value.hint.kind === 'twd97-tm2') expect(r.value.hint.zone).toBe('auto');
      expect(parseTm2InferredOnly(r.value.raw).ok).toBe(true);
    }
  });

  test('twd97-tm2 zone 121: appends "(zone 121)" qualifier', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'twd97-tm2' };
    const fields: LayoutFields = {
      kind: 'twd97-tm2',
      easting: '306962.887',
      northing: '2769619.124',
      zone: 121,
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('306962.887, 2769619.124 (zone 121)');
      if (r.value.hint.kind === 'twd97-tm2') expect(r.value.hint.zone).toBe(121);
      expect(parseTm2ExplicitOnly(r.value.raw, 121).ok).toBe(true);
    }
  });

  test('twd97-tm2 zone 119: appends "(zone 119)" qualifier and produces distinct raw', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'twd97-tm2' };
    const auto = composeRaw(sel, {
      kind: 'twd97-tm2',
      easting: '300000',
      northing: '2600000',
      zone: 'auto',
    });
    const z119 = composeRaw(sel, {
      kind: 'twd97-tm2',
      easting: '300000',
      northing: '2600000',
      zone: 119,
    });
    const z121 = composeRaw(sel, {
      kind: 'twd97-tm2',
      easting: '300000',
      northing: '2600000',
      zone: 121,
    });
    expect(auto.ok && z119.ok && z121.ok).toBe(true);
    if (auto.ok && z119.ok && z121.ok) {
      const raws = new Set([auto.value.raw, z119.value.raw, z121.value.raw]);
      expect(raws.size).toBe(3);
    }
  });

  test('twd67-tm2: prepends "TWD67 " exactly once', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'twd67-tm2' };
    const fields: LayoutFields = {
      kind: 'twd67-tm2',
      easting: '306132.271',
      northing: '2769822.821',
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('TWD67 306132.271, 2769822.821');
      expect(r.value.raw.match(/TWD67/g)?.length).toBe(1);
      expect(parseTwd67Only(r.value.raw).ok).toBe(true);
    }
  });

  test('mgrs: lower-cases input is upper-cased in composed raw', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'mgrs' };
    const fields: LayoutFields = {
      kind: 'mgrs',
      gzdBand: '51r',
      square: 'uh',
      easting: '55170',
      northing: '69437',
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('51R UH 55170 69437');
      expect(parseMgrsOnly(r.value.raw).ok).toBe(true);
    }
  });

  test('taipower: lower-cases input is upper-cased; whitespace single-space', () => {
    const sel: FormatSelection = { kind: 'fixed', value: 'taipower' };
    const fields: LayoutFields = {
      kind: 'taipower',
      first5: 'b7039',
      last4or6: 'bd32',
      precision: 9,
    };
    const r = composeRaw(sel, fields);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw).toBe('B7039 BD32');
      expect(parseTaipowerOnly(r.value.raw).ok).toBe(true);
    }
  });
});

describe('composeRaw — empty-field rejections', () => {
  test('auto empty', () => {
    const r = composeRaw({ kind: 'auto' }, { kind: 'auto', raw: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.messageKey).toBe('errors.emptyInput');
      expect(r.error.fieldId).toBe('auto-raw');
    }
  });

  test('dd missing lat', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'wgs84-dd' },
      { kind: 'wgs84-dd', lat: '', lon: '121.5' },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('dd-lat');
  });

  test('dd missing lon', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'wgs84-dd' },
      { kind: 'wgs84-dd', lat: '25.0', lon: '' },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('dd-lon');
  });

  test('dms missing lat seconds', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'wgs84-dms' },
      {
        kind: 'wgs84-dms',
        latDeg: '25',
        latMin: '02',
        latSec: '',
        latHem: 'N',
        lonDeg: '121',
        lonMin: '33',
        lonSec: '52',
        lonHem: 'E',
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('dms-lat-sec');
  });

  test('mgrs missing square', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'mgrs' },
      { kind: 'mgrs', gzdBand: '51R', square: '', easting: '55170', northing: '69437' },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('mgrs-square');
  });

  test('twd97 missing easting', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'twd97-tm2' },
      { kind: 'twd97-tm2', easting: '', northing: '2769619.124', zone: 'auto' },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('tm2-easting');
  });

  test('twd67 missing northing', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'twd67-tm2' },
      { kind: 'twd67-tm2', easting: '306132.271', northing: '' },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('tm2-northing');
  });

  test('taipower missing last4or6', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'taipower' },
      { kind: 'taipower', first5: 'B7039', last4or6: '', precision: 9 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fieldId).toBe('taipower-last4or6');
  });
});

describe('composeRaw — discriminant mismatch', () => {
  test('auto selection with dd fields', () => {
    const r = composeRaw({ kind: 'auto' }, {
      kind: 'wgs84-dd',
      lat: '25.0',
      lon: '121.5',
    } as LayoutFields);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.messageKey).toBe('errors.composer.discriminantMismatch');
  });

  test('fixed dd selection with mgrs fields', () => {
    const r = composeRaw({ kind: 'fixed', value: 'wgs84-dd' }, {
      kind: 'mgrs',
      gzdBand: '51R',
      square: 'UH',
      easting: '1',
      northing: '2',
    } as LayoutFields);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.messageKey).toBe('errors.composer.discriminantMismatch');
  });
});

describe('composeRaw — round-trip property against test-vectors', () => {
  test('Taipei 101 → DD → composes back to a parser-accepted string', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'wgs84-dd' },
      { kind: 'wgs84-dd', lat: '25.033611', lon: '121.564472' },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = parseDdOnly(r.value.raw);
      expect(p.ok).toBe(true);
      if (p.ok) {
        expect(p.target.lat).toBeCloseTo(25.033611, 5);
        expect(p.target.lon).toBeCloseTo(121.564472, 5);
      }
    }
  });

  test('Taipei 101 → MGRS → composes back to a parser-accepted string', () => {
    const r = composeRaw(
      { kind: 'fixed', value: 'mgrs' },
      { kind: 'mgrs', gzdBand: '51R', square: 'UH', easting: '55170', northing: '69437' },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = parseMgrsOnly(r.value.raw);
      expect(p.ok).toBe(true);
    }
  });
});
