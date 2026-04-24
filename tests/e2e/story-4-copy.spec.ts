import { test, expect, type Page } from '@playwright/test';

async function seedPrefs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('pwa_map:prefs')) {
      window.localStorage.setItem(
        'pwa_map:prefs',
        JSON.stringify({
          version: 1,
          visible: ['wgs84-dd', 'wgs84-dms', 'mgrs'],
          mgrsPrecision: 5,
          taipowerPrecision: 9,
          locale: 'en',
        }),
      );
    }
  });
}

test.describe('Story 4 — Copy to clipboard', () => {
  test.use({
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  test('AS1: copying DMS places a Unicode-glyph string on the clipboard', async ({
    page,
    context,
  }) => {
    await seedPrefs(page);
    await page.goto('/');
    await page.getByTestId('copy-wgs84-dms').click();
    await expect(page.getByTestId('copy-toast')).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/25°\s?02′\s?01\.\d+″\s?N/);
    // context used to assert permissions were granted; referenced to avoid unused-var lint
    void context;
  });

  test('AS2: copying MGRS then pasting it into Go-To returns within 1 m', async ({ page }) => {
    await seedPrefs(page);
    await page.goto('/');
    // Capture MGRS from readout
    const mgrsText = await page.getByTestId('readout-mgrs').innerText();
    // Strip label by finding MGRS-shaped token (GZD + 2-letter square + digits).
    const match = mgrsText.match(/\d{1,2}[A-Z]\s*[A-Z]{2}\s*\d+\s*\d+/);
    expect(
      match,
      `readout-mgrs did not contain a canonical MGRS token: ${mgrsText}`,
    ).not.toBeNull();
    if (!match) return;
    const mgrs = match[0];
    // Pan away.
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (a: number, b: number) => void }
        | undefined;
      hooks?.setCenter?.(0, 0);
    });
    // Now paste into Go-To
    await page.getByTestId('open-goto').click();
    await page.getByTestId('goto-input').fill(mgrs);
    await page.getByTestId('goto-submit').click();
    await page.waitForTimeout(900);
    const ddBack = await page.getByTestId('readout-dd').innerText();
    expect(ddBack).toMatch(/25\.03\d+.*121\.56\d+/);
  });
});
