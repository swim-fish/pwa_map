import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import LocateButton from '../../src/components/LocateButton.svelte';
import { MapController } from '../../src/map/MapController';
import { setLocale } from '../../src/i18n/index';
import { __TESTING__ as locateSignalTesting } from '../../src/map/locateSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

const TAIPEI_101: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.033611 as Lat,
  lon: 121.564472 as Lon,
};

interface Cmp {
  $destroy: () => void;
  $on: (ev: string, h: (e: CustomEvent) => void) => void;
}
let host: HTMLElement;
let cmp: Cmp;

interface MockGeo {
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
  failNext: 'permission' | 'unavailable' | 'timeout' | null;
  successNext: GeolocationPosition | null;
  fail: (code: 1 | 2 | 3) => void;
}

function makeMockGeolocation(opts: { failNext?: MockGeo['failNext'] } = {}): MockGeo {
  let lastErrorCb: PositionErrorCallback | null = null;
  const watchPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback | null): number => {
      lastErrorCb = error ?? null;
      void success;
      if (mock.failNext === 'permission') {
        mock.failNext = null;
        Promise.resolve().then(() => {
          error?.({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          } as unknown as GeolocationPositionError);
        });
      } else if (mock.failNext === 'unavailable') {
        mock.failNext = null;
        Promise.resolve().then(() => {
          error?.({
            code: 2,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          } as unknown as GeolocationPositionError);
        });
      } else if (mock.failNext === 'timeout') {
        mock.failNext = null;
        Promise.resolve().then(() => {
          error?.({
            code: 3,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          } as unknown as GeolocationPositionError);
        });
      } else if (mock.successNext) {
        const pos = mock.successNext;
        mock.successNext = null;
        Promise.resolve().then(() => success(pos));
      }
      return 1;
    },
  );
  const mock: MockGeo = {
    watchPosition,
    clearWatch: vi.fn(),
    failNext: opts.failNext ?? null,
    successNext: null,
    fail: (code: 1 | 2 | 3) => {
      lastErrorCb?.({
        code,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: '',
      } as unknown as GeolocationPositionError);
    },
  };
  return mock;
}

function makeController(): MapController {
  return new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: 13,
  });
}

let originalGeolocation: typeof navigator.geolocation | undefined;
let originalPermissions: Permissions | undefined;

function stubGeolocation(value: Geolocation | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value,
  });
}

function stubPermissions(state: 'prompt' | 'granted' | 'denied' | null): void {
  if (state === null) {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: undefined,
    });
    return;
  }
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => ({ state, addEventListener: vi.fn() })),
    } as unknown as Permissions,
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  setLocale('zh');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  locateSignalTesting.resetLocateSignal();
  originalGeolocation = navigator.geolocation;
  originalPermissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

afterEach(() => {
  cmp?.$destroy?.();
  if (originalGeolocation !== undefined) {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    });
  }
  if (originalPermissions !== undefined) {
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: originalPermissions,
    });
  }
});

function mount(controller: MapController): void {
  const Component = LocateButton as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => Cmp;
  cmp = new Component({ target: host, props: { controller } });
}

describe('LocateButton — FR-009 / FR-010 user-gesture invariant', () => {
  test('does NOT call navigator.geolocation at mount time', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('prompt');
    mount(makeController());
    // Wait for the queryPermission async branch to settle.
    await Promise.resolve();
    await Promise.resolve();
    await tick();
    expect(mock.watchPosition).not.toHaveBeenCalled();
  });

  test('first short-tap invokes watchPosition synchronously inside the click handler', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('prompt');
    mount(makeController());
    await tick();

    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    expect(button).toBeTruthy();

    // Capture call order: queue a microtask AFTER the click; if
    // watchPosition fires before that microtask resolves, it was
    // synchronous (and thus inside the user gesture).
    const callOrder: string[] = [];
    const originalWatch = mock.watchPosition;
    mock.watchPosition = vi.fn((...args) => {
      callOrder.push('watchPosition');
      return originalWatch(...(args as Parameters<typeof originalWatch>));
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: mock as unknown as Geolocation,
    });

    button.click();
    void Promise.resolve().then(() => {
      callOrder.push('microtask');
    });
    expect(callOrder).toEqual(['watchPosition']);
  });
});

