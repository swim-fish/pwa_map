import { describe, test, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { bearingSignal, attachToController, __resetForTests } from '../../../src/map/bearingSignal';

interface StubController {
  emitBearing: (deg: number) => void;
  onBearing: (handler: (deg: number) => void) => () => void;
}

function makeStubController(initialBearing = 0): StubController {
  const handlers = new Set<(deg: number) => void>();
  let current = initialBearing;
  return {
    emitBearing(deg: number): void {
      current = deg;
      for (const h of handlers) h(deg);
    },
    onBearing(handler: (deg: number) => void): () => void {
      handlers.add(handler);
      handler(current);
      return () => handlers.delete(handler);
    },
  };
}

beforeEach(() => {
  __resetForTests();
});

describe('bearingSignal — feature 006 contracts/bearing-signal.md §4', () => {
  test('1. initial state — bearing === 0', () => {
    expect(get(bearingSignal).bearing).toBe(0);
  });

  test('2. attachToController + emitBearing(45) → store reflects 45', () => {
    const ctrl = makeStubController();
    attachToController(ctrl as never);
    ctrl.emitBearing(45);
    expect(get(bearingSignal).bearing).toBe(45);
  });

  test('3. sequential emits update store each time', () => {
    const ctrl = makeStubController();
    attachToController(ctrl as never);
    ctrl.emitBearing(45);
    expect(get(bearingSignal).bearing).toBe(45);
    ctrl.emitBearing(90);
    expect(get(bearingSignal).bearing).toBe(90);
    ctrl.emitBearing(180);
    expect(get(bearingSignal).bearing).toBe(180);
    ctrl.emitBearing(270);
    expect(get(bearingSignal).bearing).toBe(270);
  });

  test('4. re-attaching to a new controller detaches the old subscription', () => {
    const oldCtrl = makeStubController();
    const newCtrl = makeStubController();
    attachToController(oldCtrl as never);
    oldCtrl.emitBearing(45);
    expect(get(bearingSignal).bearing).toBe(45);
    attachToController(newCtrl as never);
    oldCtrl.emitBearing(90); // should NOT update the store
    expect(get(bearingSignal).bearing).not.toBe(90);
    newCtrl.emitBearing(180);
    expect(get(bearingSignal).bearing).toBe(180);
  });

  test('5. __resetForTests resets bearing to 0 and detaches', () => {
    const ctrl = makeStubController();
    attachToController(ctrl as never);
    ctrl.emitBearing(123);
    expect(get(bearingSignal).bearing).toBe(123);
    __resetForTests();
    expect(get(bearingSignal).bearing).toBe(0);
    ctrl.emitBearing(45);
    expect(get(bearingSignal).bearing).toBe(0); // detached, no update
  });

  test('6. subscribe(handler) fires immediately with current state', () => {
    const handler = vi.fn();
    const unsub = bearingSignal.subscribe(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ bearing: 0 });
    unsub();
  });
});
