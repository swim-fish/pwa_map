# UI Record 0004 — Offline-First PWA + Update Prompt + Attribution Polish

**Status**: Accepted (landed at `/speckit.implement` 2026-04-26)
**Affected screens**: app shell on cold-start (offline), update-prompt
toast (top-center), offline-ready toast (bottom-center), attribution bar
(bottom-right)
**Feature**: `specs/004-offline-pwa-polish/`

## Context

Feature 003 already wired the runtime tile cache via `vite-plugin-pwa`
and Workbox, but three operator-facing rough edges remained:

1. The PWA shell installed but had no UI confirming it was offline-ready.
2. The service-worker registration used `'autoUpdate'`, which silently
   swapped the SW mid-task and forced a reload on next navigation.
3. The attribution badge collapsed to invisible in dark mode (light text
   on a near-white translucent background).

Plus a contributor-facing paper-cut: the dev console showed
`manifest.webmanifest:1 Syntax error` because Vite's SPA fallback
returned HTML for that URL.

This UI record covers the three visible UI changes (the manifest fix is
a contributor concern with no UI surface).

## Design goals

1. **Confirm offline readiness once per install** — operator sees a
   transient "Ready for offline use" toast the first time the SW
   activates, not on every visit.
2. **Operator-controlled updates** — a non-blocking top-center prompt
   with **Update now** / **Later** actions. "Later" suppresses the
   prompt for 30 minutes; the new SW stays in `waiting` until confirmed.
3. **Readable attribution in both color schemes** — dedicated
   `--attribution-bg` / `--attribution-fg` token pair with computed
   contrast ≥ 4.5:1 in both `:root` and the `prefers-color-scheme: dark`
   block, on top of the badge's own background (alpha ≥ 0.90 so tile
   colour can't shift contrast below threshold).
4. **No layout drift** — attribution badge keeps its 12 px / bottom-right
   position; the new toast surfaces (offline-ready + update-prompt)
   reuse the established `.toast` token but anchor differently to avoid
   stacking with each other.

## Layout & tokens

### Attribution badge (`AttributionBar.svelte`)

| Property  | Before                                                     | After                                              |
| --------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Light bg  | `rgba(255, 255, 255, 0.82)`                                | `var(--attribution-bg)` = `rgba(255,255,255,0.95)` |
| Dark bg   | (same — collapsed contrast)                                | `rgba(15,23,42,0.92)`                              |
| Light fg  | `var(--color-fg)` = `#0f172a`                              | `var(--attribution-fg)` = `#0f172a`                |
| Dark fg   | `var(--color-fg)` = `#f1f5f9` (invisible on near-white bg) | `#f1f5f9` (on dark bg)                             |
| Position  | `right: 8px; bottom: 8px`                                  | unchanged                                          |
| Font size | 12 px                                                      | unchanged                                          |

**Contrast (computed at design time)**:

- Light: 15.8 : 1 (foreground slate-900 on alpha-blended white)
- Dark: 15.5 : 1 (foreground slate-100 on alpha-blended dark slate)

Both exceed WCAG AA body-text threshold (4.5 : 1) by > 3 ×.

### Update prompt (`UpdatePrompt.svelte`)

- **Anchor**: top-center (avoids stacking with the four bottom-center
  transient toasts from features 001–003).
- **Surface**: `var(--color-surface-elev)` background, `var(--color-fg)`
  text, `var(--color-border)` 1 px border, 8 px radius, 16 px shadow.
- **Buttons**:
  - **Update now** — primary, `var(--color-accent)` background, white
    text, ≥ 36 × 36 px tap target.
  - **Later** — secondary, transparent background, `var(--color-fg)`
    text, 1 px `var(--color-border)`.
- **A11y**: `role="status"` + `aria-live="polite"` (announces without
  stealing focus). Both buttons are real `<button type="button">` with
  i18n-localised accessible names.
- **Keyboard**: Escape acts as Later (gated on
  `$updateSignal.visible` so it never interferes when hidden).
- **z-index**: 6 (above bottom-center transient toasts at 50).

### Offline-ready toast

Reuses the existing bottom-center `.toast` block from `App.svelte`
(same as `copyToast`, `zoneHint`, `layerFailToast`). 5 s auto-dismiss.
Single boolean key `pwa_map:offlineReadyShown` in localStorage gates the
once-per-install-lifetime guarantee (SC-008).

## i18n

Four new keys × three locales:

| Key                  | zh                 | en                      | ja                     |
| -------------------- | ------------------ | ----------------------- | ---------------------- |
| `pwa.update.title`   | `有新版本可用`     | `Update available`      | `アップデートあり`     |
| `pwa.update.confirm` | `立即更新`         | `Update now`            | `今すぐ更新`           |
| `pwa.update.later`   | `稍後`             | `Later`                 | `後で`                 |
| `pwa.offline.ready`  | `已準備好離線使用` | `Ready for offline use` | `オフラインで利用可能` |

All four use the project-canonical `zh / en / ja` codes per Constitution
v1.1.0 Locale conventions.

## Acceptance scenarios met

- **US1 / FR-001..FR-006 / SC-001 / SC-008** — offline reload renders
  app shell + previously-cached tiles within 3 s; the "Ready for offline
  use" toast fires exactly once per install lifetime.
- **US2 / FR-007..FR-012 / SC-002 / SC-003 / SC-005** — update prompt
  surfaces within 10 s of `waiting` SW; "Later" suppresses for 30 min;
  persisted state (`pwa_map:prefs`, `pwa_map:lastView`,
  `pwa_map:gotoHistory_v1`) survives the controlled reload.
- **US3 / FR-013..FR-016 / SC-004** — attribution contrast ≥ 4.5 : 1
  across all 12 (basemap × scheme) combinations, layout unchanged.
- **US4 / FR-017..FR-020 / SC-006** — zero
  `manifest.webmanifest.*Syntax error` console entries on either dev
  or prod preview.