describe('LocateButton — permission outcomes', () => {
  test('permission granted → first fix renders state Show + dispatches fix event', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    mount(makeController());
    await tick();

    const fixEvents: PositionFixEventDetail[] = [];
    cmp.$on('fix', (ev) => fixEvents.push(ev.detail as PositionFixEventDetail));

    mock.successNext = {
      coords: {
        latitude: 25.04,
        longitude: 121.51,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      timestamp: 1714000000000,
    } as GeolocationPosition;

    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    button.click();
    await tick();
    await Promise.resolve();
    await tick();

    expect(button.dataset.state).toBe('show');
    expect(fixEvents).toHaveLength(1);
    expect(fixEvents[0]).toMatchObject({ lat: 25.04, lon: 121.51 });
  });

  test('permission denied → state stays off + locate.error.permissionDenied dispatched', async () => {
    const mock = makeMockGeolocation({ failNext: 'permission' });
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('prompt');
    mount(makeController());
    await tick();

    const errors: Array<{ key: string }> = [];
    cmp.$on('error', (ev) => errors.push(ev.detail as { key: string }));

    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    button.click();
    await tick();
    await Promise.resolve();
    await tick();
    await Promise.resolve();
    await tick();

    expect(errors.some((e) => e.key === 'locate.error.permissionDenied')).toBe(true);
    expect(button.dataset.state).toBe('off');
  });

  test('permission state "denied" from prior session → click surfaces toast without invoking watchPosition', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('denied');
    mount(makeController());
    // Allow queryPermission to settle.
    await Promise.resolve();
    await Promise.resolve();
    await tick();

    const errors: Array<{ key: string }> = [];
    cmp.$on('error', (ev) => errors.push(ev.detail as { key: string }));

    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    expect(button.dataset.state).toBe('off');
    button.click();
    expect(mock.watchPosition).not.toHaveBeenCalled();
    expect(errors).toEqual([{ key: 'locate.error.permissionDenied' }]);
  });

  test('FR-029 — permission revoked mid-session: next callback error code 1 stops watcher, demotes button to Off, surfaces zh toast', async () => {
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    mount(makeController());
    await tick();

    const errors: Array<{ key: string }> = [];
    cmp.$on('error', (ev) => errors.push(ev.detail as { key: string }));

    // Drive state to Show with an initial fix.
    mock.successNext = {
      coords: {
        latitude: 25.04,
        longitude: 121.51,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      timestamp: 1714000000000,
    } as GeolocationPosition;
    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    button.click();
    await tick();
    await Promise.resolve();
    await tick();
    expect(button.dataset.state).toBe('show');

    // Now simulate the OS revoking permission mid-session: the next
    // watcher callback is the error path with code 1.
    mock.failNext = 'permission';
    mock.successNext = null;
    // Trigger a re-fire by causing the controller to re-engage; we can
    // simulate by directly calling fail() since the controller's
    // success / error callbacks are captured by the mock.
    mock.fail(1);
    await tick();

    expect(button.dataset.state).toBe('off');
    expect(errors.some((e) => e.key === 'locate.error.permissionDenied')).toBe(true);
  });

  test('navigator.geolocation absent → button renders with aria-disabled', async () => {
    stubGeolocation(undefined);
    mount(makeController());
    await tick();

    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.dataset.state).toBe('off');

    const errors: Array<{ key: string }> = [];
    cmp.$on('error', (ev) => errors.push(ev.detail as { key: string }));
    button.click();
    expect(errors).toEqual([{ key: 'locate.error.unavailable' }]);
  });
});

describe('LocateButton — a11y', () => {
  test('aria-keyshortcuts advertises Enter / Space toggle + Shift-modified stop', async () => {
    stubGeolocation(makeMockGeolocation() as unknown as Geolocation);
    stubPermissions('prompt');
    mount(makeController());
    await tick();
    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Enter Space Shift+Enter Shift+Space');
  });

  test('zh accessible name changes per state', async () => {
    setLocale('zh');
    const mock = makeMockGeolocation();
    stubGeolocation(mock as unknown as Geolocation);
    stubPermissions('granted');
    mount(makeController());
    await tick();
    const button = host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('啟用定位');

    mock.successNext = {
      coords: {
        latitude: 25.04,
        longitude: 121.51,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      timestamp: 1714000000000,
    } as GeolocationPosition;
    button.click();
    await tick();
    await Promise.resolve();
    await tick();
    expect(button.getAttribute('aria-label')).toBe('定位中（顯示）');
  });
});

interface PositionFixEventDetail {
  lat: number;
  lon: number;
}
