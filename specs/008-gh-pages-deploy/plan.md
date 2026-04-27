# Implementation Plan: GitHub Pages Auto-Deploy on Master

**Branch**: `008-gh-pages-deploy` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-gh-pages-deploy/spec.md`

## Summary

Automate the production deploy of the PWA to GitHub Pages so that
every push to `master` (incl. PR merges) re-builds the project and
publishes the result to `https://swim-fish.github.io/pwa_map/`,
with no manual maintainer steps after a one-time repo setup. Pull
requests against `master` get the same build (without the deploy
step) as a status check.

Two production-runtime aspects are non-trivial:

1. **Subpath alignment**. The site lives at `/pwa_map/` not `/`, so
   `vite.config.ts`'s `base`, the PWA manifest's `start_url` /
   `scope`, and the service worker's auto-derived registration
   scope all have to agree. We do this by switching `vite.config.ts`
   to a function form that reads `command` (`build` vs `serve`) and
   sets `base: '/pwa_map/'` in production while keeping `base: '/'`
   in dev — preserving FR-018's "local dev unchanged" requirement.
   The PWA manifest paths are kept relative (`./` style) where
   possible and otherwise piggyback on the same conditional.

2. **Deploy mechanism**. We use GitHub's modern Pages-from-Actions
   pipeline (`actions/configure-pages`,
   `actions/upload-pages-artifact`, `actions/deploy-pages`) — no
   `gh-pages` branch, no PAT, no long-lived secret (FR-015 / SC-005).
   The repo's Pages source must be one-time-set to "GitHub Actions"
   (FR-020 / SC-009 — documented in `quickstart.md`).

Two new workflow files:

- `.github/workflows/ci.yml` — runs format / lint / typecheck /
  Vitest / bundle-size on every PR against `master` (US2 + FR-007).
- `.github/workflows/deploy.yml` — runs the same gates AND the
  publish step on every push to `master` (US1 + FR-001..FR-009).

One combined workflow was considered (research D3) and rejected
because the deploy job needs `permissions: { pages: write,
id-token: write }` while PR builds should NOT carry those
permissions (FR-016 least-privilege). Two files keep the permission
surfaces independently auditable.

Tests: a small `tests/integration/deploy-base-alignment.spec.ts`
asserts that the production build's manifest + index.html + SW
registration scope all reference the same base path, so a future
contributor cannot silently desync them and break PWA installation
on the deployed URL (FR-010 / SC-006 / SC-007).

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target) — inherited
from features 001–007. Workflow files are YAML 1.2 consumed by
GitHub Actions runners (Ubuntu 24.04 image).

**Primary Dependencies**:

- `vite` 5.x + `vite-plugin-pwa` 0.20.x — already in use; we extend
  `vite.config.ts` to take a function form for env-conditional
  `base`. **No version bump.**
- GitHub-hosted actions used as deploy mechanism (build-time, not
  runtime):
  - `actions/checkout@v4`
  - `actions/setup-node@v4`
  - `actions/configure-pages@v5`
  - `actions/upload-pages-artifact@v3`
  - `actions/deploy-pages@v4`
  - All are GitHub-published actions; no third-party action
    dependency. Pinned to major version per the existing
    `lighthouse.yml` convention (which uses `@v4` for checkout +
    setup-node).
- **No new runtime deps. No new dev deps.**

**Storage**: **None** added. No code touches `localStorage`,
`Cache`, or any persisted client state. The deploy publishes a
fresh artifact each run; the `gh-pages` branch is NOT used.

**Testing**: Vitest (unit + integration) for the base-alignment
spec. Workflow files are validated by GitHub itself on push; we do
NOT add an `actionlint` toolchain (out of scope; would add a dev
dep for marginal gain).

- The base-alignment spec runs in jsdom and reads the production
  build artifact (`dist/manifest.webmanifest`, `dist/index.html`,
  `dist/sw.js`) via `fs.readFileSync`. It runs **after**
  `npm run build`, so it lives in `tests/integration/` and is
  invoked by the workflow's `npm test` step (which already runs
  build-independent specs) plus an explicit second invocation
  after `npm run build` per the deploy workflow's verification
  block.

**Target Platform**:

- Build runner: GitHub-hosted `ubuntu-latest` (currently 24.04)
  with Node 22 (matches `lighthouse.yml`).
