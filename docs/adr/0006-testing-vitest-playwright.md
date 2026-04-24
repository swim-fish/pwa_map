# ADR 0006 — Testing: Vitest for unit, Playwright for E2E

**Status**: Accepted
**Date**: 2026-04-24

## Context

Constitution Principle II requires TDD with every converter driven by
reference test vectors (tolerances from `contracts/test-vectors.md §5`),
plus PWA-level acceptance scenarios (offline, install, pan @ ≥ 10 Hz).

## Decision

- **Vitest 2** for unit + contract tests. Uses `jsdom` env, globals on,
  Svelte preprocess via Vite config.
- **Vitest benchmarks** (`bench/coord.bench.ts`) for single-conversion
  time budget.
- **Playwright 1.48** for E2E. One spec per user story
  (`tests/e2e/story-*.spec.ts`). Three projects configured (chromium,
  firefox, webkit) — chromium is the default local run; firefox/webkit
  are CI-required.
- Custom matcher `expectWithinTolerance` with units `m | deg | arcsec | cell`.
- Pinned SHA-256 digest of `test-vectors.json` in
  `tests/unit/fixtures/vectors-digest.txt`; drift spec fails on mismatch.

## Consequences

- Every converter passes 100 % of its applicable vectors.
- Service-worker / offline scenarios verified in real browsers, not
  mocked.

## Alternatives considered

- **Jest + jsdom** — slower, manual TS / Svelte wiring.
- **Cypress** — multi-browser story weaker than Playwright.
