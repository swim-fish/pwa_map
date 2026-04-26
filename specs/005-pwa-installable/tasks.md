---
description: "Task list for feature 005-pwa-installable"
---

# Tasks: PWA Install Affordance for Android & iOS

**Input**: Design documents from `/specs/005-pwa-installable/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{install-platform,install-signal,install-banner,install-ios-sheet,install-dismissed-storage}.md, quickstart.md

**Tests**: Tests are REQUIRED for every story (Constitution Principle II — TDD non-negotiable; reaffirmed in research D11). Each test slot lands and is RED BEFORE the corresponding implementation slot.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. Stories are ordered by spec priority (US1 P1 → US2 P2 → US3 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User-story label (US1, US2, US3) — present on Phase 3+ tasks only
- Include exact file paths in descriptions

## Path Conventions

Single-project layout (Option 1 from plan.md). Source under `src/`, tests under `tests/{unit,integration,e2e}`, docs under `docs/{ui,adr}`. All paths are repo-relative from the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Land the i18n string additions all three stories need so subsequent components compile against existing keys. No production source changes yet — these tasks touch only the three locale files plus a formatter pass.

- [X] T001 [P] Append the ten new i18n keys to `src/i18n/zh.json`: `pwa.install.android.title` (`將此應用安裝以離線使用`), `pwa.install.android.confirm` (`安裝`), `pwa.install.android.dismiss` (`稍後`), `pwa.install.ios.title` (`加入主畫面`), `pwa.install.ios.step1` (`點選 Safari 工具列上的「分享」按鈕`), `pwa.install.ios.step2` (`捲動清單，點選「加入主畫面」`), `pwa.install.ios.step3` (`按一下「新增」即可從主畫面啟動本應用`), `pwa.install.ios.shareIconAlt` (`分享圖示`), `pwa.install.ios.dismiss` (`知道了`), `pwa.install.iosOther.hint` (`請使用 Safari 開啟此頁面以安裝`). Keys appear in this order; values are exact per `contracts/install-banner.md` §6 + `contracts/install-ios-sheet.md` §7. Constitution Locale conventions: keep the existing `zh / en / ja` codes only.
- [X] T002 [P] Append the same ten i18n keys to `src/i18n/en.json` with the English strings tabled in `contracts/install-banner.md` §6 + `contracts/install-ios-sheet.md` §7 (`Install this app for offline use`, `Install`, `Not now`, `Add to Home Screen`, `Tap the Share button in Safari's toolbar`, `Scroll down and tap "Add to Home Screen"`, `Tap "Add" to launch this app from your Home Screen`, `Share icon`, `Got it`, `Open this page in Safari to install`).
- [X] T003 [P] Append the same ten i18n keys to `src/i18n/ja.json` with the Japanese strings tabled in `contracts/install-banner.md` §6 + `contracts/install-ios-sheet.md` §7 (`このアプリをインストールしてオフラインで使用`, `インストール`, `あとで`, `ホーム画面に追加`, `Safari ツールバーの共有ボタンをタップ`, `スクロールして「ホーム画面に追加」をタップ`, `「追加」をタップしてホーム画面からアプリを起動`, `共有アイコン`, `了解しました`, `インストールするには Safari でこのページを開いてください`).
- [X] T004 Run `npm run format` and `npm run lint` against `src/i18n/{zh,en,ja}.json` to confirm Constitution Principle I before any source-code work begins. Confirm `npm run typecheck` is clean (no `tStore` callers reference these keys yet, but the JSON must parse).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the localStorage parser, the pure-function platform detector, and the signal-store skeleton that ALL of US1 / US2 / US3 transitively depend on. This phase MUST complete before any user-story phase begins because every story imports from these files.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T005 [P] Create `tests/unit/storage/installDismissed.spec.ts` covering the twelve cases in `contracts/install-dismissed-storage.md` §4: (a) absent key → `getDismissedUntil()` returns `null`; (b) future ts round-trip equality; (c) past ts → `null` AND localStorage value unchanged; (d) raw write + read with various corruption inputs (`'true'`, `'{"x":1}'`, `''`, `'NaN'`, `'Infinity'`, `'-Infinity'`, `'1.5'`, `'8.64e15'`, `' 1796428800000 '`, `'1796428800000\n'`); (e) negative / zero rejected; (f) writer rejects `NaN`/`Infinity`/`-1`/`0` without writing; (g) writer fractional input → coerced via `Math.floor`; (h) read throws → graceful `null`; (i) write throws → silent; (j) `DISMISSAL_WINDOW_MS === 30 * 24 * 60 * 60 * 1000`; (k) `__INSTALL_DISMISSED_KEY === 'pwa_map:installDismissedUntil'`. `localStorage.clear()` in `beforeEach`. This test MUST land RED before T008.
- [X] T006 [P] Create `tests/unit/pwa/installPlatform.spec.ts` covering all thirteen rows in `contracts/install-platform.md` §3 (Android Chrome with / without prompt; Android Firefox; iOS Safari + standalone permutations via both `navigator.standalone` AND `matchMedia`; iOS Chrome / Firefox; Desktop Chrome with / without prompt; Desktop Firefox; standalone-wins-over-Android regression guard; empty UA). Inline the canonical UA strings from §3 verbatim. Pure-function calls only — no globals stubbed because `detectInstallSurface` accepts `PlatformProbe` directly. This test MUST land RED before T007.
- [X] T007 [P] Create `src/pwa/installPlatform.ts` exporting `InstallSurface` (the seven-literal union from `contracts/install-platform.md` §1), `PlatformProbe` interface, and `detectInstallSurface(probe: PlatformProbe): InstallSurface` per §2 priority rules. Pure function: no I/O, no globals, no `Math.random`/`Date.now`. After this, T006 turns green.
- [X] T008 [P] Create `src/storage/installDismissed.ts` exporting `DISMISSAL_WINDOW_MS` (= `30 * 24 * 60 * 60 * 1000`), `getDismissedUntil(): number | null`, `setDismissedUntil(timestampMs: number): void`, and `__INSTALL_DISMISSED_KEY` per `contracts/install-dismissed-storage.md` §1–§3. Use the strict `/^\d+$/` integer regex for the reader; `Math.floor` + `Number.isSafeInteger` validation for the writer; `safeStorage()` wrapper mirroring `src/storage/offlineReady.ts` for SSR / private-mode tolerance. After this, T005 turns green.

