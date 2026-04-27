# Phase 0 Research: GitHub Pages Auto-Deploy on Master

**Feature**: `008-gh-pages-deploy` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves every "NEEDS CLARIFICATION" implied by the
plan into concrete decisions. Decisions are numbered D1..D10 and
referenced from `data-model.md`, the `contracts/` files, and
`tasks.md`.

---

## D1. Deploy mechanism: GitHub's modern Pages-from-Actions pipeline (NOT a `gh-pages` branch)

**Decision**: Use the official actions trio
`actions/configure-pages@v5` + `actions/upload-pages-artifact@v3` +
`actions/deploy-pages@v4`. The repo's Pages source is set to
"GitHub Actions" (one-time, via Settings → Pages, documented in
quickstart). No `gh-pages` branch is created, no PAT or deploy key
is stored.

```yaml
# deploy.yml (excerpt)
permissions:
  contents: read
  pages: write
  id-token: write

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: '22', cache: 'npm' }
  - run: npm ci
  - run: npm run format:check
  - run: npm run lint
  - run: npm run typecheck
  - run: npm test
  - run: npm run build
  - run: npm test -- tests/integration/deploy-base-alignment.spec.ts
  - run: npm run bundle-size
  - uses: actions/configure-pages@v5
  - uses: actions/upload-pages-artifact@v3
    with: { path: ./dist }
  - uses: actions/deploy-pages@v4
    id: deployment
```

**Rationale**:

- **Zero long-lived secrets** (FR-015 / SC-005). The OIDC
  `id-token: write` permission lets `actions/deploy-pages` mint a
  per-run token that talks to GitHub's Pages API. No PAT, no deploy
  key, nothing in repo Secrets.
- **No deploy-time branch shuffling**. The `gh-pages` branch
  approach (push `dist/` to a separate branch, GitHub serves from
  there) requires either `peaceiris/actions-gh-pages` (a popular
  third-party action — adds a supply-chain trust hop) or a manual
  `git worktree` dance. Both are more code, more failure modes,
  and historically the source of "deploy succeeded but Pages still
  serves the old version because the branch wasn't pushed
  forcibly" incidents.
- **Atomic publish + automatic rollback during the publish
  window** (FR-009). `actions/deploy-pages` switches the served
  artifact at the platform level — there is NO window where the
  URL serves a half-deployed state. If the upload step fails, the
  prior artifact remains the live one.
- **First-class status in the GitHub UI** (FR-012 / FR-013).
  Pages-from-Actions deployments show up under the repo's
  "Environments" → `github-pages` view with the deployed commit,
  the live URL, and the run that produced it.

**Alternatives considered**:

- **`peaceiris/actions-gh-pages`** (push to `gh-pages` branch) —
  rejected for the supply-chain reason above + the atomic-publish
  reason. Worth noting: this was the canonical pattern before
  GitHub launched the Pages-from-Actions API in mid-2022; it is
  legacy now.
- **Manually scripted `git push` to a `gh-pages` branch from the
  workflow** — rejected. We'd own the rebase / force-push logic
  and the SW-cache-busting for that branch. The official actions
  do all of this for us.
- **Deploy from a release artifact uploaded to GitHub Releases** —
  irrelevant (that's a binary-distribution pattern, not a
  static-site pattern).

---

## D2. Vite `base` path strategy: env-conditional in `defineConfig`'s function form

**Decision**: Switch `vite.config.ts` to the function form of
`defineConfig`, branching on `command`:

```ts
// vite.config.ts (excerpt)
const PROD_BASE = '/pwa_map/' as const;

export default defineConfig(({ command }) => {
  const isProdBuild = command === 'build';
  const base = isProdBuild ? PROD_BASE : '/';
  return {
    base,
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          ...manifest,
          start_url: base,
          scope: base,
          id: base,
        },
        // ... existing workbox + runtimeCaching block unchanged
      }),
      devManifestPlugin(manifest),
    ],
    // ... rest of config unchanged
  };
});
```

The `base` is `/pwa_map/` in `npm run build` AND `npm run preview`
(both are `command === 'build'` for vite's purposes — `preview`
serves the already-built `dist/`). It is `/` in `npm run dev`
(`command === 'serve'`) so the dev server keeps serving at the
root path.

