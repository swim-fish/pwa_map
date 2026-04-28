import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import SettingsSheet from '../../src/components/SettingsSheet.svelte';
import { setLocale } from '../../src/i18n/index';
import type { Locale } from '../../src/types/coord';
import {
  installSignal,
  captureBeforeInstallPrompt,
  markInstalled,
  recordDismissal,
  __resetForTests,
  __TESTING__,
  type BeforeInstallPromptEvent,
} from '../../src/pwa/installSignal';
import { __INSTALL_DISMISSED_KEY } from '../../src/storage/installDismissed';
import { createCacheStorageFake, type FakeCacheStorage } from '../unit/helpers/cacheStorageFake';

// Feature 011 — Settings install section integration contract
// (FR-009..FR-018, SC-005..SC-011 / data-model invariants C1..C6).

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

let host: HTMLElement;
let cmp: { $destroy: () => void };
let cachesFake: FakeCacheStorage;

function stubEnv(userAgent: string, standaloneDisplayMode = false): void {
  const factory = (q: string): MediaQueryList =>
    ({
      matches: q.includes('prefers-reduced-motion') ? true : standaloneDisplayMode,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList;
  vi.stubGlobal('navigator', {
    userAgent,
    storage: {
      estimate: async () => ({ usage: 1024 * 1024, quota: 100 * 1024 * 1024 }),
    },
  });
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
  cachesFake = createCacheStorageFake();
  vi.stubGlobal('caches', cachesFake);
  stubEnv('', false);
  __resetForTests();
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  cmp?.$destroy?.();
  vi.unstubAllGlobals();
});

function mount(): void {
  const Component = SettingsSheet as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: { open: true } });
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

describe('feature 011 — Settings install section render contract', () => {
  test('1. unsupported (desktop Firefox) → section is absent (FR-014 / data-model C1)', async () => {
    stubEnv(UA_DESKTOP_FIREFOX);
    __resetForTests();
    mount();
    await flush();
    expect($('settings-install-section')).toBeNull();
  });

  test('2. android-chromium + captured prompt → section visible, install button enabled', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    const btn = $('settings-install-confirm') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
    expect(btn!.textContent?.trim()).toBe('Install');
  });

  test('3. desktop-chromium + captured prompt → same as android-chromium', async () => {
    stubEnv(UA_DESKTOP_CHROME);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    const btn = $('settings-install-confirm') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
  });

  test('5. ios-safari → instructions trigger button present (no Chromium confirm)', async () => {
    stubEnv(UA_IOS_SAFARI, false);
    __resetForTests();
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    expect($('settings-install-show-ios-instructions')).not.toBeNull();
    expect($('settings-install-confirm')).toBeNull();
  });

  test('6. clicking iOS trigger opens the instructions dialog (FR-011)', async () => {
    stubEnv(UA_IOS_SAFARI, false);
    __resetForTests();
    mount();
    await flush();
    expect($('settings-install-ios-instructions-dialog')).toBeNull();
    ($('settings-install-show-ios-instructions') as HTMLElement).click();
    await flush();
    const dlg = $('settings-install-ios-instructions-dialog');
    expect(dlg).not.toBeNull();
    expect(dlg!.querySelectorAll('ol li').length).toBe(3);
  });

  test('7. clicking the instructions dialog close button closes the dialog', async () => {
    stubEnv(UA_IOS_SAFARI, false);
    __resetForTests();
    mount();
    await flush();
    ($('settings-install-show-ios-instructions') as HTMLElement).click();
    await flush();
    expect($('settings-install-ios-instructions-dialog')).not.toBeNull();
    ($('settings-install-ios-instructions-close') as HTMLElement).click();
    await flush();
    expect($('settings-install-ios-instructions-dialog')).toBeNull();
  });

  test('8. instructions dialog re-opens after close (FR-011 / data-model C4)', async () => {
    stubEnv(UA_IOS_SAFARI, false);
    __resetForTests();
    mount();
    await flush();
    for (let i = 0; i < 3; i++) {
      ($('settings-install-show-ios-instructions') as HTMLElement).click();
      await flush();
      expect($('settings-install-ios-instructions-dialog')).not.toBeNull();
      ($('settings-install-ios-instructions-close') as HTMLElement).click();
      await flush();
      expect($('settings-install-ios-instructions-dialog')).toBeNull();
    }
  });

  test('9. ios-other → hint paragraph present (FR-012)', async () => {
    stubEnv(UA_IOS_CHROME);
    __resetForTests();
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    const hint = $('settings-install-ios-other-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('Safari');
    expect($('settings-install-confirm')).toBeNull();
    expect($('settings-install-show-ios-instructions')).toBeNull();
  });

  test('10. standalone → already-installed status line (FR-013)', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    markInstalled();
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    const status = $('settings-install-already-installed');
    expect(status).not.toBeNull();
    expect(status!.textContent?.trim()).toBe('App is already installed');
    expect($('settings-install-confirm')).toBeNull();
    expect($('settings-install-show-ios-instructions')).toBeNull();
  });

  test('13. 30-day banner dismissal does NOT suppress the section (FR-015)', async () => {
    const future = Date.now() + __TESTING__.DISMISSAL_WINDOW_MS;
    localStorage.setItem(__INSTALL_DISMISSED_KEY, String(future));
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flush();
    expect($('settings-install-section')).not.toBeNull();
    const btn = $('settings-install-confirm') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(false);
  });

  test('14. locale parity — no untranslated keys leak (SC-011)', async () => {
    for (const locale of ['zh', 'en', 'ja'] as Locale[]) {
      // Each branch in turn; small cycle through visible literals.
      stubEnv(UA_ANDROID);
      __resetForTests();
      captureBeforeInstallPrompt(makeEvent());
      setLocale(locale);
      mount();
      await flush();
      const section = $('settings-install-section');
      expect(section).not.toBeNull();
      const text = section!.textContent ?? '';
      expect(text).not.toContain('pwa.install');
      expect(text).not.toContain('settings.install');
      cmp?.$destroy?.();
      document.body.innerHTML = '';
      host = document.createElement('div');
      document.body.appendChild(host);
    }
  });
});

describe('feature 011 — Settings install section reactive transitions (FR-018)', () => {
  test('11. markInstalled while sheet is open updates section to "already installed" (data-model C3)', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flush();
    expect($('settings-install-confirm')).not.toBeNull();
    markInstalled();
    await flush();
    expect($('settings-install-confirm')).toBeNull();
    expect($('settings-install-already-installed')).not.toBeNull();
  });

  test('12. user dismisses banner while sheet is open — section stays visible (FR-015)', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    captureBeforeInstallPrompt(makeEvent());
    mount();
    await flush();
    expect($('settings-install-confirm')).not.toBeNull();
    recordDismissal();
    await flush();
    // installSignal.surface flips to 'hidden' — but the Settings derived
    // store ignores the dismissal gate, so the section stays.
    expect(installSignal).toBeDefined(); // smoke
    expect($('settings-install-section')).not.toBeNull();
  });
});
