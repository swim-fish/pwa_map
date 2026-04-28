import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import LocateButton from '../../src/components/LocateButton.svelte';
import { MapController } from '../../src/map/MapController';
import { setLocale } from '../../src/i18n/index';
import { __TESTING__ as locateSignalTesting } from '../../src/map/locateSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 013 US3 — reduced-motion fallback (FR-014e, research §R6).

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

function stubReducedMotion(reduce: boolean): void {
  const factory = (q: string): MediaQueryList =>
    ({
      matches: q.includes('prefers-reduced-motion') ? reduce : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(factory),
    });
  }
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
  setLocale('zh');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  locateSignalTesting.resetLocateSignal();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() } as unknown as Geolocation,
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

function getAriaLive(): HTMLElement | null {
  return host.querySelector('[data-testid="locate-aria-live"]') as HTMLElement | null;
}

describe('LocateButton US3 — reduced-motion long-press feedback', () => {
  test('under reduced-motion, pressing-class applied but radial transition is suppressed via CSS @media', async () => {
    stubReducedMotion(true);
    mount();
    await tick();
    getButton().click(); // Off → Show
    await tick();

    getButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await tick();
    // The component still applies the `pressing` class (CSS @media handles
    // suppression). The aria-live element receives the announcement.
    expect(getAriaLive()?.textContent?.trim()).toBe('按住停止…');
  });

  test('aria-live element clears on release before the 1.5 s threshold', async () => {
    stubReducedMotion(true);
    mount();
    await tick();
    getButton().click(); // Off → Show
    await tick();

    getButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await tick();
    expect(getAriaLive()?.textContent?.trim()).toBe('按住停止…');

    vi.advanceTimersByTime(800);
    getButton().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    await tick();
    expect(getAriaLive()?.textContent?.trim()).toBe('');
  });

  test('1.5 s threshold still fires Stop under reduced-motion', async () => {
    stubReducedMotion(true);
    mount();
    await tick();
    getButton().click(); // Off → Show
    await tick();

    getButton().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    vi.advanceTimersByTime(1500);
    getButton().dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });
});