> Sequencing note for the four-task slot above: T005 / T006 are pure test writes to disjoint files and run in parallel. T007 / T008 implement disjoint files and also run in parallel after their respective tests are RED. Each pair must commit test-first per Constitution Principle II.

- [X] T009 Create `src/pwa/installSignal.ts` skeleton per `contracts/install-signal.md` §1 + `data-model.md` §1: declare `InstallPromptState` interface, the internal `writable<InstallPromptState>`, the public `installSignal: Readable<InstallPromptState>`, the named action exports (`captureBeforeInstallPrompt`, `triggerInstall`, `recordDismissal`, `markInstalled`, `__resetForTests`), the `__TESTING__` export, and the bootstrap helpers `initialInstallState()` + `applyDismissal(...)` per §2. Implement only the trivial actions — `__resetForTests` (resets to `initialInstallState()`) and the initial state derivation. Leave `captureBeforeInstallPrompt` / `triggerInstall` / `recordDismissal` / `markInstalled` as `// TODO US1 implementation` stubs that throw `new Error('not implemented')` so the upcoming Phase 3 tests land RED. Module compiles cleanly (`npm run typecheck` passes).
- [X] T010 Run `npm run format` and `npm run lint` against the five touched paths (`tests/unit/storage/installDismissed.spec.ts`, `tests/unit/pwa/installPlatform.spec.ts`, `src/pwa/installPlatform.ts`, `src/storage/installDismissed.ts`, `src/pwa/installSignal.ts`). Confirm `npm test -- tests/unit/pwa/installPlatform.spec.ts tests/unit/storage/installDismissed.spec.ts` is green and that `npm run typecheck` is clean.

**Checkpoint**: Detector, storage helper, and signal-store skeleton all in place. User-story phases may now proceed.

---

## Phase 3: User Story 1 — Android operator installs the PWA from inside the app (Priority: P1) 🎯 MVP

