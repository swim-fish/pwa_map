# Phase 1 Data Model: PWA Install Affordance

**Feature**: `005-pwa-installable` | **Date**: 2026-04-26
**Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature has **no persisted schema beyond a single integer
timestamp**. Two transient in-memory shapes, one persisted key, and
one platform-detection value object. Every shape is read-only by
convention (`readonly` modifiers throughout) — actions on the store
return new state objects rather than mutating in place.

---

## §1. `InstallPromptState` (transient, in-memory)

**Owner**: `src/pwa/installSignal.ts` (Svelte writable; consumers see
a `Readable<InstallPromptState>`).

**Lifecycle**: created on module import via `initialInstallState()`,
mutated only through the named action exports
(`captureBeforeInstallPrompt`, `triggerInstall`, `recordDismissal`,
`markInstalled`, `__resetForTests`).

```ts
type InstallSurface =
  | 'android-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'desktop-chromium'
  | 'unsupported'
  | 'standalone'
  | 'hidden';

interface InstallPromptState {
  /**
   * Which surface (if any) the UI MUST render. The two non-rendering
   * surfaces ('standalone' and 'hidden') are kept distinct so tests
   * can assert provenance:
   *   'standalone' — platform-driven suppression (FR-011)
   *   'hidden'     — dismissal- or install-driven suppression (FR-006/FR-013)
   */
  readonly surface: InstallSurface;

  /**
   * The captured beforeinstallprompt event — null until Chromium
   * fires it. iOS / unsupported paths leave this null forever.
   * Non-serialisable; in-memory only.
   */
  readonly deferredPrompt: BeforeInstallPromptEvent | null;

  /**
   * The "MAY re-appear at" epoch ms read from
   * pwa_map:installDismissedUntil. Null if absent / corrupt /
   * already in the past (per §2 corruption-tolerance).
   */
  readonly dismissedUntil: number | null;

  /**
   * Set true by markInstalled() in response to the appinstalled
   * event. Once true, surface MUST stay 'hidden' for the rest of
   * the page lifetime (FR-006).
   */
  readonly installed: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    readonly outcome: 'accepted' | 'dismissed';
    readonly platform: string;
  }>;
  prompt(): Promise<void>;
}
```

**State transitions**:

```text
                  ┌─────────────────────────────────┐
                  │        initialInstallState      │
                  │  surface = (detector result)    │
                  │  deferredPrompt = null          │
                  │  dismissedUntil = (storage)     │
                  │  installed = false              │
                  └────────────────┬────────────────┘
                                   │
            beforeinstallprompt ──►│ captureBeforeInstallPrompt(evt)
                                   │   surface' = re-detect with
                                   │       hasDeferredPrompt = true
                                   │   deferredPrompt = evt
                                   │
              user taps "Install" ►│ triggerInstall()
                                   │   await evt.prompt()
                                   │   await evt.userChoice
                                   │   if outcome === 'accepted':
                                   │     surface = 'hidden'
                                   │     deferredPrompt = null
                                   │   if outcome === 'dismissed':
                                   │     recordDismissal(now + 30d)
                                   │     surface = 'hidden'
                                   │
                user taps "Not now"►│ recordDismissal(now + 30d)
                                   │   dismissedUntil = ts
                                   │   surface = 'hidden'
                                   │   (writes pwa_map:installDismissedUntil)
                                   │
                       appinstalled►│ markInstalled()
                                   │   installed = true
                                   │   deferredPrompt = null
                                   │   surface = 'hidden'
                                   │
                  test reset only ►│ __resetForTests()
                                   │   back to initialInstallState
                                   ▼
```

**Invariants**:

- `surface === 'standalone'` ⇒ DOM MUST contain no install affordance
  (FR-011). The store guarantees this purely by the surface value;
  the components key off `surface` and skip rendering via
  `{#if surface !== 'standalone' && surface !== 'hidden'}` blocks.
- `installed === true` ⇒ `surface === 'hidden'` (lifetime
  suppression).
- `dismissedUntil !== null && Date.now() < dismissedUntil` ⇒
  `surface === 'hidden'` (window suppression).
