/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { devManifestPlugin } from './src/pwa/devManifestPlugin';
import {
  TILE_CACHE_MAX_AGE_DAYS_CEILING,
  TILE_CACHE_MAX_ENTRIES_CEILING,
} from './src/pwa/cachePolicy';

const TILE_MAX_AGE_SECONDS = TILE_CACHE_MAX_AGE_DAYS_CEILING * 60 * 60 * 24;

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// Subpath publishing under https://swim-fish.github.io/pwa_map/.
// `base` is conditional on Vite's `command` AND `mode`:
// - dev server (`npm run dev`) → `/` (unchanged).
// - production build (`npm run build`, default mode `production`) →
//   `/pwa_map/`. Used by GH Pages deploy and every CI workflow.
// - local-preview build (`npm run build:local` / `preview:local`,
//   triggered by `vite build --mode local-preview`) → `/`, so the
//   built
//   bundle can be served from `http://localhost:4173/` without the
//   `/pwa_map/` subpath. Local-preview builds are NOT for deploy:
//   the manifest's start_url / scope / id will also be `/`, which
//   GH Pages would reject. Always re-run `npm run build` before
//   `npm run deploy:check` after using a local-preview build.
// Research D2 / D6 / D7.
const PROD_BASE = '/pwa_map/' as const;
const LOCAL_PREVIEW_BASE = '/' as const;
const DEV_BASE = '/' as const;

// `manifestBase` does NOT contain start_url / scope / id — those
// three are set per-build inside the function body so they cannot
// drift from `base`. Icon srcs are relative; Vite's PWA plugin
// resolves them against `base` at build time.
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

export default defineConfig(({ command, mode }) => {
  const base =
    command === 'build' ? (mode === 'local-preview' ? LOCAL_PREVIEW_BASE : PROD_BASE) : DEV_BASE;
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
            {
              urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: TILE_CACHE_MAX_ENTRIES_CEILING,
                  maxAgeSeconds: TILE_MAX_AGE_SECONDS,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/wmts\.nlsc\.gov\.tw\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'nlsc-tiles',
                expiration: {
                  maxEntries: TILE_CACHE_MAX_ENTRIES_CEILING,
                  maxAgeSeconds: TILE_MAX_AGE_SECONDS,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/mt\d?\.google\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-tiles',
                expiration: {
                  maxEntries: TILE_CACHE_MAX_ENTRIES_CEILING,
                  maxAgeSeconds: TILE_MAX_AGE_SECONDS,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
      devManifestPlugin(manifest),
    ],
    resolve: {
      alias: {
        $app: r('./src/app'),
        $coord: r('./src/coord'),
        $components: r('./src/components'),
        $i18n: r('./src/i18n'),
        $map: r('./src/map'),
        $pwa: r('./src/pwa'),
        $storage: r('./src/storage'),
        $types: r('./src/types'),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: false,
      sourcemap: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            maplibre: ['maplibre-gl'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.ts'],
      setupFiles: ['tests/unit/helpers/setup.ts'],
      // The deploy-base spec needs `// @vitest-environment node` and
      // dynamically `await import('vite.config.ts')`. Under jsdom-pool
      // contention (60+ files in the same worker pool), vite-node's
      // esbuild transformer queues behind the rest of the suite and
      // the dynamic import can exceed the 5 s default testTimeout.
      // Route that spec to the `forks` pool and run it in its OWN
      // dedicated fork (singleFork) so it never races with the rest
      // of the suite. Single-file runs (`deploy:check` / standalone)
      // are unaffected.
      poolMatchGlobs: [['tests/integration/deploy-base-alignment.spec.ts', 'forks']],
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
      benchmark: {
        include: ['bench/**/*.bench.ts'],
      },
    },
  };
});
