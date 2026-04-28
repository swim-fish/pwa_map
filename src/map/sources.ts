/**
 * Feature 012 — 3D / Terrain lockdown anchor. While
 * `LOCKDOWN_REGISTER.terrain.lockedValue === null` (per
 * `threeDLockdown.ts` and ADR-0032), a terrain RGB DEM source MUST
 * NOT be registered in this catalogue. Adding one would either be a
 * dead source (since `setTerrain(...)` is never called) or, worse,
 * accidentally enable terrain rendering when a future caller assumes
 * "if a terrain source is in the catalogue, terrain is on".
 *
 * Re-enabling terrain is a deliberate joint change: flip
 * `LOCKDOWN_REGISTER.terrain.lockedValue` to a real config object,
 * register the DEM source here, and call `map.setTerrain(...)` from
 * `MapView.svelte`'s post-style hook.
 *
 * No runtime / typed cross-import is needed — the JSDoc above
 * names `threeDLockdown.ts` explicitly so IDE jump-to-file works,
 * and the lockdown-runtime integration test greps this file for the
 * `threeDLockdown` and `ADR-0032` substrings (Copilot review on
 * PR #4 — keeps the catalogue's public API surface clean).
 */

export type MapGroup = 'nlsc' | 'google' | 'other';

export interface MapLayerOption {
  readonly id: string;
  readonly labelKey: string;
  readonly group: MapGroup;
  readonly urlTemplate: string;
  readonly tileSize: 256;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly attributionKey: string;
  readonly isOverlay: boolean;
}

export type BasemapId =
  | 'osm-standard'
  | 'nlsc-emap5'
  | 'google-hybrid'
  | 'google-satellite'
  | 'google-terrain'
  | 'google-roadmap';

export type OverlayId = 'google-road-overlay';

// Catalogue mirrors the IDs / labels in
// ../atak_flutter_map/lib/features/mbtiles/domain/models/online_source.dart
// for cross-tool naming parity. Two PWA-specific divergences:
//   1. Google URLs are upgraded from http:// to https:// (mixed-content rule).
//   2. `hl=zh-TW` is fixed in the URL template per FR-007 + FR-013 — UI locale
//      switching does NOT mutate it.
export const MAP_SOURCES: readonly MapLayerOption[] = Object.freeze([
  Object.freeze({
    id: 'osm-standard',
    labelKey: 'map.layers.osmStandard',
    group: 'other',
    urlTemplate: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 19,
    attributionKey: 'map.attribution.osm',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'nlsc-emap5',
    labelKey: 'map.layers.nlscEmap5',
    group: 'nlsc',
    urlTemplate: 'https://wmts.nlsc.gov.tw/wmts/EMAP5/default/GoogleMapsCompatible/{z}/{y}/{x}',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 19,
    attributionKey: 'map.attribution.nlsc',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'google-hybrid',
    labelKey: 'map.layers.googleHybrid',
    group: 'google',
    urlTemplate: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=zh-TW',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 20,
    attributionKey: 'map.attribution.google',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'google-satellite',
    labelKey: 'map.layers.googleSatellite',
    group: 'google',
    urlTemplate: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 20,
    attributionKey: 'map.attribution.google',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'google-terrain',
    labelKey: 'map.layers.googleTerrain',
    group: 'google',
    urlTemplate: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=zh-TW',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 20,
    attributionKey: 'map.attribution.google',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'google-roadmap',
    labelKey: 'map.layers.googleRoadmap',
    group: 'google',
    urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=zh-TW',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 20,
    attributionKey: 'map.attribution.google',
    isOverlay: false,
  }),
  Object.freeze({
    id: 'google-road-overlay',
    labelKey: 'map.layers.googleRoadOverlay',
    group: 'google',
    urlTemplate: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&hl=zh-TW',
    tileSize: 256,
    minZoom: 0,
    maxZoom: 20,
    attributionKey: 'map.attribution.google',
    isOverlay: true,
  }),
]);

export const DEFAULT_BASEMAP: BasemapId = 'osm-standard';

export function findSource(id: string): MapLayerOption | undefined {
  return MAP_SOURCES.find((s) => s.id === id);
}

export function basemaps(): readonly MapLayerOption[] {
  return MAP_SOURCES.filter((s) => !s.isOverlay);
}

export function overlays(): readonly MapLayerOption[] {
  return MAP_SOURCES.filter((s) => s.isOverlay);
}

const BASEMAP_IDS: readonly BasemapId[] = [
  'osm-standard',
  'nlsc-emap5',
  'google-hybrid',
  'google-satellite',
  'google-terrain',
  'google-roadmap',
];

export function isBasemapId(v: unknown): v is BasemapId {
  return typeof v === 'string' && (BASEMAP_IDS as readonly string[]).includes(v);
}
