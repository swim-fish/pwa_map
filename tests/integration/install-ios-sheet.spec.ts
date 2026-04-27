import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import InstallIosSheet from '../../src/components/InstallIosSheet.svelte';
import { installSignal, __resetForTests } from '../../src/pwa/installSignal';
import { __INSTALL_DISMISSED_KEY } from '../../src/storage/installDismissed';
import { setLocale } from '../../src/i18n/index';

const UA_IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

let host: HTMLElement;
let cmp: { $destroy: () => void };

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
  cmp?.$destroy?.();
});

function mount(): void {
  const Component = InstallIosSheet as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: {} });
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

describe('InstallIosSheet — feature 005 US2', () => {
  test('1. ios-safari surface renders sheet with three steps + share-icon (en)', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    const sheet = $('install-ios-sheet')!;
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('data-variant')).toBe('safari');
    expect(sheet.textContent).toContain("Tap the Share button in Safari's toolbar");
    expect(sheet.textContent).toContain('Scroll down and tap "Add to Home Screen"');
    expect(sheet.textContent).toContain('Tap "Add" to launch this app from your Home Screen');
    expect($('install-ios-sheet-share-icon')).not.toBeNull();
    const share = $('install-ios-sheet-share-icon')!;
    expect(share.getAttribute('aria-label')).toBe('Share icon');
  });

  test('2. ios-safari sheet renders localised text in zh and ja', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    setLocale('zh');
    await tick();
    expect($('install-ios-sheet')!.textContent).toContain('點選 Safari 工具列上的「分享」按鈕');
    setLocale('ja');
    await tick();
    expect($('install-ios-sheet')!.textContent).toContain('Safari ツールバーの共有ボタンをタップ');
  });

  test('3. ios-other surface renders read-only hint, no step list', async () => {
    stubEnv(UA_IOS_CHROME, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    const sheet = $('install-ios-sheet')!;
    expect(sheet).not.toBeNull();
    expect(sheet.getAttribute('data-variant')).toBe('other');
    expect(sheet.textContent).toContain('Open this page in Safari to install');
    expect($('install-ios-sheet-share-icon')).toBeNull();
  });

  test('4. standalone surface renders nothing (DOM-absence)', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: true });
    __resetForTests();
    mount();
    await flush();
    expect($('install-ios-sheet')).toBeNull();
  });

  test('5. android-chromium surface renders nothing', async () => {
    stubEnv(UA_ANDROID);
    __resetForTests();
    mount();
    await flush();
    expect($('install-ios-sheet')).toBeNull();
  });

  test('6. dismiss click writes installDismissedUntil and unmounts', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    const before = Date.now();
    ($('install-ios-sheet-dismiss') as HTMLButtonElement).click();
    await flush();
    expect($('install-ios-sheet')).toBeNull();
    expect(get(installSignal).surface).toBe('hidden');
    const stored = Number(localStorage.getItem(__INSTALL_DISMISSED_KEY));
    const diff = stored - before;
    expect(diff).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000 - 1000);
    expect(diff).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
  });

  test('7. Escape key dismisses', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect($('install-ios-sheet')).toBeNull();
    expect(localStorage.getItem(__INSTALL_DISMISSED_KEY)).not.toBeNull();
  });

  test('8. dismiss button is real <button type="button">', async () => {
    stubEnv(UA_IOS_SAFARI, { standalone: false });
    __resetForTests();
    mount();
    await tick();
    const btn = $('install-ios-sheet-dismiss') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });
});
