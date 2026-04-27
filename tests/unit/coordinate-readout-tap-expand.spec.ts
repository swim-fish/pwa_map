import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import CoordinateReadout from '../../src/components/CoordinateReadout.svelte';
import { setLocale } from '../../src/i18n/index';
import type { CoordinateKind, Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 010 — US3 invariants 3, 4, 5 from contracts/readout-collapse-mode.md.
//   3. Copy button click does NOT toggle tapExpanded (event.stopPropagation).
//   4. tapExpanded is component-local, not persisted; reload starts collapsed.
//   5. Resize past the breakpoint clears tapExpanded synchronously.

const TAICHUNG_LAKE: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 23.85 as Lat,
  lon: 120.91 as Lon,
};

const FULL_FORMAT_ORDER: readonly CoordinateKind[] = [
  'wgs84-dd',
  'wgs84-dms',
  'twd97-tm2',
  'twd67-tm2',
  'mgrs',
  'taipower',
] as const;

interface MQLStub {
  matches: boolean;
  listeners: Array<(e: { matches: boolean }) => void>;
  addEventListener: (kind: string, l: (e: { matches: boolean }) => void) => void;
  removeEventListener: (kind: string, l: (e: { matches: boolean }) => void) => void;
}

let mql: MQLStub;

function installMatchMedia(matches: boolean): void {
  mql = {
    matches,
    listeners: [],
    addEventListener: (_kind: string, l: (e: { matches: boolean }) => void): void => {
      mql.listeners.push(l);
    },
    removeEventListener: (_kind: string, l: (e: { matches: boolean }) => void): void => {
      const i = mql.listeners.indexOf(l);
      if (i >= 0) mql.listeners.splice(i, 1);
    },
  };
  const fn = vi.fn(() => mql);
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: fn });
}

let host: HTMLElement;
let cmp: { $destroy: () => void; $set: (props: Record<string, unknown>) => void } | null = null;

function mount(props: Record<string, unknown>): void {
  const Component = CoordinateReadout as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => { $destroy: () => void; $set: (props: Record<string, unknown>) => void };
  cmp = new Component({ target: host, props });
}

function rootEl(): HTMLElement {
  return host.querySelector('[data-testid="readout-panel"]') as HTMLElement;
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  installMatchMedia(true);
});

afterEach(() => {
  cmp?.$destroy?.();
  cmp = null;
});

describe('feature 010 — CoordinateReadout tap-to-expand (US3, FR-008/009/010)', () => {
  test('tap on body in collapsed → tap-expanded; tap again → collapsed', async () => {
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');
    expect(rootEl().getAttribute('aria-expanded')).toBe('false');

    rootEl().click();
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('tap-expanded');
    expect(rootEl().getAttribute('aria-expanded')).toBe('true');

    rootEl().click();
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');
    expect(rootEl().getAttribute('aria-expanded')).toBe('false');
  });

  test('(3) tap on copy button does NOT toggle tap-expanded', async () => {
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');

    // Stub clipboard so the copy handler resolves cleanly.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });

    const copyBtn = host.querySelector('[data-testid="copy-wgs84-dd"]') as HTMLElement;
    expect(copyBtn).not.toBeNull();
    copyBtn.click();
    await tick();
    // Mode unchanged (Invariant 3).
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');
  });

  test('(5) resize past breakpoint clears tapExpanded synchronously', async () => {
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    rootEl().click();
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('tap-expanded');

    // Simulate viewport widen.
    mql.matches = false;
    for (const l of mql.listeners) l({ matches: false });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('expanded');

    // Now narrow again — tapExpanded should be cleared (start at collapsed).
    mql.matches = true;
    for (const l of mql.listeners) l({ matches: true });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');
  });
});
