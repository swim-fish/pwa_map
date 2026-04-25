# ADR 0005 — Build tooling: Vite 5 + vite-plugin-pwa

**Status**: Accepted
**Date**: 2026-04-24

## Context

Need a Svelte + TS dev server with HMR, production minification, and
PWA manifest + service-worker generation (FR-012, SC-006 offline).

## Decision

- **Vite 5** with `@sveltejs/vite-plugin-svelte`.
- **`vite-plugin-pwa` 0.20** (Workbox under the hood) for manifest +
  SW registration.
- `build.rollupOptions.output.manualChunks.maplibre = ['maplibre-gl']`
  splits MapLibre off from the entry chunk so the 200 KB initial-load
  budget stays met.
- Post-build guard: `scripts/check-bundle-size.js` separates the entry
  bundle (budget 200 KB) from async chunks (per-chunk budget 250 KB).

## Consequences

- First build scaffolded manually (the `npm create vite` interactive
  prompt would overwrite `.specify/`, `.claude/`, `CLAUDE.md`); this
  ADR records that we re-created every file Vite's Svelte-TS template
  would produce, one-to-one.
- `import.meta.glob` hot-reloads `test-vectors.json` during test
  authoring.

## Alternatives considered

- **Webpack + svelte-loader** — slower, no PWA default.
- **esbuild / rspack** — faster but thinner PWA plugin ecosystem.
- **Parcel** — Svelte first-class support lags.
