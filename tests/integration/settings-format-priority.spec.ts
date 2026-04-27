import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import FormatToggle from '../../src/components/FormatToggle.svelte';
import { reorderArray } from '../../src/components/formatPriority';
import { setLocale } from '../../src/i18n/index';
import {
  DEFAULT_FORMAT_ORDER,
  loadPreferences,
  savePreferences,
  __TESTING__,
} from '../../src/storage/preferences';
import type { CoordinateKind } from '../../src/types/coord';

// Feature 010 — US2 SC-002: drag → readout updates within 200 ms.
// Mounting the full <App> in jsdom is heavy and brings MapLibre. The
// equivalent contract surface is FormatToggle dispatching a `reorder`
// event whose detail.formatOrder mirrors what reorderArray() returns
// for the chosen (from, to) pair, then App.svelte persisting via
// savePreferences. We mount FormatToggle directly, simulate a drag
// commit by dispatching the reorderRequest event from a row, and
// confirm the parent contract: the FormatToggle re-emits `reorder`
// and the persisted formatOrder is the new order.

const { PREFS_KEY } = __TESTING__;

let host: HTMLElement;
let cmp: {
  $destroy: () => void;
  $on: (event: string, h: (ev: CustomEvent) => void) => void;
} | null = null;

function mount(props: Record<string, unknown>): {
  reorderEvents: Array<{ formatOrder: readonly CoordinateKind[] }>;
} {
  const Component = FormatToggle as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => { $destroy: () => void; $on: (event: string, h: (ev: CustomEvent) => void) => void };
  cmp = new Component({ target: host, props });
  const reorderEvents: Array<{ formatOrder: readonly CoordinateKind[] }> = [];
  cmp.$on('reorder', (ev) => {
    reorderEvents.push(ev.detail as { formatOrder: readonly CoordinateKind[] });
  });
  return { reorderEvents };
}

beforeEach(() => {
  setLocale('en');
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  if (!('setPointerCapture' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  }
});

afterEach(() => {
  cmp?.$destroy?.();
  cmp = null;
});

function makePointerEvent(type: string, clientY: number): Event {
  if (typeof PointerEvent === 'function') {
    return new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      clientY,
      bubbles: true,
      cancelable: true,
    });
  }
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, { pointerId: 1, pointerType: 'mouse', clientY });
  return ev;
}

describe('feature 010 — US2 settings drag-to-reorder integration (SC-002, FR-005)', () => {
  test('drag on a row commits a `reorder` event with the new formatOrder', async () => {
    const initialOrder: readonly CoordinateKind[] = [...DEFAULT_FORMAT_ORDER];
    const { reorderEvents } = mount({
      visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
      formatOrder: initialOrder,
      open: true,
    });
    await tick();

    const rows = host.querySelectorAll('[data-testid^="format-priority-row-"]');
    expect(rows.length).toBe(6);
    // Drag the third row (index 2 in DEFAULT_FORMAT_ORDER = twd97-tm2)
    // upward by ~120 px → step delta -2 at 56 px row height.
    const handle = host.querySelector('[data-testid="drag-handle-twd97-tm2"]') as HTMLElement;
    expect(handle).not.toBeNull();
    handle.dispatchEvent(makePointerEvent('pointerdown', 200));
    handle.dispatchEvent(makePointerEvent('pointermove', 80));
    const t0 = performance.now();
    handle.dispatchEvent(makePointerEvent('pointerup', 80));
    await tick();
    const elapsed = performance.now() - t0;

    expect(reorderEvents.length).toBe(1);
    const expected = reorderArray(initialOrder, 2, 0);
    expect(reorderEvents[0].formatOrder).toEqual(expected);
    // SC-002: commit propagates to the parent within 200 ms.
    expect(elapsed).toBeLessThan(200);
  });

  test('round-trip: savePreferences persists the new formatOrder; loadPreferences restores it', () => {
    const base = loadPreferences();
    const newOrder: readonly CoordinateKind[] = [
      'mgrs',
      'wgs84-dd',
      'wgs84-dms',
      'twd97-tm2',
      'twd67-tm2',
      'taipower',
    ];
    savePreferences({ ...base, formatOrder: newOrder });
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();
    const restored = loadPreferences();
    expect(restored.formatOrder).toEqual(newOrder);
  });
});
