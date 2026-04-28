import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import LocateButton from '../../src/components/LocateButton.svelte';
import { MapController } from '../../src/map/MapController';
import { setLocale } from '../../src/i18n/index';
import { __TESTING__ as locateSignalTesting } from '../../src/map/locateSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 013 US3 — long-press 1.5 s gesture: held ≥ 1500 ms → Stop;
// release < 1500 ms → short-tap toggle (FR-014b/c).

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
  // jsdom has no setPointerCapture by default.
  if (!(HTMLElement.prototype as unknown as { setPointerCapture?: unknown }).setPointerCapture) {
    (
      HTMLElement.prototype as unknown as { setPointerCapture: (id: number) => void }
    ).setPointerCapture = function () {
      /* jsdom no-op */
    };
    (
      HTMLElement.prototype as unknown as { releasePointerCapture: (id: number) => void }
    ).releasePointerCapture = function () {
      /* jsdom no-op */
    };
  }
});

interface Cmp {
  $destroy: () => void;
}
let host: HTMLElement;
let cmp: Cmp;

function makeMockGeolocation(): Geolocation {
  const watchPosition = vi.fn(() => 1);
  return {
    watchPosition,
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  } as unknown as Geolocation;
}

function makeController(): MapController {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: 13,
  });
  controller.attachUnderlying({ easeTo: vi.fn(), setCenter: vi.fn(), once: vi.fn() });
  return controller;
}

beforeEach(() => {
  vi.useFakeTimers();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  locateSignalTesting.resetLocateSignal();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: makeMockGeolocation(),
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => ({ state: 'granted', addEventListener: vi.fn() })),
    } as unknown as Permissions,
  });
});

afterEach(() => {
  cmp?.$destroy?.();
  vi.useRealTimers();
});

function mount(): void {
  const Component = LocateButton as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => Cmp;
  cmp = new Component({ target: host, props: { controller: makeController() } });
}

function getButton(): HTMLButtonElement {
  return host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
}

function pointerdown(): void {
  getButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
}

function pointerup(): void {
  getButton().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
}

function pointercancel(): void {
  getButton().dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
}

describe('LocateButton US3 — long-press 1.5 s → Stop', () => {
  test('held ≥ 1500 ms while in Show → state Off on release', async () => {
    mount();
    await tick();
    // Enter Show first via short-tap (click).
    getButton().click();
    await tick();
    expect(getButton().dataset.state).toBe('show');

    pointerdown();
    vi.advanceTimersByTime(1500);
    pointerup();
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });

  test('held ≥ 1500 ms while in Follow → state Off on release', async () => {
    mount();
    await tick();
    getButton().click(); // Show
    await tick();
    getButton().click(); // Follow
    await tick();
    expect(getButton().dataset.state).toBe('follow');

    pointerdown();
    vi.advanceTimersByTime(1500);
    pointerup();
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });

  test('released at 1000 ms (< 1.5 s) → treated as short-tap (toggle)', async () => {
    mount();
    await tick();
    getButton().click(); // Show
    await tick();

    pointerdown();
    vi.advanceTimersByTime(1000);
    pointerup();
    // Real browsers synth a `click` after pointerup on a button; jsdom
    // does not, so the test fires it explicitly to mimic the platform.
    getButton().click();
    await tick();
    // Short-tap from Show → Follow.
    expect(getButton().dataset.state).toBe('follow');
  });

  test('pointercancel at 800 ms → no state change, no Stop', async () => {
    mount();
    await tick();
    getButton().click(); // Show
    await tick();

    pointerdown();
    vi.advanceTimersByTime(800);
    pointercancel();
    vi.advanceTimersByTime(1000);
    await tick();
    // State unchanged from Show; no Stop fired.
    expect(getButton().dataset.state).toBe('show');
  });

  test('pointerdown from Off + held 1500 ms → no-op (FR-014g)', async () => {
    mount();
    await tick();
    expect(getButton().dataset.state).toBe('off');

    pointerdown();
    vi.advanceTimersByTime(1500);
    pointerup();
    await tick();
    // State stays Off; no permission prompt; no progress visual.
    expect(getButton().dataset.state).toBe('off');
    expect(getButton().classList.contains('pressing')).toBe(false);
  });
});
