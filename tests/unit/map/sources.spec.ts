import { describe, test, expect } from 'vitest';
import {
  MAP_SOURCES,
  DEFAULT_BASEMAP,
  findSource,
  basemaps,
  overlays,
  type BasemapId,
} from '../../../src/map/sources';

describe('MAP_SOURCES catalogue invariants (feature 003)', () => {
  test('contains exactly seven entries', () => {
    expect(MAP_SOURCES.length).toBe(7);
  });

  test('every id is unique', () => {
    const ids = MAP_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every urlTemplate uses https://', () => {
    for (const src of MAP_SOURCES) {
      expect(src.urlTemplate.startsWith('https://')).toBe(true);
    }
  });

  test('Google labelled layers all carry hl=zh-TW', () => {
    const labelled = ['google-hybrid', 'google-terrain', 'google-roadmap', 'google-road-overlay'];
    for (const id of labelled) {
      const src = findSource(id);
      expect(src).toBeDefined();
      expect(src!.urlTemplate.includes('hl=zh-TW')).toBe(true);
    }
  });

  test('google-satellite must NOT carry hl=', () => {
    const sat = findSource('google-satellite');
    expect(sat).toBeDefined();
    expect(sat!.urlTemplate.includes('hl=')).toBe(false);
  });

  test('osm-standard and nlsc-emap5 do NOT carry hl=', () => {
    expect(findSource('osm-standard')!.urlTemplate.includes('hl=')).toBe(false);
    expect(findSource('nlsc-emap5')!.urlTemplate.includes('hl=')).toBe(false);
  });

  test('exactly one entry has isOverlay=true (google-road-overlay)', () => {
    const overs = MAP_SOURCES.filter((s) => s.isOverlay);
    expect(overs.length).toBe(1);
    expect(overs[0].id).toBe('google-road-overlay');
  });

  test('basemaps() returns exactly six entries in canonical order', () => {
    const expected: BasemapId[] = [
      'osm-standard',
      'nlsc-emap5',
      'google-hybrid',
      'google-satellite',
      'google-terrain',
      'google-roadmap',
    ];
    const actual = basemaps().map((s) => s.id);
    expect(actual).toEqual(expected);
  });

  test('overlays() returns exactly one entry', () => {
    expect(overlays().length).toBe(1);
    expect(overlays()[0].id).toBe('google-road-overlay');
  });

  test('findSource(DEFAULT_BASEMAP) returns the OSM entry', () => {
    expect(DEFAULT_BASEMAP).toBe('osm-standard');
    const def = findSource(DEFAULT_BASEMAP);
    expect(def).toBeDefined();
    expect(def!.group).toBe('other');
  });

  test('findSource(unknown) returns undefined', () => {
    expect(findSource('does-not-exist')).toBeUndefined();
  });

  test('every entry has an attributionKey under map.attribution.*', () => {
    for (const src of MAP_SOURCES) {
      expect(src.attributionKey.startsWith('map.attribution.')).toBe(true);
    }
  });
});
