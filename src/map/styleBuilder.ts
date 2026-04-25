import type { StyleSpecification } from 'maplibre-gl';
import type { MapLayerOption } from '$map/sources';

const SUBDOMAIN_PATTERN = /\{a-c\}/;

function expandTiles(urlTemplate: string): string[] {
  if (SUBDOMAIN_PATTERN.test(urlTemplate)) {
    return ['a', 'b', 'c'].map((sd) => urlTemplate.replace(SUBDOMAIN_PATTERN, sd));
  }
  return [urlTemplate];
}

function rasterSource(option: MapLayerOption): {
  type: 'raster';
  tiles: string[];
  tileSize: number;
  attribution: string;
  minzoom: number;
  maxzoom: number;
} {
  return {
    type: 'raster',
    tiles: expandTiles(option.urlTemplate),
    tileSize: option.tileSize,
    attribution: '',
    minzoom: option.minZoom,
    maxzoom: option.maxZoom,
  };
}

export function buildStyle(
  basemap: MapLayerOption,
  overlay: MapLayerOption | null,
): StyleSpecification {
  const sources: Record<string, ReturnType<typeof rasterSource>> = {
    [basemap.id]: rasterSource(basemap),
  };
  const layers: StyleSpecification['layers'] = [
    {
      id: `${basemap.id}-layer`,
      type: 'raster',
      source: basemap.id,
      minzoom: basemap.minZoom,
      maxzoom: basemap.maxZoom,
    },
  ];
  if (overlay) {
    sources[overlay.id] = rasterSource(overlay);
    layers.push({
      id: `${overlay.id}-layer`,
      type: 'raster',
      source: overlay.id,
      minzoom: overlay.minZoom,
      maxzoom: overlay.maxZoom,
    });
  }
  return {
    version: 8,
    sources: sources as unknown as StyleSpecification['sources'],
    layers,
  };
}
