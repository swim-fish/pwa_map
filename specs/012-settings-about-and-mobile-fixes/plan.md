# Implementation Plan: Settings About Section, README Live Link, Go-To Mobile Fit, and Map 3D / Terrain Lockdown

**Branch**: `012-settings-about-and-mobile-fixes` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-settings-about-and-mobile-fixes/spec.md`

## Summary

Four delivery slices riding the same branch. Each slice is independently
testable per the spec, but they ship together because they share the
SettingsSheet contrast / i18n test net, the same review-loop gates, and a
single bundle-budget envelope.

1. **3D / Terrain lockdown register** (US1, P1) — A new module
   `src/map/threeDLockdown.ts` exports an immutable, `Object.freeze`d
   registry listing six capability classes (pitch, `sky`, globe
   projection, terrain DEM, `fill-extrusion`, `hillshade`) with their
   locked values and a one-line re-enable hint each. `MapView.svelte`
   consumes the registry to set MapLibre construction options
   (`maxPitch: 0`, `touchPitch: false`, explicit
   `projection: 'mercator'`). `styleBuilder.ts` consumes the registry
   to strip disallowed layer types and `sky` blocks from the assembled
   style at every rebuild. `src/map/sources.ts` adds a JSDoc cross-reference
   forbidding terrain RGB DEM source registration. No runtime escape
   hatch (no URL param, no env var, no `localStorage` toggle —
   `/speckit.clarify` Q2 explicitly closed those). Re-enabling 3D in a
   future feature is one deliberate edit on the registry plus removal
   of the corresponding filter call.

2. **Go-To dialog narrow-viewport fit** (US2, P2) — CSS-only fix to the
   six grid layouts inside `src/components/goto/`. Each layout grows a
   `@media (max-width: calc(360px - 0.02px))` breakpoint that collapses
   multi-column grids to single column, keeping ≥ 44 px tap targets at
   320 px and avoiding horizontal overflow. No JS / no Svelte component
   structural changes; the fix composes with the existing safe-area
   inline insets from feature 011 / ADR 0031.

3. **Settings → About section** (US3, P3) — `SettingsSheet.svelte`
   gains a new `<section class="about">` placed after the install
   section. The section renders two `<a href target="_blank"
   rel="noopener noreferrer">` links plus a translated heading, all
   driven by 3 new i18n keys (`settings.about.heading`,
   `settings.about.liveMap`, `settings.about.sourceCode`) added to all
   three locale catalogues (`zh.json`, `en.json`, `ja.json`). No new
   persisted state. No new tokens — colours reuse `--color-fg`,
   `--color-fg-muted`, and the existing focus-ring tokens from
   `tokens.css`.

4. **README live demo link** (US4, P4) — A small edit to `README.md`
   near the top introducing a "**Live demo**:
   <https://swim-fish.github.io/pwa_map/>" line that mirrors the in-app
   About-section URL. The unit test
   `tests/unit/readme-live-link.spec.ts` greps the file as text to
   prevent silent drift.

Persistence: **zero** new keys. The lockdown register is build-time /
construct-time only; the About area is static; the Go-To CSS fix is
presentational; the README edit is documentation.

What this plan deliberately does **not** do:

- It does not remove any existing 3D-related code paths (there are
  none — the lockdown is preventive, not reactive). It does set up the
  filter infrastructure so any future style import that ships a `sky`
  block is auto-stripped.
- It does not add a runtime override (no `?debug3d=1`, no env var, no
  `localStorage` toggle). `/speckit.clarify` Q2 explicitly closed this
  option (FR-001b).
- It does not restructure any existing Go-To component or layout
  primitive — the fix lives entirely inside the 6 layout components'
  CSS blocks. No new shared CSS variable.
- It does not introduce a new ADR for the README link or for the Go-To
  narrow-viewport fix — those are tactical (Go-To is constrained by
  ADR 0017 + ADR 0014 accessibility baseline; the README edit is a
  documentation change). It does add **one** new ADR (0032 — 3D /
  Terrain lockdown register) and **one** new `docs/ui/0012-*.md`
  record. The ADR is mandated by the architecturally novel
  single-source-of-truth registry pattern; the UI record covers the
  visible Settings About section + Go-To narrow-viewport behaviour.
- It does not change the platform-detection / install-surface /
  safe-area / locale-key parity contracts established by features 005,
  007, 011 — they are reused as-is.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target), Svelte 4.2 —
inherited unchanged from features 001–011. `tsconfig.json` and
`eslint.config.js` are not amended.

**Primary Dependencies**:

- `maplibre-gl` (already in deps) — the engine we are configuring at
  construction time and post-processing at style assembly. **No
  version bump.** A version bump WOULD be load-bearing for FR-004
  (globe projection default) — see research.md §R4.
- `svelte` 4.2.x + `@sveltejs/vite-plugin-svelte` — already in use.
  **No version bump.**
- **No new runtime deps. No new dev deps. No new build plugins.**

**Storage**: No new key. The 3D / Terrain lockdown is build-time /
construct-time configuration — there is no user-toggleable surface and
therefore no persisted preference. The About section is static content
(URLs + translated labels). The Go-To narrow-viewport fix is CSS-only.
The existing `pwa_map:installDismissedUntil` (feature 005, ADR 0025)
and `pwa_map:prefs` (feature 010, version 3) are unchanged.

**Testing**:

- Vitest unit + integration in `tests/unit/` / `tests/integration/`.
  RED-first per Constitution Principle II.
- Playwright e2e in `tests/e2e/` for real-browser geometry checks at
  320 / 360 / 390 px viewports for Go-To.
- New test files (estimated counts; see Project Structure below):
  - `tests/unit/three-d-lockdown.spec.ts` — registry shape + freeze
    invariants + re-enable-hint completeness.
  - `tests/integration/three-d-lockdown-runtime.spec.ts` — MapView
    consumes the registry; `getPitch` / `getProjection` /
    `getTerrain` / style layer types after every basemap swap.
  - `tests/integration/go-to-narrow-viewport.spec.ts` — 7 layouts × 3
    widths matrix; horizontal overflow + tap-target asserts.
  - `tests/integration/settings-about-section.spec.ts` — link
    rendering + i18n + a11y + contrast token usage.
  - `tests/unit/i18n/settings-about-keys-parity.spec.ts` — 3 new keys
    × 3 locales = 9 entries present.
  - `tests/unit/readme-live-link.spec.ts` — README.md text grep for
    the deploy-base URL.
  - `tests/e2e/go-to-narrow-viewport.e2e.spec.ts` — real-browser
    geometry at 320 / 360 / 390 px.

**Target Platform**: PWA — modern Chromium (Android, Desktop), WebKit
/ iOS Safari ≥ 17, Firefox 120+. Same matrix as features 005 / 011.

**Project Type**: Single-project Svelte + Vite PWA (one
build-and-deploy artefact, GitHub Pages hosted at
`https://swim-fish.github.io/pwa_map/`).

