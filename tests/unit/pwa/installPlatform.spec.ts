import { describe, test, expect } from 'vitest';
import { detectInstallSurface, type PlatformProbe } from '../../../src/pwa/installPlatform';

const UA = {
  ANDROID_CHROME:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  ANDROID_FIREFOX: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
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

function probe(overrides: Partial<PlatformProbe>): PlatformProbe {
  return {
    userAgent: '',
    standalone: undefined,
    standaloneDisplayMode: false,
    hasDeferredPrompt: false,
    ...overrides,
  };
}

describe('detectInstallSurface (feature 005 D3)', () => {
  test('Android Chrome with deferred prompt → android-chromium', () => {
    expect(
      detectInstallSurface(probe({ userAgent: UA.ANDROID_CHROME, hasDeferredPrompt: true })),
    ).toBe('android-chromium');
  });

  test('Android Chrome without deferred prompt → unsupported', () => {
    expect(
      detectInstallSurface(probe({ userAgent: UA.ANDROID_CHROME, hasDeferredPrompt: false })),
    ).toBe('unsupported');
  });

  test('Android Firefox → unsupported', () => {
    expect(
      detectInstallSurface(probe({ userAgent: UA.ANDROID_FIREFOX, hasDeferredPrompt: false })),
    ).toBe('unsupported');
  });

  test('iOS Safari, not standalone → ios-safari', () => {
    expect(
      detectInstallSurface(
        probe({ userAgent: UA.IOS_SAFARI, standalone: false, standaloneDisplayMode: false }),
      ),
    ).toBe('ios-safari');
  });

  test('iOS Safari, standalone via navigator.standalone → standalone', () => {
    expect(
      detectInstallSurface(
        probe({ userAgent: UA.IOS_SAFARI, standalone: true, standaloneDisplayMode: false }),
      ),
    ).toBe('standalone');
  });

  test('iOS Safari, standalone via matchMedia → standalone', () => {
    expect(
      detectInstallSurface(
        probe({ userAgent: UA.IOS_SAFARI, standalone: false, standaloneDisplayMode: true }),
      ),
    ).toBe('standalone');
  });

  test('iOS Chrome (CriOS) → ios-other', () => {
    expect(detectInstallSurface(probe({ userAgent: UA.IOS_CHROME }))).toBe('ios-other');
  });

  test('iOS Firefox (FxiOS) → ios-other', () => {
    expect(detectInstallSurface(probe({ userAgent: UA.IOS_FIREFOX }))).toBe('ios-other');
  });

  test('Desktop Chrome with deferred prompt → desktop-chromium', () => {
    expect(
      detectInstallSurface(probe({ userAgent: UA.DESKTOP_CHROME, hasDeferredPrompt: true })),
    ).toBe('desktop-chromium');
  });

  test('Desktop Chrome without deferred prompt → unsupported', () => {
    expect(
      detectInstallSurface(probe({ userAgent: UA.DESKTOP_CHROME, hasDeferredPrompt: false })),
    ).toBe('unsupported');
  });

  test('Desktop Firefox → unsupported', () => {
    expect(detectInstallSurface(probe({ userAgent: UA.DESKTOP_FIREFOX }))).toBe('unsupported');
  });

  test('standalone wins over Android-Chromium (regression guard)', () => {
    expect(
      detectInstallSurface(
        probe({
          userAgent: UA.ANDROID_CHROME,
          standaloneDisplayMode: true,
          hasDeferredPrompt: true,
        }),
      ),
    ).toBe('standalone');
  });

  test('empty UA + no prompt → unsupported', () => {
    expect(detectInstallSurface(probe({}))).toBe('unsupported');
  });
});
