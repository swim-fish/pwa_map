// @vitest-environment node
//
// This spec dynamically imports vite.config.ts to assert the
// command-conditional `base`. Vite + esbuild require a real Node
// environment; jsdom's TextEncoder polyfill fails esbuild's
// `instanceof Uint8Array` invariant. The directive above keeps this
// single spec on Node while the rest of the integration suite stays
// on jsdom (configured globally in vite.config.ts's `test:` block).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 008 load-bearing safety net: assert that after `npm run
// build`, the manifest's `start_url` / `scope` / `id`, the URL prefix
// in `dist/index.html`'s asset hrefs, and the SW + icons all agree
// on the same base path. Tests are deliberately base-AGNOSTIC — they
// READ the prefix out of the emitted HTML and check internal
// consistency, so a future custom-domain migration that flips `base`
// back to `/` doesn't break the spec.

const DIST = resolve(process.cwd(), 'dist');
const MANIFEST_PATH = resolve(DIST, 'manifest.webmanifest');
const INDEX_PATH = resolve(DIST, 'index.html');
const SW_PATH = resolve(DIST, 'sw.js');

interface Manifest {
  readonly start_url?: string;
  readonly scope?: string;
  readonly id?: string;
  readonly icons?: ReadonlyArray<{ src?: string }>;
}

// Phase 2 cases (1)-(6) inspect post-build artefacts under dist/.
// On a fresh CI checkout `dist/` does not exist until `npm run
// build` runs, so those cases are SKIPPED (not failed) when the
// directory is missing. The deploy / CI workflows ALSO invoke
// this spec explicitly AFTER the build step
// (`npx vitest run tests/integration/deploy-base-alignment.spec.ts`),
// at which point `dist/` exists and all 8 cases run. That second
// invocation is the load-bearing gate; the `npm test` invocation
// below is the cheap pre-build pass that exercises the 2 pure
// import-and-call cases (7) and (8).
const distExists = existsSync(MANIFEST_PATH);

let manifest: Manifest | null = null;
let indexHtml = '';
let scriptSrc = '';
let basePrefix = '';

if (distExists) {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  indexHtml = readFileSync(INDEX_PATH, 'utf8');
  // First module-script src is what Vite emits for the entry bundle.
  const m = indexHtml.match(/<script[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/);
  if (m) {
    scriptSrc = m[1];
  }
  // Derive base prefix as everything up to and including the LAST `/`
  // before the assets segment. For Vite that's `${base}assets/...`.
  const idx = scriptSrc.indexOf('assets/');
  if (idx > 0) {
    basePrefix = scriptSrc.slice(0, idx);
  }
}

describe.skipIf(!distExists)('feature 008 — deploy-base alignment (built artifact)', () => {
  it('(1) dist/manifest.webmanifest exists', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
  });

  it('(2) manifest start_url === scope === id', () => {
    expect(manifest!.start_url).toBeDefined();
    expect(manifest!.scope).toBeDefined();
    expect(manifest!.id).toBeDefined();
    expect(manifest!.scope).toBe(manifest!.start_url);
    expect(manifest!.id).toBe(manifest!.start_url);
  });

  it('(3) manifest path equals base prefix Vite emits in index.html', () => {
    expect(scriptSrc).not.toBe('');
    expect(basePrefix).not.toBe('');
    // Manifest paths and the asset prefix must both start with the
    // same base. The manifest values are FULL paths (e.g.
    // `/pwa_map/`); the script src is `/pwa_map/assets/index-XXX.js`.
    // basePrefix derived above is `/pwa_map/`.
    expect(manifest!.start_url).toBe(basePrefix);
  });

  it('(4) dist/sw.js exists at exactly dist/sw.js (URL is `${base}sw.js`)', () => {
    expect(existsSync(SW_PATH)).toBe(true);
  });

  it('(5) dist/index.html does NOT contain a <base> tag', () => {
    // Be deliberately strict: any `<base ` or `<base>` in any case.
    expect(indexHtml).not.toMatch(/<base[\s>]/i);
  });

  it('(5b) every absolute href / src in dist/index.html starts with the base prefix', () => {
    // Catches the regression where index.html contained a hard-coded
    // `<link rel="manifest" href="/manifest.webmanifest">` that Vite
    // couldn't rewrite (the file is generated post-build, so Vite did
    // not see it as a known asset). Any absolute `/` path that does
    // NOT start with `${base}` would 404 under subpath publishing.
    const attrPaths = [...indexHtml.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
    const offending = attrPaths.filter((p) => !p.startsWith(basePrefix));
    expect(offending).toEqual([]);
  });

  it('(6) first manifest icon src resolves to a file under dist/ (relative or base-prefixed)', () => {
    expect(manifest!.icons?.length ?? 0).toBeGreaterThan(0);
    const firstIconSrc = manifest!.icons![0].src ?? '';
    expect(firstIconSrc).not.toBe('');
    // Two valid forms per W3C manifest spec:
    // - relative (e.g. "icons/icon.svg") — the browser resolves it
    //   against the manifest URL, which under subpath publishing is
    //   itself under the base prefix; OR
    // - absolute starting with the base prefix.
    // Both satisfy FR-010 because both yield a URL under base on
    // the served site. What MUST NOT happen: an absolute path
    // starting with `/` but NOT under the base prefix (that would
    // 404 at the deployed URL).
    const isRelative = !firstIconSrc.startsWith('/');
    const isAbsoluteUnderBase = firstIconSrc.startsWith(basePrefix);
    expect(isRelative || isAbsoluteUnderBase).toBe(true);
    // Sanity: the underlying file actually exists in dist/.
    const iconFs = isRelative
      ? resolve(DIST, firstIconSrc)
      : resolve(DIST, firstIconSrc.slice(basePrefix.length));
    expect(existsSync(iconFs)).toBe(true);
  });
});

describe('feature 008 — deploy-base alignment (config function form)', () => {
  it('(7) command=serve yields base /', async () => {
    const mod = (await import('../../vite.config')) as {
      default:
        | ((env: { command: 'serve' | 'build' }) => Promise<{ base: string }> | { base: string })
        | { base: string };
    };
    if (typeof mod.default !== 'function') {
      return expect.fail('vite.config.ts default export is not a function');
    }
    const cfg = await mod.default({ command: 'serve' });
    expect(cfg.base).toBe('/');
  });

  it('(8) command=build yields base /pwa_map/', async () => {
    const mod = (await import('../../vite.config')) as {
      default:
        | ((env: { command: 'serve' | 'build' }) => Promise<{ base: string }> | { base: string })
        | { base: string };
    };
    if (typeof mod.default !== 'function') {
      return expect.fail('vite.config.ts default export is not a function');
    }
    const cfg = await mod.default({ command: 'build' });
    expect(cfg.base).toBe('/pwa_map/');
  });
});
