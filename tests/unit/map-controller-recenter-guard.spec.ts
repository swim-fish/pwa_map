import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { MapController } from '../../src/map/MapController';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

// Regression for PR #5 review C-3 / Co-1 — `MapController.recenterTo`
// must always release the `isRecenteringForLocate` guard, even when
// MapLibre does NOT emit `moveend` (e.g. a no-op easeTo to the same
// centre). Without the timeout fallback, the guard stays stuck `true`
// and App.svelte's `dragstart` listener treats the next user pan as
// programmatic, breaking FR-018 (manual pan demotes Follow → Show).

const TARGET: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.04 as Lat,
  lon: 121.51 as Lon,
};

let originalSetTimeout: typeof globalThis.setTimeout;

beforeEach(() => {
  vi.useFakeTimers();
  originalSetTimeout = globalThis.setTimeout;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.setTimeout = originalSetTimeout;
});

describe('MapController.recenterTo — guard release', () => {
  test('animated recenter releases guard via timeout fallback when moveend never fires', () => {
    const controller = new MapController({
      container: document.createElement('div'),
      center: TARGET,
      zoom: 13,
    });
    const fakeMap = {
      easeTo: vi.fn(),
      setCenter: vi.fn(),
      // Deliberately NOT calling the moveend handler — simulates a
      // no-op easeTo (target equals current centre, MapLibre skips
      // the animation and never emits `moveend`).
      once: vi.fn(),
    };
    controller.attachUnderlying(fakeMap);

    expect(controller.isRecenteringForLocate).toBe(false);
    controller.recenterTo(TARGET, true);
    expect(controller.isRecenteringForLocate).toBe(true);

    // Advance past the documented 700 ms fallback (400 ms ease + margin).
    vi.advanceTimersByTime(700);
    expect(controller.isRecenteringForLocate).toBe(false);
  });

  test('animated recenter releases guard exactly once even if moveend fires AND timeout elapses', () => {
    const controller = new MapController({
      container: document.createElement('div'),
      center: TARGET,
      zoom: 13,
    });
    const handlers: Record<string, (() => void) | undefined> = {};
    const fakeMap = {
      easeTo: vi.fn(),
      setCenter: vi.fn(),
      once: vi.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
    };
    controller.attachUnderlying(fakeMap);

    controller.recenterTo(TARGET, true);
    expect(controller.isRecenteringForLocate).toBe(true);

    // moveend fires first (normal path).
    handlers.moveend?.();
    expect(controller.isRecenteringForLocate).toBe(false);

    // Advance past the 700 ms fallback. The released-flag inside
    // recenterTo guarantees this is a no-op (the guard does NOT
    // accidentally flip back true and stay false).
    vi.advanceTimersByTime(700);
    expect(controller.isRecenteringForLocate).toBe(false);
  });

  test('non-animated recenter (reduced-motion path) releases via microtask', async () => {
    const controller = new MapController({
      container: document.createElement('div'),
      center: TARGET,
      zoom: 13,
    });
    const fakeMap = {
      easeTo: vi.fn(),
      setCenter: vi.fn(),
      once: vi.fn(),
    };
    controller.attachUnderlying(fakeMap);

    controller.recenterTo(TARGET, false);
    expect(controller.isRecenteringForLocate).toBe(true);
    // The microtask drains on the next tick; advance the fake timers
    // to flush the queue.
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.isRecenteringForLocate).toBe(false);
  });
});
