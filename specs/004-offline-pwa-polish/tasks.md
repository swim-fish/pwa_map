---

description: "Task list for feature 004-offline-pwa-polish"
---

# Tasks: Offline-First PWA + Update Prompt + UI Polish

**Input**: Design documents from `/specs/004-offline-pwa-polish/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{update-signal,update-prompt,attribution-tokens,dev-manifest-middleware}.md, quickstart.md

**Tests**: Tests are REQUIRED for every story (Constitution Principle II — TDD non-negotiable; reaffirmed in research D11). Each test slot lands and is red BEFORE the corresponding implementation slot.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. Stories are ordered by spec priority (US1 P1 → US2 P2 → US3 P2 → US4 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete deps)
- **[Story]**: User-story label (US1, US2, US3, US4) — present on Phase 3+ tasks only
- Include exact file paths in descriptions

## Path Conventions

Single-project layout (Option 1 from plan.md). Source under `src/`, tests under `tests/{unit,integration,e2e}`, docs under `docs/{ui,adr}`. All paths are repo-relative from `pwa_map/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the configuration prerequisites that every story builds on. No story-specific behaviour yet — these tasks only land in `vite.config.ts` and the i18n files so subsequent story phases can compile.

- [X] T001 Hoist the existing `manifest` object inside `vite.config.ts` into a top-level `const manifest = { ... } as const` (per research D10 — single source of truth for both `VitePWA({ manifest })` and the upcoming dev middleware). No behavioural change yet; verify `npm run build` still produces an identical `dist/manifest.webmanifest`.
- [X] T002 [P] Append the four new i18n keys (`pwa.update.title`, `pwa.update.confirm`, `pwa.update.later`, `pwa.offline.ready`) with the strings tabled in `contracts/update-prompt.md` §6 to `src/i18n/zh.json`. Constitution Locale-conventions: keep the existing `zh / en / ja` codes only.
- [X] T003 [P] Append the same four new i18n keys to `src/i18n/en.json` (`Update available`, `Update now`, `Later`, `Ready for offline use`).
- [X] T004 [P] Append the same four new i18n keys to `src/i18n/ja.json` (`アップデートあり`, `今すぐ更新`, `後で`, `オフラインで利用可能`).
- [X] T005 Run `npm run format` and `npm run lint` on the touched files (`vite.config.ts`, `src/i18n/{zh,en,ja}.json`) to confirm Constitution Principle I (Code Quality & Formatting) is clean before any story work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the new CSS token pair and the `updateSignal` / `offlineReadySignal` store module that ALL of US1 / US2 / US3 transitively depend on. This phase MUST complete before any user-story phase begins because every story imports from these files.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T006 [P] Add the `--attribution-bg` / `--attribution-fg` token pair to `src/app/tokens.css` for both `:root` and `@media (prefers-color-scheme: dark)`, with the literal values from `contracts/attribution-tokens.md` §2 (light: `rgba(255,255,255,0.95)` + `#0f172a`; dark: `rgba(15,23,42,0.92)` + `#f1f5f9`). Do NOT alias to `--color-fg` / `--color-surface` (data-model §3 invariant). Run `npm run format` after.
- [X] T007 [P] Create `src/storage/offlineReady.ts` with the two helpers from `data-model.md` §2 — `hasShownOfflineReady(): boolean` (reads `localStorage['pwa_map:offlineReadyShown'] === '1'`) and `markOfflineReadyShown(): void` (writes `'1'`). Tolerate `localStorage` being unavailable (private mode / SSR) by returning `false` from `has...` and silently no-oping `mark...`. Run `npm run format` after.
- [X] T008 [P] Create `tests/unit/storage/offlineReady.spec.ts` covering: (a) absent key → `hasShownOfflineReady()` returns `false`; (b) `markOfflineReadyShown()` then `hasShownOfflineReady()` returns `true`; (c) corrupted value (`'true'`, `JSON.stringify({...})`, empty string) → treated as absent; (d) `localStorage` throwing on access → graceful `false` / silent. This test MUST land RED before T007 is implemented (write the spec first, then the helper); commit order verified by `git log --oneline tests/unit/storage/offlineReady.spec.ts src/storage/offlineReady.ts`.

> Sequencing note for T007 / T008: write T008 first (will fail to import the missing module), then T007 (turns it green). They share a file pair so they cannot run in parallel with each other, but each is parallelisable with T006.

