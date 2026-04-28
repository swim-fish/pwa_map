# Contract: `SettingsSheet.svelte` install section

**Feature**: 011-safe-area-install-buttons
**Component**: `src/components/SettingsSheet.svelte` (existing — gains a new `<section>`)
**Spec FRs**: FR-009..FR-018 · **Spec SCs**: SC-005..SC-011
**Related**: feature 005 / ADR 0025 (`InstallBanner.svelte`,
`InstallIosSheet.svelte`, `installSignal` — re-used, not replaced)

## §1. Render contract

The new `<section class="install-section">` is rendered IF AND ONLY
IF `$installSettingsSurface !== 'unsupported'` (data-model invariant
C1, FR-014). When `'unsupported'`, the entire section (heading, body,
actions) is unrendered via an `{#if}` block — NOT hidden via
`display: none` (consistent with feature 005's
`InstallBanner.svelte` §1 contract).

The section sits at the top of the Settings sheet's body, between the
licence notice and the cache list (research.md §R8).

## §2. DOM structure

```svelte
{#if $installSettingsSurface !== 'unsupported'}
  <section
    class="install-section"
    aria-labelledby="install-section-heading"
    data-testid="settings-install-section"
  >
    <h3 id="install-section-heading" class="section-heading">
      {$tStore('settings.install.heading')}
    </h3>

    {#if $installSettingsSurface === 'android-chromium' || $installSettingsSurface === 'desktop-chromium'}
      <button
        type="button"
        class="install-section-confirm tap-target"
        data-testid="settings-install-confirm"
        on:click={onConfirmChromium}
        disabled={$installSignal.deferredPrompt === null || installInFlight}
      >
        {$tStore('pwa.install.android.confirm')}
      </button>
    {:else if $installSettingsSurface === 'ios-safari'}
      <button
        type="button"
        class="install-section-confirm tap-target"
        data-testid="settings-install-show-ios-instructions"
        on:click={onShowIosInstructions}
      >
        {$tStore('pwa.install.ios.title')}
      </button>
    {:else if $installSettingsSurface === 'ios-other'}
      <p
        class="install-section-hint"
        data-testid="settings-install-ios-other-hint"
      >
        {$tStore('pwa.install.iosOther.hint')}
      </p>
    {:else if $installSettingsSurface === 'standalone'}
      <p
        class="install-section-status"
        role="status"
        data-testid="settings-install-already-installed"
      >
        {$tStore('settings.install.alreadyInstalled')}
      </p>
    {/if}
  </section>
{/if}

{#if showIosInstructions}
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-install-ios-instructions-title"
    class="install-ios-instructions-dialog"
    data-testid="settings-install-ios-instructions-dialog"
  >
    <h2 id="settings-install-ios-instructions-title">
      {$tStore('pwa.install.ios.title')}
    </h2>
    <ol>
      <li>
        {$tStore('pwa.install.ios.step1')}
        <span aria-label={$tStore('pwa.install.ios.shareIconAlt')}>
          <!-- Share icon SVG, identical to InstallIosSheet.svelte -->
        </span>
      </li>
      <li>{$tStore('pwa.install.ios.step2')}</li>
      <li>{$tStore('pwa.install.ios.step3')}</li>
    </ol>
    <button
      type="button"
      class="install-ios-instructions-close tap-target"
      data-testid="settings-install-ios-instructions-close"
      on:click={onCloseIosInstructions}
    >
      {$tStore('pwa.install.ios.dismiss')}
    </button>
  </div>
{/if}
```

Required `data-testid` selectors:

| Selector                                            | Purpose                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `settings-install-section`                          | the `<section>` itself; presence check                                  |
| `settings-install-confirm`                          | the Chromium branches' install button                                   |
| `settings-install-show-ios-instructions`            | the iOS-Safari branch's "show how to add" button                        |
| `settings-install-ios-other-hint`                   | the `ios-other` branch's hint paragraph                                 |
| `settings-install-already-installed`                | the standalone branch's "already installed" status line                 |
| `settings-install-ios-instructions-dialog`          | the instructions dialog opened from `settings-install-show-ios-instructions` |
| `settings-install-ios-instructions-close`           | the instructions dialog's close button                                  |

## §3. Behaviour

