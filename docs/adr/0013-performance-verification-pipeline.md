# ADR 0013 — Performance verification pipeline

**Status**: Accepted (partial; Lighthouse CI + benchmark suite deferred
to a follow-up feature)
**Date**: 2026-04-24

## Context

Principle IV requires explicit budgets + CI-enforceable verification.
Performance Goals declared in `plan.md`: ≤ 200 KB initial JS gzipped,
≤ 20 KB initial CSS gzipped, pan → readout update ≤ 100 ms,
≥ 10 Hz readout during pan, ≤ 1 ms per coordinate conversion,
Lighthouse PWA ≥ 90, first-paint ≤ 3 s over 10 Mbps / ≤ 1 s on repeat
visit.

## Decision

- **Bundle size** (CI gate): `scripts/check-bundle-size.js` runs after
  `npm run build`. Separates the entry bundle from async chunks.
  Entry budget 200 KB gzipped, async per-chunk budget 250 KB, CSS 20 KB.
  Deferred chunk prefixes: `maplibre`, `workbox-window`.
- **Pan-readout perf** (E2E gate): `tests/e2e/story-1-crosshair-readout.spec.ts`
  AS3 scripted pan over 1 s samples readout text at ~11 Hz polling and
  asserts ≥ 3 unique readings observed. This is a coarse proxy for the
  full ≥ 10 Hz budget; a dedicated Playwright perf probe
  (`tests/e2e/perf-pan.spec.ts`) is **deferred** to a follow-up.
- **Per-conversion time** (benchmark): Vitest bench suite
  (`bench/coord.bench.ts`) is **deferred** — not required for the
  correctness gate and can be added when an incident motivates it.
- **Lighthouse CI**: **deferred** — no GitHub Actions workflow in the
  repo yet. To be added in a follow-up (`0013` will be amended) once
  CI is provisioned.

## Consequences

- Bundle budget is actively enforced today; regressions fail the
  build script.
- Perf-budget (Lighthouse, benchmark) enforcement is tracked as
  follow-up debt documented here so it is not forgotten.

## Alternatives considered

- **Manual profiling only** — violates Principle IV. Rejected.