- `deferredPrompt === null` ⇒ the Android / desktop-chromium banner
  CANNOT call `prompt()` — the "Install" button is disabled or the
  surface falls back to `'unsupported'` / `'hidden'`.
- All transitions are pure: each action returns a new state object;
  no in-place mutation.

---

## §2. `pwa_map:installDismissedUntil` (persisted)

**Owner**: `src/storage/installDismissed.ts`.

**Key**: `pwa_map:installDismissedUntil` (literal string).

**Value shape**: a string-ified positive integer epoch milliseconds
(`String(Date.now() + DISMISSAL_WINDOW_MS)`).

**Default window**: `DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000`
(30 days in ms; FR-012).

**Reader contract** (`getDismissedUntil(): number | null`):

| Stored value                              | Returns       | Reason |
| ----------------------------------------- | ------------- | ------ |
| (key absent)                              | `null`        | Never dismissed |
| `'1796428800000'` (future ts)             | `1796428800000` | Active dismissal |
| `'1700000000000'` (past ts)               | `null`        | Window expired — re-arm |
| `'true'`, `'{"foo":1}'`, `''`, `'NaN'`    | `null`        | Corruption-tolerant; treat as absent |
| `'-1'`, `'0'`                             | `null`        | Invalid (FR-014: absence ≡ never dismissed) |
| (localStorage throws)                     | `null`        | Private mode / SSR — graceful fallback |

**Writer contract** (`setDismissedUntil(timestampMs: number): void`):

- MUST coerce input to a positive integer; reject `NaN`, `Infinity`,
  `-Infinity`, negatives by silently no-oping.
- MUST tolerate `localStorage` throwing (quota, privacy mode) by
  silently no-oping — never raise to the caller.
- Writes `String(timestampMs)` exactly (no JSON, no padding).

**Schema stability**: this is a **new** key per ADR 0021 additive
evolution. It does NOT touch `pwa_map:prefs`, `pwa_map:lastView`,
`pwa_map:gotoHistory_v1`, or `pwa_map:offlineReadyShown`. Site-data
clear wipes it; recovering = absence = "not dismissed".

---

## §3. `PlatformProbe` (transient, parameter shape only)

**Owner**: `src/pwa/installPlatform.ts` — pure-function input.

```ts
interface PlatformProbe {
  readonly userAgent: string;
  /** navigator.standalone (iOS Safari extension; undefined elsewhere) */
  readonly standalone: boolean | undefined;
  /** matchMedia('(display-mode: standalone)').matches */
  readonly standaloneDisplayMode: boolean;
  /** Whether captureBeforeInstallPrompt() has run this session */
  readonly hasDeferredPrompt: boolean;
}

function detectInstallSurface(probe: PlatformProbe): InstallSurface;
```

**Detection priority** (research D3, restated for completeness):

1. `probe.standalone === true || probe.standaloneDisplayMode === true`
   → `'standalone'`.
2. `/iPhone|iPad|iPod/.test(probe.userAgent)`
   AND NOT `/CriOS|FxiOS|EdgiOS/.test(probe.userAgent)`
   → `'ios-safari'`.
3. `/iPhone|iPad|iPod/.test(probe.userAgent)`
   AND `/CriOS|FxiOS|EdgiOS/.test(probe.userAgent)`
   → `'ios-other'`.
4. `/Android/.test(probe.userAgent)` AND `probe.hasDeferredPrompt`
   → `'android-chromium'`.
5. `probe.hasDeferredPrompt` (and not Android)
   → `'desktop-chromium'`.
6. Else → `'unsupported'`.

**Properties**:

- Pure: same input ⇒ same output, every time.
- No I/O: never reads `navigator`, `window`, `localStorage`, or
  `matchMedia` — every input is in `probe`.
- Total: every well-typed `PlatformProbe` returns one of the seven
  `InstallSurface` literals; no `undefined` / no `throw`.

---

## §4. `BeforeInstallPromptEvent` (browser-issued, app does not own)

**Owner**: the user's browser. Re-declared in TypeScript ambient form
because TS lib.dom.d.ts does not include the type.

```ts
declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: readonly string[];
    readonly userChoice: Promise<{
      readonly outcome: 'accepted' | 'dismissed';
      readonly platform: string;
    }>;
    prompt(): Promise<void>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}
```

