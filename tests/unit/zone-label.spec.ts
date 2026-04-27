import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import Tm2Layout from '../../src/components/goto/Tm2Layout.svelte';
import Twd67Layout from '../../src/components/goto/Twd67Layout.svelte';
import { setLocale, t } from '../../src/i18n/index';
import type { Locale } from '../../src/types/coord';

// Feature 010 — invariants 1, 2, 3, 4 from contracts/zone-label-i18n.md.
//   1. Auto label unchanged.
//   2. zone121 ↔ zoneTagMainIsland; zone119 ↔ zoneTagPenghu.
//   3. Every locale (zh/en/ja) has both new keys.
//   4. TM2 + TWD67 parity.

let host: HTMLElement;
type Cmp = { $destroy: () => void };
let cmp: Cmp | null = null;

function mount(Component: unknown, props: Record<string, unknown> = {}): Cmp {
  const Ctor = Component as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => Cmp;
  cmp = new Ctor({ target: host, props });
  return cmp;
}

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
  cmp = null;
});

const LOCALES: readonly Locale[] = ['zh', 'en', 'ja'];

describe('feature 010 — TWD zone label i18n composition (US5, FR-016/017)', () => {
  for (const loc of LOCALES) {
    describe(`locale = ${loc}`, () => {
      test('(3) catalogue has both new zone-tag keys', () => {
        setLocale(loc);
        expect(t('goto.fields.zoneTagMainIsland')).not.toBe('goto.fields.zoneTagMainIsland');
        expect(t('goto.fields.zoneTagPenghu')).not.toBe('goto.fields.zoneTagPenghu');
      });

      test('(2) Tm2Layout zone-121 button label includes the main-island tag', async () => {
        setLocale(loc);
        mount(Tm2Layout, { easting: '', northing: '', zone: 'auto' });
        await tick();
        const btn121 = host.querySelector('[data-testid="goto-field-tm2-zone-121"]');
        expect(btn121).not.toBeNull();
        const text = btn121?.textContent ?? '';
        expect(text).toContain(t('goto.fields.zoneTagMainIsland'));
        expect(text).toContain('121');
      });

      test('(2) Tm2Layout zone-119 button label includes the Penghu tag', async () => {
        setLocale(loc);
        mount(Tm2Layout, { easting: '', northing: '', zone: 'auto' });
        await tick();
        const btn119 = host.querySelector('[data-testid="goto-field-tm2-zone-119"]');
        expect(btn119).not.toBeNull();
        const text = btn119?.textContent ?? '';
        expect(text).toContain(t('goto.fields.zoneTagPenghu'));
        expect(text).toContain('119');
      });

      test('(1) Tm2Layout auto button label unchanged from feature 002', async () => {
        setLocale(loc);
        mount(Tm2Layout, { easting: '', northing: '', zone: 'auto' });
        await tick();
        const auto = host.querySelector('[data-testid="goto-field-tm2-zone-auto"]');
        expect(auto?.textContent?.trim()).toBe(t('goto.fields.zoneAuto').trim());
      });

      test('(4) Twd67Layout zone-121 / 119 buttons share the same composition rule as Tm2Layout', async () => {
        setLocale(loc);
        mount(Twd67Layout, { easting: '', northing: '' });
        await tick();
        const btn121 = host.querySelector('[data-testid="goto-field-twd67-zone-121"]');
        const btn119 = host.querySelector('[data-testid="goto-field-twd67-zone-119"]');
        expect(btn121).not.toBeNull();
        expect(btn119).not.toBeNull();
        expect(btn121?.textContent ?? '').toContain(t('goto.fields.zoneTagMainIsland'));
        expect(btn119?.textContent ?? '').toContain(t('goto.fields.zoneTagPenghu'));
      });
    });
  }
});
