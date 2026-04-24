import { registerTwd97Projections } from './twd97';

let initialised = false;

export function initCoord(): void {
  if (initialised) return;
  initialised = true;
  registerTwd97Projections();
}

export {
  makeLat,
  makeLon,
  makeWGS84DD,
  formatWGS84DD,
  formatWGS84DMS,
  ddToDms,
  dmsToDd,
  wgs84DdToDms,
} from './wgs84';
export type { AxisKind, DmsFormatOptions } from './wgs84';
export { pickZone } from './zone';
export { wgs84ToTwd97, twd97ToWgs84, formatTWD97TM2 } from './twd97';
export { wgs84ToTwd67, twd67ToWgs84, twd97ToTwd67, twd67ToTwd97, formatTWD67TM2 } from './twd67';
export { wgs84ToMgrs, mgrsToWgs84, formatMGRS } from './mgrs';
export {
  wgs84ToTaipower,
  taipowerToWgs84,
  twd67ToTaipower,
  taipowerToTwd67,
  formatTaipower,
} from './taipower';
export { coverageOf } from './coverage';
export { parseGoTo } from './parser';
export type { GoToRequest, GoToRequestOk } from './parser';
