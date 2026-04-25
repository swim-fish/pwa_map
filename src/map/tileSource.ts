/**
 * @deprecated since feature 003 — Replaced by the
 * `MapLayerOption` catalogue in `src/map/sources.ts` and the pure
 * `buildStyle` function in `src/map/styleBuilder.ts`. Retained as a
 * historical reference; no runtime caller remains. Safe to remove
 * in a future feature once no contributor relies on the symbols
 * for migration context.
 */
export interface RasterTileSource {
  readonly id: string;
  readonly urls: readonly string[];
  readonly tileSize: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly attribution: string;
}

/** @deprecated since feature 003 — see `MAP_SOURCES` in `src/map/sources.ts`. */
export const osmTileSource: RasterTileSource = {
  id: 'osm-standard',
  urls: [
    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ],
  tileSize: 256,
  minZoom: 0,
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
};

/** @deprecated since feature 003 — use `buildStyle` from `src/map/styleBuilder.ts`. */
export function buildOsmStyle(source: RasterTileSource = osmTileSource): object {
  return {
    version: 8,
    sources: {
      [source.id]: {
        type: 'raster',
        tiles: [...source.urls],
        tileSize: source.tileSize,
        attribution: source.attribution,
        minzoom: source.minZoom,
        maxzoom: source.maxZoom,
      },
    },
    layers: [
      {
        id: `${source.id}-layer`,
        type: 'raster',
        source: source.id,
        minzoom: source.minZoom,
        maxzoom: source.maxZoom,
      },
    ],
  };
}
