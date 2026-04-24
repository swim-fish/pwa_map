# ADR 0016 — Analyze-driven verification hardening

**Status**: Accepted
**Date**: 2026-04-25
**Feature**: `001-coord-map-pwa`
**Relates to**: ADR 0013 (performance verification), ADR 0014 (a11y),
ADR 0015 (release readiness)

## Context

`/speckit.analyze` run on 2026-04-25 after the US1–US4 implementation
commit reported a **CRITICAL inconsistency** (I1) between `tasks.md`
task statuses and ADR 0015's Deferred Items section: tasks T104
(bench), T105 (Lighthouse CI), T106 (perf-pan probe) were marked `[x]`
while ADR 0015 explicitly listed them as deferred with no corresponding
files. The same run flagged two HIGH coverage gaps (C1: no offline
E2E for SC-006; C2: no pan-end ≤ 100 ms latency test for FR-015) and
three MEDIUM gaps (C3: missing explicit timing assertions for
SC-003 / SC-004 / SC-005).

Per Constitution Principle V, the ADR index must be updated after
every `/speckit.analyze` run — either by adding new ADRs for decisions
the run produced, or by confirming no architectural change occurred.
The tasks↔ADR inconsistency plus the coverage gaps warrant a decision,
not just a note.

## Decision

Resolve the `/speckit.analyze` findings by **building the missing
verification artefacts** rather than by narrowing the spec or marking
more items deferred. Specifically:

1. **`bench/coord.bench.ts`** — Vitest benchmark suite covering every
   converter + parser dispatch. Budget is the plan.md Performance Goal
   `≤ 1 ms per conversion`; local measurement shows all converters
   run at ≥ 172k ops/sec (~0.006 ms) and parser dispatch at 96k–997k
   ops/sec. Adopting the bench makes future regressions visible
   immediately. CI gating on bench thresholds is a follow-up (see
   `## Follow-up` below).

2. **`.github/workflows/lighthouse.yml`** — GitHub Actions workflow
   that builds + previews + runs `lhci autorun` on every PR into
   `main` and push to `001-coord-map-pwa`. Asserts PWA category at
   least 0.9, `first-contentful-paint` and `interactive` medians at
   most 3000 ms. Also runs the `scripts/check-bundle-size.js` gate.
   Activation needs the `LHCI_GITHUB_APP_TOKEN` repo secret.

3. **`tests/e2e/perf-pan.spec.ts`** — Playwright probe that drives a
   5-second scripted pan and asserts ≥ 10 unique readout values + a
   median innerText round-trip ≤ 50 ms. This is a coarser check than
   the US1 AS3 sampling assertion but at higher volume, so a
   regression in the render path surfaces earlier.

4. **`tests/e2e/offline.spec.ts`** — two Playwright tests backing
   SC-006:
   - After `context.setOffline(true)`, panning produces updated
     WGS84 / TWD97 / MGRS / Taipower readouts.
   - After `context.setOffline(true)`, Go-To parses an MGRS string
     and flies the map to the target, readout confirming.

5. **Timing assertions added to existing story specs**:
   - `story-1.AS4` — readout updates within 100 ms of
     `setCenter` (FR-015).
   - `story-3.AS1` — Go-To → readout update ≤ 1 s (SC-003).
   - `story-3.AS3` — Rejection surfaces ≤ 500 ms (SC-004).
   - `story-4.AS2` — copy → paste → return ≤ 10 s (SC-005).

6. **`tasks.md` T104/T105/T106 descriptions rewritten** to reflect the
   actual deliverables rather than a generic "author X". ADR 0015
   Deferred-items section rewritten to remove the three now-landed
   items and cross-reference this ADR; Still-deferred section
   narrowed to cross-browser CI (firefox / webkit on CI) and Taipower
   Y/Z.

7. **`plan.md` §Project Structure** — removed the planned-but-never-
   created `src/pwa/manifest.ts`; manifest lives inline in the
   `VitePWA({ manifest })` block in `vite.config.ts`.

## Consequences

- All spec.md Success Criteria now have an executable gate (correctness
  via unit tests, timing via story-1 AS4 + story-3 AS1/AS3 + story-4
  AS2, pan refresh via perf-pan.spec + story-1 AS3, offline via
  offline.spec, Lighthouse via workflow).
- tasks.md ≡ ADR 0015 ≡ on-disk artefacts at the feature-close
  boundary. Future readers can trust either source of truth.
- Adds ~400 lines of test / workflow / bench code, no production-code
  changes, zero bundle impact.

## Follow-up

- **CI-enforced bench thresholds** — currently the bench suite reports
  hz numbers but does not fail on regression. A future ADR can flip
  Vitest bench's `assert` option on once baseline variance is
  characterised across CI hardware.
- **Cross-browser CI** — the Lighthouse workflow handles chromium.
  Extending Playwright E2E to firefox + webkit in CI is a small
  follow-up; locally the config already supports all three.
- **Real-device perf** — the ≥ 10 Hz budget (SC-007) is conservatively
  verified on desktop Chromium. Extending the perf-pan spec to a
  throttled CPU profile would better approximate the stated
  "mid-range 2024 smartphone" target.

## Alternatives considered

- **Narrow ADR 0015 to cover the gap without building the artefacts**
  — would satisfy the tasks↔ADR consistency issue only cosmetically;
  leaves SC-006 / FR-015 / SC-003-5 without automated gates. Rejected.
- **Add a single omnibus perf gate** — combining bundle-size + bench +
  Lighthouse + pan probe into one script — rejected because the
  individual gates give sharper regression signal and can fail
  independently (bundle without perf regression, or vice versa).
