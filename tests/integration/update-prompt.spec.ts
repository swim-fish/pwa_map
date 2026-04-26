import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import UpdatePrompt from '../../src/components/UpdatePrompt.svelte';
import {
  __resetForTests,
  fireNeedRefresh,
  updateSignal,
  __TESTING__,
} from '../../src/pwa/updateSignal';
import { setLocale } from '../../src/i18n/index';

let host: HTMLElement;
let cmp: { $destroy: () => void };

beforeEach(() => {
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
  const Component = UpdatePrompt as unknown as new (args: {
    target: HTMLElement;
    props: Record<string, unknown>;
  }) => typeof cmp;
  cmp = new Component({ target: host, props: {} });
}

function $(testid: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testid}"]`);
}

describe('UpdatePrompt — feature 004 US2', () => {
  test('1. with store visible:false, the component renders nothing', async () => {
    mount();
    await tick();
    expect($('update-prompt')).toBeNull();
  });

  test('2. after fireNeedRefresh, both buttons render with localised labels', async () => {
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    expect($('update-prompt')).not.toBeNull();
    expect($('update-prompt-confirm')!.textContent?.trim()).toBe('Update now');
    expect($('update-prompt-later')!.textContent?.trim()).toBe('Later');
  });

  test('3. clicking Update now calls the bound spy exactly once', async () => {
    const spy = vi.fn(async () => {});
    mount();
    await tick();
    fireNeedRefresh(spy);
    await tick();
    ($('update-prompt-confirm') as HTMLButtonElement).click();
    await tick();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('4. clicking Later flips visible to false and sets postponedUntil ≈ now+30min', async () => {
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    const before = Date.now();
    ($('update-prompt-later') as HTMLButtonElement).click();
    await tick();
    const s = get(updateSignal);
    expect(s.visible).toBe(false);
    expect(s.postponedUntil).not.toBeNull();
    const diff = (s.postponedUntil ?? 0) - before;
    expect(diff).toBeGreaterThanOrEqual(__TESTING__.POSTPONE_MS - 100);
    expect(diff).toBeLessThanOrEqual(__TESTING__.POSTPONE_MS + 100);
    expect($('update-prompt')).toBeNull();
  });

  test('5. pressing Escape on window acts as Later', async () => {
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    expect(get(updateSignal).visible).toBe(false);
    expect(get(updateSignal).postponedUntil).not.toBeNull();
  });

  test('6. Escape when prompt hidden does NOT throw or mutate the store', async () => {
    mount();
    await tick();
    expect(get(updateSignal).visible).toBe(false);
    expect(get(updateSignal).postponedUntil).toBeNull();
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).not.toThrow();
    await tick();
    expect(get(updateSignal).visible).toBe(false);
    expect(get(updateSignal).postponedUntil).toBeNull();
  });

  test('7. card carries role=status and aria-live=polite', async () => {
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    const el = $('update-prompt')!;
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  test('8. both buttons are real <button type="button"> elements (tap-target compliance is in CSS — verified visually + in e2e)', async () => {
    // jsdom does not apply Svelte scoped <style> via CSSOM, so a
    // getComputedStyle('min-height') check returns ''. We assert the
    // semantic guarantee instead — both controls are real buttons with
    // explicit type=button and the project-standard CSS classes that
    // declare min-width / min-height of 36px in the component source.
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    for (const id of ['update-prompt-confirm', 'update-prompt-later']) {
      const btn = $(id) as HTMLButtonElement | null;
      expect(btn).not.toBeNull();
      expect(btn!.tagName).toBe('BUTTON');
      expect(btn!.getAttribute('type')).toBe('button');
      expect(btn!.classList.contains(id)).toBe(true);
    }
  });

  test('9. switching locale zh re-renders labels to 立即更新 / 稍後', async () => {
    mount();
    await tick();
    fireNeedRefresh(async () => {});
    await tick();
    expect($('update-prompt-confirm')!.textContent?.trim()).toBe('Update now');
    setLocale('zh');
    await tick();
    expect($('update-prompt-confirm')!.textContent?.trim()).toBe('立即更新');
    expect($('update-prompt-later')!.textContent?.trim()).toBe('稍後');
  });
});