**Goal**: Land the deferred-prompt capture, the in-app banner, and the post-install lifecycle so a Chromium browser (Android or desktop) shows a non-blocking banner within 5 s of `beforeinstallprompt`, fires the native install sheet on tap, hides on `appinstalled`, and persists a 30-day dismissal on rejection. Aligns with FR-001..FR-006 + SC-001 + SC-005 + SC-008 (single-banner-per-load) + SC-009 (tap target) + SC-010 (contrast).

**Independent Test**: With the test-only window hook (`window.__pwaTestHooks.triggerBeforeInstallPrompt()`), the banner appears at bottom-right within 1 s with a localised title and Install + Not-now buttons; tapping `[data-testid="install-banner-confirm"]` invokes the captured `prompt()` exactly once; tapping `[data-testid="install-banner-dismiss"]` writes a future epoch ms to `pwa_map:installDismissedUntil` (`Date.now() + 30 * 24 * 60 * 60 * 1000`, ±100 ms tolerance); a `triggerAppInstalled()` follow-up unmounts the banner.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T014–T016.

- [X] T011 [P] [US1] Create `tests/unit/pwa/installSignal.spec.ts` covering all fourteen cases in `contracts/install-signal.md` §4: (1) initial-state matrix per surface; (2) Android UA + capture flips to `'android-chromium'`; (3) desktop UA + capture flips to `'desktop-chromium'`; (4) capture idempotency; (5) standalone gate suppresses capture; (6) future-dismissedUntil gate suppresses capture; (7) `triggerInstall` rejected → records dismissal; (8) `triggerInstall` accepted → does NOT record dismissal; (9) `triggerInstall` with no deferred prompt throws; (10) `triggerInstall` is one-shot; (11) `recordDismissal` writes localStorage and hides; (12) `markInstalled` sets all three of `installed=true`/`surface='hidden'`/`deferredPrompt=null` and leaves `dismissedUntil` untouched; (13) past-`dismissedUntil` ignored on boot; (14) `__TESTING__.DISMISSAL_WINDOW_MS` magic-number assertion. Use `vi.stubGlobal('navigator', ...)`, `vi.stubGlobal('matchMedia', ...)`, and `vi.useFakeTimers` per existing patterns in `tests/unit/pwa/updateSignal.spec.ts`. Call `__resetForTests()` in every `beforeEach`.
- [X] T012 [P] [US1] Create `tests/integration/install-banner.spec.ts` covering all ten cases in `contracts/install-banner.md` §7: (a) mount with `'android-chromium'` + captured prompt → DOM + localised title + both buttons + tap-rect ≥ 36 × 36; (b) mount with `'desktop-chromium'` → same; (c) `'standalone'` → DOM absence; (d) `'hidden'` → DOM absence; (e) `'ios-safari'` → DOM absence; (f) Install click → `prompt()` called once + `outcome:'accepted'` unmounts banner; (g) Install click with `outcome:'dismissed'` → unmounts + writes `pwa_map:installDismissedUntil`; (h) Not-now click → unmounts + localStorage write; (i) Escape key → same as Not-now; (j) reduced-motion → no transition class active. Mount the component via the same Svelte testing harness pattern used by `tests/integration/update-prompt.spec.ts`. Use a synthetic `BeforeInstallPromptEvent` whose `prompt()` and `userChoice` are `vi.fn()` / `Promise.resolve(...)`.
- [X] T013 [P] [US1] Create `tests/e2e/story-5-install.spec.ts` with a `test.describe('US1 install banner', ...)` group: navigate to `/`, wait for the SW + the test-only `window.__pwaTestHooks.triggerBeforeInstallPrompt` hook to be defined, fire the synthetic event, assert `[data-testid="install-banner"]` appears within 5 s with both action buttons (SC-001); a follow-up assertion clicks `[data-testid="install-banner-confirm"]` driven by a synthetic event whose `userChoice` resolves `accepted` and confirms the banner unmounts; a third assertion in a fresh `test.beforeEach` drives the dismiss path and asserts `pwa_map:installDismissedUntil` is set in `localStorage` to a value within `(now + 30*24*60*60*1000) ± 5_000` ms.

