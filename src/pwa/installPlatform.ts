// Feature 005 — pure-function platform detector for the install affordance.
// See contracts/install-platform.md §1–§5 and research D3.

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

const IOS_DEVICE_RE = /iPhone|iPad|iPod/;
const IOS_NON_SAFARI_RE = /CriOS|FxiOS|EdgiOS/;
const ANDROID_RE = /Android/;

export function detectInstallSurface(probe: PlatformProbe): InstallSurface {
  if (probe.standalone === true || probe.standaloneDisplayMode === true) {
    return 'standalone';
  }
  const ua = probe.userAgent;
  if (IOS_DEVICE_RE.test(ua)) {
    return IOS_NON_SAFARI_RE.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (ANDROID_RE.test(ua) && probe.hasDeferredPrompt) {
    return 'android-chromium';
  }
  if (probe.hasDeferredPrompt) {
    return 'desktop-chromium';
  }
  return 'unsupported';
}
