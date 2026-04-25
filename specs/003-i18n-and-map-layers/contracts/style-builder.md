# Contract: MapLibre style builder

**Feature**: `003-i18n-and-map-layers`
**Surface**: `src/map/styleBuilder.ts`
**Consumers**: `MapController.setBasemap`, `MapView.svelte`,
unit + integration tests.

This contract defines the pure function that turns a
`(basemap, overlay?)` pair into a complete MapLibre style JSON.

---

## 1. Public API

```ts
import type { StyleSpecification } from 'maplibre-gl';
import type { MapLayerOption } from '$map/sources';

export function buildStyle(
  basemap: MapLayerOption,
  overlay: MapLayerOption | null,
): StyleSpecification;
```

**Pre-conditions**:

- `basemap.isOverlay === false`.
- `overlay === null` or `overlay.isOverlay === true`.
- Caller is responsible for catalogue lookups; this function does
  not consult `MAP_SOURCES`.

---

## 2. Output shape

```json
{
  "version": 8,
  "sources": {
    "<basemap.id>": {
      "type": "raster",
      "tiles": ["<expanded urls>"],
      "tileSize": 256,
      "attribution": "",
      "minzoom": <basemap.minZoom>,
      "maxzoom": <basemap.maxZoom>
    },
    "<overlay.id>": { ...same shape... }   // present iff overlay !== null
  },
  "layers": [
    { "id": "<basemap.id>-layer", "type": "raster", "source": "<basemap.id>",
      "minzoom": <basemap.minZoom>, "maxzoom": <basemap.maxZoom> },
    { "id": "<overlay.id>-layer", "type": "raster", "source": "<overlay.id>",
      "minzoom": <overlay.minZoom>, "maxzoom": <overlay.maxZoom> }   // iff overlay !== null
  ]
}
```

**Notes**:

- The style's top-level `attribution` is left empty; attribution is
  rendered by `AttributionBar.svelte` (see contract
  `service-worker-cache.md` §3 for why we keep it out of the style).
- For OSM, the catalogue's URL template uses `{a-c}` notation;
  `buildStyle` MUST expand this to a three-element `tiles[]` array
  (`a.tile`, `b.tile`, `c.tile`).
- For all other sources (single-host), `tiles[]` is a one-element
  array.
- `layers[]` ordering matters — basemap MUST come first; the
  overlay's raster layer is appended above so MapLibre paints it on
  top.

---

## 3. URL expansion rules

- `https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png` →
  `['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png']`.
- Any other template → single-element array with the template
  unchanged.

The `{x}/{y}/{z}` placeholders are passed through unchanged for
MapLibre to interpolate.

---

## 4. Test obligations

`tests/unit/map/styleBuilder.spec.ts` MUST cover:

1. OSM only — produces 1 source / 1 layer; `tiles[]` has 3 entries.
2. NLSC only — produces 1 source / 1 layer; `tiles[]` has 1 entry;
   `maxzoom` = 19.
3. Google hybrid only — 1 source / 1 layer; `tiles[0]` contains
   `hl=zh-TW`.
4. Google satellite + overlay — 2 sources / 2 layers; layers ordered
   `[basemap, overlay]`; overlay's `tiles[0]` contains `lyrs=h` and
   `hl=zh-TW`.
5. NLSC + overlay — 2 sources / 2 layers; basemap source is NLSC,
   overlay source is `google-road-overlay`.
6. Pre-condition guard: `buildStyle` does not consult external state
   (called twice with the same inputs returns deep-equal objects).
