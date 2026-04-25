import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import { initCoord } from '../../src/coord';
import GoToDialog from '../../src/components/GoToDialog.svelte';
import type { GoToRequestOk } from '../../src/coord';
import { RECENTS_KEY } from '../../src/storage/recents';
import type { RecentList } from '../../src/types/goto';

beforeAll(() => {
  initCoord();
  // jsdom polyfill — PointerEvent not implemented natively.
  if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventPolyfill;
  }
});

let host: HTMLElement;
let cmp: { $destroy: () => void; $on: (e: string, fn: (ev: CustomEvent) => void) => void };

beforeEach(() => {
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

function mount(props: Record<string, unknown> = {}): void {
  const Component = GoToDialog as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: { open: true, ...props } });
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

function $$(testid: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[data-testid="${testid}"]`));
}

function fire(el: HTMLElement, type: string, init: EventInit = {}): void {
  el.dispatchEvent(new Event(type, { bubbles: true, ...init }));
}

async function setInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  el.value = value;
  fire(el, 'input');
  await tick();
}

describe('GoToDialog — US1 split-field input', () => {
  test('chip rack renders 7 chips in canonical order', async () => {
    mount();
    await tick();
    const chips = $$('goto-chip');
    expect(chips.length).toBe(7);
    const kinds = chips.map((c) => c.getAttribute('data-chip-kind'));
    expect(kinds).toEqual([
      'auto',
      'taipower',
      'wgs84-dd',
      'wgs84-dms',
      'twd67-tm2',
      'twd97-tm2',
      'mgrs',
    ]);
  });

  test('default chip is auto and the layout body is the auto layout', async () => {
    mount();
    await tick();
    expect($('goto-layout-auto')).not.toBeNull();
    expect($('goto-input')).not.toBeNull();
  });

  test('switching to wgs84-dd re-lays into lat / lon fields', async () => {
    mount();
    await tick();
    const ddChip = document.querySelector(
      '[data-testid="goto-chip"][data-chip-kind="wgs84-dd"]',
    ) as HTMLButtonElement;
    expect(ddChip).not.toBeNull();
    ddChip.click();
    await tick();
    expect($('goto-layout-wgs84-dd')).not.toBeNull();
    expect($('goto-field-dd-lat')).not.toBeNull();
    expect($('goto-field-dd-lon')).not.toBeNull();
  });

  test('submitting auto with a DD pair dispatches submit with the parsed target', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '25.033611, 121.564472');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('wgs84-dd');
    expect(received!.target.lat).toBeCloseTo(25.033611, 5);
  });

  test('submitting wgs84-dd with empty fields surfaces a localised error', async () => {
    mount();
    await tick();
    const ddChip = document.querySelector(
      '[data-testid="goto-chip"][data-chip-kind="wgs84-dd"]',
    ) as HTMLButtonElement;
    ddChip.click();
    await tick();
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect($('goto-error')).not.toBeNull();
  });

  test('submitting MGRS layout sends through the MGRS-only sub-parser', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    (
      document.querySelector(
        '[data-testid="goto-chip"][data-chip-kind="mgrs"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    await setInputValue($('goto-field-mgrs-gzd') as HTMLInputElement, '51R');
    await setInputValue($('goto-field-mgrs-square') as HTMLInputElement, 'UH');
    await setInputValue($('goto-field-mgrs-easting') as HTMLInputElement, '55170');
    await setInputValue($('goto-field-mgrs-northing') as HTMLInputElement, '69437');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('mgrs');
  });

  test('submitting TWD67 layout sends through the TWD67-only sub-parser and prepends qualifier', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    (
      document.querySelector(
        '[data-testid="goto-chip"][data-chip-kind="twd67-tm2"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    await setInputValue($('goto-field-tm2-easting') as HTMLInputElement, '306132.271');
    await setInputValue($('goto-field-tm2-northing') as HTMLInputElement, '2769822.821');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('twd67-tm2');
  });

  test('submitting Taipower layout (lower-case) auto-uppercases and parses', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    (
      document.querySelector(
        '[data-testid="goto-chip"][data-chip-kind="taipower"]',
      ) as HTMLButtonElement
    ).click();
    await tick();
    await setInputValue($('goto-field-taipower-first5') as HTMLInputElement, 'b7039');
    await setInputValue($('goto-field-taipower-last4or6') as HTMLInputElement, 'bd32');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('taipower');
  });
});

describe('GoToDialog — US2 recents row', () => {
  test('with no persisted recents, the recents row is not rendered', async () => {
    mount();
    await tick();
    expect($('goto-recents-row')).toBeNull();
  });

  test('persisted recents render MRU-ordered as chips', async () => {
    const seeded: RecentList = {
      version: 1,
      entries: [
        { format: { kind: 'auto' }, raw: '25.0, 121.5', createdAt: 300 },
        { format: { kind: 'fixed', value: 'mgrs' }, raw: '51R UH 55170 69437', createdAt: 200 },
        { format: { kind: 'fixed', value: 'taipower' }, raw: 'B7039 BD32', createdAt: 100 },
      ],
    };
    localStorage.setItem(RECENTS_KEY, JSON.stringify(seeded));
    mount();
    await tick();
    expect($('goto-recents-row')).not.toBeNull();
    const chips = $$('goto-recent-chip');
    expect(chips.length).toBe(3);
    expect(chips[0].textContent).toContain('25.0, 121.5');
    expect(chips[1].textContent).toContain('51R UH 55170 69437');
  });

  test('tapping a recent chip dispatches submit with the parsed target', async () => {
    const seeded: RecentList = {
      version: 1,
      entries: [{ format: { kind: 'auto' }, raw: '25.033611, 121.564472', createdAt: 100 }],
    };
    localStorage.setItem(RECENTS_KEY, JSON.stringify(seeded));
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const chip = $$('goto-recent-chip')[0] as HTMLButtonElement;
    chip.click();
    await tick();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('wgs84-dd');
    expect(received!.target.lat).toBeCloseTo(25.033611, 5);
  });

  test('a successful submit prepends the entry to the recents list in localStorage', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '25.033611, 121.564472');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect(received).not.toBeNull();
    const persisted = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? 'null') as RecentList;
    expect(persisted.entries.length).toBe(1);
    expect(persisted.entries[0].raw).toBe('25.033611, 121.564472');
  });

  test('long-press 500ms on a recent chip opens the delete confirmation', async () => {
    const seeded: RecentList = {
      version: 1,
      entries: [{ format: { kind: 'auto' }, raw: '25.0, 121.5', createdAt: 100 }],
    };
    localStorage.setItem(RECENTS_KEY, JSON.stringify(seeded));
    mount();
    await tick();
    const chip = $$('goto-recent-chip')[0] as HTMLButtonElement;
    chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 600));
    expect($('goto-recent-delete-confirm')).not.toBeNull();
  });

  test('confirming delete removes the entry from localStorage', async () => {
    const seeded: RecentList = {
      version: 1,
      entries: [
        { format: { kind: 'auto' }, raw: '25.0, 121.5', createdAt: 200 },
        { format: { kind: 'auto' }, raw: '24.0, 120.5', createdAt: 100 },
      ],
    };
    localStorage.setItem(RECENTS_KEY, JSON.stringify(seeded));
    mount();
    await tick();
    const chip = $$('goto-recent-chip')[0] as HTMLButtonElement;
    chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 600));
    ($('goto-recent-delete-confirm-ok') as HTMLButtonElement).click();
    await tick();
    const persisted = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? 'null') as RecentList;
    expect(persisted.entries.length).toBe(1);
    expect(persisted.entries[0].raw).toBe('24.0, 120.5');
  });

  test('cancelling delete leaves the list unchanged', async () => {
    const seeded: RecentList = {
      version: 1,
      entries: [{ format: { kind: 'auto' }, raw: '25.0, 121.5', createdAt: 100 }],
    };
    localStorage.setItem(RECENTS_KEY, JSON.stringify(seeded));
    mount();
    await tick();
    const chip = $$('goto-recent-chip')[0] as HTMLButtonElement;
    chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 600));
    ($('goto-recent-delete-confirm-cancel') as HTMLButtonElement).click();
    await tick();
    const persisted = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? 'null') as RecentList;
    expect(persisted.entries.length).toBe(1);
  });
});

describe('GoToDialog — US3 disambiguator', () => {
  test('submitting an unambiguous DD does not open the disambiguator', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '25.033611, 121.564472');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect($('goto-disambig')).toBeNull();
    expect(received).not.toBeNull();
  });

  test('submitting an ambiguous TM2 pair on auto opens the disambiguator and suspends submit', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '306962.887, 2769619.124');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect($('goto-disambig')).not.toBeNull();
    expect(received).toBeNull();
    const rows = $$('disambig-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('picking a candidate dispatches submit with the picked target and closes the disambiguator', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '306962.887, 2769619.124');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    const rows = $$('disambig-row');
    const z121Row = rows.find((r) => r.getAttribute('data-disambig-sub') === 'twd97-zone-121');
    expect(z121Row).not.toBeUndefined();
    (z121Row as HTMLButtonElement).click();
    await tick();
    expect($('goto-disambig')).toBeNull();
    expect(received).not.toBeNull();
    expect(received!.parsedAs).toBe('twd97-tm2');
    expect(received!.target.lat).toBeCloseTo(25.033611, 2);
  });

  test('cancelling the disambiguator keeps the modal open and dispatches no submit', async () => {
    let received: GoToRequestOk | null = null;
    mount();
    cmp.$on('submit', (ev) => {
      received = ev.detail as unknown as GoToRequestOk;
    });
    await tick();
    const input = $('goto-input') as HTMLTextAreaElement;
    await setInputValue(input, '306962.887, 2769619.124');
    ($('goto-submit') as HTMLButtonElement).click();
    await tick();
    expect($('goto-disambig')).not.toBeNull();
    ($('goto-disambig-cancel') as HTMLButtonElement).click();
    await tick();
    expect($('goto-disambig')).toBeNull();
    expect($('goto-dialog')).not.toBeNull();
    expect(received).toBeNull();
  });
});