### Implementation for User Story 1

- [X] T014 [US1] Replace the four `// TODO` stubs in `src/pwa/installSignal.ts` with the action implementations per `contracts/install-signal.md` §3: `captureBeforeInstallPrompt(event)` re-runs `detectInstallSurface` with `hasDeferredPrompt: true` and re-applies the dismissal / installed / standalone gates per §3.1; `triggerInstall()` awaits `event.prompt()` + `event.userChoice` and branches on outcome per §3.2 (calls `recordDismissal` on `'dismissed'` outcome, NOT on `'accepted'`); `recordDismissal(now?)` computes `now + DISMISSAL_WINDOW_MS`, calls `setDismissedUntil(...)` synchronously, sets `surface = 'hidden'`; `markInstalled()` sets `installed = true`, `surface = 'hidden'`, `deferredPrompt = null` and leaves `dismissedUntil` untouched per §3.4. After this, T011 turns green.
- [X] T015 [US1] Create `src/components/InstallBanner.svelte` per `contracts/install-banner.md` §2–§5: `{#if surface === 'android-chromium' || surface === 'desktop-chromium'}` block guards the entire `<section role="dialog">`; `data-testid="install-banner"`, `data-testid="install-banner-confirm"`, `data-testid="install-banner-dismiss"`; `transition:fly|local={{ y: 16, duration: 180 }}` with the `@media (prefers-reduced-motion: reduce)` override per §4; `<svelte:window on:keydown>` Escape → `recordDismissal()` gated on the banner being mounted; tap targets `min-width: 36px; min-height: 36px;`; CSS uses `var(--color-surface-elev)` / `var(--color-fg)` / `var(--color-accent)` / `var(--color-border)` plus the bottom-right `position: fixed; bottom: calc(var(--space-4) + var(--space-6)); right: var(--space-4);` anchor (research D5). After this, T012 turns green.
- [X] T016 [US1] Amend `src/app/App.svelte` to (a) `import InstallBanner from '$components/InstallBanner.svelte';` plus `import { captureBeforeInstallPrompt, markInstalled } from '$pwa/installSignal';` plus the `BeforeInstallPromptEvent` ambient type; (b) inside the existing `onMount(() => { ... })` block register `window.addEventListener('beforeinstallprompt', onBeforeInstall)` whose handler calls `e.preventDefault()` THEN `captureBeforeInstallPrompt(e as BeforeInstallPromptEvent)`, AND `window.addEventListener('appinstalled', onAppInstalled)` whose handler calls `markInstalled()` — both removed in the cleanup return (per `data-model.md` §6 sample); (c) extend the existing `__pwaTestHooks` block (gated by `import.meta.env.DEV || import.meta.env.MODE === 'test'`) with `triggerBeforeInstallPrompt(opts?)` per research D7 (synthetic event whose `prompt()` is `vi.fn` and `userChoice` resolves with the requested outcome) and `triggerAppInstalled()` (dispatches `new Event('appinstalled')`); (d) mount `<InstallBanner />` unconditionally below `<UpdatePrompt />` (the component self-suppresses via the `{#if}` block). After this, T013 turns green.
- [X] T017 [US1] Run `npm run format`, then `npm test -- tests/unit/pwa/installSignal.spec.ts tests/unit/pwa/installPlatform.spec.ts tests/unit/storage/installDismissed.spec.ts tests/integration/install-banner.spec.ts`, then `npm run build && npm run preview & npx playwright test tests/e2e/story-5-install.spec.ts -g 'US1 install banner'`. Confirm SC-001 (5 s budget), SC-005 (30-day persistence), SC-008 (no second banner per session), SC-009 (≥ 36 × 36), SC-010 (≥ 4.5:1 contrast against `--color-surface-elev`) all pass.

**Checkpoint**: US1 fully functional. Android / desktop Chromium operators see a non-blocking install banner driven entirely by the captured `beforeinstallprompt` event; rejection persists 30 days; acceptance unmounts the banner and `appinstalled` locks it for the install lifetime. Map shipping-ready as MVP at this point.

---

## Phase 4: User Story 2 — iOS operator gets clear "Add to Home Screen" instructions (Priority: P2)

