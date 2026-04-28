import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import LocateButton from '../../src/components/LocateButton.svelte';
import { MapController } from '../../src/map/MapController';
import { setLocale } from '../../src/i18n/index';
import { __TESTING__ as locateSignalTesting } from '../../src/map/locateSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 013 US3 — short-tap cycle: Off → Show → Follow → Show.
// Map recenter only fires when transitioning into Follow OR while in Follow
// and a fresh fix arrives.

const TAIPEI_101: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.033611 as Lat,
  lon: 121.564472 as Lon,
};

beforeAll(() => {
  if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventPolyfill;
  }
});

interface Cmp {
  $destroy: () => void;
  $on: (e: string, h: (ev: CustomEvent) => void) => void;
}
let host: HTMLElement;
let cmp: Cmp;

interface MockGeo {
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
  // Most-recent success callback for tests to drive fixes through.
  deliver: (lat: number, lon: number, accuracy?: number, timestamp?: number) => void;
}

function makeMockGeolocation(): MockGeo {
  let lastSuccess: PositionCallback | null = null;
  const watchPosition = vi.fn((success: PositionCallback): number => {
    lastSuccess = success;
    return 1;
  });
  return {
    watchPosition,
    clearWatch: vi.fn(),
    deliver: (lat, lon, accuracy = 12, timestamp = Date.now()) => {
      lastSuccess?.({
        coords: {
          latitude: lat,
          longitude: lon,
          accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        } as GeolocationCoordinates,
        timestamp,
      } as GeolocationPosition);
    },
  };
}

function stubGeolocation(value: Geolocation | undefined): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value });
}

function stubPermissions(state: 'prompt' | 'granted' | 'denied'): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => ({ state, addEventListener: vi.fn() })),
    } as unknown as Permissions,
  });
}

function makeController(): MapController {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: 13,
  });
  const recenterCalls: Array<{ lat: number; lon: number; animated: boolean }> = [];
  const fakeMap = {
    easeTo: vi.fn((opts: { center: [number, number] }) => {
      recenterCalls.push({ lat: opts.center[1], lon: opts.center[0], animated: true });
    }),
    setCenter: vi.fn((c: [number, number]) => {
      recenterCalls.push({ lat: c[1], lon: c[0], animated: false });
    }),
    once: vi.fn(),
  };
  controller.attachUnderlying(fakeMap);
  (controller as unknown as { _recenterCalls: typeof recenterCalls })._recenterCalls =
    recenterCalls;
  return controller;
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  locateSignalTesting.resetLocateSignal();
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(controller: MapController): void {
  const Component = LocateButton as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => Cmp;
  cmp = new Component({ target: host, props: { controller } });
}

function getButton(): HTMLButtonElement {
  return host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
}

function getRecenterCalls(controller: MapController): Array<{ lat: number; lon: number }> {
  return (
    (controller as unknown as { _recenterCalls?: Array<{ lat: number; lon: number }> })
      ._recenterCalls ?? []
  );
}

describe('LocateButton US3 — short-tap cycle', () => {
  test('Off → Show: tap once, marker visible, map does NOT recenter', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    const controller = makeController();
    mount(controller);
    await tick();

    getButton().click();
    await tick();
    mock.deliver(25.04, 121.51, 12, 1_000_000);
    await tick();

    expect(getButton().dataset.state).toBe('show');
    expect(getRecenterCalls(controller)).toEqual([]);
  });

  test('Show → Follow: tap again, map recenters to last fix', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    const controller = makeController();
    mount(controller);
    await tick();

    getButton().click();
    await tick();
    mock.deliver(25.04, 121.51, 12, 1_000_000);
    await tick();

    getButton().click();
    await tick();

    expect(getButton().dataset.state).toBe('follow');
    const calls = getRecenterCalls(controller);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toMatchObject({ lat: 25.04, lon: 121.51 });
  });

  test('Follow → Show: tap again, map stops chasing on next fix', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    const controller = makeController();
    mount(controller);
    await tick();

    getButton().click(); // → Show
    await tick();
    mock.deliver(25.04, 121.51, 12, 1_000_000);
    await tick();

    getButton().click(); // → Follow
    await tick();
    const callsBeforeDemote = getRecenterCalls(controller).length;

    getButton().click(); // → Show (FR-014a: Follow short-tap returns to Show)
    await tick();
    expect(getButton().dataset.state).toBe('show');

    mock.deliver(25.05, 121.52, 12, 1_001_000);
    await tick();
    // After demoting to Show, the next fix MUST NOT recenter the map.
    expect(getRecenterCalls(controller).length).toBe(callsBeforeDemote);
  });

  test('Follow auto-recenters on every new fix', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    const controller = makeController();
    mount(controller);
    await tick();

    getButton().click(); // → Show
    await tick();
    mock.deliver(25.04, 121.51, 12, 1_000_000);
    await tick();
    getButton().click(); // → Follow
    await tick();
    const baseline = getRecenterCalls(controller).length;

    mock.deliver(25.05, 121.52, 12, 1_001_000);
    await tick();
    mock.deliver(25.06, 121.53, 12, 1_002_000);
    await tick();

    const after = getRecenterCalls(controller);
    expect(after.length).toBe(baseline + 2);
    expect(after[after.length - 1]).toMatchObject({ lat: 25.06, lon: 121.53 });
  });
});
