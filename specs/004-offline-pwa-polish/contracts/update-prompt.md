# Contract: `src/components/UpdatePrompt.svelte`

**Feature**: `004-offline-pwa-polish`

The toast UI that surfaces when the SW reports a new version is
waiting. Subscribes to `updateSignal`; renders DOM only when
`$updateSignal.visible === true`.

---

## 1. Component shape

- No `export let` props.
- No `createEventDispatcher` events. All interactions go through
  store actions (`postpone`, `confirm`).

## 2. Rendering rules

- Renders **nothing** when `$updateSignal.visible === false`.
- Renders the following DOM tree when visible:

  ```html
  <section
    class="update-prompt"
    role="status"
    aria-live="polite"
    data-testid="update-prompt"
  >
    <p class="update-prompt-title">{$tStore('pwa.update.title')}</p>
    <div class="update-prompt-actions">
      <button
        type="button"
        class="update-prompt-confirm"
        data-testid="update-prompt-confirm"
      >
        {$tStore('pwa.update.confirm')}
      </button>
      <button
        type="button"
        class="update-prompt-later"
        data-testid="update-prompt-later"
      >
        {$tStore('pwa.update.later')}
      </button>
    </div>
  </section>
  ```

## 3. Interactions

| Source                  | Action                                                       |
| ----------------------- | ------------------------------------------------------------ |
| Tap "Update now"        | `await confirm()` (calls bound `confirmUpdate`; page reloads) |
| Tap "Later"             | `postpone()`                                                 |
| Press Escape (`keydown` on window) | `postpone()`                                      |

The Escape listener is registered via `<svelte:window
on:keydown={...}>` and gated by `if (!$updateSignal.visible) return;`
so it never interferes with other components when the prompt is
hidden.

## 4. Layout / positioning

- Fixed-positioned at top-center: `top: var(--space-4); left: 50%;
  transform: translateX(-50%);`.
- `z-index: 6` (above the bottom-center transient toasts which use
  `z-index: 5` and the attribution bar at `z-index: 4`).
- Card surface: `background: var(--color-surface-elev)`, `padding:
  var(--space-3) var(--space-4)`, `border-radius: 8px`,
  `box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18)`.
- Buttons are inline, separated by `gap: var(--space-2)`. Primary uses
  `background: var(--color-accent); color: #fff`. Secondary uses
  `background: transparent; color: var(--color-fg); border: 1px solid
  var(--color-border)`.

## 5. Tap targets / a11y

- Each button MUST be ≥ 36 × 36 px (Principle III).
- Both buttons MUST have an accessible name from the i18n string
  (no `aria-label` override needed; the visible text is the name).
- The card MUST NOT trap focus.

## 6. i18n keys (added in zh / en / ja)

| Key                  | zh                       | en                  | ja                  |
| -------------------- | ------------------------ | ------------------- | ------------------- |
| `pwa.update.title`   | `有新版本可用`           | `Update available`  | `アップデートあり`    |
| `pwa.update.confirm` | `立即更新`               | `Update now`        | `今すぐ更新`         |
| `pwa.update.later`   | `稍後`                   | `Later`             | `後で`              |
| `pwa.offline.ready`  | `已準備好離線使用`        | `Ready for offline use` | `オフラインで利用可能` |

> Locale-convention compliance per Constitution v1.1.0 — keys use the
> three existing identifiers (`zh / en / ja`); no new locale codes.

## 7. Tests required (TDD-first)

`tests/integration/update-prompt.spec.ts`:

1. With store `visible: false`, the component renders nothing
   (`queryByTestId('update-prompt')` returns null).
2. With store `visible: true` after `fireNeedRefresh(spy)`, both
   buttons render with localised labels.
3. Click "Update now" → `spy` called exactly once.
4. Click "Later" → `$updateSignal.visible` flips to `false`,
   `postponedUntil` is approximately `Date.now() + 1_800_000`.
5. Press Escape on the window → same as "Later".
6. Pressing Escape when the prompt is hidden does NOT throw, does
   NOT mutate the store, and does NOT call `confirmUpdate`.
7. The card carries `role="status"` and `aria-live="polite"`.
8. Both buttons measure ≥ 36 × 36 px under jsdom (use
   `getBoundingClientRect` with the same fake-rect helper from
   feature 003's component specs).
9. With locale `en`, button labels render `Update now` and `Later`.
   Switching to `zh` re-renders to `立即更新` / `稍後`.
