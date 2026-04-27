// Feature 009 — pure segment helper for the coordinate readout.
// See specs/009-mobile-ui-fixes/contracts/coordinate-segments.md.

import type { CoordinateKind, MGRSPrecision, TaipowerPrecision, WGS84DD } from '$types/coord';
import {
  wgs84DdToDms,
  wgs84ToMgrs,
  wgs84ToTaipower,
  wgs84ToTwd67,
  wgs84ToTwd97,
} from '$coord/index';

export interface CoordinateSegment {
  readonly labelKey: string;
  readonly value: string;
}

export type CoordinateSegmentsResult =
  | { readonly coverage: 'ok'; readonly segments: readonly CoordinateSegment[] }
  | { readonly coverage: 'out-of-coverage' };

export interface CoordinateSegmentsPrefs {
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
}

const DMS_SEC_DECIMALS = 3;

function ok(segments: readonly CoordinateSegment[]): CoordinateSegmentsResult {
  return { coverage: 'ok', segments };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function coordinateSegments(
  kind: CoordinateKind,
  position: WGS84DD,
  prefs: CoordinateSegmentsPrefs,
): CoordinateSegmentsResult {
  switch (kind) {
    case 'wgs84-dd':
      return ok([
        { labelKey: 'goto.fields.lat', value: position.lat.toFixed(6) },
        { labelKey: 'goto.fields.lon', value: position.lon.toFixed(6) },
      ]);

    case 'wgs84-dms': {
      const dms = wgs84DdToDms(position);
      return ok([
        { labelKey: 'goto.fields.latDeg', value: pad2(dms.lat.deg) },
        { labelKey: 'goto.fields.latMin', value: pad2(dms.lat.min) },
        { labelKey: 'goto.fields.latSec', value: dms.lat.sec.toFixed(DMS_SEC_DECIMALS) },
        { labelKey: 'goto.fields.hemNS', value: dms.lat.hemisphere },
        { labelKey: 'goto.fields.lonDeg', value: pad2(dms.lon.deg) },
        { labelKey: 'goto.fields.lonMin', value: pad2(dms.lon.min) },
        { labelKey: 'goto.fields.lonSec', value: dms.lon.sec.toFixed(DMS_SEC_DECIMALS) },
        { labelKey: 'goto.fields.hemEW', value: dms.lon.hemisphere },
      ]);
    }

    case 'twd97-tm2': {
      const tm = wgs84ToTwd97(position);
      return ok([
        { labelKey: 'goto.fields.easting', value: (tm.easting as number).toFixed(3) },
        { labelKey: 'goto.fields.northing', value: (tm.northing as number).toFixed(3) },
        { labelKey: 'goto.fields.zone', value: String(tm.zone) },
      ]);
    }

    case 'twd67-tm2': {
      const tm = wgs84ToTwd67(position);
      return ok([
        { labelKey: 'goto.fields.easting', value: (tm.easting as number).toFixed(3) },
        { labelKey: 'goto.fields.northing', value: (tm.northing as number).toFixed(3) },
      ]);
    }

    case 'mgrs': {
      const m = wgs84ToMgrs(position, prefs.mgrsPrecision);
      return ok([
        { labelKey: 'goto.fields.gzdBand', value: m.gzd },
        { labelKey: 'goto.fields.square', value: m.square },
        { labelKey: 'goto.fields.easting', value: String(m.easting).padStart(m.precision, '0') },
        { labelKey: 'goto.fields.northing', value: String(m.northing).padStart(m.precision, '0') },
      ]);
    }

    case 'taipower': {
      const r = wgs84ToTaipower(position, prefs.taipowerPrecision);
      if (!r.ok) return { coverage: 'out-of-coverage' };
      const code = r.value;
      return ok([
        { labelKey: 'goto.fields.first5', value: `${code.region}${code.subRegion}` },
        {
          labelKey: 'goto.fields.last4or6',
          value: `${code.hundredMeter}${code.tenMeter}${code.oneMeter ?? ''}`,
        },
        { labelKey: 'goto.fields.precision', value: String(code.precision) },
      ]);
    }
  }
}
