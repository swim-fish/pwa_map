# Implementation Plan: Browser Safe-Area Compliance and a Settings-Page Install Button for All Platforms

**Branch**: `011-safe-area-install-buttons` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-safe-area-install-buttons/spec.md`

## Summary

Two coupled mobile-platform polish changes — both ride the same delivery
cycle because both touch the same set of `position: fixed` surfaces and
both require new locale-aware copy in the Settings sheet:

1. **Safe-area compliance for every persistent surface** (US1, P1) —
   the existing `--notification-zone-*` token pattern (feature 009 / ADR
   0029) is generalised. `tokens.css` gains four new sibling tokens
   (`--toolbar-zone-top`, `--toolbar-zone-right`, `--map-controls-zone-bottom`,
   `--map-controls-zone-right`, plus the readout / attribution / settings-sheet
   variants), each composed as `calc(<base spacing> + env(safe-area-inset-*, 0px))`.
   `App.svelte`, `CoordinateReadout.svelte`, `AttributionBar.svelte`,
   `ZoomControls.svelte`, `Compass.svelte`, `InstallBanner.svelte`,
   `InstallIosSheet.svelte`, and `SettingsSheet.svelte` swap their literal
   `top: var(--space-3)` / `bottom: var(--space-4)` declarations for the
   zone tokens. Behaviour is CSS-only; there is no JS measurement, no
   `ResizeObserver`, no per-platform branching. The existing
   `viewport-fit=cover` meta declaration is retained.

2. **Settings-sheet "Install app" section** (US2, P1) — `SettingsSheet.svelte`
   gains a new `<section>` placed above the existing cache section. The
   section is a *view* over the existing `installSignal` store; it does
   not own install state and reuses `triggerInstall()` /
   `markInstalled()` / `recordDismissal()` verbatim. Because today's
   `installSignal.surface` collapses both "user dismissed the banner"
   and "app is installed" into the single `'hidden'` literal — and the
   spec (FR-015) requires the Settings entry to remain visible after a
   banner dismissal — a small new derived store
   `installSettingsSurface` exposes the *un-suppressed* surface
   (`'android-chromium' | 'desktop-chromium' | 'ios-safari' |
   'ios-other' | 'standalone' | 'unsupported'`) so the section can
   render the right branch independently of the 30-day banner-dismissal
   gate. The Chromium branch reuses `triggerInstall()`; the iOS Safari
   branch opens an instructional dialog whose body is the same three
   steps that `InstallIosSheet.svelte` shows today (extracted into a
   shared `<InstallIosInstructions>` snippet so the strings — already
   in `pwa.install.ios.*` — are not duplicated).

Persistence: this feature adds **zero** new persisted state. The
existing `pwa_map:installDismissedUntil` key (feature 005) is unchanged;
`pwa_map:prefs` is unchanged; the install state surfaced in Settings is
purely derived from the in-memory `installSignal` plus
`window.matchMedia('(display-mode: standalone)')` results.

What this plan deliberately does **not** do:

- It does not change any coordinate logic, parser, or schema. The
  `prefs.version` constant stays at `3` (feature 010's value); no
  v3 → v4 migration is added.
- It does not change `viewport-fit` (stays `cover`).
- It does not change the `InstallBanner.svelte` / `InstallIosSheet.svelte`
  components' visibility rules — the *transient* banner / sheet keeps
  using `installSignal.surface` (which still respects the 30-day
  dismissal). Only the **new** Settings section uses the new
  un-suppressed derived store.
- It does not introduce a new third-party library. Safe-area is a CSS
  primitive (`env(safe-area-inset-*)`); the install flow already exists.
- It does not change the platform-detection logic in
  `installPlatform.ts` — the seven `InstallSurface` literals are
  reused as-is.
- It does not add a new locale key for any string already in
  `pwa.install.android.*` / `pwa.install.ios.*` / `pwa.install.iosOther.*`
  — the new section's labels reuse those keys. Two **new** keys are
  introduced (`settings.install.heading`, `settings.install.alreadyInstalled`),
  documented in research.md §R5 and FR-016 (the spec's reuse-first rule
  permits new keys when no existing key carries the semantic).
- It does not add a "show the install button on non-installable
  desktop browsers" affordance — `unsupported` stays hidden, matching
  feature 005's pattern.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target), Svelte 4.2 —
inherited unchanged from features 001–010. `tsconfig.json` and
`eslint.config.js` are not amended.

**Primary Dependencies**:

- `svelte` 4.2.x + `@sveltejs/vite-plugin-svelte` — already in use.
  The new derived store uses `svelte/store`'s `derived(...)`; no new
  primitives. **No version bump.**
- `vite-plugin-pwa` — unchanged; install detection still rides on
  the platform's `beforeinstallprompt` event.
- **No new runtime deps. No new dev deps. No new build plugins.**

**Storage**: No new key. `pwa_map:installDismissedUntil` (feature 005,
ADR 0025) is unchanged. `pwa_map:prefs` (feature 010, version 3) is
unchanged. The Settings install section reads only the in-memory
`installSignal` store; the spec's FR-015 ("banner dismissal does not
suppress Settings entry") is satisfied by the new derived store, NOT by
mutating the persisted dismissal key.

**Testing**: Vitest (unit + integration in `tests/unit/` /
`tests/integration/`) + Playwright (`tests/e2e`). RED-first per
Principle II:

- `tests/unit/safe-area-tokens.spec.ts` — for each new
  `--*-zone-*` token, assert the resolved `getComputedStyle` value
  on a synthetic root that stubs `env(safe-area-inset-*)` returns the
  documented `calc(<base> + <inset>)` shape; with insets stubbed to
  `0px`, the resolved value equals the pre-feature literal so layout
  is identical (FR-006 / SC-004).
- `tests/unit/install-settings-surface.spec.ts` — covers the new
  derived store: bypasses the 30-day dismissal gate (FR-015), still
  honours `installed === true` → `'standalone'` (FR-013), still
  hides `'unsupported'` callers from Settings (FR-014). Uses
  `__resetForTests()` and a stub of `installSignal` per surface.
- `tests/integration/settings-install-section.spec.ts` — mounts
  `<SettingsSheet open>` with each of the seven derived surfaces;
  asserts the section's DOM presence, button label, button enablement,
  and click outcome (dispatched event) per FR-009..FR-018. Verifies
  that triggering install while another sheet click is in flight
  does NOT call `triggerInstall()` twice on the same `deferredPrompt`
  (FR-017).
- `tests/integration/safe-area-layout.spec.ts` — mounts `<App>` in
  jsdom with `env(safe-area-inset-*)` stubbed to non-zero values via
  a synthetic `<style>` block; asserts `getBoundingClientRect()` of
  the toolbar, the readout, the zoom controls, the attribution bar,
  the install banner (when triggered), and the iOS install sheet
  (when triggered) clears each viewport edge by at least the stubbed
  inset value (FR-001..FR-004 / SC-001..SC-003). Also asserts that
  with all insets at `0px` the rects equal the feature-009 baseline
  positions within 1 CSS pixel (SC-004).
- `tests/e2e/safe-area-install.e2e.spec.ts` — Playwright Mobile
  Safari (iPhone 14 emulation; engine-level safe-area insets) +
  Mobile Chrome (Pixel 7 emulation; gesture-nav insets). The spec
  loads the PWA, asserts the toolbar / readout / zoom / settings
  rects clear the viewport edges by the engine-reported safe-area
  values, then opens Settings, taps the install button, and asserts
  the OS install prompt appears (Chromium) OR the iOS instructions
  dialog appears (iOS Safari).

**Target Platform**: Identical to features 001–010 — Chromium 120+
(desktop + Android), WebKit / iOS Safari 17+, Firefox 120+ desktop,
Firefox Android. `env(safe-area-inset-*)` is supported across this
matrix; the `0px` fallback covers the rare WebView edge case
(FR-006).

**Project Type**: Single project — extension of the existing PWA. No
new module under `src/`, no new top-level directory.

**Performance Goals** (per Constitution Principle IV):

- **Bundle delta**: ≤ **+1 KiB gzipped** on the entry JS bundle.
  The Settings install section is one Svelte conditional block plus
  three event handlers; the safe-area work is CSS-only (zero JS).
  The new derived store is ~25 lines of `svelte/store`'s `derived(...)`
  — well inside budget. Verified by `npm run bundle-size`.
- **CSS delta**: ≤ **+0.5 KiB gzipped** on the entry CSS bundle.
  Six new design tokens + per-surface offset declarations. Verified
  by the same `bundle-size` script (it tracks both JS and CSS deltas
  per ADR 0028's deploy gate).
- **First paint unchanged**: the safe-area tokens are evaluated by
  the browser's CSS parser at the same point as the existing
  notification-zone tokens; no new layout pass is induced. Verified
  manually in Chrome Performance panel during quickstart §1.
- **Install button latency**: ≤ 200 ms from tap to either the OS
  install prompt appearing (Chromium) or the iOS instructions dialog
  rendering (iOS Safari). Bounded by `triggerInstall()`'s existing
  contract (feature 005 / ADR 0025); no new latency surface
  introduced.
- **Map pan/zoom unchanged**: 60 fps maintained — the safe-area
  changes are pure CSS positioning, do not introduce layout
  thrashing, and do not touch the map canvas.

**Constraints**:

- **Local-dev preservation**: `npm run dev`, `npm run build`,
  `npm run preview`, `npm run preview:local`, `npm test`,
  Playwright E2E, `npm run bundle-size`, `npm run deploy:check`
  ALL keep working unchanged.
- **Locale conventions** (Constitution v1.1.0): two new locale
  keys × three locales = 6 new strings. Keys:
  `settings.install.heading`, `settings.install.alreadyInstalled`.
  All other strings rendered by the new Settings install section
  reuse existing `pwa.install.android.*` / `pwa.install.ios.*` /
  `pwa.install.iosOther.*` keys (feature 005). The exception is
  documented in research.md §R5; FR-016 explicitly permits new keys
  where no existing key carries the semantic. The `zh` BCP-47 rule
  is unchanged: every locale path uses `zh` (never `zh-TW` /
  `zh-Hant`).
- **Accessibility floor** (ADR 0014):
  - The Settings install section's primary button is `class="tap-target"`
    (≥ 44 × 44 CSS px, feature 009's `--tap-min` token).
  - The button is keyboard-reachable via `Tab`; visible focus
    indicator preserved.
  - The iOS instructional dialog opened by the iOS-Safari branch is a
    `role="dialog"` with `aria-modal="true"` and an explicit close
    button — same accessibility shape as the existing
    `InstallIosSheet.svelte` (feature 005 / ADR 0025).
  - The Settings sheet's container respects
    `env(safe-area-inset-*)` so the install button is always reachable
    even on a notched device in PWA standalone mode (US3 / SC-001).
- **Color tokens & dark mode**: no new color token. The install
  button reuses `--color-accent` / `--color-fg` / `--color-border`
  exactly as the existing `install-banner-confirm` / `install-banner-dismiss`
  buttons in feature 005.
- **No new persisted-state migrations**: `prefs.version` stays at
  `3`; `installDismissedUntil` storage shape unchanged.
- **Backwards compatibility with feature 005's transient install
  surfaces**: the existing `InstallBanner.svelte` and
  `InstallIosSheet.svelte` keep using the un-derived
  `installSignal.surface` (which still respects the 30-day banner
  dismissal). Only the new Settings section uses the un-suppressed
  derived store. This means: a user who dismissed the banner sees
  no auto-banner for 30 days (existing behaviour) AND can still
  install on demand via Settings (new behaviour). Both states
  collapse the moment `appinstalled` fires.

**Scale/Scope**:

- **Source files amended (~9)**:
  - `src/app/tokens.css` — adds six new design tokens for the four
    safe-area zones (toolbar, map controls, readout, attribution,
    settings sheet) plus their bottom-zone variants where applicable.
  - `src/app/App.svelte` — `.toolbar` and `.map-controls` swap their
    literal `top` / `bottom` / `right` declarations for the new
    zone tokens.
  - `src/components/CoordinateReadout.svelte` — replaces the literal
    `bottom` declaration with `--readout-zone-bottom`.
  - `src/components/AttributionBar.svelte` — same pattern; bottom-anchored
    surface picks up `--readout-zone-bottom` (or its own dedicated
    `--attribution-zone-bottom` if research.md §R2 finds the two
    surfaces stack rather than alias each other).
  - `src/components/InstallBanner.svelte` — the bottom-anchored install
    banner picks up the bottom-zone token; no behavioural change.
  - `src/components/InstallIosSheet.svelte` — same pattern for its
    bottom-anchored sheet.
  - `src/components/SettingsSheet.svelte` — adds `env(safe-area-inset-*)`
    insets to the `.sheet` container's positioning; adds the new
    `<section class="install-section">` with its derived-store
    branches.
  - `src/components/ZoomControls.svelte` — its container is
    positioned by `App.svelte`'s `.map-controls`, so the bottom-zone
    token applies via the parent. (Verify in research.md §R3 — if
    `ZoomControls.svelte` declares its own `position: fixed`, this
    file is amended; otherwise no edit.)
  - `src/components/Compass.svelte` — same caveat as
    `ZoomControls.svelte`.
- **Source files added (1)**:
  - `src/pwa/installSettingsSurface.ts` — the new derived store +
    its `__resetForTests()` helper. Pure TypeScript; no Svelte
    template. Imports from `installSignal.ts` and
    `installPlatform.ts`. ~40 lines including JSDoc.
- **Tests added (4)**:
  - `tests/unit/safe-area-tokens.spec.ts`
  - `tests/unit/install-settings-surface.spec.ts`
  - `tests/integration/settings-install-section.spec.ts`
  - `tests/integration/safe-area-layout.spec.ts`
  - `tests/e2e/safe-area-install.e2e.spec.ts`
- **Docs added (2)**:
  - `docs/ui/0011-safe-area-install-buttons.md` — UI record per
    Principle III, covering the safe-area work and the new
    Settings section.
  - `docs/adr/0031-safe-area-and-on-demand-install.md` — ADR per
    Principle V, codifying the zone-token generalisation, the new
    derived `installSettingsSurface` store's purpose, and the
    deliberate decision to keep `InstallBanner.svelte` /
    `InstallIosSheet.svelte` on the un-derived `installSignal.surface`.
- **i18n changes**: **2 new keys × 3 locales = 6 new strings**
  total. Keys: `settings.install.heading`,
  `settings.install.alreadyInstalled`. All other UI strings reuse
  existing keys (`pwa.install.android.confirm`,
  `pwa.install.ios.title`, `pwa.install.ios.step1..step3`,
  `pwa.install.ios.shareIconAlt`, `pwa.install.iosOther.hint`,
  `pwa.install.android.dismiss`, etc.). research.md §R5 documents
  why these two keys are the only allowed exception to the
  reuse-first rule.
- **Storage / network / permissions changes**: none. No schema
  bump, no new key, no new permission, no new network call.
- **Bundle delta**: ≤ +1 KiB gzipped JS, ≤ +0.5 KiB gzipped CSS
  (target).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                       | Verdict     | Justification |
| ----------------------------------------------- | ----------- | -------------- |
| **I. Code Quality & Formatting**                | PASS        | All edits ride existing Prettier + ESLint flat config. No new linter rule, no new file extension. `npm run format` is run after every code edit per Development Workflow. The Settings install section is one new `<section>` block in `SettingsSheet.svelte` plus one ~40-line derived store in a new `src/pwa/installSettingsSurface.ts` file — no duplicate state, no shadow stores, no parallel install-detection logic. |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | Five test files (2 Vitest unit, 2 Vitest integration, 1 Playwright E2E) land RED before any source change. Each FR maps to ≥ 1 failing assertion: FR-001/002/003 → safe-area-layout integration + safe-area-tokens unit; FR-004 → safe-area-layout integration (banner / iOS sheet rect assertions); FR-005 → grep guard in safe-area-tokens unit (`viewport-fit=cover` literal preserved); FR-006 → safe-area-tokens unit (0px fallback); FR-007 → safe-area-tokens unit (token naming convention); FR-008 → safe-area-layout integration (Settings sheet rect); FR-009..FR-018 → settings-install-section integration + install-settings-surface unit; SC-001..SC-004 → safe-area-layout integration + e2e; SC-005..SC-011 → settings-install-section integration + e2e. The existing feature-005 install-banner / install-ios-sheet contracts are explicitly *not* changed — they are the regression guards for FR-015 (banner-dismissal-only suppression). |
| **III. User Experience Consistency**            | PASS w/ doc | Two user-visible changes (every persistent surface respects the safe area; Settings sheet contains an "Install app" section). New `docs/ui/0011-safe-area-install-buttons.md` mandatory before merge. Design-token additions (six new `--*-zone-*` tokens) extend `tokens.css` rather than overriding inline. WCAG 2.5.5 Level AAA touch-target floor (`--tap-min: 44px`, feature 009) preserved on the new install button. The iOS instructional dialog matches the existing `InstallIosSheet.svelte` accessibility shape (`role="dialog"`, `aria-modal="true"`, explicit close). Dark-mode tokens unchanged. |
| **IV. Performance Requirements**                | PASS        | Five explicit budgets: JS bundle delta ≤ +1 KiB gzipped; CSS bundle delta ≤ +0.5 KiB gzipped; install-button-tap-to-prompt latency ≤ 200 ms; first-paint unchanged; 60 fps map interaction preserved. Verified by existing `bundle-size` script + manual Playwright trace check on the e2e spec. |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0031 (safe-area zone tokens generalised + on-demand install entry + un-suppressed derived store rationale). The relationship to ADR 0014 (Accessibility Baseline), ADR 0021 (additive prefs evolution), ADR 0025 (PWA install surfaces), and ADR 0029 (mobile touch-target + notification region) is captured in ADR 0031's "related" section. The ADR index (`docs/adr/README.md`) is updated post-`/speckit.implement`. ADR 0025 is *extended*, not superseded — the new on-demand entry is an additional install surface, not a replacement. |

**Locale convention compliance** — only the two settings install
keys (`settings.install.heading`, `settings.install.alreadyInstalled`)
are new. The spec's FR-016 explicitly permits new keys where no
existing key carries the semantic; both new keys are documented in
research.md §R5. The `zh` BCP-47 rule is unchanged: every locale path
uses `zh` (never `zh-TW` / `zh-Hant`).

**Result**: All five principles pass on the planned design. No
unjustified deviations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-safe-area-install-buttons/
├── plan.md                                    # This file
├── research.md                                # Phase 0 output
├── data-model.md                              # Phase 1 output
├── quickstart.md                              # Phase 1 output (incl. mobile-emulator + iOS Safari walkthrough)
├── contracts/
│   ├── safe-area-zone-tokens.md               # six new design tokens + composition rule
│   ├── settings-install-section.md            # the new SettingsSheet section's render contract per derived surface
│   └── install-settings-surface.md            # the new derived store's public surface, invariants, and test matrix
├── checklists/
│   └── requirements.md                        # /speckit.specify output (already exists)
└── tasks.md                                   # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   ├── App.svelte                             # AMENDED — .toolbar / .map-controls swap literal offsets for zone tokens
│   └── tokens.css                             # AMENDED — adds six new --*-zone-* tokens for toolbar / map-controls / readout / attribution / settings-sheet
├── components/
│   ├── CoordinateReadout.svelte               # AMENDED — bottom offset → --readout-zone-bottom
│   ├── AttributionBar.svelte                  # AMENDED — bottom offset → --attribution-zone-bottom (or aliased to --readout-zone-bottom; see research §R2)
│   ├── InstallBanner.svelte                   # AMENDED — bottom offset → --install-banner-zone-bottom (re-uses --readout-zone-bottom budget; see research §R2)
│   ├── InstallIosSheet.svelte                 # AMENDED — bottom offset → same as InstallBanner
│   ├── SettingsSheet.svelte                   # AMENDED — adds env(safe-area-inset-*) to .sheet container; adds new <section class="install-section"> with derived-store branches
│   ├── ZoomControls.svelte                    # AMENDED IF NEEDED — see research §R3 (only edit if it owns its own positioning)
│   └── Compass.svelte                         # AMENDED IF NEEDED — same caveat as ZoomControls.svelte
└── pwa/
    └── installSettingsSurface.ts              # NEW — Svelte derived store that returns the un-suppressed install surface for the Settings entry

tests/
├── unit/
│   ├── safe-area-tokens.spec.ts               # NEW — token shape + 0px fallback + naming convention
│   └── install-settings-surface.spec.ts       # NEW — derived store: 30-day dismissal bypass + installed→standalone + unsupported→hidden
├── integration/
│   ├── settings-install-section.spec.ts       # NEW — DOM presence + button label + click outcome per derived surface
│   └── safe-area-layout.spec.ts               # NEW — App layout rects clear viewport edges by stubbed inset
└── e2e/
    └── safe-area-install.e2e.spec.ts          # NEW — Playwright Mobile Safari + Mobile Chrome end-to-end

docs/
├── ui/
│   └── 0011-safe-area-install-buttons.md      # NEW — UI record per Principle III
└── adr/
    └── 0031-safe-area-and-on-demand-install.md # NEW — ADR per Principle V
```

