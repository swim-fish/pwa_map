import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import LayerPicker from '../../src/components/LayerPicker.svelte';
import LocalePicker from '../../src/components/LocalePicker.svelte';
import type { LayerSelection } from '../../src/types/map';
import type { Locale } from '../../src/types/coord';
import { MAP_SOURCES } from '../../src/map/sources';
import { setLocale } from '../../src/i18n/index';

let host: HTMLElement;
let cmp: { $destroy: () => void; $on: (e: string, fn: (ev: CustomEvent) => void) => void };

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mountLayerPicker(props: { open: boolean; selection: LayerSelection }): void {
  const Component = LayerPicker as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props });
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function $$(testid: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[data-testid="${testid}"]`));
}

describe('LayerPicker — US1', () => {
  test('renders 6 basemap rows in catalogue order + 1 overlay row', async () => {
    mountLayerPicker({
      open: true,
      selection: { basemap: 'osm-standard', overlay: false },
    });
    await tick();
    const rows = $$('layer-row');
    expect(rows.length).toBe(6);
    const ids = rows.map((r) => r.getAttribute('data-layer-id'));
    expect(ids).toEqual([
      'osm-standard',
      'nlsc-emap5',
      'google-hybrid',
      'google-satellite',
      'google-terrain',
      'google-roadmap',
    ]);
    expect($('layer-overlay')).not.toBeNull();
  });

  test('active basemap row has aria-checked=true; others false', async () => {
    mountLayerPicker({
      open: true,
      selection: { basemap: 'nlsc-emap5', overlay: false },
    });
    await tick();
    for (const row of $$('layer-row')) {
      const isActive = row.getAttribute('data-layer-id') === 'nlsc-emap5';
      expect(row.getAttribute('aria-checked')).toBe(isActive ? 'true' : 'false');
    }
  });

  test('overlay row aria-checked reflects selection.overlay', async () => {
    mountLayerPicker({
      open: true,
      selection: { basemap: 'google-satellite', overlay: true },
    });
    await tick();
    expect($('layer-overlay')!.getAttribute('aria-checked')).toBe('true');
  });

  test('picking a different basemap dispatches change with new basemap and unchanged overlay', async () => {
    let received: LayerSelection | null = null;
    mountLayerPicker({
      open: true,
      selection: { basemap: 'osm-standard', overlay: true },
    });
    cmp.$on('change', (ev) => {
      received = ev.detail as unknown as LayerSelection;
    });
    await tick();
    const target = document.querySelector(
      '[data-testid="layer-row"][data-layer-id="nlsc-emap5"]',
    ) as HTMLButtonElement;
    target.click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.basemap).toBe('nlsc-emap5');
    expect(received!.overlay).toBe(true);
  });

  test('toggling overlay dispatches change with unchanged basemap and inverted overlay', async () => {
    let received: LayerSelection | null = null;
    mountLayerPicker({
      open: true,
      selection: { basemap: 'osm-standard', overlay: false },
    });
    cmp.$on('change', (ev) => {
      received = ev.detail as unknown as LayerSelection;
    });
    await tick();
    ($('layer-overlay') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.basemap).toBe('osm-standard');
    expect(received!.overlay).toBe(true);
  });

  test('Escape dispatches close', async () => {
    let closed = false;
    mountLayerPicker({
      open: true,
      selection: { basemap: 'osm-standard', overlay: false },
    });
    cmp.$on('close', () => {
      closed = true;
    });
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    expect(closed).toBe(true);
  });

  test('regression: catalogue urlTemplates are immutable across the integration session', () => {
    const before = MAP_SOURCES.map((s) => s.urlTemplate);
    mountLayerPicker({
      open: true,
      selection: { basemap: 'google-hybrid', overlay: true },
    });
    // Simulate a few interactions.
    ($('layer-overlay') as HTMLButtonElement | null)?.click();
    const after = MAP_SOURCES.map((s) => s.urlTemplate);
    expect(after).toEqual(before);
  });
});

describe('LocalePicker — US2', () => {
  function mountLocalePicker(props: { open: boolean; selection: Locale }): void {
    const Component = LocalePicker as unknown as new (args: {
      target: HTMLElement;
      props: Record<string, unknown>;
    }) => typeof cmp;
    cmp = new Component({ target: host, props });
  }

  test('renders three rows in [zh, en, ja] order with literal self-names', async () => {
    mountLocalePicker({ open: true, selection: 'zh' });
    await tick();
    const rows = $$('locale-row');
    expect(rows.length).toBe(3);
    expect(rows[0].getAttribute('data-locale')).toBe('zh');
    expect(rows[0].textContent).toContain('中文');
    expect(rows[1].getAttribute('data-locale')).toBe('en');
    expect(rows[1].textContent).toContain('English');
    expect(rows[2].getAttribute('data-locale')).toBe('ja');
    expect(rows[2].textContent).toContain('日本語');
  });

  test('active locale row has aria-checked=true; others false', async () => {
    mountLocalePicker({ open: true, selection: 'en' });
    await tick();
    for (const row of $$('locale-row')) {
      const isActive = row.getAttribute('data-locale') === 'en';
      expect(row.getAttribute('aria-checked')).toBe(isActive ? 'true' : 'false');
    }
  });

  test("picking 'en' dispatches change with 'en'", async () => {
    let received: Locale | null = null;
    mountLocalePicker({ open: true, selection: 'zh' });
    cmp.$on('change', (ev) => {
      received = ev.detail as unknown as Locale;
    });
    await tick();
    const target = document.querySelector(
      '[data-testid="locale-row"][data-locale="en"]',
    ) as HTMLButtonElement;
    target.click();
    await tick();
    expect(received).toBe('en');
  });

  test('Escape dispatches close', async () => {
    let closed = false;
    mountLocalePicker({ open: true, selection: 'zh' });
    cmp.$on('close', () => {
      closed = true;
    });
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    expect(closed).toBe(true);
  });

  test('regression FR-013: setLocale(en) / setLocale(ja) does NOT mutate Google URL templates', () => {
    const before = MAP_SOURCES.filter((s) => s.group === 'google').map((s) => ({
      id: s.id,
      url: s.urlTemplate,
    }));
    setLocale('en');
    setLocale('ja');
    setLocale('zh');
    const after = MAP_SOURCES.filter((s) => s.group === 'google').map((s) => ({
      id: s.id,
      url: s.urlTemplate,
    }));
    expect(after).toEqual(before);
    // Sanity: every labelled Google entry still carries hl=zh-TW.
    for (const e of after) {
      if (e.id !== 'google-satellite') {
        expect(e.url.includes('hl=zh-TW')).toBe(true);
      }
    }
  });
});
