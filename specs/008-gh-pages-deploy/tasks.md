---
description: 'Task list for feature 008-gh-pages-deploy'
---

# Tasks: GitHub Pages Auto-Deploy on Master

**Input**: Design documents from `/specs/008-gh-pages-deploy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{deploy-workflow,ci-workflow,vite-config-amendment}.md, quickstart.md

**Tests**: Tests are REQUIRED for the build-output safety property (Constitution Principle II — TDD non-negotiable; reaffirmed in research D10). The `deploy-base-alignment.spec.ts` lands RED before the `vite.config.ts` amendment. The workflow files themselves are not unit-tested (they run on GitHub's runners; their first execution on the platform IS the acceptance test).

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. Stories are ordered by spec priority (US1 P1 → US2 P2 → US3 P3). The two workflow files are largely independent of each other (research D3); the `vite.config.ts` amendment is a shared foundation that BOTH workflows depend on for the build to succeed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User-story label (US1, US2, US3) — present on Phase 3+ tasks only
- Include exact file paths in descriptions

## Path Conventions

Single-project layout (Option 1 from plan.md). Workflow YAML under `.github/workflows/`, the new test under `tests/integration/`, docs under `docs/{ui,adr}`. All paths are repo-relative from the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the local-developer convenience script that mirrors the workflow's gate sequence. No production source touched yet.

- [X] T001 Amend `package.json` `scripts` block to add a `deploy:check` alias that runs the same gate sequence the workflow runs. Insert immediately after the existing `bundle-size` script: `"deploy:check": "npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts && npm run bundle-size"`. Do NOT touch any other script. The existing `format:check` script (`prettier --check .`) is already present and reused; no change there.
- [X] T002 Run `npm run format` and `npm run lint` against `package.json` to confirm Constitution Principle I before any further work. Confirm `npm run typecheck` is still clean.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the test-first safety net plus the `vite.config.ts` amendment that BOTH user stories depend on for a successful build. The `deploy-base-alignment.spec.ts` is the load-bearing safety property; it MUST be RED before T005 lands the production change.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete. The test in T004 lands RED before the implementation in T005, per Constitution Principle II + research D10.

- [X] T003 Read `contracts/vite-config-amendment.md` §5 (the 8 required test cases) and `data-model.md` §2 (the build artifact invariants). These are the inputs for T004. No file edited; this is a planning step that prevents T004 from miscoding the spec.
- [X] T004 Create `tests/integration/deploy-base-alignment.spec.ts` covering the 8 cases per `contracts/vite-config-amendment.md` §5: (1) `dist/manifest.webmanifest` exists; (2) manifest's `start_url === scope === id` (three-way equality, value-agnostic); (3) the common manifest path equals the URL prefix Vite emits in `dist/index.html`'s first `<script type="module" src="...">`; (4) `dist/sw.js` exists at exactly that path on disk (the SW URL is `${base}sw.js` after serving but the file is at `dist/sw.js`); (5) `dist/index.html` does NOT contain a `<base>` tag; (6) the first manifest icon's `src` starts with the same base prefix as case (3); (7) calling the default-exported config function with `{ command: 'serve' }` yields `base === '/'`; (8) calling it with `{ command: 'build' }` yields `base === '/pwa_map/'`. Cases (1)–(6) require a built `dist/` (gate the spec to skip with a clear message if `dist/manifest.webmanifest` is missing); cases (7)–(8) are pure import-and-call. Run `npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts` and confirm RED — the current `dist/` from feature 007 has `start_url: '/'` so cases (3) / (6) / (8) MUST fail.
- [X] T005 Amend `vite.config.ts` per `contracts/vite-config-amendment.md` §1 + research D2 + D6: (a) introduce `const PROD_BASE = '/pwa_map/' as const;` and `const DEV_BASE = '/' as const;`; (b) extract the existing manifest object into `const manifestBase = { ...non-path fields... } as const;` — REMOVE `start_url` if it currently lives there (it does not in the current file, but make sure); (c) wrap the existing `defineConfig({ ... })` call in a function: `defineConfig(({ command }) => { const base = command === 'build' ? PROD_BASE : DEV_BASE; const manifest = { ...manifestBase, start_url: base, scope: base, id: base }; return { base, plugins: [svelte(), VitePWA({ ..., manifest, ... }), devManifestPlugin(manifest)], ... } })`; (d) the icon `src` entries in `manifestBase.icons` MUST be relative (`'icons/icon.svg'`, no leading slash); (e) the runtime cache rules (osm-tiles / nlsc-tiles / google-tiles) are UNCHANGED — same URL patterns, same `TILE_CACHE_MAX_ENTRIES_CEILING`, same `TILE_MAX_AGE_SECONDS`; (f) `resolve` / `build` / `test` blocks are UNCHANGED. Run `npm run build` to regenerate `dist/`, then `npx vitest run tests/integration/deploy-base-alignment.spec.ts` — all 8 cases turn green. Run `npm run dev` briefly to confirm the dev server still serves at `http://localhost:5173/` (FR-018).
- [X] T006 Run `npm run format`, `npm run lint`, `npm run typecheck`, then `npm test` (full suite — no regression in features 001–007). Then `npm run build && npm run preview` and confirm the preview now serves at `http://localhost:4173/pwa_map/` (FR-018 documented behaviour change). Then `npm run bundle-size` — the entry-JS delta MUST stay within budget (this feature adds zero client-side code; expect a delta of ≤ a few hundred bytes from the manifest URL prefix change, well under the 6 KB budget set in feature 007).

