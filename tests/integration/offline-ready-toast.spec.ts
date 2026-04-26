import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { __resetForTests, fireOfflineReady, offlineReadySignal } from '../../src/pwa/updateSignal';
import { setLocale } from '../../src/i18n/index';
import { get } from 'svelte/store';

// We intentionally test the smaller toast surface in isolation rather
// than mounting all of App.svelte (which boots a real MapController +
// MapLibre and is heavy). This component mirrors the toast block in
// App.svelte and exercises the same store + the same i18n key.

import OfflineReadyToastHarness from './harnesses/OfflineReadyToastHarness.svelte';

let host: HTMLElement;
let cmp: { $destroy: () => void };

beforeEach(() => {
  __resetForTests();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(): void {
  const Component = OfflineReadyToastHarness as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: {} });
}

describe('Offline-ready toast (feature 004 US1, FR-004 + SC-008)', () => {
  test('initial render — no toast in DOM', async () => {
    mount();
    await tick();
    expect(document.querySelector('[data-testid="offline-ready-toast"]')).toBeNull();
  });

  test('after fireOfflineReady() the toast renders the localised pwa.offline.ready string', async () => {
    mount();
    await tick();
    fireOfflineReady();
    await tick();
    const el = document.querySelector('[data-testid="offline-ready-toast"]');
    expect(el).not.toBeNull();
    expect(el!.textContent?.trim()).toBe('Ready for offline use');
  });

  test('toast localises to zh when the locale is zh', async () => {
    setLocale('zh');
    mount();
    await tick();
    fireOfflineReady();
    await tick();
    const el = document.querySelector('[data-testid="offline-ready-toast"]');
    expect(el!.textContent?.trim()).toBe('已準備好離線使用');
  });

  test('toast localises to ja when the locale is ja', async () => {
    setLocale('ja');
    mount();
    await tick();
    fireOfflineReady();
    await tick();
    const el = document.querySelector('[data-testid="offline-ready-toast"]');
    expect(el!.textContent?.trim()).toBe('オフラインで利用可能');
  });

  test('store flips back to visible:false when dismiss runs after the timer', async () => {
    vi.useFakeTimers();
    mount();
    await tick();
    fireOfflineReady();
    await tick();
    expect(get(offlineReadySignal).visible).toBe(true);
    vi.advanceTimersByTime(5000);
    // Harness dismisses on a 5s setTimeout; flush the microtask queue.
    await Promise.resolve();
    vi.useRealTimers();
    await tick();
    expect(get(offlineReadySignal).visible).toBe(false);
    expect(document.querySelector('[data-testid="offline-ready-toast"]')).toBeNull();
  });

  test('toast carries role=status + aria-live=polite', async () => {
    mount();
    await tick();
    fireOfflineReady();
    await tick();
    const el = document.querySelector('[data-testid="offline-ready-toast"]')!;
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
});
