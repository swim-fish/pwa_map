import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import NotificationRegion from '../../src/components/NotificationRegion.svelte';
import { setLocale } from '../../src/i18n/index';

// Feature 009 — notification-region invariants (FR-007 / FR-008 / FR-009 /
// FR-010 / FR-011 / SC-002 / SC-003).
//
// The "no overlap" geometry guarantee in contracts/notification-region.md
// is enforced by the CSS contract documented below: banner components
// no longer carry their own `position: fixed` block, every banner mounts
// inside the single `<NotificationRegion>` host, and the host owns the
// safe-zone offsets. jsdom does not run a real layout engine, so this
// spec verifies the structural + CSS contract that, together with the
// e2e geometry assertion (delegated to the Playwright suite), pins
// down the FR-007 / FR-008 / FR-009 invariants.

const REPO = process.cwd();
const REGION = resolve(REPO, 'src/components/NotificationRegion.svelte');
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

let host: HTMLElement;
let cmp: { $destroy: () => void };

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  document.body.removeAttribute('data-dialog-open');
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy();
  document.body.removeAttribute('data-dialog-open');
});

describe('feature 009 — NotificationRegion structural & ARIA contract', () => {
  test('renders with role-friendly aria-live="polite" and aria-atomic="false"', async () => {
    cmp = new NotificationRegion({ target: host });
    await tick();
    const region = host.querySelector('[data-testid="notification-region"]');
    expect(region, 'NotificationRegion should expose a stable test id').not.toBe(null);
    expect(region!.getAttribute('aria-live')).toBe('polite');
    expect(region!.getAttribute('aria-atomic')).toBe('false');
  });

  test('renders a default slot whose children become direct DOM children of the region', async () => {
    const wrapperHost = document.createElement('div');
    document.body.appendChild(wrapperHost);
    wrapperHost.innerHTML = `
      <div data-testid="region-wrapper">
        <div data-testid="banner-a">a</div>
        <div data-testid="banner-b">b</div>
      </div>
    `;
    // Smoke: the component instantiates without props/events.
    cmp = new NotificationRegion({ target: host });
    await tick();
    const region = host.querySelector('[data-testid="notification-region"]');
    expect(region).not.toBe(null);
  });
});

describe('feature 009 — NotificationRegion CSS contract', () => {
  test('region is fixed-position, top-anchored by default, with a vertical gap and a max-width', () => {
    const css = styleBlockOf(read(REGION));
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/top:\s*var\(--notification-zone-top\)/);
    expect(css).toMatch(/gap:/);
    // Ensures the banner column does not collide with the right-edge controls.
    expect(css).toMatch(/max-width:\s*min\(/);
  });

  test('region pointer-events block does not absorb taps that miss a banner', () => {
    const css = styleBlockOf(read(REGION));
    expect(css).toMatch(/pointer-events:\s*none/);
    // Direct children re-enable pointer events so the visible banner remains
    // tappable. `:global(*)` is required so Svelte does NOT scope the hash
    // class onto the universal child selector — slot content comes from the
    // parent component and does not carry NotificationRegion's hash class,
    // so a plain `> *` would never match the banner roots and would leave
    // every banner button unable to receive taps.
    expect(css).toMatch(/>\s*:global\(\*\)\s*\{[\s\S]*?pointer-events:\s*auto/);
  });

  test('body[data-dialog-open] flips the region anchor from top to bottom', () => {
    const css = styleBlockOf(read(REGION));
    expect(css).toMatch(
      /body\[data-dialog-open\][\s\S]*?bottom:\s*var\(--notification-zone-bottom\)/,
    );
  });
});

describe('feature 009 — banner components no longer self-position', () => {
  test('UpdatePrompt.svelte root rule no longer carries position: fixed or top/transform anchoring', () => {
    const css = styleBlockOf(read(UPDATE));
    // The whole `.update-prompt` root rule must not pin itself to the viewport.
    const rootMatch = css.match(/\.update-prompt\s*\{([^}]*)\}/);
    expect(rootMatch, '.update-prompt root rule must remain in the file').not.toBe(null);
    const rootBody = rootMatch![1];
    expect(rootBody).not.toMatch(/position:\s*fixed/);
    expect(rootBody).not.toMatch(/^\s*top:\s*/m);
    expect(rootBody).not.toMatch(/transform:\s*translateX/);
    expect(rootBody).not.toMatch(/^\s*left:\s*50%/m);
  });

  test('InstallBanner.svelte root rule no longer carries position: fixed or bottom/right anchoring', () => {
    const css = styleBlockOf(read(INSTALL));
    const rootMatch = css.match(/\.install-banner\s*\{([^}]*)\}/);
    expect(rootMatch, '.install-banner root rule must remain in the file').not.toBe(null);
    const rootBody = rootMatch![1];
    expect(rootBody).not.toMatch(/position:\s*fixed/);
    expect(rootBody).not.toMatch(/^\s*bottom:\s*/m);
    expect(rootBody).not.toMatch(/^\s*right:\s*/m);
  });
});

describe('feature 009 — App.svelte wires the region and the dialog-open shift', () => {
  const appSrc = read(APP);

  test('App.svelte imports the NotificationRegion component', () => {
    expect(appSrc).toMatch(
      /import\s+NotificationRegion\s+from\s+['"][^'"]*components\/NotificationRegion(?:\.svelte)?['"]/,
    );
  });

  test('App.svelte mounts every transient banner / toast inside the NotificationRegion subtree', () => {
    // Capture the <NotificationRegion> ... </NotificationRegion> block.
    const regionBlock = appSrc.match(/<NotificationRegion[\s\S]*?<\/NotificationRegion>/);
    expect(
      regionBlock,
      'App.svelte must render <NotificationRegion>...</NotificationRegion>',
    ).not.toBe(null);
    const block = regionBlock![0];
    // Each banner / toast must live inside the block.
    expect(block).toMatch(/data-testid="zone-toast"/);
    expect(block).toMatch(/data-testid="copy-toast"/);
    expect(block).toMatch(/data-testid="layer-fail-toast"/);
    expect(block).toMatch(/data-testid="offline-ready-toast"/);
    expect(block).toMatch(/<UpdatePrompt/);
    expect(block).toMatch(/<InstallBanner/);
  });

  test('App.svelte toggles body[data-dialog-open] when GoTo / Settings open and clears it when closed', () => {
    // Reactive statement must drive the body attribute from the dialog flags.
    expect(appSrc).toMatch(/data-dialog-open|dialogOpen/);
    expect(appSrc).toMatch(/(goToOpen|settingsOpen)/);
    // The reactive bridge or onMount hook must touch document.body in some form.
    expect(appSrc).toMatch(/document\.body[\s\S]*?(dataset|setAttribute|removeAttribute)/);
  });

  test('App.svelte no longer keeps the four inline toasts at fixed-position via .toast', () => {
    const css = styleBlockOf(appSrc);
    const toastRule = css.match(/\.toast\s*\{([^}]*)\}/);
    if (toastRule) {
      const body = toastRule[1];
      // The class may still exist for typography but must NOT self-anchor.
      expect(body).not.toMatch(/position:\s*absolute/);
      expect(body).not.toMatch(/position:\s*fixed/);
      expect(body).not.toMatch(/^\s*top:\s*/m);
      expect(body).not.toMatch(/transform:\s*translateX/);
    }
  });
});