**Rationale**:

- **Single source of truth for the subpath**: the `PROD_BASE`
  literal flows into `vite`'s asset URL rewriting, the PWA
  manifest, and (transitively) the SW registration scope. This
  makes the deploy-base-alignment spec's job easy: it asserts that
  `dist/manifest.webmanifest`'s `start_url` / `scope` / `id` all
  equal the value Vite baked into `dist/index.html`'s asset
  hrefs.
- **Dev experience preserved** (FR-018): hitting
  `http://localhost:5173/` still works for `npm run dev`. No
  developer ever has to type `/pwa_map/` in dev.
- **Preview reflects production**: `npm run preview` serving at
  `/pwa_map/` IS the change from prior behaviour, but it's the
  RIGHT change — it means a maintainer running
  `npm run build && npm run preview` locally exercises exactly the
  deployed configuration. This catches subpath-related bugs
  pre-merge.
- **`vite.config.ts` import surface remains simple**: the function
  form is documented and recommended by Vite for env-conditional
  config. We don't need a separate `vite.config.prod.ts` /
  `vite.config.dev.ts` pair (which `eslint` + the test setup would
  also need to be told about).

**The PWA manifest `id`**: explicitly set to `/pwa_map/` (matching
`start_url` / `scope`). Per the W3C PWA Manifest spec, `id` is the
unique identifier for the installed app — without it, Chromium
treats it as `start_url`, which is what we want here, but setting
it explicitly future-proofs against a later `start_url` change
(e.g., adding a query param) accidentally creating a new "app
identity" and orphaning the user's installed PWA.

**Alternatives considered**:

- **`<base href="/pwa_map/">` in `index.html`** — rejected. Vite
  already rewrites asset URLs via the `base` config; adding
  `<base>` on top would double-rewrite anything that uses `./`
  relative URLs and would interact subtly with anchors. Pure-CSS
  `url(...)` references would also need re-checking.
- **Separate `vite.config.dev.ts` and `vite.config.prod.ts`** —
  rejected for the duplication / drift cost. The function form is
  one file, one diff.
- **Set `base` from `process.env.VITE_BASE_PATH`** — viable but
  requires every contributor to know the env var name and the
  workflow to set it explicitly. The hardcoded `PROD_BASE` is the
  simpler defaults-first approach (and the spec mandates one
  canonical public URL — it does NOT need to be configurable per
  build).
- **Set `base` only in the workflow via `VITE_BASE_URL=...
  npm run build`** — same drawback as the env-var approach;
  additionally fails the `npm run preview` consistency check above.

---

## D3. Two workflow files (`ci.yml` + `deploy.yml`) — NOT one combined workflow

**Decision**: Two top-level workflow files. They share no YAML
anchors; the small amount of step duplication (~10 lines) is
intentional.

| File          | Triggers                              | Permissions                           |
| ------------- | ------------------------------------- | ------------------------------------- |
| `ci.yml`      | `pull_request: { branches: [master] }` | `contents: read` ONLY                  |
| `deploy.yml`  | `push: { branches: [master] }`        | `contents: read, pages: write, id-token: write` |

Both workflows install Node 22, run `npm ci`, then run the same
gate sequence (format / lint / typecheck / vitest / bundle-size).
`deploy.yml` continues with `vite build` + `actions/configure-pages`
+ `upload-pages-artifact` + `deploy-pages`.

**Rationale**:

- **Least-privilege, auditable** (FR-016 / SC-005). A reviewer of
  `ci.yml` can trivially confirm it can NEVER write to anything;
  a reviewer of `deploy.yml` confirms its write surface is exactly
  Pages. Hiding both inside one workflow with conditional steps
  (`if: github.event_name == 'push'`) leaks the `pages: write`
  permission into PR-build runs even though the publish step never
  fires for PRs — a defence-in-depth foot-gun.
- **Independent failure surfaces**. A flaky deploy step doesn't
  prevent us from re-running just the PR-build job. The two
  workflows show up as two separate status checks on the PR /
  commit.
