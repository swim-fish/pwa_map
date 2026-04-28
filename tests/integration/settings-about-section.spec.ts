import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import SettingsSheet from '../../src/components/SettingsSheet.svelte';
import { setLocale } from '../../src/i18n/index';
import { __resetForTests } from '../../src/pwa/installSignal';
import { createCacheStorageFake, type FakeCacheStorage } from '../unit/helpers/cacheStorageFake';

// Feature 012 — Settings About section integration contract.
// See specs/012-settings-about-and-mobile-fixes/contracts/settings-about-section.md.

const LIVE_MAP_URL = 'https://swim-fish.github.io/pwa_map/';
const SOURCE_CODE_URL = 'https://github.com/swim-fish/pwa_map';

let host: HTMLElement;
let cmp: { $destroy: () => void };
let cachesFake: FakeCacheStorage;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
  vi.unstubAllGlobals();
  cachesFake = createCacheStorageFake();
  vi.stubGlobal('caches', cachesFake);
  vi.stubGlobal('navigator', {
    userAgent: '',
    storage: {
      estimate: async () => ({ usage: 1024, quota: 100 * 1024 * 1024 }),
    },
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(
      (q: string): MediaQueryList =>
        ({
          matches: q.includes('prefers-reduced-motion') ? true : false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );
  __resetForTests();
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

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await tick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('feature 012 — Settings About section render contract (FR-015..FR-019)', () => {
  test('section is present when sheet is open', async () => {
    mount();
    await flush();
    const section = $('settings-about-section');
    expect(section).not.toBeNull();
  });

  test('Live map link has the canonical URL + open-in-new-tab + security attributes', async () => {
    mount();
    await flush();
    const a = $('settings-about-live-map-link') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a!.tagName).toBe('A');
    expect(a!.getAttribute('href')).toBe(LIVE_MAP_URL);
    expect(a!.getAttribute('target')).toBe('_blank');
    const rel = a!.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('Source code link has the canonical URL + open-in-new-tab + security attributes', async () => {
    mount();
    await flush();
    const a = $('settings-about-source-code-link') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a!.tagName).toBe('A');
    expect(a!.getAttribute('href')).toBe(SOURCE_CODE_URL);
    expect(a!.getAttribute('target')).toBe('_blank');
    const rel = a!.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('section heading is associated with the <section> via aria-labelledby', async () => {
    mount();
    await flush();
    const section = $('settings-about-section');
    const labelledBy = section?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy!);
    expect(heading).not.toBeNull();
    expect(heading!.tagName).toBe('H3');
  });

  test.each(['zh', 'en', 'ja'] as const)(
    'locale %s — heading + link labels are translated, URLs remain literal',
    async (locale) => {
      const cat = JSON.parse(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('node:fs').readFileSync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('node:path').resolve(process.cwd(), `src/i18n/${locale}.json`),
          'utf8',
        ),
      ) as Record<string, string>;
      setLocale(locale);
      mount();
      await flush();

      const section = $('settings-about-section');
      const labelledBy = section!.getAttribute('aria-labelledby');
      const heading = document.getElementById(labelledBy!);
      expect(heading!.textContent?.trim()).toBe(cat['settings.about.heading']);

      const live = $('settings-about-live-map-link') as HTMLAnchorElement | null;
      expect(live!.textContent?.trim()).toBe(cat['settings.about.liveMap']);
      expect(live!.getAttribute('href')).toBe(LIVE_MAP_URL);

      const repo = $('settings-about-source-code-link') as HTMLAnchorElement | null;
      expect(repo!.textContent?.trim()).toBe(cat['settings.about.sourceCode']);
      expect(repo!.getAttribute('href')).toBe(SOURCE_CODE_URL);
    },
  );

  test('Enter on link does not have defaultPrevented (browser follows the href)', async () => {
    mount();
    await flush();
    const a = $('settings-about-live-map-link') as HTMLAnchorElement | null;
    a!.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    a!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
