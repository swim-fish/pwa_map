import { describe, test, expect } from 'vitest';
import { MapController } from '../../../src/map/MapController';
import type { Lat, Lon, WGS84DD } from '../../../src/types/coord';

const TAIPEI_101: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.033611 as Lat,
  lon: 121.564472 as Lon,
};

interface FlyToOpts {
  center: [number, number];
  zoom?: number;
  duration?: number;
  essential?: boolean;
}

function makeController(
  initialZoom: number,
  currentZoomFromMap?: number,
): {
  controller: MapController;
  spy: { lastFlyTo: FlyToOpts | null };
} {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: initialZoom,
  });
  const spy: { lastFlyTo: FlyToOpts | null } = { lastFlyTo: null };
  const fakeMap = {
    flyTo(opts: FlyToOpts): void {
      spy.lastFlyTo = opts;
    },
    getZoom(): number {
      return currentZoomFromMap ?? initialZoom;
    },
  };
  controller.attachUnderlying(fakeMap);
  return { controller, spy };
}

describe('MapController.setBasemap + tile-failure path (feature 003 FR-009)', () => {
  function makeBasemapController(initialBasemap: 'osm-standard' | 'nlsc-emap5' = 'osm-standard'): {
    controller: MapController;
    spy: { lastSetStyle: unknown; tilefails: Array<{ failedId: string; revertedTo: string }> };
  } {
    const controller = new MapController({
      container: document.createElement('div'),
      center: TAIPEI_101,
      zoom: 13,
    });
    const spy: {
      lastSetStyle: unknown;
      tilefails: Array<{ failedId: string; revertedTo: string }>;
    } = {
      lastSetStyle: null,
      tilefails: [],
    };
    const fakeMap = {
      setStyle(s: unknown): void {
        spy.lastSetStyle = s;
      },
    };
    controller.attachUnderlying(fakeMap);
    controller.setLayerSelection({ basemap: initialBasemap, overlay: false });
    spy.lastSetStyle = null; // reset so the next setBasemap is what we measure
    controller.onTileFail((ev) => spy.tilefails.push(ev));
    return { controller, spy };
  }

  test('setBasemap("nlsc-emap5", false) calls map.setStyle with a NLSC style', () => {
    const { controller, spy } = makeBasemapController();
    controller.setBasemap('nlsc-emap5', false);
    expect(spy.lastSetStyle).not.toBeNull();
    const style = spy.lastSetStyle as { sources: Record<string, unknown> };
    expect(style.sources['nlsc-emap5']).toBeDefined();
  });

  test('three tile errors within 5 s of a swap reverts to the previous basemap and emits tilefail', () => {
    const { controller, spy } = makeBasemapController('osm-standard');
    controller.setBasemap('nlsc-emap5', false);
    controller.recordTileError('nlsc-emap5');
    controller.recordTileError('nlsc-emap5');
    controller.recordTileError('nlsc-emap5');
    expect(spy.tilefails.length).toBe(1);
    expect(spy.tilefails[0]).toEqual({ failedId: 'nlsc-emap5', revertedTo: 'osm-standard' });
    expect(controller.layerSelection.basemap).toBe('osm-standard');
  });

  test('a single CORS / network failure (errorIsFatal=true) reverts immediately', () => {
    const { controller, spy } = makeBasemapController('osm-standard');
    controller.setBasemap('nlsc-emap5', false);
    controller.recordTileError('nlsc-emap5', { fatal: true });
    expect(spy.tilefails.length).toBe(1);
    expect(controller.layerSelection.basemap).toBe('osm-standard');
  });

  test('errors after the 5 s window are ignored (no revert, no tilefail)', () => {
    const { controller, spy } = makeBasemapController('osm-standard');
    controller.setBasemap('nlsc-emap5', false);
    // Simulate the window expiring.
    controller.expireFailureWindowForTests();
    controller.recordTileError('nlsc-emap5');
    controller.recordTileError('nlsc-emap5');
    controller.recordTileError('nlsc-emap5');
    expect(spy.tilefails.length).toBe(0);
    expect(controller.layerSelection.basemap).toBe('nlsc-emap5');
  });

  test('errors for a different source than the active basemap are ignored', () => {
    const { controller, spy } = makeBasemapController('osm-standard');
    controller.setBasemap('nlsc-emap5', false);
    controller.recordTileError('google-hybrid');
    controller.recordTileError('google-hybrid');
    controller.recordTileError('google-hybrid');
    expect(spy.tilefails.length).toBe(0);
    expect(controller.layerSelection.basemap).toBe('nlsc-emap5');
  });

  test('overlay toggle preserves the basemap and rebuilds style with two sources', () => {
    const { controller, spy } = makeBasemapController('osm-standard');
    controller.setBasemap('osm-standard', true);
    expect(spy.lastSetStyle).not.toBeNull();
    const style = spy.lastSetStyle as {
      sources: Record<string, unknown>;
      layers: { id: string }[];
    };
    expect(Object.keys(style.sources).length).toBe(2);
    expect(style.layers.length).toBe(2);
  });
});

describe('MapController.flyTo zoom preservation (feature 002 FR-011)', () => {
  test('current zoom 5, no options.zoom → flyTo receives zoom: 5 (no snap-to-15)', () => {
    const { controller, spy } = makeController(5);
    controller.flyTo(TAIPEI_101);
    expect(spy.lastFlyTo).not.toBeNull();
    expect(spy.lastFlyTo?.zoom).toBe(5);
  });

  test('current zoom 18, no options.zoom → flyTo receives zoom: 18', () => {
    const { controller, spy } = makeController(18);
    controller.flyTo(TAIPEI_101);
    expect(spy.lastFlyTo?.zoom).toBe(18);
  });

  test('explicit options.zoom: 12 overrides current zoom', () => {
    const { controller, spy } = makeController(8);
    controller.flyTo(TAIPEI_101, { zoom: 12 });
    expect(spy.lastFlyTo?.zoom).toBe(12);
  });

  test('current zoom 9 (below the old snap-to-15 floor) is preserved exactly', () => {
    const { controller, spy } = makeController(9);
    controller.flyTo(TAIPEI_101);
    expect(spy.lastFlyTo?.zoom).toBe(9);
  });
});
