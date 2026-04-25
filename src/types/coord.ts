export type Lat = number & { readonly __brand: 'Lat' };
export type Lon = number & { readonly __brand: 'Lon' };
export type Easting = number & { readonly __brand: 'E' };
export type Northing = number & { readonly __brand: 'N' };
export type Zone = 119 | 121;
export type Hemisphere = 'N' | 'S' | 'E' | 'W';
export type Locale = 'zh' | 'en' | 'ja';

export interface WGS84DD {
  readonly kind: 'wgs84-dd';
  readonly lat: Lat;
  readonly lon: Lon;
}

export interface DMSPart {
  readonly deg: number;
  readonly min: number;
  readonly sec: number;
  readonly hemisphere: Hemisphere;
}

export interface WGS84DMS {
  readonly kind: 'wgs84-dms';
  readonly lat: DMSPart;
  readonly lon: DMSPart;
}

export interface TWD97TM2 {
  readonly kind: 'twd97-tm2';
  readonly easting: Easting;
  readonly northing: Northing;
  readonly zone: Zone;
}

export interface TWD67TM2 {
  readonly kind: 'twd67-tm2';
  readonly easting: Easting;
  readonly northing: Northing;
}

export type MGRSPrecision = 1 | 2 | 3 | 4 | 5;

export interface MGRSValue {
  readonly kind: 'mgrs';
  readonly gzd: string;
  readonly square: string;
  readonly easting: number;
  readonly northing: number;
  readonly precision: MGRSPrecision;
}

export type TaipowerPrecision = 9 | 11;

export interface TaipowerCode {
  readonly kind: 'taipower';
  readonly region: string;
  readonly subRegion: string;
  readonly hundredMeter: string;
  readonly tenMeter: string;
  readonly oneMeter: string | null;
  readonly precision: TaipowerPrecision;
}

export type CoordinateValue = WGS84DD | WGS84DMS | TWD97TM2 | TWD67TM2 | MGRSValue | TaipowerCode;

export type CoordinateKind = CoordinateValue['kind'];

export const ALL_COORDINATE_KINDS: readonly CoordinateKind[] = [
  'wgs84-dd',
  'wgs84-dms',
  'twd97-tm2',
  'twd67-tm2',
  'mgrs',
  'taipower',
] as const;
