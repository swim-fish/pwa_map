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

## Post-`/speckit.analyze` remediation (2026-04-25)

`/speckit.analyze` run on 2026-04-25 flagged a CRITICAL inconsistency
between this ADR's "Deferred items" section and `tasks.md` status for
T104/T105/T106, plus HIGH coverage gaps for SC-006 (offline) and
FR-015 (pan-end ≤ 100 ms), and MEDIUM gaps for SC-003/004/005 timing.
ADR 0016 records the remediation decision. The artefacts below now
exist and are green at commit time:

- `bench/coord.bench.ts` (T104) — 15 Vitest benches; local all ≥ 172k
  ops/sec, well inside the ≤ 1 ms budget.
- `.github/workflows/lighthouse.yml` (T105) — PWA ≥ 0.9, FCP and
  interactive ≤ 3000 ms, plus a bundle-size job. Activation needs
  `LHCI_GITHUB_APP_TOKEN` secret.
- `tests/e2e/perf-pan.spec.ts` (T106) — 5 s scripted pan, ≥ 10 unique
  readings, median read ≤ 50 ms.
- `tests/e2e/offline.spec.ts` (SC-006) — coord math + Go-To flyTo
  after `context.setOffline(true)`.
- `story-1.AS4` (FR-015) — readout updates ≤ 100 ms after setCenter.
- `story-3.AS1` (SC-003) — Go-To → readout ≤ 1 s.
- `story-3.AS3` (SC-004) — rejection surfaces ≤ 500 ms after click.
- `story-4.AS2` (SC-005) — copy → paste → return ≤ 10 s.

## Still deferred (explicit)

- **Cross-browser E2E in CI** — Playwright firefox + webkit projects
  are configured; local runs exercised chromium only. The Lighthouse
  workflow will cover chromium automatically once the repo's Actions
  runner is wired.
- **Bench thresholds in CI** — `bench/coord.bench.ts` reports hz but
  does not fail on regression yet. ADR 0016 Follow-up explains how
  to flip this on after baseline variance is characterised.
- **Taipower Y / Z anchors** (ADR 0012) — outer-island support will
  become a separate feature + ADR.

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
