import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import SettingsSheet from '../../src/components/SettingsSheet.svelte';
import { setLocale } from '../../src/i18n/index';
import { TILE_CACHE_NAMES } from '../../src/pwa/cachePolicy';
import {
  createCacheStorageFake,
  seed,
  type FakeCacheStorage,
} from '../unit/helpers/cacheStorageFake';

// Integration test: exercises the REAL cacheStats / cachePurge
// modules against a fake CacheStorage installed on globalThis.
// No vi.mock — the goal is end-to-end coverage of the cross-module flow
// per contracts/settings-sheet.md §6 (cases #19, #20, #21).

let host: HTMLElement;
let cmp: { $destroy: () => void };
let storage: FakeCacheStorage;

const DAY_MS = 24 * 60 * 60 * 1000;

function dateHeaderAt(epochMs: number): string {
  return new Date(epochMs).toUTCString();
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
  vi.unstubAllGlobals();
  storage = createCacheStorageFake();
  vi.stubGlobal('caches', storage);
  // Provide a minimal navigator.storage that returns an estimate.
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    storage: {
      estimate: async () => ({ usage: 1024 * 1024, quota: 100 * 1024 * 1024 }),
    },
  });
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
  vi.unstubAllGlobals();
});

function mount(): void {
  const Component = SettingsSheet as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: { open: true } });
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

async function flushAsync(): Promise<void> {
  // The cachePurge module yields via `setTimeout(0)` every 256 entries.
  // Drain both microtasks (Svelte tick / Promise.resolve) AND macrotasks
  // (setTimeout) repeatedly so the nested awaits inside Promise.all are
  // all observed here.
  for (let i = 0; i < 30; i++) {
    await tick();
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

describe('SettingsSheet integration — clear-cache flow (case #19)', () => {
  test('open → clear-all → confirm → counts go to zero → reopen → still zero', async () => {
    await seed(storage, 'osm-tiles', [{ url: 'a' }, { url: 'b' }, { url: 'c' }]);
    await seed(storage, 'nlsc-tiles', [{ url: 'd' }, { url: 'e' }]);
    // google-tiles is unpopulated.

    mount();
    await flushAsync();

    // Initial counts visible.
    expect($('settings-cache-row-osm-tiles-count')!.textContent).toContain('3');
    expect($('settings-cache-row-nlsc-tiles-count')!.textContent).toContain('2');
    expect($('settings-cache-row-google-tiles-count')!.textContent).toContain('0');

    // Clear all.
    ($('settings-clear-all') as HTMLButtonElement).click();
    await tick();
    ($('settings-confirm-ok') as HTMLButtonElement).click();
    await flushAsync();

    // Counts now zero in the rendered rows.
    for (const name of TILE_CACHE_NAMES) {
      const txt = $(`settings-cache-row-${name}-count`)!.textContent ?? '';
      // The format is "{count} of {cap}" — assert leading "0 ".
      expect(txt.trim().startsWith('0')).toBe(true);
    }

    // Underlying caches are actually empty.
    const osm = await storage.open('osm-tiles');
    const nlsc = await storage.open('nlsc-tiles');
    expect((await osm.keys()).length).toBe(0);
    expect((await nlsc.keys()).length).toBe(0);
  });
});

describe('SettingsSheet integration — TTL purge (case #20)', () => {
  test('change TTL to 1 day → entries older than 1 day are purged', async () => {
    const now = 100 * DAY_MS;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await seed(storage, 'osm-tiles', [
      { url: 'fresh', dateHeader: dateHeaderAt(now - 12 * 60 * 60 * 1000) }, // 12h old
      { url: 'stale', dateHeader: dateHeaderAt(now - 14 * DAY_MS) }, // 14d old
    ]);

    mount();
    await flushAsync();

    expect($('settings-cache-row-osm-tiles-count')!.textContent).toContain('2');

    const ttlSelect = $('settings-ttl') as HTMLSelectElement;
    ttlSelect.value = '1';
    ttlSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    // The fresh entry should survive; the stale one removed.
    const osm = await storage.open('osm-tiles');
    const keys = (await osm.keys()).map((k) => k.url);
    expect(keys).toEqual(['fresh']);

    // Persisted TTL.
    const persisted = JSON.parse(localStorage.getItem('pwa_map:prefs') ?? '{}');
    expect(persisted.tileTtlDays).toBe(1);
  });
});

describe('SettingsSheet integration — MaxEntries trim (case #21)', () => {
  test('change cap to 1024 → cache trimmed oldest-first to 1024 (most-recent retained)', async () => {
    // Pre-seed osm-tiles with 1500 entries, all fresh (dated now) so
    // purgeExpired keeps them all. Trim should reduce to exactly 1024
    // and the surviving keys should be the most-recently-inserted 1024.
    const now = 100 * DAY_MS;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const dateHeader = dateHeaderAt(now);
    const entries = Array.from({ length: 1500 }, (_, i) => ({
      url: `tile-${i}`,
      dateHeader,
    }));
    await seed(storage, 'osm-tiles', entries);

    mount();
    await flushAsync();

    expect($('settings-cache-row-osm-tiles-count')!.textContent).toContain('1500');

    const maxSelect = $('settings-max-entries') as HTMLSelectElement;
    maxSelect.value = '1024';
    maxSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsync();

    const osm = await storage.open('osm-tiles');
    const keys = (await osm.keys()).map((k) => k.url);
    expect(keys.length).toBe(1024);
    // Surviving keys are the most-recent: tile-476..tile-1499.
    expect(keys[0]).toBe('tile-476');
    expect(keys[keys.length - 1]).toBe('tile-1499');

    // Persisted limit.
    const persisted = JSON.parse(localStorage.getItem('pwa_map:prefs') ?? '{}');
    expect(persisted.tileMaxEntries).toBe(1024);
  });
});