- [X] T009 Create `src/pwa/updateSignal.ts` skeleton — declare the two `Readable<...>` exports (`updateSignal`, `offlineReadySignal`), the action exports listed in `contracts/update-signal.md` §3 (`fireNeedRefresh`, `postpone`, `confirm`, `fireOfflineReady`, `dismissOfflineReady`, `__resetForTests`), and the matching internal `writable<UpdatePromptState>` / `writable<OfflineReadyState>` per `data-model.md` §1 + §7. Implement only the trivial actions (initial state, `dismissOfflineReady`, `__resetForTests`); leave `fireNeedRefresh` / `postpone` / `confirm` / `fireOfflineReady` as `// TODO US1/US2 implementation` to keep this phase compileable but RED on the upcoming spec. Run `npm run format` after.

**Checkpoint**: Tokens, storage helper, and signal-store skeleton all in place. User-story phases may now proceed in parallel.

---

## Phase 3: User Story 1 — Map continues to work without network after first load (Priority: P1) 🎯 MVP

**Goal**: First-time install surfaces a one-shot "available offline" toast; offline reload renders the app shell + cached tiles within 3 s; all UI controls remain interactive offline. Persisted state (`pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1`) survives unchanged. Aligns with FR-001..FR-006 + SC-001 + SC-008.

**Independent Test**: `npm run build && npm run preview`, navigate around Taipei online, then DevTools → Offline + reload. App shell + previously-cached tiles render within 3 s; the one-time `pwa.offline.ready` toast fires exactly once across install lifetime; persisted state round-trips.

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T013–T015.

- [X] T010 [P] [US1] Extend `tests/unit/pwa/updateSignal.spec.ts` (create the file) with the offline-ready cases from `contracts/update-signal.md` §5 items 8–11: initial `offlineReadySignal.visible === false`; `fireOfflineReady()` flips it to `true`; `dismissOfflineReady()` flips it back; `fireOfflineReady()` is idempotent; `__resetForTests()` clears it.
- [X] T011 [P] [US1] Add an integration spec `tests/integration/offline-ready-toast.spec.ts` that mounts `App.svelte` (or a test harness importing the same `App.svelte` block) with `hasShownOfflineReady()` mocked to `false`, calls `fireOfflineReady()`, asserts the toast renders the localised `pwa.offline.ready` string, then asserts that after the 5 s timeout the toast disappears (use `vi.useFakeTimers` + `vi.advanceTimersByTime`). A second pass with `hasShownOfflineReady()` mocked to `true` MUST render no toast.
- [X] T012 [P] [US1] Add a Playwright spec block to `tests/e2e/story-4-offline-and-update.spec.ts` (create the file if it does not yet exist; if it does, append the `test.describe('US1 offline reload', ...)` group) that: navigates to `/`, waits for the SW to activate (`page.waitForFunction('navigator.serviceWorker.controller')`), pans the map across Taipei, calls `page.context().setOffline(true)`, reloads, and asserts within a 3 s budget that (a) the app shell loaded, (b) at least one tile element is in the DOM under MapView, (c) the attribution badge is visible with non-empty text. Use the standard Playwright pattern from research D8.

### Implementation for User Story 1

- [X] T013 [US1] Implement `fireOfflineReady()` and `dismissOfflineReady()` in `src/pwa/updateSignal.ts` per `contracts/update-signal.md` §4.2. After this, T010's offline-ready unit cases turn green.
- [X] T014 [US1] Amend `src/pwa/registerSW.ts` so the existing `registerSW(...)` call passes `onOfflineReady()` that gates on `hasShownOfflineReady()`; on first call it calls `markOfflineReadyShown()` then `fireOfflineReady()`. Keep the `if (import.meta.env.DEV) return;` short-circuit unchanged so the dev SW stays disabled (FR-020). Per data-model §6 sample.
- [X] T015 [US1] Amend `src/app/App.svelte` to subscribe to `offlineReadySignal`; when `$offlineReadySignal.visible === true`, render a transient toast using the existing `.toast` token + `role="status" aria-live="polite"` block (mirror the existing `copyToast` / `zoneHint` / `layerFailToast` pattern). Set a 5 s `setTimeout` that calls `dismissOfflineReady()`. After this, T011's integration spec turns green.
- [X] T016 [US1] Run `npm run format`, `npm test -- tests/unit/pwa/updateSignal.spec.ts tests/unit/storage/offlineReady.spec.ts tests/integration/offline-ready-toast.spec.ts`, then `npm run build && npm run preview & npx playwright test tests/e2e/story-4-offline-and-update.spec.ts -g 'US1 offline reload'`. Confirm all four specs pass and SC-001 budget (3 s) holds.