- **The 10-line duplication is cheap**. We could DRY it via a
  reusable workflow (`workflow_call`), but that adds indirection
  for what amounts to seven `run:` lines. Reusable workflows make
  sense at the org/multi-repo level, not for two adjacent files in
  one repo.

**Alternatives considered**:

- **One combined workflow with `if:` on the deploy job** —
  rejected per the permission-leak argument above.
- **Reusable workflow (`workflow_call`)** — rejected for the
  indirection cost.
- **GitHub-managed "GitHub Pages Jekyll" default workflow** —
  irrelevant (we're not Jekyll).

---

## D4. Concurrency control: `concurrency: { group: 'pages', cancel-in-progress: true }` on `deploy.yml`

**Decision**: The `deploy.yml` workflow declares a single
concurrency group named `pages` with cancellation enabled:

```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```

This satisfies FR-003 ("two pushes in rapid succession → final
state matches the more recent commit") by cancelling any in-flight
deploy when a newer one starts. If commit A is mid-deploy and
commit B's push lands, A is cancelled and B's run owns the
deployment.

`ci.yml` uses `concurrency: { group: 'ci-${{ github.ref }}',
cancel-in-progress: true }` — per-PR cancellation so a fast
sequence of force-pushes doesn't queue up redundant builds.

**Rationale**:

- **`pages` is a "well-known" concurrency-group name in
  GitHub-published examples** for this exact pattern. Using it
  consistently means a reviewer immediately recognises the
  intent.
- **`cancel-in-progress: true`** is the correct semantic for
  deploys: we want the freshest commit live, not "every commit's
  deploy completes in order" — the latter wastes runner minutes
  AND temporarily serves stale code in the gap between A
  finishing and B starting.

**Alternatives considered**:

- **`cancel-in-progress: false`** (queue, don't cancel) —
  rejected; produces the "stale window" described above.
- **Per-commit concurrency group** — rejected; defeats the
  purpose of FR-003 (every push would trigger a fresh deploy
  with no supersession).
- **No concurrency block** — rejected; with a busy `master`
  cadence two deploys could legitimately race for the Pages API
  and one of them would error out with a confusing
  permission-style message.

---

## D5. Workflow gate order: format → lint → typecheck → vitest → build → bundle-size → publish

**Decision**: The exact sequence inside both workflows:

```yaml
- run: npm ci
- run: npm run format:check        # NOT format --write — the workflow MUST NOT mutate
- run: npm run lint
- run: npm run typecheck
- run: npm test
- run: npm run build               # ← deploy.yml only past this point
- run: npm test -- tests/integration/deploy-base-alignment.spec.ts
- run: npm run bundle-size
- (publish steps for deploy.yml)
```

The base-alignment spec runs AFTER `npm run build` because it
inspects `dist/`. The bundle-size check runs after the build for
the same reason. The format check uses `format:check` (added as a
new script if absent — it is already in `package.json`'s
`scripts` per the project's existing conventions, see
`tools-of-the-existing-build`).

**Rationale**:

- **Cheapest-fail-first**: format / lint fail in seconds; type-
  check in ~30 s; vitest in ~45 s; build in ~10 s. Failing
  early saves runner minutes.
- **`build` runs once**, both for the bundle-size check and as
  the source for the deploy artifact. We don't rebuild between
  `bundle-size` and `upload-pages-artifact`.
- **`format:check` not `format --write`**: a deploy workflow
  that reformats on the fly would either silently mask a missing
  local format pass (bad) or try to push a formatting commit
  (worse — needs `contents: write`). Hard fail is the only
  acceptable option.

**Alternatives considered**:

- **Run vitest in parallel with typecheck** — rejected; saving
  ~30 s isn't worth the YAML complexity, and parallel jobs eat
  more concurrent minutes from the GitHub-hosted runner pool.
- **Skip `npm test` on the deploy.yml path** ("PR already ran
  it") — rejected; FR-005 explicitly requires the deploy gate to
  re-run tests against the same commit it ships, defending
  against the case where a force-push or a missed branch-
  protection setting lets an untested commit reach `master`.

---

## D6. PWA manifest paths: function-form yields `start_url` / `scope` / `id` from `base` literal

**Decision**: Inside the `defineConfig` function body, the manifest
object is constructed inline with `start_url`, `scope`, and `id`
all set to the `base` value. The original `manifest` const (defined
outside the function) keeps non-path fields:

```ts
const manifest = {
  name: 'Taiwan Coordinate Map',
  short_name: 'CoordMap',
  description: '...',
  theme_color: '#0f172a',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  // start_url, scope, id are set per-build, NOT here
  icons: [
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
} as const;

export default defineConfig(({ command }) => {
  const base = command === 'build' ? '/pwa_map/' : '/';
  return {
    base,
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          ...manifest,
          start_url: base,
          scope: base,
          id: base,
        },
        // ... workbox unchanged
      }),
      devManifestPlugin({ ...manifest, start_url: base, scope: base, id: base }),
    ],
    // ...
  };
});
```

Note the icon paths (`'icons/icon.svg'`) are RELATIVE — they don't
start with `/`. Vite's PWA plugin resolves them against `base` at
build time, so they end up as `/pwa_map/icons/icon.svg` in the
emitted `manifest.webmanifest`. This is the behaviour we want and
it doesn't require touching the icon entries.

**Rationale**:

- The three path fields (`start_url`, `scope`, `id`) MUST agree
  with `base`. Constructing them from the same source means they
  cannot drift. The deploy-base-alignment spec asserts they do
  agree.
- The `devManifestPlugin` (`src/pwa/devManifestPlugin.ts` from
  feature 005) serves a synthetic manifest in dev mode; passing
  the dev-time `base` (`'/'`) keeps `npm run dev` working.

**Alternatives considered**:

- **Hardcode `/pwa_map/` in the manifest, regardless of mode** —
  rejected; would break `npm run dev` (the dev manifest would
  reference paths the dev server doesn't serve).
- **Use a placeholder + string-replace post-build** — rejected;
  reinvents what the function form gives us natively.

---

## D7. Service-worker registration scope: auto-derived from script URL (no code change to `registerSW.ts`)

**Decision**: Make NO change to `src/pwa/registerSW.ts`. The
`virtual:pwa-register` import + `workboxRegister({ immediate: true,
... })` call infers the SW registration scope from the script's URL.
After the build, the SW lives at `/pwa_map/sw.js`, and the registration
scope auto-derives to `/pwa_map/`.

**Rationale**:

- The Service Worker spec defines the default scope as the URL
  derived from the SW script's path. `vite-plugin-pwa` uses the
  default registration without an override `scope` argument unless
  the consumer passes one. Since `registerSW.ts` doesn't pass a
  `scope`, the default applies — which equals `base` after our
  amendment.
- Passing `scope: '/pwa_map/'` explicitly would be redundant AND
  would require us to thread the `base` value through to
  `registerSW.ts`'s build-time imports — adding code for a no-op.
- The deploy-base-alignment spec asserts that `dist/sw.js` is
  emitted under the base path (i.e., the file `dist/sw.js` exists
  and the production HTML's SW registration call resolves to
  `/pwa_map/sw.js`).

**Alternatives considered**:

- **Pass an explicit `scope: '/pwa_map/'` in `registerSW.ts`** —
  rejected; redundant with the auto-derivation, and would have to
  flip with `import.meta.env.MODE` or similar to keep dev working.
- **Add a `scope` field in the `vite-plugin-pwa` config** — only
  works if you `injectRegister: 'auto'` (we use `injectRegister:
  false` per ADR 0023's manual-registration choice).

---

## D8. Repo Pages source: one-time `Settings → Pages → Source: GitHub Actions`

**Decision**: A maintainer with admin access opens the repo's
`Settings → Pages` page and sets `Source` to "GitHub Actions" (NOT
"Deploy from a branch"). This is a one-time click, documented in
`quickstart.md` as the only manual step required to onboard the
deploy automation.

**Rationale**:

- This is the platform's required handshake: GitHub needs to know
  that workflow runs (not branch pushes) supply the deployment
  artifact. Without this, `actions/deploy-pages` errors with
  "Pages is not configured for this repo".
- It IS a one-time step — it persists in repo settings and never
  needs to be re-done unless someone explicitly toggles it back.
- It cannot be done from a workflow (the GitHub Pages settings
  API requires `admin:repo` scope which workflows don't get).

**Alternatives considered**:

- **Add a workflow that programmatically sets the Pages source
  via the REST API** — rejected; would require a PAT with
  `admin:repo` scope, contradicting FR-015 / SC-005.
- **Have the workflow auto-detect "Pages not configured" and
  print a helpful error** — partially adopted: the workflow's
  failure mode IS already informative (deploy-pages prints the
  setup link). No extra detection code needed.

---

## D9. The `index.html` does NOT use `<base href>`; URL rewriting is entirely Vite-driven

**Decision**: `index.html` keeps its current top of file unchanged
(no `<base>` tag introduced). Vite rewrites all asset URLs at build
time per the `base` config — so `<script type="module" src="/src/app/main.ts">`
becomes `<script type="module" src="/pwa_map/assets/index-XXXXXX.js">`
in `dist/index.html`. The PWA manifest link rewrites the same way.

**Rationale**:

- `<base href>` affects ALL relative URLs on the page (anchors,
  forms, AJAX) in ways that interact subtly with our existing
  components (e.g., the `Go-to` dialog's `<a>` links to recent
  entries). Avoiding it removes a class of bugs.
- Vite's mechanism is well-documented and tested across the
  vite-plugin-pwa community.

**Alternatives considered**:

- **`<base href="/pwa_map/">`** — rejected per above.
- **Hardcoded paths in `index.html`** — rejected; defeats the
  point of having a build step.

---

## D10. TDD anchor: the `deploy-base-alignment.spec.ts` test lands RED before the `vite.config.ts` amendment

**Decision**: Per Constitution Principle II, the test asserting
that `dist/manifest.webmanifest`'s `start_url` / `scope` / `id`
all equal the value baked into `dist/index.html`'s asset URLs lands
FIRST (RED — the current `dist/` from the v007 build has `start_url:
'/'`). Then `vite.config.ts` is amended; `npm run build` regenerates
`dist/`; the test turns GREEN.

This is the load-bearing safety net for FR-010 ("PWA must work
under the GitHub Pages URL"). A future contributor who, say,
hardcodes `start_url: '/'` in the manifest object would
immediately fail this test.

The test is written to be base-agnostic: it doesn't hardcode
`/pwa_map/` — it READS the `base` value out of `dist/index.html`'s
emitted asset URLs and asserts the manifest agrees. So the same
test passes after a future custom-domain migration that flips
`base` back to `/`.

**Rationale**: Same as research D9 in feature 006 / D12 in
feature 007 — a regression in the base-path alignment is a
silent failure mode (the SW might register against the wrong
scope; the install banner might point at the wrong URL; the
manifest's `id` change might orphan installed PWAs). Test-first
catches this at build time, not at user-report time.

**Alternatives considered**: None. TDD is non-negotiable per
constitution.

---

## Cross-decision matrix

| ID  | Affects                                                                                       |
| --- | --------------------------------------------------------------------------------------------- |
| D1  | `.github/workflows/deploy.yml`, `quickstart.md`, ADR 0028                                     |
| D2  | `vite.config.ts`, `tests/integration/deploy-base-alignment.spec.ts`, ADR 0028, UI doc 0008    |
| D3  | `.github/workflows/{ci,deploy}.yml`, ADR 0028                                                  |
| D4  | `.github/workflows/{ci,deploy}.yml`                                                            |
| D5  | `.github/workflows/{ci,deploy}.yml`, `package.json` `deploy:check` alias                       |
| D6  | `vite.config.ts` (manifest construction), `src/pwa/devManifestPlugin.ts` (input change), spec  |
| D7  | (no source change) — but documented in ADR 0028 + spec                                         |
| D8  | `quickstart.md` (the one-time setup), ADR 0028                                                |
| D9  | `index.html` (UNCHANGED), ADR 0028                                                            |
| D10 | `tasks.md` ordering                                                                           |
