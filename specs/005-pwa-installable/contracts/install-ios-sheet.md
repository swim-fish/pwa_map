# Contract: `InstallIosSheet.svelte` — iOS Safari instructional sheet

**Component**: `src/components/InstallIosSheet.svelte`
**Mounted from**: `src/app/App.svelte` (unconditionally; the component
self-suppresses based on `installSignal.surface`).
**Verifies**: spec FR-007..FR-010, FR-016..FR-020 (cross-cutting);
research D5, D6, D8.

## §1. Render contract

The component MUST render a non-null DOM tree IF AND ONLY IF
`$installSignal.surface === 'ios-safari' || $installSignal.surface ===
'ios-other'`. For every other surface the component MUST render
nothing (DOM absence, not CSS hidden). The two iOS surfaces share the
container shell but differ in inner content:

| `surface`     | Inner content                                                                  |
| ------------- | ------------------------------------------------------------------------------ |
| `'ios-safari'`| Three-step instructional list + Share-icon hint + "Got it" button (FR-008).    |
| `'ios-other'` | Single-line read-only "Open in Safari to install" hint + "Got it" button (FR-010). |

## §2. DOM structure (ios-safari path)

```svelte
{#if surface === 'ios-safari'}
  <section
    class="install-ios-sheet"
    role="dialog"
    aria-label={$tStore('pwa.install.ios.title')}
    data-testid="install-ios-sheet"
    data-variant="safari"
    transition:fly|local={{ y: 16, duration: reducedMotion ? 0 : 180 }}
  >
    <header class="install-ios-sheet-header">
      <h2 class="install-ios-sheet-title">{$tStore('pwa.install.ios.title')}</h2>
    </header>
    <ol class="install-ios-sheet-steps">
      <li>
        {$tStore('pwa.install.ios.step1')}
        <span
          class="install-ios-sheet-share-icon"
          role="img"
          aria-label={$tStore('pwa.install.ios.shareIconAlt')}
          data-testid="install-ios-sheet-share-icon"
        >
          <!-- inline SVG path per research D8 -->
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1 L8 11 M5 4 L8 1 L11 4 M3 7 L3 14 L13 14 L13 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </li>
      <li>{$tStore('pwa.install.ios.step2')}</li>
      <li>{$tStore('pwa.install.ios.step3')}</li>
    </ol>
    <div class="install-ios-sheet-actions">
      <button
        type="button"
        class="install-ios-sheet-dismiss"
        data-testid="install-ios-sheet-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.ios.dismiss')}
      </button>
    </div>
  </section>
{/if}
```

## §3. DOM structure (ios-other path)

```svelte
{#if surface === 'ios-other'}
  <section
    class="install-ios-sheet"
    role="status"
    aria-live="polite"
    data-testid="install-ios-sheet"
    data-variant="other"
    transition:fly|local={{ y: 16, duration: reducedMotion ? 0 : 180 }}
  >
    <p class="install-ios-sheet-hint">{$tStore('pwa.install.iosOther.hint')}</p>
    <div class="install-ios-sheet-actions">
      <button
        type="button"
        class="install-ios-sheet-dismiss"
        data-testid="install-ios-sheet-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.ios.dismiss')}
      </button>
    </div>
  </section>
{/if}
```

The `data-variant` attribute MUST be set to either `safari` or
`other` so integration tests can disambiguate without UA-string
introspection. The two render blocks share the `install-ios-sheet`
class so styling lives in one place.

Required `data-testid` selectors:

| Selector                               | Purpose                                       |
| -------------------------------------- | --------------------------------------------- |
| `install-ios-sheet`                    | the `<section>` itself                        |
| `install-ios-sheet-share-icon`         | the SVG hint (safari variant only)            |
| `install-ios-sheet-dismiss`            | the Got-it button                             |

## §4. Behaviour