| Trigger                                                       | Action                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on:click` of `settings-install-confirm` (Chromium branches)   | Set `installInFlight = true` (locally — disables the button); `await triggerInstall()` from `installSignal`. On any outcome OR throw, set `installInFlight = false`. The store updates from inside `triggerInstall()` automatically propagate to `installSettingsSurface`.   |
| `on:click` of `settings-install-show-ios-instructions`        | Set `showIosInstructions = true`. The dialog re-renders any number of times (FR-011 / data-model C4).                                                                                                                                                                            |
| `on:click` of `settings-install-ios-instructions-close`       | Set `showIosInstructions = false`. The Settings install button stays where it was.                                                                                                                                                                                                |
| `Escape` while the iOS instructions dialog is open             | Same as `settings-install-ios-instructions-close`. Handled via the existing `onWindowKeydown` in `SettingsSheet.svelte`, with priority order: confirm-target > iOS instructions > sheet close.                                                                                  |
| Sheet close (any mechanism — close button, Escape, scrim)      | If `showIosInstructions === true`, close the dialog first; do NOT close the sheet on the same Escape. (Matches the existing `confirmTarget` Escape handling pattern in `SettingsSheet.svelte`.)                                                                                |
| `appinstalled` fires while the section is mounted              | The upstream `markInstalled()` updates `installSignal.installed = true`, which flips `installSettingsSurface` to `'standalone'`, which re-renders the section to the "already installed" status line. No code in this section listens for `appinstalled` directly (FR-018). |

## §4. Visual / layout

Matches the existing Settings sheet's typography and spacing
conventions (no new tokens, no new colour). Specifically:

| Property        | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Section margin  | `margin-bottom: var(--space-3)` (matches `.cache-list`)                                          |
| Heading style   | Uses existing `.section-heading` class (already defined in `SettingsSheet.svelte`)                |
| Confirm button  | `padding: var(--space-2) var(--space-3); border-radius: 6px; font: inherit; font-weight: 600; background: var(--color-accent); color: #ffffff; border: 1px solid var(--color-accent);` (matches `InstallBanner.svelte` §4) |
| Disabled state  | `opacity: 0.5; cursor: not-allowed;` (matches `InstallBanner.svelte` §4)                          |
| Hint paragraph  | `margin: 0; font-size: 13px; line-height: 1.5; color: var(--color-fg);` (matches `.install-ios-sheet-hint`) |
| Status line     | Same typography as the hint paragraph; `role="status"` for AT exposure                            |
| iOS instructions dialog | `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(360px, calc(100vw - var(--space-4) * 2)); padding: var(--space-4); background: var(--color-surface-elev); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.32); z-index: 50;` (matches `.confirm-dialog` in `SettingsSheet.svelte`) |

