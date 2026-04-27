import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { reorderArray } from '../../src/components/formatPriority';
import FormatPriorityRow from '../../src/components/FormatPriorityRow.svelte';
import { setLocale } from '../../src/i18n/index';
import type { CoordinateKind } from '../../src/types/coord';

// Feature 010 — invariants 1, 4, 5, 6 from contracts/drag-reorder-interaction.md
// AND the purity property of reorderArray.

describe('reorderArray (purity, permutation, same-position no-op)', () => {
  test('(1) splices item from `from` and inserts at `to`', () => {
    const arr: readonly number[] = [1, 2, 3, 4, 5];
    expect(reorderArray(arr, 0, 4)).toEqual([2, 3, 4, 5, 1]);
    expect(reorderArray(arr, 4, 0)).toEqual([5, 1, 2, 3, 4]);
    expect(reorderArray(arr, 2, 2)).toBe(arr); // same-position returns same ref
  });

  test('(2) does not mutate the input array', () => {
    const arr = [1, 2, 3];
    const snap = [...arr];
    reorderArray(arr, 0, 2);
    expect(arr).toEqual(snap);
  });

  test('(3) result is a permutation: same set, same length', () => {
    const arr: readonly string[] = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (let from = 0; from < arr.length; from++) {
      for (let to = 0; to < arr.length; to++) {
        const r = reorderArray(arr, from, to);
        expect(r.length).toBe(arr.length);
        expect(new Set(r)).toEqual(new Set(arr));
      }
    }
  });

  test('(4) out-of-bounds indices return the same array unchanged', () => {
    const arr = [1, 2, 3];
    expect(reorderArray(arr, -1, 1)).toBe(arr);
    expect(reorderArray(arr, 0, 99)).toBe(arr);
  });
});

let host: HTMLElement;
let cmp: {
  $destroy: () => void;
  $on: (event: string, h: (ev: CustomEvent) => void) => void;
} | null = null;

interface PointerEventInitLike {
  pointerId?: number;
  pointerType?: string;
  clientY?: number;
  bubbles?: boolean;
  cancelable?: boolean;
}

function makePointerEvent(type: string, init: PointerEventInitLike = {}): Event {
  // jsdom may not have PointerEvent; fall back to a plain Event with the
  // properties the lifecycle handler reads (pointerId, clientY, pointerType).
  let ev: Event;
  if (typeof PointerEvent === 'function') {
    ev = new PointerEvent(type, {
      pointerId: init.pointerId ?? 1,
      pointerType: init.pointerType ?? 'mouse',
      clientY: init.clientY ?? 0,
      bubbles: init.bubbles ?? true,
      cancelable: init.cancelable ?? true,
    });
  } else {
    ev = new Event(type, { bubbles: init.bubbles ?? true, cancelable: init.cancelable ?? true });
    Object.assign(ev, {
      pointerId: init.pointerId ?? 1,
      pointerType: init.pointerType ?? 'mouse',
      clientY: init.clientY ?? 0,
    });
  }
  return ev;
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  // Stub setPointerCapture / releasePointerCapture; jsdom HTMLElement doesn't have them.
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

function mountRow(props: { kind: CoordinateKind; enabled: boolean }): {
  reorderRequests: Array<{ kind: CoordinateKind; deltaY: number }>;
  toggles: CoordinateKind[];
  handle: HTMLElement;
} {
  const Component = FormatPriorityRow as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => { $destroy: () => void; $on: (event: string, h: (ev: CustomEvent) => void) => void };
  cmp = new Component({ target: host, props });
  const reorderRequests: Array<{ kind: CoordinateKind; deltaY: number }> = [];
  const toggles: CoordinateKind[] = [];
  cmp.$on('reorderRequest', (ev) => {
    const detail = ev.detail as { kind: CoordinateKind; deltaY: number };
    reorderRequests.push(detail);
  });
  cmp.$on('toggle', (ev) => {
    const detail = ev.detail as { kind: CoordinateKind };
    toggles.push(detail.kind);
  });
  const handle = host.querySelector('.drag-handle') as HTMLElement;
  return { reorderRequests, toggles, handle };
}

describe('FormatPriorityRow — Pointer Events lifecycle (US2 invariants 1, 4, 5, 6)', () => {
  test('(1) pointerdown → pointermove → pointerup commits with the cumulative deltaY', async () => {
    const { reorderRequests, handle } = mountRow({ kind: 'mgrs', enabled: true });
    expect(handle).not.toBeNull();
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientY: 100 }));
    handle.dispatchEvent(makePointerEvent('pointermove', { clientY: 180 }));
    handle.dispatchEvent(makePointerEvent('pointerup', { clientY: 180 }));
    await tick();
    expect(reorderRequests.length).toBe(1);
    expect(reorderRequests[0].kind).toBe('mgrs');
    expect(reorderRequests[0].deltaY).toBe(80);
  });

  test('(4) pointerdown → pointercancel does NOT commit', async () => {
    const { reorderRequests, handle } = mountRow({ kind: 'mgrs', enabled: true });
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientY: 0 }));
    handle.dispatchEvent(makePointerEvent('pointermove', { clientY: 100 }));
    handle.dispatchEvent(makePointerEvent('pointercancel', { clientY: 100 }));
    handle.dispatchEvent(makePointerEvent('pointerup', { clientY: 100 }));
    await tick();
    expect(reorderRequests.length).toBe(0);
  });

  test('(5) pointerdown → pointerup at same Y (no move) does NOT emit reorderRequest', async () => {
    const { reorderRequests, handle } = mountRow({ kind: 'mgrs', enabled: true });
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientY: 100 }));
    handle.dispatchEvent(makePointerEvent('pointerup', { clientY: 100 }));
    await tick();
    expect(reorderRequests.length).toBe(0);
  });

  test('(6) disabled row still emits reorderRequest on commit', async () => {
    const { reorderRequests, handle } = mountRow({ kind: 'twd67-tm2', enabled: false });
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientY: 0 }));
    handle.dispatchEvent(makePointerEvent('pointermove', { clientY: -50 }));
    handle.dispatchEvent(makePointerEvent('pointerup', { clientY: -50 }));
    await tick();
    expect(reorderRequests.length).toBe(1);
    expect(reorderRequests[0].kind).toBe('twd67-tm2');
  });

  test('checkbox change emits toggle event with the kind payload', async () => {
    const { toggles, handle } = mountRow({ kind: 'mgrs', enabled: true });
    expect(handle).not.toBeNull();
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click();
    await tick();
    expect(toggles).toEqual(['mgrs']);
  });
});
