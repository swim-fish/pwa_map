# ADR 0015 — Release readiness: feature `001-coord-map-pwa`

**Status**: Accepted
**Date**: 2026-04-24
**Feature**: `001-coord-map-pwa`

## Context

Per `specs/001-coord-map-pwa/quickstart.md §7`, every task is "done"
only after the full review loop — format, lint, typecheck, unit +
integration, E2E, bundle-size, UI / ADR docs. This ADR records the
evidence that the loop was green at feature close.

## Decision

`001-coord-map-pwa` is declared release-ready against the US1 / US2 /
US3 / US4 scope documented in `spec.md` and `plan.md`.

## Evidence

- **Format** — `npm run format` clean (no files changed on re-run after
  the final author pass).
- **Lint** — `npm run lint` (`eslint . --max-warnings 0`) zero errors,
  zero warnings.
- **Typecheck** — `svelte-check --tsconfig ./tsconfig.json` zero errors,
  zero warnings over 341 files.
- **Unit + contract** — `npm test` (Vitest 2.1): 126 tests passed
  across 9 spec files.
  - `tests/unit/fixtures/vectors-digest.spec.ts` (1)
  - `tests/unit/coord/wgs84.spec.ts` (18)
  - `tests/unit/coord/zone.spec.ts` (4)
  - `tests/unit/coord/twd97.spec.ts` (27)
  - `tests/unit/coord/twd67.spec.ts` (12)
  - `tests/unit/coord/mgrs.spec.ts` (17)
  - `tests/unit/coord/taipower.spec.ts` (15)
  - `tests/unit/coord/parser.spec.ts` (26)
  - `tests/unit/components/copy.spec.ts` (3)
  - Plus 3 copy tests (above).
- **E2E (chromium)** — `npm run test:e2e --project=chromium`
  15 tests passed:
  - `story-1-crosshair-readout.spec.ts` (3)
  - `story-2-multi-format.spec.ts` (5)
  - `story-3-go-to.spec.ts` (5)
  - `story-4-copy.spec.ts` (2)
- **Bundle size** — `npm run build` + `node scripts/check-bundle-size.js`:
  - Entry JS gzipped 64.87 KB / budget 200 KB ✓
  - CSS gzipped 10.64 KB / budget 20 KB ✓
  - `maplibre` async chunk 203.16 KB / per-chunk budget 250 KB ✓
  - `workbox-window` chunk 2.34 KB ✓
- **Docs** — `docs/ui/0001-coord-map-layout.md` covers US1 + US2 + US3
  - US4 layout; `docs/adr/` holds 15 ADRs (0001–0015) with updated
    `docs/adr/README.md` index.
- **Test vectors** — pinned digest
  `6358a31d0772d00dbf96945f427c4dee3cdd2e01dd9615b9e2b8321f5e50721c`
  matches `tests/unit/fixtures/test-vectors.json` (v2.0.0, MIT,
  generated 2026-04-24).

## Deferred items (explicit)

These were identified but deliberately pushed out; they do not block
release of the MVP + US2–US4 scope:

- **ADR 0013 — Lighthouse CI workflow** — no GitHub Actions workflow is
  in this repo yet. When CI is provisioned, a `.github/workflows/
lighthouse.yml` (and matching ADR amendment) will add the
  PWA ≥ 90 / TTI ≤ 3 s assertions.
- **ADR 0013 — Vitest benchmark suite** (`bench/coord.bench.ts`) — the
  ≤ 1 ms per-conversion budget is not yet asserted in CI. The
  existing 119 vector-driven coord unit tests give strong signal on
  correctness; a bench suite is follow-up work.
- **ADR 0013 — Dedicated perf-pan E2E probe** — `story-1.AS3` already
  exercises the 10 Hz pan, but a dedicated Playwright probe with FPS
  sampling is deferred.
- **Playwright firefox + webkit projects** — configured in
  `playwright.config.ts` but only the chromium project was exercised
  locally. Cross-browser runs are part of CI onboarding.
- **Taipower Y / Z anchors** (ADR 0012) — will become a separate
  feature + ADR if outer-island support is scoped.

## Consequences

- The MVP + US2–US4 scope is shippable now against Constitution
  Principles I–V.
- The deferred items above are tracked here so they are not forgotten
  and so reviewers can see the gap between the pinned Performance
  Verification Pipeline (ADR 0013) and current enforcement.

## Alternatives considered

- **Block release on full perf-pipeline automation** — would push
  shipping beyond the MVP gate for no incremental correctness value.
  Rejected.