**Checkpoint**: Foundation in place — base-alignment spec green, `vite.config.ts` env-conditional, all existing features still work, dev path unchanged, preview path documented as moved to subpath. Both user-story phases may now begin.

---

## Phase 3: User Story 1 — Push to master ships to production automatically (Priority: P1) 🎯 MVP

**Goal**: Land the `deploy.yml` workflow so a push to `master` triggers a build, runs all gates, and (on success) publishes the artifact to GitHub Pages via the modern Pages-from-Actions pipeline. Aligns with FR-001..FR-006, FR-008, FR-009, FR-012, FR-014..FR-017, SC-001, SC-002, SC-003, SC-006, SC-007, SC-009.

**Independent Test**: After landing T007 + T008 + the one-time repo setup of T009: open a PR with a trivial change, merge it. Within 10 minutes the public URL `https://swim-fish.github.io/pwa_map/` MUST serve the new build. The GitHub Actions tab MUST show the run as green; the `Environments → github-pages` view MUST show the deployed commit hash.

### Implementation for User Story 1

- [X] T007 [US1] Create `.github/workflows/deploy.yml` per `contracts/deploy-workflow.md` §1–§3 + research D1, D4, D5. Required structure: top-level `name`, `on: { push: { branches: [master] } }`, `concurrency: { group: pages, cancel-in-progress: true }`, `permissions: { contents: read }`. Two jobs: (a) `build` on `ubuntu-latest`, `timeout-minutes: 15`, with steps `actions/checkout@v4` → `actions/setup-node@v4` (`node-version: '22', cache: npm`) → `npm ci` → `npm run format:check` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` → `npx vitest run tests/integration/deploy-base-alignment.spec.ts` → `npm run bundle-size` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` (`with: { path: ./dist }`); (b) `deploy` on `ubuntu-latest`, `timeout-minutes: 10`, `needs: build`, `permissions: { contents: read, pages: write, id-token: write }`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, single step `id: deployment, uses: actions/deploy-pages@v4`. Reference action versions verbatim — no `@latest`. NO `secrets.*` reference anywhere. After landing, `npx prettier --check .github/workflows/deploy.yml` MUST pass (Prettier handles YAML).
- [X] T008 [US1] Run `npm run format` over `.github/workflows/deploy.yml`. Then commit the file (the actual deploy will only run after merge to `master`; locally we can only verify the YAML parses). Optionally use `gh workflow view deploy.yml` after push to a branch to confirm GitHub parsed it without error — but the canonical "this works" signal is the first run on `master`.
- [X] T009 [US1] **One-time repo setup (manual)**: a maintainer with admin access opens `https://github.com/swim-fish/pwa_map/settings/pages`, sets **Source** to **GitHub Actions** (NOT "Deploy from a branch"), and saves. This is the single manual step that FR-020 / SC-009 require; it cannot be automated from a workflow without breaking FR-015 (no PAT). Document the click-path in the PR description so the reviewer / merger knows to do it before the merge (or right after, before the first push to master). After the click, every subsequent deploy is fully automated.
- [ ] T010 [US1] **First-deploy smoke (manual, after merge)**: after T007's PR merges to `master` AND T009's repo setup is done, the next push to `master` triggers `deploy.yml`. Within 10 minutes, open `https://swim-fish.github.io/pwa_map/` in a fresh Chromium incognito window and confirm: (a) the PWA loads with no console errors; (b) DevTools → Application → Manifest shows `start_url`, `scope`, `id` all = `/pwa_map/`; (c) DevTools → Application → Service Workers shows `sw.js` registered with scope `/pwa_map/`; (d) the Settings sheet (feature 007 gear button) opens and shows three rows; (e) the install banner (feature 005) is reachable; (f) `Environments → github-pages` view in the repo shows the deployed commit; (g) **Lighthouse-on-deployed-URL spot check (SC-006 part b)**: open DevTools → Lighthouse, select Categories = "Progressive Web App" only, Mode = "Navigation", Device = "Mobile", click "Analyze page load"; record the PWA category score in the PR description. SC-006 part (b) satisfied if score ≥ 90; (h) **SW update-prompt verification (FR-011)**: keep the tab from step (a) open; in a separate terminal, push a trivial follow-up commit to master (e.g., a one-character README typo). Wait ~10 minutes for the second deploy. The feature-004 update-prompt MUST appear in the still-open tab; click "Update now" and confirm the page reloads to the new version with the new SW activated (DevTools → Application → Service Workers shows the new SW as "activated and is running"). If any of (a)–(h) fail, the deploy is broken — diagnose via the failed Actions run, fix, push again. SC-001 is satisfied if the wall-clock from merge → live is ≤ 10 minutes.

