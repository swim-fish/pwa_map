import * as mgrsLib from 'mgrs';
import type { Lat, Lon, MGRSPrecision, MGRSValue, WGS84DD } from '$types/coord';

type MgrsModule = {
  forward?: (lonlat: [number, number], precision?: number) => string;
  inverse?: (mgrs: string) => [number, number, number, number];
};

const lib = mgrsLib as unknown as MgrsModule & {
  default?: MgrsModule;
};

function api(): Required<MgrsModule> {
  const primary = lib.default ?? lib;
  const fwd = primary.forward ?? lib.forward;
  const inv = primary.inverse ?? lib.inverse;
  if (!fwd || !inv) throw new Error('mgrs library missing forward/inverse');
  return { forward: fwd, inverse: inv };
}

const MGRS_SHAPE = /^(\d{1,2}[A-HJ-NP-Z])([A-HJ-NP-Z]{2})(\d{0,10})$/i;

function parseCanonical(code: string): MGRSValue {
  const compact = code.replace(/\s+/g, '').toUpperCase();
  const m = MGRS_SHAPE.exec(compact);
  if (!m) throw new Error(`cannot parse MGRS "${code}"`);
  const digits = m[3];
  if (digits.length % 2 !== 0) throw new Error(`MGRS tail has odd digit count: "${code}"`);
  const half = digits.length / 2;
  const easting = half === 0 ? 0 : Number.parseInt(digits.slice(0, half), 10);
  const northing = half === 0 ? 0 : Number.parseInt(digits.slice(half), 10);
  const precision = (half === 0 ? 1 : half) as MGRSPrecision;
  return {
    kind: 'mgrs',
    gzd: m[1].toUpperCase(),
    square: m[2].toUpperCase(),
    easting,
    northing,
    precision,
  };
}

export function wgs84ToMgrs(dd: WGS84DD, precision: MGRSPrecision = 5): MGRSValue {
  const { forward } = api();
  const code = forward([dd.lon, dd.lat], precision);
  return parseCanonical(code);
}

export function mgrsToWgs84(m: MGRSValue): WGS84DD {
  const { inverse } = api();
  const compact = `${m.gzd}${m.square}${String(m.easting).padStart(m.precision, '0')}${String(m.northing).padStart(m.precision, '0')}`;
  const bbox = inverse(compact);
  // inverse returns [minLon, minLat, maxLon, maxLat] — the cell SW corner.
  // Reference §7 says "truncation, not rounding": we take the SW corner
  // exactly rather than the cell center, so forward∘inverse is a lossless
  // operation (within cell size).
  const [minLon, minLat] = bbox;
  return {
    kind: 'wgs84-dd',
    lat: minLat as Lat,
    lon: minLon as Lon,
  };
}

export function formatMGRS(m: MGRSValue): string {
  const e = String(m.easting).padStart(m.precision, '0');
  const n = String(m.northing).padStart(m.precision, '0');
  return `${m.gzd} ${m.square} ${e} ${n}`;
}
