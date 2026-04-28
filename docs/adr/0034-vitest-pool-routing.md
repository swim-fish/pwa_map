# 0034. Per-spec pool routing for `deploy-base-alignment` (test infrastructure)

**Status**: Accepted
**Date**: 2026-04-29
**Feature**: tooling fix discovered during `specs/013-locate-controls-layout/` implementation; routed back to test infrastructure rather than feature scope.

## Context

`tests/integration/deploy-base-alignment.spec.ts` (introduced by feature 008 — see ADR 0028) verifies that the post-build `dist/` artefacts agree on the GitHub Pages base path. Cases (7) + (8) run in `// @vitest-environment node` (the rest of the suite is jsdom) and dynamically `await import('../../vite.config.ts')` to assert `command=serve` and `command=build` resolve to `/` and `/pwa_map/` respectively. This dynamic import forces `vite-node` + `esbuild` to transform the entire `vite.config.ts` and its dependency graph at test time.

Single-file invocation (`npx vitest run tests/integration/deploy-base-alignment.spec.ts`) completes in ~1.4 s. Full-suite invocation (`npm test`, 78 specs / 800+ tests) consistently times out cases (7) + (8) at the 5 s default `testTimeout`. Stack: the spec runs in the shared default thread pool alongside ~77 jsdom specs; vite-node's transform pipeline queues behind the rest of the suite, the dynamic import doesn't resolve in time, and Vitest fails the test as a timeout. Behaviour was reproduced on `master` (without feature 013), confirming this is pre-existing test-infrastructure flakiness, not a feature regression.

The standalone `deploy:check` pipeline already invokes the spec separately as its load-bearing gate (`npx vitest run tests/integration/deploy-base-alignment.spec.ts`), so production / CI never observes the flake. But local `npm test` runs were unreliable, contaminating the team's signal-to-noise ratio.

## Decision

Route `tests/integration/deploy-base-alignment.spec.ts` to Vitest's `forks` pool with `singleFork: true`, while the rest of the suite stays on the default thread pool. The change lives in `vite.config.ts` `test:` block:

```ts
test: {
  // ...existing config...
  poolMatchGlobs: [['tests/integration/deploy-base-alignment.spec.ts', 'forks']],
  poolOptions: {
    forks: {
      singleFork: true,
    },
  },
}
```

`poolMatchGlobs` (Vitest 1.x+, deprecated-but-functional in 2.x; replacement is `test.workspace` / `test.projects`) maps the matched glob to a pool. `singleFork: true` runs every spec inside that pool in a single dedicated fork process — for a single matched spec this is "this file gets its own process, no other workers compete for the esbuild transformer". The dynamic `import('vite.config.ts')` resolves in milliseconds in this isolated context.

## Consequences

- **`npm test` is now stable**: 884 / 884 GREEN (was 883 / 884 with the timeout flake).
- **`npm test` is also ~5× faster** (86 s → 17 s). Releasing the heaviest single-file transform job from the shared thread pool unblocks the other 77 specs, which is a larger throughput improvement than the isolated fork costs.
- **`deploy:check`'s standalone invocation is unaffected**: `npx vitest run tests/integration/deploy-base-alignment.spec.ts` still goes through the new config, runs in its own fork, and continues to gate the production deploy pipeline.
- **No production code change**: the routing rule is test-only.
- **Forward compatibility hazard**: `poolMatchGlobs` is deprecated in Vitest 2.x in favour of `test.workspace` / `test.projects`. When the project upgrades to Vitest 3+, the routing must be migrated to the workspace API. Documented here so the migration is not archaeological.

## Alternatives considered

- **Bump `testTimeout` globally to 30 s**. Rejected: hides the latency rather than fixing it; every other spec inherits a slower fail-fast loop; obscures real-test-stuck signals during dev.
- **Per-test timeout 3rd argument** (`it('(7) ...', async () => { ... }, 30_000)`). Rejected: still queues behind the same congested transformer; only the failure is hidden, the flake mechanism remains. Also a code-level edit for what is fundamentally a test-runner configuration concern.
- **Disable the deploy-base spec from `npm test` entirely**, keeping it only in `deploy:check`. Rejected: the spec catches real regressions during dev (e.g., accidental edits to `vite.config.ts`'s `base` ternary); excluding it from the local loop weakens the dev safety net.
- **Migrate to `test.workspace`** (Vitest 2.x recommended path). Deferred: requires a second config file or significant restructuring of the existing `defineConfig(({ command }) => ...)` block; the deprecation does not break in 2.1.9. Will be addressed when the Vitest 3 upgrade lands.

## Cross-references

- **ADR 0006 — testing strategy**: vitest unit + Playwright e2e baseline.
- **ADR 0028 — github-pages-deploy**: introduced the deploy-base-alignment spec.
- **`tests/integration/deploy-base-alignment.spec.ts`**: the spec body explains the `// @vitest-environment node` directive and the case-(7)/(8) function-form contract.
