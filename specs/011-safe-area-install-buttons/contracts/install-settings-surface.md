# Contract: `installSettingsSurface` — derived store for the Settings install section

**Feature**: 011-safe-area-install-buttons
**Module**: `src/pwa/installSettingsSurface.ts` (NEW)
**Consumed by**: `src/components/SettingsSheet.svelte` (NEW section)
**Spec FRs**: FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
**Related**: feature 005 / ADR 0025 (`installSignal` — not changed,
re-used as the input)

## §1. Public surface

```ts
import type { Readable } from 'svelte/store';

/**
 * The six install-section branches. Distinct from
 * `InstallSurface` (feature 005): no `'hidden'` literal, because
 * the new Settings section is exempt from the 30-day banner
 * dismissal gate (FR-015).
 */
export type SettingsInstallSurface =
  | 'android-chromium'
  | 'desktop-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'standalone'
  | 'unsupported';

/**
 * The un-suppressed install surface for the Settings section.
 * Subscribes to `installSignal` (feature 005) and re-derives
 * synchronously on every change.
 */
export const installSettingsSurface: Readable<SettingsInstallSurface>;

/**
 * Test-only reset hook. Equivalent to feature 005's
 * `__resetForTests()` — re-evaluates the underlying store and
 * forces a fresh subscription notification.
 */
export function __resetForTests(): void;
```

This module is **purely** derived state. It does NOT own actions, a
mutable store, or its own DOM listeners. The actions that mutate
install state (`captureBeforeInstallPrompt`, `triggerInstall`,
`recordDismissal`, `markInstalled`) all live in feature 005's
`installSignal.ts` and are imported by `SettingsSheet.svelte`
directly.

## §2. Derivation algorithm

```ts
import { derived, type Readable } from 'svelte/store';
import { installSignal } from './installSignal';
import { detectInstallSurface, type PlatformProbe } from './installPlatform';

function readProbe(hasDeferredPrompt: boolean): PlatformProbe {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    standalone:
      typeof navigator !== 'undefined'
        ? ((navigator as Navigator & { standalone?: boolean }).standalone ?? undefined)
        : undefined,
    standaloneDisplayMode:
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false,
    hasDeferredPrompt,
  };
}

export const installSettingsSurface: Readable<SettingsInstallSurface> = derived(
  installSignal,
  ($s): SettingsInstallSurface => {
    if ($s.installed) return 'standalone';
    const base = detectInstallSurface(readProbe($s.deferredPrompt !== null));
    if (base === 'standalone') return 'standalone';
    if (base === 'hidden') return 'unsupported'; // unreachable — detector never emits 'hidden'
    return base;
  },
);
```

## §3. State invariants

The store MUST satisfy these invariants at all times:

| #   | Invariant                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `installSignal.installed === true` ⇒ derived value is `'standalone'` (FR-013).                                                                                                                                                     |
| S2  | `window.matchMedia('(display-mode: standalone)').matches === true` ⇒ derived value is `'standalone'` (FR-013).                                                                                                                     |
| S3  | iOS device UA + non-Safari (`CriOS` / `FxiOS` / `EdgiOS`) + neither standalone gate ⇒ derived value is `'ios-other'` (FR-012).                                                                                                     |
| S4  | iOS device UA + Safari + neither standalone gate ⇒ derived value is `'ios-safari'` (FR-011).                                                                                                                                       |
| S5  | Android UA + `installSignal.deferredPrompt !== null` + neither standalone gate ⇒ derived value is `'android-chromium'` (FR-010).                                                                                                   |
| S6  | Non-iOS, non-Android UA + `installSignal.deferredPrompt !== null` + neither standalone gate ⇒ derived value is `'desktop-chromium'` (FR-010).                                                                                       |
| S7  | None of the above ⇒ derived value is `'unsupported'` (FR-014).                                                                                                                                                                     |
| S8  | `installSignal.dismissedUntil` MUST NOT influence the derived value (FR-015) — i.e. setting `dismissedUntil` to a future timestamp MUST NOT change the derived value, even when the underlying `installSignal.surface` is `'hidden'`. |
| S9  | The derived value MUST update synchronously whenever `installSignal` changes — verified by Vitest fake timers + `get(...)` immediately after the upstream store mutation.                                                          |
| S10 | The derived value MUST be one of the six literals enumerated by `SettingsInstallSurface`; `'hidden'` MUST NEVER appear (FR-015 codified at the type level).                                                                          |

## §4. Action semantics

The module exports **no** actions of its own. The Settings install
section that consumes this store calls `triggerInstall()` /
`recordDismissal()` / `markInstalled()` from `installSignal.ts`
directly — the derived store re-evaluates as a consequence.

### §4.1 `__resetForTests()`

```ts
function __resetForTests(): void;
```

- Calls `installSignal.__resetForTests()` (feature 005's existing
  hook) which re-bootstraps the upstream store, which in turn fires
  a derived-store notification on the next microtask.
- MUST be a no-op outside test runs but the function is exported
  unconditionally (no `if (import.meta.env.MODE === 'test')` gate)
  for production / test parity.

## §5. Required test cases

`tests/unit/install-settings-surface.spec.ts` MUST cover at minimum:

1. **`installSignal.installed === true` ⇒ `'standalone'`** —
   directly mutates `installSignal` via its existing test hooks
   (`captureBeforeInstallPrompt` then `markInstalled()`); asserts
   `get(installSettingsSurface) === 'standalone'`.
2. **standalone display mode ⇒ `'standalone'`** — stubs
   `window.matchMedia('(display-mode: standalone)').matches = true`;
   resets; asserts derived = `'standalone'`.
3. **iOS Safari ⇒ `'ios-safari'`** — stubs UA to an iPhone Safari
   UA string; resets; asserts derived = `'ios-safari'`.
4. **iOS Chrome ⇒ `'ios-other'`** — stubs UA to an iPhone CriOS UA;
   resets; asserts derived = `'ios-other'`.
5. **Android + captured prompt ⇒ `'android-chromium'`** — stubs UA
   to Android Chrome; resets; captures a synthetic
   `BeforeInstallPromptEvent`; asserts derived = `'android-chromium'`.
6. **Desktop + captured prompt ⇒ `'desktop-chromium'`** — stubs UA
   to a desktop Chrome UA; resets; captures synthetic event; asserts
   derived = `'desktop-chromium'`.
7. **Desktop without captured prompt ⇒ `'unsupported'`** — stubs UA
   to desktop Firefox; resets; does NOT capture; asserts derived =
   `'unsupported'`.
8. **30-day dismissal MUST NOT affect derivation (FR-015)** — for
   each of the six visible literals, set
   `installSignal.dismissedUntil` to a future timestamp via
   `recordDismissal()`; assert the derived value is unchanged. In
   particular, on Android + captured prompt + dismissal, derived
   MUST still be `'android-chromium'` even though
   `installSignal.surface === 'hidden'`.
9. **`installed` overrides every other branch** — for each of the
   five non-standalone visible literals, set `installSignal.installed
   = true` via `markInstalled()`; assert derived flips to
   `'standalone'`.
10. **`'hidden'` never appears in the derived value (S10)** — runs
    the full state matrix (UA × deferred prompt × dismissed × installed
    × matchMedia) and asserts the derived value is always one of the
    six enumerated literals; `'hidden'` MUST NEVER be returned.

## §6. Stability commitment

The exported type `SettingsInstallSurface`, the exported store
`installSettingsSurface`, and the exported `__resetForTests` function
form the public contract. New literals MAY be added to
`SettingsInstallSurface` only by superseding this contract via a new
spec; existing literals MUST NOT change semantics without the same.
