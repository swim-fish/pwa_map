// Feature 011 — derived store exposing the un-suppressed install
// surface for the new Settings install section. See
// `specs/011-safe-area-install-buttons/contracts/install-settings-surface.md`
// and research §R6 for the rationale.
//
// Distinct from `installSignal.surface`: that store collapses both
// "30-day banner dismissal" and "app installed" into the single
// `'hidden'` literal, which the Settings entry MUST NOT honour
// (FR-015 — banner dismissal silences pop-ups, not on-demand actions).
// The transient `InstallBanner` / `InstallIosSheet` keep using
// `installSignal.surface`; only the Settings section subscribes here.

import { derived, type Readable } from 'svelte/store';
import { installSignal } from './installSignal';
import { detectInstallSurface, type PlatformProbe } from './installPlatform';

export type SettingsInstallSurface =
  | 'android-chromium'
  | 'desktop-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'standalone'
  | 'unsupported';

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
    // The detector never returns 'hidden' — that literal is added by
    // installSignal's applyGates(). The branch below is defence-in-depth
    // so the type system can keep the six-literal union closed.
    if (base === 'hidden') return 'unsupported';
    return base;
  },
);
