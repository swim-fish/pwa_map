import type { CoordinateKind, WGS84DD } from '$types/coord';

export type CoverageVerdict = 'ok' | 'out-of-coverage';

// Bounding boxes per reference §4–§8 Coverage tables.
interface BBox {
  readonly latMin: number;
  readonly latMax: number;
  readonly lonMin: number;
  readonly lonMax: number;
}

const TWD97_MAIN_BBOX: BBox = { latMin: 20.5, latMax: 26.4, lonMin: 119.0, lonMax: 122.3 };
const TWD67_BBOX: BBox = { latMin: 21.8, latMax: 25.4, lonMin: 120.0, lonMax: 122.1 };
const TAIPOWER_BBOX: BBox = { latMin: 21.8, latMax: 25.4, lonMin: 120.0, lonMax: 122.1 };

function within(dd: WGS84DD, box: BBox): boolean {
  return (
    dd.lat >= box.latMin && dd.lat <= box.latMax && dd.lon >= box.lonMin && dd.lon <= box.lonMax
  );
}

export function coverageOf(kind: CoordinateKind, dd: WGS84DD): CoverageVerdict {
  switch (kind) {
    case 'wgs84-dd':
    case 'wgs84-dms':
      return 'ok';
    case 'mgrs':
      return Math.abs(dd.lat) <= 84 ? 'ok' : 'out-of-coverage';
    case 'twd97-tm2':
      return within(dd, TWD97_MAIN_BBOX) ? 'ok' : 'out-of-coverage';
    case 'twd67-tm2':
      return within(dd, TWD67_BBOX) ? 'ok' : 'out-of-coverage';
    case 'taipower':
      return within(dd, TAIPOWER_BBOX) ? 'ok' : 'out-of-coverage';
  }
}