**Structure Decision**: Single-project layout (Option 1) — same as
features 001–010. New artefacts live alongside their existing peers
(`src/components/*.svelte`, `src/pwa/*.ts`, `tests/unit/*.spec.ts`,
`tests/integration/*.spec.ts`, `tests/e2e/*.e2e.spec.ts`,
`docs/ui/*`, `docs/adr/*`) with consecutive numbering. No new
top-level directories.

## Complexity Tracking

> No constitutional gate failures. One justified plan-target overshoot
> documented post-implementation.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Bundle delta exceeded plan target (+3.15 KB JS vs ≤ +1 KiB target) | Post-implementation amendments (FR-019..FR-023) added a second matchMedia query, the install section's iOS instructions dialog with inline Share-icon SVG, the segment-hide filter, and the `--color-on-accent` token | Project-enforced budget (+6 KB per-feature) PASSES; refactoring the iOS instructions into a shared `<InstallIosInstructions>` snippet to recover ~1 KB was deferred — addressed by analyse finding F2 |

## Post-implementation amendments (2026-04-28)

Five UX adjustments shipped after the original plan landed:

1. `.map-controls` re-anchored to left-center on every viewport (was
   `right + bottom`). FR-019.
2. `.readout` `bottom` lift `+var(--space-5)` promoted from
   narrow-only `@media` to the base rule. FR-020.
