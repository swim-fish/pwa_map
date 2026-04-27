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

// =====================================================================
// Feature 006 — bearing + crosshair-anchored zoom + wheel override
// (contracts/map-controller-amendment.md §8 — 13 cases)
// =====================================================================

import { vi } from 'vitest';

interface FakeMap006 {
  bearing: number;
  zoom: number;
  center: { lat: number; lng: number };
  canvasContainer: HTMLElement;
  scrollZoomDisableSpy: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  zoomTo: ReturnType<typeof vi.fn>;
  setBearing: ReturnType<typeof vi.fn>;
  getBearing: () => number;
  getZoom: () => number;
  getCenter: () => { lat: number; lng: number };
  getMinZoom: () => number;
  getMaxZoom: () => number;
  getCanvasContainer: () => HTMLElement;
  scrollZoom: { disable: ReturnType<typeof vi.fn> };
}

function makeFakeMap006(
  opts: {
    bearing?: number;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    center?: { lat: number; lng: number };
  } = {},
): FakeMap006 {
  const state = {
    bearing: opts.bearing ?? 0,
    zoom: opts.zoom ?? 13,
    center: opts.center ?? { lat: 25.033611, lng: 121.564472 },
  };
  const canvasContainer = document.createElement('div');
  document.body.appendChild(canvasContainer);
  const scrollZoomDisableSpy = vi.fn();
  return {
    get bearing() {
      return state.bearing;
    },
    set bearing(v: number) {
      state.bearing = v;
    },
    get zoom() {
      return state.zoom;
    },
    set zoom(v: number) {
      state.zoom = v;
    },
    get center() {
      return state.center;
    },
    set center(v: { lat: number; lng: number }) {
      state.center = v;
    },
    canvasContainer,
    scrollZoomDisableSpy,
    easeTo: vi.fn(),
    zoomTo: vi.fn(),
    setBearing: vi.fn((deg: number) => {
      state.bearing = deg;
    }),
    getBearing: () => state.bearing,
    getZoom: () => state.zoom,
    getCenter: () => state.center,
    getMinZoom: () => opts.minZoom ?? 0,
    getMaxZoom: () => opts.maxZoom ?? 22,
    getCanvasContainer: () => canvasContainer,
    scrollZoom: { disable: scrollZoomDisableSpy },
  };
}

function makeBearingController(map?: FakeMap006): {
  controller: MapController;
  map: FakeMap006 | null;
} {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: 13,
  });
  if (map) controller.attachUnderlying(map);
  return { controller, map: map ?? null };
}

