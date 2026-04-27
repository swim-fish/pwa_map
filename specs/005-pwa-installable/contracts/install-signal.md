# Contract: `installSignal` — Svelte writable + action exports

**Module**: `src/pwa/installSignal.ts`
**Consumed by**: `src/app/App.svelte`, `InstallBanner.svelte`,
`InstallIosSheet.svelte`, all unit / integration tests under feature
005.
**Verifies**: spec FR-001..FR-006, FR-013, FR-014; research D1, D2.

## §1. Public surface

```ts
import { type Readable } from 'svelte/store';
import type { InstallSurface, BeforeInstallPromptEvent } from './installPlatform';

export interface InstallPromptState {
  readonly surface: InstallSurface;
  readonly deferredPrompt: BeforeInstallPromptEvent | null;
  readonly dismissedUntil: number | null;
  readonly installed: boolean;
}

export const installSignal: Readable<InstallPromptState>;

export function captureBeforeInstallPrompt(event: BeforeInstallPromptEvent): void;
export function triggerInstall(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
export function recordDismissal(now?: number): void;
export function markInstalled(): void;
export function __resetForTests(): void;

export const __TESTING__: { readonly DISMISSAL_WINDOW_MS: number };
```

## §2. State invariants

The store starts in a state derived from a one-shot bootstrap:

```ts
function initialInstallState(): InstallPromptState {
  const probe: PlatformProbe = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    standalone:
      typeof navigator !== 'undefined'
        ? ((navigator as Navigator & { standalone?: boolean }).standalone ?? undefined)
        : undefined,
    standaloneDisplayMode:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false,
    hasDeferredPrompt: false,
  };
  const dismissedUntil = getDismissedUntil();
  const baseSurface = detectInstallSurface(probe);
  return {
    surface: applyDismissal(baseSurface, dismissedUntil),
    deferredPrompt: null,
    dismissedUntil,
    installed: false,
  };
}

function applyDismissal(surface: InstallSurface, until: number | null): InstallSurface {
  if (surface === 'standalone') return 'standalone';
  if (until !== null && Date.now() < until) return 'hidden';
  return surface;
}
```

The store MUST satisfy these invariants at all times:

| #   | Invariant                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------- |
| I1  | `surface === 'standalone'` ⇒ DOM contains no install affordance (FR-011).                                      |
| I2  | `installed === true` ⇒ `surface === 'hidden'` (FR-006 lifetime suppression).                                   |
| I3  | `dismissedUntil !== null && Date.now() < dismissedUntil` ⇒ `surface === 'hidden'` (FR-013).                    |
| I4  | `surface === 'android-chromium' \|\| surface === 'desktop-chromium'` ⇒ `deferredPrompt !== null` (D1 capture). |
| I5  | After `triggerInstall()` resolves, `deferredPrompt` MUST be `null` regardless of outcome (one-shot semantics). |
| I6  | After `recordDismissal()`, `dismissedUntil` MUST equal the value just persisted (no race with localStorage).   |
| I7  | After `markInstalled()`, `surface === 'hidden'` AND `installed === true` AND `deferredPrompt === null`.        |

## §3. Action semantics

### §3.1 `captureBeforeInstallPrompt(event)`

```ts
function captureBeforeInstallPrompt(event: BeforeInstallPromptEvent): void;
```

- MUST overwrite any previously-captured event with the new one (the
  most recent event wins; D1 idempotency).
- MUST re-derive `surface` by re-running `detectInstallSurface` with
  `hasDeferredPrompt = true`, then re-applying the dismissal /
  installed gates. After this:
  - if `installed === true`: `surface = 'hidden'`.
  - if `dismissedUntil` future: `surface = 'hidden'`.
  - if `surface === 'standalone'`: stays `'standalone'`.
  - else: `'android-chromium'` (Android UA) or `'desktop-chromium'`
    (anything else with the event).
- MUST NOT call `event.preventDefault()` — the caller in `App.svelte`
  is the one that owns `preventDefault()`. This module assumes the
  event has already been deferred.

### §3.2 `triggerInstall()`

```ts
function triggerInstall(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
```

