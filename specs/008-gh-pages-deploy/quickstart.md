# Quickstart: GitHub Pages Auto-Deploy

**Feature**: `008-gh-pages-deploy` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This is the orientation doc for an engineer implementing or
reviewing feature 008. Read [plan.md](./plan.md) and
[research.md](./research.md) first.

## TL;DR

```
push master  ───▶  .github/workflows/deploy.yml
                    │
                    ├─ build job
                    │   ├─ npm ci
                    │   ├─ format:check / lint / typecheck / test
                    │   ├─ vite build
                    │   ├─ deploy-base-alignment.spec
                    │   ├─ bundle-size
                    │   └─ upload-pages-artifact
                    │
                    └─ deploy job  (needs: build)
                        └─ deploy-pages → https://swim-fish.github.io/pwa_map/

PR → master  ───▶  .github/workflows/ci.yml
                    └─ verify (same gates, no publish)
```

## ONE-TIME REPO SETUP (FR-020 / SC-009)

The first deploy will fail with "Pages is not configured for this
repo" UNTIL someone with admin access does this single click:

1. Open `https://github.com/swim-fish/pwa_map/settings/pages`.
2. Under **Build and deployment → Source**, choose
   **GitHub Actions**. (NOT "Deploy from a branch".)
3. Click **Save** if prompted.

That's it. No PAT to create, no deploy key, no Pages secret. After
this one click, every subsequent deploy is fully automated.

If branch protection on `master` is desired (recommended for the
PR-build status check to actually gate merges per US2):

1. Open `https://github.com/swim-fish/pwa_map/settings/branches`.
2. Add a rule for `master`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** and add
   `verify (pull_request)` (the job name from `ci.yml`).
5. Save.

## Run the dev server

```bash
npm install
npm run dev
# open http://localhost:5173/
#                        ^ note the / — dev mode keeps base: '/'
```

