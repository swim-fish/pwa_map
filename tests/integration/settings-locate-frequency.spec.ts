import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import SettingsSheet from '../../src/components/SettingsSheet.svelte';
import {
  defaultPreferences,
  loadLocateFrequency,
  loadPreferences,
  savePreferences,
  __TESTING__,
  type FormatPreferences,
} from '../../src/storage/preferences';
import type { Locale } from '../../src/types/coord';
import { setLocale } from '../../src/i18n/index';

const { PREFS_KEY } = __TESTING__;

interface Cmp {
  $destroy: () => void;
}
let host: HTMLElement;
let cmp: Cmp;

beforeEach(() => {
  setLocale('zh');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(): void {
  const Component = SettingsSheet as unknown as new (args: {
    target: HTMLElement;
    props: { open: boolean };
  }) => Cmp;
  cmp = new Component({ target: host, props: { open: true } });
}

function getRadios(): HTMLInputElement[] {
  return Array.from(host.querySelectorAll('input[name="settings-locate-frequency"]'));
}

function getRadio(value: string): HTMLInputElement {
  return host.querySelector(
    `input[name="settings-locate-frequency"][value="${value}"]`,
  ) as HTMLInputElement;
}

describe('SettingsSheet — Locate frequency section (US4)', () => {
  test('renders three radios labelled Smart / Fast / Slow with Smart selected by default', async () => {
    mount();
    await tick();

    const radios = getRadios();
    expect(radios).toHaveLength(3);
    const values = radios.map((r) => r.value).sort();
    expect(values).toEqual(['fast', 'slow', 'smart']);

    expect(getRadio('smart').checked).toBe(true);
    expect(getRadio('fast').checked).toBe(false);
    expect(getRadio('slow').checked).toBe(false);
  });

  test('selecting Fast persists to pwa_map:prefs as locateFrequency: "fast"', async () => {
    mount();
    await tick();

    const fast = getRadio('fast');
    fast.checked = true;
    fast.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(loadLocateFrequency()).toBe('fast');
    expect(loadPreferences().locateFrequency).toBe('fast');
  });

  test('persisted Slow preset re-mounts as the selected radio', async () => {
    savePreferences({ ...defaultPreferences(), locateFrequency: 'slow' });
    mount();
    await tick();

    expect(getRadio('slow').checked).toBe(true);
    expect(getRadio('smart').checked).toBe(false);
  });

  test('switching to Slow then re-opening Settings keeps Slow selected', async () => {
    mount();
    await tick();

    const slow = getRadio('slow');
    slow.checked = true;
    slow.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    cmp.$destroy();
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    mount();
    await tick();

    expect(getRadio('slow').checked).toBe(true);
    expect(loadLocateFrequency()).toBe('slow');
  });

  test('saved preset survives a different unrelated preference change (additive write)', async () => {
    mount();
    await tick();

    // Switch to Fast, then mutate an unrelated field via a parallel save.
    const fast = getRadio('fast');
    fast.checked = true;
    fast.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    const prefs = loadPreferences();
    savePreferences({ ...prefs, locale: 'en' });
    expect(loadLocateFrequency()).toBe('fast');
  });

  test('regression PR#5/C-1 — App.svelte persistPrefs pattern preserves locateFrequency', async () => {
    // App.svelte previously held a long-lived `prefs` snapshot loaded
    // at startup. Any later `savePreferences({ ...prefs, <field>: ... })`
    // would overwrite locateFrequency with the stale startup value,
    // silently reverting a user's Settings choice.
    //
    // The fix is App.svelte's `persistPrefs(patch)` helper — it re-loads
    // from storage immediately before merging the patch. This test
    // simulates that helper at the call-site level and asserts the
    // user's locateFrequency choice survives subsequent unrelated saves.

    function persistPrefs(patch: Partial<FormatPreferences>): void {
      savePreferences({ ...loadPreferences(), ...patch });
    }

    // 1. User opens Settings, switches to Fast.
    mount();
    await tick();
    const fast = getRadio('fast');
    fast.checked = true;
    fast.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(loadLocateFrequency()).toBe('fast');

    // 2. Some unrelated UI (locale picker, layer picker, format
    //    toggle, …) commits via persistPrefs.
    persistPrefs({ locale: 'ja' as Locale });
    persistPrefs({ overlay: true });
    persistPrefs({ visible: ['wgs84-dd'] as never });

    // 3. locateFrequency is still 'fast'. Without the helper (using
    //    a stale snapshot), step 2 would have reverted it to 'smart'.
    expect(loadLocateFrequency()).toBe('fast');
    // Other unrelated fields were applied as expected.
    expect(loadPreferences().locale).toBe('ja');
    expect(loadPreferences().overlay).toBe(true);
  });

  test('section uses zh i18n labels (Constitution v1.1.0)', async () => {
    mount();
    await tick();

    const heading = host.querySelector('[data-testid="settings-locate-heading"]');
    expect(heading?.textContent?.trim()).toBe('定位更新頻率');

    const labels = Array.from(host.querySelectorAll('[data-testid^="settings-locate-preset-"]'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((s) => s.length > 0);
    expect(labels.some((l) => l.includes('智慧模式'))).toBe(true);
    expect(labels.some((l) => l.includes('快速更新'))).toBe(true);
    expect(labels.some((l) => l.includes('慢更新'))).toBe(true);
  });
});

describe('PREFS_KEY localStorage round-trip — sanity', () => {
  test('PREFS_KEY === "pwa_map:prefs"', () => {
    expect(PREFS_KEY).toBe('pwa_map:prefs');
  });
});