describe('MapController — bearing channel (feature 006 D2)', () => {
  test('1. getBearing() with no map attached returns 0', () => {
    const { controller } = makeBearingController();
    expect(controller.getBearing()).toBe(0);
  });

  test('2. getBearing() proxies to underlying map.getBearing()', () => {
    const map = makeFakeMap006({ bearing: 45 });
    const { controller } = makeBearingController(map);
    expect(controller.getBearing()).toBe(45);
  });

  test('3. onBearing(handler) fires handler immediately on subscribe', () => {
    const map = makeFakeMap006({ bearing: 90 });
    const { controller } = makeBearingController(map);
    const handler = vi.fn();
    controller.onBearing(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(90);
  });

  test('4. onBearing fires on every emitBearing with normalised value, dedup repeated', () => {
    const { controller } = makeBearingController();
    const handler = vi.fn();
    controller.onBearing(handler);
    handler.mockClear();
    controller.emitBearing(45);
    controller.emitBearing(90);
    controller.emitBearing(90); // dedup
    controller.emitBearing(135);
    expect(handler.mock.calls.map((c) => c[0])).toEqual([45, 90, 135]);
  });

  test('5. emitBearing normalises to [0, 360)', () => {
    const { controller } = makeBearingController();
    const handler = vi.fn();
    controller.onBearing(handler);
    handler.mockClear();
    controller.emitBearing(-90);
    controller.emitBearing(450);
    controller.emitBearing(360);
    expect(handler.mock.calls.map((c) => c[0])).toEqual([270, 90, 0]);
  });
});

describe('MapController.resetBearing (feature 006 D4)', () => {
  test('6. resetBearing(true) calls map.easeTo({ bearing: 0, duration: 600 })', () => {
    const map = makeFakeMap006({ bearing: 90 });
    const { controller } = makeBearingController(map);
    controller.resetBearing(true);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo).toHaveBeenCalledWith({ bearing: 0, duration: 600 });
  });

  test('7. resetBearing(false) calls map.setBearing(0)', () => {
    const map = makeFakeMap006({ bearing: 90 });
    const { controller } = makeBearingController(map);
    controller.resetBearing(false);
    expect(map.setBearing).toHaveBeenCalledTimes(1);
    expect(map.setBearing).toHaveBeenCalledWith(0);
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  test('8a. resetBearing silent no-op at 0.4° (within ±0.5° tolerance)', () => {
    const map = makeFakeMap006({ bearing: 0.4 });
    const { controller } = makeBearingController(map);
    controller.resetBearing(true);
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.setBearing).not.toHaveBeenCalled();
  });

  test('8b. resetBearing silent no-op at 359.6° (within ±0.5° tolerance)', () => {
    const map = makeFakeMap006({ bearing: 359.6 });
    const { controller } = makeBearingController(map);
    controller.resetBearing(true);
    expect(map.easeTo).not.toHaveBeenCalled();
  });
});

describe('MapController.zoomBy (feature 006 D3 + D4)', () => {
  test('9. zoomBy(+1, true) calls easeTo with around=center, duration=200', () => {
    const map = makeFakeMap006({ zoom: 10, center: { lat: 25, lng: 121 } });
    const { controller } = makeBearingController(map);
    controller.zoomBy(+1, true);
    expect(map.easeTo).toHaveBeenCalledWith({
      zoom: 11,
      around: { lat: 25, lng: 121 },
      duration: 200,
    });
  });

  test('10. zoomBy(+1, false) calls zoomTo with around=center, animate:false', () => {
    const map = makeFakeMap006({ zoom: 10, center: { lat: 25, lng: 121 } });
    const { controller } = makeBearingController(map);
    controller.zoomBy(+1, false);
    expect(map.zoomTo).toHaveBeenCalledWith(11, {
      around: { lat: 25, lng: 121 },
      duration: 0,
      animate: false,
    });
  });

  test('11a. zoomBy at max-zoom is silent no-op', () => {
    const map = makeFakeMap006({ zoom: 22, maxZoom: 22 });
    const { controller } = makeBearingController(map);
    controller.zoomBy(+1, true);
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.zoomTo).not.toHaveBeenCalled();
  });

  test('11b. zoomBy at min-zoom is silent no-op', () => {
    const map = makeFakeMap006({ zoom: 0, minZoom: 0 });
    const { controller } = makeBearingController(map);
    controller.zoomBy(-1, true);
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  test('11c. zoomBy(+5) clamps to max-zoom', () => {
    const map = makeFakeMap006({ zoom: 18, maxZoom: 22 });
    const { controller } = makeBearingController(map);
    controller.zoomBy(+5, true);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 22 }));
  });
});

describe('MapController.attachWheelOverride (feature 006 D3)', () => {
  test('12. attachWheelOverride disables scrollZoom and routes wheel to zoomBy', () => {
    const map = makeFakeMap006({ zoom: 13 });
    const { controller } = makeBearingController(map);
    controller.attachWheelOverride();
    expect(map.scrollZoomDisableSpy).toHaveBeenCalledTimes(1);
    // Dispatch a wheel event and confirm zoomTo was called crosshair-anchored.
    const evt = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    map.canvasContainer.dispatchEvent(evt);
    // deltaY 100 → zoomDelta -1 → target zoom 12
    expect(map.zoomTo).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        around: map.center,
        animate: false,
      }),
    );
  });

  test('13. attachWheelOverride is idempotent (only one listener installed)', () => {
    const map = makeFakeMap006({ zoom: 13 });
    const { controller } = makeBearingController(map);
    controller.attachWheelOverride();
    controller.attachWheelOverride(); // second call
    expect(map.scrollZoomDisableSpy).toHaveBeenCalledTimes(1);
    const evt = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    map.canvasContainer.dispatchEvent(evt);
    expect(map.zoomTo).toHaveBeenCalledTimes(1);
  });
});
