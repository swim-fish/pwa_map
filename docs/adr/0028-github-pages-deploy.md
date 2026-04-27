# ADR 0028 — GitHub Pages auto-deploy + subpath base-path strategy

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/008-gh-pages-deploy/`
**Supersedes**: —
**Related**: ADR 0023 (SW registration strategy — relevant to D7),
ADR 0024 (dev-mode manifest middleware — co-amended in D6)

## Context

Features 001–007 shipped a complete, locally-runnable PWA but had
no production deploy mechanism. With the project now public on
GitHub, the natural deployment target is GitHub Pages — free for
public repos, integrated with the platform, and zero infrastructure
to manage. The user (`/speckit.specify` request) chose GitHub Pages
explicitly: "專案準備使用 GitHub deploy page 的方式部署".

Two design forces are in tension:

1. **Local-dev experience must be preserved** — `npm run dev` and
   the existing test suite cannot be disrupted by deploy-time
   changes (FR-018 / SC-008).
2. **Production correctness under a subpath URL** — without a
   custom domain, GitHub Pages publishes at
   `https://<owner>.github.io/<repo>/`, requiring asset URLs and
   PWA manifest paths to be subpath-aware (FR-010 / FR-011 /
   SC-006 / SC-007).

This ADR captures the seven design decisions that fell out of
those forces, plus the rollback path in case a deploy goes bad.

## Decision

### Part 1 — Pages-from-Actions (NOT a `gh-pages` branch)

We use the modern GitHub Actions trio:
`actions/configure-pages@v5` + `actions/upload-pages-artifact@v3` +
`actions/deploy-pages@v4`. The repo's Pages source is set ONCE to
"GitHub Actions" via `Settings → Pages` (a one-time admin click,
documented in `quickstart.md`). No `gh-pages` branch is created;
no third-party action is used; no PAT is stored in repo Secrets.

Authentication uses the OIDC `id-token: write` permission so
`actions/deploy-pages` mints a per-run token that talks to GitHub's
Pages API. Per FR-015 / SC-005, zero long-lived secrets are added.

### Part 2 — Two workflow files (NOT one combined workflow)

`.github/workflows/ci.yml` runs on `pull_request` to `master`,
carries `permissions: { contents: read }` only, and runs the gate
sequence (format / lint / typecheck / vitest / build /
deploy-base-alignment / bundle-size). It does NOT publish.

`.github/workflows/deploy.yml` runs on `push` to `master`, carries
`permissions: { contents: read }` at the workflow level, and has
two jobs: `build` (same gate sequence + `actions/upload-pages-artifact`)
and `deploy` (which `needs: build` and carries the elevated
`pages: write` + `id-token: write` permissions on its own scope only,
running just `actions/deploy-pages`).

The split is deliberate. A combined workflow with `if:` on the
deploy job would leak `pages: write` permission into PR-build
runs even though the publish step never fires for them — a
defence-in-depth foot-gun. The ~10-line duplication between the
two files' build steps is the price; reusable workflows
(`workflow_call`) were rejected as needless indirection at our
scale.

### Part 3 — Vite `defineConfig` function form

`vite.config.ts` is a function of `{ command }`:

- `command === 'build'` → `base = '/pwa_map/'`
- `command === 'serve'` → `base = '/'`

Both `npm run build` and `npm run preview` are `command === 'build'`
for Vite's purposes (preview serves the already-built `dist/`),
so the preview URL becomes `http://localhost:4173/pwa_map/` —
matching production exactly. `npm run dev` is `command === 'serve'`
and stays at `http://localhost:5173/`.

This pattern was chosen over: separate `vite.config.dev.ts` /
`vite.config.prod.ts` (duplication), env-var `VITE_BASE` (extra
contributor knowledge), and a `<base href>` in `index.html`
(double-rewrite hazards with relative URLs).

### Part 4 — Manifest paths constructed inside the function body

The PWA manifest's `start_url`, `scope`, and `id` are NOT in the
`manifestBase` constant. They are added inside the `defineConfig`
function body from the same `base` literal:

```ts
const manifest = { ...manifestBase, start_url: base, scope: base, id: base };
```

This makes drift impossible. The deploy-base-alignment spec
(`tests/integration/deploy-base-alignment.spec.ts`) asserts that
after every `npm run build`, the emitted `dist/manifest.webmanifest`'s
`start_url === scope === id` AND that common value matches the
URL prefix Vite emits in `dist/index.html`'s asset hrefs.

Setting `id` explicitly is non-trivial: per W3C, `id` is the
unique identifier for the installed app. Without an explicit `id`,
Chromium treats it as `start_url` — which is what we want here,
but setting it explicitly future-proofs against a later
`start_url` change (e.g., a query param) accidentally creating a
new "app identity" and orphaning installed PWAs.

### Part 5 — NO `<base href>` in `index.html`

`index.html` does not gain a `<base>` tag. Vite's URL rewriting is
the sole mechanism for prepending the base. `<base href>` would
affect all relative URLs on the page (anchors, forms, AJAX) in
ways that interact subtly with our existing components — avoiding
it removes a class of bugs.

