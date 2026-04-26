# Contract: `installPlatform` — pure-function platform detector

**Module**: `src/pwa/installPlatform.ts`
**Consumed by**: `src/pwa/installSignal.ts` (sole caller).
**Verifies**: spec FR-007, FR-010, FR-011 (priority); research D3.

## §1. Public surface

```ts
export type InstallSurface =
  | 'android-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'desktop-chromium'
  | 'unsupported'
  | 'standalone'
  | 'hidden';

export interface PlatformProbe {
  readonly userAgent: string;
  readonly standalone: boolean | undefined;
  readonly standaloneDisplayMode: boolean;
  readonly hasDeferredPrompt: boolean;
}

export function detectInstallSurface(probe: PlatformProbe): InstallSurface;
```

The module MUST export only the type aliases and the single function.
No default export, no class, no other named export. The function MUST
be pure (no I/O, no globals, no `Math.random` / `Date.now`) and total
(every well-typed input returns one of the seven literal surfaces).

## §2. Detection rules (priority — first match wins)

| # | Predicate                                                                                              | Returns             |
| - | ------------------------------------------------------------------------------------------------------ | ------------------- |
| 1 | `probe.standalone === true \|\| probe.standaloneDisplayMode === true`                                  | `'standalone'`      |
| 2 | `/iPhone\|iPad\|iPod/.test(ua)` AND NOT `/CriOS\|FxiOS\|EdgiOS/.test(ua)`                              | `'ios-safari'`      |
| 3 | `/iPhone\|iPad\|iPod/.test(ua)` AND `/CriOS\|FxiOS\|EdgiOS/.test(ua)`                                  | `'ios-other'`       |
| 4 | `/Android/.test(ua)` AND `probe.hasDeferredPrompt`                                                     | `'android-chromium'`|
| 5 | `probe.hasDeferredPrompt` (and rule 4 did not match)                                                   | `'desktop-chromium'`|
| 6 | (everything else)                                                                                      | `'unsupported'`     |

Note: rule #1 wins over EVERY other rule, including iOS Safari. The
spec FR-011 mandates DOM absence under standalone mode regardless of
the underlying platform, so detection must short-circuit there. The
`'hidden'` literal is **never** returned by this function — it is set
exclusively by `installSignal.ts` actions in response to dismissal /
install / appinstalled events.

## §3. Required test matrix

The unit spec (`tests/unit/pwa/installPlatform.spec.ts`) MUST cover
each numbered case. UA strings are excerpts from canonical real-world
strings; the spec inlines them verbatim:

```ts
const UA = {
  ANDROID_CHROME:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  ANDROID_FIREFOX:
    'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  IOS_SAFARI:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  IOS_CHROME:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  IOS_FIREFOX:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/604.1',
  DESKTOP_CHROME:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  DESKTOP_FIREFOX:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
};
```

| Test case                                              | probe                                                                                                | expected             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------- |
| Android Chrome with deferred prompt                    | `{ ua: ANDROID_CHROME, standalone: undefined, standaloneDisplayMode: false, hasDeferredPrompt: true }` | `'android-chromium'` |
| Android Chrome WITHOUT deferred prompt yet             | `{ ua: ANDROID_CHROME, ..., hasDeferredPrompt: false }`                                              | `'unsupported'`      |
| Android Firefox (never fires the event)                | `{ ua: ANDROID_FIREFOX, ..., hasDeferredPrompt: false }`                                             | `'unsupported'`      |
| iOS Safari, not standalone                             | `{ ua: IOS_SAFARI, standalone: false, standaloneDisplayMode: false, hasDeferredPrompt: false }`      | `'ios-safari'`       |
| iOS Safari, standalone via navigator.standalone        | `{ ua: IOS_SAFARI, standalone: true, standaloneDisplayMode: false, hasDeferredPrompt: false }`       | `'standalone'`       |
| iOS Safari, standalone via matchMedia                  | `{ ua: IOS_SAFARI, standalone: false, standaloneDisplayMode: true, hasDeferredPrompt: false }`       | `'standalone'`       |
| iOS Chrome (CriOS)                                     | `{ ua: IOS_CHROME, ..., hasDeferredPrompt: false }`                                                  | `'ios-other'`        |
| iOS Firefox (FxiOS)                                    | `{ ua: IOS_FIREFOX, ..., hasDeferredPrompt: false }`                                                 | `'ios-other'`        |
| Desktop Chrome with deferred prompt                    | `{ ua: DESKTOP_CHROME, ..., hasDeferredPrompt: true }`                                               | `'desktop-chromium'` |
| Desktop Chrome WITHOUT deferred prompt                 | `{ ua: DESKTOP_CHROME, ..., hasDeferredPrompt: false }`                                              | `'unsupported'`      |
| Desktop Firefox                                        | `{ ua: DESKTOP_FIREFOX, ..., hasDeferredPrompt: false }`                                             | `'unsupported'`      |
| Standalone wins over Android (regression guard)        | `{ ua: ANDROID_CHROME, standaloneDisplayMode: true, hasDeferredPrompt: true }`                       | `'standalone'`       |
| Empty UA + no prompt (corner case)                     | `{ ua: '', standalone: undefined, standaloneDisplayMode: false, hasDeferredPrompt: false }`          | `'unsupported'`      |

## §4. Edge cases the spec MUST NOT regress

- **Standalone wins over Android-Chromium**: even if
  `hasDeferredPrompt === true` AND the UA matches Android, the
  standalone gate suppresses the affordance. The corresponding test
  case appears as the "Standalone wins over Android" row above.
- **iOS Safari MUST NOT be classified as `'unsupported'`** even
  though `hasDeferredPrompt` will always be false on iOS — rule #2
  fires before rule #6.
- **iOS Chrome / Firefox MUST NOT be classified as `'ios-safari'`**
  — the CriOS / FxiOS / EdgiOS suffix in the UA is the only
  reliable Safari-vs-rest discriminant on iOS.

## §5. Stability commitment

The function signature is the **public** contract for this feature.
Future work (e.g., supporting Samsung Internet's specific install
heuristics, or adding a Trusted Web Activity surface) MUST extend
the discriminated union by adding a new literal — never by
reinterpreting an existing one. Existing unit tests MUST continue to
pass after any extension.
