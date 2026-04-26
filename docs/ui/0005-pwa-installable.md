# UI Record 0005 — PWA Install Affordance for Android & iOS

**Status**: Accepted (landed at `/speckit.implement` 2026-04-26)
**Affected screens**: app shell on first qualifying load — install
banner (bottom-right, above the attribution badge), iOS instructional
sheet (bottom-center), iOS-Other read-only hint (bottom-center)
**Feature**: `specs/005-pwa-installable/`

## Context

Feature 003 shipped the runtime tile cache and feature 004 polished
the offline-first UX (offline-ready toast, controlled update prompt,
attribution contrast, dev-mode manifest middleware). The PWA was
installable in principle — Chromium's `beforeinstallprompt` event
already fired in production preview — but the app surfaced no
in-product offer to install, and iOS Safari operators had no
guidance about the Share → Add-to-Home-Screen path.

Three sub-paths needed UI:

1. **Android / desktop Chromium** — `beforeinstallprompt` provides a
   programmatic install gesture; the app only had to surface a
   non-blocking offer.
2. **iOS Safari** — no programmatic install API; only a localised
   step-by-step sheet describing the Share gesture is possible.
3. **iOS Chrome / Firefox / Edge** (CriOS / FxiOS / EdgiOS) — no
   install path at all; the only honest UI is a read-only "Open in
   Safari to install" hint, never a fake Install button.

## Design goals

1. **One source of truth** — a Svelte writable
   (`installSignal`) fuses platform detection, the captured
   `beforeinstallprompt` event, the localStorage dismissal record,
   and the `appinstalled` lifetime gate into a single `surface` field
   that components key off. No component re-reads `navigator` or
   `localStorage` directly.
2. **DOM-absence under suppression** — when surface is
   `'standalone'` (launched from home screen) or `'hidden'` (recently
   dismissed / installed), both surfaces render nothing — `{#if}`
   blocks, not CSS `display: none`. The DOM contains zero install
   surface in those states (FR-011 / SC-004).
3. **Bottom-anchored, non-blocking** — neither surface uses a modal
   backdrop. The Android banner anchors bottom-right (above the
   attribution badge by `var(--space-6)`); the iOS sheet anchors
   bottom-center, one viewport row above the toast column. The
   feature-004 update-prompt keeps the top-center anchor; no two
   surfaces collide.
4. **30-day dismissal symmetric across surfaces** — both **Not now**
   on the banner and **Got it** on the iOS sheet write the same
   `pwa_map:installDismissedUntil` key with `now + 30 days`. Past
   timestamps re-arm automatically; site-data clear wipes the key.
5. **Reduced-motion compliance** — both surfaces use a single
   180 ms entry keyframe (`translate-y` + `opacity`); the
   `@media (prefers-reduced-motion: reduce)` block in each component
   sets `animation: none` so the affordance appears in place without
   translation.

## Layout & tokens

### Install banner (`InstallBanner.svelte`)

| Property    | Value                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Anchor      | `position: fixed; bottom: calc(var(--space-4, 16px) + var(--space-6, 24px)); right: var(--space-4, 16px);` (above attribution badge per D5) |
| Width       | `max-width: min(420px, calc(100vw - 32px));`                                                                                                |
| Z-index     | `6` (BELOW the bottom-center toast column at z-index 50; same layer as the top-center UpdatePrompt — both are persistent non-modal cards)   |
| Background  | `var(--color-surface-elev, rgba(255, 255, 255, 0.95))`                                                                                      |
| Foreground  | `var(--color-fg, #0f172a)`                                                                                                                  |
| Border      | `1px solid var(--color-border, #cbd5e1)`                                                                                                    |
| Radius      | `8px`                                                                                                                                       |
| Shadow      | `0 4px 16px rgba(15, 23, 42, 0.18)`                                                                                                         |
| Animation   | 180 ms `install-banner-in` keyframe (translateY 16 → 0, opacity 0 → 1); skipped under `prefers-reduced-motion: reduce`                      |
| Tap targets | Both buttons `min-width: 36px; min-height: 36px;` (SC-009)                                                                                  |

Two buttons: **Install** (primary, `var(--color-accent)` background,
white text) and **Not now** (secondary, transparent background,
`var(--color-fg)` text, 1 px border). Both reuse the existing token
set — no new palette value introduced.

### iOS instructional sheet (`InstallIosSheet.svelte`)

