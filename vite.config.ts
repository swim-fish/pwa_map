/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { devManifestPlugin } from './src/pwa/devManifestPlugin';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const manifest = {
  name: 'Taiwan Coordinate Map',
  short_name: 'CoordMap',
  description:
    'A Taiwan-covering PWA that shows a crosshair reticle with live multi-format coordinate readout.',
  theme_color: '#0f172a',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  start_url: '/',
  scope: '/',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} as const;

export default defineConfig({
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
                maxEntries: 4096,
                maxAgeSeconds: 60 * 60 * 24 * 7,
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
                maxEntries: 4096,
                maxAgeSeconds: 60 * 60 * 24 * 7,
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
                maxEntries: 4096,
                maxAgeSeconds: 60 * 60 * 24 * 7,
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
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
