import { test, expect, type Page } from '@playwright/test';

async function seedPrefs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('pwa_map:prefs')) {
      window.localStorage.setItem(
        'pwa_map:prefs',
        JSON.stringify({
          version: 1,
          visible: ['wgs84-dd', 'twd97-tm2', 'mgrs'],
          mgrsPrecision: 5,
          taipowerPrecision: 9,
          locale: 'en',
        }),
      );
    }
  });
}

async function openGoTo(page: Page): Promise<void> {
  await page.getByTestId('open-goto').click();
  await expect(page.getByTestId('goto-dialog')).toBeVisible();
}

async function submitGoTo(page: Page, value: string): Promise<void> {
  const textarea = page.getByTestId('goto-input');
  await textarea.fill(value);
  await page.getByTestId('goto-submit').click();
}

test.describe('Story 3 — Go To control', () => {
  test('AS1 (SC-003): DD input pans the map within 1 s and readout re-reports', async ({
    page,
  }) => {
    await seedPrefs(page);
    await page.goto('/');
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (a: number, b: number) => void }
        | undefined;
      hooks?.setCenter?.(0, 0);
    });
    await openGoTo(page);
    const t0 = Date.now();
    await submitGoTo(page, '25.033611, 121.564472');
    await expect(page.getByTestId('goto-dialog')).toHaveCount(0);
    await expect(page.getByTestId('readout-dd')).toContainText(/25\.033\d+.*121\.564\d+/, {
      timeout: 1000,
    });
    const elapsed = Date.now() - t0;
    expect(elapsed, `Go To → readout update must be ≤ 1 s (SC-003); got ${elapsed}ms`).toBeLessThan(
      1000,
    );
  });

  test('AS2: MGRS input lands on Taipei 101', async ({ page }) => {
    await seedPrefs(page);
    await page.goto('/');
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (a: number, b: number) => void }
        | undefined;
      hooks?.setCenter?.(0, 0);
    });
    await openGoTo(page);
    await submitGoTo(page, '51R UH 55170 69437');
    await page.waitForTimeout(900);
    const dd = await page.getByTestId('readout-dd').innerText();
    expect(dd).toMatch(/25\.03\d+.*121\.56\d+/);
  });

  test('AS3 (SC-004): invalid DMS → error within 500 ms; map does not move', async ({ page }) => {
    await seedPrefs(page);
    await page.goto('/');
    const before = await page.getByTestId('readout-dd').innerText();
    await openGoTo(page);
    // Pre-fill so the timer captures only the submission → error latency.
    await page.getByTestId('goto-input').fill('25°60′00.0″ N, 121°00′00.0″ E');
    const t0 = Date.now();
    await page.getByTestId('goto-submit').click();
    await expect(page.getByTestId('goto-error')).toBeVisible({ timeout: 500 });
    const elapsed = Date.now() - t0;
    expect(elapsed, `rejection surface must be ≤ 500 ms (SC-004); got ${elapsed}ms`).toBeLessThan(
      500,
    );
    await expect(page.getByTestId('goto-error')).toContainText(/0 to 59|0-59/);
    await expect(page.getByTestId('goto-dialog')).toBeVisible();
    const after = await page.getByTestId('readout-dd').innerText();
    expect(after).toBe(before);
  });

  test('AS4: Penghu Taipower (Y letter) rejected as out-of-coverage', async ({ page }) => {
    await seedPrefs(page);
    await page.goto('/');
    await openGoTo(page);
    await submitGoTo(page, 'Y1234 AB56');
    await expect(page.getByTestId('goto-error')).toBeVisible();
    await expect(page.getByTestId('goto-error')).toContainText(/outer-island|MVP|coverage|離島/i);
  });

  test('AS5: TM2 zone-inferred pair lands and shows zone toast', async ({ page }) => {
    await seedPrefs(page);
    await page.goto('/');
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (a: number, b: number) => void }
        | undefined;
      hooks?.setCenter?.(0, 0);
    });
    await openGoTo(page);
    await submitGoTo(page, '306962.887, 2769619.124');
    await page.waitForTimeout(900);
    await expect(page.getByTestId('zone-toast')).toBeVisible();
    await expect(page.getByTestId('zone-toast')).toContainText(/121/);
  });
});
