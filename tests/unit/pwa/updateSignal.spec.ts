import { describe, test, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  updateSignal,
  offlineReadySignal,
  fireNeedRefresh,
  postpone,
  confirm,
  fireOfflineReady,
  dismissOfflineReady,
  __resetForTests,
  __TESTING__,
} from '../../../src/pwa/updateSignal';

beforeEach(() => {
  __resetForTests();
  vi.useRealTimers();
});

describe('updateSignal — offline-ready half (feature 004 US1)', () => {
  test('initial state — offlineReadySignal.visible === false', () => {
    expect(get(offlineReadySignal).visible).toBe(false);
  });

  test('fireOfflineReady() flips visible to true', () => {
    fireOfflineReady();
    expect(get(offlineReadySignal).visible).toBe(true);
  });

  test('dismissOfflineReady() flips visible back to false', () => {
    fireOfflineReady();
    dismissOfflineReady();
    expect(get(offlineReadySignal).visible).toBe(false);
  });

  test('fireOfflineReady() is idempotent (calling twice does not throw)', () => {
    fireOfflineReady();
    expect(() => fireOfflineReady()).not.toThrow();
    expect(get(offlineReadySignal).visible).toBe(true);
  });

  test('__resetForTests() clears both stores', () => {
    fireOfflineReady();
    fireNeedRefresh(async () => {});
    __resetForTests();
    expect(get(offlineReadySignal).visible).toBe(false);
    expect(get(updateSignal).visible).toBe(false);
    expect(get(updateSignal).postponedUntil).toBeNull();
    expect(get(updateSignal).confirmUpdate).toBeNull();
  });
});

describe('updateSignal — update prompt half (feature 004 US2)', () => {
  test('initial state — updateSignal { visible:false, postponedUntil:null, confirmUpdate:null }', () => {
    const s = get(updateSignal);
    expect(s.visible).toBe(false);
    expect(s.postponedUntil).toBeNull();
    expect(s.confirmUpdate).toBeNull();
  });

  test('fireNeedRefresh(fn) → visible:true, confirmUpdate === fn', () => {
    const fn = vi.fn(async () => {});
    fireNeedRefresh(fn);
    const s = get(updateSignal);
    expect(s.visible).toBe(true);
    expect(s.confirmUpdate).toBe(fn);
  });

  test('postpone() → visible:false, postponedUntil ≈ now+30min (±100ms)', () => {
    const before = Date.now();
    fireNeedRefresh(async () => {});
    postpone();
    const s = get(updateSignal);
    expect(s.visible).toBe(false);
    expect(s.postponedUntil).not.toBeNull();
    const diff = (s.postponedUntil ?? 0) - before;
    expect(diff).toBeGreaterThanOrEqual(__TESTING__.POSTPONE_MS - 100);
    expect(diff).toBeLessThanOrEqual(__TESTING__.POSTPONE_MS + 100);
  });

  test('during postpone window, fireNeedRefresh keeps visible:false but rebinds confirmUpdate', () => {
    fireNeedRefresh(async () => {});
    postpone();
    const fn2 = vi.fn(async () => {});
    fireNeedRefresh(fn2);
    const s = get(updateSignal);
    expect(s.visible).toBe(false);
    expect(s.confirmUpdate).toBe(fn2);
  });

  test('after postpone window expires, next fireNeedRefresh re-shows the prompt', () => {
    vi.useFakeTimers();
    fireNeedRefresh(async () => {});
    postpone();
    vi.advanceTimersByTime(31 * 60 * 1000);
    const fn2 = vi.fn(async () => {});
    fireNeedRefresh(fn2);
    expect(get(updateSignal).visible).toBe(true);
  });

  test('confirm() calls bound confirmUpdate exactly once', async () => {
    const fn = vi.fn(async () => {});
    fireNeedRefresh(fn);
    await confirm();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('confirm() with confirmUpdate === null is a safe no-op', async () => {
    await expect(confirm()).resolves.toBeUndefined();
  });
});