**Checkpoint**: US1 fully functional. Offline reload renders the cached app + tiles within 3 s and the offline-ready toast fires exactly once per install lifetime (SC-008). Map shipping-ready as MVP at this point.

---

## Phase 4: User Story 2 — Operator confirms before a new version is installed (Priority: P2)

**Goal**: Flip `vite-plugin-pwa` from `'autoUpdate'` to `'prompt'`, surface a non-blocking `UpdatePrompt` toast within 10 s of the SW reaching `waiting`, support a 30 min postpone window, preserve all persisted state across the controlled reload. Aligns with FR-007..FR-012 + SC-002 + SC-003 + SC-005.

**Independent Test**: With the test-only window hook (`window.__pwaTestHooks.triggerUpdateAvailable()`), the prompt appears at top-center within 1 s; "Later" hides it AND suppresses any `fireNeedRefresh` re-trigger for 30 min; "Update now" calls the bound `confirmUpdate()`. Persisted state (prefs, lastView, gotoHistory_v1) survives a real reload sequence.

### Tests for User Story 2 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T020–T024.

- [X] T017 [P] [US2] Extend `tests/unit/pwa/updateSignal.spec.ts` with the update-prompt cases from `contracts/update-signal.md` §5 items 1–7: fresh module state; `fireNeedRefresh(fn)` flips `visible` true; `postpone()` sets `visible:false` + `postponedUntil ≈ now+1_800_000` (±100 ms tolerance); during postpone window a second `fireNeedRefresh(fn2)` keeps `visible:false` but rebinds `confirmUpdate`; after `vi.advanceTimersByTime(31 * 60 * 1000)` a `fireNeedRefresh(fn2)` re-shows the prompt; `confirm()` calls bound `confirmUpdate` exactly once; `confirm()` with no bound function is a safe no-op.
- [X] T018 [P] [US2] Create `tests/integration/update-prompt.spec.ts` covering all nine cases in `contracts/update-prompt.md` §7: hidden initial render; visible-after-`fireNeedRefresh` render with localised labels; click "Update now" calls the bound spy exactly once; click "Later" flips `visible` false + sets `postponedUntil`; window-Escape acts as Later; Escape when hidden is a no-op; `role="status"` + `aria-live="polite"` present; both buttons measure ≥ 36 × 36 px; locale switch zh ↔ en re-renders labels.
- [X] T019 [P] [US2] Add Playwright `test.describe('US2 update prompt', ...)` group in `tests/e2e/story-4-offline-and-update.spec.ts`: (a) inject `window.__pwaTestHooks.triggerUpdateAvailable()`, assert the `[data-testid="update-prompt"]` toast appears within 10 s with both buttons (SC-002); (b) click `[data-testid="update-prompt-later"]`, assert toast disappears and a second `triggerUpdateAvailable()` call inside the postpone window does NOT re-show it (SC-003); (c) seed `localStorage` with `pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1`, click `[data-testid="update-prompt-confirm"]`, wait for reload, assert all three keys are still readable and parse correctly (SC-005).

### Implementation for User Story 2

- [X] T020 [P] [US2] Implement `fireNeedRefresh`, `postpone`, and `confirm` in `src/pwa/updateSignal.ts` per `contracts/update-signal.md` §4.1, including the postpone-window check on re-fire and the no-op confirm fallback. After this, T017 turns green.
- [X] T021 [P] [US2] Create `src/components/UpdatePrompt.svelte` per `contracts/update-prompt.md` §2–§5: outer `<section role="status" aria-live="polite" data-testid="update-prompt">`, `<p class="update-prompt-title">` reading `$tStore('pwa.update.title')`, two `<button type="button">` elements (`update-prompt-confirm` calling `confirm()`, `update-prompt-later` calling `postpone()`), `<svelte:window on:keydown>` Escape → `postpone()` gated on `$updateSignal.visible`. CSS uses `var(--color-surface-elev)`, `var(--color-accent)`, `var(--color-border)` per §4. Tap targets ≥ 36 × 36 px. After this, T018 turns green.
- [X] T022 [US2] Amend `src/pwa/registerSW.ts` to:
   - Switch the imported `useRegisterSW` call (or `registerSW` from `virtual:pwa-register`) to consume the `'prompt'` lifecycle: register `onNeedRefresh()` that calls `fireNeedRefresh(async () => { await updateSW(true); })`.
   - Keep `onRegisterError()` as a silent no-op (FR-012).
   - Wrap in try/catch so a missing `virtual:pwa-register` (Vitest / SSR) is a no-op (per data-model §6 sample).