**Performance Goals**:

- No regression in map first-paint or pan / zoom latency (feature 001
  baseline holds).
- Bundle size delta gzipped: **+1 KiB JS (entry chunk)** /
  **+0.5 KiB CSS** (per spec SC-006). Project-wide ceiling
  **+6 KiB** (`.claude/rules/quality-gates.md`).
- `styleBuilder.buildStyle` MUST stay synchronous and complete in
  under 1 ms per call; the new filter step is an O(n) linear scan
  over a < 10-element layer list, well within budget.

**Constraints**:

- Constitution Principle II — TDD for every behavioural change. Each
  user story lands a RED test before its implementation lands GREEN.
  Bug fixes (US2 Go-To overflow) lead with a regression test that
  fails on the pre-fix code.
- Constitution Principle III — `docs/ui/0012-*.md` covers the visible
  UI changes (About section + Go-To narrow viewport) plus
  accessibility notes.
- Constitution Principle V — `docs/adr/0032-three-d-lockdown-register.md`
  codifies the lockdown register decision; the ADR index is updated.
- Constitution v1.1.0 — all i18n strings use `zh` / `en` / `ja` only;
  no `zh-TW` / `zh-Hant` ever appears.
- `.claude/rules/pwa-positioning.md` — Go-To narrow-viewport breakpoint
  uses `(max-width: calc(360px - 0.02px))` to keep CSS `@media` and
  any future JS subscription thresholds in lockstep.
