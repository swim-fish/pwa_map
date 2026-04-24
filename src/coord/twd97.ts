import proj4 from 'proj4';
import type { Easting, Lat, Lon, Northing, TWD97TM2, WGS84DD, Zone } from '$types/coord';
import { pickZone } from './zone';

// EPSG:3826 — TWD97 / TM2 zone 121 (main island).
const EPSG_3826 =
  '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

// EPSG:3825 — TWD97 / TM2 zone 119 (Penghu / Kinmen / Matsu).
const EPSG_3825 =
  '+proj=tmerc +lat_0=0 +lon_0=119 +k=0.9999 +x_0=250000 +y_0=0 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

const WGS84_CODE = 'EPSG:4326';
const EPSG_121_CODE = 'EPSG:3826';
const EPSG_119_CODE = 'EPSG:3825';

let registered = false;

export function registerTwd97Projections(): void {
  if (registered) return;
  proj4.defs(EPSG_121_CODE, EPSG_3826);
  proj4.defs(EPSG_119_CODE, EPSG_3825);
  registered = true;
}

function zoneCode(zone: Zone): string {
  return zone === 121 ? EPSG_121_CODE : EPSG_119_CODE;
}

export function wgs84ToTwd97(dd: WGS84DD, zone?: Zone): TWD97TM2 {
  registerTwd97Projections();
  const z = zone ?? pickZone(dd.lon);
  const [easting, northing] = proj4(WGS84_CODE, zoneCode(z), [dd.lon as number, dd.lat as number]);
  return {
    kind: 'twd97-tm2',
    easting: easting as unknown as Easting,
    northing: northing as unknown as Northing,
    zone: z,
  };
}

export function twd97ToWgs84(tm2: TWD97TM2): WGS84DD {
  registerTwd97Projections();
  const [lon, lat] = proj4(zoneCode(tm2.zone), WGS84_CODE, [
    tm2.easting as number,
    tm2.northing as number,
  ]);
  return {
    kind: 'wgs84-dd',
    lat: lat as unknown as Lat,
    lon: lon as unknown as Lon,
  };
}

export function formatTWD97TM2(tm2: TWD97TM2): string {
  return `E ${tm2.easting.toFixed(3)}, N ${tm2.northing.toFixed(3)} (zone ${tm2.zone})`;
}
