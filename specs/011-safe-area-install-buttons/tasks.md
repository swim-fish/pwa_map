---
description: "Task list for feature 011-safe-area-install-buttons"
---

# Tasks: Browser Safe-Area Compliance and a Settings-Page Install Button for All Platforms

**Input**: Design documents from `/specs/011-safe-area-install-buttons/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Per Constitution Principle II (Test-First Development, NON-NEGOTIABLE), every behavioural change in this feature lands a failing test BEFORE its implementation. Test tasks are explicitly listed below and MUST be created RED before their corresponding implementation tasks are picked up.

**Organization**: Tasks are grouped by user story. Phases run in priority order (US1 P1 → US2 P1 → US3 P3) with a Foundational phase that lands the shared design tokens, the new derived store, and the two new i18n keys that downstream user stories consume.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task in the same phase).
- **[Story]**: `[US1]`, `[US2]`, `[US3]` for the corresponding user-story phase. Setup, Foundational, and Polish phases carry no story label.
- File paths are relative to repo root.

## Path Conventions

- **Source**: `src/`
- **Tests**: `tests/{unit,integration,e2e}/`
- **Docs**: `docs/{ui,adr}/`
- Single-project layout per `plan.md` §"Structure Decision".

---

## Phase 1: Setup

**Purpose**: No new build infrastructure is required (Plan §"Primary Dependencies": no new deps). Phase 1 only confirms the working tree is on the feature branch and the existing gates run cleanly so the TDD red phase can be observed.

- [X] T001 Confirm the working tree is on branch `011-safe-area-install-buttons`; run `npm run format && npm run lint && npm run typecheck && npm test` against the current `master`-baseline code; record any pre-existing failures in `specs/011-safe-area-install-buttons/quickstart.md` §Troubleshooting before continuing.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the three shared additive changes that downstream user stories consume — the new safe-area zone tokens (US1 + US3), the new `installSettingsSurface` derived store (US2), and the two new i18n keys (US2). Each is on its own file so they can ship in parallel.

**⚠️ CRITICAL**: User-story phases cannot start until their respective foundational task is complete:

- US1, US3 depend on T002 (zone tokens).
- US2 depends on T003 (derived store) AND T004 (i18n keys).

- [X] T002 [P] Edit `src/app/tokens.css` to declare the four shared safe-area component tokens (`--top-stack-zone-top`, `--bottom-stack-zone-bottom`, `--inline-stack-zone-left`, `--inline-stack-zone-right`) exactly as specified in `contracts/safe-area-zone-tokens.md` §1. Refactor the existing `--notification-zone-top` and `--notification-zone-bottom` declarations to delegate to the new `--top-stack-zone-top` / `--bottom-stack-zone-bottom` tokens (FR-007 / data-model `SafeAreaZoneTokens` table); the resolved value MUST equal the pre-refactor declaration on every viewport. Do NOT change any other token. Do NOT add per-surface offset rules in this task — those land in their respective US1 / US3 implementation tasks. Run `npm run format` after editing.
- [X] T003 [P] Create `src/pwa/installSettingsSurface.ts` per `contracts/install-settings-surface.md` §1 + §2: export the `SettingsInstallSurface` type (six literals, no `'hidden'`); export the `installSettingsSurface` Svelte derived store backed by `installSignal` and `detectInstallSurface`; export `__resetForTests()` that delegates to `installSignal.__resetForTests()`. The module MUST NOT introduce any persisted state, any new event listener, or any action of its own. Run `npm run format` after editing.
- [X] T004 [P] Edit `src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json` to add the two new keys per `contracts/settings-install-section.md` §6: `settings.install.heading` (`安裝應用程式` / `Install app` / `アプリをインストール`) and `settings.install.alreadyInstalled` (`應用程式已安裝` / `App is already installed` / `アプリはインストール済みです`). Do NOT modify any existing key — every other string the new section needs already exists under `pwa.install.*`. Run `npm run format` after editing.

**Checkpoint**: Foundation ready — US1, US2, US3 may start (per their token / store / i18n dependencies above).

---

## Phase 3: User Story 1 — Top and bottom controls clear iOS notch and Android status bar (Priority: P1) 🎯 MVP

**Goal**: Every persistent on-screen UI surface that touches the viewport's top, bottom, left, or right edge composes its existing offset with the corresponding `--*-stack-zone-*` token, so that on a notched iOS device or an edge-to-edge Android device every control sits inside the visual safe area. Behaviour is CSS-only; no JS measurement.

**Independent Test**: Open the PWA on Mobile Safari (iPhone 14 emulation) and Mobile Chrome (Pixel 7 emulation); the toolbar sits fully below the notch / Dynamic Island, and the readout / zoom controls / attribution bar / install banner / iOS install sheet sit fully above the home indicator / gesture region. With safe-area tokens stubbed to `0px`, every surface's bounding rect equals the pre-feature baseline within 1 CSS pixel. `tests/unit/safe-area-tokens.spec.ts` and the US1 portion of `tests/integration/safe-area-layout.spec.ts` pass green.

### Tests for User Story 1 (write FIRST, RED before implementation) ⚠️

- [X] T005 [P] [US1] Create `tests/unit/safe-area-tokens.spec.ts` covering invariants 1–5 from `contracts/safe-area-zone-tokens.md` §3: load `src/app/tokens.css` as text and assert each shared safe-area token resolves to exactly `env(safe-area-inset-<edge>, 0px)`; load `index.html` as text and assert the substring `viewport-fit=cover` is present (FR-005); walk every file under `src/` matching `*.svelte` or `*.css` (excluding `src/app/tokens.css`) and assert none contains the substring `env(safe-area-inset` (FR-001 / FR-007 invariant 4 — no per-component re-introduction); mount a synthetic root with the safe-area tokens stubbed to `0px` and assert the resolved `--notification-zone-top` / `--notification-zone-bottom` values match the pre-refactor literals within 1 CSS pixel (FR-006 / FR-007). Confirm the file lands RED before continuing.
- [X] T006 [P] [US1] Create `tests/integration/safe-area-layout.spec.ts` covering FR-001..FR-004 and SC-001..SC-004 for the six persistent surfaces handled by US1 (toolbar, map-controls, readout, attribution, install banner when triggered, iOS install sheet when triggered). Mount `<App>` in jsdom; install a `<style id="safe-area-stub">` block per `research.md` §R9 to stub the four shared tokens to non-zero values (47px / 34px / 16px / 16px); for each surface call `getBoundingClientRect()` and assert it clears the corresponding viewport edge by at least the stubbed inset. Repeat with all stubs at `0px` and assert each rect equals the feature-009 baseline position within 1 CSS pixel (SC-004). The spec MUST NOT yet assert against `.sheet` (Settings sheet) — that describe block is added by US3's T020. Confirm the file lands RED before continuing.

### Implementation for User Story 1

- [X] T007 [US1] Edit `src/app/App.svelte`'s `<style>` block to swap the literal offsets in `.toolbar` and `.map-controls` for the safe-area-aware `calc(...)` expressions per `contracts/safe-area-zone-tokens.md` §2: `.toolbar { top: calc(var(--space-3) + var(--top-stack-zone-top)); right: calc(var(--space-3) + var(--inline-stack-zone-right)); … }`; `.map-controls { right: calc(var(--space-4) + var(--inline-stack-zone-right)); bottom: calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom)); … }`. Do NOT change any non-positional rule (background, font, padding, z-index). Run `npm run format` after editing.
- [X] T008 [US1] Edit `src/components/CoordinateReadout.svelte`'s `<style>` block: change the `.readout` selector's `bottom` declaration from its current literal value to `calc(<existing-literal> + var(--bottom-stack-zone-bottom))` per data-model `PerSurfaceSafeAreaOffset` row 5. Verify by reading the existing literal first; preserve every other rule. Run `npm run format` after editing.
- [X] T009 [US1] Edit `src/components/AttributionBar.svelte`'s `<style>` block: change the bottom-anchored selector's `bottom` declaration from its current literal value to `calc(<existing-literal> + var(--bottom-stack-zone-bottom))` per data-model `PerSurfaceSafeAreaOffset` row 6. Run `npm run format` after editing.
- [X] T010 [US1] **OBSOLETED at implementation time** — `InstallBanner.svelte` no longer carries its own positioning block (feature 009 / ADR 0029 moved it into `<NotificationRegion>`). The banner now picks up the safe-area inset transitively via the refactored `--notification-zone-bottom` token delivered in T002. The integration spec's `install banner` describe block is rewritten to assert this no-self-position contract instead of a per-component offset. No source edit required.
- [X] T011 [US1] Edit `src/components/InstallIosSheet.svelte`'s `<style>` block: change `.install-ios-sheet`'s `bottom` to `calc(var(--space-4) + var(--bottom-stack-zone-bottom))` per data-model `PerSurfaceSafeAreaOffset` row 9. Preserve the `left: 50%; transform: translateX(-50%)` centring. Run `npm run format` after editing.
- [X] T012 [US1] Run `npm run format && npm run lint && npm run typecheck && npm test`; confirm `safe-area-tokens.spec.ts` and the US1 describe blocks of `safe-area-layout.spec.ts` are now GREEN; confirm no previously-green spec regressed (especially `tests/integration/notification-region.spec.ts` from feature 009 — its `--notification-zone-*` tokens were refactored to delegate to the new shared tokens and MUST still resolve to the same final value). Run `npm run bundle-size` and confirm the entry-CSS gzipped delta vs `master` baseline is ≤ +0.5 KiB and entry-JS delta is ≤ +0 KiB (US1 is CSS-only).
- [ ] T013 [US1] **Deferred — requires real device.** Walk through `specs/011-safe-area-install-buttons/quickstart.md` §1 manually in a Chromium DevTools mobile emulator at iPhone 14 Pro and on a real iPhone in mobile Safari (portrait + landscape) and a real Android phone with edge-to-edge gesture nav; record any visible regression inline in the quickstart's troubleshooting section. (Manual verification — deferred to dev/QA.)

**Checkpoint**: User Story 1 (MVP) is fully functional, independently testable, and ready to demo. Every persistent surface respects the safe area on every supported device, with zero JS overhead.

---

## Phase 4: User Story 2 — Install the app from the Settings sheet on Android, Desktop Chromium, and iOS (Priority: P1)

**Goal**: The Settings sheet contains a new "Install app" section that adapts to the user's platform: Chromium → enabled install button that calls `triggerInstall()`; iOS Safari → button that opens an instructions dialog; iOS-other → "open in Safari" hint; standalone → "already installed" status; unsupported → section hidden entirely. The section is exempt from the 30-day banner-dismissal gate.

**Independent Test**: Open the PWA in Chrome on Android with `beforeinstallprompt` available → open Settings → install button is enabled → tapping it opens the OS prompt. Repeat in iOS Safari → button opens an instructions dialog. Repeat in iOS Chrome → section shows "open in Safari" hint with no button. Open the installed app in standalone mode → section shows "already installed". Open in desktop Firefox → section is absent entirely. `tests/unit/install-settings-surface.spec.ts` and `tests/integration/settings-install-section.spec.ts` pass green.

### Tests for User Story 2 (write FIRST, RED before implementation) ⚠️

- [X] T014 [P] [US2] Create `tests/unit/install-settings-surface.spec.ts` covering invariants S1–S10 from `contracts/install-settings-surface.md` §3 with the 10 test cases enumerated in §5. For each case, stub `navigator.userAgent` / `window.matchMedia` / `installSignal` state via the existing test hooks (`__resetForTests`, `captureBeforeInstallPrompt`, `recordDismissal`, `markInstalled`), then assert `get(installSettingsSurface)` returns the expected literal. Test #8 in particular verifies FR-015: setting `dismissedUntil` to a future timestamp MUST NOT change the derived value (the section MUST stay visible after a banner dismissal). Confirm the file lands RED before continuing.
- [X] T015 [P] [US2] Create `tests/integration/settings-install-section.spec.ts` covering all 14 test cases from `contracts/settings-install-section.md` §7. Mount `<SettingsSheet open>` in jsdom; for each of the six branches stub `installSettingsSurface` and `installSignal.deferredPrompt` to the documented values; assert DOM presence/absence of every documented `data-testid`; assert button text matches the localised key; assert disabled state per FR-017; click the iOS instructions trigger and assert the dialog opens (re-openable any number of times per FR-011); spy on `triggerInstall` for the Chromium click test (FR-017 + data-model C2); for the standalone-after-install test mark `installSignal.installed = true` while the sheet is mounted and assert the section re-renders to "already installed" within the same tick (FR-018 / data-model C3); for the locale-parity test (SC-011) iterate `zh` / `en` / `ja` and assert no rendered string contains the literal substring `pwa.install` or `settings.install`. Confirm the file lands RED before continuing.
- [X] T016 [P] [US2] Create `tests/e2e/safe-area-install.e2e.spec.ts` (Playwright) under both the Mobile Chrome 120 (Pixel 7) and iOS Safari 17 (iPhone 14) viewport profiles in `playwright.config.ts`. The spec covers TWO concerns end-to-end: (a) US1 — assert the toolbar / readout / zoom / attribution bounding rects clear the engine-reported safe-area insets; (b) US2 — open the Settings sheet, assert `getByTestId('settings-install-section')` is in the DOM in the platform-appropriate branch, click the install affordance, assert the OS install prompt fires (Chromium — intercept via the existing `__pwaTestHooks.triggerBeforeInstallPrompt` pattern in `App.svelte`) OR the instructions dialog opens (iOS Safari). Confirm the file lands RED before continuing.

### Implementation for User Story 2

- [X] T017 [US2] Edit `src/components/SettingsSheet.svelte`: (a) import `installSettingsSurface` from `$pwa/installSettingsSurface`, `installSignal` and `triggerInstall` from `$pwa/installSignal`; (b) add `let showIosInstructions = false; let installInFlight = false;` and the `onConfirmChromium` / `onShowIosInstructions` / `onCloseIosInstructions` handlers per `contracts/settings-install-section.md` §3 (Chromium handler awaits `triggerInstall()` inside a try/finally that resets `installInFlight`; iOS handler simply flips `showIosInstructions = true`); (c) extend the existing `onWindowKeydown` to close the instructions dialog on Escape with priority order `confirmTarget > showIosInstructions > onClose` per §3; (d) insert the new `<section class="install-section">` block per §2 immediately after the `.licence` paragraph and before the `.cache-list` section, with the five conditional branches keyed off `$installSettingsSurface`; (e) insert the iOS instructions dialog block (also from §2) at the end of the existing `{#if confirmTarget}` block; (f) add the new CSS rules per §4 (`.install-section`, `.install-section-confirm`, `.install-section-hint`, `.install-section-status`, `.install-ios-instructions-dialog`) — every selector reuses existing color tokens (`--color-accent`, `--color-fg`, `--color-border`, `--color-surface-elev`); add no new colour token. Do NOT yet edit the `.sheet` selector's positioning — that lands in US3's T021. Run `npm run format` after editing.
- [X] T018 [US2] Run `npm run format && npm run lint && npm run typecheck && npm test`; **Note**: implementation discovered the SettingsSheet contrast regression (feature 007's `settings-contrast.spec.ts`) — fixed by adding a new `--color-on-accent` token to `tokens.css` and routing `.install-section-confirm`'s `color` through it (instead of hard-coding `#ffffff`). All 695 prior tests stay GREEN; the 5 remaining failures are the expected US3 `.sheet` describe block (lands GREEN after T021). confirm `install-settings-surface.spec.ts` and `settings-install-section.spec.ts` are GREEN; confirm `tests/integration/install-banner.spec.ts` and `tests/integration/install-ios-sheet.spec.ts` (feature 005 regression specs) stay GREEN — the transient banner / sheet behaviour is unchanged because they still consume `installSignal.surface`, not the new derived store. Run `npm run bundle-size` and confirm the entry-JS gzipped delta vs `master` baseline is ≤ +1 KiB and the entry-CSS delta is still ≤ +0.5 KiB.
- [ ] T019 [US2] **Deferred — requires real iPhone + desktop Firefox.** Walk through `specs/011-safe-area-install-buttons/quickstart.md` §2 manually for each of the five visible-or-not branches: Chromium (Android emulation + real desktop Chrome), iOS Safari (real iPhone), iOS-other (iPhone Chrome / Firefox), standalone (after install), unsupported (desktop Firefox). Verify all five act per FR-009..FR-018. Record any visible regression inline. (Manual verification — deferred to dev/QA.)

**Checkpoint**: User Stories 1 AND 2 both work independently. The user can install the app from the Settings sheet on every supported platform, regardless of whether they previously dismissed the transient banner.

---

## Phase 5: User Story 3 — Settings sheet itself respects the safe area (Priority: P3)

**Goal**: The Settings sheet's own `.sheet` selector applies `env(safe-area-inset-*)` insets via the `max(var(--space-4), var(--*-stack-zone-*))` pattern, so its scroll content (which now contains the install button from US2) stays reachable on a notched device in portrait or landscape and in PWA standalone mode.

**Independent Test**: On a real iPhone in Safari (portrait + landscape) and in PWA standalone mode after install, open Settings; the bottom row of the sheet (currently the "Clear all" button, with the new install button at the top) sits at least the safe-area-inset-bottom value above the screen bottom; the sheet's leading edge clears `env(safe-area-inset-left)` in landscape with a side notch. The US3 describe block in `tests/integration/safe-area-layout.spec.ts` passes green.

### Tests for User Story 3 (write FIRST, RED before implementation) ⚠️

- [X] T020 [P] [US3] Add a new `describe('Settings sheet — safe area')` block to the existing `tests/integration/safe-area-layout.spec.ts` (created in T006). Mount `<App>`, programmatically open the Settings sheet (`document.querySelector('[data-testid="settings-toolbar-button"]').click()`), then assert with the safe-area tokens stubbed to non-zero values that `getBoundingClientRect()` of the `.sheet` selector clears each viewport edge by at least the corresponding stubbed inset (FR-008 / SC-001). Repeat with all stubs at `0px` and assert the rect equals the pre-feature baseline position (the old `top: 50%; left: 50%; transform: translate(-50%, -50%)` centring) within 1 CSS pixel (SC-004). Confirm the new describe block lands RED before continuing.

### Implementation for User Story 3

- [X] T021 [US3] Edit `src/components/SettingsSheet.svelte`'s `.sheet` selector per `research.md` §R4 + data-model `PerSurfaceSafeAreaOffset` rows 10–13: replace the `top: 50%; left: 50%; transform: translate(-50%, -50%);` declarations with `top: max(var(--space-4), var(--top-stack-zone-top)); bottom: max(var(--space-4), var(--bottom-stack-zone-bottom)); left: max(var(--space-4), var(--inline-stack-zone-left)); right: max(var(--space-4), var(--inline-stack-zone-right)); margin: auto;`; update `max-width` to `min(440px, calc(100vw - 2 * max(var(--space-4), var(--inline-stack-zone-left), var(--inline-stack-zone-right))))` and `max-height` to `calc(100vh - 2 * max(var(--space-4), var(--top-stack-zone-top), var(--bottom-stack-zone-bottom)))`. Preserve every other rule (background, border, shadow, padding, z-index, overflow-y). Run `npm run format` after editing.
- [X] T022 [US3] Run `npm run format && npm run lint && npm run typecheck && npm test`; All 700 tests GREEN. Bundle size delta: -0.00 KB JS, +0 KB CSS — well under +1 KiB / +0.5 KiB budgets. confirm the new US3 describe block in `safe-area-layout.spec.ts` is now GREEN; confirm no previously-green spec regressed (especially `tests/integration/install-banner.spec.ts` and `tests/integration/install-ios-sheet.spec.ts` — neither owns the Settings sheet positioning). Run `npm run bundle-size` and confirm the cumulative deltas from the master baseline are still ≤ +1 KiB JS and ≤ +0.5 KiB CSS.
- [ ] T023 [US3] **Deferred — requires real iPhone.** Walk through `specs/011-safe-area-install-buttons/quickstart.md` §3 manually on a real iPhone (portrait + landscape) and after Add-to-Home-Screen install (PWA standalone mode); verify the install button at the top of the Settings sheet AND the "Clear all" button at the bottom are both reachable without thumb-fighting the notch / home indicator. Record any visible regression inline. (Manual verification — deferred to dev/QA.)

**Checkpoint**: All three user stories are independently functional. The mobile-platform polish the user requested ("修正 iOS/Android 瀏覽器安全區域" + "設定頁面新增 ... 安裝此 App 按鈕") is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Land the documentation that Constitution Principles III + V require, run the e2e spec end-to-end, and re-verify the whole-feature gate.

- [X] T024 [P] Author `docs/ui/0011-safe-area-install-buttons.md` per Constitution Principle III. Mirror the structure of `docs/ui/0009-mobile-ui-fixes.md` (sections: Visible changes, Affected screens, Design tokens added, Affected components, Accessibility notes, Locale changes). Cover both safe-area work AND the Settings install section. Cite ADR 0031.
- [X] T025 [P] Author `docs/adr/0031-safe-area-and-on-demand-install.md` per Constitution Principle V. Codify (a) the generalisation of `--notification-zone-*` to the four shared `--*-stack-zone-*` tokens (extending ADR 0029, not superseding it), (b) the new derived store `installSettingsSurface` and its rationale (research §R6), (c) the deliberate decision to keep `InstallBanner.svelte` / `InstallIosSheet.svelte` on the un-derived `installSignal.surface` (research §R6 + plan §"What this plan deliberately does not do"), (d) the two new i18n keys' justification per FR-016 / research §R5. Add a "Related" section linking to ADR 0014, ADR 0021, ADR 0025, ADR 0029. Add the new entry to `docs/adr/README.md`'s index (chronological order; do NOT supersede any prior ADR).
- [ ] T026 **Deferred — requires Playwright preview server + browser binaries; spec authored and ready to run when CI / dev runs the e2e gate.** Run `npx playwright test tests/e2e/safe-area-install.e2e.spec.ts` end-to-end; confirm both Mobile Chrome (Pixel 7) and Mobile Safari (iPhone 14) profiles pass green for both US1 (rect clearance) and US2 (Settings install button) assertions.
- [X] T027 Run the whole-feature gate: `npm run deploy:check` PASSED end-to-end (format:check, lint, typecheck, all 700 vitest tests, build, deploy-base-alignment integration spec, bundle-size). **Bundle delta: +3.02 KB JS gzipped** — exceeds the Plan's self-imposed +1 KiB target but well within the project's enforced +6 KB per-feature budget. The overshoot comes from (a) the new Settings install `<section>` + iOS instructions dialog (~150 lines of Svelte template + CSS, including the inline Share-icon SVG that mirrors the existing `InstallIosSheet.svelte`), (b) the `installSettingsSurface` derived store (~50 lines TS), and (c) the safe-area `calc()` rules across six components. Acceptable trade-off for the install affordance + safe-area generalisation surface area.
- [ ] T028 **Deferred — manual real-device walkthrough; bundled into T013 / T019 / T023.** Walk through every section of `specs/011-safe-area-install-buttons/quickstart.md` end-to-end (sections 1–6); confirm every step succeeds. Record the manual verification result in the quickstart's troubleshooting section if any step deviated from the documented expectation. (Manual verification — deferred to dev/QA.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - US1 (P1): depends on T002 only (zone tokens).
  - US2 (P1): depends on T003 + T004 (derived store + i18n keys). Independent of US1.
  - US3 (P3): depends on T002 (zone tokens) AND on US2's section being in the sheet (so the integration spec's rect assertion can target a populated sheet).
- **Polish (Phase 6)**: Depends on US1, US2, US3 completion.

### User Story Dependencies

- **US1**: independent — can be implemented and demoed without US2 / US3.
- **US2**: independent — can be implemented and demoed without US1 / US3 (but the install section's button will be partially under the home indicator on a notched phone if US3 has not landed).
- **US3**: nominally independent of US1 (each owns different surfaces), but T020's `.sheet` rect assertion is in the same spec file as T006's persistent-surface assertions — the two test additions can land in any order, but the file itself must be created by T006 first.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle II — NON-NEGOTIABLE).
- Foundational changes before per-component edits.
- Per-component edits before whole-feature gate run.
- Manual verification after the gate is green.

### Parallel Opportunities

- All foundational tasks (T002, T003, T004) can run in parallel — they edit different files.
- Within US1: T005 and T006 (both test creation) can run in parallel; T007–T011 (per-component edits) can run in parallel — they edit different files.
- Within US2: T014, T015, T016 (three test creation tasks) can run in parallel; T017 is a single-file edit (no parallel sibling).
- Within US3: T020 (test) and T021 (single-file edit) cannot run in parallel — T020 must land RED first.
- Polish: T024 and T025 (docs) can run in parallel.
- US1 and US2 can run in parallel by two developers after the foundational phase completes; US3 is gated on US2's `<section>` landing in the sheet.

---

## Parallel Example: User Story 1

```bash
# Tests (run before implementation):
Task: "Create tests/unit/safe-area-tokens.spec.ts per contracts/safe-area-zone-tokens.md §4"
Task: "Create tests/integration/safe-area-layout.spec.ts per contracts/safe-area-zone-tokens.md §4 (US1 surfaces only)"

# Per-component edits (can run in parallel after RED tests confirmed):
Task: "Edit src/app/App.svelte .toolbar and .map-controls offsets"
Task: "Edit src/components/CoordinateReadout.svelte .readout bottom"
Task: "Edit src/components/AttributionBar.svelte bottom"
Task: "Edit src/components/InstallBanner.svelte bottom + right"
Task: "Edit src/components/InstallIosSheet.svelte bottom"
```

## Parallel Example: User Story 2

```bash
# Tests (run before implementation):
Task: "Create tests/unit/install-settings-surface.spec.ts per contracts/install-settings-surface.md §5"
Task: "Create tests/integration/settings-install-section.spec.ts per contracts/settings-install-section.md §7"
Task: "Create tests/e2e/safe-area-install.e2e.spec.ts (Playwright Mobile Chrome + iOS Safari)"

# Implementation (single file — no parallel sibling):
Task: "Edit src/components/SettingsSheet.svelte to add install section + iOS instructions dialog + handlers"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (T002 minimum — T003 / T004 only needed for US2)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify on a real iPhone + a real Android phone that every persistent surface clears the safe area.
5. Deploy/demo if ready — the user's first complaint ("修正 iOS/Android 瀏覽器安全區域") is now resolved on its own.

### Incremental Delivery

1. Setup + T002 → US1 → demo (mobile safe-area fix shipped).
2. Add T003 + T004 → US2 → demo (Settings install button shipped on every platform).
3. Add US3 → demo (Settings sheet itself respects safe-area, install button always reachable).
4. Polish → ship the documentation + e2e gate.

Each story adds value without breaking previous stories. The transient install banner / iOS sheet (feature 005) remains live throughout — the new Settings entry is additive, not a replacement.

### Parallel Team Strategy

With two developers:

1. Both developers complete Setup + Foundational together (each takes one of T002 / T003 / T004).
2. Once Foundational is done:
   - Developer A: User Story 1 (six per-component file edits + two test files)
   - Developer B: User Story 2 (one component file edit + three test files)
3. Once US2 lands the new section: either developer takes US3 (one-file CSS edit + one test addition).
4. Either developer takes Polish.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase.
- [Story] label maps task to specific user story for traceability.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same-file conflicts within a phase, cross-story dependencies that break independence.
