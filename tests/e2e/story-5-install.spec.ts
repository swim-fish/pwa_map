import { test, expect } from '@playwright/test';

const DISMISSAL_KEY = 'pwa_map:installDismissedUntil';
const ONE_DAY = 24 * 60 * 60 * 1000;

test.describe('US1 install banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.waitForFunction(
      () =>
        typeof window !== 'undefined' &&
        typeof (window as unknown as { __pwaTestHooks?: Record<string, unknown> })
          .__pwaTestHooks !== 'undefined' &&
        typeof (
          window as unknown as {
            __pwaTestHooks: { triggerBeforeInstallPrompt?: unknown };
          }
        ).__pwaTestHooks.triggerBeforeInstallPrompt === 'function',
    );
  });

  test('synthetic beforeinstallprompt → banner appears within 5 s', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    await expect(page.getByTestId('install-banner')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('install-banner-confirm')).toBeVisible();
    await expect(page.getByTestId('install-banner-dismiss')).toBeVisible();
  });

  test('Install accept path unmounts banner', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    await expect(page.getByTestId('install-banner')).toBeVisible();
    await page.getByTestId('install-banner-confirm').click();
    await expect(page.getByTestId('install-banner')).toBeHidden({ timeout: 5_000 });
  });

  test('Not-now persists 30-day dismissal in localStorage (±5 s)', async ({ page }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    await expect(page.getByTestId('install-banner')).toBeVisible();
    const before = Date.now();
    await page.getByTestId('install-banner-dismiss').click();
    await expect(page.getByTestId('install-banner')).toBeHidden();
    const stored = await page.evaluate((k) => localStorage.getItem(k), DISMISSAL_KEY);
    expect(stored).not.toBeNull();
    const diff = Number(stored) - before;
    expect(diff).toBeGreaterThanOrEqual(30 * ONE_DAY - 5_000);
    expect(diff).toBeLessThanOrEqual(30 * ONE_DAY + 5_000);
  });
});