| Property   | Value                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Anchor     | `position: fixed; bottom: var(--space-4, 16px); left: 50%; transform: translateX(-50%);` (centered card per D5)                      |
| Width      | `max-width: min(420px, calc(100vw - 32px));`                                                                                         |
| Z-index    | `6`                                                                                                                                  |
| Background | `var(--color-surface-elev, rgba(255, 255, 255, 0.95))`                                                                               |
| Foreground | `var(--color-fg, #0f172a)`                                                                                                           |
| Border     | `1px solid var(--color-border, #cbd5e1)`                                                                                             |
| Radius     | `12px`                                                                                                                               |
| Shadow     | `0 4px 16px rgba(15, 23, 42, 0.18)`                                                                                                  |
| Title typo | `font-size: 14px; font-weight: 600;`                                                                                                 |
| Step list  | `font-size: 13px; line-height: 1.5; ol > li`                                                                                         |
| Share-icon | inline 16 × 16 SVG, `stroke="currentColor"` (tracks `--color-fg` in dark mode); `aria-label` keyed on `pwa.install.ios.shareIconAlt` |
| Animation  | Same keyframe pattern as banner; reduced-motion override identical                                                                   |

The `safari` variant renders three `<li>` steps + share-icon hint +
**Got it** button. The `other` variant renders a single `<p>` hint
("Open this page in Safari to install") + the same dismiss button —
no step list, no share icon.

### Layout-anchor diagram (research D5)

```
┌──────────────────────────────────────────────────────────┐
│                       UpdatePrompt                       │  feature 004 (top-center)
│                                                          │
│                         Toolbar                          │  feature 003 (top-right)
│                                                          │
│                      [crosshair]                         │  feature 001 (center)
│                                                          │
│  CoordinateReadout                                       │  feature 001 (bottom-left)
│                                                          │
│                  ┌───────────────────┐                   │
│                  │  InstallIosSheet  │                   │  005 (bottom-center)
│                  └───────────────────┘                   │
│                                                          │
│                              ┌───────────────────────┐   │
│                              │    InstallBanner      │   │  005 (bottom-right, above attribution)
│                              └───────────────────────┘   │
│                                       AttributionBar     │  feature 003 (bottom-right)
└──────────────────────────────────────────────────────────┘
```

Toast surfaces (copy / zone-hint / layer-fail / offline-ready) live
on the bottom-center column at z-index 50 and only render after a
user action, so collision with the iOS sheet (z-index 6, persistent
until dismissed) is a non-issue — the toast wins by z-index and
clears within 5 s.

## Interactions

| Trigger                                         | Surface                       | Action                                                                                  |
| ----------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| Chromium fires `beforeinstallprompt`            | banner appears within 5 s     | `App.svelte` calls `e.preventDefault()` then `captureBeforeInstallPrompt(e)`            |
| Operator clicks **Install**                     | native install sheet appears  | `triggerInstall()` → `event.prompt()` + `event.userChoice`                              |
| Native install accepted (`outcome:'accepted'`)  | banner unmounts               | `surface = 'hidden'`, `deferredPrompt = null`. No dismissal record.                     |
| Native install rejected (`outcome:'dismissed'`) | banner unmounts               | `recordDismissal()` writes `pwa_map:installDismissedUntil = now + 30d`                  |
| Operator clicks **Not now**                     | banner unmounts               | `recordDismissal()` writes the same key                                                 |
| Operator presses Escape while banner mounted    | same as **Not now**           | `<svelte:window on:keydown>` block in component                                         |
| Operator clicks **Got it** on iOS sheet         | sheet unmounts                | `recordDismissal()` (symmetric across iOS-safari and ios-other variants)                |
| Browser fires `appinstalled`                    | banner unmounts permanently   | `markInstalled()` → `installed = true`, `surface = 'hidden'`. Re-arm only via SW reset. |
| Cold-launch in standalone mode                  | both surfaces stay absent     | Detector returns `'standalone'` from rule #1; no other rule fires.                      |
| Future `dismissedUntil` present in localStorage | both surfaces stay absent     | `applyGates(...)` returns `'hidden'` even with captured event.                          |
| Past `dismissedUntil` present in localStorage   | re-armed; reader returns null | Reader does NOT clean up; cleanup happens on next writer call or site-data clear.       |
| Site-data cleared                               | re-armed                      | All four prefs / dismissal keys absent; first-visit semantics restored.                 |

