# ADR 0001 — UI framework: Svelte 4.x

**Status**: Accepted
**Date**: 2026-04-24
**Feature**: `001-coord-map-pwa`
**Supersedes**: —

## Context

A TypeScript PWA with a bundle budget of ≤ 200 KB gzipped (initial load),
≤ 10 Hz readout refresh during map pan, and a small component surface
(~6 components). Framework cost — runtime, reactivity, TS ergonomics —
must be tiny.

## Decision

Use **Svelte 4.x** (with `@sveltejs/vite-plugin-svelte`, **not** SvelteKit).

## Consequences

- Compiled output; no runtime framework payload. Fits the JS budget
  even after MapLibre joins (MapLibre is code-split; see ADR 0005).
- Reactive stores + `$:` auto-subscription fan out one `WGS84DD` to N
  readout rows without hand-wired observers.
- Single-file `.svelte` components keep the 6-component surface flat.
- No SvelteKit means no router, SSR, or endpoints — but this product
  doesn't need any of those (FR-012 PWA-only, no server).

## Alternatives considered

- **Preact** (~10 KB runtime) — reactive story weaker than Svelte; JSX
  adds a second parser.
- **Lit / Web Components** — verbose reactive glue for derived state.
- **Vanilla TS + custom reactivity** — re-implementing Svelte badly.
- **React (~45 KB baseline)** — overshoots bundle before any product code.
- **SvelteKit** — router / SSR / endpoints we don't need; violates
  "don't design for hypothetical future requirements".
