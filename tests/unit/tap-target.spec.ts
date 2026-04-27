import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 009 — tap-target floor regression net (FR-001 / FR-002 / SC-001).
// Mirrors the controls-contrast.spec.ts pattern: Vitest + jsdom does not
// apply Svelte scoped <style> via real layout, so we read the source files
// and assert the WCAG 2.5.5 Level AAA tap-target contract:
//   1. tokens.css declares `--tap-min: 44px` exactly.
//   2. tokens.css publishes a `.tap-target` utility that resolves to
//      `min-width: var(--tap-min); min-height: var(--tap-min);`.
//   3. Every component listed in contracts/tap-target.md applies the
//      floor — either via the utility class on the button element or via
//      `min-width: var(--tap-min); min-height: var(--tap-min);` in its
//      scoped <style> block — and DOES NOT keep the prior 36-px hard-coded
//      sizing.
// Per-engine getBoundingClientRect verification (Invariants 2–3 of
// contracts/tap-target.md) is delegated to tests/e2e/mobile-tap-targets.e2e.spec.ts
// which runs in real browsers.

const REPO = process.cwd();
const TOKENS = resolve(REPO, 'src/app/tokens.css');
const COMPASS = resolve(REPO, 'src/components/Compass.svelte');
const ZOOM = resolve(REPO, 'src/components/ZoomControls.svelte');
const READOUT = resolve(REPO, 'src/components/CoordinateReadout.svelte');
const APP = resolve(REPO, 'src/app/App.svelte');
const INSTALL = resolve(REPO, 'src/components/InstallBanner.svelte');
const UPDATE = resolve(REPO, 'src/components/UpdatePrompt.svelte');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function styleBlockOf(svelteSrc: string): string {
  const m = svelteSrc.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

function templateBlockOf(svelteSrc: string): string {
  // Crude but sufficient — strip <script> and <style> blocks to leave the markup.
  return svelteSrc
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
}

/** Assert that a CSS rule for `selector` contains both min-width and
 *  min-height referencing var(--tap-min). */
function expectTapMinOnSelector(css: string, selector: string): void {
  const rule = ruleFor(css, selector);
  expect(rule, `missing rule for "${selector}"`).not.toBe(null);
  expect(rule!).toMatch(/min-width:\s*var\(--tap-min\)/);
  expect(rule!).toMatch(/min-height:\s*var\(--tap-min\)/);
}

/** Find a CSS rule body for the given selector inside `css`. Returns null
 *  if not found. The match is loose: any rule whose selector list contains
 *  the literal selector counts. */
function ruleFor(css: string, selector: string): string | null {
  // Escape regex metacharacters in selector except for the leading dot.
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[,}\\s])${esc}\\s*(?:,\\s*[^{]+?)?\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  return m ? m[2] : null;
}

describe('feature 009 — tap-target floor (FR-001 / FR-002 / SC-001)', () => {
  test('tokens.css declares --tap-min: 44px exactly', () => {
    const css = read(TOKENS);
    expect(css).toMatch(/--tap-min:\s*44px\s*;/);
  });

  test('tokens.css declares a .tap-target utility that hits the floor on both axes', () => {
    const css = read(TOKENS);
    // Select the rule for `.tap-target` (may be a comma list with :disabled).
    expect(css).toMatch(/\.tap-target[\s\S]*?\{[\s\S]*?min-width:\s*var\(--tap-min\)/);
    expect(css).toMatch(/\.tap-target[\s\S]*?\{[\s\S]*?min-height:\s*var\(--tap-min\)/);
  });

  test('Compass.svelte applies var(--tap-min) on the toggle root and drops the 36-px hard-coding', () => {
    const src = read(COMPASS);
    const css = styleBlockOf(src);
    expectTapMinOnSelector(css, '.compass');
    // No more 36-px sizing on the compass.
    expect(css).not.toMatch(/min-width:\s*36px/);
    expect(css).not.toMatch(/min-height:\s*36px/);
    expect(css).not.toMatch(/^\s*width:\s*36px/m);
    expect(css).not.toMatch(/^\s*height:\s*36px/m);
  });

  test('ZoomControls.svelte applies var(--tap-min) on .zoom-btn and drops the 36-px hard-coding', () => {
    const src = read(ZOOM);
    const css = styleBlockOf(src);
    expectTapMinOnSelector(css, '.zoom-btn');
    expect(css).not.toMatch(/min-width:\s*36px/);
    expect(css).not.toMatch(/min-height:\s*36px/);
    expect(css).not.toMatch(/^\s*width:\s*36px/m);
    expect(css).not.toMatch(/^\s*height:\s*36px/m);
  });

  test('CoordinateReadout.svelte raises the .copy button to var(--tap-min)', () => {
    const src = read(READOUT);
    const css = styleBlockOf(src);
    expectTapMinOnSelector(css, '.copy');
    // The original 2px-vertical padding must be replaced with at least the --space-2 floor.
    expect(css).not.toMatch(/padding:\s*2px\s+6px/);
  });

  test('App.svelte sets min-height: var(--tap-min) on .toolbar-btn and the settings button', () => {
    const src = read(APP);
    const css = styleBlockOf(src);
    const toolbar = ruleFor(css, '.toolbar-btn');
    expect(toolbar, 'missing .toolbar-btn rule').not.toBe(null);
    expect(toolbar!).toMatch(/min-height:\s*var\(--tap-min\)/);
    const settings = ruleFor(css, '.settings-toolbar-btn');
    expect(settings, 'missing .settings-toolbar-btn rule').not.toBe(null);
    expect(settings!).toMatch(/min-width:\s*var\(--tap-min\)/);
    // The legacy 36-px min-width line must be gone.
    expect(settings!).not.toMatch(/min-width:\s*36px/);
  });

  test('InstallBanner.svelte action buttons opt into the .tap-target utility', () => {
    const src = read(INSTALL);
    const tpl = templateBlockOf(src);
    // Every button in the action row should carry the utility class.
    const confirm = tpl.match(/<button[^>]*data-testid="install-banner-confirm"[^>]*>/);
    const dismiss = tpl.match(/<button[^>]*data-testid="install-banner-dismiss"[^>]*>/);
    expect(confirm, 'install-banner-confirm button not found in template').not.toBe(null);
    expect(dismiss, 'install-banner-dismiss button not found in template').not.toBe(null);
    expect(confirm![0]).toMatch(/class="[^"]*\btap-target\b/);
    expect(dismiss![0]).toMatch(/class="[^"]*\btap-target\b/);
    // The legacy 36-px sizing on the local rule must be gone.
    const css = styleBlockOf(src);
    expect(css).not.toMatch(/min-width:\s*36px/);
    expect(css).not.toMatch(/min-height:\s*36px/);
  });

  test('UpdatePrompt.svelte action buttons opt into the .tap-target utility', () => {
    const src = read(UPDATE);
    const tpl = templateBlockOf(src);
    const confirm = tpl.match(/<button[^>]*data-testid="update-prompt-confirm"[^>]*>/);
    const later = tpl.match(/<button[^>]*data-testid="update-prompt-later"[^>]*>/);
    expect(confirm, 'update-prompt-confirm button not found in template').not.toBe(null);
    expect(later, 'update-prompt-later button not found in template').not.toBe(null);
    expect(confirm![0]).toMatch(/class="[^"]*\btap-target\b/);
    expect(later![0]).toMatch(/class="[^"]*\btap-target\b/);
    const css = styleBlockOf(src);
    expect(css).not.toMatch(/min-width:\s*36px/);
    expect(css).not.toMatch(/min-height:\s*36px/);
  });
});
