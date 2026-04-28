---
paths:
  - "src/pwa/install*.ts"
  - "src/components/Install*.svelte"
  - "src/components/SettingsSheet.svelte"
  - "tests/unit/install*.spec.ts"
  - "tests/unit/pwa/install*.spec.ts"
  - "tests/integration/install*.spec.ts"
  - "tests/integration/settings-install-section.spec.ts"
  - "tests/e2e/safe-area-install.e2e.spec.ts"
  - "tests/e2e/story-5-install.spec.ts"
---

# PWA install affordance checkpoints

Long-form context: [`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§§ 3, 4. Authoritative ADRs: 0025 (PWA install surfaces), 0031
(safe-area + on-demand install entry).

## DERIVED SIGNAL: transient vs on-demand

Two install-state signals — pick the right one for the surface:

| Surface type | Signal to consume | Why |
| ------------ | ----------------- | --- |
| **Transient** pop-up (`InstallBanner`, `InstallIosSheet`) | `installSignal.surface` from `src/pwa/installSignal.ts` | Honours the 30-day banner-dismissal gate (`pwa_map:installDismissedUntil`). User can silence pop-ups for a month. |
| **On-demand** entry (Settings install section, future "Install" toolbar button, etc.) | `installSettingsSurface` from `src/pwa/installSettingsSurface.ts` | Bypasses the dismissal gate (FR-015) — user explicitly went looking for the action; "stop popping at me" must NOT mean "make install permanently inaccessible". |

DO NOT collapse the split. The transient pop-up suppression is
intentional UX. Adding new on-demand affordances? Subscribe to
`installSettingsSurface` (or extend it if a new branch is needed).

## REUSE actions, never duplicate state

`triggerInstall()`, `markInstalled()`, `recordDismissal()`,
`captureBeforeInstallPrompt()` from `installSignal.ts` are the
single source of mutation. Both signals are downstream views.
Never write a parallel install-state machine.

## iOS Safari: ALWAYS instructional

iOS Safari does NOT fire `beforeinstallprompt`. Apple has no
programmatic install API. Any "install on iOS Safari" code path
MUST be an instructional dialog showing: Share icon → Add to Home
Screen → Add.

Reuse the existing locale keys verbatim — do NOT invent new ones:

- `pwa.install.ios.title`
- `pwa.install.ios.step1` / `step2` / `step3`
- `pwa.install.ios.shareIconAlt`
- `pwa.install.ios.dismiss`

The Share-icon SVG is duplicated between `InstallIosSheet.svelte`
and the Settings install section — if you add a third surface,
extract a shared `<InstallIosInstructions>` snippet first to keep
bundle delta in budget.

## installSettingsSurface invariants (do not regress)

The derived store MUST satisfy invariants S1–S10 from
[`specs/011-safe-area-install-buttons/contracts/install-settings-surface.md`](../../specs/011-safe-area-install-buttons/contracts/install-settings-surface.md).
Key ones:

- `installSignal.installed === true` ⇒ `'standalone'` (not
  whatever the UA detector returns).
- `installSignal.dismissedUntil` MUST NOT influence the derived
  value (FR-015). Setting a future timestamp must NOT change the
  derived value, even when the underlying `installSignal.surface`
  flips to `'hidden'`.
- The literal `'hidden'` MUST NEVER appear in the derived value —
  the type union is closed over the six visible literals.

Run `tests/unit/install-settings-surface.spec.ts` after any change
to either store.

## Settings install section: in-flight guard

The Chromium branch of the Settings install button MUST disable
itself while `triggerInstall()` is pending — guard with a local
`installInFlight` flag inside a try/finally:

```ts
async function onConfirmChromium(): Promise<void> {
  if (installInFlight) return;
  installInFlight = true;
  try { await triggerInstall(); } catch { /* defence-in-depth */ }
  finally { installInFlight = false; }
}
```

Without the guard, double-tap calls `triggerInstall()` twice on the
same `deferredPrompt` and the second call throws.
