# Quickstart: PWA Install Affordance for Android & iOS (feature 005)

**Branch**: `005-pwa-installable` | **Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This file is the operator-friendly walkthrough for verifying feature
005 end-to-end after `/speckit.implement` has run. It is intentionally
short — one page — because the feature has only three user stories
and a thin integration surface.

## Pre-flight (one-time)

```bash
git checkout 005-pwa-installable
npm install              # if node_modules has not been refreshed
npm run lint             # zero warnings allowed (Constitution Principle I)
npm run typecheck
npm test                 # all unit + integration green
npm run build            # production bundle in dist/
npm run bundle-size      # SC-007: ≤ 4 KB gzipped delta from feature 004
```

Optional:

```bash
npm run preview          # serves dist/ on http://localhost:4173
npm run test:e2e         # Playwright (Chromium) — drives synthetic beforeinstallprompt
```

## Story-by-story manual verification

### US1 — Android operator install (P1, MVP)

1. **Setup**: open Chrome on Android (or Chromium desktop with a
   fresh profile), navigate to the preview URL.
2. **Expect** within 5 s: a non-blocking banner appears at
   bottom-right, just above the attribution badge, titled
   "Install this app for offline use" (localised). Two buttons:
   **Install** + **Not now**.
3. **Tap "Install"** → Chromium's native install sheet appears.
4. **Accept the native sheet** → the app icon appears on the home
   screen / launcher. The in-app banner unmounts.
5. **Re-launch from the home-screen icon** → the app starts in
   standalone mode (no browser chrome). The banner does NOT appear.

Acceptance: SC-001 (5 s) + SC-002 (30 s wall-clock for native
install, manual smoke).

**If the banner does not appear**: confirm the feature-004 manifest
hygiene is still in place (`/manifest.webmanifest` returns valid
JSON in dev; production preview serves the Workbox-generated file).
Without that, Chromium does not fire `beforeinstallprompt` and US1
silently fails.

### US2 — iOS operator instructional sheet (P2)

1. **Setup**: open Safari on iOS (NOT iOS Chrome / Firefox / Edge),
   navigate to the preview URL on a non-localhost reachable origin.
2. **Expect** within 5 s: a centered card appears at the bottom of
   the viewport, titled "Add to Home Screen" (localised). Three
   numbered steps describing the Share-button gesture, with a small
   share-glyph SVG next to step 1. One **Got it** button.
3. **Tap the actual Share button** in Safari's toolbar (not in the
   sheet — the sheet is informational), scroll to "Add to Home
   Screen" and tap.
4. **Confirm "Add"** in Safari's native sheet.
5. **Re-launch from the home-screen icon** → the app starts in
   standalone mode. The instructional sheet does NOT appear (FR-007 +
   FR-011).

Acceptance: SC-003 (5 s).

**Cross-check on iOS Chrome / Firefox / Edge** (CriOS / FxiOS /
EdgiOS UAs): expect either the read-only "Open this page in Safari
to install" hint OR no affordance — never an Install button that
does nothing (FR-010).

### US3 — Suppression & re-arming (P3)

1. **Standalone suppression**: launch the app from the home-screen
   icon (any platform). Open DevTools (or Web Inspector) →
   Elements / Inspector → search for `data-testid="install-banner"`
   and `data-testid="install-ios-sheet"`. Both MUST be **absent**
   from the DOM (not hidden — absent). This verifies SC-004.
2. **Dismissal-window suppression**: in a non-standalone session,
   tap "Not now" on the banner OR "Got it" on the iOS sheet.
   Reload the page. Neither affordance MUST reappear. Inspect
   localStorage → `pwa_map:installDismissedUntil` should hold a
   future epoch-ms timestamp ~30 days out.
3. **Re-arming via site-data clear**: DevTools → Application →
   Storage → clear site data. Reload. The affordance MUST be
   re-armed and behave as a first visit.

Acceptance: SC-004 + SC-005.

## Smoke checks for edge cases (spec §Edge Cases)

