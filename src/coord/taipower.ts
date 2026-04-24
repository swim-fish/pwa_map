import type {
  Easting,
  Lat,
  Lon,
  Northing,
  TaipowerCode,
  TaipowerPrecision,
  TWD67TM2,
  WGS84DD,
} from '$types/coord';
import type { Rejection } from '$types/result';
import { err, ok, reject, type Result } from '$types/result';
import { wgs84ToTwd67, twd67ToWgs84 } from './twd67';

// Reference §8 — Taipower main-island grid over TWD67 TM2 zone 121.
// Letters are assigned top (north) → bottom (south), west → east:
//   row_idx 0 (north, Y=2,750,000):  A  B  C
//   row_idx 1           (Y=2,700,000): D  E  F
//   row_idx 2           (Y=2,650,000): G  H  I
//   row_idx 3           (Y=2,600,000): J  K  L
//   row_idx 4           (Y=2,550,000): M  N  O
//   row_idx 5           (Y=2,500,000): P  Q  R
//   row_idx 6           (Y=2,450,000): S  T  U
//   row_idx 7 (south, Y=2,400,000):  V  W  X
// Y / Z are reserved for outer islands and rejected as out-of-coverage.

const ANCHOR_E_WEST = 170_000; // X_base of column 0
const ANCHOR_N_SOUTH = 2_400_000; // Y_base of geographic southernmost row
const REGION_WIDTH = 80_000; // metres (E direction, per region)
const REGION_HEIGHT = 50_000; // metres (N direction, per region)
const ROWS = 8; // 8 letter rows
const COLS = 3; // 3 letter columns

// Sub-region step sizes per reference §8 table.
const SUBREGION_STEP_E = 800; // chars 1-2 × 800 m
const SUBREGION_STEP_N = 500; // chars 3-4 × 500 m

// 100 m letters use A..J (10 letters, no skipped letters per reference §8).
const HM_LETTERS = 'ABCDEFGHIJ';

interface RegionAnchor {
  readonly xBase: number;
  readonly yBase: number;
  readonly colIdx: number; // 0 (west) .. 2 (east)
  readonly rowIdx: number; // 0 (north) .. 7 (south)  — i.e., letter-table row
}

function letterIndex(rowIdx: number, colIdx: number): number {
  return rowIdx * COLS + colIdx;
}

function regionLetter(rowIdx: number, colIdx: number): string | null {
  if (rowIdx < 0 || rowIdx >= ROWS) return null;
  if (colIdx < 0 || colIdx >= COLS) return null;
  return String.fromCharCode('A'.charCodeAt(0) + letterIndex(rowIdx, colIdx));
}

function anchorForLetter(letter: string): RegionAnchor | null {
  const up = letter.toUpperCase();
  const code = up.charCodeAt(0) - 'A'.charCodeAt(0);
  if (code < 0 || code >= ROWS * COLS) return null;
  const rowIdx = Math.floor(code / COLS);
  const colIdx = code % COLS;
  const xBase = ANCHOR_E_WEST + colIdx * REGION_WIDTH;
  // rowIdx 0 = northernmost (highest Y_base), rowIdx 7 = southernmost.
  const yBase = ANCHOR_N_SOUTH + (ROWS - 1 - rowIdx) * REGION_HEIGHT;
  return { xBase, yBase, rowIdx, colIdx };
}

function outOfCoverage(raw: string): Rejection {
  return reject('out-of-coverage', 'errors.taipower.outerIsland', raw, 'taipower');
}

export function wgs84ToTaipower(
  dd: WGS84DD,
  precision: TaipowerPrecision = 9,
): Result<TaipowerCode, Rejection> {
  const tm67 = wgs84ToTwd67(dd);
  return twd67ToTaipower(tm67, precision);
}