- `.claude/rules/pwa-tokens-and-contrast.md` — no hard-coded colours
  in `SettingsSheet.svelte`; locale-key parity asserted; the existing
  `settings-contrast.spec.ts` regression net passes unchanged.
- `.claude/rules/pwa-component-state.md` — the new About section is
  static (no UI flags); the existing `$: if (!open) { ... }` cleanup
  block in `SettingsSheet.svelte` does not need amendment.

**Scale/Scope**:

- 1 new module (`threeDLockdown.ts`), 1 modified module
  (`styleBuilder.ts`), 1 modified Svelte component (`MapView.svelte`),
  1 modified Svelte component (`SettingsSheet.svelte`), 6 modified
  Svelte components (Go-To layouts), 3 modified i18n catalogues, 1
  modified README.md.
- 7 new test files; ~250–400 new test lines.
- 1 new ADR (0032) and 1 new `docs/ui/` record (0012).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality & Formatting Discipline

- Every touched file is run through `npm run format` and
  `npm run lint --max-warnings 0` before each commit.
- The new module follows the project's existing TS convention (one
  `Object.freeze`d default-shape immutable export, no side-effects at
  import time).
- No dead code: the lockdown register exports exactly the keys
  consumed by `MapView.svelte` / `styleBuilder.ts` / `sources.ts`.
- Self-explanatory naming: `threeDLockdown` / `LockdownEntry` /
  `LOCKDOWN_REGISTER`. Re-enable hints in JSDoc; no inline rationale
  paragraphs in the code.

✅ **Pass.**

### II. Test-First Development (NON-NEGOTIABLE)

- Every FR (FR-001 .. FR-021) has at least one regression test
  specified in the Testing block above.
- Each user story lands its RED test before its GREEN implementation
  per the `tasks.md` ordering produced by `/speckit.tasks`.
- US2 (Go-To narrow-viewport) lands a regression test at 320 px that
  fails on the pre-fix CSS, then GREEN after the breakpoint is added.
- US1 lands a registry-shape unit test (RED before the module exists)
  followed by an integration test (RED before MapView consumes the
  registry).

✅ **Pass.**

### III. User Experience Consistency

- Visible UI changes: Settings About section (US3) + Go-To
  narrow-viewport collapse (US2). Both covered in
  `docs/ui/0012-settings-about-and-mobile-fixes.md`.
- Accessibility: ≥ 44 px tap targets (FR-011); keyboard reachability
  + visible focus ring (FR-019); long-press / share semantics on
  links (FR-016 — real `<a href>` element). Standard tokens reused.
- No new design tokens introduced (reuse `--color-fg` /
  `--color-fg-muted` / focus-ring tokens). No new accent colour or
  new component primitive.

✅ **Pass.**

### IV. Performance Requirements

- Bundle budget: **+1 KiB JS / +0.5 KiB CSS** gzipped per SC-006.
  Project hard ceiling **+6 KiB** (`.claude/rules/quality-gates.md`).
- Map style assembly stays synchronous and < 1 ms; the new filter
  step is an O(n) linear scan over a < 10-element layer list.
- No new runtime work in pan / zoom hot paths.
- `npm run bundle-size` runs after every commit (per
  `.claude/rules/quality-gates.md` REVIEW LOOP), not just at the end.

✅ **Pass.**

### V. Documentation & Architectural Decision Records

- New ADR: `docs/adr/0032-three-d-lockdown-register.md`. Contents:
  context (why a registry rather than scattered options), decision
  (single immutable module imported by three call sites), consequences
  (bundle delta, re-enable cost, future MapLibre upgrade hazard),
  alternatives considered (distributed config; ADR-only; debug
  toggle).
- ADR index amended (`docs/adr/README.md` adds the row for 0032).
- New UI record: `docs/ui/0012-settings-about-and-mobile-fixes.md`.
  Contents: visible changes (About section, Go-To narrow viewport),
  affected screens (Settings, Go-To), tokens added (none),
  accessibility notes (tap targets, keyboard, focus ring), locale
  changes (3 new `settings.about.*` keys × 3 locales).

✅ **Pass.**

### Workflow gate — Locale conventions (Constitution v1.1.0)

