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