The Service Worker does NOT register in dev mode (per
`src/pwa/registerSW.ts`'s early return on `import.meta.env.DEV`),
so subpath alignment doesn't apply in dev.

## Run the production preview locally

```bash
npm run build
npm run preview
# open http://localhost:4173/pwa_map/
#                          ^^^^^^^^^^^ note the new subpath
```

The preview command serves `dist/`. Because `vite build` baked
`base: '/pwa_map/'`, the preview also serves at the subpath.
**This is the deploy-equivalent URL**; if the preview works here,
the deploy works at the same path on `swim-fish.github.io`.

## Run the test suites

```bash
# Vitest unit + integration
npm test

# Vitest, including the build-output spec (requires npm run build first)
npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts

# Bundle-size check
npm run bundle-size

# Local one-shot of the full deploy gate
npm run deploy:check
```

`deploy:check` is the new `package.json` script that runs the same
sequence the workflow runs. Use it to smoke-test before pushing.

## Iteration order (TDD discipline)

Follow research D10. Concrete sequence:

1. **`tests/integration/deploy-base-alignment.spec.ts`** — write
   the 8 cases per `contracts/vite-config-amendment.md` §5. Run
   `npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts`.
   Should be RED (current `dist/` from feature 007 has `start_url:
   '/'`).

2. **`vite.config.ts`** — switch to function form per the contract.
   Re-run `npm run build && vitest run ...`. Cases (1)–(6) turn
   green. Cases (7)–(8) (the import-and-call ones) need no rebuild.

3. **Add `format:check` and `deploy:check` to `package.json`**
   `scripts` (if `format:check` doesn't already exist; it does in
   the current package).

4. **`.github/workflows/ci.yml`** — write per `contracts/ci-workflow.md`.
   Push to a feature branch; the workflow does NOT run yet because
   the trigger is `pull_request: { branches: [master] }`. To
   exercise it, open a draft PR against `master`.

5. **`.github/workflows/deploy.yml`** — write per
   `contracts/deploy-workflow.md`. The workflow won't run until
   merged to `master`.

6. **One-time repo setup** — the maintainer does the Settings →
   Pages click documented above.

7. **Documentation** — write `docs/ui/0008-deploy-and-base-path.md`
   and `docs/adr/0028-github-pages-deploy.md`. Update
   `docs/adr/README.md` and `docs/ui/README.md` indexes.

8. **Final gates locally** —
   `npm run format && npm run lint && npm run typecheck && npm test
   && npm run build && npx vitest run tests/integration/deploy-base-alignment.spec.ts
   && npm run bundle-size`. All green ⇒ ready to merge.

9. **Merge → first deploy** — opening the PR triggers `ci.yml`;
   merging triggers `deploy.yml`. Within ~10 minutes the URL
   `https://swim-fish.github.io/pwa_map/` should serve the build.

## Files cheat sheet

| Path                                                    | Status   | Purpose                                                          |
| ------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `.github/workflows/deploy.yml`                          | NEW      | Master push → build + deploy via Pages-from-Actions.             |
| `.github/workflows/ci.yml`                              | NEW      | PR → build verification (same gates, no publish).                |
| `vite.config.ts`                                        | AMENDED  | Function form; conditional `base`; manifest paths driven by base. |
| `package.json`                                          | AMENDED  | Add `deploy:check` script (a local smoke alias).                  |
| `tests/integration/deploy-base-alignment.spec.ts`       | NEW      | Asserts dist/ manifest + index.html + sw.js agree on base.        |
| `docs/ui/0008-deploy-and-base-path.md`                  | NEW      | UI record per Principle III (URL change documented).              |
| `docs/adr/0028-github-pages-deploy.md`                  | NEW      | ADR per Principle V.                                              |

## Tripwires (what NOT to do)

- ❌ **Do NOT** add `<base href="/pwa_map/">` to `index.html` —
  Vite already rewrites all asset URLs (research D9).
- ❌ **Do NOT** create a `gh-pages` branch — we use the modern
  Pages-from-Actions path (research D1).
- ❌ **Do NOT** add a PAT or any secret to repository Secrets —
  the OIDC `id-token` mechanism handles auth (FR-015 / SC-005).
- ❌ **Do NOT** carry `pages: write` permission on `ci.yml` or on
  the `build` job in `deploy.yml` — only the `deploy` job in
  `deploy.yml` gets it (FR-016 / research D3).
- ❌ **Do NOT** combine the two workflows into one with `if:` —
  same reason (research D3).
- ❌ **Do NOT** use `npm run format` (which writes) in the
  workflow — use `npm run format:check` (which fails if dirty).
- ❌ **Do NOT** hardcode `start_url: '/pwa_map/'` in the manifest
  object outside the function — they MUST come from the function-
  body `base` value (research D6 + the contract's invariants).
- ❌ **Do NOT** modify `src/pwa/registerSW.ts` — SW scope auto-
  derives correctly (research D7).
- ❌ **Do NOT** change the runtime cache rules from feature 007
  (osm-tiles / nlsc-tiles / google-tiles `expiration` block).

## Manual smoke test (after first deploy)

After `https://swim-fish.github.io/pwa_map/` goes live:

1. Hard-refresh in Chromium. The PWA should load without console
   errors.
2. Open DevTools → Application → Manifest. `start_url`, `scope`,
   `id` should all be `/pwa_map/`. Icon URL should be
   `/pwa_map/icons/icon.svg`.
3. DevTools → Application → Service Workers. `sw.js` should be
   registered with scope `/pwa_map/`.
4. DevTools → Application → Storage → Cache Storage. After a
   minute of panning the map, the three runtime caches
   (`osm-tiles` / `nlsc-tiles` / `google-tiles`) should appear
   AND the `workbox-precache-v2-*` entry should be present.
5. Open the Settings sheet (gear icon). Three rows show counts;
   "Clear all" works (feature 007 still functional under the
   subpath).
6. Install the PWA (feature 005's banner). After install, open
   from the home screen — it should launch into
   `/pwa_map/` with the correct title and icon.
7. Reload to test the offline-ready toast (feature 004) — it
   should appear once and not block normal use.
8. Push a trivial commit to `master` (e.g., a typo fix in
   `README.md`). Within 10 minutes the deployed site should
   serve the new build (DevTools → Application → Service
   Workers → Update + Skip Waiting → reload — exercises the
   feature 004 update prompt path under subpath).

## Where to look for prior art

- `.github/workflows/lighthouse.yml` — existing workflow showing
  the project's setup-node + npm-cache + run conventions.
- ADR 0023 (`SW registration strategy`) — explains why
  `registerSW.ts` uses manual registration (relevant to research
  D7's "no scope override needed" decision).
- ADR 0021 (`pwa_map:prefs additive schema evolution`) — same
  spirit as the manifest path change here: a build-time evolution
  that doesn't require runtime migration code.
- `docs/ui/0007-settings-tile-cache.md` — feature 007's UI doc
  for the same kind of "behaviour change" framing this feature's
  UI doc 0008 uses.
