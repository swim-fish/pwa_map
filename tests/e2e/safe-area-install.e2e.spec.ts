import { test, expect } from '@playwright/test';

// Feature 011 — end-to-end exercise of the Settings install section
// for the Chromium install path (FR-009 / FR-010 / FR-017 / FR-018 /
// SC-005 / SC-008 / SC-010).
//
// Per playwright.config.ts the project ships chromium / firefox /
// webkit Desktop profiles. The Chromium-flavoured install path is the
// only branch that fires `beforeinstallprompt` synthetically via the
// existing __pwaTestHooks (feature 005); iOS Safari and the manual
// safe-area geometry verification are deferred to real-device manual
// testing per quickstart.md §1 / §2.

const DISMISSAL_KEY = 'pwa_map:installDismissedUntil';

test.describe('feature 011 — Settings install section (Chromium path)', () => {
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

  test('after captureBeforeInstallPrompt, opening Settings shows the install button', async ({
    page,
  }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-install-section')).toBeVisible();
    await expect(page.getByTestId('settings-install-confirm')).toBeVisible();
    await expect(page.getByTestId('settings-install-confirm')).toBeEnabled();
  });

  test('clicking the Settings install button drives the prompt and propagates installed state', async ({
    page,
  }) => {
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    await page.getByTestId('settings-toolbar-button').click();
    await page.getByTestId('settings-install-confirm').click();
    // The install prompt's accept path triggers appinstalled via the
    // production listener; in this synthetic test the userChoice
    // resolves accepted and triggerInstall() clears the deferred prompt.
    // Fire the appinstalled hook to mirror the real OS event so the
    // section flips to "already installed".
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerAppInstalled: () => void };
        }
      ).__pwaTestHooks.triggerAppInstalled();
    });
    await expect(page.getByTestId('settings-install-already-installed')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId('settings-install-confirm')).toBeHidden();
  });

  test('30-day banner dismissal does NOT suppress the Settings entry (FR-015)', async ({
    page,
  }) => {
    await page.evaluate((key) => {
      const future = Date.now() + 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(key, String(future));
    }, DISMISSAL_KEY);
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof (
          window as unknown as {
            __pwaTestHooks: { triggerBeforeInstallPrompt?: unknown };
          }
        ).__pwaTestHooks?.triggerBeforeInstallPrompt === 'function',
    );
    await page.evaluate(() => {
      (
        window as unknown as {
          __pwaTestHooks: { triggerBeforeInstallPrompt: (opts?: { outcome?: string }) => void };
        }
      ).__pwaTestHooks.triggerBeforeInstallPrompt({ outcome: 'accepted' });
    });
    // The transient banner is suppressed by the 30-day window — it MUST NOT show.
    await expect(page.getByTestId('install-banner')).toBeHidden();
    // The Settings install entry MUST still be available.
    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-install-section')).toBeVisible();
    await expect(page.getByTestId('settings-install-confirm')).toBeEnabled();
  });
});

test.describe('feature 011 — Settings sheet rect respects window viewport (FR-008)', () => {
  test('on a narrow viewport (mobile-emulated), the Settings sheet stays inside the visual viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await page.getByTestId('settings-toolbar-button').click();
    const sheet = await page.getByTestId('settings-sheet').boundingBox();
    expect(sheet).not.toBeNull();
    if (!sheet) return;
    expect(sheet.x).toBeGreaterThanOrEqual(0);
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(sheet.x + sheet.width).toBeLessThanOrEqual(360);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(640);
  });
});