**Checkpoint**: US1 fully functional. Merging to master deploys to GitHub Pages within 10 minutes p95. The MVP slice ships here.

---

## Phase 4: User Story 2 — Pull-request build verification before merge (Priority: P2)

**Goal**: Land the `ci.yml` workflow so every PR against `master` runs the same gate sequence and reports a status check. Optionally configure branch protection to require it. Aligns with FR-007, US2, SC-004.

**Independent Test**: Open a PR that introduces a deliberate type error (e.g., a dangling unused import that ESLint catches, or a TypeScript-detectable mistake). The PR's status checks list MUST display a failing check named `CI — PR build verification / verify (pull_request)` within 10 minutes p95, and the failing job/step MUST be clickable into the run logs.

### Implementation for User Story 2

- [X] T011 [US2] Create `.github/workflows/ci.yml` per `contracts/ci-workflow.md` §1–§2 + research D3, D5. Required structure: top-level `name: 'CI — PR build verification'`, `on: { pull_request: { branches: [master] } }`, `concurrency: { group: 'ci-${{ github.ref }}', cancel-in-progress: true }`, `permissions: { contents: read }` (NO `pages` or `id-token` — research D3 + FR-016). Single `verify` job on `ubuntu-latest`, `timeout-minutes: 15`, with the SAME step list as `deploy.yml`'s `build` job UP TO AND INCLUDING the `bundle-size` step — i.e., `actions/checkout@v4` → `actions/setup-node@v4` → `npm ci` → `format:check` → `lint` → `typecheck` → `npm test` → `npm run build` → `npx vitest run tests/integration/deploy-base-alignment.spec.ts` → `npm run bundle-size`. The job MUST NOT include `actions/configure-pages`, `upload-pages-artifact`, or `deploy-pages` (FR-016 + research D3 + contract §4). Run `npx prettier --check .github/workflows/ci.yml`.
- [X] T012 [US2] Run `npm run format` over `.github/workflows/ci.yml`. The workflow first runs when the PR containing T011 is opened — that PR IS the acceptance test for the workflow's own correctness.
- [ ] T013 [US2] **Repo setup required for US2 AS2 (manual, admin access)**: a maintainer enables branch protection on `master` per `quickstart.md`'s "ONE-TIME REPO SETUP" section step (b): `Settings → Branches → Add rule → master → Require a pull request before merging + Require status checks to pass before merging` and add `verify (pull_request)` as a required check. This setup IS the only way to satisfy spec US2 acceptance scenario 2 ("merge button is blocked when build fails"); without it, the failing status check is still visible on the PR (US2 AS1 satisfied) but the merge button is not blocked (US2 AS2 NOT satisfied). Per the spec's amended US2 AS2, this distinction is now explicit: skipping T013 means accepting that maintainers / contributors must manually honour the failing check. Recommended path: do this setup as part of merging the PR (pre-merge: open the click-path URL in a separate tab; post-merge: complete the click). Document the click-path in the PR description so the merger knows to do it.
- [ ] T014 [US2] **Negative-path smoke (manual)**: after T011's PR is open, push a new commit to that PR's branch that introduces a deliberate ESLint error (e.g., add `const _unused = 1;` without the leading underscore so the unused-vars rule fires). Confirm: (a) within 10 minutes the `verify` check on the PR shows red; (b) clicking the check leads to the log line that names the failing rule; (c) the merge button is blocked (only if T013 was done). Then revert the deliberate error so the check goes green again. SC-004 satisfied if wall-clock to status check ≤ 10 minutes p95.