3. Readout collapse re-architected — toggle-able on every viewport
   with new `defaultCollapsed = (isNarrow OR isShort)` matrix; new
   `(max-height: calc(800px - 0.02px))` matchMedia. FR-021 / FR-022.
4. Hidden `goto.fields.zone` and `goto.fields.precision` segments
   in readout display (presentation-only filter; segments contract
   for Go To unchanged). FR-023.
5. New `--color-on-accent` token to satisfy feature 007's
   `settings-contrast.spec.ts` regression net.

Files amended in addition to those listed above:

- `src/components/CoordinateReadout.svelte` — extra `isShort`
  matchMedia + `userToggled` XOR + `data-toggleable` attribute +
  `data-mode` literal change + segment hide filter
- `tests/unit/coordinate-readout-tap-expand.spec.ts` — `'tap-expanded'`
  literal updates + 2 new test cases
- `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` — `'tap-expanded'`
  → `'expanded'` literal
- `tests/integration/safe-area-layout.spec.ts` — readout-bottom test
  consolidated to base rule

### Final cumulative bundle delta vs `master`

| Asset | Delta | Per-feature budget |
| ----- | ----- | ------------------ |
| Entry JS gzipped | +3.15 KB | +6 KB ✓ |
| Entry CSS gzipped | +0.04 KB | (within the same +6 KB pool) ✓ |

### Final test count

703 / 703 vitest tests GREEN. e2e (`safe-area-install.e2e.spec.ts`,
`mobile-collapsed-readout.e2e.spec.ts`) authored and ready; deferred
to CI / real-device run per quickstart §1–§3.
