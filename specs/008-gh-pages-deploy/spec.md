# Feature Specification: GitHub Pages Auto-Deploy on Master

**Feature Branch**: `008-gh-pages-deploy`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "寫一個 GitHub page deploy 的 自動化程式 當 git merge/push 到 master br 時. 專案準備使用 GitHub deploy page 的方式部署"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Push to master ships to production automatically (Priority: P1)

A maintainer merges a pull request into the `master` branch (or
pushes a hotfix commit directly). Within a short, predictable window
the public PWA at the project's GitHub Pages URL serves the new
build. The maintainer takes no further action — no manual build, no
manual upload, no manual cache busting. The next visitor (and every
returning visitor) receives the new version on next page load (or,
for installed PWAs, after the existing service-worker update prompt
flow).

**Why this priority**: This is the entire purpose of the feature.
Without it, every release requires a manual `npm run build` followed
by a manual upload — friction that grows with every shipped feature
and is the most common cause of "production drifted from main"
incidents. Every other capability (PR build verification, failure
notifications) is an enhancement on top of this.

**Independent Test**: Make a trivial UI change on a feature branch,
open a PR, merge it into master. Within 10 minutes the public site
served at the project's GitHub Pages URL must reflect the change
when loaded with a hard refresh. Fully testable without any of the
optional enhancements in place.

**Acceptance Scenarios**:

1. **Given** the project has been fully built and deployed at least
   once via this automation, **When** a maintainer pushes a single
   commit (or merges a PR) to `master`, **Then** the deploy
   automation begins running within 30 seconds, completes within
   10 minutes at the 95th percentile, and the public URL serves
   the new build on the next page load.
2. **Given** the deploy automation is running, **When** the build
   step fails (e.g., a TypeScript error reaches `master`), **Then**
   the previous successful build remains live at the public URL
   (no partial / broken deploy is published) and the failure is
   visible in the project's GitHub Actions run history within
   1 minute of completion.
3. **Given** a fresh visitor opens the public URL, **When** the
   PWA loads, **Then** the application loads its assets correctly
   under the project subpath URL, the install affordance works,
   and the service worker registers and activates with the correct
   scope.

---

### User Story 2 - Pull-request build verification before merge (Priority: P2)

A contributor opens a pull request against `master`. The same build
that would run on merge runs against the PR's head commit and
reports back as a status check on the PR. The maintainer can see
whether the change builds and passes existing gates (format / lint /
typecheck / unit + integration tests / bundle-size delta) before
approving the merge. This catches build-breaking changes before they
reach `master` — and therefore before they would corrupt the next
production deploy.

**Why this priority**: Catches the most common failure class (broken
build merged → broken deploy → manual hotfix). Independent of US1:
even without auto-deploy, PR build verification is valuable on its
own.

**Independent Test**: Open a PR that introduces a deliberate type
error (e.g., a missing import). The PR should display a failing
status check from the build workflow within 10 minutes; the check
must show which step failed.

**Acceptance Scenarios**:

1. **Given** a PR is open against `master`, **When** the PR's head
   commit is updated (initial open or new push), **Then** the build
   verification workflow runs against the PR head and posts a
   passing or failing status check on the PR within 10 minutes p95.
2. **Given** the build verification workflow is configured as a
   required status check via branch-protection on `master` (a
   one-time, admin-only setup documented in `quickstart.md`),
   **When** the build fails, **Then** the merge button is blocked
   / disabled in the standard GitHub PR UI until the author pushes
   a fix and the next build passes. (Without that branch-protection
   setup the build status is still visible on the PR — the failing
   check is still surfaced — but the merge button is not blocked.)

---

### User Story 3 - Failure visibility for maintainers (Priority: P3)

When a deploy run fails (build error, test regression, deployment
permission failure, GitHub-side outage), the maintainer is notified
through the GitHub Actions UI and via the per-commit status icon on
`master`. The failure is visible without the maintainer having to
open the workflow runs page proactively.

**Why this priority**: Quietly broken production is worse than
visibly broken production. This story exists so a deploy failure
cannot persist undetected. It is P3 (rather than P1) because GitHub
already shows a red X on the commit by default; this story only
explicitly mandates that the workflow opt into that behaviour
correctly.

