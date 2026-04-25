# Contract: Map source catalogue

**Feature**: `003-i18n-and-map-layers`
**Surface**: `src/map/sources.ts`
**Consumers**: `LayerPicker.svelte`, `styleBuilder.ts`,
`AttributionBar.svelte`, service-worker config, integration + E2E tests.

This contract pins the seven catalogue entries verbatim — IDs, URL
templates, group / overlay flags, and zoom limits.

---

## 1. Public API

```ts
// src/map/sources.ts
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

export const MAP_SOURCES: readonly MapLayerOption[];
export const DEFAULT_BASEMAP: BasemapId = 'osm-standard';

export function findSource(id: string): MapLayerOption | undefined;
export function basemaps(): readonly MapLayerOption[];
export function overlays(): readonly MapLayerOption[];
```

---

## 2. Catalogue (verbatim)

| id | group | label key | URL template | tile | min | max | overlay |
|---|---|---|---|---|---|---|---|
| `osm-standard` | other | `map.layers.osmStandard` | `https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png` | png | 0 | 19 | false |
| `nlsc-emap5` | nlsc | `map.layers.nlscEmap5` | `https://wmts.nlsc.gov.tw/wmts/EMAP5/default/GoogleMapsCompatible/{z}/{y}/{x}` | jpg | 0 | 19 | false |
| `google-hybrid` | google | `map.layers.googleHybrid` | `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=zh-TW` | jpg | 0 | 20 | false |
| `google-satellite` | google | `map.layers.googleSatellite` | `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}` | jpg | 0 | 20 | false |
| `google-terrain` | google | `map.layers.googleTerrain` | `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=zh-TW` | jpg | 0 | 20 | false |
| `google-roadmap` | google | `map.layers.googleRoadmap` | `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=zh-TW` | jpg | 0 | 20 | false |
| `google-road-overlay` | google | `map.layers.googleRoadOverlay` | `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&hl=zh-TW` | png | 0 | 20 | true |

For OSM, `{a-c}` is shorthand for the three subdomain templates
(`a.tile`, `b.tile`, `c.tile`); the catalogue MUST emit those as a
three-element `tiles[]` array in the style JSON.

Attribution keys:

| group | attributionKey |
|---|---|
| `other` (OSM) | `map.attribution.osm` |
| `nlsc` | `map.attribution.nlsc` |
| `google` | `map.attribution.google` |

---

## 3. Invariants (validated by tests)

1. `MAP_SOURCES.length === 7`.
2. Every `id` is unique.
3. Every `urlTemplate` starts with `https://`.
4. `google-hybrid`, `google-terrain`, `google-roadmap`,
   `google-road-overlay` all contain `hl=zh-TW`.
5. `google-satellite` does NOT contain `hl=`.
6. `osm-standard`, `nlsc-emap5` do NOT contain `hl=` (no Google
   parameters on non-Google sources).
7. Exactly one entry has `isOverlay === true`
   (`google-road-overlay`).
8. `basemaps()` returns exactly six entries (every `BasemapId`).
9. `overlays()` returns exactly one entry.
10. `findSource(DEFAULT_BASEMAP)` returns the OSM entry.

---

## 4. Routing helpers

`basemaps()` MUST return entries in the order: `osm-standard`,
`nlsc-emap5`, `google-hybrid`, `google-satellite`, `google-terrain`,
`google-roadmap`. This drives the picker's display order.

`findSource(id)` returns `undefined` for unknown ids; callers (e.g.,
preferences validator) treat that as a validation failure.

---

## 5. Test obligations

`tests/unit/map/sources.spec.ts` MUST cover all 10 invariants in §3
plus:

- `basemaps()` order matches §4.
- `findSource('does-not-exist')` returns `undefined`.
- `findSource('google-hybrid').urlTemplate` includes `hl=zh-TW`.
- `findSource('google-satellite').urlTemplate` does not include
  `hl=`.
- `DEFAULT_BASEMAP === 'osm-standard'`.
