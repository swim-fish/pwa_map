import type {
  CoordinateKind,
  Locale,
  MGRSPrecision,
  TaipowerPrecision,
  WGS84DD,
} from '$types/coord';
import { ALL_COORDINATE_KINDS } from '$types/coord';
import { isLocale } from '$i18n/index';
import { isBasemapId, type BasemapId } from '$map/sources';
import {
  TTL_OPTIONS,
  MAX_ENTRIES_OPTIONS,
  DEFAULT_TILE_TTL_DAYS,
  DEFAULT_TILE_MAX_ENTRIES,
  type TtlDays,
  type TileMaxEntries,
} from '$pwa/cachePolicy';

const PREFS_KEY = 'pwa_map:prefs';
const LAST_VIEW_KEY = 'pwa_map:lastView';
const PREFS_VERSION = 2 as const;

/** v1 shape — kept for the migration path; not exported. */
interface FormatPreferencesV1 {
  readonly version: 1;
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;
}

export interface FormatPreferencesV2 {
  readonly version: 2;
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;
  readonly tileTtlDays: TtlDays;
  readonly tileMaxEntries: TileMaxEntries;
}

export type FormatPreferences = FormatPreferencesV2;

export interface MapViewState {
  readonly center: WGS84DD;
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}

const MGRS_PRECISIONS: readonly MGRSPrecision[] = [1, 2, 3, 4, 5];
const TAIPOWER_PRECISIONS: readonly TaipowerPrecision[] = [9, 11];

export function defaultPreferences(): FormatPreferences {
  return {
    version: PREFS_VERSION,
    visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs', 'taipower'],
    mgrsPrecision: 5,
    taipowerPrecision: 9,
    locale: 'zh',
    mapLayer: 'nlsc-emap5',
    overlay: false,
    tileTtlDays: DEFAULT_TILE_TTL_DAYS,
    tileMaxEntries: DEFAULT_TILE_MAX_ENTRIES,
  };
}

function isCoordinateKind(v: unknown): v is CoordinateKind {
  return typeof v === 'string' && (ALL_COORDINATE_KINDS as readonly string[]).includes(v);
}

function isMgrsPrecision(v: unknown): v is MGRSPrecision {
  return typeof v === 'number' && (MGRS_PRECISIONS as readonly number[]).includes(v);
}

function isTaipowerPrecision(v: unknown): v is TaipowerPrecision {
  return typeof v === 'number' && (TAIPOWER_PRECISIONS as readonly number[]).includes(v);
}

function isTtlDays(v: unknown): v is TtlDays {
  return typeof v === 'number' && (TTL_OPTIONS as readonly number[]).includes(v);
}

function isTileMaxEntries(v: unknown): v is TileMaxEntries {
  return typeof v === 'number' && (MAX_ENTRIES_OPTIONS as readonly number[]).includes(v);
}

interface CommonValidatedFields {
  visible: readonly CoordinateKind[];
  mgrsPrecision: MGRSPrecision;
  taipowerPrecision: TaipowerPrecision;
  locale: Locale;
  mapLayer?: BasemapId;
  overlay?: boolean;
}

function validateCommonFields(o: Record<string, unknown>): CommonValidatedFields | null {
  if (!Array.isArray(o.visible)) return null;
  const visible = o.visible.filter(isCoordinateKind);
  if (visible.length !== o.visible.length) return null;
  const dedup = new Set(visible);
  if (dedup.size !== visible.length) return null;
  if (!isMgrsPrecision(o.mgrsPrecision)) return null;
  if (!isTaipowerPrecision(o.taipowerPrecision)) return null;
  if (!isLocale(o.locale)) return null;

  let mapLayer: BasemapId | undefined;
  if (o.mapLayer !== undefined) {
    if (!isBasemapId(o.mapLayer)) return null;
    mapLayer = o.mapLayer;
  }
  let overlay: boolean | undefined;
  if (o.overlay !== undefined) {
    if (typeof o.overlay !== 'boolean') return null;
    overlay = o.overlay;
  }
  return {
    visible: visible as readonly CoordinateKind[],
    mgrsPrecision: o.mgrsPrecision,
    taipowerPrecision: o.taipowerPrecision,
    locale: o.locale,
    mapLayer,
    overlay,
  };
}

function validatePreferences(raw: unknown): FormatPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (o.version !== 1 && o.version !== 2) return null;

  const common = validateCommonFields(o);
  if (!common) return null;

  // v2 fields: substitute defaults if missing or invalid (additive
  // migration; never reject the whole record over a v2-only field).
  const tileTtlDays: TtlDays =
    o.version === 2 && isTtlDays(o.tileTtlDays) ? o.tileTtlDays : DEFAULT_TILE_TTL_DAYS;
  const tileMaxEntries: TileMaxEntries =
    o.version === 2 && isTileMaxEntries(o.tileMaxEntries)
      ? o.tileMaxEntries
      : DEFAULT_TILE_MAX_ENTRIES;

  return {
    version: PREFS_VERSION,
    visible: common.visible,
    mgrsPrecision: common.mgrsPrecision,
    taipowerPrecision: common.taipowerPrecision,
    locale: common.locale,
    ...(common.mapLayer !== undefined ? { mapLayer: common.mapLayer } : {}),
    ...(common.overlay !== undefined ? { overlay: common.overlay } : {}),
    tileTtlDays,
    tileMaxEntries,
  };
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadPreferences(): FormatPreferences {
  const s = safeStorage();
  if (!s) return defaultPreferences();
  const raw = s.getItem(PREFS_KEY);
  if (!raw) return defaultPreferences();
  try {
    const parsed: unknown = JSON.parse(raw);
    const validated = validatePreferences(parsed);
    return validated ?? defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(prefs: FormatPreferences): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

export function loadTileTtlDays(): TtlDays {
  return loadPreferences().tileTtlDays;
}

export function saveTileTtlDays(value: TtlDays): void {
  const current = loadPreferences();
  savePreferences({ ...current, tileTtlDays: value });
}

export function loadTileMaxEntries(): TileMaxEntries {
  return loadPreferences().tileMaxEntries;
}

export function saveTileMaxEntries(value: TileMaxEntries): void {
  const current = loadPreferences();
  savePreferences({ ...current, tileMaxEntries: value });
}

function validateMapViewState(raw: unknown): MapViewState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const c = o.center as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') return null;
  if (c.kind !== 'wgs84-dd') return null;
  if (typeof c.lat !== 'number' || typeof c.lon !== 'number') return null;
  if (!Number.isFinite(c.lat) || Math.abs(c.lat) > 90) return null;
  if (!Number.isFinite(c.lon) || Math.abs(c.lon) > 180) return null;
  if (typeof o.zoom !== 'number' || !Number.isFinite(o.zoom)) return null;
  const bearing = typeof o.bearing === 'number' ? o.bearing : 0;
  const pitch = typeof o.pitch === 'number' ? o.pitch : 0;
  return {
    center: { kind: 'wgs84-dd', lat: c.lat as never, lon: c.lon as never },
    zoom: o.zoom,
    bearing,
    pitch,
  };
}

export function loadLastView(): MapViewState | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(LAST_VIEW_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateMapViewState(parsed);
  } catch {
    return null;
  }
}

export function saveLastView(view: MapViewState): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(LAST_VIEW_KEY, JSON.stringify(view));
  } catch {
    /* ignore */
  }
}

export const __TESTING__ = { PREFS_KEY, LAST_VIEW_KEY, PREFS_VERSION };

// Type retained for migration-path callers (currently none). Exporting
// as a side-effect-free re-export keeps the declaration tree-shakeable.
export type { FormatPreferencesV1 };