- All new i18n keys land in `zh.json`, `en.json`, `ja.json`
  simultaneously. No `zh-TW` / `zh-Hant` substring appears in any new
  code, test, or documentation.
- The existing `tests/unit/i18n/controls-keys-parity.spec.ts` net
  asserts parity; a new
  `tests/unit/i18n/settings-about-keys-parity.spec.ts` adds focused
  coverage for the three new keys.

✅ **Pass.**

**All gates pass — no Complexity Tracking entries required.**

## Project Structure

### Documentation (this feature)

```text
specs/012-settings-about-and-mobile-fixes/
├── plan.md              # this file (/speckit.plan output)
├── research.md          # Phase 0 — decisions + alternatives considered
├── data-model.md        # Phase 1 — registry shape (no persisted entities)
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   ├── three-d-lockdown-register.md  # registry module shape + consumer rules
│   ├── style-builder-filter.md       # buildStyle filters disallowed layer types
│   └── settings-about-section.md     # i18n keys + a11y + link semantics
├── checklists/
│   └── requirements.md  # spec-quality checklist (already produced)
└── tasks.md             # Phase 2 — emitted by /speckit.tasks
```

### Source code (repository root) — files this feature touches

```text
src/
├── components/
│   ├── MapView.svelte                  # MODIFIED — consume threeDLockdown for construction options
│   ├── SettingsSheet.svelte            # MODIFIED — new <section> for About area
│   └── goto/
│       ├── DdLayout.svelte             # MODIFIED — narrow-viewport collapse
│       ├── DmsLayout.svelte            # MODIFIED — narrow-viewport collapse
│       ├── Tm2Layout.svelte            # MODIFIED — narrow-viewport collapse
│       ├── Twd67Layout.svelte          # MODIFIED — narrow-viewport collapse
│       ├── MgrsLayout.svelte           # MODIFIED — narrow-viewport collapse
│       ├── TaipowerLayout.svelte       # MODIFIED — narrow-viewport collapse
│       └── AutoLayout.svelte           # MODIFIED (verify only) — confirm no overflow
├── map/
│   ├── threeDLockdown.ts               # NEW — single-source-of-truth registry
│   ├── styleBuilder.ts                 # MODIFIED — strip disallowed layer types per registry
│   └── sources.ts                      # MODIFIED — JSDoc cross-reference; no terrain DEM source registered
└── i18n/
    ├── zh.json                         # MODIFIED — settings.about.* keys
    ├── en.json                         # MODIFIED — settings.about.* keys
    └── ja.json                         # MODIFIED — settings.about.* keys

tests/
├── unit/
│   ├── three-d-lockdown.spec.ts                  # NEW
│   ├── readme-live-link.spec.ts                  # NEW
│   └── i18n/
│       └── settings-about-keys-parity.spec.ts    # NEW
├── integration/
│   ├── three-d-lockdown-runtime.spec.ts          # NEW
│   ├── go-to-narrow-viewport.spec.ts             # NEW
│   └── settings-about-section.spec.ts            # NEW
└── e2e/
    └── go-to-narrow-viewport.e2e.spec.ts         # NEW

docs/
├── adr/
│   ├── 0032-three-d-lockdown-register.md         # NEW
│   └── README.md                                 # MODIFIED — index row
└── ui/
    └── 0012-settings-about-and-mobile-fixes.md   # NEW

README.md                                          # MODIFIED — Live demo link near the top
```

**Structure Decision**: Single-project Svelte + Vite PWA — the layout
above is the actual repository structure. There is no separate
backend / mobile / API tier; the PWA is the deliverable.

## Phase 0: Outline & Research

See [research.md](./research.md). Decisions resolved:

- **R1** — Single-module registry vs scattered config vs ADR-only.
  Settled by `/speckit.clarify` Q2 (Option A); research.md captures
  the *why* in long form.
- **R2** — MapLibre option semantics for pitch lockdown. Coverage
  matrix: `maxPitch: 0` covers programmatic; `touchPitch: false`
  covers gestures explicitly; keyboard pitch is clamped by the
  ceiling. Drag-pitch overlap: covered by ceiling.
