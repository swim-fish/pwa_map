# Implementation Plan: PWA Install Affordance for Android & iOS

**Branch**: `005-pwa-installable` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-pwa-installable/spec.md`

## Summary

Make the existing PWA discoverable as an installable app by surfacing
an in-app install affordance — without changing manifest, service
worker, or any product behaviour from features 001–004. The affordance
has three platform-distinct surfaces driven by a single source of
truth (a Svelte store that fuses `beforeinstallprompt`, `appinstalled`,
`navigator.standalone`, `matchMedia('(display-mode: standalone)')`,
and a single `localStorage` dismissal key):

1. **Android / desktop Chromium banner** (US1, P1 / MVP) — listen for
   `beforeinstallprompt` on `window`, `preventDefault()`, retain the
   event, and render a non-blocking banner in `App.svelte` with two
   actions: **Install** (calls `event.prompt()` and observes
   `event.userChoice`) and **Not now** (writes the 30-day dismissal
   key). On `appinstalled`, the affordance hides for the remainder of
   the install lifetime — the only re-arming path is clearing site
   data.

2. **iOS Safari instructional sheet** (US2, P2) — iOS exposes neither
   `beforeinstallprompt` nor a programmatic install. Detect "iOS
   Safari, not standalone" via UA + `navigator.standalone === false`,
   render a localised step-by-step sheet describing the
   Share → Add-to-Home-Screen gesture, plus a Share-icon hint. Same
   "Got it" / 30-day dismissal write semantics as US1.

3. **Suppression & re-arming** (US3, P3) — when the app is launched in
   standalone mode (`matchMedia('(display-mode: standalone)').matches`
   OR `navigator.standalone === true`), no affordance MUST render at
   all (DOM absent, not just hidden). Same gate covers "dismissedUntil
   in the future" and "appinstalled has fired this session". Clearing
   site data wipes `pwa_map:installDismissedUntil` and re-arms.

Technical approach: keep the existing TypeScript + Svelte 4 + Vite +
vite-plugin-pwa toolchain. **No new runtime dependency.** All work
goes through standard browser APIs already documented in
`spec.md` (`beforeinstallprompt`, `appinstalled`, `matchMedia`,
`navigator.standalone`, `navigator.userAgent`, `localStorage`). The
new code mirrors the feature-004 pattern: a tiny pure-function
platform detector, one Svelte store with named action exports, one
storage helper for the dismissal key, two new UI components (an
Android banner and an iOS sheet — split rather than merged so each
can be rendered / tested in isolation), and i18n entries in three
locales. Tests are TDD: Vitest unit specs for the detector, the store,
the dismissal helper, and the contrast tokens; Vitest integration for
the two surfaces and for suppression; one Playwright E2E that drives a
deterministic synthetic `beforeinstallprompt` via a test-only window
hook (the same pattern feature 004 introduced for `needRefresh`).

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target) — inherited
from features 001–004.

**Primary Dependencies**:

- `svelte` 4.x — UI framework. The two new components reuse the
  existing `App.svelte` toast / dialog placement model.
- `vite-plugin-pwa` 0.20.x — already configured (registerType:
  `'prompt'`, manifest with `display: 'standalone'`, all icons
  resolved). **No config change required.** This feature does not
  modify the manifest, the SW registration, or the cache strategy.
- Standard browser APIs only: `window.addEventListener('beforeinstallprompt'|'appinstalled')`,
  `navigator.standalone` (iOS Safari extension), `navigator.userAgent`,
  `matchMedia`, `localStorage`.
- **No new runtime deps. No new test deps.**

**Storage**: One **new** `localStorage` key:
`pwa_map:installDismissedUntil` — value is a string-ified epoch
milliseconds at which the affordance MAY re-appear. Absent or
unparseable / past values are treated as "never dismissed" (same
corruption-tolerance pattern as `pwa_map:offlineReadyShown` from
feature 004). The key is **separate from** `pwa_map:prefs` so ADR
0021 (additive prefs evolution) is unaffected. The runtime
`InstallPromptState` is in-memory only — rebuilt on every page load
from the dismissal key + browser APIs.

**Testing**: Vitest (unit + integration) + Playwright (E2E).

- Unit specs run in jsdom with `navigator.userAgent`,
  `navigator.standalone`, `matchMedia`, and `localStorage` mocked or
  stubbed via Vitest's `vi.stubGlobal` / Object.defineProperty
  patterns already used in `tests/unit/helpers/setup.ts`.
- Integration specs mount component pairs (`InstallBanner.svelte` /
  `InstallIosSheet.svelte`) against a synthetic
  `beforeinstallprompt` event whose `prompt()` returns a
  `Promise<{ outcome: 'accepted' | 'dismissed' }>` per the platform
  contract.
- E2E (Playwright, Chromium) drives a test-only `window.__pwaTestHooks
  .triggerBeforeInstallPrompt` (gated to `import.meta.env.DEV ||
  import.meta.env.MODE === 'test'`) — same gating as the
  `triggerUpdateAvailable` hook from feature 004. Real browser-issued
  `beforeinstallprompt` events are heuristic-driven and too
  non-deterministic for CI; the synthetic event verifies the
  app-side wiring while leaving the real browser path to manual
  smoke per SC-002.

**Target Platform**: Same as features 001–004:

- Chromium (desktop + Android) 120+ — full US1 path.
- WebKit / iOS Safari 15+ — US2 instructional path.
- Firefox 120+ desktop, Firefox Android — fall through US3 / unsupported
  silently (no `beforeinstallprompt`, no install action shown).
- iOS Chrome / Edge / Firefox (CriOS / EdgiOS / FxiOS) — fall through
  to a read-only "open in Safari" hint or no-render per FR-010.

**Project Type**: Single project — extension of the existing PWA. No
backend, no new package boundary, no new top-level directory.

**Performance Goals**:

- Time-to-affordance after `beforeinstallprompt` fires (US1 / SC-001):
  ≤ **5 s** in 100 % of qualifying sessions (measured by Vitest
  integration test that fires the event and asserts DOM).
- iOS sheet first-paint after detection (US2 / SC-003): ≤ **5 s** —
  same measurement pattern.
- Cumulative bundle delta from this feature (SC-007): ≤ **4 KB**
  gzipped on the main bundle (one banner + one sheet + one detector
  + one store + one storage helper + 12+ i18n strings × 3 locales).
  Verified by `scripts/check-bundle-size.js` in CI.
- Native-install wall-clock under normal mobile network (SC-002):
  ≤ **30 s** — out of CI scope; manual smoke metric only because the
  native sheet is owned by the browser, not the app.

**Constraints**:

- Total JS bundle (gzipped, initial load): unchanged ceiling of ≤
  200 KB from feature 003 / 004 budgets; delta from feature 004 ≤
  4 KB (SC-007).
- WCAG AA contrast (Principle III + ADR 0014) — both surfaces MUST
  hit ≥ 4.5:1 for body text and ≥ 3:1 for non-text UI in light AND
  dark schemes, reusing the established tokens
  (`--color-surface-elev`, `--color-fg`, `--color-accent`,
  `--color-border`).
- Tap targets ≥ 36 × 36 px (SC-009 + ADR 0014) for both Install /
  Dismiss buttons and the iOS sheet's "Got it" button.
- localStorage schema stability (ADR 0021): `pwa_map:prefs`,
  `pwa_map:lastView`, `pwa_map:gotoHistory_v1`,
  `pwa_map:offlineReadyShown` shapes unchanged. The new
  `pwa_map:installDismissedUntil` is a separate key.
- Constitution Locale conventions: every new i18n key uses `zh / en /
  ja` only — no `zh-TW`, `zh-Hant`, etc.
- Reduced-motion compliance — both surfaces' enter / exit animation
  MUST honour `prefers-reduced-motion: reduce` and skip slide-in
  transitions when set (FR-019).
- Layout non-conflict — affordance MUST NOT overlap the existing
  feature-004 `UpdatePrompt` (top-center) or the offline-ready /
  copy / zone-hint / layer-fail toasts (bottom-center). Anchor pick
  documented in `docs/ui/0005-pwa-installable.md`.

**Scale/Scope**:

- 2 new components (`InstallBanner.svelte`, `InstallIosSheet.svelte`).
- 3 new modules:
  - `src/pwa/installPlatform.ts` — pure-function platform detector.
  - `src/pwa/installSignal.ts` — Svelte writable + action exports
    (`captureBeforeInstallPrompt`, `triggerInstall`, `recordDismissal`,
    `markInstalled`, `__resetForTests`).
  - `src/storage/installDismissed.ts` — get / set / corruption-tolerant
    parser for `pwa_map:installDismissedUntil`.
- 1 amended module (`src/app/App.svelte`) — wires `beforeinstallprompt`
  + `appinstalled` listeners, mounts the two new components.
- 1 amended config — none required (vite.config.ts unchanged).
- ~14 new i18n keys under `pwa.install.*` × 3 locales = ~42 string
  additions.
- 1 new ADR (ADR 0025 — PWA install surfaces & dismissal-key design).
- 1 new UI record (`docs/ui/0005-pwa-installable.md`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                            | Verdict     | Justification |
| ---------------------------------------------------- | ----------- | ------------- |
| **I. Code Quality & Formatting**                     | PASS        | All new files (TS + Svelte) ride the existing Prettier + ESLint flat config. `npm run format` mandatory after edits per Development Workflow. No new linter rule, no new style. |
| **II. Test-First Development (NON-NEGOTIABLE)**      | PASS        | Each user story has explicit failing-tests-first slots in Phase-2 tasks: unit (`installPlatform`, `installSignal`, `installDismissed`), integration (`InstallBanner`, `InstallIosSheet`, suppression), E2E (synthetic `beforeinstallprompt` flow). Tests-before-implementation enforced in `tasks.md`. |
| **III. User Experience Consistency**                 | PASS w/ doc | Two visible UI surfaces (Android banner + iOS instructional sheet) and one new viewport anchor. New `docs/ui/0005-pwa-installable.md` mandatory before merge — entry deferred to `/speckit.implement` per existing pattern. Tokens reused; no new colour value introduced. Both surfaces honour `prefers-reduced-motion: reduce`. Tap targets ≥ 36 × 36 px. WCAG AA contrast verified by the same helper feature 004 introduced. |
| **IV. Performance Requirements**                     | PASS        | Three explicit budgets in **Performance Goals**: SC-001 (5 s to affordance), SC-003 (5 s iOS sheet), SC-007 (≤ 4 KB gzipped bundle delta). All measurable: SC-001 / SC-003 verified by Vitest integration; SC-007 verified by `scripts/check-bundle-size.js` in CI. |
| **V. Documentation & ADRs**                          | PASS w/ doc | One new ADR planned: ADR 0025 (PWA install surfaces & dismissal-key design — including platform-detection contract, the localStorage key, and the layout-anchor decision). ADR index updated post-implement. The `docs/ui/0005-pwa-installable.md` UI record covers Principle III. No existing ADR is superseded. |

**Locale convention compliance** — every new i18n key uses the existing
`zh / en / ja` locales verbatim (`pwa.install.android.*`,
`pwa.install.ios.*`, `pwa.install.iosOther.*`). No new locale identifier
introduced.

**Result**: All five principles pass on the planned design. No
unjustified violations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-pwa-installable/
├── plan.md                             # This file
├── research.md                         # Phase 0 output
├── data-model.md                       # Phase 1 output
├── quickstart.md                       # Phase 1 output
├── contracts/
│   ├── install-platform.md             # Pure-function detector contract
│   ├── install-signal.md               # Svelte store API + lifecycle
│   ├── install-banner.md               # InstallBanner.svelte (Android / desktop) contract
│   ├── install-ios-sheet.md            # InstallIosSheet.svelte (iOS instructional) contract
│   └── install-dismissed-storage.md    # localStorage key parser + writer contract
├── checklists/
│   └── requirements.md                 # /speckit.specify output (already exists)
└── tasks.md                            # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   └── App.svelte                          # AMENDED — install listeners + mount banner/sheet
├── components/
│   ├── InstallBanner.svelte                # NEW — Android / desktop Chromium affordance
│   └── InstallIosSheet.svelte              # NEW — iOS Safari instructional sheet
├── pwa/
│   ├── installPlatform.ts                  # NEW — pure-function platform detector
│   └── installSignal.ts                    # NEW — Svelte writable + action exports
├── storage/
│   └── installDismissed.ts                 # NEW — pwa_map:installDismissedUntil get/set
└── i18n/
    ├── zh.json                             # AMENDED — pwa.install.* keys
    ├── en.json                             # AMENDED — same keys
    └── ja.json                             # AMENDED — same keys

tests/
├── unit/
│   ├── pwa/
│   │   ├── installPlatform.spec.ts         # NEW — UA × matchMedia × standalone matrix
│   │   └── installSignal.spec.ts           # NEW — store actions + dismissal window
│   └── storage/
│       └── installDismissed.spec.ts        # NEW — parser + corruption-tolerance
├── integration/
│   ├── install-banner.spec.ts              # NEW — banner render + Install / Not-now wiring
│   ├── install-ios-sheet.spec.ts           # NEW — iOS sheet render + Got-it wiring
│   └── install-suppression.spec.ts         # NEW — standalone + dismissedUntil + appinstalled
└── e2e/
    └── story-5-install.spec.ts             # NEW — synthetic beforeinstallprompt + DOM assert

docs/
├── ui/
│   └── 0005-pwa-installable.md             # NEW — UI record per Principle III
└── adr/
    └── 0025-pwa-install-surfaces.md        # NEW — install surfaces + dismissal-key design

vite.config.ts                              # UNCHANGED
```

**Structure Decision**: Single-project layout (Option 1 from the
template) — same as features 001–004. No new package boundaries, no
new top-level directories. Each new file lives next to existing peers
(`src/components/*`, `src/pwa/*`, `src/storage/*`,
`tests/unit/{pwa,storage}`, `tests/integration`, `tests/e2e`,
`docs/{ui,adr}`).

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none)    | (none)     | (none)                              |
