import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import ZoomControls from '../../src/components/ZoomControls.svelte';
import { MapController } from '../../src/map/MapController';
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

interface FakeMap {
  zoom: number;
  center: { lat: number; lng: number };
  easeTo: ReturnType<typeof vi.fn>;
  zoomTo: ReturnType<typeof vi.fn>;
  getZoom: () => number;
  getCenter: () => { lat: number; lng: number };
  getMinZoom: () => number;
  getMaxZoom: () => number;
}

function makeFakeMap(opts: { zoom?: number; minZoom?: number; maxZoom?: number } = {}): FakeMap {
  const state = {
    zoom: opts.zoom ?? 13,
    center: { lat: 25.033611, lng: 121.564472 },
  };
  return {
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
    easeTo: vi.fn(),
    zoomTo: vi.fn(),
    getZoom: () => state.zoom,
    getCenter: () => state.center,
    getMinZoom: () => opts.minZoom ?? 0,
    getMaxZoom: () => opts.maxZoom ?? 22,
  };
}

function makeController(opts: { zoom?: number; minZoom?: number; maxZoom?: number } = {}): {
  controller: MapController;
  map: FakeMap;
} {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: opts.zoom ?? 13,
  });
  const map = makeFakeMap(opts);
  controller.attachUnderlying(map);
  return { controller, map };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubReducedMotion(false);
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(controller: MapController): void {
  const Component = ZoomControls as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => typeof cmp;
  cmp = new Component({ target: host, props: { controller } });
}

function $btn(testid: string): HTMLButtonElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

describe('ZoomControls — feature 006 US2', () => {
  test('1. mid-range zoom mounts both buttons with active labels', async () => {
    const { controller } = makeController({ zoom: 13 });
    mount(controller);
    await tick();
    const inBtn = $btn('zoom-in')!;
    const outBtn = $btn('zoom-out')!;
    expect(inBtn).not.toBeNull();
    expect(outBtn).not.toBeNull();
    expect(inBtn.getAttribute('aria-disabled')).toBe('false');
    expect(outBtn.getAttribute('aria-disabled')).toBe('false');
    expect(inBtn.getAttribute('aria-label')).toBe('Zoom in');
    expect(outBtn.getAttribute('aria-label')).toBe('Zoom out');
  });

  test('2. + click fires controller.zoomBy(+1, true) under normal motion', async () => {
    const { controller } = makeController({ zoom: 13 });
    const spy = vi.spyOn(controller, 'zoomBy');
    mount(controller);
    await tick();
    $btn('zoom-in')!.click();
    expect(spy).toHaveBeenCalledWith(+1, true);
  });

  test('3. - click fires controller.zoomBy(-1, true)', async () => {
    const { controller } = makeController({ zoom: 13 });
    const spy = vi.spyOn(controller, 'zoomBy');
    mount(controller);
    await tick();
    $btn('zoom-out')!.click();
    expect(spy).toHaveBeenCalledWith(-1, true);
  });

  test('4. + click under reduced-motion fires zoomBy(+1, false)', async () => {
    stubReducedMotion(true);
    const { controller } = makeController({ zoom: 13 });
    const spy = vi.spyOn(controller, 'zoomBy');
    mount(controller);
    await tick();
    $btn('zoom-in')!.click();
    expect(spy).toHaveBeenCalledWith(+1, false);
  });

  test('5. at-max-zoom flips aria-disabled true and click is silent no-op', async () => {
    const { controller } = makeController({ zoom: 22, maxZoom: 22 });
    const spy = vi.spyOn(controller, 'zoomBy');
    mount(controller);
    await tick();
    const inBtn = $btn('zoom-in')!;
    expect(inBtn.getAttribute('aria-disabled')).toBe('true');
    expect(inBtn.getAttribute('aria-label')).toBe('Maximum zoom reached');
    inBtn.click();
    expect(spy).not.toHaveBeenCalled();
  });

  test('6. at-min-zoom flips aria-disabled true and click is silent no-op', async () => {
    const { controller } = makeController({ zoom: 0, minZoom: 0 });
    const spy = vi.spyOn(controller, 'zoomBy');
    mount(controller);
    await tick();
    const outBtn = $btn('zoom-out')!;
    expect(outBtn.getAttribute('aria-disabled')).toBe('true');
    expect(outBtn.getAttribute('aria-label')).toBe('Minimum zoom reached');
    outBtn.click();
    expect(spy).not.toHaveBeenCalled();
  });

  test('7. zoomBy(+1, false) anchors on map center (crosshair-anchored)', async () => {
    const { controller, map } = makeController({ zoom: 13 });
    controller.zoomBy(+1, false);
    expect(map.zoomTo).toHaveBeenCalledWith(
      14,
      expect.objectContaining({ around: map.center, animate: false }),
    );
  });

  test('8. tap targets are real <button type="button"> with class hooks', async () => {
    const { controller } = makeController({ zoom: 13 });
    mount(controller);
    await tick();
    for (const id of ['zoom-in', 'zoom-out']) {
      const btn = $btn(id)!;
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('type')).toBe('button');
      expect(btn.classList.contains('zoom-btn')).toBe(true);
    }
  });

  test('9. DOM tab order — zoom-in precedes zoom-out', async () => {
    const { controller } = makeController({ zoom: 13 });
    mount(controller);
    await tick();
    const buttons = Array.from(document.querySelectorAll('button.zoom-btn'));
    expect(buttons[0].getAttribute('data-testid')).toBe('zoom-in');
    expect(buttons[1].getAttribute('data-testid')).toBe('zoom-out');
  });
});
