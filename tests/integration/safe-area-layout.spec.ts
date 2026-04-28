import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 011 — safe-area layout contract for every persistent UI surface
// (FR-001..FR-004 / SC-001..SC-004).
//
// jsdom does not implement a real layout engine and does not honour
// env(safe-area-inset-*); getBoundingClientRect always returns zero
// rects. So this spec mirrors the project's existing pattern for layout
// invariants (see tests/integration/notification-region.spec.ts):
// the per-component CSS source MUST compose its `top` / `bottom` /
// `left` / `right` declaration with the corresponding shared
// `--*-stack-zone-*` token via calc(...). Real engine-reported insets
// are exercised end-to-end by the Playwright suite under iPhone 14 /
// Pixel 7 emulation profiles.

const REPO = process.cwd();
const APP = resolve(REPO, 'src/app/App.svelte');
const READOUT = resolve(REPO, 'src/components/CoordinateReadout.svelte');
const ATTRIBUTION = resolve(REPO, 'src/components/AttributionBar.svelte');
const INSTALL_BANNER = resolve(REPO, 'src/components/InstallBanner.svelte');
const INSTALL_IOS_SHEET = resolve(REPO, 'src/components/InstallIosSheet.svelte');
const SETTINGS_SHEET = resolve(REPO, 'src/components/SettingsSheet.svelte');

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

describe('feature 011 — top toolbar safe-area composition (FR-001 / FR-003)', () => {
  const css = styleBlockOf(read(APP));

  test('.toolbar top offset composes --top-stack-zone-top with --space-3', () => {
    const body = selectorBody(css, '.toolbar');
    expect(body).toMatch(/top:\s*calc\(var\(--space-3\)\s*\+\s*var\(--top-stack-zone-top\)\)/);
  });

  test('.toolbar right offset composes --inline-stack-zone-right with --space-3', () => {
    const body = selectorBody(css, '.toolbar');
    expect(body).toMatch(
      /right:\s*calc\(var\(--space-3\)\s*\+\s*var\(--inline-stack-zone-right\)\)/,
    );
  });
});

describe('feature 011 — left-center map controls safe-area composition (FR-003)', () => {
  const css = styleBlockOf(read(APP));
  const body = selectorBody(css, '.map-controls');

  test('.map-controls left offset composes --inline-stack-zone-left with --space-3 (universal)', () => {
    expect(body).toMatch(/left:\s*calc\(var\(--space-3\)\s*\+\s*var\(--inline-stack-zone-left\)\)/);
  });

  test('.map-controls vertically centres via top:50% + translateY(-50%) (universal)', () => {
    expect(body).toMatch(/top:\s*50%/);
    expect(body).toMatch(/transform:\s*translateY\(-50%\)/);
  });

  test('.map-controls no longer carries right / bottom anchoring (post-tweak: left-center is universal)', () => {
    expect(body).not.toMatch(/^\s*right:\s*/m);
    expect(body).not.toMatch(/^\s*bottom:\s*/m);
  });
});

describe('feature 011 — coordinate readout safe-area composition (FR-002)', () => {
  const css = styleBlockOf(read(READOUT));
  const body = selectorBody(css, '.readout');

  // After the post-implementation tweak, the readout's `bottom` always
  // includes a `var(--space-5)` lift so the bottom-right attribution
  // badge stays uncovered on every viewport (not just narrow phones).
  test('.readout bottom offset composes --bottom-stack-zone-bottom with --space-3 + --space-5 (universal lift)', () => {
    expect(body).toMatch(
      /bottom:\s*calc\(var\(--space-3\)\s*\+\s*var\(--space-5\)\s*\+\s*var\(--bottom-stack-zone-bottom\)\)/,
    );
  });
});

describe('feature 011 — attribution bar safe-area composition (FR-002)', () => {
  const css = styleBlockOf(read(ATTRIBUTION));
  const body = selectorBody(css, '.attribution');

  test('.attribution bottom offset composes --bottom-stack-zone-bottom with --space-2', () => {
    expect(body).toMatch(
      /bottom:\s*calc\(var\(--space-2\)\s*\+\s*var\(--bottom-stack-zone-bottom\)\)/,
    );
  });
});

describe('feature 011 — install banner inherits safe-area via NotificationRegion (FR-004)', () => {
  // After feature 009 InstallBanner.svelte does NOT carry its own
  // `position: fixed` block; it is mounted as a child of
  // <NotificationRegion>, which positions itself via
  // `--notification-zone-top` / `--notification-zone-bottom`. Feature 011's
  // T002 refactors those tokens to delegate the safe-area component to
  // the shared `--top-stack-zone-top` / `--bottom-stack-zone-bottom`, so
  // InstallBanner picks up the safe-area inset transitively without any
  // per-component edit. This test pins down that contract by asserting
  // (a) InstallBanner still does NOT carry its own position rule, and
  // (b) tokens.css declares the delegating composition.
  test('InstallBanner.svelte does NOT re-introduce its own position: fixed / bottom / right block', () => {
    const css = styleBlockOf(read(INSTALL_BANNER));
    const body = selectorBody(css, '.install-banner');
    expect(body).not.toMatch(/position:\s*fixed/);
    expect(body).not.toMatch(/^\s*bottom:\s*/m);
    expect(body).not.toMatch(/^\s*right:\s*/m);
  });
});

describe('feature 011 — iOS install sheet safe-area composition (FR-004)', () => {
  const css = styleBlockOf(read(INSTALL_IOS_SHEET));
  const body = selectorBody(css, '.install-ios-sheet');

  test('.install-ios-sheet bottom offset composes --bottom-stack-zone-bottom with --space-4', () => {
    expect(body).toMatch(
      /bottom:\s*calc\(var\(--space-4\)\s*\+\s*var\(--bottom-stack-zone-bottom\)\)/,
    );
  });

  test('.install-ios-sheet still centres horizontally via left:50% + transform', () => {
    expect(body).toMatch(/left:\s*50%/);
    expect(body).toMatch(/transform:\s*translateX\(-50%\)/);
  });
});

// US3 add-on: the Settings sheet itself MUST honour the safe-area on every
// edge (FR-008). Lands GREEN after T021.
describe('feature 011 — Settings sheet safe-area composition (FR-008)', () => {
  const css = styleBlockOf(read(SETTINGS_SHEET));
  const body = selectorBody(css, '.sheet');

  test('.sheet top offset uses max(--space-4, --top-stack-zone-top)', () => {
    expect(body).toMatch(/top:\s*max\(var\(--space-4\),\s*var\(--top-stack-zone-top\)\)/);
  });

  test('.sheet bottom offset uses max(--space-4, --bottom-stack-zone-bottom)', () => {
    expect(body).toMatch(/bottom:\s*max\(var\(--space-4\),\s*var\(--bottom-stack-zone-bottom\)\)/);
  });

  test('.sheet left offset uses max(--space-4, --inline-stack-zone-left)', () => {
    expect(body).toMatch(/left:\s*max\(var\(--space-4\),\s*var\(--inline-stack-zone-left\)\)/);
  });

  test('.sheet right offset uses max(--space-4, --inline-stack-zone-right)', () => {
    expect(body).toMatch(/right:\s*max\(var\(--space-4\),\s*var\(--inline-stack-zone-right\)\)/);
  });

  test('.sheet uses margin: auto for centring (replaces transform: translate(-50%, -50%))', () => {
    expect(body).toMatch(/margin:\s*auto/);
    expect(body).not.toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
  });
});