- Deployed runtime: identical to features 001–007 — Chromium
  (desktop + Android) 120+, WebKit / iOS Safari 15+, Firefox
  120+ desktop, Firefox Android. Served from
  `https://swim-fish.github.io/pwa_map/`.

**Project Type**: Single project — extension of the existing PWA.
This feature adds **infrastructure** (workflow YAML + a build-config
amendment) but no new app source modules.

**Performance Goals** — explicit budgets per Constitution
Principle IV:

- **Push → live URL**: p95 < 10 minutes (SC-001), measured across
  ≥ 10 consecutive deploys after the first. Estimated breakdown:
  - GitHub event → workflow start: ~5–30 s
  - `npm ci` (with `actions/setup-node` cache): ~30 s warm / ~90 s cold
  - format + lint + typecheck + vitest: ~60 s
  - `vite build` + bundle-size check: ~10 s
  - `actions/upload-pages-artifact`: ~30 s
  - `actions/deploy-pages`: ~60–120 s (GitHub-side propagation)
  - **Total typical**: ~3–4 min; budget 10 min absorbs any
    GitHub-side variance.
- **PR build → status check**: p95 < 10 minutes (SC-004). Same
  breakdown minus the upload + deploy steps.
- **Concurrency**: at most one in-progress deploy per `master`
  branch via `concurrency: { group: 'pages', cancel-in-progress:
  true }` per FR-003.
- **Bundle delta**: `0 bytes` on the entry JS bundle. The deploy
  workflow does NOT add any client-side code; the `vite.config.ts`
  amendment is a build-time `base` change (no runtime cost beyond
  the URL prefix being baked into asset URLs, which Vite already
  does).

**Constraints**:

- **Least-privilege workflow permissions** (FR-016 / SC-005):
  - `ci.yml`: `permissions: { contents: read }` only.
  - `deploy.yml`: `permissions: { contents: read, pages: write,
    id-token: write }` — exactly what `actions/deploy-pages`
    requires; nothing more.
  - Workflow `env:` blocks reference ZERO repository secrets
    (auth uses GitHub's per-run `GITHUB_TOKEN`; OIDC `id-token`
    handled by `actions/deploy-pages` automatically).
- **Local-dev preservation** (FR-018 / SC-008): `npm run dev`,
  `npm run build`, `npm run preview`, `npm test`, Playwright E2E
  ALL continue working unchanged on a developer machine. The
  conditional `base` is `/` in dev mode and `/pwa_map/` only in
  the production build that the workflow ships. `npm run preview`
  ALSO uses the production base — so previewing locally serves at
  `http://localhost:4173/pwa_map/` after this change. This is a
  documented behaviour change, called out in
  `docs/ui/0008-deploy-and-base-path.md`.
- **PWA-correctness under subpath** (FR-010 / FR-011 / SC-006 /
  SC-007): manifest `start_url`, `scope`, `id`, and the SW
  registration scope must all reference the subpath. Specifically:
  - manifest `start_url: '/pwa_map/'`
  - manifest `scope: '/pwa_map/'`
  - manifest `id: '/pwa_map/'` (required for PWA-update behaviour
    on Chromium; without an explicit `id`, Chromium can treat
    URL-prefix changes as a different installed app)
  - SW registration scope = `/pwa_map/` (auto-derived because
    `sw.js` lives at `/pwa_map/sw.js` after the build — no manual
    code change)
- **Locale conventions**: no new i18n keys introduced.
- **First-deploy framing**: no installed PWAs to migrate; no
  `gh-pages` branch to clean up. The workflow's first run on
  `master` produces the initial deploy.

**Scale/Scope**:

- **2 new workflow files**:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
- **1 amended config**: `vite.config.ts` — function form with
  `command`-conditional `base`; manifest paths updated.
- **1 new spec**:
  `tests/integration/deploy-base-alignment.spec.ts` — asserts
  the post-build manifest, index.html, and SW agree on the base
  path.
- **1 new ADR**: ADR 0028 (deploy method + base-path strategy).
- **1 new UI record**:
  `docs/ui/0008-deploy-and-base-path.md` (because the user-visible
  URL and the `npm run preview` URL change).
