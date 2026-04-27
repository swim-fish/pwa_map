# Contract: `.github/workflows/ci.yml` — PR build verification

**File**: `.github/workflows/ci.yml` (NEW)
**Triggers**: `pull_request` against `master` only.
**Verifies**: spec FR-007 (build verification on PR), US2;
research D3, D4, D5.

## §1. Top-level shape

```yaml
name: CI — PR build verification

on:
  pull_request:
    branches: [master]

# Per-PR concurrency: a fast sequence of force-pushes cancels the
# in-flight build in favour of the newest head (research D4).
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Least-privilege: read-only access to the repo. This workflow
# CANNOT publish anywhere (FR-016 / SC-005).
permissions:
  contents: read
```

## §2. `verify` job

```yaml
jobs:
  verify:
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
```

The job's step list is **identical** to `deploy.yml`'s `build`
job's step list up to and including `bundle-size` — but it stops
there (no `configure-pages`, no `upload-pages-artifact`). Research
D3 explicitly accepts the ~10-line duplication in exchange for
permission-isolation.

## §3. Status check naming

The status check posted on the PR is `CI — PR build verification /
verify (pull_request)` (the workflow `name` + ` / ` + the job name
+ event). When configuring branch protection on `master`, the
maintainer can require this exact check before merging — that
satisfies US2 acceptance scenario 2.

## §4. What this workflow MUST NOT do

- MUST NOT have any permission beyond `contents: read`.
- MUST NOT touch GitHub Pages (no `configure-pages`,
  `upload-pages-artifact`, or `deploy-pages` step).
- MUST NOT run on `push` events (the `on:` block has only
  `pull_request`).
- MUST NOT run on PRs targeting branches other than `master` (the
  `branches: [master]` filter restricts).
- MUST NOT mutate the working tree (`format:check`, not
  `format --write`).
- MUST NOT reference any `secrets.*`.

## §5. Failure modes

| Failure              | Visibility                                                            |
| -------------------- | --------------------------------------------------------------------- |
| Any step fails       | Job fails → red ✕ status check on the PR. The PR stays open; the contributor pushes a fix. |
| `npm ci` cache miss  | Slower run (~+60 s) but still a pass/fail outcome. No special handling. |
| Network flake        | Re-runnable from the GitHub Actions UI without changing the PR.        |

## §6. Required test coverage for this workflow

Same answer as `deploy-workflow.md` §6 — no in-repo test asserts
YAML structure. The workflow's own first run on a PR is the
acceptance test.

## §7. Out of scope (for this workflow)

- Posting a comment on the PR with build statistics (e.g., bundle
  size). Not asked for; would require `pull-requests: write`
  permission, contradicting §4.
- Caching `dist/` between this workflow and `deploy.yml`. Each is
  a fresh build per FR-005 ("deploy gate must re-run tests
  against the same commit it ships") — caching the build artifact
  would defeat that defence.