The dialog inherits the safe-area-aware `top` / `bottom` / `left` /
`right` rules from §2 of `safe-area-zone-tokens.md` (it sits inside
the body when scrim is rendered, so the existing scrim re-use from
`SettingsSheet.svelte`'s `confirmTarget` pattern is appropriate).

## §5. Accessibility (FR-016, ADR 0014)

| Aspect              | Requirement                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section role        | The `<section>` carries `aria-labelledby` pointing at its `<h3>` heading; no live region (the section is persistent until the surface changes).         |
| Status role         | The `'standalone'` branch's status line has `role="status"` so AT readers announce "App is already installed" when the user installs without leaving Settings (FR-018). |
| Tap-target size     | Both buttons (Chromium primary, iOS instructions trigger, instructions dialog close) MUST measure ≥ 44 × 44 CSS pixels (`class="tap-target"` from feature 009).        |
| Keyboard            | `Tab` cycles through the section's interactive elements; `Enter` / `Space` activates buttons; `Escape` inside the iOS instructions dialog closes the dialog (per §3).  |
| Contrast            | Body text ≥ 4.5:1 against `--color-surface-elev` (inherited from feature 005's contrast guarantee). Confirm button text ≥ 4.5:1 against `--color-accent`.                |
| Reduced motion      | The iOS instructions dialog inherits the existing `@media (prefers-reduced-motion: reduce)` override from `SettingsSheet.svelte`'s confirm dialog.                       |

## §6. i18n keys

The component reads the following keys via `$tStore(...)`. Only two
keys are NEW; the rest are reused from feature 005 (research.md §R5).

| Key                                  | New? | Used in branch          | zh                       | en                            | ja                                   |
| ------------------------------------ | ---- | ----------------------- | ------------------------ | ----------------------------- | ------------------------------------ |
| `settings.install.heading`           | NEW  | All visible branches     | `安裝應用程式`            | `Install app`                 | `アプリをインストール`              |
| `settings.install.alreadyInstalled`  | NEW  | `'standalone'`           | `應用程式已安裝`          | `App is already installed`    | `アプリはインストール済みです`      |
| `pwa.install.android.confirm`        | reuse | Chromium branches        | (existing)                | (existing)                    | (existing)                           |
| `pwa.install.ios.title`              | reuse | iOS-Safari trigger button + dialog title | (existing) | (existing)                    | (existing)                           |
| `pwa.install.ios.step1` / `step2` / `step3` | reuse | iOS instructions dialog body | (existing) | (existing)            | (existing)                           |
| `pwa.install.ios.shareIconAlt`       | reuse | iOS instructions dialog Share icon | (existing) | (existing)              | (existing)                           |
| `pwa.install.ios.dismiss`            | reuse | iOS instructions dialog close button | (existing) | (existing)            | (existing)                           |
| `pwa.install.iosOther.hint`          | reuse | `'ios-other'` branch     | (existing)                | (existing)                    | (existing)                           |

The two new keys MUST be added to `src/i18n/zh.json`, `src/i18n/en.json`,
and `src/i18n/ja.json`. No other i18n key is added or modified.

## §7. Required tests

`tests/integration/settings-install-section.spec.ts` MUST cover, for
each of the six visible-or-not branches:

1. **`'unsupported'` → section absent**: stub the derived store to
   `'unsupported'`; mount `<SettingsSheet open>`; assert
   `queryByTestId('settings-install-section') === null` (DOM absence,
   not hidden).
2. **`'android-chromium'` + `deferredPrompt !== null` → button enabled**:
   stub, mount, assert the section is present, the confirm button
   is present, the confirm button is NOT disabled, and its text is
   the localised `pwa.install.android.confirm`.
3. **`'desktop-chromium'` + `deferredPrompt !== null` → same as android**:
   identical assertions.
4. **`'android-chromium'` + `deferredPrompt === null` → button disabled**:
   confirm-button assertions with `disabled === true`.
5. **`'ios-safari'` → instructions trigger button present**: assert
   `getByTestId('settings-install-show-ios-instructions')` is in the
   DOM; the Chromium confirm button is NOT.
6. **Click on `settings-install-show-ios-instructions` opens the dialog**:
   click; assert `getByTestId('settings-install-ios-instructions-dialog')`
   is in the DOM with the localised title and three step list items.
7. **Click on `settings-install-ios-instructions-close` closes the dialog**:
   open via #6; click close; assert dialog DOM-absence.
8. **Re-open is allowed (FR-011 / data-model C4)**: open via #6;
   close via #7; click `settings-install-show-ios-instructions` again;
   assert the dialog re-renders.
9. **`'ios-other'` → hint paragraph present**: assert
   `getByTestId('settings-install-ios-other-hint')` text equals the
   localised `pwa.install.iosOther.hint`; the Chromium / iOS-Safari
   triggers are NOT in the DOM.
10. **`'standalone'` → status line present**: assert
    `getByTestId('settings-install-already-installed')` text equals the
    localised `settings.install.alreadyInstalled`; no button is
    rendered.
11. **Click on `settings-install-confirm` → `triggerInstall` called once
    + button disabled while in flight (FR-017)**: mount the
    `'android-chromium'` branch; spy on
    `triggerInstall`; click the button; assert the spy is called
    once; assert the button is now `disabled === true`; resolve the
    spy's promise; assert the button stays disabled until the next
    `installSignal` update.
12. **Successful install propagates to "already installed" (FR-018 / data-model C3)**:
    mount the `'android-chromium'` branch; click the button; the
    spy resolves with `{ outcome: 'accepted' }` and a
    `markInstalled()` call follows; assert the section re-renders
    to the standalone status line within the same Vitest task tick.
13. **30-day banner dismissal does NOT suppress the section (FR-015)**:
    set `installSignal.dismissedUntil` to `Date.now() + 1_000_000`;
    mount; assert the section is still present in its
    platform-appropriate branch (and NOT hidden via
    `'unsupported'`).
14. **Locale parity (SC-011)**: for each of `zh`, `en`, `ja`, mount
    each visible branch and assert no rendered string contains the
    literal substring `pwa.install` or `settings.install` (which
    would indicate an untranslated key falling through verbatim).

`tests/e2e/safe-area-install.e2e.spec.ts` MUST cover the
end-to-end install flow:

- Playwright Mobile Chrome (Pixel 7) profile: load PWA, open
  Settings, find `getByTestId('settings-install-confirm')`, click,
  assert the OS install prompt appears (Chromium emits a synthetic
  event we can intercept via the established `__pwaTestHooks`
  pattern from `App.svelte`).
- Playwright Mobile Safari (iPhone 14) profile: load PWA, open
  Settings, find `getByTestId('settings-install-show-ios-instructions')`,
  click, assert the instructions dialog opens with the localised
  three-step list.

## §8. Out of scope

- The component does NOT own install state. All state lives in
  `installSignal` (feature 005) and `installSettingsSurface` (this
  feature's contract).
- The component does NOT call `event.preventDefault()` — that
  happens in `App.svelte`'s top-level `beforeinstallprompt` listener
  (feature 005, unchanged).
- The component does NOT distinguish Android from desktop visually.
  Both Chromium branches render identical DOM (matches feature 005's
  `InstallBanner.svelte` §8 design).
- The component does NOT extend the Settings sheet's existing cache /
  TTL / max-entries / clear-all sections. Those keep working
  unchanged.