- [X] T023 [US2] Amend `vite.config.ts` to set `VitePWA({ ..., registerType: 'prompt', injectRegister: false, ... })` (research D1). Keep `devOptions.enabled: false` and the existing `runtimeCaching` block from feature 003 untouched. Run `npm run build` and confirm the build still emits `sw.js` + the precache manifest.
- [X] T024 [US2] Mount `<UpdatePrompt />` unconditionally in `src/app/App.svelte` (renders nothing until `$updateSignal.visible`). Keep the bottom-center transient-toast block (`copyToast`, `zoneHint`, `layerFailToast`, plus the new offline-ready toast from US1) at its existing z-index so the new prompt sits above them at top-center per `contracts/update-prompt.md` §4. Add the test-only window hook `window.__pwaTestHooks ??= {}; window.__pwaTestHooks.triggerUpdateAvailable = () => fireNeedRefresh(async () => { /* no-op for tests */ });` gated by `if (import.meta.env.DEV || import.meta.env.MODE === 'test')` per research D7. After this, T019 turns green.
- [X] T025 [US2] Run `npm run format`, then `npm test -- tests/unit/pwa/updateSignal.spec.ts tests/integration/update-prompt.spec.ts`, then `npm run build && npm run preview & npx playwright test tests/e2e/story-4-offline-and-update.spec.ts -g 'US2 update prompt'`. Confirm SC-002 (10 s detection), SC-003 (30 min postpone holds), SC-005 (state preservation across reload) all pass.

**Checkpoint**: US1 + US2 both functional. Offline-first PWA with operator-confirmed updates. Bundle delta budget (SC-007) verified by manually gzipping `dist/assets/*.js` per `quickstart.md` §Performance verification.

---

## Phase 5: User Story 3 — Attribution badge is readable on every basemap and color scheme (Priority: P2)

**Goal**: Token swap on `.attribution` so foreground / background contrast is ≥ 4.5:1 in both color schemes against the badge's own background; layout / position / font-size / opacity floor unchanged. Aligns with FR-013..FR-016 + SC-004.

**Independent Test**: Light mode + dark mode pass on each of the 6 catalogued basemaps; computed contrast on `[data-testid="attribution"]` ≥ 4.5:1 in both schemes; the composed string for a basemap-with-overlay still includes both attributions separated by ` | ` (legal-compliance backstop from `contracts/attribution-tokens.md` §1).

### Tests for User Story 3 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T028.

- [X] T026 [P] [US3] Create `tests/unit/components/AttributionBar.spec.ts` covering all five cases in `contracts/attribution-tokens.md` §4.1: (a) light-mode background alpha ≥ 0.90; (b) dark-mode background alpha ≥ 0.90; (c) light-mode foreground luminance < 0.1; (d) dark-mode foreground luminance > 0.9; (e) computed contrast ≥ 4.5:1 in both modes via the standard WCAG relative-luminance formula. Use `matchMedia` mock to flip schemes; reuse the contrast helper if one already exists in `tests/unit/helpers/`, otherwise inline a `relativeLuminance()` + `contrast()` pair (≤ 25 lines).
- [X] T027 [P] [US3] Create `tests/integration/attribution-contrast.spec.ts` covering the five cases in `contracts/attribution-tokens.md` §4.2: (a) `osm-standard` no overlay → exact OSM string; (b) `google-hybrid` + overlay → composed string contains ` | `; (c) `nlsc-emap5` → contains the NLSC credit string; (d) badge `getBoundingClientRect()` reports width > 0 AND height > 0 in both schemes; (e) badge positioned at `right: 8px; bottom: 8px`.

### Implementation for User Story 3

