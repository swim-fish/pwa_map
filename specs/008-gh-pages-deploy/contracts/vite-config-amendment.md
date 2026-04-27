# Contract: `vite.config.ts` — function-form amendment for env-conditional base path

**File**: `vite.config.ts` (AMENDED, in place)
**Verifies**: spec FR-010, FR-011, FR-018, FR-019, SC-006, SC-007;
research D2, D6.

## §1. Required exports

The default export changes from a static config object to a
function that takes `{ command }` and returns the config. The new
return value MUST set `base`, `manifest.start_url`, `manifest.scope`,
and `manifest.id` to the same value, conditional on `command`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { devManifestPlugin } from './src/pwa/devManifestPlugin';
import {
  TILE_CACHE_MAX_AGE_DAYS_CEILING,
  TILE_CACHE_MAX_ENTRIES_CEILING,
} from './src/pwa/cachePolicy';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const TILE_MAX_AGE_SECONDS = TILE_CACHE_MAX_AGE_DAYS_CEILING * 60 * 60 * 24;

const PROD_BASE = '/pwa_map/' as const;
const DEV_BASE = '/' as const;

// `manifestBase` does NOT contain start_url / scope / id — those
// three are set per-build inside the function body so they cannot
// drift from `base`.
const manifestBase = {
  name: 'Taiwan Coordinate Map',
  short_name: 'CoordMap',
  description:
    'A Taiwan-covering PWA that shows a crosshair reticle with live multi-format coordinate readout.',
  theme_color: '#0f172a',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  icons: [
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
} as const;

export default defineConfig(({ command }) => {
  const base = command === 'build' ? PROD_BASE : DEV_BASE;
  const manifest = {
    ...manifestBase,
    start_url: base,
    scope: base,
    id: base,
  };
  return {
    base,
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          runtimeCaching: [
            // ... three blocks unchanged from feature 007:
            // osm-tiles / nlsc-tiles / google-tiles, all using
            // TILE_CACHE_MAX_ENTRIES_CEILING and TILE_MAX_AGE_SECONDS
          ],
        },
        devOptions: { enabled: false },
      }),
      devManifestPlugin(manifest),
    ],
    resolve: { /* unchanged: $app, $coord, ..., $storage, $types */ },
    build: { /* unchanged */ },
    test: { /* unchanged */ },
  };
});
```

## §2. Behaviour matrix

| `command` | Trigger                                | `base`        | `manifest.start_url / scope / id` |
| --------- | -------------------------------------- | ------------- | --------------------------------- |
| `'serve'` | `npm run dev`                          | `'/'`         | `'/'`                             |
| `'build'` | `npm run build`                        | `'/pwa_map/'` | `'/pwa_map/'`                     |
| `'build'` | `npm run preview` (serves `dist/`)     | `'/pwa_map/'` | `'/pwa_map/'`                     |

The `npm run preview` row is the documented behaviour change
(FR-018 + UI doc 0008): previewing locally now serves at
`http://localhost:4173/pwa_map/` instead of `http://localhost:4173/`.
This is intentional — preview should mirror production.

## §3. Invariants

- `base` is always exactly one of the two literal strings `'/' |
  '/pwa_map/'`. No template strings, no env-var pulls.
- `manifest.start_url === manifest.scope === manifest.id === base`
  in every config branch.
- `manifestBase` does NOT contain `start_url` / `scope` / `id` —
  those three are set ONLY in the function body.
- The icon paths in `manifestBase.icons` are RELATIVE
  (`'icons/icon.svg'`, no leading slash). Vite's PWA plugin
  resolves them against `base`, so they emit as
  `'/pwa_map/icons/icon.svg'` in production and `'/icons/icon.svg'`
  in dev.
- `devManifestPlugin` receives the same `manifest` object the PWA
  plugin does, so the dev-time manifest served by
  `src/pwa/devManifestPlugin.ts` agrees with the dev `base`.
- The runtime-caching block (osm-tiles / nlsc-tiles / google-tiles)
  is UNCHANGED from feature 007 — same URL patterns, same
  `TILE_CACHE_MAX_ENTRIES_CEILING` (8192), same `TILE_MAX_AGE_SECONDS`
  (90 days).

## §4. What this amendment MUST NOT do

- MUST NOT change `import.meta.env.BASE_URL` lookups in `src/`
  (the runtime can keep reading `import.meta.env.BASE_URL`; Vite
  populates it from `base` automatically).
- MUST NOT add `<base href>` to `index.html`.
- MUST NOT introduce a new env var the developer must set.
- MUST NOT touch `src/pwa/registerSW.ts` (research D7 — SW scope
  auto-derives correctly from the script URL).
- MUST NOT modify the runtime cache rules from feature 007.

## §5. Required tests

`tests/integration/deploy-base-alignment.spec.ts` MUST cover, after
running `npm run build` (the spec is gated on `dist/` existing):

1. **Manifest exists at `dist/manifest.webmanifest`**.
2. **Manifest's `start_url` === `scope` === `id`** — three-way
   equality, regardless of the actual value.
3. **The common manifest path === Vite's emitted base** — read
   `dist/index.html`'s first `<script type="module" src="...">` `src`
   attribute; assert it starts with the same prefix.
4. **`dist/sw.js` exists** at exactly `dist/sw.js` (NOT
   `dist/pwa_map/sw.js` — the file is at the dist root; Vite emits
   asset URLs with the base prefix but the artifact's own
   directory layout is base-agnostic).
5. **No `<base>` tag in `dist/index.html`** (research D9
   anti-regression).
6. **Manifest icons emit with the base prefix** — read the first
   icon's `src` from `dist/manifest.webmanifest`; assert it starts
   with the same prefix as cases (3).
7. **In dev mode (`command === 'serve'`), the resolved config uses
   `base: '/'`** — exercised by importing the config file's
   default export and calling it with `{ command: 'serve' }`.
8. **In build mode (`command === 'build'`), the resolved config
   uses `base: '/pwa_map/'`** — same import, called with
   `{ command: 'build' }`.

Cases (1)–(6) require a built `dist/` to inspect; they run after
the workflow's `npm run build` step OR after the developer runs
`npm run build` locally. Cases (7)–(8) are pure import-and-call,
no `dist/` needed.
