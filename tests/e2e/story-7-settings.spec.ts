import { test, expect } from '@playwright/test';

const PREFS_KEY = 'pwa_map:prefs';

test.describe('US1 settings sheet — open + clear-all', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('open shows three rows + licence notice + quota line', async ({ page }) => {
    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-sheet')).toBeVisible({ timeout: 5_000 });

    // The licence notice contains the localised "短暫離線" / "short-term offline"
    // / "短時間" substring per the active locale (default zh).
    const licenceText = await page.getByTestId('settings-licence').textContent();
    expect(licenceText ?? '').toMatch(/短暫離線|short-term offline|短時間|オフライン/);

    // Three rows in OSM / NLSC / Google order.
    const rows = page.locator('[data-testid^="settings-cache-row-"][data-testid$="-tiles"]');
    await expect(rows.nth(0)).toHaveAttribute('data-testid', 'settings-cache-row-osm-tiles');
    await expect(rows.nth(1)).toHaveAttribute('data-testid', 'settings-cache-row-nlsc-tiles');
    await expect(rows.nth(2)).toHaveAttribute('data-testid', 'settings-cache-row-google-tiles');

    // Quota line begins with ≈ when storage.estimate is available, OR a "—"
    // fallback if not.
    const quotaText = (await page.getByTestId('settings-quota').textContent()) ?? '';
    expect(quotaText.length).toBeGreaterThan(0);
    expect(quotaText).toMatch(/≈|—/);
  });

  test('clear-all path: open → clear-all → confirm → status banner appears', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-sheet')).toBeVisible();
    await page.getByTestId('settings-clear-all').click();
    await expect(page.getByTestId('settings-confirm-dialog')).toBeVisible();
    await page.getByTestId('settings-confirm-ok').click();
    await expect(page.getByTestId('settings-status')).toBeVisible({ timeout: 5_000 });

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

test.describe('US3 TTL persists across reload', () => {
  test('change TTL → reload → still set', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.getByTestId('settings-toolbar-button').click();
    await page.getByTestId('settings-ttl').selectOption('30');
    // Wait for the change handler to settle.
    await expect(page.getByTestId('settings-status')).toBeVisible({ timeout: 5_000 });

    const persistedBefore = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
    expect(persistedBefore).not.toBeNull();
    expect(JSON.parse(persistedBefore as string).tileTtlDays).toBe(30);

    await page.reload();
    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-ttl')).toHaveValue('30');
  });
});

test.describe('US4 MaxEntries persists across reload', () => {
  test('change MaxEntries → reload → still set', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.getByTestId('settings-toolbar-button').click();
    await page.getByTestId('settings-max-entries').selectOption('1024');
    await expect(page.getByTestId('settings-status')).toBeVisible({ timeout: 5_000 });

    const persistedBefore = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
    expect(persistedBefore).not.toBeNull();
    expect(JSON.parse(persistedBefore as string).tileMaxEntries).toBe(1024);

    await page.reload();
    await page.getByTestId('settings-toolbar-button').click();
    await expect(page.getByTestId('settings-max-entries')).toHaveValue('1024');
  });
});
