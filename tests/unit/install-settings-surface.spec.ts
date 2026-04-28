import { describe, test, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  installSignal,
  captureBeforeInstallPrompt,
  recordDismissal,
  markInstalled,
  __resetForTests,
  __TESTING__,
  type BeforeInstallPromptEvent,
} from '../../src/pwa/installSignal';
import { installSettingsSurface } from '../../src/pwa/installSettingsSurface';
import { __INSTALL_DISMISSED_KEY } from '../../src/storage/installDismissed';

// Feature 011 — derived store invariants S1..S10 from
// contracts/install-settings-surface.md §3.

const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_DESKTOP_FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
const UA_IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1';

function stubNavigator(userAgent: string, standalone: boolean | undefined = undefined): void {
  vi.stubGlobal('navigator', { userAgent, standalone });
}

function stubMatchMedia(matches: boolean): void {
  const fn = vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('matchMedia', fn);
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: fn,
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

describe('feature 011 — installSettingsSurface (derived store)', () => {
  test('S1 — installSignal.installed === true ⇒ "standalone"', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    markInstalled();
    expect(get(installSignal).installed).toBe(true);
    expect(get(installSettingsSurface)).toBe('standalone');
  });

  test('S2 — matchMedia(display-mode: standalone) ⇒ "standalone"', () => {
    stubNavigator(UA_ANDROID);
    stubMatchMedia(true);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('standalone');
  });

  test('S3 — iOS Chrome (CriOS) ⇒ "ios-other"', () => {
    stubNavigator(UA_IOS_CHROME);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('ios-other');
  });

  test('S4 — iOS Safari ⇒ "ios-safari"', () => {
    stubNavigator(UA_IOS_SAFARI, false);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('ios-safari');
  });

  test('S5 — Android + captured prompt ⇒ "android-chromium"', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    expect(get(installSettingsSurface)).toBe('android-chromium');
  });

  test('S6 — Desktop Chrome + captured prompt ⇒ "desktop-chromium"', () => {
    stubNavigator(UA_DESKTOP_CHROME);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    expect(get(installSettingsSurface)).toBe('desktop-chromium');
  });

  test('S7 — Desktop Firefox without captured prompt ⇒ "unsupported"', () => {
    stubNavigator(UA_DESKTOP_FIREFOX);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('unsupported');
  });

  test('S7 — Desktop Chrome without captured prompt ⇒ "unsupported"', () => {
    stubNavigator(UA_DESKTOP_CHROME);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('unsupported');
  });

  test('S8 — 30-day banner dismissal does NOT change derived value (FR-015)', () => {
    // Pre-write a future dismissal so installSignal boots into the
    // 'hidden' branch, then capture an Android prompt. The transient
    // banner sees 'hidden'; the Settings entry MUST still see
    // 'android-chromium'.
    const future = Date.now() + __TESTING__.DISMISSAL_WINDOW_MS;
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(future));
    stubNavigator(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent();
    captureBeforeInstallPrompt(evt);
    expect(get(installSignal).surface).toBe('hidden');
    expect(get(installSettingsSurface)).toBe('android-chromium');
  });

  test('S8 — recordDismissal() while iOS Safari does NOT flip to "unsupported"', () => {
    stubNavigator(UA_IOS_SAFARI, false);
    __resetForTests();
    expect(get(installSettingsSurface)).toBe('ios-safari');
    recordDismissal();
    // installSignal.surface is now 'hidden', but the Settings derived
    // store MUST still report 'ios-safari'.
    expect(get(installSignal).surface).toBe('hidden');
    expect(get(installSettingsSurface)).toBe('ios-safari');
  });

  test('S9 — markInstalled flips derived value to "standalone" without a fresh boot', () => {
    stubNavigator(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    expect(get(installSettingsSurface)).toBe('android-chromium');
    markInstalled();
    expect(get(installSettingsSurface)).toBe('standalone');
  });

  test('S10 — derived value is one of the six visible literals (never "hidden")', () => {
    // Drive a representative subset of the state matrix and assert the
    // returned literal is from the closed enum.
    const allowed = new Set([
      'android-chromium',
      'desktop-chromium',
      'ios-safari',
      'ios-other',
      'standalone',
      'unsupported',
    ]);
    const cases: Array<{ ua: string; standalone?: boolean; capture?: boolean }> = [
      { ua: UA_ANDROID, capture: true },
      { ua: UA_ANDROID },
      { ua: UA_DESKTOP_CHROME, capture: true },
      { ua: UA_DESKTOP_FIREFOX },
      { ua: UA_IOS_SAFARI, standalone: false },
      { ua: UA_IOS_CHROME },
      { ua: UA_ANDROID, standalone: true },
    ];
    for (const c of cases) {
      stubNavigator(c.ua, c.standalone);
      stubMatchMedia(c.standalone === true);
      __resetForTests();
      if (c.capture) captureBeforeInstallPrompt(makeEvent());
      const v = get(installSettingsSurface);
      expect(allowed.has(v), `unexpected literal ${v} for ${JSON.stringify(c)}`).toBe(true);
    }
  });
});