- **R3** — Style filter mechanism: `buildStyle` post-processes its
  output, filtering layer entries by `type` and stripping any
  top-level `sky` key. Implementation must NOT mutate the basemap
  catalogue; the source-of-truth catalogue is read-only.
- **R4** — Globe-projection lockdown: explicit
  `projection: 'mercator'` in construction options. Defends against
  future MapLibre default changes.
- **R5** — Go-To narrow-viewport breakpoint: single 360 px breakpoint,
  collapse to 1 column. Bundle delta < 0.2 KiB CSS gzipped.
- **R6** — Settings About section structure: `<section>` matching
  feature-007 / 011 patterns; reuse existing `--color-fg` and
  focus-ring tokens.
- **R7** — README link form: labelled Markdown link
  (`**Live demo**: <https://swim-fish.github.io/pwa_map/>`) so both
  rendered HTML and plain-text consumers see the URL.

All entries resolve any `NEEDS CLARIFICATION` placeholder. None
remain open.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md), [contracts/](./contracts/),
and [quickstart.md](./quickstart.md).

- **data-model.md** — Registry shape (`LockdownEntry` type +
  `LOCKDOWN_REGISTER` const), consumer module signatures, statement
  that no persisted entities are introduced.
- **contracts/three-d-lockdown-register.md** — Public surface of the
  new module; consumer rules; freeze invariants; test contract.
- **contracts/style-builder-filter.md** — `buildStyle`'s filter
  behaviour; input vs output invariants; consumer rules for upstream
  basemap definitions that include disallowed layer types.
- **contracts/settings-about-section.md** — About-area i18n key
  contract; link element semantics (`target` / `rel`); accessibility,
  focus, and contrast rules.
- **quickstart.md** — 15-minute manual verification walkthrough.

CLAUDE.md `<!-- SPECKIT START -->` block is updated to point to this
plan.

### Post-design Constitution re-check

After Phase 1 artefacts are written, the Constitution Check above is
re-evaluated:

- The registry is exactly one frozen object — no class, no factory,
  no DI plumbing. Principle I (no speculative abstraction) holds.
- Each contract maps 1:1 to a test file in the Project Structure
  table. Principle II holds.
- Visible UI changes still only the About section + the Go-To
  narrow-viewport collapse — no surface added that escaped the
  `docs/ui/0012-*.md` record. Principle III holds.
- Bundle delta projection still under +1 KiB JS / +0.5 KiB CSS based
  on the contract surface area. Principle IV holds.
- ADR + UI record + ADR index update remain the only documentation
  artefacts. Principle V holds.

✅ **Re-check passes.**

## Complexity Tracking

> No Constitution Check violations. One **bundle-budget overshoot vs
> plan target** is documented below per
> `.claude/rules/quality-gates.md`'s "exceed plan target but under
> project ceiling → document before merging" rule.

| Item | Plan target | Measured | Project ceiling | Why accepted |
|------|-------------|----------|-----------------|--------------|
| Entry-chunk JS delta gzipped | +1 KiB | **+4.27 KB** (post-restyle / post-compass-fix) | +6 KB | The four slices each contribute: (a) `threeDLockdown.ts` module + the `applyLockdown` filter in `styleBuilder.ts`; (b) the `MapView.svelte` MapLibre options block grew by the type-widened cast pattern (research §R4 — required because `maplibre-gl@^3.6.2` doesn't expose `projection` on its options type); (c) the `SettingsSheet.svelte` About section markup + 9 new i18n strings × 3 locales + secondary-button styling (Addendum A.3); (d) the per-layout `@media` blocks in 6 Go-To layout components. Plus two post-implementation additions: `Compass.svelte` shortest-path bearing accumulator (Addendum A.1, +0.10 KB), About link button styling and section reorder (Addendum A.2 / A.3, +0.02 KB). Each slice on its own would have stayed within +1 KiB, but the bundled delivery aggregates above the plan target. The per-feature delta budget enforced by `scripts/check-bundle-size.js` (+6 KB) is honoured (+4.27 KB ≤ 6 KB). Splitting into multiple PRs to fit under +1 KiB each was rejected: the slices share the SettingsSheet contrast / i18n test net + the same review-loop gates, so a single PR is cheaper to review and ship without introducing intermediate states with mixed UI affordances. |
