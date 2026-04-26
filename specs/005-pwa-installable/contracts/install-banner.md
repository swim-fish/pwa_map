# Contract: `InstallBanner.svelte` — Android / desktop Chromium banner

**Component**: `src/components/InstallBanner.svelte`
**Mounted from**: `src/app/App.svelte` (unconditionally; the component
self-suppresses based on `installSignal.surface`).
**Verifies**: spec FR-001..FR-006, FR-016..FR-020 (cross-cutting);
research D5, D6.

## §1. Render contract

The component MUST render a non-null DOM tree IF AND ONLY IF
`$installSignal.surface === 'android-chromium' ||
$installSignal.surface === 'desktop-chromium'`. For every other
surface (including `'standalone'`, `'hidden'`, `'ios-safari'`,
`'ios-other'`, `'unsupported'`), the component MUST render nothing —
no DOM presence (FR-011 invariant when the upstream sets surface to
`'standalone'`; symmetric DOM-absence for `'hidden'`).

Rendering uses an `{#if}` block guarding the entire `<section>`, NOT
CSS `display: none`. This is non-negotiable per the spec's "no DOM
presence" wording in FR-011 and the integration test for SC-004.

## §2. DOM structure

```svelte
{#if surface === 'android-chromium' || surface === 'desktop-chromium'}
  <section
    class="install-banner"
    role="dialog"
    aria-label={$tStore('pwa.install.android.title')}
    data-testid="install-banner"
    transition:fly|local={{ y: 16, duration: reducedMotion ? 0 : 180 }}
  >
    <p class="install-banner-title">{$tStore('pwa.install.android.title')}</p>
    <div class="install-banner-actions">
      <button
        type="button"
        class="install-banner-confirm"
        data-testid="install-banner-confirm"
        on:click={onConfirm}
        disabled={$installSignal.deferredPrompt === null}
      >
        {$tStore('pwa.install.android.confirm')}
      </button>
      <button
        type="button"
        class="install-banner-dismiss"
        data-testid="install-banner-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.android.dismiss')}
      </button>
    </div>
  </section>
{/if}
```

Required `data-testid` selectors:

| Selector                       | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `install-banner`               | the `<section>` itself; presence check |
| `install-banner-confirm`       | the Install button                     |
| `install-banner-dismiss`       | the Not-now button                     |

## §3. Behaviour

