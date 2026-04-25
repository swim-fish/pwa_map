import { bench, describe, beforeAll } from 'vitest';
import {
  initCoord,
  wgs84ToTwd97,
  twd97ToWgs84,
  wgs84ToTwd67,
  twd67ToWgs84,
  wgs84ToMgrs,
  mgrsToWgs84,
  wgs84ToTaipower,
  taipowerToWgs84,
  ddToDms,
  dmsToDd,
  parseGoTo,
} from '../src/coord';
import type {
  Lat,
  Lon,
  WGS84DD,
  Easting,
  Northing,
  TWD67TM2,
  TWD97TM2,
  MGRSValue,
} from '../src/types/coord';

// Performance budget (plan.md Performance Goals):
//   Single coordinate conversion (any format pair): ≤ 1 ms median
// Vitest bench reports hz (ops/sec) — target is ≥ 1000 ops/sec for the 1 ms budget.

const TAIPEI: WGS84DD = { kind: 'wgs84-dd', lat: 25.033611 as Lat, lon: 121.564472 as Lon };
const TAIPEI_TWD97: TWD97TM2 = {
  kind: 'twd97-tm2',
  easting: 306962.887 as Easting,
  northing: 2769619.124 as Northing,
  zone: 121,
};
const TAIPEI_TWD67: TWD67TM2 = {
  kind: 'twd67-tm2',
  easting: 306132.271 as Easting,
  northing: 2769822.821 as Northing,
};
const TAIPEI_MGRS: MGRSValue = {
  kind: 'mgrs',
  gzd: '51R',
  square: 'UH',
  easting: 55170,
  northing: 69437,
  precision: 5,
};

beforeAll(() => {
  initCoord();
});

describe('coord conversions (single-point, ≤ 1 ms target)', () => {
  bench('WGS84 → TWD97 TM2', () => {
    wgs84ToTwd97(TAIPEI);
  });

  bench('TWD97 TM2 → WGS84', () => {
    twd97ToWgs84(TAIPEI_TWD97);
  });

  bench('WGS84 → TWD67 TM2', () => {
    wgs84ToTwd67(TAIPEI);
  });

  bench('TWD67 TM2 → WGS84', () => {
    twd67ToWgs84(TAIPEI_TWD67);
  });

  bench('WGS84 → MGRS (p5)', () => {
    wgs84ToMgrs(TAIPEI, 5);
  });

  bench('MGRS → WGS84', () => {
    mgrsToWgs84(TAIPEI_MGRS);
  });

  bench('WGS84 → Taipower (9-char)', () => {
    wgs84ToTaipower(TAIPEI, 9);
  });

  bench('Taipower → WGS84', () => {
    const r = wgs84ToTaipower(TAIPEI, 9);
    if (r.ok) taipowerToWgs84(r.value);
  });

  bench('DD → DMS (axis)', () => {
    ddToDms(TAIPEI.lat, 'lat');
  });

  bench('DMS → DD (axis)', () => {
    dmsToDd({ deg: 25, min: 2, sec: 1, hemisphere: 'N' });
  });
});

describe('parser dispatch (single input, ≤ 1 ms target)', () => {
  bench('parseGoTo DD', () => {
    parseGoTo('25.033611, 121.564472');
  });

  bench('parseGoTo MGRS', () => {
    parseGoTo('51R UH 55170 69437');
  });

  bench('parseGoTo TM2 inferred', () => {
    parseGoTo('306962.887, 2769619.124');
  });

  bench('parseGoTo Taipower', () => {
    parseGoTo('B7039 BD32');
  });

  bench('parseGoTo DMS', () => {
    parseGoTo('25°02′01.0″ N, 121°33′52.099″ E');
  });
});