### Part 6 — NO change to `src/pwa/registerSW.ts`

The Service Worker's registration scope is auto-derived from its
script URL. After the build, `sw.js` lives at `dist/sw.js` (URL
`/pwa_map/sw.js`), and its scope auto-derives to `/pwa_map/`. We
do NOT pass an explicit `scope` argument to `registerSW`. This
avoids threading the `base` value through to the runtime
registration code — adding code for a no-op.

### Part 7 — Repo Pages source is a one-time human click

The repo's Pages "Source" must be set to "GitHub Actions" via
`Settings → Pages`. This cannot be done from a workflow without a
PAT carrying `admin:repo` scope, which would contradict FR-015 /
SC-005. The single click is documented as the only manual setup in
`quickstart.md` and in the PR description for this feature.

A second optional one-time click (`Settings → Branches → require
verify (pull_request) check`) is needed to fully satisfy spec
US2 AS2 (merge button blocked when PR build fails). Without it,
the failing build is still surfaced on the PR (US2 AS1) but
maintainers must honour it manually.

## Rollback

There is NO one-button rollback. The recovery path for a bad
deploy is:

1. `git revert <bad-commit>` on `master`.
2. Push the revert.
3. `deploy.yml` triggers, builds, and ships the reverted code.

The previous successful build remains live at the deployed URL
during all of the above (FR-009 / SC-003) — `actions/deploy-pages`
publishes atomically; a failed deploy never replaces the prior
successful artifact. So the URL is never down; it just serves the
older version until the revert lands.

## Consequences

### Positive

- Public site stays in lock-step with `master` automatically;
  release process becomes "merge to master".
- PR contributors get build feedback before merge (US2).
- Zero long-lived secrets to manage / rotate.
- The single source of truth for the subpath (`PROD_BASE =
'/pwa_map/'` constant in `vite.config.ts`) means a future
  custom-domain migration is a one-line change.
- The deploy-base-alignment spec is a permanent regression net for
  manifest / asset path drift.

### Negative / cost

- One-time admin clicks (`Settings → Pages`, branch protection)
  cannot be automated — they require admin access AND a PAT to
  automate. We accept the human-step cost in exchange for keeping
  the workflow secret-free.
- `npm run preview` URL changed (`/pwa_map/` instead of `/`) —
  contributors have to update their muscle memory once.
- The two workflow files duplicate ~10 lines of step definition.
  Acceptable cost for least-privilege auditability.
- Workflow YAML is not unit-tested — first deploy IS the test.

### Neutral

- The `lighthouse.yml` workflow currently triggers on `main` (not
  `master`). Out of scope for this feature; a follow-up will
  consolidate.

## Alternatives considered

1. **Push to a `gh-pages` branch via `peaceiris/actions-gh-pages`** —
   rejected. Adds a third-party action (supply-chain trust hop)
   AND historically prone to "deploy succeeded but the branch
   wasn't pushed forcibly" incidents. The official actions handle
   atomic publish + propagation for us.

2. **One workflow with `if: github.event_name == 'push'` on the
   deploy job** — rejected. Even with the `if`, the `pages: write`
   - `id-token: write` permissions sit at workflow / job declaration
     level and are visible to PR runs in the workflow YAML — a
     defence-in-depth liability.

3. **Set `base` from `process.env.VITE_BASE_PATH`** — viable but
   requires every contributor to know the env var name AND the
   workflow to set it explicitly. The hardcoded `PROD_BASE` is
   the simpler defaults-first approach.

4. **`<base href="/pwa_map/">` in `index.html`** — rejected per
   Part 5 (relative-URL doubling hazards).

5. **Pass an explicit `scope: '/pwa_map/'` in `registerSW.ts`** —
   rejected per Part 6 (redundant with auto-derivation; would
   need to flip with `import.meta.env.MODE` or similar).

6. **Add a workflow that programmatically sets the Pages source
   via the REST API** — rejected; would require a PAT with
   `admin:repo` scope, contradicting FR-015 / SC-005.

7. **Run the lighthouse audit against the deployed URL inside
   `deploy.yml`** — rejected for THIS feature (out of scope per
   spec). The existing `lighthouse.yml` still runs against
   `npm run preview`, which (after this feature) IS the
   subpath-equivalent URL — so the existing gate transitively
   covers what a deployed-URL audit would.

## References

- spec: `specs/008-gh-pages-deploy/spec.md`
- plan: `specs/008-gh-pages-deploy/plan.md`
- research: `specs/008-gh-pages-deploy/research.md` (decisions
  D1–D10)
- contracts: `specs/008-gh-pages-deploy/contracts/{deploy-workflow,ci-workflow,vite-config-amendment}.md`
- UI record: `docs/ui/0008-deploy-and-base-path.md`
- ADR 0023 (SW registration strategy) — basis for Part 6's "no
  scope override needed" decision.
- ADR 0024 (dev-mode manifest middleware) — receives the
  function-form's `base`-aware manifest in dev.