- [X] T028 [US3] Amend `src/components/AttributionBar.svelte` so the `.attribution` selector uses `background: var(--attribution-bg); color: var(--attribution-fg);` instead of the existing `rgba(255,255,255,0.82)` + `var(--color-fg, #0f172a)` pair. ALL OTHER selectors (`position: absolute; right: 8px; bottom: 8px;`, padding, `font-size: 12px`, line-height, border-radius, pointer-events, z-index) and the existing `$: composed = ...` reactive block in script section MUST stay byte-for-byte identical (`contracts/attribution-tokens.md` §1 + §3). After this, T026 + T027 turn green.
- [X] T029 [US3] Run `npm run format`, then `npm test -- tests/unit/components/AttributionBar.spec.ts tests/integration/attribution-contrast.spec.ts`. Confirm SC-004 (12/12 basemap × scheme combinations meet WCAG AA).

**Checkpoint**: US1 + US2 + US3 all functional. Legal attribution restored to legibility in dark mode without altering layout, position, or text content.

---

## Phase 6: User Story 4 — No manifest parse errors in the developer console (Priority: P3)

**Goal**: Console under `vite dev` AND production preview is clean of `manifest.webmanifest.*Syntax error`. Dev SW stays disabled; only the manifest endpoint becomes valid. Aligns with FR-017..FR-020 + SC-006.

**Independent Test**: `npm run dev` → DevTools Console → zero entries matching `/manifest\.webmanifest.*Syntax error/i`; DevTools → Application → Manifest shows all fields parsed; `curl http://localhost:5173/manifest.webmanifest` returns `application/manifest+json` JSON. Repeat against `npm run preview`.

### Tests for User Story 4 ⚠️

> Write these tests FIRST and confirm they FAIL before implementing T032.

- [X] T030 [P] [US4] Create `tests/unit/build/devManifestPlugin.spec.ts` (creating the `tests/unit/build/` directory) covering all six cases in `contracts/dev-manifest-middleware.md` §6.1: (a) `apply === 'serve'`, name starts with `pwa-map:`; (b) `configureServer` registers a middleware on `/manifest.webmanifest`; (c) middleware writes `Content-Type: application/manifest+json`; (d) middleware body parses as JSON and contains `name`, `short_name`, `icons`, `start_url`, `display`; (e) `POST /manifest.webmanifest` calls `next()` without writing; (f) `GET /something-else` calls `next()` without writing. Use a fake server / fake req-res pair.
- [X] T031 [P] [US4] Add `test.describe('US4 manifest hygiene', ...)` group in `tests/e2e/story-4-offline-and-update.spec.ts` covering both paths in `contracts/dev-manifest-middleware.md` §6.2 + §6.3: against the `BASE_URL` (default dev `http://localhost:5173`, also runnable against prod `http://localhost:4173`), assert (a) zero console messages match `/manifest\.webmanifest.*Syntax error/i` after `page.goto('/')`; (b) `page.request.get('/manifest.webmanifest')` returns status 200, `content-type` header containing `application/manifest+json`, and a parsed JSON body with `name === 'Taiwan Coordinate Map'` (or whatever value the existing `manifest` const holds — the test asserts `>= ` 5 expected fields rather than a hardcoded name).

### Implementation for User Story 4