The component does NOT call any platform install API on iOS (none
exists). The component does NOT detect surface — it trusts
`installSignal.surface` and the upstream `installPlatform` detector.

## i18n

Ten new keys × three locales = 30 string additions, all under
`pwa.install.*`:

| Key                            | zh                                     | en                                                   | ja                                                         |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `pwa.install.android.title`    | `將此應用安裝以離線使用`               | `Install this app for offline use`                   | `このアプリをインストールしてオフラインで使用`             |
| `pwa.install.android.confirm`  | `安裝`                                 | `Install`                                            | `インストール`                                             |
| `pwa.install.android.dismiss`  | `稍後`                                 | `Not now`                                            | `あとで`                                                   |
| `pwa.install.ios.title`        | `加入主畫面`                           | `Add to Home Screen`                                 | `ホーム画面に追加`                                         |
| `pwa.install.ios.step1`        | `點選 Safari 工具列上的「分享」按鈕`   | `Tap the Share button in Safari's toolbar`           | `Safari ツールバーの共有ボタンをタップ`                    |
| `pwa.install.ios.step2`        | `捲動清單，點選「加入主畫面」`         | `Scroll down and tap "Add to Home Screen"`           | `スクロールして「ホーム画面に追加」をタップ`               |
| `pwa.install.ios.step3`        | `按一下「新增」即可從主畫面啟動本應用` | `Tap "Add" to launch this app from your Home Screen` | `「追加」をタップしてホーム画面からアプリを起動`           |
| `pwa.install.ios.shareIconAlt` | `分享圖示`                             | `Share icon`                                         | `共有アイコン`                                             |
| `pwa.install.ios.dismiss`      | `知道了`                               | `Got it`                                             | `了解しました`                                             |
| `pwa.install.iosOther.hint`    | `請使用 Safari 開啟此頁面以安裝`       | `Open this page in Safari to install`                | `インストールするには Safari でこのページを開いてください` |

All keys use the project-canonical `zh / en / ja` codes per
Constitution v1.1.0 Locale conventions.

## Accessibility notes

| Aspect         | Banner                                                | iOS sheet (safari variant)                                         | iOS sheet (other variant)               |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Role           | `role="dialog"`, `aria-label` on the localised title  | `role="dialog"`, same labelling                                    | `role="status"` + `aria-live="polite"`  |
| Tap targets    | Install + Not-now ≥ 36 × 36 px (SC-009)               | Got-it ≥ 36 × 36 px                                                | Same                                    |
| Keyboard       | Tab + Enter/Space; Escape acts as Not-now             | Same                                                               | Same                                    |
| Contrast       | Body text ≥ 4.5 : 1 against `--color-surface-elev`    | Same; share-icon stroke ≥ 3 : 1                                    | Body text ≥ 4.5 : 1                     |
| Screen reader  | Announces title via `aria-label`                      | Step text + share-icon `aria-label` (the `<svg>` is `aria-hidden`) | Hint announced via `aria-live="polite"` |
| Reduced motion | Slide-in skipped per `prefers-reduced-motion: reduce` | Same                                                               | Same                                    |

## Acceptance scenarios met

- **US1 / FR-001..FR-006 / SC-001 / SC-005 / SC-008..SC-010** — banner
  surfaces within 5 s of `beforeinstallprompt`; rejection persists for
  30 days; tap targets ≥ 36 × 36; contrast ≥ 4.5 : 1.
- **US2 / FR-007..FR-010 / SC-003 / SC-006** — iOS sheet renders
  within 1 s of detection; all three locales' step strings present;
  iOS-other variant shows the read-only "Open in Safari" hint without
  faking an install button.
- **US3 / FR-011 / FR-013 / FR-014 / SC-004** — both surfaces are
  DOM-absent under standalone mode; future-dismissedUntil suppresses;
  past-dismissedUntil re-arms; `markInstalled()` locks the affordance
  for the install lifetime.

## Screenshots

To be captured during merge review (real-device Android install flow,
Chromium DevTools "Pixel 8" emulation for the banner, and "iPhone 14
Pro" emulation for the iOS sheet across `zh / en / ja`). Place under
`docs/ui/screenshots/0005-pwa-installable/`.

## Open questions

None. The two anchor decisions and the 30-day dismissal default were
ratified at `/speckit.specify` and confirmed at `/speckit.plan`.
