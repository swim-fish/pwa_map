import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import InstallBanner from '../../src/components/InstallBanner.svelte';
import InstallIosSheet from '../../src/components/InstallIosSheet.svelte';
import {
  captureBeforeInstallPrompt,
  markInstalled,
  __resetForTests,
  type BeforeInstallPromptEvent,
} from '../../src/pwa/installSignal';
import { __INSTALL_DISMISSED_KEY } from '../../src/storage/installDismissed';
import { setLocale } from '../../src/i18n/index';

const UA = {
  ANDROID:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  IOS_SAFARI:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  DESKTOP:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

let host: HTMLElement;
const mounted: { $destroy: () => void }[] = [];

function stubEnv(
  userAgent: string,
  opts: { standalone?: boolean; standaloneDisplayMode?: boolean } = {},
): void {
  const factory = (q: string): MediaQueryList =>
    ({
      matches: q.includes('prefers-reduced-motion') ? true : (opts.standaloneDisplayMode ?? false),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  vi.stubGlobal('navigator', { userAgent, standalone: opts.standalone });
  vi.stubGlobal('matchMedia', vi.fn(factory));
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(factory),
    });
  }
}

function mountBoth(): void {
  const Banner = InstallBanner as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => { $destroy: () => void };
  const Sheet = InstallIosSheet as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => { $destroy: () => void };
  mounted.push(new Banner({ target: host, props: {} }));
  mounted.push(new Sheet({ target: host, props: {} }));
}

function makeEvent(): BeforeInstallPromptEvent {
  const evt = new Event('beforeinstallprompt') as unknown as BeforeInstallPromptEvent & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  evt.prompt = vi.fn(async () => undefined);
  evt.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  return evt as BeforeInstallPromptEvent;
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await tick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom safety */
  }
  vi.unstubAllGlobals();
  stubEnv('');
  __resetForTests();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  while (mounted.length > 0) {
    const cmp = mounted.pop();
    cmp?.$destroy();
  }
});

describe('Install affordance suppression — feature 005 US3', () => {
  test.each([UA.ANDROID, UA.IOS_SAFARI, UA.DESKTOP])(
    'standalone via matchMedia → both surfaces absent on %s',
    async (ua) => {
      stubEnv(ua, { standaloneDisplayMode: true });
      __resetForTests();
      mountBoth();
      await flush();
      expect($('install-banner')).toBeNull();
      expect($('install-ios-sheet')).toBeNull();
    },
  );

  test('standalone via navigator.standalone (iOS convention) → both surfaces absent', async () => {
    stubEnv(UA.IOS_SAFARI, { standalone: true });
    __resetForTests();
    mountBoth();
    await flush();
    expect($('install-banner')).toBeNull();
    expect($('install-ios-sheet')).toBeNull();
  });

  test('future dismissedUntil → banner suppressed even with captured event', async () => {
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(Date.now() + 1_000_000));
    stubEnv(UA.ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mountBoth();
    await flush();
    expect($('install-banner')).toBeNull();
    expect($('install-ios-sheet')).toBeNull();
  });

  test('past dismissedUntil → re-armed; banner renders after capture', async () => {
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(Date.now() - 1_000_000));
    stubEnv(UA.ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mountBoth();
    await tick();
    expect($('install-banner')).not.toBeNull();
  });

  test('markInstalled() → banner unmounts', async () => {
    stubEnv(UA.ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mountBoth();
    await tick();
    expect($('install-banner')).not.toBeNull();
    markInstalled();
    await flush();
    expect($('install-banner')).toBeNull();
  });
});
