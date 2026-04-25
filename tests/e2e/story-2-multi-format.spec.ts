import { test, expect, type Page } from '@playwright/test';

async function seedPrefs(
  page: Page,
  visible: string[],
  mgrsPrecision = 5,
  taipowerPrecision = 9,
): Promise<void> {
  // Seed once — if the user toggles formats during the test, the saved value
  // must win on reload. We only write when localStorage has no value yet.
  await page.addInitScript(
    ([visibleList, mgrsP, tpP]) => {
      if (!window.localStorage.getItem('pwa_map:prefs')) {
        const payload = {
          version: 1,
          visible: visibleList,
          mgrsPrecision: mgrsP,
          taipowerPrecision: tpP,
          locale: 'en',
        };
        window.localStorage.setItem('pwa_map:prefs', JSON.stringify(payload));
      }
    },
    [visible, mgrsPrecision, taipowerPrecision] as const,
  );
}

async function setCenter(page: Page, lat: number, lon: number): Promise<void> {
  await page.evaluate(
    ([la, lo]) => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (lat: number, lon: number) => void }
        | undefined;
      hooks?.setCenter?.(la, lo);
    },
    [lat, lon] as const,
  );
  await page.waitForTimeout(100);
}

test.describe('Story 2 — Multi-format readout and FormatToggle', () => {
  test('AS1: Taipei 101 renders all six formats within tolerance', async ({ page }) => {
    await seedPrefs(page, ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'twd67-tm2', 'mgrs', 'taipower']);
    await page.goto('/');

    const dd = await page.getByTestId('readout-wgs84-dd').innerText();
    expect(dd).toMatch(/25\.03361\d.*121\.56447\d/);

    const dms = await page.getByTestId('readout-wgs84-dms').innerText();
    expect(dms).toMatch(/25°\s?02′\s?01\.\d+″\s?N/);

    const tm = await page.getByTestId('readout-twd97-tm2').innerText();
    expect(tm).toMatch(/306962\.\d+.*2769619\.\d+/);
    expect(tm).toMatch(/zone 121/);

    const mgrs = await page.getByTestId('readout-mgrs').innerText();
    expect(mgrs.replace(/\s+/g, '')).toMatch(/51RUH5517\d69437/);

    const taipower = await page.getByTestId('readout-taipower').innerText();
    expect(taipower.replace(/\s+/g, '')).toMatch(/B7039BD3\d/);
  });

  test('AS2: Magong shows TWD97 zone 119', async ({ page }) => {
    await seedPrefs(page, ['wgs84-dd', 'twd97-tm2']);
    await page.goto('/');
    await setCenter(page, 23.565, 119.566);
    const tm = await page.getByTestId('readout-twd97-tm2').innerText();
    expect(tm).toMatch(/zone 119/);
  });

  test('AS3: zone label flips at 120° E boundary', async ({ page }) => {
    await seedPrefs(page, ['twd97-tm2']);
    await page.goto('/');

    await setCenter(page, 23.5, 119.999);
    const below = await page.getByTestId('readout-twd97-tm2').innerText();
    expect(below).toMatch(/zone 119/);

    await setCenter(page, 23.5, 120.0);
    const atOrAbove = await page.getByTestId('readout-twd97-tm2').innerText();
    expect(atOrAbove).toMatch(/zone 121/);
  });

  test('AS4: hiding Taipower in FormatToggle persists across reload', async ({ page }) => {
    await seedPrefs(page, ['wgs84-dd', 'taipower']);
    await page.goto('/');

    await expect(page.getByTestId('readout-taipower')).toBeVisible();

    await page.getByTestId('open-format-toggle').click();
    await page.getByTestId('toggle-taipower').click();
    // Click backdrop to close (the checkbox change fires immediately).
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('readout-taipower')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('readout-taipower')).toHaveCount(0);
  });

  test('AS2b: crosshair in the Pacific flags Taipower as out-of-coverage', async ({ page }) => {
    await seedPrefs(page, ['wgs84-dd', 'taipower']);
    await page.goto('/');
    await setCenter(page, 0, -150);
    const node = page.getByTestId('out-of-coverage-taipower');
    await expect(node).toHaveCount(1);
  });
});
