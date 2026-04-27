# Phase 1 Data Model: GitHub Pages Auto-Deploy on Master

**Feature**: `008-gh-pages-deploy` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature has **no persisted data shapes** — no localStorage,
no Cache, no IndexedDB, no databases. The "data" of this feature
is build-and-deploy-time state: workflow inputs, the produced
artifact, and the platform-side deployment record. Every shape is
either GitHub-defined or derived from project source.

---

## §1. `WorkflowEvent` (GitHub-side trigger)

**Owner**: GitHub (the platform). We don't define this; we declare
which subset triggers each workflow.

```text
ci.yml         <-  pull_request {branches: [master]}
deploy.yml     <-  push         {branches: [master]}
```

**Shape (informational, derived from GitHub Actions docs)**:

| Field                    | Notes                                                   |
| ------------------------ | ------------------------------------------------------- |
| `github.event_name`      | `pull_request` (ci.yml) or `push` (deploy.yml).         |
| `github.ref`             | `refs/heads/master` for the deploy path.                 |
| `github.sha`             | The commit being built / deployed.                       |
| `github.event.pull_request.head.sha` | (ci.yml only) the PR head commit being verified.   |
| `github.run_id`, `run_number`, `run_attempt` | Identifies the specific run for log lookup. |

**Invariants**:

- `deploy.yml` MUST NOT receive PR events: enforced by its
  `on: { push: ... }` declaration alone (no `pull_request`).
- `ci.yml` MUST NOT receive push-to-master events: enforced by its
  `on: { pull_request: ... }` declaration alone.
- Concurrency group `pages` is shared with `actions/deploy-pages`'s
  internal default group of the same name — declaring it
  explicitly makes our cancellation contract visible.

---

## §2. `BuildArtifact` (per-run, in-runner)

**Owner**: the build job. Lives entirely inside the runner's
filesystem under `dist/` after `npm run build` completes; uploaded
by `actions/upload-pages-artifact@v3` to GitHub's artifact storage;
consumed by `actions/deploy-pages@v4` to publish.

**Shape**:

```text
dist/
├── index.html                              # base="/pwa_map/" baked into asset URLs
├── manifest.webmanifest                    # start_url=/pwa_map/, scope=/pwa_map/, id=/pwa_map/
├── sw.js                                   # workbox-generated; precaches dist/* under /pwa_map/
├── workbox-<hash>.js                       # workbox runtime
├── icons/
│   └── icon.svg                            # /pwa_map/icons/icon.svg
└── assets/
    ├── index-<hash>.js                     # entry JS bundle
    ├── style-<hash>.css                    # styles
    ├── maplibre-<hash>.js                  # async chunk
    └── workbox-window.prod.es5-<hash>.js   # async chunk
```

**Invariants** (asserted by `tests/integration/deploy-base-alignment.spec.ts`):

- `dist/manifest.webmanifest` exists.
- `JSON.parse(dist/manifest.webmanifest).start_url` ===
  `JSON.parse(dist/manifest.webmanifest).scope` ===
  `JSON.parse(dist/manifest.webmanifest).id`.
- That common value (call it `B`) is referenced by `dist/index.html`'s
  `<script src="...">` and `<link rel="stylesheet" href="...">` tags
  as a URL prefix (i.e., every src/href that points into the build
  starts with `B`).
- `dist/sw.js` exists at `dist/sw.js` (the URL `${B}sw.js` after
  serving). Its `precacheAndRoute([...])` URLs all start with `B`
  (verified by string-matching the emitted SW source).
- `dist/index.html` does NOT contain a `<base href>` tag (per
  research D9).

These invariants are tested **after** `npm run build` runs in the
spec — i.e., the test is an integration spec gated on the dist tree
existing.

---

## §3. `DeployRecord` (GitHub-side, post-publish)

**Owner**: GitHub Pages platform. Created by `actions/deploy-pages`
on success; visible in the repo's `Environments → github-pages`
view.

**Shape (informational)**:

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| `environment`   | `github-pages`                                                      |
| `url`           | `https://swim-fish.github.io/pwa_map/`                              |
| `sha`           | The commit just deployed.                                           |
| `created_at`    | Timestamp of `actions/deploy-pages` success.                       |
| `status`        | `success` / `failure` / `in_progress` / `cancelled`.                |

**Invariants**:

- For every successful `deploy.yml` run on `master`, exactly one
  `DeployRecord` is created with the run's `github.sha`.
- Failed or cancelled runs do NOT create a `DeployRecord`; the
  prior `success` record remains the live one.