**Goal**: When the platform detector reports `'ios-safari'` (and dismissal / installed gates are clear), render a centered instructional sheet at the bottom of the viewport with three localised steps + a Share-icon hint + a "Got it" button. When the detector reports `'ios-other'`, render a read-only "open in Safari" hint with the same dismiss button. Aligns with FR-007..FR-010 + SC-003 + SC-006 (i18n coverage) + SC-009 + SC-010.

**Independent Test**: In a Vitest integration spec, stub `navigator.userAgent` / `navigator.standalone` / `matchMedia` to the `IOS_SAFARI` / non-standalone combination from `contracts/install-platform.md` §3, call `__resetForTests()`, mount `InstallIosSheet.svelte`, assert `[data-testid="install-ios-sheet"][data-variant="safari"]` renders within 1 s with all three step strings and the SVG share-icon. Switch the UA to `IOS_CHROME`, reset, mount; assert `data-variant="other"` and the read-only hint string. Switch the UA to standalone (`matchMedia.matches: true`); assert DOM absence.

### Tests for User Story 2 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T019.

- [X] T018 [P] [US2] Create `tests/integration/install-ios-sheet.spec.ts` covering all eight cases in `contracts/install-ios-sheet.md` §8: (1) iOS-Safari mount → `data-variant="safari"`, three step strings present and localised across `setLocale('zh' | 'en' | 'ja')`, share-icon `<svg>` with the correct `aria-label` from `pwa.install.ios.shareIconAlt`; (2) iOS-Other mount → `data-variant="other"` + `pwa.install.iosOther.hint` text + no step list; (3) DOM-absence on every other surface (`'standalone'`, `'hidden'`, `'android-chromium'`, `'desktop-chromium'`, `'unsupported'`); (4) dismiss click writes `pwa_map:installDismissedUntil` (≈ `now + 30d`); (5) Escape key dismisses; (6) tap-target ≥ 36 × 36 on the dismiss button; (7) reduced-motion → no transition class active; (8) reactive locale switch re-renders the step strings. Use `vi.stubGlobal('navigator', { userAgent: IOS_SAFARI, standalone: false })` and `vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))`; call `__resetForTests()` in every `beforeEach` so the bootstrap re-runs.

### Implementation for User Story 2