| Trigger                                       | Action                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on:click` of `install-banner-confirm`        | `await triggerInstall()` from `installSignal`. Catch any error and silently swallow (the only realistic error is "no deferred prompt", which the disabled state already guards). Do NOT show a toast on success; the native install sheet IS the success surface.                                                                                                       |
| `on:click` of `install-banner-dismiss`        | `recordDismissal()` from `installSignal`. No await; the call is sync.                                                                                                                                                                                                                                                                                                  |
| `Escape` key while banner is mounted          | Same as `install-banner-dismiss` (treat Escape as "Not now"). The `<svelte:window on:keydown>` block in the component handles this.                                                                                                                                                                                                                                  |
| `$installSignal.deferredPrompt === null`       | Disable `install-banner-confirm` — defence-in-depth; this state should be unreachable when surface is `'android-chromium'` or `'desktop-chromium'` per `installSignal` invariant I4.                                                                                                                                                                                  |

## §4. Visual / layout

| Property        | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Position        | `position: fixed; bottom: calc(var(--space-4, 16px) + var(--space-6, 24px)); right: var(--space-4, 16px);` (above attribution badge per research D5) |
| Width           | `max-width: min(420px, calc(100vw - 32px));`                                                     |
| Z-index         | `6` (one above the toast layer's `5` baseline; one below modal dialogs' `10+`)                   |
| Background      | `var(--color-surface-elev)` — same as UpdatePrompt (FR-016 contrast guarantee inherits)          |
| Foreground      | `var(--color-fg)`                                                                                |
| Border          | `1px solid var(--color-border)`                                                                  |
| Border radius   | `8px`                                                                                            |
| Shadow          | `0 4px 16px rgba(15, 23, 42, 0.18)` — same as UpdatePrompt                                       |
| Animation       | `transition:fly|local={{ y: 16, duration: 180 }}` (default); skipped under `prefers-reduced-motion: reduce` (D6) |

The CSS MUST include this reduced-motion override:

```css
@media (prefers-reduced-motion: reduce) {
  .install-banner {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
```

## §5. Accessibility (FR-016, FR-017, FR-019)

| Aspect              | Requirement                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                | `role="dialog"` on the `<section>` so AT identifies it as a non-modal alert. `aria-label` is the localised title.                                        |
| Live region         | NOT a live region (`aria-live` is intentionally absent) — the banner is persistent until acted on, not transient like a toast.                          |
| Tap-target size     | Both buttons MUST measure ≥ 36 × 36 px (SC-009). Verified by integration test using `getBoundingClientRect`.                                            |
| Keyboard            | `Tab` cycles through both buttons; `Enter` / `Space` activates; `Escape` dismisses (handled by `<svelte:window on:keydown>`).                          |
| Contrast            | Body text ≥ 4.5:1 against `--color-surface-elev`; non-text UI (border, button outlines) ≥ 3:1. Verified by the same `tests/unit/components/AttributionBar.spec.ts`-style contrast helper used in feature 004. |
| Reduced motion      | Slide-in skipped per §4 CSS rule (FR-019).                                                                                                              |

## §6. i18n keys

The component reads three keys via `$tStore(...)`. The keys MUST
exist in all three locale files; missing-key fallback returns the key
verbatim per existing i18n behaviour.

| Key                              | zh                          | en                                | ja                                  |
| -------------------------------- | --------------------------- | --------------------------------- | ----------------------------------- |
| `pwa.install.android.title`      | `將此應用安裝以離線使用`     | `Install this app for offline use`| `このアプリをインストールしてオフラインで使用` |
| `pwa.install.android.confirm`    | `安裝`                       | `Install`                         | `インストール`                      |
| `pwa.install.android.dismiss`    | `稍後`                       | `Not now`                         | `あとで`                            |

## §7. Required tests

`tests/integration/install-banner.spec.ts` MUST cover:

1. **Mount with `surface === 'android-chromium'`** + a captured
   prompt: assert the section is in the DOM with the localised
   title and both buttons; assert button hit-rects ≥ 36 × 36.
2. **Mount with `surface === 'desktop-chromium'`**: same assertions.
3. **Mount with `surface === 'standalone'`**: assert
   `queryByTestId('install-banner') === null` (DOM absence, not
   hidden).
4. **Mount with `surface === 'hidden'`**: same DOM-absence assert.
5. **Mount with `surface === 'ios-safari'`**: DOM-absence assert
   (the banner is NOT the iOS path).
6. **Click "Install"** (`install-banner-confirm`): captured prompt's
   `prompt()` was called once; outcome `'accepted'` → banner
   unmounts. Use a synthetic event whose `userChoice` resolves
   accepted.
7. **Click "Install"** with `outcome: 'dismissed'`: banner unmounts;
   `recordDismissal` side effect verified by reading
   `pwa_map:installDismissedUntil` from localStorage.
8. **Click "Not now"** (`install-banner-dismiss`): banner unmounts;
   localStorage written.
9. **Escape key**: same as Not-now click.
10. **Reduced motion**: use `vi.stubGlobal('matchMedia', ...)` to
    mock `prefers-reduced-motion: reduce`; assert the rendered
    `<section>` has no Svelte transition class active (introspect
    via the `data-svelte-h`/transition attributes — exact mechanism
    in the spec).

## §8. Out of scope

- The component does NOT own a captured event reference. All event
  state lives in `installSignal`.
- The component does NOT call `event.preventDefault()` — that
  happens in `App.svelte`'s top-level listener (D1).
- The component does NOT trigger `appinstalled` handling — that
  happens in `App.svelte`'s separate listener.
- The component does NOT distinguish Android from desktop visually.
  Both surfaces render identical DOM. The split exists only in the
  detector for telemetry / future divergence headroom.
