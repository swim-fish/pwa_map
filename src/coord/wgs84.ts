import type { DMSPart, Hemisphere, Lat, Lon, WGS84DD, WGS84DMS } from '$types/coord';
import { err, ok, reject, type Result } from '$types/result';
import type { Rejection } from '$types/result';

export type AxisKind = 'lat' | 'lon';

const LAT_ABS_MAX = 90;
const LON_ABS_MAX = 180;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function makeLat(v: number): Result<Lat, Rejection> {
  if (!isFiniteNumber(v)) {
    return err(reject('malformed', 'errors.latNotFinite', String(v)));
  }
  if (Math.abs(v) > LAT_ABS_MAX) {
    return err(reject('out-of-range', 'errors.latOutOfRange', String(v)));
  }
  return ok(v as Lat);
}

export function makeLon(v: number): Result<Lon, Rejection> {
  if (!isFiniteNumber(v)) {
    return err(reject('malformed', 'errors.lonNotFinite', String(v)));
  }
  if (Math.abs(v) > LON_ABS_MAX) {
    return err(reject('out-of-range', 'errors.lonOutOfRange', String(v)));
  }
  return ok(v as Lon);
}

export function makeWGS84DD(lat: number, lon: number): Result<WGS84DD, Rejection> {
  const rlat = makeLat(lat);
  if (!rlat.ok) return rlat;
  const rlon = makeLon(lon);
  if (!rlon.ok) return rlon;
  return ok({ kind: 'wgs84-dd', lat: rlat.value, lon: rlon.value });
}

export function formatWGS84DD(dd: WGS84DD): string {
  return `${dd.lat.toFixed(6)}, ${dd.lon.toFixed(6)}`;
}

function hemisphereFor(axis: AxisKind, sign: number): Hemisphere {
  if (axis === 'lat') return sign >= 0 ? 'N' : 'S';
  return sign >= 0 ? 'E' : 'W';
}

export function ddToDms(dd: number, axis: AxisKind): DMSPart {
  if (!isFiniteNumber(dd)) {
    throw new RangeError(`ddToDms: dd must be finite, got ${dd}`);
  }
  const sign = dd < 0 ? -1 : 1;
  const abs = Math.abs(dd);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return {
    deg,
    min,
    sec,
    hemisphere: hemisphereFor(axis, sign),
  };
}

export function dmsToDd(part: DMSPart): number {
  const magnitude = part.deg + part.min / 60 + part.sec / 3600;
  const negative = part.hemisphere === 'S' || part.hemisphere === 'W';
  return negative ? -magnitude : magnitude;
}

export interface DmsFormatOptions {
  readonly ascii?: boolean;
  readonly secDecimals?: number;
}

function formatPart(part: DMSPart, opts: DmsFormatOptions = {}): string {
  const ascii = opts.ascii === true;
  const degChar = ascii ? 'd ' : '°';
  const minChar = ascii ? "'" : '′';
  const secChar = ascii ? '"' : '″';
  const decimals = opts.secDecimals ?? 3;
  const deg = String(part.deg).padStart(2, '0');
  const min = String(part.min).padStart(2, '0');
  const sec = part.sec.toFixed(decimals).padStart(2 + (decimals > 0 ? 1 + decimals : 0), '0');
  const sep = ascii ? ' ' : ' ';
  return `${deg}${degChar}${sep}${min}${minChar}${sep}${sec}${secChar} ${part.hemisphere}`;
}

export function formatWGS84DMS(dms: WGS84DMS, opts: DmsFormatOptions = {}): string {
  return `${formatPart(dms.lat, opts)}, ${formatPart(dms.lon, opts)}`;
}

export function wgs84DdToDms(dd: WGS84DD): WGS84DMS {
  return {
    kind: 'wgs84-dms',
    lat: ddToDms(dd.lat, 'lat'),
    lon: ddToDms(dd.lon, 'lon'),
  };
}