- **1 amended `package.json` script**: a tiny `deploy:check`
  alias that runs the format / lint / typecheck / test / build /
  bundle-size sequence the same way the deploy workflow does, so
  a maintainer can locally smoke-test the gate set with one
  command (informational only — the workflow does not depend on
  this script).
- **No new i18n keys**, no UI components, no client-side JS
  changes, no persisted-state changes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                       | Verdict     | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Code Quality & Formatting**                | PASS        | Workflow YAML is formatted by Prettier (already configured for `*.yml`). `vite.config.ts` change rides existing Prettier + ESLint flat config. No new linter rule. The deploy workflow itself enforces `npm run format` / `lint` / `typecheck` as gates BEFORE publish — Principle I is therefore enforced at every deploy, automatically.                                                                                                                                                  |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | The base-alignment spec (`tests/integration/deploy-base-alignment.spec.ts`) is written and lands RED before the `vite.config.ts` amendment. The workflow's "build before deploy" sequence (FR-005 → FR-008) IS the deploy-time TDD: every commit shipped through this workflow must have passed the project's full test suite. The TDD discipline shifts from "test before implementation" (still applies for the spec file) to "verify before publish" (applies to every shipped commit).         |
| **III. User Experience Consistency**            | PASS w/ doc | Two user-visible behaviour changes: (a) the PWA's public URL changes (subpath); (b) `npm run preview` serves at `/pwa_map/` not `/`. New `docs/ui/0008-deploy-and-base-path.md` mandatory before merge. No design tokens change. WCAG / a11y unaffected (no UI touched). The PWA-install affordance (feature 005) and the offline-ready toast (feature 004) MUST keep working under the subpath; verified by SC-006 (Lighthouse PWA ≥ 90) and SC-007 (install end-to-end on the deployed URL).             |
| **IV. Performance Requirements**                | PASS        | Five explicit budgets: SC-001 (p95 < 10 min push → live), SC-004 (p95 < 10 min PR → status check), concurrency = 1 in-progress deploy, bundle delta = 0 B (no client-side code added), Lighthouse PWA ≥ 90 (SC-006). All measurable: workflow run wall-clock from GitHub's API; existing `lighthouse.yml` covers SC-006.                                                                                                                                                                                  |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0028 (Pages-via-Actions deploy + subpath base-path strategy). Documents the rejection of the `gh-pages` branch alternative and the rejection of `<base href>` in `index.html`. The `docs/ui/0008-deploy-and-base-path.md` UI record covers Principle III. ADR index updated post-implement. No existing ADR is superseded.                                                                                                                                              |

**Locale convention compliance** — no new i18n keys; locale rules
not exercised by this feature.

**Result**: All five principles pass on the planned design. No
unjustified violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-gh-pages-deploy/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output (incl. one-time repo setup)
├── contracts/
│   ├── deploy-workflow.md                 # deploy.yml contract: triggers, jobs, permissions
│   ├── ci-workflow.md                     # ci.yml contract: triggers, jobs, permissions
│   └── vite-config-amendment.md           # vite.config.ts function-form contract
├── checklists/
│   └── requirements.md                    # /speckit.specify output (already exists)
└── tasks.md                               # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml                             # NEW — PR build verification (US2)
    ├── deploy.yml                         # NEW — master push → build + Pages deploy (US1)
    └── lighthouse.yml                     # UNCHANGED (this feature does not migrate it)

src/                                       # UNCHANGED at the source-file level
  (no app modules touched; SW scope auto-derives correctly from
   the new build-time base path)

vite.config.ts                             # AMENDED — function form, env-conditional base + manifest paths

tests/
└── integration/
    └── deploy-base-alignment.spec.ts      # NEW — asserts dist/ manifest + index.html + sw.js agree on base

docs/
├── ui/
│   └── 0008-deploy-and-base-path.md       # NEW — UI record per Principle III
└── adr/
    └── 0028-github-pages-deploy.md        # NEW — Pages-from-Actions + subpath strategy

package.json                               # AMENDED — adds `deploy:check` script
```

**Structure Decision**: Single-project layout (Option 1) — same
as features 001–007. The new `.github/workflows/` files sit
alongside the existing `lighthouse.yml`. The `vite.config.ts`
amendment is in-place. The new test lives next to existing
integration specs. Docs slot into the existing `docs/{ui,adr}`
trees with their incrementing numbers.

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | (none)     | (none)                               |