export function twd67ToTaipower(
  tm: TWD67TM2,
  precision: TaipowerPrecision = 9,
): Result<TaipowerCode, Rejection> {
  const x = tm.easting;
  const y = tm.northing;

  const dxFromWest = x - ANCHOR_E_WEST;
  const dyFromSouth = y - ANCHOR_N_SOUTH;
  if (dxFromWest < 0 || dyFromSouth < 0) {
    return err(outOfCoverage(`TWD67 ${x.toFixed(0)},${y.toFixed(0)}`));
  }
  const colIdx = Math.floor(dxFromWest / REGION_WIDTH);
  const geoRow = Math.floor(dyFromSouth / REGION_HEIGHT); // 0 south .. 7 north
  const rowIdx = ROWS - 1 - geoRow; // 0 north .. 7 south (letter-table order)
  const letter = regionLetter(rowIdx, colIdx);
  if (!letter) {
    return err(outOfCoverage(`TWD67 ${x.toFixed(0)},${y.toFixed(0)}`));
  }

  const xBase = ANCHOR_E_WEST + colIdx * REGION_WIDTH;
  const yBase = ANCHOR_N_SOUTH + geoRow * REGION_HEIGHT;

  let dx = x - xBase;
  let dy = y - yBase;

  // Chars 1-4: sub-region digits at 800 m / 500 m step.
  const xHundreds = Math.floor(dx / SUBREGION_STEP_E); // 0..99
  dx -= xHundreds * SUBREGION_STEP_E;
  const yHundreds = Math.floor(dy / SUBREGION_STEP_N); // 0..99
  dy -= yHundreds * SUBREGION_STEP_N;

  const digit1 = Math.floor(xHundreds / 10);
  const digit2 = xHundreds % 10;
  const digit3 = Math.floor(yHundreds / 10);
  const digit4 = yHundreds % 10;
  const subRegion = `${digit1}${digit2}${digit3}${digit4}`;

  // Chars 5-6: 100 m letters.
  const letter5Idx = Math.floor(dx / 100); // 0..9 (dx now in 0..800)
  dx -= letter5Idx * 100;
  const letter6Idx = Math.floor(dy / 100); // 0..9 (dy now in 0..500)
  dy -= letter6Idx * 100;
  const hundredMeter = `${HM_LETTERS[letter5Idx] ?? 'A'}${HM_LETTERS[letter6Idx] ?? 'A'}`;

  // Chars 7-8: 10 m digits.
  const digit7 = Math.floor(dx / 10);
  dx -= digit7 * 10;
  const digit8 = Math.floor(dy / 10);
  dy -= digit8 * 10;
  const tenMeter = `${digit7}${digit8}`;

  let oneMeter: string | null = null;
  if (precision === 11) {
    const digit9 = Math.round(dx); // 0..9
    const digit10 = Math.round(dy); // 0..9
    oneMeter = `${Math.min(9, digit9)}${Math.min(9, digit10)}`;
  }

  return ok({
    kind: 'taipower',
    region: letter,
    subRegion,
    hundredMeter,
    tenMeter,
    oneMeter,
    precision,
  });
}

export function taipowerToTwd67(code: TaipowerCode): Result<TWD67TM2, Rejection> {
  const anchor = anchorForLetter(code.region);
  if (!anchor) {
    return err(outOfCoverage(code.region));
  }
  if (code.subRegion.length !== 4 || !/^\d{4}$/.test(code.subRegion)) {
    return err(reject('malformed', 'errors.taipower.subRegionDigits', code.subRegion, 'taipower'));
  }

  const digit1 = Number.parseInt(code.subRegion[0], 10);
  const digit2 = Number.parseInt(code.subRegion[1], 10);
  const digit3 = Number.parseInt(code.subRegion[2], 10);
  const digit4 = Number.parseInt(code.subRegion[3], 10);

  const xHundreds = digit1 * 10 + digit2;
  const yHundreds = digit3 * 10 + digit4;

  const letter5Idx = HM_LETTERS.indexOf(code.hundredMeter[0]?.toUpperCase() ?? '');
  const letter6Idx = HM_LETTERS.indexOf(code.hundredMeter[1]?.toUpperCase() ?? '');
  if (letter5Idx < 0 || letter6Idx < 0) {
    return err(
      reject('malformed', 'errors.taipower.invalidHundredMeter', code.hundredMeter, 'taipower'),
    );
  }

  if (code.tenMeter.length !== 2 || !/^\d{2}$/.test(code.tenMeter)) {
    return err(reject('malformed', 'errors.taipower.tenMeterDigits', code.tenMeter, 'taipower'));
  }
  const digit7 = Number.parseInt(code.tenMeter[0], 10);
  const digit8 = Number.parseInt(code.tenMeter[1], 10);

  let digit9 = 0;
  let digit10 = 0;
  if (code.precision === 11 && code.oneMeter && /^\d{2}$/.test(code.oneMeter)) {
    digit9 = Number.parseInt(code.oneMeter[0], 10);
    digit10 = Number.parseInt(code.oneMeter[1], 10);
  }

  // Reconstruct dx / dy offsets within the region. Place at the cell center
  // (half-cell) so forward(back(code)) is maximally stable.
  const cellE = code.precision === 11 ? 0.5 : 5; // 1 m or 10 m cell half-width
  const cellN = code.precision === 11 ? 0.5 : 5;
  const dx =
    xHundreds * SUBREGION_STEP_E +
    letter5Idx * 100 +
    digit7 * 10 +
    (code.precision === 11 ? digit9 : 0) +
    cellE;
  const dy =
    yHundreds * SUBREGION_STEP_N +
    letter6Idx * 100 +
    digit8 * 10 +
    (code.precision === 11 ? digit10 : 0) +
    cellN;

  const easting = anchor.xBase + dx;
  const northing = anchor.yBase + dy;

  return ok({
    kind: 'twd67-tm2',
    easting: easting as Easting,
    northing: northing as Northing,
  });
}

export function taipowerToWgs84(code: TaipowerCode): Result<WGS84DD, Rejection> {
  const r = taipowerToTwd67(code);
  if (!r.ok) return err(r.error);
  const dd = twd67ToWgs84(r.value);
  return ok({
    kind: 'wgs84-dd',
    lat: dd.lat as Lat,
    lon: dd.lon as Lon,
  });
}

export function formatTaipower(code: TaipowerCode): string {
  const tail = `${code.hundredMeter}${code.tenMeter}${code.oneMeter ?? ''}`;
  return `${code.region}${code.subRegion} ${tail}`;
}
