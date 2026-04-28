import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { StyleSpecification } from 'maplibre-gl';
import { buildStyle, __test_applyLockdown } from '../../src/map/styleBuilder';
import { findSource } from '../../src/map/sources';
import { LOCKDOWN_REGISTER } from '../../src/map/threeDLockdown';

// Feature 012 — runtime + filter integration spec for the 3D / Terrain lockdown.
// See specs/012-settings-about-and-mobile-fixes/contracts/three-d-lockdown-register.md §5
// and contracts/style-builder-filter.md §4.

const MAP_VIEW = resolve(process.cwd(), 'src/components/MapView.svelte');
const SOURCES = resolve(process.cwd(), 'src/map/sources.ts');

const osm = findSource('osm-standard')!;
const groad = findSource('google-road-overlay')!;

describe('threeDLockdown runtime — MapView consumes the registry (feature 012 / FR-002, FR-004, FR-005)', () => {
  test('MapView.svelte imports LOCKDOWN_REGISTER from $map/threeDLockdown', () => {
    const src = readFileSync(MAP_VIEW, 'utf8');
    expect(src).toMatch(
      /import\s*\{[^}]*LOCKDOWN_REGISTER[^}]*\}\s*from\s*['"]\$map\/threeDLockdown['"]/,
    );
  });

  test('MapView.svelte sets maxPitch to LOCKDOWN_REGISTER.pitch.lockedValue', () => {
    const src = readFileSync(MAP_VIEW, 'utf8');
    expect(src).toMatch(/maxPitch:\s*LOCKDOWN_REGISTER\.pitch\.lockedValue/);
  });

  test('MapView.svelte sets touchPitch: false unconditionally', () => {
    const src = readFileSync(MAP_VIEW, 'utf8');
    expect(src).toMatch(/touchPitch:\s*false/);
  });

  test('MapView.svelte sets projection to LOCKDOWN_REGISTER.globe.lockedValue', () => {
    const src = readFileSync(MAP_VIEW, 'utf8');
    expect(src).toMatch(/projection:\s*LOCKDOWN_REGISTER\.globe\.lockedValue/);
  });

  test('MapView.svelte never calls map.setTerrain', () => {
    const src = readFileSync(MAP_VIEW, 'utf8');
    expect(src).not.toMatch(/\.setTerrain\s*\(/);
  });
});

describe('threeDLockdown runtime — sources catalogue lockdown anchor (feature 012 / FR-005)', () => {
  test('src/map/sources.ts cross-references threeDLockdown / ADR-0032', () => {
    const src = readFileSync(SOURCES, 'utf8');
    expect(src).toMatch(/threeDLockdown/);
    expect(src).toMatch(/ADR-0032/);
  });

  test('no terrain-DEM-shaped source is registered while terrain is locked off', () => {
    // Defensive: if a future contributor adds a source whose URL hints at
    // terrain RGB tiles, surface it. The grep is a heuristic; the
    // catalogue is small and the JSDoc anchor (above) is the canonical
    // guard.
    const src = readFileSync(SOURCES, 'utf8');
    if (LOCKDOWN_REGISTER.terrain.lockedValue === null) {
      expect(src).not.toMatch(/terrarium|terrain-rgb|terrainrgb/i);
    }
  });
});

describe('styleBuilder.applyLockdown — strips disallowed layer types (feature 012 / FR-003, FR-006, FR-007)', () => {
  test('OSM-only build assembles cleanly: no sky / fill-extrusion / hillshade', () => {
    const s = buildStyle(osm, null);
    expect((s as { sky?: unknown }).sky).toBeUndefined();
    expect(s.layers.find((l) => l.type === 'fill-extrusion')).toBeUndefined();
    expect(s.layers.find((l) => l.type === 'hillshade')).toBeUndefined();
  });

  test('overlay build also has no disallowed layer types', () => {
    const s = buildStyle(osm, groad);
    expect((s as { sky?: unknown }).sky).toBeUndefined();
    expect(s.layers.find((l) => l.type === 'fill-extrusion')).toBeUndefined();
    expect(s.layers.find((l) => l.type === 'hillshade')).toBeUndefined();
    // Order-preserving: surviving layers in original assembly order.
    expect(s.layers[0].id).toBe('osm-standard-layer');
    expect(s.layers[1].id).toBe('google-road-overlay-layer');
  });

  test('__test_applyLockdown strips an injected sky block', () => {
    const polluted: StyleSpecification & { sky?: unknown } = {
      ...buildStyle(osm, null),
      sky: { 'sky-color': '#87CEEB' },
    };
    __test_applyLockdown(polluted);
    expect(polluted.sky).toBeUndefined();
  });

  test('__test_applyLockdown strips an injected fill-extrusion layer', () => {
    const built = buildStyle(osm, groad);
    const polluted: StyleSpecification = {
      ...built,
      layers: [
        ...built.layers,
        { id: 'fake-extrusion', type: 'fill-extrusion', source: 'osm-standard' } as never,
      ],
    };
    __test_applyLockdown(polluted);
    expect(polluted.layers.find((l) => l.type === 'fill-extrusion')).toBeUndefined();
  });

  test('__test_applyLockdown strips an injected hillshade layer', () => {
    const built = buildStyle(osm, null);
    const polluted: StyleSpecification = {
      ...built,
      layers: [
        ...built.layers,
        { id: 'fake-hillshade', type: 'hillshade', source: 'osm-standard' } as never,
      ],
    };
    __test_applyLockdown(polluted);
    expect(polluted.layers.find((l) => l.type === 'hillshade')).toBeUndefined();
  });

  test('order-preserving: surviving layers retain relative order', () => {
    const built = buildStyle(osm, groad);
    const polluted: StyleSpecification = {
      ...built,
      layers: [
        built.layers[0],
        { id: 'fake-extrusion', type: 'fill-extrusion', source: 'osm-standard' } as never,
        built.layers[1],
        { id: 'fake-hillshade', type: 'hillshade', source: 'osm-standard' } as never,
      ],
    };
    __test_applyLockdown(polluted);
    expect(polluted.layers.map((l) => l.id)).toEqual([
      'osm-standard-layer',
      'google-road-overlay-layer',
    ]);
  });

  test('idempotent: running applyLockdown twice has the same result', () => {
    const a = buildStyle(osm, null);
    const b = buildStyle(osm, null);
    __test_applyLockdown(a);
    __test_applyLockdown(b);
    __test_applyLockdown(b); // run twice
    expect(a).toEqual(b);
  });
});
