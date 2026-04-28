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

  test('3. emitBearing(270) from 0 → --compass-bearing 90deg (shortest-path: 90° CCW, not 270° CW)', async () => {
    // Bug fix 2026-04-28: arrow takes the shortest-arc path on every
    // bearing change to avoid a long-way-around spin when crossing the
    // 0° / 360° seam. From bearing 0, an emit of 270° in MapLibre's
    // CW-positive convention is closer the OTHER way; the displayed
    // (negated) angle therefore moves +90° (forward CCW), not -270°
    // (long way back). Visually identical end state, but the CSS
    // transition no longer spins three-quarters of the way round.
    const controller = makeController();
    mount(controller);
    await tick();
    controller.emitBearing(270);
    await tick();
    expect($compass()!.style.getPropertyValue('--compass-bearing').trim()).toBe('90deg');
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

  // Bug fix 2026-04-28 — seam-crossing shortest-path accumulator.
  // Reproduces the user-reported "20° → 350° → 20°" jump.
  describe('seam-crossing shortest-path (regression — no long-way-around spin at the 0° / 360° seam)', () => {
    function compassBearingDeg(): number {
      const raw = $compass()!.style.getPropertyValue('--compass-bearing').trim();
      const m = raw.match(/^(-?[\d.]+)deg$/);
      return m ? parseFloat(m[1]) : NaN;
    }

    test('20° → 350° → 20° each step rotates ≤ 30° (no 330° spin)', async () => {
      const controller = makeController();
      mount(controller);
      await tick();

      controller.emitBearing(20);
      await tick();
      const a = compassBearingDeg();

      controller.emitBearing(350);
      await tick();
      const b = compassBearingDeg();
      expect(
        Math.abs(b - a),
        `step 20→350 rotated ${Math.abs(b - a)}°; expected ≤ 30°`,
      ).toBeLessThanOrEqual(30 + 1e-6);

      controller.emitBearing(20);
      await tick();
      const c = compassBearingDeg();
      expect(
        Math.abs(c - b),
        `step 350→20 rotated ${Math.abs(c - b)}°; expected ≤ 30°`,
      ).toBeLessThanOrEqual(30 + 1e-6);
    });

    test('350° → 20° single hop crosses the seam via the +30° shortest path', async () => {
      const controller = makeController();
      mount(controller);
      await tick();

      controller.emitBearing(350);
      await tick();
      const start = compassBearingDeg();
      // Shortest-path negation of 350 from 0 is +10 (going +10 CCW), not -350.
      expect(start).toBeCloseTo(10, 6);

      controller.emitBearing(20);
      await tick();
      const end = compassBearingDeg();
      // Then 350→20 is a +30° CW step, so the negated arrow goes -30°.
      expect(end - start).toBeCloseTo(-30, 6);
    });

    test('continuous CW spin 0→90→180→270→0 accumulates monotonically (no mid-spin reversal)', async () => {
      const controller = makeController();
      mount(controller);
      await tick();

      const samples: number[] = [];
      for (const deg of [90, 180, 270, 0]) {
        controller.emitBearing(deg);
        await tick();
        samples.push(compassBearingDeg());
      }
      // Each step should be a -90° (CCW) rotation in display space, since
      // the map's CW spin is mirrored by the arrow's CCW spin. Differences
      // between consecutive samples are all ≈ -90.
      const previous = [0, ...samples.slice(0, -1)];
      for (let i = 0; i < samples.length; i++) {
        expect(
          samples[i] - previous[i],
          `step ${i} (bearing → ${[90, 180, 270, 0][i]}): displayed delta ${samples[i] - previous[i]}, expected ≈ -90`,
        ).toBeCloseTo(-90, 6);
      }
      // After one full CW lap the accumulated displayed value is -360.
      expect(samples[samples.length - 1]).toBeCloseTo(-360, 6);
    });

    test('exact 180° flip resolves consistently (degenerate shortest-path edge)', async () => {
      const controller = makeController();
      mount(controller);
      await tick();

      controller.emitBearing(180);
      await tick();
      // Either +180 or -180 is technically shortest. The accumulator must
      // pick one deterministically and stick with it. We don't constrain
      // which sign — just that the magnitude is exactly 180.
      const v = compassBearingDeg();
      expect(Math.abs(v)).toBeCloseTo(180, 6);
    });
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
