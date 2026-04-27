import type {
  CoordinateKind,
  Hemisphere,
  TaipowerCode,
  TaipowerPrecision,
  WGS84DD,
  Zone,
} from '$types/coord';
import type { DMSPart } from '$types/coord';
import type { Rejection } from '$types/result';
import { err, preferRejection, reject } from '$types/result';
import { makeWGS84DD, dmsToDd } from './wgs84';
import { twd97ToWgs84, wgs84ToTwd97 } from './twd97';
import { twd67ToWgs84 } from './twd67';
import { mgrsToWgs84 } from './mgrs';
import { taipowerToWgs84 } from './taipower';

export interface GoToRequestOk {
  readonly ok: true;
  readonly raw: string;
  readonly parsedAs: CoordinateKind;
  readonly target: WGS84DD;
  readonly zoneAutoResolved?: Zone;
}

export type GoToRequest = GoToRequestOk | { readonly ok: false; readonly error: Rejection };

function normalise(raw: string): string {
  return raw.trim().normalize('NFC');
}

type SubParser = (raw: string) => SubParseResult;
type SubParseResult =
  | { verdict: 'accept'; request: GoToRequestOk }
  | { verdict: 'reject'; rejection: Rejection }
  | { verdict: 'decline' };

function acceptDd(raw: string, target: WGS84DD): SubParseResult {
  return {
    verdict: 'accept',
    request: { ok: true, raw, parsedAs: 'wgs84-dd', target },
  };
}

function rej(
  category: Rejection['category'],
  messageKey: string,
  raw: string,
  attemptedAs?: CoordinateKind,
): SubParseResult {
  return { verdict: 'reject', rejection: reject(category, messageKey, raw, attemptedAs) };
}

// ---------- WGS84 DD ----------

function splitDdPair(s: string): { lat: string; lon: string } | null {
  if (s.includes(',')) {
    const [a, b] = s.split(',').map((x) => x.trim());
    if (a && b) return { lat: a, lon: b };
  }
  // Hemisphere-prefixed: "N 25.03..., E 121.56..."
  const mN = s.match(/([NS])\s*(-?\d+(?:\.\d+)?)\s*[,\s]+([EW])\s*(-?\d+(?:\.\d+)?)/i);
  if (mN) return { lat: `${mN[2]} ${mN[1]}`, lon: `${mN[4]} ${mN[3]}` };
  return null;
}

function hemisphereFrom(s: string): Hemisphere | null {
  const m = s.match(/[NSEWnsew]/);
  if (!m) return null;
  return m[0].toUpperCase() as Hemisphere;
}

function parseDdScalar(token: string): { dd: number; hemisphere: Hemisphere | null } | null {
  const raw = token.trim();
  const h = hemisphereFrom(raw);
  const nums = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length !== 1) return null;
  const val = Number.parseFloat(nums[0]);
  if (!Number.isFinite(val)) return null;
  return { dd: val, hemisphere: h };
}

function applyHemisphere(
  dd: number,
  h: Hemisphere | null,
  axis: 'lat' | 'lon',
): number | 'mismatch' {
  if (!h) return dd;
  if (axis === 'lat') {
    if (h !== 'N' && h !== 'S') return 'mismatch';
    const sign = h === 'N' ? 1 : -1;
    if (dd < 0 && sign > 0) return 'mismatch';
    if (dd > 0 && sign < 0 && Math.abs(dd) > 0) return 'mismatch';
    return Math.abs(dd) * sign;
  }
  if (h !== 'E' && h !== 'W') return 'mismatch';
  const sign = h === 'E' ? 1 : -1;
  if (dd < 0 && sign > 0) return 'mismatch';
  if (dd > 0 && sign < 0 && Math.abs(dd) > 0) return 'mismatch';
  return Math.abs(dd) * sign;
}

