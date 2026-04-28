import type { StyleSpecification } from 'maplibre-gl';
import type { MapLayerOption } from '$map/sources';
import { LOCKDOWN_REGISTER } from '$map/threeDLockdown';

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
  const style: StyleSpecification = {
    version: 8,
    sources: sources as unknown as StyleSpecification['sources'],
    layers,
  };
  applyLockdown(style);
  return style;
}

// Feature 012 — 3D / Terrain lockdown. Strip any disallowed style
// entries per the threeDLockdown register. See ADR-0032.
function applyLockdown(style: StyleSpecification): void {
  if (!LOCKDOWN_REGISTER.sky.lockedValue) {
    delete (style as { sky?: unknown }).sky;
  }
  const blockedTypes = new Set<string>();
  if (!LOCKDOWN_REGISTER.fillExtrusion.lockedValue) blockedTypes.add('fill-extrusion');
  if (!LOCKDOWN_REGISTER.hillshade.lockedValue) blockedTypes.add('hillshade');
  if (blockedTypes.size > 0) {
    style.layers = style.layers.filter((l) => !blockedTypes.has(l.type));
  }
}

/**
 * Test-only export — allows specs to drive `applyLockdown` against
 * synthetic styles. Mirrors the project's existing
 * `__resetForTests` test-hook pattern. Do NOT call from production
 * code paths.
 */
export const __test_applyLockdown = applyLockdown;
