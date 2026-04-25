import type { CoordinateKind, WGS84DD } from './coord';

export type FormatSelection =
  | { readonly kind: 'auto' }
  | { readonly kind: 'fixed'; readonly value: CoordinateKind };

export type LayoutFields =
  | { readonly kind: 'auto'; readonly raw: string }
  | { readonly kind: 'wgs84-dd'; readonly lat: string; readonly lon: string }
  | {
      readonly kind: 'wgs84-dms';
      readonly latDeg: string;
      readonly latMin: string;
      readonly latSec: string;
      readonly latHem: 'N' | 'S';
      readonly lonDeg: string;
      readonly lonMin: string;
      readonly lonSec: string;
      readonly lonHem: 'E' | 'W';
    }
  | {
      readonly kind: 'twd97-tm2';
      readonly easting: string;
      readonly northing: string;
      readonly zone: 'auto' | 119 | 121;
    }
  | { readonly kind: 'twd67-tm2'; readonly easting: string; readonly northing: string }
  | {
      readonly kind: 'mgrs';
      readonly gzdBand: string;
      readonly square: string;
      readonly easting: string;
      readonly northing: string;
    }
  | {
      readonly kind: 'taipower';
      readonly first5: string;
      readonly last4or6: string;
      readonly precision: 9 | 11;
    };

export interface RecentEntry {
  readonly format: FormatSelection;
  readonly raw: string;
  readonly createdAt: number;
}

export interface RecentList {
  readonly version: 1;
  readonly entries: readonly RecentEntry[];
}

export type CandidateSub =
  | 'wgs84-dd'
  | 'wgs84-dms'
  | 'mgrs'
  | 'twd97-zone-119'
  | 'twd97-zone-121'
  | 'twd67'
  | 'taipower';

export interface Candidate {
  readonly kind: CoordinateKind;
  readonly target: WGS84DD;
  readonly label: string;
  readonly sub: CandidateSub;
  readonly raw: string;
}

export interface DestinationIndicator {
  readonly visible: boolean;
  readonly createdAt: number;
  readonly ttlMs: 3000;
}
