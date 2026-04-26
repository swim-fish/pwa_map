// Feature 005 — Svelte writable + named action exports driving the install
// affordance state. See contracts/install-signal.md §1–§5 + research D1, D2.

import { get, writable, type Readable } from 'svelte/store';
import { detectInstallSurface, type InstallSurface, type PlatformProbe } from './installPlatform';
import {
  DISMISSAL_WINDOW_MS,
  getDismissedUntil,
  setDismissedUntil,
} from '../storage/installDismissed';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    readonly outcome: 'accepted' | 'dismissed';
    readonly platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface InstallPromptState {
  readonly surface: InstallSurface;
  readonly deferredPrompt: BeforeInstallPromptEvent | null;
  readonly dismissedUntil: number | null;
  readonly installed: boolean;
}

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

function applyGates(
  baseSurface: InstallSurface,
  dismissedUntil: number | null,
  installed: boolean,
): InstallSurface {
  if (baseSurface === 'standalone') return 'standalone';
  if (installed) return 'hidden';
  if (dismissedUntil !== null && Date.now() < dismissedUntil) return 'hidden';
  return baseSurface;
}

function initialInstallState(): InstallPromptState {
  const dismissedUntil = getDismissedUntil();
  const baseSurface = detectInstallSurface(readProbe(false));
  return {
    surface: applyGates(baseSurface, dismissedUntil, false),
    deferredPrompt: null,
    dismissedUntil,
    installed: false,
  };
}

const store = writable<InstallPromptState>(initialInstallState());

export const installSignal: Readable<InstallPromptState> = {
  subscribe: store.subscribe,
};

export function captureBeforeInstallPrompt(event: BeforeInstallPromptEvent): void {
  store.update((s) => {
    const baseSurface = detectInstallSurface(readProbe(true));
    return {
      ...s,
      deferredPrompt: event,
      surface: applyGates(baseSurface, s.dismissedUntil, s.installed),
    };
  });
}

export async function triggerInstall(): Promise<{ outcome: 'accepted' | 'dismissed' }> {
  const current = get(store);
  const evt = current.deferredPrompt;
  if (evt === null) {
    throw new Error('No deferred prompt available');
  }
  await evt.prompt();
  const choice = await evt.userChoice;
  if (choice.outcome === 'dismissed') {
    recordDismissal();
  }
  store.update((s) => ({
    ...s,
    surface: 'hidden',
    deferredPrompt: null,
  }));
  return { outcome: choice.outcome };
}

export function recordDismissal(now: number = Date.now()): void {
  const dismissedUntil = now + DISMISSAL_WINDOW_MS;
  setDismissedUntil(dismissedUntil);
  store.update((s) => ({
    ...s,
    surface: 'hidden',
    dismissedUntil,
  }));
}

export function markInstalled(): void {
  store.update((s) => ({
    ...s,
    installed: true,
    surface: 'hidden',
    deferredPrompt: null,
  }));
}

export function __resetForTests(): void {
  store.set(initialInstallState());
}

export const __TESTING__ = { DISMISSAL_WINDOW_MS };
