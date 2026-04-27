import { describe, test, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  installSignal,
  captureBeforeInstallPrompt,
  triggerInstall,
  recordDismissal,
  markInstalled,
  __resetForTests,
  __TESTING__,
  type BeforeInstallPromptEvent,
} from '../../../src/pwa/installSignal';
import { __INSTALL_DISMISSED_KEY } from '../../../src/storage/installDismissed';

const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function stubNavigator(userAgent: string, standalone: boolean | undefined = undefined): void {
  vi.stubGlobal('navigator', { userAgent, standalone });
}

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  }
}

function makeEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): BeforeInstallPromptEvent {
  const evt = new Event('beforeinstallprompt') as unknown as BeforeInstallPromptEvent & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  evt.prompt = vi.fn(async () => undefined);
  evt.userChoice = Promise.resolve({ outcome, platform: 'web' });
  return evt as BeforeInstallPromptEvent;
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
  vi.unstubAllGlobals();
  stubNavigator('', undefined);
  stubMatchMedia(false);
  __resetForTests();
});

describe('installSignal — initial-state matrix (feature 005 D2)', () => {
  test('Android UA + no prompt + non-standalone → unsupported on boot', () => {
    stubNavigator(UA_ANDROID);
    stubMatchMedia(false);
    __resetForTests();
    expect(get(installSignal).surface).toBe('unsupported');
  });

  test('iOS Safari → ios-safari on boot', () => {
    stubNavigator(UA_IOS_SAFARI, false);
    stubMatchMedia(false);
    __resetForTests();
    expect(get(installSignal).surface).toBe('ios-safari');
  });

  test('matchMedia(display-mode: standalone) → standalone wins', () => {
    stubNavigator(UA_ANDROID);
    stubMatchMedia(true);
    __resetForTests();
    expect(get(installSignal).surface).toBe('standalone');
  });
});

describe('installSignal — captureBeforeInstallPrompt', () => {
  test('Android UA + capture flips to android-chromium', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent();
    captureBeforeInstallPrompt(evt);
    const s = get(installSignal);
    expect(s.surface).toBe('android-chromium');
    expect(s.deferredPrompt).toBe(evt);
  });

  test('Desktop UA + capture flips to desktop-chromium', () => {
    stubNavigator(UA_DESKTOP);
    __resetForTests();
    const evt = makeEvent();
    captureBeforeInstallPrompt(evt);
    expect(get(installSignal).surface).toBe('desktop-chromium');
  });

  test('capture is idempotent — most-recent event wins', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const a = makeEvent();
    const b = makeEvent();
    captureBeforeInstallPrompt(a);
    captureBeforeInstallPrompt(b);
    expect(get(installSignal).deferredPrompt).toBe(b);
  });

  test('standalone gate suppresses capture', () => {
    stubNavigator(UA_ANDROID);
    stubMatchMedia(true);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    expect(get(installSignal).surface).toBe('standalone');
  });

  test('future-dismissedUntil gate suppresses capture but retains deferredPrompt', () => {
    const future = Date.now() + __TESTING__.DISMISSAL_WINDOW_MS;
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(future));
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent();
    captureBeforeInstallPrompt(evt);
    const s = get(installSignal);
    expect(s.surface).toBe('hidden');
    expect(s.deferredPrompt).toBe(evt);
  });
});

describe('installSignal — triggerInstall', () => {
  test('rejected outcome records 30d dismissal, hides surface, clears deferredPrompt', async () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent('dismissed');
    captureBeforeInstallPrompt(evt);
    const before = Date.now();
    const result = await triggerInstall();
    expect(result.outcome).toBe('dismissed');
    const s = get(installSignal);
    expect(s.surface).toBe('hidden');
    expect(s.deferredPrompt).toBeNull();
    expect(s.dismissedUntil).not.toBeNull();
    const diff = (s.dismissedUntil ?? 0) - before;
    expect(diff).toBeGreaterThanOrEqual(__TESTING__.DISMISSAL_WINDOW_MS - 200);
    expect(diff).toBeLessThanOrEqual(__TESTING__.DISMISSAL_WINDOW_MS + 200);
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBe(String(s.dismissedUntil));
  });

  test('accepted outcome does NOT record dismissal', async () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent('accepted');
    captureBeforeInstallPrompt(evt);
    const result = await triggerInstall();
    expect(result.outcome).toBe('accepted');
    const s = get(installSignal);
    expect(s.surface).toBe('hidden');
    expect(s.deferredPrompt).toBeNull();
    expect(s.dismissedUntil).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBeNull();
  });

  test('triggerInstall with no deferred prompt throws', async () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    await expect(triggerInstall()).rejects.toThrow();
  });

  test('triggerInstall is one-shot — second call throws', async () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent('accepted'));
    await triggerInstall();
    await expect(triggerInstall()).rejects.toThrow();
  });
});

describe('installSignal — recordDismissal', () => {
  test('writes localStorage and hides surface', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    const before = Date.now();
    recordDismissal();
    const s = get(installSignal);
    expect(s.surface).toBe('hidden');
    expect(s.dismissedUntil).not.toBeNull();
    const diff = (s.dismissedUntil ?? 0) - before;
    expect(diff).toBeGreaterThanOrEqual(__TESTING__.DISMISSAL_WINDOW_MS - 200);
    expect(diff).toBeLessThanOrEqual(__TESTING__.DISMISSAL_WINDOW_MS + 200);
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).toBe(String(s.dismissedUntil));
  });
});

describe('installSignal — markInstalled', () => {
  test('sets installed/surface/deferredPrompt; leaves dismissedUntil untouched', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    const before = get(installSignal).dismissedUntil;
    markInstalled();
    const s = get(installSignal);
    expect(s.installed).toBe(true);
    expect(s.surface).toBe('hidden');
    expect(s.deferredPrompt).toBeNull();
    expect(s.dismissedUntil).toBe(before);
  });
});

describe('installSignal — bootstrap respects past/future dismissal', () => {
  test('past dismissedUntil is ignored on boot — surface re-arms (FR-014)', () => {
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(Date.now() - 1_000_000));
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const s = get(installSignal);
    expect(s.dismissedUntil).toBeNull();
    expect(s.surface).toBe('unsupported');
  });
});

describe('installSignal — magic constants', () => {
  test('__TESTING__.DISMISSAL_WINDOW_MS === 30 * 24 * 60 * 60 * 1000', () => {
    expect(__TESTING__.DISMISSAL_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