**Independent Test**: Force a deploy failure (e.g., temporarily
revoke the workflow's pages-write permission). The next push to
`master` must (a) show a failed run in the Actions tab, (b) show a
red ✕ on the commit hash on the master branch, (c) leave the prior
successful deploy intact at the public URL.

**Acceptance Scenarios**:

1. **Given** a `master`-push deploy run fails, **When** the
   maintainer opens the repository's Actions tab, **Then** the
   failed run is visible at the top of the runs list with a red
   indicator, and the failing job and step are clickable directly
   to the relevant log lines.
2. **Given** a deploy failure has occurred, **When** the maintainer
   views the recent commits on the `master` branch in the GitHub
   web UI, **Then** the failing commit shows a red ✕ status icon
   adjacent to its hash.

### Edge Cases

- **First-ever deploy** — the project has never been deployed before
  this feature lands. The first run on `master` after this feature
  merges must produce the initial Pages deployment without any
  pre-existing `gh-pages` branch, manually-set Pages source, or
  deploy artifact present. Any one-time repository setup step
  (e.g., enabling GitHub Pages with the right source in repo
  settings) MUST be documented as part of the feature so a
  maintainer with admin access can complete it in under 5 minutes.
- **Two pushes within seconds** — if commit A is pushed and then
  commit B is pushed before the deploy for A completes, the system
  must guarantee that the FINAL state of the public URL reflects
  commit B (not A). Either A's deploy is cancelled in favour of B,
  or both run in order with B winning the last write.
- **Master is force-pushed** — the deploy must follow the new HEAD,
  not the prior. (Force push to `master` is not normal practice but
  must not put the deployment into an inconsistent state.)
- **Build succeeds but takes longer than 10 minutes** — the deploy
  still completes, but SC-001 is missed for that run. The deploy
  itself must NOT be cancelled by an arbitrary timeout; only an
  unrecoverable failure should fail the run.
- **Public URL temporarily 404s during deploy** — acceptable for
  the brief switchover window if technically unavoidable, but the
  prior version MUST remain reachable until the new version is
  live. There must NEVER be a window where the URL serves a
  half-deployed state (e.g., new HTML referencing missing assets).
- **PWA scope changes between releases** — when a release changes
  the path the PWA expects to be served from, installed PWAs may
  need to be re-installed. This is a one-time cost on initial
  deploy (no prior PWA installation exists yet) and must be called
  out in the feature's documentation if it ever recurs.
- **Repository renamed** — if the project's GitHub repository name
  changes, the public URL changes; any in-product URL references,
  PWA scope, and `start_url` MUST track the new name. (Out of
  scope for the initial deploy, but must be acknowledged.)
- **Anonymous viewer with no GitHub account** — public URL must be
  reachable by anyone with the link, no authentication required.
- **Service worker cache from prior deploy** — returning visitors
  with the old service worker continue to use the old assets until
  the existing update-prompt flow (feature 004) prompts them to
  refresh. Auto-deploy MUST NOT bypass or break that flow.

## Requirements *(mandatory)*

### Functional Requirements

#### Trigger & cadence

- **FR-001**: The deploy automation MUST run automatically on every
  push to the `master` branch, including pushes that result from
  merging a pull request.
- **FR-002**: The deploy automation MUST NOT run on pushes to any
  other branch (feature branches, release branches, or tags) unless
  that other-branch behaviour is explicitly added in a future
  feature.
- **FR-003**: When two `master` pushes occur in rapid succession,
  the system MUST guarantee that the final published state matches
  the more recent commit. Either the older run is cancelled, or
  both run sequentially with the newer run last.

#### Build & verification

- **FR-004**: The deploy automation MUST install the project's
  declared dependencies, build the production bundle, and produce
  a deployable artifact, all without any manual intervention from
  the maintainer.
- **FR-005**: The deploy automation MUST run the project's existing
  format / lint / typecheck / unit + integration test gates against
  the same commit it deploys, and MUST refuse to publish a build
  if any gate fails. (A failed build leaves the prior good build
  live per FR-009.)
- **FR-006**: The deploy automation MUST verify the bundle-size
  delta gate from feature 005 (`scripts/check-bundle-size.js`) and
  MUST refuse to publish if the gate fails.
- **FR-007**: For pull requests targeting `master`, the build,
  format, lint, typecheck, and test gates from FR-005 MUST run on
  the PR head commit and report a status check back to the PR
  (US2). The deploy step itself MUST NOT run for PR builds.

#### Publishing & runtime correctness

- **FR-008**: The successfully built artifact MUST be published
  via GitHub Pages such that the public URL serves it on next page
  load.
- **FR-009**: If a build or deploy run fails for any reason, the
  most recently successful build MUST remain live at the public
  URL. There MUST be no window where the public URL serves a
  partial or broken deploy.
- **FR-010**: The PWA at the public URL MUST function correctly
  under the GitHub Pages URL scheme — including correct asset
  loading, manifest scope, service-worker registration scope, and
  install affordance behaviour. (For this project's first deploy,
  served at the project subpath form, asset paths and PWA paths
  MUST be subpath-aware.)
- **FR-011**: The service-worker update-prompt flow shipped in
  feature 004 MUST continue to work after this feature lands —
  i.e., a returning installed user who already has the prior
  version cached MUST be prompted to update once the new version
  is detected, exactly as before.

#### Visibility & failure surfacing

- **FR-012**: Every run (success OR failure) of the deploy
  automation MUST be visible in the repository's GitHub Actions
  run history with a clear pass / fail indicator.
- **FR-013**: A failed `master`-push deploy MUST be reflected as
  a red status indicator next to the offending commit in the
  GitHub commits view, so a maintainer scanning the master log
  can spot a broken deploy without opening the Actions tab.
- **FR-014**: Failure visibility MUST occur within 1 minute of
  the workflow run completing.

#### Security & operations

- **FR-015**: The deploy automation MUST NOT require any manually
  configured personal access token, deploy key, or other long-lived
  secret stored in repository configuration. Authentication MUST
  use the GitHub-provided per-run credentials only.
- **FR-016**: The deploy automation MUST NOT have write access to
  any repository surface beyond what is strictly required to
  publish to GitHub Pages.
- **FR-017**: The deploy automation MUST NOT publish anything that
  is not in the explicit build artifact (no source files, no test
  files, no `.git` history, no environment files). The artifact
  MUST be sourced exclusively from the directory the build step
  produces (`./dist/`); no other path is added to the upload
  artifact step.

#### Local development

- **FR-018**: Local development workflows (`npm run dev`,
  `npm run build`, `npm run preview`, `npm test`, Playwright E2E)
  MUST continue to work exactly as they did before this feature,
  including running on a developer machine without any subpath /
  base-path special configuration.
- **FR-019**: This feature MUST NOT introduce any local-only
  step the developer is required to remember to run before merging
  (e.g., a "regenerate `gh-pages` branch" command). All deploy
  state MUST be derivable from `master`'s commit history alone.

#### One-time setup

- **FR-020**: Any one-time repository configuration required for
  the first deploy (e.g., enabling Pages with the correct source,
  granting workflow permissions) MUST be documented in the
  feature's quickstart so a maintainer with admin access can
  complete the setup in under 5 minutes without reading external
  docs first.

### Key Entities *(include if feature involves data)*

- **Production build artifact**: The set of files produced by the
  project's build step that, when served as a static site, makes up
  the deployable PWA. Lifecycle: created fresh on every successful
  `master`-push run; replaces the prior live artifact at the public
  URL on successful publish; never persisted in the repository
  source tree.
- **Deploy run record**: A single execution of the deploy
  automation. Attributes: triggering commit, start time, end time,
  pass/fail outcome, link to logs. Lifecycle: created when the
  automation begins; reaches a terminal state when it succeeds,
  fails, or is cancelled (by FR-003 supersession); retained in
  GitHub Actions history per the platform's default retention.
- **Public URL**: The single canonical URL at which a member of
  the public can load the deployed PWA. Stable across deploys.
  Bound to the repository's GitHub Pages configuration; derived
  from the GitHub organisation/user name and the repository name
  for subpath publishing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the moment a `master`-push event occurs in
  GitHub, the public URL MUST serve the new build within
  10 minutes at the 95th percentile, measured across at least
  10 consecutive deploys.
- **SC-002**: 100% of `master` pushes (including PR merges) MUST
  register at least one deploy attempt within 30 seconds of the
  push appearing on GitHub. (A "deploy attempt" is any workflow
  run started for the push, including one that is later cancelled
  via the `concurrency` rule when a newer push supersedes it.
  Measured by spot-checking ≥ 5 consecutive `master` pushes via
  the Actions run history.)
- **SC-003**: 100% of failed deploy runs MUST leave the previously
  successful build live at the public URL — i.e., zero observed
  cases of "site is down because the latest deploy failed".
- **SC-004**: 100% of pull requests against `master` MUST receive
  a build-verification status check within 10 minutes p95.
- **SC-005**: Zero long-lived secrets (PATs, deploy keys) MUST be
  added to the repository as part of this feature. Verifiable by
  inspecting repository settings → Secrets after the feature
  lands.
- **SC-006**: The PWA MUST score ≥ 90 on the Lighthouse PWA audit
  (matching the existing project gate from feature 001's plan) at
  BOTH measurement points: (a) against the locally-served preview
  (`npm run preview` → `http://localhost:4173/pwa_map/`), enforced
  by the existing `lighthouse.yml` workflow on every PR; AND (b)
  against the deployed URL (`https://swim-fish.github.io/pwa_map/`),
  spot-checked ONCE manually after the first deploy lands. The
  preview-side measurement is the build-time gate; the deployed-URL
  measurement is the post-deploy smoke confirming the subpath form
  doesn't degrade PWA installability or service-worker behaviour.
- **SC-007**: After the first deploy, a fresh visitor on a clean
  Chromium browser MUST be able to install the PWA via the
  feature-005 install banner and have it open from the home
  screen pointing at the same public URL.
- **SC-008**: Zero local-developer commands MUST be added that the
  developer needs to remember to run before merging. Verifiable
  by inspecting `package.json` `scripts` and the
  contributor-facing docs after the feature lands.
- **SC-009**: The first deploy after this feature lands MUST
  succeed without any manual intervention beyond the documented
  one-time setup of FR-020. Verifiable by following the quickstart
  on a maintainer's machine and seeing the public URL go live.

## Assumptions

- The project's GitHub repository (`swim-fish/pwa_map`) does not
  use a custom domain (no `CNAME` file present, no Pages custom
  domain configured). The deployment will therefore be served
  under the standard `https://<owner>.github.io/<repo>/` subpath
  form. If a custom domain is configured later, the PWA's `base`
  path and manifest scope will need to be reverted to `/` in a
  follow-up — that change is explicitly out of scope for this
  feature.
- "master" is the project's production branch. The lighthouse
  workflow currently references `main`; if at some point in the
  past the team intended to migrate to `main`, that migration is
  out of scope here — this feature deploys from `master` per the
  user's explicit instruction.
- The first-ever deploy will happen as part of (or immediately
  after) this feature merging. There is no prior `gh-pages`
  branch, no prior installed PWA, no prior deployment history to
  migrate. Zero-downtime concerns therefore reduce to "the URL
  goes from 404 to serving the build" on the first run.
- The project has no requirement to deploy preview builds for
  individual pull requests at distinct URLs. PR builds verify
  the build passes (US2) but do not produce per-PR public URLs.
- The project has no requirement for staged / approval-gated
  deploys — every successful build on `master` ships immediately.
  If gated deploys are needed in the future, they're a separate
  feature.
- The project has no requirement for deploy notifications outside
  the standard GitHub Actions UI + commit-status indicators
  (Slack, email, PagerDuty, etc., are out of scope).
- GitHub Pages availability is treated as a platform dependency —
  if GitHub itself is down, this feature is also down. No
  alternative deploy target is in scope.

## Out of Scope

- Custom-domain configuration (CNAME, DNS).
- Per-PR preview deployments at unique URLs.
- Staged or manual-approval deploys (e.g., production-vs-staging
  pipelines).
- Notifications via channels outside GitHub (Slack, email, etc.).
- Deploy rollback as a one-button action — recovery from a bad
  deploy is via "merge a fix to master and let the next deploy
  ship", not a separate rollback command. (The previous build IS
  preserved by FR-009 at the URL until the next successful
  deploy, which buys time to land a fix.)
- Versioned / archived builds (no "v1.2.3" subdirectory; only the
  latest `master` build is served).
- Deploy from any branch other than `master`.
- Migrating the existing `lighthouse.yml` workflow off `main` and
  onto `master`. The lighthouse gate may be retargeted in a
  follow-up but is not part of this feature.
- Multi-region / CDN configuration beyond what GitHub Pages
  provides natively.
- Build-time secret injection (the PWA has no per-environment
  secrets today; if any are added later, that's a separate
  feature).
