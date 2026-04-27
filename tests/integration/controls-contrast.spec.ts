import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 006 contrast-token regression net. Mirrors the feature-005
// `install-contrast.spec.ts` source-check pattern: Vitest + jsdom does
// not apply Svelte scoped <style> via CSSOM, so we read the component
// sources and assert that the WCAG-AA-compliant tokens
// (`--color-surface-elev`, `--color-fg`, `--color-border`,
// `--color-accent`) are referenced — never replaced by raw hex /
// rgba values. This catches the regression where a future PR could
// hard-code colours and silently collapse dark-mode contrast.

const COMPASS = resolve(process.cwd(), 'src/components/Compass.svelte');
const ZOOM = resolve(process.cwd(), 'src/components/ZoomControls.svelte');

describe('Compass + zoom controls contrast tokens — feature 006 FR-011 / SC-006', () => {
  test('Compass.svelte uses --color-surface-elev / --color-fg / --color-border', () => {
    const src = readFileSync(COMPASS, 'utf8');
    expect(src).toMatch(/background:\s*var\(--color-surface-elev/);
    expect(src).toMatch(/color:\s*var\(--color-fg/);
    expect(src).toMatch(/var\(--color-border/);
  });

  test('Compass.svelte does NOT hard-code raw contrast-bearing colours', () => {
    const src = readFileSync(COMPASS, 'utf8');
    const hardCoded = [...src.matchAll(/(background|color):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g)]
      .map((m) => m[0])
      .filter((s) => !/box-shadow/.test(s));
    expect(hardCoded).toEqual([]);
  });

  test('ZoomControls.svelte uses --color-surface-elev / --color-fg / --color-border', () => {
    const src = readFileSync(ZOOM, 'utf8');
    expect(src).toMatch(/background:\s*var\(--color-surface-elev/);
    expect(src).toMatch(/color:\s*var\(--color-fg/);
    expect(src).toMatch(/var\(--color-border/);
  });

  test('ZoomControls.svelte does NOT hard-code raw contrast-bearing colours', () => {
    const src = readFileSync(ZOOM, 'utf8');
    const hardCoded = [...src.matchAll(/(background|color):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g)]
      .map((m) => m[0])
      .filter((s) => !/box-shadow/.test(s));
    expect(hardCoded).toEqual([]);
  });
});
