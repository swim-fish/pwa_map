import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 013 — `.map-controls` cluster relocation contract
// (contracts/cluster-layout.md). jsdom does not implement a real layout
// engine, so this spec asserts the source-of-truth CSS contract for
// App.svelte's .map-controls selector. Real-browser geometry is
// covered by tests/e2e/cluster-layout.e2e.spec.ts.

const REPO = process.cwd();
const APP = resolve(REPO, 'src/app/App.svelte');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function styleBlockOf(svelteSrc: string): string {
  const m = svelteSrc.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

function selectorBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  return m ? m[1] : '';
}

describe('feature 013 — `.map-controls` cluster anchored at top-left', () => {
  const css = styleBlockOf(read(APP));
  const body = selectorBody(css, '.map-controls');

  test('top declaration composes --space-3 + --top-stack-zone-top', () => {
    expect(body).toMatch(/top:\s*calc\(var\(--space-3\)\s*\+\s*var\(--top-stack-zone-top\)\)/);
  });

  test('left declaration composes --space-3 + --inline-stack-zone-left', () => {
    expect(body).toMatch(/left:\s*calc\(var\(--space-3\)\s*\+\s*var\(--inline-stack-zone-left\)\)/);
  });

  test('no top: 50% / no transform: translateY(-50%) (old vertical-centring removed)', () => {
    expect(body).not.toMatch(/top:\s*50%/);
    expect(body).not.toMatch(/transform:\s*translateY/);
  });

  test('no bottom / right anchoring on the cluster', () => {
    expect(body).not.toMatch(/^\s*bottom:\s*/m);
    expect(body).not.toMatch(/^\s*right:\s*/m);
  });

  test('no env(safe-area-inset-*) reference (token discipline)', () => {
    expect(body).not.toMatch(/env\(safe-area-inset/);
  });

  test('z-index 6 preserved (no overlap with notification region)', () => {
    expect(body).toMatch(/z-index:\s*6/);
  });

  test('flex column with --space-2 gap', () => {
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/flex-direction:\s*column/);
    expect(body).toMatch(/gap:\s*var\(--space-2/);
  });
});

describe('feature 013 — `.map-controls` DOM order: compass first, zoom last', () => {
  const src = read(APP);

  test('compass tag appears before ZoomControls in the .map-controls block', () => {
    // Locate the <div class="map-controls"> block.
    const blockMatch = src.match(/<div class="map-controls">([\s\S]*?)<\/div>/);
    expect(blockMatch, '.map-controls block not found').toBeTruthy();
    const block = blockMatch?.[1] ?? '';
    const compassIdx = block.indexOf('<Compass');
    const zoomIdx = block.indexOf('<ZoomControls');
    expect(compassIdx, '<Compass not found in .map-controls').toBeGreaterThanOrEqual(0);
    expect(zoomIdx, '<ZoomControls not found in .map-controls').toBeGreaterThanOrEqual(0);
    expect(compassIdx).toBeLessThan(zoomIdx);
  });

  test('if LocateButton is present, it sits between Compass and ZoomControls', () => {
    const blockMatch = src.match(/<div class="map-controls">([\s\S]*?)<\/div>/);
    const block = blockMatch?.[1] ?? '';
    const locateIdx = block.indexOf('<LocateButton');
    if (locateIdx === -1) {
      // US1-only state — LocateButton not yet mounted. Test is informational.
      return;
    }
    const compassIdx = block.indexOf('<Compass');
    const zoomIdx = block.indexOf('<ZoomControls');
    expect(compassIdx).toBeLessThan(locateIdx);
    expect(locateIdx).toBeLessThan(zoomIdx);
  });
});