- [X] T019 [US2] Create `src/components/InstallIosSheet.svelte` per `contracts/install-ios-sheet.md` §2 + §3 + §5 + §6: two `{#if}` blocks gating on `surface === 'ios-safari'` and `surface === 'ios-other'`; the safari path renders `<header>` + `<h2>` with `pwa.install.ios.title`, an `<ol>` of three `<li>` items reading `pwa.install.ios.step{1,2,3}`, the inline-SVG share icon (path per §2, `width="16" height="16" viewBox="0 0 16 16"`, `stroke="currentColor"`) wrapped in `role="img"` with `aria-label={$tStore('pwa.install.ios.shareIconAlt')}` and an inner `<svg aria-hidden="true">`, and a single `<button data-testid="install-ios-sheet-dismiss">`; the ios-other path renders a `<p class="install-ios-sheet-hint">` with `pwa.install.iosOther.hint` and the same dismiss button. Both paths use `data-testid="install-ios-sheet"` on the outer `<section>`; `data-variant="safari"` vs `"other"` distinguishes them. CSS anchors at `position: fixed; bottom: var(--space-4); left: 50%; transform: translateX(-50%);` (research D5), `z-index: 6`, `max-width: min(420px, calc(100vw - 32px));`, with the `transition:fly|local` + reduced-motion override mirroring `InstallBanner.svelte`. Tap target ≥ 36 × 36 on the dismiss button. Escape dismisses (handled by `<svelte:window on:keydown>`). After this, T018 turns green.
- [X] T020 [US2] Amend `src/app/App.svelte` to mount `<InstallIosSheet />` unconditionally next to `<InstallBanner />` (one line addition: `<InstallIosSheet />` immediately after `<InstallBanner />` per `data-model.md` §5 layout). The component self-suppresses for non-iOS surfaces, so no conditional wrapping. No additional listener wiring is required (iOS does NOT fire `beforeinstallprompt`; the sheet's visibility is driven entirely by the bootstrap detection inside `installSignal.ts`). Run `npm run format`.
- [X] T021 [US2] Run `npm run format`, then `npm test -- tests/integration/install-ios-sheet.spec.ts`. Manually verify in `npm run preview` with DevTools' device emulation set to "iPhone 14 Pro" (iOS Safari UA) that the sheet renders within 5 s. Switch the UA to "iPhone with Chrome" or override `navigator.userAgent` to a `CriOS` variant via DevTools console and confirm the `'ios-other'` variant renders. Confirm SC-003 (5 s) + SC-006 (all three locale strings present) hold.

**Checkpoint**: US1 + US2 both functional. Android operators get a tap-to-install banner; iOS operators get the instructional sheet with localised step text and a share-icon hint; the read-only iOS-Chrome / Firefox / Edge variant tells the operator to switch to Safari without faking a non-functional Install button.

---

## Phase 5: User Story 3 — No noise for already-installed or recently-dismissed users (Priority: P3)

**Goal**: Verify that the standalone / dismissalUntil / appinstalled gates already implemented in Phases 2–4 hold across all three sub-cases. This phase intentionally adds NO new production code — the suppression logic is structural (folded into `installSignal`'s bootstrap and into both components' `{#if}` blocks). Phase 5's contribution is the explicit regression net. Aligns with FR-011 + FR-013 + FR-014 + SC-004.

**Independent Test**: (a) launch with `matchMedia('(display-mode: standalone)').matches: true` → DevTools → search DOM for `[data-testid="install-banner"]` and `[data-testid="install-ios-sheet"]` → both absent (NOT hidden via CSS); (b) write a future timestamp into `localStorage` under `pwa_map:installDismissedUntil`, reload, confirm both surfaces stay absent; (c) wipe `localStorage` (`localStorage.clear()`), reload, confirm the qualifying surface re-appears.

### Tests for User Story 3 ⚠️

> Write these tests FIRST and confirm they FAIL before US3 is declared complete (they MAY already pass against the Phase 3 / 4 implementation; the goal is to lock the suppression contract behind an explicit regression net).

- [X] T022 [P] [US3] Create `tests/integration/install-suppression.spec.ts` covering five suppression sub-cases per FR-011 / FR-013 / FR-014: (1) standalone via `matchMedia.matches: true` → both `[data-testid="install-banner"]` and `[data-testid="install-ios-sheet"]` are `null` after mount on every UA (test cycles through `ANDROID_CHROME`, `IOS_SAFARI`, `DESKTOP_CHROME`); (2) standalone via `navigator.standalone: true` (iOS-only convention) → same DOM-absence assertion; (3) future `dismissedUntil` (`now + 1_000_000`) seeded in localStorage → both surfaces absent on `ANDROID_CHROME`; (4) past `dismissedUntil` (`now - 1_000_000`) seeded → re-armed: `ANDROID_CHROME` + captured event renders the banner; (5) `markInstalled()` called → banner unmounts within one Svelte tick. The spec MUST call `__resetForTests()` between cases so each starts from a clean store. The DOM-absence asserts MUST use `queryByTestId(...)` (returns `null` for absent) rather than `getByTestId(...)` (throws). Use `localStorage.clear()` + the chosen UA stub before each `__resetForTests()` so the bootstrap reflects the test scenario.

### Implementation for User Story 3

- [X] T023 [US3] Run `npm test -- tests/integration/install-suppression.spec.ts` and confirm all five sub-cases pass against the Phase 3 / 4 implementation. If any case fails, the regression sits in `src/pwa/installSignal.ts` (suppression gates in `initialInstallState` / `applyDismissal`) or in one of the two components' `{#if}` blocks — fix at the failing site, NOT by patching the test. Do NOT introduce new code paths if all cases pass; the deliverable is the regression net itself. Run `npm run format` if the gate file is touched.

**Checkpoint**: US1 + US2 + US3 all functional. The affordance is invisible (DOM-absent, not CSS-hidden) under every documented suppression scenario. Site-data clear re-arms the affordance per FR-014.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle III + V deliverables, regression sweep against features 001–004, performance verification, manual smoke per `quickstart.md`.

- [X] T024 [P] Create `docs/ui/0005-pwa-installable.md` per Constitution Principle III. Capture: (a) screenshots of the Android banner in zh / en / ja in light AND dark mode (six images; check `docs/ui/screenshots/`); (b) one screenshot of the iOS instructional sheet in each locale (three images); (c) one screenshot of the iOS-Other read-only hint; (d) one DevTools-Elements screenshot showing DOM absence under standalone mode (SC-004 evidence); (e) the layout-anchor diagram from `research.md` D5 — describe how the new bottom-right banner clears the attribution badge by `var(--space-6)`; (f) acceptance-scenario references back to spec.md US1–US3. Follow the established structure of `docs/ui/0004-offline-pwa-polish.md`. Append the entry to `docs/ui/README.md`'s Index table.
- [X] T025 [P] Create `docs/adr/0025-pwa-install-surfaces.md` per Constitution Principle V (research D10 — single ADR covers the entire feature). Document: (a) the three-surface design (Android banner / iOS sheet / iOS-Other read-only hint) with the platform-detection priority from research D3; (b) the localStorage key `pwa_map:installDismissedUntil`, its 30-day default, and its corruption-tolerance contract from `contracts/install-dismissed-storage.md` §2; (c) the bottom-right / bottom-center anchor decisions from research D5 with the conflict map; (d) alternatives rejected (feature-detection-based iOS classification, multi-record dismissal blob, top-anchored banner). Append the entry to `docs/adr/README.md`'s Index table as `0025` with status `Accepted`. No existing ADR is superseded.
- [X] T026 Run the full automated suite — `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, then `npm run build && npm run preview &` followed by `npx playwright test`. Address any regression in features 001–004 specs (per spec Assumptions: existing tests must still pass). Confirm `npm run build` exits cleanly and that all four test directories (`tests/unit`, `tests/integration`, `tests/e2e`, plus `tests/unit/build`) report green.
- [X] T027 Performance verification per `quickstart.md` §Verification budgets: run `npm run bundle-size` and confirm the gzipped main-bundle delta from the feature-004 baseline is ≤ 4 KB (SC-007). If over budget, identify the largest contributor among `InstallBanner.svelte`, `InstallIosSheet.svelte`, `installSignal.ts`, `installPlatform.ts`, and the i18n string additions; reduce by inlining the SVG path more compactly, or splitting locale strings, or removing dead detector branches. Document the final delta in the PR description.
- [ ] T028 Manual smoke-test against `quickstart.md` §US1, §US2, §US3 in: (a) Chrome / Edge on desktop, (b) Chrome on Android (real device or DevTools "Pixel 8" emulation with `Mobile` toggle), (c) Safari on iOS (real device or `iPhone 14 Pro` emulation with the iOS UA override). Tick every acceptance scenario in spec.md by hand. Capture any UX regression and file follow-up before requesting review. Confirm SC-002 (≤ 30 s native install wall-clock) on the real Android device.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** — No source-code dependencies; touches only the three locale JSONs.
- **Phase 2 Foundational** — Independent of Phase 1 in raw compilation terms (the new modules don't import the new i18n keys yet), but BLOCKS Phase 3+ because every story imports from `installPlatform.ts`, `installSignal.ts`, and `installDismissed.ts`. Run Phase 1 first only because format / lint coverage is a Constitution Principle I gate before production-source work begins.
- **Phase 3 US1** — Depends on Phase 2 (uses `installSignal` actions implemented in T014, plus the platform detector from T007 and the storage helper from T008).
- **Phase 4 US2** — Depends on Phase 3 (the iOS sheet relies on the same `installSignal` bootstrap that US1 implementation finalised). Also depends on Phase 1's `pwa.install.ios.*` keys.
- **Phase 5 US3** — Depends on Phase 4 (the suppression integration test exercises both components; US3 has no new production code).
- **Phase 6 Polish** — Depends on all three story phases finishing (so screenshots, the ADR, and the bundle-size delta describe the final state).

### Story Independence

- US1, US2, US3 are independent in spec terms. Implementation-wise US3 is structurally entailed by US1 + US2 — its tests verify the suppression contract that already lives in `installSignal` and in the components' `{#if}` blocks. The story exists as a separate phase so the suppression invariants get an explicit regression net rather than being implicit in the other stories' specs.
- US2's component (`InstallIosSheet.svelte`) is fully orthogonal to US1's component (`InstallBanner.svelte`); they share only the `installSignal` import.
- US3 is exclusively a regression-net phase and adds zero new source files.

### Within Each User Story

- Tests MUST land RED before the implementation tasks they cover (Constitution Principle II + research D11).
- Inside each story the canonical order is: store-action implementation → component implementation → wiring (App.svelte amendments) → verification.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).

### Parallel Opportunities

- T001 / T002 / T003 — three i18n files touched by independent tasks; run in parallel.
- T005 / T006 — two unit-test files for foundational modules; run in parallel.
- T007 / T008 — two foundational source files; different paths; run in parallel after their respective tests are RED.
- T011 / T012 / T013 — three test files for US1; all `[P]`.
- T018 — single integration test for US2 (no parallel siblings inside US2).
- T022 — single integration test for US3.
- T024 / T025 — two documentation files in Polish phase; both `[P]`.

---

## Parallel Example: User Story 1

```bash
# All US1 tests can run in parallel before any US1 implementation is started:
Task: "Create tests/unit/pwa/installSignal.spec.ts (T011)"
Task: "Create tests/integration/install-banner.spec.ts (T012)"
Task: "Create tests/e2e/story-5-install.spec.ts (T013)"

# After tests are RED, the implementation slots run sequentially:
# T014 (installSignal actions) → T015 (InstallBanner.svelte) → T016 (App.svelte wiring + test hook) → T017 (verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1 → STOP & VALIDATE per `quickstart.md` §US1.
2. Field-test the install flow on a real Android device in Chrome — confirm SC-001 (5 s to banner) and SC-002 (≤ 30 s native install wall-clock).
3. Ship if both budgets hold and the Not-now path persists for 30 days.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready.
2. Add US1 → independent test → MVP demo (Android + desktop Chromium installable).
3. Add US2 → independent test → iOS instructional sheet ships. Bundle delta budget SC-007 first becomes measurable here.
4. Add US3 → run the suppression regression net → confirm zero noise for installed / recently-dismissed users.
5. Phase 6 Polish → ADR + UI doc + perf verification + manual smoke → merge-ready.

### Parallel Team Strategy

After Phase 2 completes, the three stories can be split across reviewers:

- Developer A: US1 (T011–T017) — Android / desktop banner + capture lifecycle + E2E.
- Developer B: US2 (T018–T021) — iOS sheet + share-icon SVG + locale fallback verification.
- Developer C: US3 (T022–T023) — suppression regression net (smallest slice; ideal for a contributor onboarding).

All three converge into Phase 6 Polish.

---

## Notes

- `[P]` tasks operate on disjoint files; verify before parallel-launching.
- `[Story]` label is REQUIRED on Phase 3 / 4 / 5 tasks and absent on Phase 1 / 2 / 6 tasks.
- Constitution Principle II is non-negotiable: every implementation task MUST follow at least one previously-failing test in the same story.
- Run `npm run format` after every code edit (Development Workflow).
- Update `docs/ui/` for visible UI changes — covered by T024.
- Update the ADR index after each `/speckit.analyze` and `/speckit.implement` — covered by T025.
- Persisted-schema invariants (ADR 0021): `pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1`, and feature 004's `pwa_map:offlineReadyShown` shapes are NOT modified by this feature; the only new key is the standalone `pwa_map:installDismissedUntil`.
- Locale-convention compliance: every new i18n key uses the existing `zh / en / ja` codes verbatim. No new locale identifier introduced.
- Manifest invariants: `vite.config.ts`'s manifest object is **not modified** by this feature. Feature 004's manifest hygiene is a hard prerequisite (per spec Assumptions).
- Features 001–004 specs (`tests/e2e/{offline,perf-pan,story-1..story-4-*}.spec.ts`, all `tests/{unit,integration}/**`) MUST keep passing — running them is part of T026.