function parseDd(raw: string): SubParseResult {
  const s = normalise(raw);
  // Reject DMS-looking strings to let parseDms take them.
  if (/[°′″'"]/.test(s)) return { verdict: 'decline' };
  // Decline when the input carries an MGRS / TM2 / Taipower signature:
  //   - digit+letter GZD  (e.g. "51R", "50Z")
  //   - explicit "zone" / "twd67" qualifiers
  //   - Taipower region letter A-Z followed by 4 digits
  if (/^-?\d{1,2}[A-Za-z]/.test(s)) return { verdict: 'decline' };
  if (/\b(zone|twd67)\b/i.test(s)) return { verdict: 'decline' };
  if (/^[A-Za-z]\d{4}/.test(s)) return { verdict: 'decline' };
  const hasComma = s.includes(',');
  const hasHemisphere = /\b[NSEWnsew]\b/.test(s);
  const numsAll = s.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const firstTwoInDdRange =
    numsAll.length >= 2 &&
    Math.abs(Number.parseFloat(numsAll[0] ?? '')) <= 180 &&
    Math.abs(Number.parseFloat(numsAll[1] ?? '')) <= 180;
  if (!hasComma && !hasHemisphere && !firstTwoInDdRange) {
    return { verdict: 'decline' };
  }
  // Third token (altitude) is explicitly rejected by the grammar.
  if (numsAll.length > 2) {
    return rej('unsupported-precision', 'errors.thirdToken', raw, 'wgs84-dd');
  }
  const pair = splitDdPair(s);
  if (!pair) {
    if (numsAll.length >= 2 && !hasComma) {
      return rej('malformed', 'errors.noSeparator', raw, 'wgs84-dd');
    }
    return { verdict: 'decline' };
  }
  const lat = parseDdScalar(pair.lat);
  const lon = parseDdScalar(pair.lon);
  if (!lat || !lon) return { verdict: 'decline' };
  const latSigned = applyHemisphere(lat.dd, lat.hemisphere, 'lat');
  if (latSigned === 'mismatch') {
    return rej('malformed', 'errors.hemisphereMismatch', raw, 'wgs84-dd');
  }
  const lonSigned = applyHemisphere(lon.dd, lon.hemisphere, 'lon');
  if (lonSigned === 'mismatch') {
    return rej('malformed', 'errors.hemisphereMismatch', raw, 'wgs84-dd');
  }
  const r = makeWGS84DD(latSigned, lonSigned);
  if (!r.ok) {
    return { verdict: 'reject', rejection: { ...r.error, attemptedAs: 'wgs84-dd' } };
  }
  return acceptDd(raw, r.value);
}

// ---------- WGS84 DMS ----------

const DMS_REGEX = /(-?\d+)\s*[°d]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]\s*([NSEWnsew])/i;
const DMS_HEMI_PREFIX_REGEX =
  /([NSEWnsew])\s*(-?\d+)\s*[°d]\s*(\d+)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]/i;

function parseDmsSide(
  token: string,
): { part: DMSPart; hemisphere: Hemisphere } | 'out-of-range' | null {
  const m1 = DMS_REGEX.exec(token);
  const m2 = !m1 ? DMS_HEMI_PREFIX_REGEX.exec(token) : null;
  let deg: number;
  let min: number;
  let sec: number;
  let hem: Hemisphere;
  if (m1) {
    deg = Math.abs(Number.parseInt(m1[1], 10));
    min = Number.parseInt(m1[2], 10);
    sec = Number.parseFloat(m1[3]);
    hem = m1[4].toUpperCase() as Hemisphere;
  } else if (m2) {
    hem = m2[1].toUpperCase() as Hemisphere;
    deg = Math.abs(Number.parseInt(m2[2], 10));
    min = Number.parseInt(m2[3], 10);
    sec = Number.parseFloat(m2[4]);
  } else {
    return null;
  }
  if (min >= 60) return 'out-of-range';
  if (sec >= 60) return 'out-of-range';
  return { part: { deg, min, sec, hemisphere: hem }, hemisphere: hem };
}

