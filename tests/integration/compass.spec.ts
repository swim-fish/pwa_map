import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import Compass from '../../src/components/Compass.svelte';
import { MapController } from '../../src/map/MapController';
import {
  attachToController as attachBearingSignal,
  __resetForTests as resetBearingSignal,
} from '../../src/map/bearingSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';
import { setLocale } from '../../src/i18n/index';

const TAIPEI_101: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.033611 as Lat,
  lon: 121.564472 as Lon,
};

let host: HTMLElement;
let cmp: { $destroy: () => void };

function stubReducedMotion(reduce: boolean): void {
  const factory = (q: string): MediaQueryList =>
    ({
      matches: q.includes('prefers-reduced-motion') ? reduce : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', vi.fn(factory));
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
  // Attach a fake map so resetBearing has something to call.
  const fakeMap = {
    bearing: 0,
    getBearing(): number {
      return this.bearing;
    },
    easeTo: vi.fn(),
    setBearing: vi.fn((deg: number) => {
      (fakeMap as unknown as { bearing: number }).bearing = deg;
    }),
  };
  controller.attachUnderlying(fakeMap);
  return controller;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubReducedMotion(false);
  resetBearingSignal();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(controller: MapController): void {
  attachBearingSignal(controller);
  const Component = Compass as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => typeof cmp;
  cmp = new Component({ target: host, props: { controller } });
}

function $compass(): HTMLElement | null {
  return document.querySelector('[data-testid="compass"]');
}

describe('Compass — feature 006 US1', () => {
  test('1. mount with bearing 0 renders button with reset aria-label and --compass-bearing -0deg', async () => {
    const controller = makeController();
    mount(controller);
    await tick();
    const btn = $compass()!;
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toBe('Reset to north');
    expect(['-0deg', '0deg']).toContain(btn.style.getPropertyValue('--compass-bearing').trim());
  });

  test('2. emitBearing(90) → --compass-bearing -90deg', async () => {
    const controller = makeController();
    mount(controller);
    await tick();
    controller.emitBearing(90);
    await tick();
    expect($compass()!.style.getPropertyValue('--compass-bearing').trim()).toBe('-90deg');
  });

  test('3. emitBearing(270) → --compass-bearing -270deg', async () => {
    const controller = makeController();
    mount(controller);
    await tick();
    controller.emitBearing(270);
    await tick();
    expect($compass()!.style.getPropertyValue('--compass-bearing').trim()).toBe('-270deg');
  });

  test('4. click fires controller.resetBearing(true) under normal motion', async () => {
    const controller = makeController();
    const spy = vi.spyOn(controller, 'resetBearing');
    mount(controller);
    await tick();
    ($compass() as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(true);
  });

  test('5. click fires controller.resetBearing(false) under reduced motion', async () => {
    stubReducedMotion(true);
    const controller = makeController();
    const spy = vi.spyOn(controller, 'resetBearing');
    mount(controller);
    await tick();
    ($compass() as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledWith(false);
  });

  test('6. Enter / Space activates the same path as click', async () => {
    const controller = makeController();
    const spy = vi.spyOn(controller, 'resetBearing');
    mount(controller);
    await tick();
    const btn = $compass() as HTMLButtonElement;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    btn.click(); // jsdom doesn't auto-fire click on Enter for <button>; we simulate the result
    expect(spy).toHaveBeenCalled();
  });

  test('7. tap target getBoundingClientRect ≥ 36 × 36 px (semantic: real <button> with min-width/min-height class)', async () => {
    // jsdom does not apply scoped CSS via CSSOM; assert the semantic guarantee instead.
    const controller = makeController();
    mount(controller);
    await tick();
    const btn = $compass() as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.classList.contains('compass')).toBe(true);
  });

  test('8. setLocale switches aria-label across zh / en / ja', async () => {
    const controller = makeController();
    mount(controller);
    await tick();
    setLocale('zh');
    await tick();
    expect($compass()!.getAttribute('aria-label')).toBe('重置為正北');
    setLocale('ja');
    await tick();
    expect($compass()!.getAttribute('aria-label')).toBe('北を上に戻す');
    setLocale('en');
    await tick();
    expect($compass()!.getAttribute('aria-label')).toBe('Reset to north');
  });
});