- The `url` field is stable across deploys — it does not change
  per-commit. (This is the source of truth for the project's
  public URL.)

---

## §4. `ViteConfigShape` (build-config contract)

**Owner**: `vite.config.ts`. The function form documented in
research D2.

```ts
export default defineConfig(({ command }: { command: 'serve' | 'build' }) => {
  const base: '/' | '/pwa_map/' = command === 'build' ? '/pwa_map/' : '/';
  return {
    base,
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          ...manifestBase,
          start_url: base,
          scope: base,
          id: base,
        },
        workbox: { /* unchanged */ },
        devOptions: { enabled: false },
      }),
      devManifestPlugin({ ...manifestBase, start_url: base, scope: base, id: base }),
    ],
    resolve: { /* unchanged */ },
    build: { /* unchanged */ },
    test: { /* unchanged */ },
  };
});
```

**Invariants**:

- `base` is always one of the two literal strings `'/' | '/pwa_map/'`.
  No template strings, no env-var pulls (research D2 alternatives).
- `manifest.start_url === manifest.scope === manifest.id === base`
  in EVERY config branch.
- `manifestBase` (the const outside the function) does NOT contain
  `start_url`, `scope`, or `id` — those three live ONLY in the
  function-body construction, so the function form is the single
  point where they get a value.
- `command === 'serve'` ⇔ `npm run dev` (preserved local-dev path).
- `command === 'build'` ⇔ `npm run build` AND `npm run preview`
  (which both serve the production-base configuration).

---

## §5. `WorkflowJobMatrix` (the job DAG inside each workflow)

### `ci.yml`

```text
       ┌─────────────────────────────┐
       │ trigger: pull_request: master │
       └────────────┬─────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ verify (single job)  │
         │ ─ checkout            │
         │ ─ setup-node@22       │
         │ ─ npm ci              │
         │ ─ format:check        │
         │ ─ lint                │
         │ ─ typecheck           │
         │ ─ vitest              │
         │ ─ build               │
         │ ─ deploy-base-spec    │
         │ ─ bundle-size         │
         └──────────────────────┘
```

### `deploy.yml`

```text
       ┌──────────────────────────┐
       │ trigger: push: master     │
       │ concurrency: pages, c-i-p │
       └────────────┬──────────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │ build (job)            │
         │ ─ checkout              │
         │ ─ setup-node@22         │
         │ ─ npm ci                │
         │ ─ format:check          │
         │ ─ lint                  │
         │ ─ typecheck             │
         │ ─ vitest                │
         │ ─ build                 │
         │ ─ deploy-base-spec      │
         │ ─ bundle-size           │
         │ ─ configure-pages       │
         │ ─ upload-pages-artifact │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │ deploy (job, depends   │
         │   on build via needs:) │
         │ ─ deploy-pages         │
         │   environment:         │
         │     name: github-pages │
         │     url: ${{...}}      │
         │   permissions:         │
         │     pages: write       │
         │     id-token: write    │
         └────────────────────────┘
```

The deploy step is split into a **second job** (not just a step)
because `actions/deploy-pages` requires the workflow to declare an
`environment:` and the cleanest way to scope the `pages: write` +
`id-token: write` permissions JUST to the publish step is to put
that step alone in its own job with its own permissions block.
The `build` job uses `permissions: { contents: read }` only.

---

## §6. What this feature does NOT add

- **No persisted client-side state**. `pwa_map:prefs`,
  `pwa_map:lastView`, `pwa_map:gotoHistory_v1`,
  `pwa_map:offlineReadyShown`, `pwa_map:installDismissedUntil` are
  untouched. The `prefs` schema is still v2 (feature 007).
- **No new SW cache name or runtime cache rule**. The three tile
  caches (`osm-tiles`, `nlsc-tiles`, `google-tiles`) and the
  workbox precache are unchanged in name and contents.
- **No new app source modules**. The deploy-base-alignment spec
  is the only NEW `.ts` file; it lives under `tests/`, not `src/`.
- **No new runtime dependency**. No new entries in
  `package.json`'s `dependencies` or `devDependencies`.
- **No new manifest icons**. Existing `icons/icon.svg` continues
  to be the sole icon entry; only its emitted URL prefix
  changes.
- **No telemetry / analytics**. Nothing is sent to a third party
  about deploys.
- **No `gh-pages` branch**. The repo's branch list does NOT gain
  a `gh-pages` entry (research D1).
- **No environment-specific secrets** (FR-015). The workflows'
  `env:` blocks reference zero entries from `secrets.*`.
