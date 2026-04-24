import type { Easting, Northing, TWD67TM2, TWD97TM2, WGS84DD } from '$types/coord';
import { wgs84ToTwd97, twd97ToWgs84 } from './twd97';

// Four-parameter shift constants from reference §6 (TWD97 ↔ TWD67 direction).
// Forward (TWD97 → TWD67):
//   X67 = X97 - Δx - a * X97 - b * Y97
//   Y67 = Y97 + Δy - a * Y97 - b * X97
// Inverse (TWD67 → TWD97):
//   X97 = X67 + Δx + a * X67 + b * Y67
//   Y97 = Y67 - Δy + a * Y67 + b * X67
const DELTA_X = 807.8;
const DELTA_Y = 248.6;
const A = 0.00001549;
const B = 0.000006521;

export function twd97ToTwd67(tm2: TWD97TM2): TWD67TM2 {
  const x97 = tm2.easting;
  const y97 = tm2.northing;
  const easting = x97 - DELTA_X - A * x97 - B * y97;
  const northing = y97 + DELTA_Y - A * y97 - B * x97;
  return {
    kind: 'twd67-tm2',
    easting: easting as Easting,
    northing: northing as Northing,
  };
}

export function twd67ToTwd97(tm67: TWD67TM2): TWD97TM2 {
  const x67 = tm67.easting;
  const y67 = tm67.northing;
  const easting97 = x67 + DELTA_X + A * x67 + B * y67;
  const northing97 = y67 - DELTA_Y + A * y67 + B * x67;
  return {
    kind: 'twd97-tm2',
    easting: easting97 as Easting,
    northing: northing97 as Northing,
    zone: 121,
  };
}

export function wgs84ToTwd67(dd: WGS84DD): TWD67TM2 {
  const tm97 = wgs84ToTwd97(dd, 121);
  return twd97ToTwd67(tm97);
}

export function twd67ToWgs84(tm67: TWD67TM2): WGS84DD {
  const tm97 = twd67ToTwd97(tm67);
  return twd97ToWgs84(tm97);
}

export function formatTWD67TM2(tm: TWD67TM2): string {
  return `E ${tm.easting.toFixed(3)}, N ${tm.northing.toFixed(3)}`;
}
