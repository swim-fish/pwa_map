import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AttributionBar from '../../src/components/AttributionBar.svelte';
import { setLocale } from '../../src/i18n/index';

let host: HTMLElement;
let cmp: { $destroy: () => void };

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(props: Record<string, unknown>): void {
  const Component = AttributionBar as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props });
}

function badge(): HTMLElement | null {
  return document.querySelector('[data-testid="attribution"]');
}

describe('AttributionBar — composed string preservation (feature 004 US3 / FR-015)', () => {
  test('1. osm-standard, no overlay → exact OSM attribution string (en)', async () => {
    mount({ basemap: 'osm-standard', overlay: false });
    await tick();
    expect(badge()!.textContent?.trim()).toBe('© OpenStreetMap contributors');
  });

  test('1b. osm-standard renders zh attribution after locale switch', async () => {
    setLocale('zh');
    mount({ basemap: 'osm-standard', overlay: false });
    await tick();
    expect(badge()!.textContent?.trim()).toBe('© OpenStreetMap 貢獻者');
  });

  test('2. google-hybrid + overlay → composed string contains both attributions joined by " | "', async () => {
    mount({ basemap: 'google-hybrid', overlay: true });
    await tick();
    const text = badge()!.textContent ?? '';
    expect(text).toContain('Google');
    // overlay shares the same attribution key (Google) so de-dup logic
    // collapses the string. Test against a non-google basemap below.
  });

  test('2b. nlsc-emap5 + Google road overlay → composed string contains both providers separated by " | "', async () => {
    mount({ basemap: 'nlsc-emap5', overlay: true });
    await tick();
    const text = badge()!.textContent ?? '';
    expect(text).toContain('NLSC');
    expect(text).toContain('Google');
    expect(text).toContain(' | ');
  });

  test('3. nlsc-emap5 attribution string contains the NLSC credit', async () => {
    mount({ basemap: 'nlsc-emap5', overlay: false });
    await tick();
    expect(badge()!.textContent?.trim()).toBe('© Ministry of the Interior NLSC');
  });

  test('4. badge element is present in the DOM (FR-015 — must NOT be hidden conditionally)', async () => {
    mount({ basemap: 'osm-standard', overlay: false });
    await tick();
    expect(badge()).not.toBeNull();
    expect(badge()!.tagName).toBe('SMALL');
  });

  test('5. badge carries data-testid="attribution" (regression net for layout tests / E2E selectors)', async () => {
    mount({ basemap: 'google-hybrid', overlay: false });
    await tick();
    expect(badge()!.getAttribute('data-testid')).toBe('attribution');
  });

  test('6. component source uses the new CSS custom-property tokens (token swap from contracts/attribution-tokens.md §3)', () => {
    // Vitest+Svelte does not inject scoped styles into jsdom CSSOM, so
    // we read the component source directly to enforce the contract.
    // This catches the FR-013 regression where a future PR could
    // accidentally re-introduce `var(--color-fg)` and re-collapse dark
    // mode contrast.
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/AttributionBar.svelte'),
      'utf8',
    );
    expect(src).toContain('background: var(--attribution-bg)');
    expect(src).toContain('color: var(--attribution-fg)');
    expect(src).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\)/);
    expect(src).not.toMatch(/color:\s*var\(--color-fg/);
  });
});
