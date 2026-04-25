import type { FormatSelection, LayoutFields } from '$types/goto';

export type SubParserHint =
  | { kind: 'auto' }
  | { kind: 'wgs84-dd' }
  | { kind: 'wgs84-dms' }
  | { kind: 'mgrs' }
  | { kind: 'twd97-tm2'; zone: 'auto' | 119 | 121 }
  | { kind: 'twd67-tm2' }
  | { kind: 'taipower' };

export interface ComposedInput {
  readonly raw: string;
  readonly hint: SubParserHint;
}

export interface ComposeError {
  readonly category: 'empty-field';
  readonly messageKey: string;
  readonly fieldId: string;
}

export type ComposeResult =
  | { readonly ok: true; readonly value: ComposedInput }
  | { readonly ok: false; readonly error: ComposeError };

function emptyField(messageKey: string, fieldId: string): ComposeResult {
  return { ok: false, error: { category: 'empty-field', messageKey, fieldId } };
}

function mismatch(): ComposeResult {
  return {
    ok: false,
    error: {
      category: 'empty-field',
      messageKey: 'errors.composer.discriminantMismatch',
      fieldId: 'composer',
    },
  };
}

function isFieldEmpty(s: string): boolean {
  return s.trim() === '';
}

export function composeRaw(selection: FormatSelection, fields: LayoutFields): ComposeResult {
  // Discriminant alignment.
  if (selection.kind === 'auto' && fields.kind !== 'auto') return mismatch();
  if (selection.kind === 'fixed' && (fields.kind === 'auto' || fields.kind !== selection.value)) {
    return mismatch();
  }

  switch (fields.kind) {
    case 'auto': {
      if (isFieldEmpty(fields.raw)) return emptyField('errors.emptyInput', 'auto-raw');
      return { ok: true, value: { raw: fields.raw, hint: { kind: 'auto' } } };
    }
    case 'wgs84-dd': {
      if (isFieldEmpty(fields.lat)) return emptyField('errors.emptyInput', 'dd-lat');
      if (isFieldEmpty(fields.lon)) return emptyField('errors.emptyInput', 'dd-lon');
      return {
        ok: true,
        value: {
          raw: `${fields.lat.trim()}, ${fields.lon.trim()}`,
          hint: { kind: 'wgs84-dd' },
        },
      };
    }
    case 'wgs84-dms': {
      if (isFieldEmpty(fields.latDeg)) return emptyField('errors.emptyInput', 'dms-lat-deg');
      if (isFieldEmpty(fields.latMin)) return emptyField('errors.emptyInput', 'dms-lat-min');
      if (isFieldEmpty(fields.latSec)) return emptyField('errors.emptyInput', 'dms-lat-sec');
      if (isFieldEmpty(fields.lonDeg)) return emptyField('errors.emptyInput', 'dms-lon-deg');
      if (isFieldEmpty(fields.lonMin)) return emptyField('errors.emptyInput', 'dms-lon-min');
      if (isFieldEmpty(fields.lonSec)) return emptyField('errors.emptyInput', 'dms-lon-sec');
      const raw =
        `${fields.latDeg.trim()}°${fields.latMin.trim()}′${fields.latSec.trim()}″ ${fields.latHem}, ` +
        `${fields.lonDeg.trim()}°${fields.lonMin.trim()}′${fields.lonSec.trim()}″ ${fields.lonHem}`;
      return { ok: true, value: { raw, hint: { kind: 'wgs84-dms' } } };
    }
    case 'twd97-tm2': {
      if (isFieldEmpty(fields.easting)) return emptyField('errors.emptyInput', 'tm2-easting');
      if (isFieldEmpty(fields.northing)) return emptyField('errors.emptyInput', 'tm2-northing');
      const base = `${fields.easting.trim()}, ${fields.northing.trim()}`;
      const raw = fields.zone === 'auto' ? base : `${base} (zone ${fields.zone})`;
      return { ok: true, value: { raw, hint: { kind: 'twd97-tm2', zone: fields.zone } } };
    }
    case 'twd67-tm2': {
      if (isFieldEmpty(fields.easting)) return emptyField('errors.emptyInput', 'tm2-easting');
      if (isFieldEmpty(fields.northing)) return emptyField('errors.emptyInput', 'tm2-northing');
      return {
        ok: true,
        value: {
          raw: `TWD67 ${fields.easting.trim()}, ${fields.northing.trim()}`,
          hint: { kind: 'twd67-tm2' },
        },
      };
    }
    case 'mgrs': {
      if (isFieldEmpty(fields.gzdBand)) return emptyField('errors.emptyInput', 'mgrs-gzd');
      if (isFieldEmpty(fields.square)) return emptyField('errors.emptyInput', 'mgrs-square');
      if (isFieldEmpty(fields.easting)) return emptyField('errors.emptyInput', 'mgrs-easting');
      if (isFieldEmpty(fields.northing)) return emptyField('errors.emptyInput', 'mgrs-northing');
      const raw =
        `${fields.gzdBand.trim().toUpperCase()} ` +
        `${fields.square.trim().toUpperCase()} ` +
        `${fields.easting.trim()} ` +
        `${fields.northing.trim()}`;
      return { ok: true, value: { raw, hint: { kind: 'mgrs' } } };
    }
    case 'taipower': {
      if (isFieldEmpty(fields.first5)) return emptyField('errors.emptyInput', 'taipower-first5');
      if (isFieldEmpty(fields.last4or6))
        return emptyField('errors.emptyInput', 'taipower-last4or6');
      const raw = `${fields.first5.trim().toUpperCase()} ${fields.last4or6.trim().toUpperCase()}`;
      return { ok: true, value: { raw, hint: { kind: 'taipower' } } };
    }
  }
}