- [X] T032 [US4] Add the `devManifestPlugin(manifest: object): Plugin` function to `vite.config.ts` per `contracts/dev-manifest-middleware.md` §1 + research D2 source listing — `apply: 'serve'`, name `'pwa-map:dev-manifest'`, `configureServer(server)` registering a middleware on `/manifest.webmanifest` that for `req.method === 'GET'` writes `Content-Type: application/manifest+json` + `Cache-Control: no-cache` + `JSON.stringify(manifest)`, otherwise calls `next()`. Register the plugin in the `plugins: [...]` array alongside `VitePWA(...)` and `svelte()`. Pass the SAME `manifest` const hoisted in T001 so there is a single source of truth. Keep `devOptions.enabled: false` unchanged (FR-020). After this, T030 + T031 turn green.
- [X] T033 [US4] Run `npm run format`, then `npm test -- tests/unit/build/devManifestPlugin.spec.ts`, then `npm run dev &` + `npx playwright test tests/e2e/story-4-offline-and-update.spec.ts -g 'US4 manifest hygiene'` (BASE_URL=http://localhost:5173), then kill the dev server, run `npm run build && npm run preview &` + `BASE_URL=http://localhost:4173 npx playwright test tests/e2e/story-4-offline-and-update.spec.ts -g 'US4 manifest hygiene'`. Confirm SC-006 (zero matching console entries on both servers).

**Checkpoint**: All four user stories functional. Spec is feature-complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution Principle III + V deliverables, regression sweep, performance verification, and ADR ledger updates required before merge.

- [X] T034 [P] Create `docs/ui/0004-offline-pwa-polish.md` per Constitution Principle III. Capture: (a) before/after screenshots of the attribution badge in light + dark mode (one of each scheme is enough — check `docs/ui/screenshots/`); (b) a screenshot of the `UpdatePrompt` toast in zh, en, and ja; (c) a screenshot of the offline-ready toast at first install; (d) acceptance-scenario references back to spec.md US1–US4. Follow the established structure of `docs/ui/0003-layers-and-locale.md`.
- [X] T035 [P] Create `docs/adr/0023-sw-registration-strategy.md` per Constitution Principle V. Document the `'autoUpdate'` → `'prompt'` switch, citing research D1 + spec FR-007..FR-009 as drivers. List the alternatives rejected (autoUpdate-with-toast, controllerchange-detect, custom SW). Update `docs/adr/README.md` to add the entry.
- [X] T036 [P] Create `docs/adr/0024-dev-manifest-middleware.md` per Constitution Principle V. Document the dev-only manifest middleware pattern, citing research D2 + spec FR-017..FR-020 as drivers. List alternatives rejected (`devOptions.enabled: true`, `public/manifest.webmanifest` static fixture, dismissing the warning). Update `docs/adr/README.md` to add the entry.
- [X] T037 [P] Append an "Implementation outcome — 2026 attribution badge contrast tokens" section to `docs/adr/0014-accessibility-baseline.md` describing the new `--attribution-bg` / `--attribution-fg` token pair, the measured contrast (15.8 : 1 light / 15.5 : 1 dark), and the FR-013/FR-014 invariants. No new ADR — this is recorded as an outcome amendment per plan.md Constitution Check row V.
- [X] T038 Run the entire automated suite — `npm run format`, `npm run lint`, `npm test`, then `npm run build && npm run preview &` followed by `npx playwright test`. Address any regression in features 001–003 specs (per spec Assumptions: existing tests must still pass). Confirm `npm run build` exits cleanly.
- [X] T039 Performance verification per `quickstart.md` §Performance verification: gzip-measure each `dist/assets/*.js`, sum the main-bundle-relevant entries, compare against the feature 003 baseline captured in the previous merge commit. Confirm delta ≤ 3 KB (SC-007). If over budget, identify the largest contributor in `UpdatePrompt.svelte` / `updateSignal.ts` and trim before merge.
- [ ] T040 Manual smoke-test against `quickstart.md` §US1, §US2, §US3, §US4 in Chromium on macOS or Windows: tick every acceptance scenario in spec.md by hand. Capture any UX regressions and file follow-up before requesting review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** — No dependencies.
- **Phase 2 Foundational** — Depends on Phase 1 (i18n keys + manifest hoist must land first because T009 imports the new strings, and T032 reuses the hoisted `manifest`). BLOCKS Phase 3+.
- **Phase 3 US1** — Depends on Phase 2 (uses `offlineReadySignal` from T009 and `offlineReady.ts` from T007).
- **Phase 4 US2** — Depends on Phase 2 (uses `updateSignal` from T009 and `--color-surface-elev` token already in tokens.css; reuses the i18n keys from Phase 1).
- **Phase 5 US3** — Depends on Phase 2 (uses `--attribution-bg` / `--attribution-fg` tokens from T006).
- **Phase 6 US4** — Depends on Phase 1 (uses the hoisted `manifest` const from T001) but NOT on Phase 2 — it can technically run in parallel with US1 / US2 / US3 once T001 lands. Listed last only because it's lowest priority.
- **Phase 7 Polish** — Depends on all four story phases finishing (so screenshots / ADR outcomes can describe the final state).

### Story Independence

- US1, US2, US3, US4 are independent modulo the shared dependencies on Phase 1 + Phase 2 listed above. They MAY be implemented by different developers in parallel.
- US2 references US1's offline-ready toast only at the layout level (`App.svelte` mounts both); the two toasts share no state.
- US3 is purely a CSS token swap with no JS dependencies on other stories.
- US4 touches only `vite.config.ts` and a single test directory and is fully orthogonal.

### Within Each User Story

- Tests MUST land RED before the implementation tasks they cover (Constitution Principle II + research D11).
- For Phase 2 / 3 / 4 / 5 / 6 the canonical order inside a story is: signal/store → component → wiring (registerSW or App.svelte) → CSS / config tweak.
- Run `npm run format` after every code edit (Constitution Principle I + Development Workflow).

### Parallel Opportunities

- T002 / T003 / T004 / T005 — three i18n files touched by independent tasks; run in parallel.
- T006 / T007 / T008 (with T008 sequenced before T007) / T009 — Phase 2 has three independent files (`tokens.css`, `offlineReady.ts`, `updateSignal.ts`); run in parallel.
- T010 / T011 / T012 — three test files for US1; all `[P]`.
- T017 / T018 / T019 — three test files for US2; all `[P]`.
- T020 / T021 — `updateSignal.ts` action-completion vs. new `UpdatePrompt.svelte` component; different files; `[P]`.
- T026 / T027 — two test files for US3; `[P]`.
- T030 / T031 — two test files for US4; `[P]`.
- T034 / T035 / T036 / T037 — four documentation files in Polish phase; all `[P]`.

---

## Parallel Example: User Story 2

```bash
# All US2 tests can run in parallel before any US2 implementation is started:
Task: "Append update-prompt unit cases to tests/unit/pwa/updateSignal.spec.ts (T017)"
Task: "Create tests/integration/update-prompt.spec.ts (T018)"
Task: "Add 'US2 update prompt' Playwright group to tests/e2e/story-4-offline-and-update.spec.ts (T019)"

# After tests are RED, two implementation slots can run in parallel:
Task: "Implement updateSignal actions in src/pwa/updateSignal.ts (T020)"
Task: "Create src/components/UpdatePrompt.svelte (T021)"
# Then sequentially: T022 (registerSW) → T023 (vite.config) → T024 (App.svelte) → T025 (verify)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1 → STOP & VALIDATE per `quickstart.md` §US1.
2. Field-test the offline reload flow in DevTools and on a real device.
3. Ship if the SC-001 budget (3 s) and SC-008 (toast once per install) hold.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready.
2. Add US1 → independent test → MVP demo.
3. Add US2 → independent test → controlled-update demo. (Bundle-delta budget SC-007 first becomes measurable here.)
4. Add US3 → independent test → contrast verified across all 12 combinations (SC-004).
5. Add US4 → independent test → console clean on dev + prod (SC-006).
6. Phase 7 Polish → ADRs + UI doc + perf verification → merge-ready.

### Parallel Team Strategy

After Phase 2 completes, the four stories can be split across reviewers:

- Developer A: US1 (T010–T016) — SW + toast + offline E2E.
- Developer B: US2 (T017–T025) — update prompt + registration strategy + 30 min postpone.
- Developer C: US3 (T026–T029) — token swap + contrast tests (smallest slice, ideal for a contributor onboarding).
- Developer D: US4 (T030–T033) — dev manifest middleware (touches only `vite.config.ts` + a new test dir).

All four converge into Phase 7 Polish.

---

## Notes

- `[P]` tasks operate on disjoint files; verify before parallel-launching.
- `[Story]` label is REQUIRED on Phase 3 / 4 / 5 / 6 tasks and absent on Phase 1 / 2 / 7 tasks.
- Constitution Principle II is non-negotiable: every implementation task MUST follow at least one previously-failing test in the same story.
- Run `npm run format` after every code edit (Development Workflow).
- Update `docs/ui/` for visible UI changes — covered by T034.
- Update the ADR index after each `/speckit.analyze` and `/speckit.implement` — covered by T035 / T036 / T037.
- Persisted-schema invariants (ADR 0021): `pwa_map:prefs`, `pwa_map:lastView`, `pwa_map:gotoHistory_v1` shapes are NOT modified by this feature; the only new key is the standalone `pwa_map:offlineReadyShown`.
- Locale-convention compliance: every new i18n key uses the existing `zh / en / ja` codes verbatim. No new locale identifier introduced.
- Feature 003 specs (`tests/e2e/offline.spec.ts`, etc.) MUST keep passing — running them is part of T038.
