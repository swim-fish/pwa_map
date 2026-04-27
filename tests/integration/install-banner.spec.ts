import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import InstallBanner from '../../src/components/InstallBanner.svelte';
import {
  installSignal,
  captureBeforeInstallPrompt,
  __resetForTests,
  type BeforeInstallPromptEvent,
} from '../../src/pwa/installSignal';
import { __INSTALL_DISMISSED_KEY } from '../../src/storage/installDismissed';
import { setLocale } from '../../src/i18n/index';

const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

let host: HTMLElement;
let cmp: { $destroy: () => void };

function stubEnv(userAgent: string, standaloneDisplayMode = false): void {
  const factory = (q: string): MediaQueryList =>
    ({
      matches: q.includes('prefers-reduced-motion') ? true : standaloneDisplayMode,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  vi.stubGlobal('navigator', { userAgent });
  vi.stubGlobal('matchMedia', vi.fn(factory));
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(factory),
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
  stubEnv('', false);
  __resetForTests();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(): void {
  const Component = InstallBanner as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: {} });
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

async function flushTransitions(): Promise<void> {
  // Svelte 4 fly transition (even with duration 0) requires a couple of
  // microtask + RAF turns to detach the element. tick() alone is not enough.
  for (let i = 0; i < 4; i++) {
    await tick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('InstallBanner — feature 005 US1', () => {
  test('1. android-chromium surface renders banner with both buttons (en)', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await tick();
    expect($('install-banner')).not.toBeNull();
    expect($('install-banner-confirm')!.textContent?.trim()).toBe('Install');
    expect($('install-banner-dismiss')!.textContent?.trim()).toBe('Not now');
  });

  test('2. desktop-chromium surface renders banner', async () => {
    stubEnv(UA_DESKTOP);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await tick();
    expect($('install-banner')).not.toBeNull();
  });

  test('3. standalone surface renders nothing (DOM-absence, FR-011)', async () => {
    stubEnv(UA_ANDROID, true);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flushTransitions();
    expect($('install-banner')).toBeNull();
  });

  test('4. hidden surface (after dismissal) renders nothing', async () => {
    const future = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(future));
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flushTransitions();
    expect($('install-banner')).toBeNull();
  });

  test('5. ios-safari surface renders nothing on the banner path', async () => {
    stubEnv(UA_IOS_SAFARI);
    __resetForTests();
    mount();
    await flushTransitions();
    expect($('install-banner')).toBeNull();
  });

  test('6. Install click with accepted outcome unmounts banner and calls prompt() once', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent('accepted');
    captureBeforeInstallPrompt(evt);
    mount();
    await tick();
    ($('install-banner-confirm') as HTMLButtonElement).click();
    await tick();
    await Promise.resolve();
    await Promise.resolve();
    await tick();
    expect((evt.prompt as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect($('install-banner')).toBeNull();
  });

  test('7. Install click with dismissed outcome writes installDismissedUntil', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    const evt = makeEvent('dismissed');
    captureBeforeInstallPrompt(evt);
    mount();
    await tick();
    ($('install-banner-confirm') as HTMLButtonElement).click();
    await tick();
    await Promise.resolve();
    await Promise.resolve();
    await flushTransitions();
    expect($('install-banner')).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).not.toBeNull();
  });

  test('8. Not-now click unmounts banner and writes localStorage', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await tick();
    ($('install-banner-dismiss') as HTMLButtonElement).click();
    await flushTransitions();
    expect($('install-banner')).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).not.toBeNull();
    expect(get(installSignal).surface).toBe('hidden');
  });

  test('9. Escape key acts as Not-now', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushTransitions();
    expect($('install-banner')).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).not.toBeNull();
  });

  test('10. Tap targets — both buttons are real <button type="button"> with class hooks', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await tick();
    for (const id of ['install-banner-confirm', 'install-banner-dismiss']) {
      const btn = $(id) as HTMLButtonElement | null;
      expect(btn).not.toBeNull();
      expect(btn!.tagName).toBe('BUTTON');
      expect(btn!.getAttribute('type')).toBe('button');
      expect(btn!.classList.contains(id)).toBe(true);
    }
  });
});