**Constraints from the platform** (NOT FR-derived; browser-imposed):

- `event.prompt()` MUST be called from a user-gesture-rooted task; if
  called from a non-gesture context the browser logs a warning and
  the call is no-op.
- `event.prompt()` MAY be called at most once per event instance.
  Subsequent calls reject.
- Once `event.preventDefault()` is **not** called, the event auto-
  dismisses on the next microtask and `prompt()` is invalidated.
- The event reference does not survive a page navigation. A reload
  fires a fresh event.

These constraints shape D1 (capture early, defer the prompt) and the
`triggerInstall` action's serialisation semantics.

---

## §5. Cross-shape relationship diagram

```text
                ┌────────────────────────────────┐
                │     installPlatform.ts         │
                │  detectInstallSurface(probe) ──┼─── pure
                └─────────────┬──────────────────┘
                              │ returns InstallSurface
                              ▼
   ┌──────────────────────────────────────────────────────┐
   │             installSignal.ts (Svelte writable)       │
   │   fields: InstallPromptState { surface, deferred,    │
   │            dismissedUntil, installed }               │
   │   actions: capture / trigger / dismiss / mark / reset│
   │                                                      │
   │   reads:  installPlatform.detectInstallSurface       │
   │   reads:  installDismissed.getDismissedUntil         │
   │   writes: installDismissed.setDismissedUntil         │
   └─────────────┬────────────────────────────────────────┘
                 │ Readable<InstallPromptState>
                 ▼
   ┌──────────────────────────────────────────────────────┐
   │  App.svelte                                          │
   │   - registers window listeners (D1)                  │
   │   - mounts <InstallBanner /> + <InstallIosSheet />   │
   │     unconditionally (the components self-suppress    │
   │     on $installSignal.surface)                       │
   └──────────────────────────────────────────────────────┘
                 │
                 ├── <InstallBanner /> renders only when
                 │     surface ∈ {'android-chromium',
                 │                'desktop-chromium'}
                 │
                 └── <InstallIosSheet /> renders only when
                       surface ∈ {'ios-safari', 'ios-other'}
                       (variant copy: 'ios-other' shows the
                        read-only "open in Safari" hint)
```

**Trust boundary**: every `installSignal` consumer trusts the
`surface` field absolutely — no consumer is allowed to second-guess
it by re-reading `navigator` or `localStorage` directly. Any future
change to detection logic lives in one place
(`installPlatform.detectInstallSurface`), and any future change to
suppression rules lives in one place (`installSignal` actions).

---

## §6. Sample code: registerSW.ts is **unchanged**

For clarity: the SW registration in `src/pwa/registerSW.ts` is
**not** modified by feature 005. The install affordance has no SW
dependency beyond the manifest hygiene already shipped by feature
004. Adding a `beforeinstallprompt` listener inside `registerSW.ts`
would entangle install with SW lifecycle (which is wrong because
iOS Safari has neither a SW we control nor a `beforeinstallprompt`
event). The listener lives in `App.svelte`'s `onMount`.

```ts
// src/app/App.svelte (excerpt — Phase 3 task)
onMount(() => {
  const onBeforeInstall = (e: Event): void => {
    e.preventDefault();
    captureBeforeInstallPrompt(e as BeforeInstallPromptEvent);
  };
  const onAppInstalled = (): void => {
    markInstalled();
  };
  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  window.addEventListener('appinstalled', onAppInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    window.removeEventListener('appinstalled', onAppInstalled);
  };
});
```

---

## §7. What this feature does NOT add

- **No new persisted shape beyond §2**. `pwa_map:prefs` is untouched;
  no version bump.
- **No new SW cache rule**. The runtime caching from feature 003
  (osm-tiles / nlsc-tiles / google-tiles) and the workbox-precache
  for the app shell are unchanged.
- **No new manifest field**. The manifest object in `vite.config.ts`
  is identical to feature 004.
- **No new runtime dependency**. All work uses standard browser APIs.
- **No telemetry / analytics**. Install accept-rate is observed via
  manual smoke per SC-002, not via persisted counters.