| Scenario                                | Expected outcome                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Firefox Android                         | No affordance. No console error. (`beforeinstallprompt` never fires.)                                                      |
| In-app browsers (FB / IG / WeChat / LINE) | No affordance.                                                                                                              |
| User cancels native install sheet       | The deferred event resolves with `outcome: 'dismissed'`; the in-app banner records a 30-day dismissal and unmounts.        |
| Two tabs open, install accepted in tab A | Tab B fires `appinstalled` (per-page), the banner unmounts within 5 s.                                                     |
| App removed from home screen            | Next visit MAY re-fire `beforeinstallprompt`; the banner MAY re-appear (the user removed the install themselves).         |
| Manifest serves invalid JSON            | `beforeinstallprompt` does not fire; the banner MUST NOT appear; no console error from feature 005 code.                  |
| iOS Safari private browsing             | localStorage is per-tab ephemeral; the dismissal record may not persist across tabs — accepted as a graceful degradation. |
| Reduced motion enabled                  | Slide-in animation is skipped; the affordance appears in place without translation.                                       |

## Verification budgets (Constitution Principle IV)

| Budget                                                               | Source       | Verified by                                                            |
| -------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| Affordance ≤ 5 s after `beforeinstallprompt` fires                   | SC-001       | `tests/integration/install-banner.spec.ts`                             |
| Native install ≤ 30 s wall-clock                                     | SC-002       | Manual smoke (browser-owned UI)                                       |
| iOS sheet ≤ 5 s after detection                                      | SC-003       | `tests/integration/install-ios-sheet.spec.ts`                          |
| 0 affordances in standalone mode                                     | SC-004       | `tests/integration/install-suppression.spec.ts`                        |
| Dismissal persists ≥ 30 days                                         | SC-005       | `tests/unit/pwa/installSignal.spec.ts` + `tests/unit/storage/installDismissed.spec.ts` |
| 100 % i18n coverage on new keys (zh / en / ja)                        | SC-006       | i18n build check (`npm run typecheck` ensures key references resolve)  |
| ≤ 4 KB gzipped main-bundle delta                                     | SC-007       | `npm run bundle-size` (CI-gated)                                       |
| 0 console errors across all six paths                                | SC-008       | Playwright E2E + manual smoke                                          |
| Tap targets ≥ 36 × 36 px                                             | SC-009       | Banner + iOS-sheet integration specs                                   |
| WCAG AA contrast (≥ 4.5:1) on all affordance text                     | SC-010       | Reuse the contrast helper from feature 004                             |

## Rollback path

The feature is purely additive:

- No manifest change → uninstalling the feature affects no existing
  install state.
- No SW change → the existing offline-first behaviour from feature
  004 stays intact.
- No prefs schema change → `pwa_map:prefs` is untouched.
- The single new persisted key (`pwa_map:installDismissedUntil`) is
  ignored by every other code path; leaving it after rollback is
  harmless.

To roll back: revert the merge commit. The two new components and
three new modules disappear from the bundle; existing tests for
features 001–004 continue to pass without modification.

## Where to look first when something breaks

- Banner does not appear on Android / desktop Chromium:
  `src/app/App.svelte` (`onMount` listener block) → confirm
  `captureBeforeInstallPrompt` is being called. If yes,
  `src/pwa/installSignal.ts` → confirm `surface` flips to
  `'android-chromium'` / `'desktop-chromium'`. Use
  `window.__pwaTestHooks.triggerBeforeInstallPrompt()` from DevTools
  console to drive a synthetic event in dev.
- Banner appears but Install does nothing: `installSignal.triggerInstall`
  → confirm `event.prompt()` is reached (the most common cause is
  calling outside a user-gesture-rooted handler).
- iOS sheet appears in standalone mode: `installPlatform.detectInstallSurface`
  → confirm rule #1 fires (re-check `navigator.standalone` and the
  `matchMedia` value); the rule order is fragile.
- Dismissal not persisting: `tests/unit/storage/installDismissed.spec.ts`
  is the regression net. If those pass, suspect the wiring:
  `installSignal.recordDismissal` MUST call
  `setDismissedUntil(...)`; verify with a `vi.spyOn`.