function parseDms(raw: string): SubParseResult {
  const s = normalise(raw);
  if (!/[°′″'"]/.test(s)) return { verdict: 'decline' };
  // Reject ordinal-indicator U+00BA ('º') per reference §3
  if (/º/.test(raw)) {
    return rej('malformed', 'errors.dms.ordinalIndicator', raw, 'wgs84-dms');
  }
  const parts = s.split(',');
  if (parts.length !== 2) {
    // Try hemisphere-prefixed pair form
    const combined = s.match(/([NSEWnsew][^,]*[″"][^,]*),\s*([NSEWnsew][^,]*[″"])/);
    if (!combined) {
      return rej('malformed', 'errors.noSeparator', raw, 'wgs84-dms');
    }
  }
  const latStr = parts[0];
  const lonStr = parts[1];
  const latParsed = parseDmsSide(latStr);
  const lonParsed = parseDmsSide(lonStr);
  if (latParsed === 'out-of-range' || lonParsed === 'out-of-range') {
    const minOutOfRange = /\b([6-9]\d|\d{3,})\s*['′]/.test(s);
    const messageKey = minOutOfRange
      ? 'errors.dms.minutesOutOfRange'
      : 'errors.dms.secondsOutOfRange';
    return rej('out-of-range', messageKey, raw, 'wgs84-dms');
  }
  if (!latParsed || !lonParsed) {
    return rej('malformed', 'errors.hemisphereMismatch', raw, 'wgs84-dms');
  }
  const latH = latParsed.hemisphere;
  const lonH = lonParsed.hemisphere;
  if (latH !== 'N' && latH !== 'S') {
    return rej('malformed', 'errors.hemisphereMismatch', raw, 'wgs84-dms');
  }
  if (lonH !== 'E' && lonH !== 'W') {
    return rej('malformed', 'errors.hemisphereMismatch', raw, 'wgs84-dms');
  }
  const latDd = dmsToDd(latParsed.part);
  const lonDd = dmsToDd(lonParsed.part);
  const r = makeWGS84DD(latDd, lonDd);
  if (!r.ok) {
    return { verdict: 'reject', rejection: { ...r.error, attemptedAs: 'wgs84-dms' } };
  }
  return {
    verdict: 'accept',
    request: { ok: true, raw, parsedAs: 'wgs84-dms', target: r.value },
  };
}

// ---------- MGRS ----------

function parseMgrsString(raw: string): SubParseResult {
  const s = normalise(raw).replace(/\s+/g, '').toUpperCase();
  if (!/^\d{1,2}[A-Z]/.test(s)) return { verdict: 'decline' };
  // Polar / invalid latitude band
  const bandMatch = /^\d{1,2}([A-Z])/.exec(s);
  if (!bandMatch) return { verdict: 'decline' };
  const band = bandMatch[1];
  if (!/[C-HJ-NP-X]/.test(band)) {
    // 'Z' is a polar band letter; reject out-of-coverage.
    if (band === 'A' || band === 'B' || band === 'Y' || band === 'Z') {
      return rej('out-of-coverage', 'errors.mgrs.polarBand', raw, 'mgrs');
    }
    return rej('malformed', 'errors.mgrs.invalidLetter', raw, 'mgrs');
  }
  // Must contain 100 km square letters
  if (!/^\d{1,2}[A-Z][A-Z]{2}/.test(s)) {
    return rej('unsupported-precision', 'errors.mgrs.missingSquare', raw, 'mgrs');
  }
  if (/[IO]/.test(s.slice(3))) {
    return rej('malformed', 'errors.mgrs.invalidLetter', raw, 'mgrs');
  }
  const tail = s.slice(5);
  if (!/^\d*$/.test(tail)) {
    return rej('malformed', 'errors.mgrs.invalidLetter', raw, 'mgrs');
  }
  if (tail.length % 2 !== 0 || tail.length > 10) {
    return rej('malformed', 'errors.mgrs.oddDigits', raw, 'mgrs');
  }
  try {
    const gzd = s.slice(0, 3);
    const square = s.slice(3, 5);
    const half = tail.length / 2;
    const precision = (half === 0 ? 1 : half) as 1 | 2 | 3 | 4 | 5;
    const target = mgrsToWgs84({
      kind: 'mgrs',
      gzd,
      square,
      easting: half === 0 ? 0 : Number.parseInt(tail.slice(0, half), 10),
      northing: half === 0 ? 0 : Number.parseInt(tail.slice(half), 10),
      precision,
    });
    return {
      verdict: 'accept',
      request: { ok: true, raw, parsedAs: 'mgrs', target },
    };
  } catch {
    return rej('malformed', 'errors.mgrs.invalidLetter', raw, 'mgrs');
  }
}

// ---------- TWD97 TM2 ----------

function extractZone(s: string): Zone | 'unknown' | null {
  const m = s.match(/zone\s*[=:]?\s*(\d{3})|\bzone\s+(\d{3})/i);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? m[2], 10);
  if (n === 119 || n === 121) return n as Zone;
  return 'unknown';
}

function extractTm2Pair(s: string): { e: number; n: number } | null {
  const stripped = s.replace(/[a-zA-Z()=]/g, ' ');
  const nums = stripped.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  // Take first two numbers as easting, northing (zone comes separately).
  const e = Number.parseFloat(nums[0]);
  const n = Number.parseFloat(nums[1]);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return null;
  return { e, n };
}

function countAltitudeTokens(s: string): boolean {
  return /altitude|altura|海拔|elevation/i.test(s);
}

function parseTm2Explicit(raw: string): SubParseResult {
  const s = normalise(raw);
  if (/twd67/i.test(s)) return { verdict: 'decline' };
  const zone = extractZone(s);
  if (zone === null) return { verdict: 'decline' };
  if (zone === 'unknown') {
    return rej('out-of-range', 'errors.tm2.unknownZone', raw, 'twd97-tm2');
  }
  if (countAltitudeTokens(s)) {
    return rej('unsupported-precision', 'errors.thirdToken', raw, 'twd97-tm2');
  }
  const pair = extractTm2Pair(s);
  if (!pair) {
    return rej('malformed', 'errors.noSeparator', raw, 'twd97-tm2');
  }
  if (pair.e < 0) {
    return rej('out-of-range', 'errors.tm2.negativeEasting', raw, 'twd97-tm2');
  }
  if (pair.n < 0) {
    return rej('out-of-range', 'errors.tm2.negativeNorthing', raw, 'twd97-tm2');
  }
  // A third numeric token that is NOT the zone is treated as an altitude.
  const nums = s.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (nums.length > 3) {
    return rej('unsupported-precision', 'errors.thirdToken', raw, 'twd97-tm2');
  }
  // Detect obviously-wrong km-scale inputs.
  if (pair.e < 10000 && pair.n < 100000) {
    return rej('out-of-range', 'errors.tm2.bothZonesFail', raw, 'twd97-tm2');
  }
  try {
    const target = twd97ToWgs84({
      kind: 'twd97-tm2',
      easting: pair.e as never,
      northing: pair.n as never,
      zone,
    });
    return {
      verdict: 'accept',
      request: { ok: true, raw, parsedAs: 'twd97-tm2', target },
    };
  } catch {
    return rej('malformed', 'errors.tm2.negativeEasting', raw, 'twd97-tm2');
  }
}

function parseTm2Inferred(raw: string): SubParseResult {
  const s = normalise(raw);
  if (/twd67/i.test(s)) return { verdict: 'decline' };
  if (/zone/i.test(s)) return { verdict: 'decline' };
  if (/,\d{3},/.test(s)) {
    return rej('malformed', 'errors.tm2.thousandSeparator', raw, 'twd97-tm2');
  }
  if (countAltitudeTokens(s)) {
    return rej('unsupported-precision', 'errors.thirdToken', raw, 'twd97-tm2');
  }
  const pair = extractTm2Pair(s);
  if (!pair) return { verdict: 'decline' };
  if (pair.e < 0) {
    return rej('out-of-range', 'errors.tm2.negativeEasting', raw, 'twd97-tm2');
  }
  if (pair.n < 0) {
    return rej('out-of-range', 'errors.tm2.negativeNorthing', raw, 'twd97-tm2');
  }
  // TM2 eastings for Taiwan are roughly 100k–500k; northings 2.4M–2.8M.
  if (pair.e < 10000 || pair.n < 100000) return { verdict: 'decline' };

  const nums = s.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (nums.length > 2) {
    return rej('unsupported-precision', 'errors.thirdToken', raw, 'twd97-tm2');
  }

  // Back-project against both zones and pick per §9.
  const zones: Zone[] = [121, 119];
  type Candidate = { zone: Zone; dd: WGS84DD; score: number };
  const candidates: Candidate[] = [];
  for (const z of zones) {
    try {
      const dd = twd97ToWgs84({
        kind: 'twd97-tm2',
        easting: pair.e as never,
        northing: pair.n as never,
        zone: z,
      });
      // Quality heuristic: is the back-projected longitude plausible for the zone?
      const plausible = dd.lat >= 20 && dd.lat <= 27 && dd.lon >= 118 && dd.lon <= 123;
      candidates.push({ zone: z, dd, score: plausible ? 1 : 0 });
    } catch {
      /* ignore */
    }
  }
  const good = candidates.filter((c) => c.score > 0);
  if (good.length === 0) {
    return rej('out-of-range', 'errors.tm2.bothZonesFail', raw, 'twd97-tm2');
  }
  const chosen =
    good.find((c) => (c.zone === 121 && c.dd.lon >= 120) || (c.zone === 119 && c.dd.lon < 120)) ??
    good.find((c) => c.zone === 121) ??
    good[0];

  // Re-round-trip the dd through wgs84ToTwd97 in the chosen zone to verify.
  try {
    wgs84ToTwd97(chosen.dd, chosen.zone);
  } catch {
    return rej('out-of-range', 'errors.tm2.bothZonesFail', raw, 'twd97-tm2');
  }

  return {
    verdict: 'accept',
    request: {
      ok: true,
      raw,
      parsedAs: 'twd97-tm2',
      target: chosen.dd,
      zoneAutoResolved: chosen.zone,
    },
  };
}

function parseTwd67Input(raw: string): SubParseResult {
  const s = normalise(raw);
  if (!/twd67/i.test(s)) return { verdict: 'decline' };
  if (/\bkm\b/i.test(s)) {
    return rej('malformed', 'errors.twd67.kmUnit', raw, 'twd67-tm2');
  }
  const zone = extractZone(s);
  if (zone === 'unknown' || (zone && zone !== 121)) {
    return rej('out-of-range', 'errors.tm2.unknownZone', raw, 'twd67-tm2');
  }
  // Strip the TWD67 qualifier *before* extracting the easting/northing pair —
  // its embedded digits (the "67") would otherwise be matched as the easting.
  const stripped = s.replace(/twd67/gi, ' ');
  const pair = extractTm2Pair(stripped);
  if (!pair) return rej('malformed', 'errors.noSeparator', raw, 'twd67-tm2');
  if (pair.e < 0) {
    return rej('out-of-range', 'errors.tm2.negativeEasting', raw, 'twd67-tm2');
  }
  if (pair.n < 0) {
    return rej('out-of-range', 'errors.tm2.negativeNorthing', raw, 'twd67-tm2');
  }
  if (/\bm\b/i.test(stripped)) {
    return rej('malformed', 'errors.twd67.kmUnit', raw, 'twd67-tm2');
  }
  try {
    const target = twd67ToWgs84({
      kind: 'twd67-tm2',
      easting: pair.e as never,
      northing: pair.n as never,
    });
    return {
      verdict: 'accept',
      request: { ok: true, raw, parsedAs: 'twd67-tm2', target },
    };
  } catch {
    return rej('malformed', 'errors.noSeparator', raw, 'twd67-tm2');
  }
}

// ---------- Taipower ----------

const TAIPOWER_SHAPE = /^([A-Z])(\d{4})\s*([A-Z]{2})(\d{2,4})$/i;
// Strip the project's documented Taipower separator set (whitespace,
// hyphen, underscore) before length classification. Mirrors the
// existing `\s+` strip and adds the hyphen / underscore variants the
// auto-precision contract calls out (research §R7).
const TAIPOWER_SEPARATOR = /[\s\-_]/g;

/**
 * Detect Taipower input precision by trimmed, separator-stripped length.
 * Pure: no DOM, no localStorage, no Date.now(). Returns null for any
 * length other than 9 / 11 — the caller surfaces the existing localised
 * `'unsupported-precision'` rejection (feature 002 vocabulary).
 */
export function detectTaipowerPrecision(input: string): 9 | 11 | null {
  const stripped = input.trim().replace(TAIPOWER_SEPARATOR, '');
  if (stripped.length === 9) return 9;
  if (stripped.length === 11) return 11;
  return null;
}

function parseTaipowerInput(raw: string): SubParseResult {
  const s = normalise(raw).replace(/\s+/g, ' ').toUpperCase();
  const compact = s.replace(/\s+/g, '');
  if (!/^[A-Z]/.test(compact)) {
    if (/^\d/.test(compact)) return { verdict: 'decline' };
    return { verdict: 'decline' };
  }
  // Taipower letters Y/Z are explicitly out-of-coverage
  if (/^[YZ]/.test(compact)) {
    return rej('out-of-coverage', 'errors.taipower.outerIsland', raw, 'taipower');
  }
  if (!/^[A-X]/.test(compact)) {
    return rej('malformed', 'errors.taipower.notALetter', raw, 'taipower');
  }
  const m = TAIPOWER_SHAPE.exec(s) ?? TAIPOWER_SHAPE.exec(compact);
  if (!m) {
    if (compact.length < 9) {
      return rej('unsupported-precision', 'errors.taipower.wrongLength', raw, 'taipower');
    }
    return rej('malformed', 'errors.taipower.wrongLength', raw, 'taipower');
  }
  // Auto-precision check (FR-015). The SHAPE regex permits a 3-digit
  // tail — guard against length-10 inputs by requiring the trimmed,
  // separator-stripped length to be exactly 9 or 11.
  const detectedPrecision = detectTaipowerPrecision(raw);
  if (detectedPrecision === null) {
    return rej('unsupported-precision', 'errors.taipower.wrongLength', raw, 'taipower');
  }
  const region = m[1].toUpperCase();
  const subRegion = m[2];
  const hundredMeter = m[3].toUpperCase();
  const tail = m[4];
  if (/I/.test(hundredMeter)) {
    return rej('malformed', 'errors.taipower.invalidHundredMeter', raw, 'taipower');
  }
  if (tail.length !== 2 && tail.length !== 4) {
    return rej('malformed', 'errors.taipower.wrongLength', raw, 'taipower');
  }
  const precision: TaipowerPrecision = tail.length === 4 ? 11 : 9;
  const code: TaipowerCode = {
    kind: 'taipower',
    region,
    subRegion,
    hundredMeter,
    tenMeter: tail.slice(0, 2),
    oneMeter: tail.length === 4 ? tail.slice(2, 4) : null,
    precision,
  };
  const r = taipowerToWgs84(code);
  if (!r.ok) {
    return { verdict: 'reject', rejection: { ...r.error, attemptedAs: 'taipower' } };
  }
  return {
    verdict: 'accept',
    request: { ok: true, raw, parsedAs: 'taipower', target: r.value },
  };
}

// ---------- Dispatcher ----------

const SUB_PARSERS: readonly SubParser[] = [
  parseDd,
  parseDms,
  parseMgrsString,
  parseTm2Explicit,
  parseTm2Inferred,
  parseTwd67Input,
  parseTaipowerInput,
];

export function parseGoTo(rawInput: string): GoToRequest {
  const raw = rawInput ?? '';
  const s = normalise(raw);
  if (s === '') {
    return err(reject('malformed', 'errors.emptyInput', raw));
  }
  const rejections: Rejection[] = [];
  for (const sub of SUB_PARSERS) {
    const r = sub(raw);
    if (r.verdict === 'accept') {
      return r.request;
    }
    if (r.verdict === 'reject') {
      rejections.push(r.rejection);
    }
  }
  if (rejections.length === 0) {
    return err(reject('malformed', 'errors.noSeparator', raw));
  }
  const best = rejections.reduce((acc, cur) => preferRejection(acc, cur));
  return err(best);
}

export default parseGoTo;

function liftSub(result: SubParseResult, raw: string, attemptedAs: CoordinateKind): GoToRequest {
  if (result.verdict === 'accept') return result.request;
  if (result.verdict === 'reject') return err(result.rejection);
  return err(reject('malformed', 'errors.noSeparator', raw, attemptedAs));
}

export function parseDdOnly(raw: string): GoToRequest {
  return liftSub(parseDd(raw), raw, 'wgs84-dd');
}

export function parseDmsOnly(raw: string): GoToRequest {
  return liftSub(parseDms(raw), raw, 'wgs84-dms');
}

export function parseMgrsOnly(raw: string): GoToRequest {
  return liftSub(parseMgrsString(raw), raw, 'mgrs');
}

export function parseTm2InferredOnly(raw: string): GoToRequest {
  return liftSub(parseTm2Inferred(raw), raw, 'twd97-tm2');
}

export function parseTm2ExplicitOnly(raw: string, _zone: 119 | 121): GoToRequest {
  return liftSub(parseTm2Explicit(raw), raw, 'twd97-tm2');
}

export function parseTwd67Only(raw: string): GoToRequest {
  return liftSub(parseTwd67Input(raw), raw, 'twd67-tm2');
}

export function parseTaipowerOnly(raw: string): GoToRequest {
  return liftSub(parseTaipowerInput(raw), raw, 'taipower');
}

// Internal — helpers for focused unit tests.
export const __INTERNAL__ = {
  parseDd,
  parseDms,
  parseMgrsString,
  parseTm2Explicit,
  parseTm2Inferred,
  parseTwd67Input,
  parseTaipowerInput,
};
