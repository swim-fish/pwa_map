import type { Candidate, CandidateSub } from '$types/goto';
import type { CoordinateKind } from '$types/coord';
import {
  parseDdOnly,
  parseDmsOnly,
  parseMgrsOnly,
  parseTm2ExplicitOnly,
  parseTwd67Only,
  parseTaipowerOnly,
} from './parser';
import { coverageOf } from './coverage';

const SUB_LABEL_KEY: Record<CandidateSub, string> = {
  'wgs84-dd': 'goto.disambig.label.wgs84Dd',
  'wgs84-dms': 'goto.disambig.label.wgs84Dms',
  mgrs: 'goto.disambig.label.mgrs',
  'twd97-zone-119': 'goto.disambig.label.twd97Zone119',
  'twd97-zone-121': 'goto.disambig.label.twd97Zone121',
  twd67: 'goto.disambig.label.twd67',
  taipower: 'goto.disambig.label.taipower',
};

const SUB_TO_KIND: Record<CandidateSub, CoordinateKind> = {
  'wgs84-dd': 'wgs84-dd',
  'wgs84-dms': 'wgs84-dms',
  mgrs: 'mgrs',
  'twd97-zone-119': 'twd97-tm2',
  'twd97-zone-121': 'twd97-tm2',
  twd67: 'twd67-tm2',
  taipower: 'taipower',
};

function stripZoneQualifier(s: string): string {
  return s
    .replace(/[, ]?\(\s*zone\s*\d+\s*\)/gi, '')
    .replace(/[, ]?zone\s*[=:]?\s*\d+/gi, '')
    .trim();
}

function build(sub: CandidateSub, raw: string, target: { lat: number; lon: number }): Candidate {
  return {
    kind: SUB_TO_KIND[sub],
    target: { kind: 'wgs84-dd', lat: target.lat as never, lon: target.lon as never },
    label: SUB_LABEL_KEY[sub],
    sub,
    raw,
  };
}

export function candidates(raw: string): readonly Candidate[] {
  const out: Candidate[] = [];

  const dd = parseDdOnly(raw);
  if (dd.ok) out.push(build('wgs84-dd', raw, dd.target));

  const dms = parseDmsOnly(raw);
  if (dms.ok) out.push(build('wgs84-dms', raw, dms.target));

  const mgrs = parseMgrsOnly(raw);
  if (mgrs.ok) out.push(build('mgrs', raw, mgrs.target));

  const stripped = stripZoneQualifier(raw);
  const z119 = parseTm2ExplicitOnly(`${stripped} (zone 119)`, 119);
  if (z119.ok && coverageOf('twd97-tm2', z119.target) === 'ok') {
    out.push(build('twd97-zone-119', `${stripped} (zone 119)`, z119.target));
  }
  const z121 = parseTm2ExplicitOnly(`${stripped} (zone 121)`, 121);
  if (z121.ok && coverageOf('twd97-tm2', z121.target) === 'ok') {
    out.push(build('twd97-zone-121', `${stripped} (zone 121)`, z121.target));
  }

  const twd67Raw = /^twd67\b/i.test(stripped) ? stripped : `TWD67 ${stripped}`;
  const twd67 = parseTwd67Only(twd67Raw);
  if (twd67.ok && coverageOf('twd67-tm2', twd67.target) === 'ok') {
    out.push(build('twd67', twd67Raw, twd67.target));
  }

  const taipower = parseTaipowerOnly(raw);
  if (taipower.ok) out.push(build('taipower', raw, taipower.target));

  return out;
}