- MUST be called from a user-gesture-rooted task (the "Install"
  button's click handler). The component is responsible for the
  gesture; this function makes no gesture check.
- If `deferredPrompt === null`: MUST throw a typed error
  (`new Error('No deferred prompt available')`) and leave state
  unchanged. The component MUST disable the button when the prompt
  is null, so this branch is a defence-in-depth.
- Reads the captured event, calls `event.prompt()`, awaits
  `event.userChoice`.
- If `outcome === 'accepted'`: sets `surface = 'hidden'`, clears
  `deferredPrompt`. Does NOT call `recordDismissal` (acceptance is
  not dismissal). The actual lifetime suppression comes from the
  upcoming `appinstalled` event handled by `markInstalled()`.
- If `outcome === 'dismissed'`: calls `recordDismissal(Date.now())`
  internally (the user implicitly dismissed by rejecting the native
  sheet — FR-005), then sets `surface = 'hidden'`, clears
  `deferredPrompt`.
- Returns the outcome to the caller for telemetry / further UI.
- MUST be idempotent against double-clicks: after the first call,
  `deferredPrompt === null` so the second call throws.

### §3.3 `recordDismissal(now?)`

```ts
function recordDismissal(now: number = Date.now()): void;
```

- Computes `dismissedUntil = now + DISMISSAL_WINDOW_MS`.
- MUST call `setDismissedUntil(dismissedUntil)` to persist (synchronously).
- MUST set `surface = 'hidden'` and `dismissedUntil = dismissedUntil`
  in the store.
- MUST NOT clear `deferredPrompt` — a dismissal of the in-app banner
  does NOT invalidate the platform's deferred prompt; if the user
  somehow re-arms the affordance later in the same session (e.g.,
  through dev tools), the captured event is still useful. But the
  surface stays `'hidden'` until the page reloads or
  `__resetForTests()` runs.

### §3.4 `markInstalled()`

```ts
function markInstalled(): void;
```

- Called from `App.svelte`'s `appinstalled` listener.
- Sets `installed = true`, `surface = 'hidden'`, `deferredPrompt = null`.
- Does NOT touch `dismissedUntil` — install does not constitute a
  dismissal; the spec says `appinstalled` is a STRONGER signal
  ("hide for the rest of the install lifetime", FR-006). On the next
  cold-start the page will be in standalone mode anyway, so the
  store will boot to `surface === 'standalone'`.

### §3.5 `__resetForTests()`

```ts
function __resetForTests(): void;
```

- Resets the store to `initialInstallState()`.
- MUST be called by every spec's `beforeEach` (the existing pattern
  from `tests/unit/pwa/updateSignal.spec.ts`).
- MUST be a no-op outside test runs but the function is exported
  unconditionally (no `if (import.meta.env.MODE === 'test')` gate)
  to keep production / test parity.

## §4. Required test cases

The unit spec (`tests/unit/pwa/installSignal.spec.ts`) MUST cover at
minimum:

1. **Initial state matrix** — for each `InstallSurface` literal
   returned by `detectInstallSurface`, the store boots to the
   corresponding `surface` (with the dismissal gate folded in).
   Drive via `vi.stubGlobal('navigator', ...)` and
   `vi.stubGlobal('matchMedia', ...)` followed by
   `__resetForTests()` to re-bootstrap.
2. **`captureBeforeInstallPrompt` flips Android UA to
   `'android-chromium'`**: stub UA = ANDROID_CHROME, reset, capture
   a synthetic event, assert `surface === 'android-chromium'` and
   `deferredPrompt === <captured event>`.
3. **`captureBeforeInstallPrompt` flips desktop UA to
   `'desktop-chromium'`**: same with DESKTOP_CHROME.
4. **`captureBeforeInstallPrompt` is idempotent**: capture event A,
   assert; capture event B, assert `deferredPrompt === B`.
5. **`captureBeforeInstallPrompt` is suppressed by standalone**:
   stub `matchMedia → matches: true`, reset, capture event; assert
   `surface === 'standalone'` (NOT `'android-chromium'`), even
   though `deferredPrompt` is non-null.
6. **`captureBeforeInstallPrompt` is suppressed by dismissal
   window**: pre-write a future dismissedUntil into localStorage,
   reset, capture event; assert `surface === 'hidden'` AND
   `deferredPrompt !== null`.
7. **`triggerInstall` rejected → records dismissal**: capture event
   whose `userChoice` resolves with `outcome: 'dismissed'`; call
   `triggerInstall()`; await; assert `surface === 'hidden'`,
   `dismissedUntil ≈ now + 30d` (within 100 ms tolerance),
   `localStorage.getItem('pwa_map:installDismissedUntil')` is the
   stringified epoch ms.
8. **`triggerInstall` accepted → does NOT record dismissal**: same
   setup, `outcome: 'accepted'`; assert `surface === 'hidden'`,
   `dismissedUntil === null`, no localStorage write for the
   install-dismissed key.
9. **`triggerInstall` with no deferred prompt throws**:
   `__resetForTests()`, do NOT capture, call `triggerInstall()`;
   assert it throws with the expected message; assert state
   unchanged.
10. **`triggerInstall` is one-shot**: capture event, call once
    (resolves accepted), call again; assert second call throws.
11. **`recordDismissal()` writes localStorage and hides**: capture,
    call `recordDismissal()`; assert `dismissedUntil ≈ now + 30d`,
    `surface === 'hidden'`,
    `localStorage.getItem('pwa_map:installDismissedUntil')` correct.
12. **`markInstalled()`**: capture event; call `markInstalled()`;
    assert `installed === true`, `surface === 'hidden'`,
    `deferredPrompt === null`. Assert `dismissedUntil` is unchanged
    (install ≠ dismiss).
13. **Past dismissedUntil is ignored on boot**: pre-write a past
    timestamp; reset; assert `dismissedUntil === null` AND
    `surface === <detector result>` (re-armed; FR-014).
14. **Dismissal window magic number**: assert
    `__TESTING__.DISMISSAL_WINDOW_MS === 30 * 24 * 60 * 60 * 1000`.

## §5. Stability commitment

The five named action functions are the public contract. New actions
MAY be added; existing actions MUST NOT change signature or
semantics without a feature-005-superseding spec.