**Checkpoint**: US1 + US2 functional. Merging to master deploys; opening / updating a PR runs the gate set and reports back. The deploy gate AND the PR gate use the SAME step list — protection against drift.

---

## Phase 5: User Story 3 — Failure visibility for maintainers (Priority: P3)

**Goal**: Verify the workflows opt into GitHub's default failure-visibility behaviour correctly — failed runs are surfaced as red ✕ on commits AND as failed runs in the Actions tab AND as failed deployments in the Environments view. Aligns with FR-012, FR-013, FR-014, US3, SC-005 (zero secrets baseline preserved during failures).

**Independent Test**: Force a deploy failure (described in T015) and confirm the failure shows up in all three GitHub UI surfaces within 1 minute of the run completing.

### Implementation for User Story 3

- [ ] T015 [US3] **Negative-path smoke for the deploy path (manual)**: introduce a deliberate failure to verify failure visibility. Two safe ways: (option A) push a commit to a feature branch, open a PR, force-merge it WITHOUT actually doing the work — the deploy will fail at `format:check` if your branch has formatting issues; (option B) temporarily revoke the workflow's `pages: write` permission via repo Settings → Actions → General → Workflow permissions and re-enable after the test. Prefer option A — non-destructive and reversible by a follow-up commit. Confirm: (a) the failed run appears at the top of the Actions tab with a red indicator within 1 minute of completion (FR-014); (b) the failing commit on `master` shows a red ✕ adjacent to its hash in the GitHub commits view (FR-013); (c) the prior successful deploy remains live at `https://swim-fish.github.io/pwa_map/` — a fresh visitor sees the OLD version, not a 404 or a half-deploy (FR-009 / SC-003); (d) the `Environments → github-pages` view still shows the prior successful deploy as the "Active" one. Then commit the fix and verify the next deploy goes green and the URL updates.
- [X] T016 [US3] Document the rollback path in the ADR: when a bad deploy lands and you need recovery, the "rollback" action is `git revert <bad-commit>` and let the next deploy ship the revert. There is no separate rollback button. The previous successful build IS preserved at the live URL until the next successful deploy ships (FR-009), buying time for the revert to land.

