# Contract: `.github/workflows/deploy.yml` — master push → build + Pages deploy

**File**: `.github/workflows/deploy.yml` (NEW)
**Triggers**: `push` to `master` only.
**Verifies**: spec FR-001..FR-006, FR-008, FR-009, FR-012..FR-017;
research D1, D3, D4, D5.

## §1. Top-level shape

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

# Cancel any in-flight deploy when a newer master push arrives —
# the most-recent commit is what should be live (FR-003 / research D4).
concurrency:
  group: pages
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build:
    # ... see §2
  deploy:
    # ... see §3
```

The top-level `permissions: { contents: read }` is the workflow-
default. Each job MAY narrow further. The publish job (`deploy`)
broadens it to add `pages: write` and `id-token: write` — and
ONLY that job carries those permissions.

## §2. `build` job

```yaml
build:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: npm

    - run: npm ci

    - name: Format check
      run: npm run format:check

    - name: Lint
      run: npm run lint

    - name: Typecheck
      run: npm run typecheck

    - name: Unit + integration tests (build-independent)
      run: npm test

    - name: Build production bundle
      run: npm run build

    - name: Verify base-path alignment in dist/
      run: npx vitest run tests/integration/deploy-base-alignment.spec.ts

    - name: Bundle-size delta gate
      run: npm run bundle-size

    - uses: actions/configure-pages@v5

    - uses: actions/upload-pages-artifact@v3
      with:
        path: ./dist
```

**Invariants**:

- Step order matches research D5 (cheapest-fail-first).
- `format:check` (NOT `format --write`) — workflow MUST NOT mutate
  the working tree.
- `npm test` runs the standard suite; the deploy-base-alignment
  spec is invoked separately AFTER `npm run build` because it
  reads `dist/`.
- `actions/upload-pages-artifact@v3` is the LAST step in this job;
  the `deploy` job's `actions/deploy-pages@v4` consumes its output.

## §3. `deploy` job

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  timeout-minutes: 10

  permissions:
    contents: read
    pages: write
    id-token: write

  environment:
    name: github-pages
    url: ${{ steps.deployment.outputs.page_url }}

  steps:
    - id: deployment
      uses: actions/deploy-pages@v4
```

**Invariants**:

- `needs: build` — the deploy CANNOT run if the build job failed
  or was skipped.
- `permissions:` is the EXACT minimum for `actions/deploy-pages`:
  `pages: write` (publish), `id-token: write` (OIDC handshake),
  `contents: read` (read the artifact). No `actions: write`, no
  `pull-requests: write`, no `repository-projects: write`.
- `environment.url` reads the deployed URL from the
  `actions/deploy-pages` action's output, populating the GitHub
  Environments view (research D1).
- The job has only ONE step. Adding more steps here (especially
  ones that touch the network) widens the OIDC token's exposure;
  keep this job minimal.

## §4. What this workflow MUST NOT do

- MUST NOT push to any branch (no `git push` step).
- MUST NOT create or modify a `gh-pages` branch (research D1).
- MUST NOT reference `secrets.*` for any auth purpose (FR-015 /
  SC-005).
- MUST NOT carry `pages: write` permission on the `build` job
  (FR-016 / research D3).
- MUST NOT run on PRs (the `on:` block has only `push`).
- MUST NOT use `format --write` or any other workflow step that
  mutates the source tree.
- MUST NOT publish if any gate (format / lint / typecheck / test /
  build / deploy-base-alignment / bundle-size) fails — `needs:
  build` enforces this.

## §5. Failure modes & visibility

| Failure                                       | Visibility                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Format / lint / typecheck / test / build fails | The `build` job fails → no artifact uploaded → `deploy` job is skipped (`needs: build` blocks it). Prior live deploy unchanged (FR-009). Red ✕ on commit. |
| `deploy-base-alignment.spec.ts` fails         | Same as above — gates are inside the `build` job.                                                          |
| Bundle-size gate fails                        | Same as above.                                                                                            |
| `actions/configure-pages` fails               | Build job fails → no deploy. Common cause: repo Pages source not set to "GitHub Actions" (FR-020 setup not done — see quickstart). |
| `actions/deploy-pages` fails                  | Deploy job fails. Build artifact was uploaded but not published. Prior live deploy unchanged. Red ✕ on commit + `Environments → github-pages` shows the failed deploy. |
| `actions/upload-pages-artifact` exceeds limit | Build job fails. Pages artifacts have a 1 GB cap (well above our ~6 KB gzipped bundle).                 |
| Concurrency cancellation (newer push arrived) | The cancelled run shows `cancelled` status (NOT `failure`) — this is the FR-003 path and is expected.   |

## §6. Required test coverage for this workflow

Workflow files are validated by GitHub on push (YAML parse +
referenced action existence). We do NOT add `actionlint`. Coverage
is provided indirectly:

- `tests/integration/deploy-base-alignment.spec.ts` — covers the
  build-output-side correctness that this workflow depends on.
- The first deploy IS the smoke test (T-final in tasks.md): if
  the URL goes live and the PWA installs, the workflow works.

There is no Vitest spec that asserts YAML structure. Per the spec
template's "skip if project is purely internal" guidance for
contracts: the workflow IS an external interface (to GitHub's
runner), but the contract is owned by GitHub's schema, not by us.

## §7. Out of scope (for this workflow)

- PR preview deployments at unique URLs (out of scope per spec).
- Slack / email / other-channel notifications.
- Auto-creating GitHub Releases.
- Dependency-update PRs (Dependabot, Renovate) — those are
  separate features.
- Lighthouse CI assertion (the existing `lighthouse.yml` covers
  it; this workflow does NOT re-run it).
