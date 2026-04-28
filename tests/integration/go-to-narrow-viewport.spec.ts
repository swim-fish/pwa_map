import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 012 — Go-To narrow-viewport collapse contract.
// Source-text spec mirroring `safe-area-tokens.spec.ts` — jsdom does
// not compute layout so an at-rule like `@media (max-width: ...)` does
// not actually apply. The contract is the *presence* of the
// 360 px-with-0.02 px-rounding-rule breakpoint plus a 1-column collapse
// declaration in every Go-To layout's <style> block.
//
// Real-browser geometry verification (no horizontal overflow + tap
// targets ≥ 44 px) is exercised by `tests/e2e/go-to-narrow-viewport.e2e.spec.ts`.

const LAYOUT_FILES = [
  'src/components/goto/DdLayout.svelte',
  'src/components/goto/DmsLayout.svelte',
  'src/components/goto/Tm2Layout.svelte',
  'src/components/goto/Twd67Layout.svelte',
  'src/components/goto/MgrsLayout.svelte',
  'src/components/goto/TaipowerLayout.svelte',
];

const BREAKPOINT = /@media\s*\(\s*max-width:\s*calc\(\s*360px\s*-\s*0\.02px\s*\)\s*\)/;

const COLLAPSE_INSIDE_BREAKPOINT =
  /@media\s*\(\s*max-width:\s*calc\(\s*360px\s*-\s*0\.02px\s*\)\s*\)\s*\{[\s\S]*?grid-template-columns:\s*1fr/;

describe('Go-To narrow-viewport collapse — feature 012 / FR-010..FR-014 / SC-002', () => {
  test.each(LAYOUT_FILES)('%s contains the 360 px (0.02 px-rounded) breakpoint', (file) => {
    const src = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(src).toMatch(BREAKPOINT);
  });

  test.each(LAYOUT_FILES)('%s collapses to single column inside the breakpoint', (file) => {
    const src = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(src).toMatch(COLLAPSE_INSIDE_BREAKPOINT);
  });
});

describe('Go-To AutoLayout fits at 320 px without a breakpoint — feature 012 / FR-010', () => {
  test('AutoLayout uses a single full-width textarea (no grid that could overflow)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/goto/AutoLayout.svelte'),
      'utf8',
    );
    // Single <textarea> element, full-width via 100%. No grid columns.
    expect(src).toMatch(/<textarea/);
    expect(src).toMatch(/width:\s*100%/);
    expect(src).not.toMatch(/grid-template-columns/);
  });
});
