import { describe, test, expect } from 'vitest';
import { buildStyle } from '../../../src/map/styleBuilder';
import { findSource } from '../../../src/map/sources';

const osm = findSource('osm-standard')!;
const nlsc = findSource('nlsc-emap5')!;
const ghybrid = findSource('google-hybrid')!;
const gsat = findSource('google-satellite')!;
const groad = findSource('google-road-overlay')!;

describe('buildStyle (feature 003)', () => {
  test('OSM only — 1 source, 1 layer, 3 tile URLs (a/b/c subdomains)', () => {
    const s = buildStyle(osm, null);
    expect(Object.keys(s.sources).length).toBe(1);
    expect(s.layers.length).toBe(1);
    const src = s.sources['osm-standard'] as { type: string; tiles: string[]; tileSize: number };
    expect(src.type).toBe('raster');
    expect(src.tiles.length).toBe(3);
    expect(src.tiles[0]).toBe('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(src.tiles[1]).toBe('https://b.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(src.tiles[2]).toBe('https://c.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(src.tileSize).toBe(256);
  });

  test('NLSC only — 1 source, 1 layer, 1 tile URL, maxzoom 19', () => {
    const s = buildStyle(nlsc, null);
    const src = s.sources['nlsc-emap5'] as { tiles: string[]; maxzoom: number };
    expect(src.tiles.length).toBe(1);
    expect(src.tiles[0].startsWith('https://wmts.nlsc.gov.tw/')).toBe(true);
    expect(src.maxzoom).toBe(19);
  });

  test('Google hybrid only — tile URL contains hl=zh-TW', () => {
    const s = buildStyle(ghybrid, null);
    const src = s.sources['google-hybrid'] as { tiles: string[] };
    expect(src.tiles[0].includes('hl=zh-TW')).toBe(true);
  });

  test('Google satellite + overlay — 2 sources, 2 layers, basemap first', () => {
    const s = buildStyle(gsat, groad);
    expect(Object.keys(s.sources).length).toBe(2);
    expect(s.layers.length).toBe(2);
    expect(s.layers[0].id).toBe('google-satellite-layer');
    expect(s.layers[1].id).toBe('google-road-overlay-layer');
    const overSrc = s.sources['google-road-overlay'] as { tiles: string[] };
    expect(overSrc.tiles[0].includes('lyrs=h')).toBe(true);
    expect(overSrc.tiles[0].includes('hl=zh-TW')).toBe(true);
  });

  test('NLSC + overlay — basemap is NLSC, overlay is Google road overlay', () => {
    const s = buildStyle(nlsc, groad);
    expect((s.layers[0] as { source: string }).source).toBe('nlsc-emap5');
    expect((s.layers[1] as { source: string }).source).toBe('google-road-overlay');
  });

  test('deterministic — two calls with the same inputs produce deep-equal output', () => {
    const a = buildStyle(ghybrid, groad);
    const b = buildStyle(ghybrid, groad);
    expect(a).toEqual(b);
  });

  test('style has version: 8', () => {
    const s = buildStyle(osm, null);
    expect(s.version).toBe(8);
  });
});