**Checkpoint**: US1 + US2 + US3 all functional. Failures are visible in three GitHub UI surfaces; rollback is documented. All three priorities of the spec are satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle III + V deliverables, regression sweep against features 001–007, and the maintainer-facing quickstart.

- [X] T017 [P] Create `docs/ui/0008-deploy-and-base-path.md` per Constitution Principle III. Capture: (a) the URL change — production now serves at `https://swim-fish.github.io/pwa_map/` (subpath form), `npm run preview` now serves at `http://localhost:4173/pwa_map/`, `npm run dev` UNCHANGED at `http://localhost:5173/`; (b) the user-visible PWA implications — manifest `start_url` / `scope` / `id` all set to `/pwa_map/`, install banner (feature 005) prompts will install the PWA at the subpath, the installed PWA opens to the subpath URL; (c) the contributor-visible implications — `npm run preview` URL changed (the `/pwa_map/` path is not just a docs detail, every link in the URL bar must include it); (d) acceptance-scenario references back to spec.md US1; (e) screenshots of the deployed site (after T010). Follow the established structure of `docs/ui/0007-settings-tile-cache.md`. Append the entry to `docs/ui/README.md`'s Index table as `0008` with status `Accepted`. Note: this UI doc has NO new design tokens, NO new components — it documents a URL/scope change, not a UI redesign.
- [X] T018 [P] Create `docs/adr/0028-github-pages-deploy.md` per Constitution Principle V. Document, with research-decision references: (a) Pages-from-Actions chosen over `gh-pages` branch (research D1) — atomic publish, no PAT, no third-party action; (b) two-workflow split chosen over one-with-`if:` (research D3) — least-privilege auditability; (c) `vite.config.ts` function form chosen over separate config files (research D2) — single source of truth for the subpath literal; (d) manifest `start_url` / `scope` / `id` constructed from `base` inside the function body (research D6) — they cannot drift; (e) NO `<base href>` in `index.html` (research D9) — Vite's URL rewriting is the sole mechanism, avoids relative-URL-doubling pitfalls; (f) NO change to `registerSW.ts` (research D7) — SW scope auto-derives from script URL; (g) one-time repo setup is the single manual step (research D8) — cannot be automated without breaking FR-015. Document the rollback path (no separate rollback button — `git revert` and let the next deploy ship). Append the entry to `docs/adr/README.md`'s Index table as `0028` with status `Accepted`. No existing ADR is superseded; ADR 0023 (SW registration strategy) and ADR 0024 (dev-mode manifest middleware) are referenced as relevant prior art.
- [X] T019 [P] Run the full automated suite — `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts`, `npm run bundle-size`. All must be green. Address any regression in features 001–007 specs (per spec Assumptions: existing tests must still pass). Confirm `npm run build` exits cleanly with the new `base: '/pwa_map/'` baked in and `dist/sw.js` precaches the right paths.
- [X] T020 [P] Bundle-size verification AND artifact-contents audit (FR-017): (a) run `npm run bundle-size` and confirm the gzipped main-bundle delta from the post-007 baseline (`scripts/bundle-baseline.json`) is ≤ 1 KB (this feature adds zero client-side code; the only delta is the URL prefix that flows into emitted asset hrefs and the manifest, which gzips to near-nothing). DO NOT bump the baseline as part of this feature — leave it at feature 007's snapshot so future features measure against a stable reference. If the delta is unexpectedly large, identify the contributor (likely a stray `dist/` artifact or a rebuild miss). (b) **Artifact-contents audit (FR-017)**: list `dist/` (`ls -la dist/` and `ls -R dist/ | head -40`) and assert that ONLY the expected build outputs are present — `index.html`, `manifest.webmanifest`, `sw.js`, `workbox-<hash>.js`, `assets/`, `icons/`, `registerSW.js` (if emitted). MUST NOT contain `.git`, `.env`, `node_modules`, `tests/`, `src/`, `*.ts` source files, `*.spec.*` files, or any markdown/docs. After the first deploy, repeat the audit on the uploaded artifact (download from the run's artifacts UI or `gh run download`) and confirm the same — this proves `actions/upload-pages-artifact@v3` honoured the `path: ./dist` directive verbatim.
- [ ] T021 Open the PR for this feature against `master`. The opening of the PR triggers `ci.yml` (T011) — that run IS US2's first acceptance test. After the PR's checks go green AND the maintainer has done the one-time repo setup of T009 (deploy enablement) + T013 (branch protection — required for US2 AS2 to be satisfied), merge the PR. The merge triggers `deploy.yml` (T007) — its first run IS US1's first acceptance test (T010). After the URL goes live, open it in a fresh browser and execute the manual smoke from `quickstart.md` §"Manual smoke test (after first deploy)" steps 1–8.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** — only touches `package.json`. No source-code dependency on anything else.
- **Phase 2 Foundational** — independent of Phase 1 in raw compilation terms (the `deploy:check` script is a convenience; nothing else uses it). BLOCKS Phase 3 + Phase 4 because both workflows' build step depends on `vite.config.ts`'s function form producing a correct subpath build that the deploy-base-alignment spec accepts.
- **Phase 3 US1** — depends on Phase 2 (the workflow's build step exercises `vite.config.ts`). T009 (one-time repo setup) is a HUMAN step; T010 (first-deploy smoke) cannot run until T009 is done AND the PR containing T007 is merged.
- **Phase 4 US2** — depends on Phase 2 only. Independent of Phase 3 in spec terms; both workflows can be authored in parallel after Phase 2 lands. The PR opened to merge T007 + T011 + T017 + T018 + ... also opens the FIRST `ci.yml` run, which is itself the acceptance test for US2.
- **Phase 5 US3** — depends on Phase 3 (US3's negative-path smoke needs a working deploy workflow to fail). T015 must be sequenced AFTER T010 (a known-green deploy exists to verify the "prior good build remains live" path).
- **Phase 6 Polish** — depends on Phase 3 + Phase 4 + Phase 5 finishing (so the ADR + UI doc + bundle-size delta describe the final state).

### Story Independence

- US1 (deploy) and US2 (PR build verification) are SCOPE-independent — each delivers its own user value and could ship without the other. The PR build catches errors before merge; the deploy ships changes after merge. They share only the foundational `vite.config.ts` change.
- US3 (failure visibility) is technically a verification story — it does NOT add code. The visibility behaviour is built into GitHub Actions; this story confirms the workflows are configured to opt into it.
- The two workflow files (`ci.yml` + `deploy.yml`) are written separately (research D3) but follow the same step pattern — when amending one, mirror the change in the other unless the change is publish-specific.

### Within Each User Story

- Foundation tests (T004) MUST land RED before the foundation implementation (T005), per Constitution Principle II + research D10.
- Workflow files have no in-repo unit test — their first execution on GitHub IS the test. Local validation is `npx prettier --check` only.
- Manual smoke tasks (T010, T014, T015, T021) require a human + the platform; they cannot be automated within this repo.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).

### Parallel Opportunities

- T004 (test spec) is the only Phase-2 task that can run concurrently with T003 (spec read) — but they're sequential by dependency anyway.
- T007 (`deploy.yml`) and T011 (`ci.yml`) are written in different files and could be authored in parallel, but they share an implementer; serialise for cleanest review.
- T017 / T018 / T019 / T020 — four polish-phase artefacts; all `[P]`.

### Within-Phase Strict Sequencing (NOT parallel)

- T003 → T004 → T005 → T006 (foundation: read, test, impl, verify).
- T007 → T008 → (T009 manual) → T010 (deploy slice).
- T011 → T012 → (T013 manual repo setup, required for US2 AS2) → T014 (PR-build slice).
- T015 → T016 (US3 manual smoke + ADR rollback note).
- T017 / T018 / T019 / T020 → T021 (polish + final smoke).

---

## Parallel Example: Phase 6 polish artefacts

```bash
# Four polish-phase artefacts touch different files; can run in parallel:
Task: "Create docs/ui/0008-deploy-and-base-path.md (T017)"
Task: "Create docs/adr/0028-github-pages-deploy.md (T018)"
Task: "Run npm run format / lint / typecheck / test / build / bundle-size (T019)"
Task: "Verify bundle-size delta within budget (T020)"

# After all four are green, T021 (open PR + first deploy smoke) runs.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. STOP & VALIDATE: at this point a push to `master` deploys to GitHub Pages. PR builds are NOT yet verified (US2 absent), failure visibility is GitHub's default (US3 implicitly OK), no documentation has shipped (Phase 6).
3. The MVP is shippable here if the team is willing to run without PR build verification temporarily.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready (subpath build works, dev / preview confirmed).
2. Add US1 → independent test (first deploy goes live) → MVP demo (push to master → site updates).
3. Add US2 → independent test (PR build status check appears) → contributors get build feedback before merge.
4. Add US3 → independent test (failure visibility verified) → maintainer confidence.
5. Phase 6 Polish → ADR + UI doc + perf verification + final smoke → merge-ready.

### One-developer flow (recommended)

For a single-developer commit, run all six phases serially in the one PR. The PR opening triggers `ci.yml` (T011's acceptance test); the merge triggers `deploy.yml` (T007's acceptance test). The two manual repo-setup steps (T009, T013) are done by the developer right before / after the merge.

---

## Notes

- `[P]` tasks operate on disjoint files; verify before parallel-launching.
- `[Story]` label is REQUIRED on Phase 3 / 4 / 5 tasks and absent on Phase 1 / 2 / 6 tasks.
- Constitution Principle II is non-negotiable: T004's test lands RED before T005's implementation.
- Run `npm run format` after every code edit (Development Workflow).
- Update `docs/ui/` for visible URL/scope changes — covered by T017.
- Update the ADR index after each `/speckit.analyze` and `/speckit.implement` — covered by T018.
- Persisted-schema invariants (ADR 0021): NOT modified by this feature. `pwa_map:prefs` is still v2 (feature 007); no migration required.
- Locale-convention compliance: NO new i18n keys introduced.
- License-of-tile-data hard rules (FR-013, FR-014, FR-015, FR-021 from feature 007): UNCHANGED. The deploy automation publishes the same `cachePurge` / `cacheStats` / `cachePolicy` modules and the same SettingsSheet UI; nothing about deploy enables a download/prefetch path.
- Workbox precache (`workbox-precache-v2-*`): the precache contents change (asset hashes change every build), but the cache name is stable. Feature 007's `clearAllTileCaches` allowlist still excludes it correctly.
- One-time repo setup (T009, T013) cannot be automated from a workflow without breaking FR-015. The PR description should call them out so the merger does them at the right time.
- The first deploy IS the integration test. There is no way to validate the full pipeline locally — `npm run deploy:check` runs the gate sequence but cannot exercise GitHub Pages itself.
- The two workflow files share ~10 lines of step duplication. This is intentional per research D3 (least-privilege auditability) and rejected reusable-workflow refactor.
- Features 001–007 specs MUST keep passing — running them is part of T019.
- The `lighthouse.yml` workflow is UNCHANGED by this feature. It currently triggers on `main` (not `master`); re-targeting it is OUT OF SCOPE per spec "Out of Scope".