| Trigger                                       | Action                                                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on:click` of `install-ios-sheet-dismiss`     | `recordDismissal()`. The 30-day window applies symmetrically across iOS-safari and ios-other (the user has signalled "stop suggesting this", regardless of which sub-path they're on).                |
| `Escape` key while sheet is mounted           | Same as dismiss-button click. Handled by `<svelte:window on:keydown>` block.                                                                                                                            |
| Clicking the backdrop                         | NOT applicable — the sheet does NOT have a modal backdrop. It is a non-blocking instructional card; the user can tap through to the map and re-tap "Install" only via the Share menu in Safari itself. |

There is **no Install button** on either iOS variant. The actual
install gesture happens outside the app (in Safari's UI). The sheet
is purely educational.

## §5. Visual / layout

| Property        | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Position        | `position: fixed; bottom: var(--space-4, 16px); left: 50%; transform: translateX(-50%);` (centered card per research D5) |
| Width           | `max-width: min(420px, calc(100vw - 32px));`                                                     |
| Z-index         | `6` (same layer as `InstallBanner.svelte`)                                                       |
| Background      | `var(--color-surface-elev)`                                                                      |
| Foreground      | `var(--color-fg)`                                                                                |
| Border          | `1px solid var(--color-border)`                                                                  |
| Border radius   | `12px`                                                                                           |
| Shadow          | `0 4px 16px rgba(15, 23, 42, 0.18)`                                                              |
| Title typo      | `font-size: 14px; font-weight: 600;` — matches feature-004 `UpdatePrompt`                        |
| Step list       | `font-size: 13px; line-height: 1.5;`; numbered with `ol > li`                                    |
| Share-icon size | 16 × 16 px nominal, inherits `currentColor` so it tracks `--color-fg` in dark mode              |
| Animation       | Same fly transition as `InstallBanner.svelte`; same reduced-motion override                     |

The CSS reduced-motion override mirrors the banner:

```css
@media (prefers-reduced-motion: reduce) {
  .install-ios-sheet {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
```

## §6. Accessibility

| Aspect              | ios-safari                                                                                                  | ios-other                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Role                | `role="dialog"` (informational dialog with explicit dismiss)                                                | `role="status"` + `aria-live="polite"` (transient hint)         |
| Tap-target size     | Dismiss button ≥ 36 × 36 px                                                                                 | Same                                                            |
| Keyboard            | `Tab` reaches the Dismiss button; `Enter` / `Space` activates; `Escape` dismisses                           | Same                                                            |
| Contrast            | Body text ≥ 4.5:1; share-icon stroke ≥ 3:1 against `--color-surface-elev`                                   | Body text ≥ 4.5:1                                               |
| Screen-reader text  | The share-icon's `aria-label` reads `pwa.install.ios.shareIconAlt` localisation; the inner SVG is `aria-hidden="true"` so it is not announced redundantly | n/a — the read-only hint string is announced via `aria-live`.   |
| Reduced motion      | Slide-in skipped per §5 CSS rule                                                                            | Same                                                            |

## §7. i18n keys

The component reads up to **eight** keys via `$tStore(...)`. The keys
MUST exist in all three locale files. Missing-key fallback returns
the key verbatim.

| Key                              | zh                                          | en                                                                | ja                                                                  |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pwa.install.ios.title`          | `加入主畫面`                                 | `Add to Home Screen`                                              | `ホーム画面に追加`                                                  |
| `pwa.install.ios.step1`          | `點選 Safari 工具列上的「分享」按鈕`           | `Tap the Share button in Safari's toolbar`                        | `Safari ツールバーの共有ボタンをタップ`                            |
| `pwa.install.ios.step2`          | `捲動清單，點選「加入主畫面」`                  | `Scroll down and tap "Add to Home Screen"`                        | `スクロールして「ホーム画面に追加」をタップ`                       |
| `pwa.install.ios.step3`          | `按一下「新增」即可從主畫面啟動本應用`           | `Tap "Add" to launch this app from your Home Screen`              | `「追加」をタップしてホーム画面からアプリを起動`                   |
| `pwa.install.ios.shareIconAlt`   | `分享圖示`                                   | `Share icon`                                                      | `共有アイコン`                                                      |
| `pwa.install.ios.dismiss`        | `知道了`                                     | `Got it`                                                          | `了解しました`                                                      |
| `pwa.install.iosOther.hint`      | `請使用 Safari 開啟此頁面以安裝`              | `Open this page in Safari to install`                             | `インストールするには Safari でこのページを開いてください`         |

## §8. Required tests

`tests/integration/install-ios-sheet.spec.ts` MUST cover:

1. **Mount with `surface === 'ios-safari'`**: assert the
   `<section>` renders, has `data-variant="safari"`, contains all
   three step strings localised correctly (all three locales tested
   via `setLocale(...)` between assertions), and the share-icon
   `<svg>` is present with the correct `aria-label`.
2. **Mount with `surface === 'ios-other'`**: assert the
   `<section>` renders with `data-variant="other"` and the hint
   string. No step list, no share icon.
3. **Mount with non-iOS surface** (`'standalone'`, `'hidden'`,
   `'android-chromium'`, `'desktop-chromium'`, `'unsupported'`):
   DOM-absence assertion (`queryByTestId('install-ios-sheet') ===
   null`).
4. **Click dismiss** (`install-ios-sheet-dismiss`): sheet unmounts;
   `pwa_map:installDismissedUntil` written; `dismissedUntil ≈ now +
   30d`.
5. **Escape key**: same as dismiss click.
6. **Tap-target size**: dismiss button hit-rect ≥ 36 × 36 px.
7. **Reduced motion**: same CSS override assertion as
   `install-banner.spec.ts`.
8. **Locale fallback**: switch locale to `'ja'` then `'en'` then
   `'zh'`, assert the rendered text changes accordingly. (Existing
   i18n unit tests already verify the fallback chain; this asserts
   the component subscribes to `tStore` reactively.)

## §9. Out of scope

- The component does NOT detect iOS — it trusts `installSignal`'s
  surface field.
- The component does NOT detect standalone / dismissed states —
  those are folded into surface upstream.
- The component does NOT call any platform install API — iOS Safari
  has none.
- The component does NOT track install completion. The next launch
  in standalone mode is the only confirmation, and it shows up as
  `surface === 'standalone'` on the next page load.
