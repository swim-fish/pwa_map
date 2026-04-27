import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import CoordinateReadout from '../../src/components/CoordinateReadout.svelte';
import { setLocale } from '../../src/i18n/index';
import type { CoordinateKind, Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 010 — US1 invariants 1, 2, 6 from contracts/readout-collapse-mode.md.
// At narrow viewports (matchMedia query matches) AND ≥ 2 enabled formats, the
// readout must render only the priority-one row (data-mode="collapsed").
// At wide viewports, every enabled row must render in formatOrder. With < 2
// enabled formats, no collapse styling is applied regardless of viewport.

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
  const el = host.querySelector('[data-testid="readout-panel"]');
  if (!el) throw new Error('readout-panel not found');
  return el as HTMLElement;
}

function visibleRows(): HTMLElement[] {
  const all = host.querySelectorAll('[data-testid^="readout-"]');
  return Array.from(all).filter((el) => {
    const id = el.getAttribute('data-testid');
    return id !== 'readout-panel' && id !== 'readout-dd' && el.tagName === 'DIV';
  }) as HTMLElement[];
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  installMatchMedia(false);
});

afterEach(() => {
  cmp?.$destroy?.();
  cmp = null;
});

describe('feature 010 — CoordinateReadout collapse mode (US1, FR-001/002/003)', () => {
  test('(1) narrow viewport + 3 enabled formats → data-mode="collapsed", 1 row visible', async () => {
    installMatchMedia(true); // matches max-width: 599.98px
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');
    const rows = visibleRows();
    expect(rows.length).toBe(1);
    // Priority-one in formatOrder ∩ visible = wgs84-dd.
    expect(rows[0].getAttribute('data-testid')).toBe('readout-wgs84-dd');
    expect(rows[0].classList.contains('row--priority-one')).toBe(true);
  });

  test('(2) wide viewport + 3 enabled formats → data-mode="expanded", 3 rows', async () => {
    installMatchMedia(false);
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('expanded');
    const rows = visibleRows();
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'readout-wgs84-dd',
      'readout-wgs84-dms',
      'readout-mgrs',
    ]);
  });

  test('(3) narrow viewport + 1 enabled format → data-mode="expanded" (single-format escape)', async () => {
    installMatchMedia(true);
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('expanded');
    const rows = visibleRows();
    expect(rows.length).toBe(1);
    // No priority-one styling marker on the single row.
    expect(rows[0].classList.contains('row--priority-one')).toBe(false);
  });

  test('(4) row order follows formatOrder (priority-1 first), not visible array order', async () => {
    installMatchMedia(false);
    // formatOrder reverses the canonical order — row order MUST follow formatOrder.
    const reversed: readonly CoordinateKind[] = [
      'taipower',
      'mgrs',
      'twd67-tm2',
      'twd97-tm2',
      'wgs84-dms',
      'wgs84-dd',
    ];
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: reversed,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    const rows = visibleRows();
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'readout-mgrs',
      'readout-wgs84-dms',
      'readout-wgs84-dd',
    ]);
  });

  test('(5) priority-one of collapsed row uses formatOrder (not visible array order)', async () => {
    installMatchMedia(true);
    const order: readonly CoordinateKind[] = [
      'mgrs',
      'wgs84-dd',
      'wgs84-dms',
      'twd97-tm2',
      'twd67-tm2',
      'taipower',
    ];
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: order,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    const rows = visibleRows();
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-testid')).toBe('readout-mgrs');
  });

  test('(6) matchMedia change → collapsed → expanded reactively', async () => {
    installMatchMedia(true);
    mount({
      position: TAICHUNG_LAKE,
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: FULL_FORMAT_ORDER,
      mgrsPrecision: 5,
      taipowerPrecision: 11,
    });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('collapsed');

    // Simulate viewport widen.
    mql.matches = false;
    for (const l of mql.listeners) l({ matches: false });
    await tick();
    expect(rootEl().getAttribute('data-mode')).toBe('expanded');
    expect(visibleRows().length).toBe(3);
  });
});
