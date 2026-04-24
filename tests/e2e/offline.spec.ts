import { test, expect } from '@playwright/test';

// SC-006 — "After the first online load, the app remains usable (pan,
// read, Go To, copy) for 100% of the supported formats when the device
// is subsequently offline; only tile refresh fails."
//
// We run these in the chromium project only because Playwright's
// `context.setOffline(true)` needs serviceworker support and a real
// cache; webkit's headless SW behaviour is flakier.

test.describe('Offline behaviour (SC-006 + FR-012)', () => {
  test.describe.configure({ mode: 'serial' });

  test('coord math continues to work after setOffline(true)', async ({ page, context }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('pwa_map:prefs')) {
        window.localStorage.setItem(
          'pwa_map:prefs',
          JSON.stringify({
            version: 1,
            visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs', 'taipower'],
            mgrsPrecision: 5,
            taipowerPrecision: 9,
            locale: 'en',
          }),
        );
      }
    });

    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    // Give MapLibre + SW a moment to precache the shell.
    await page.waitForTimeout(500);

    // Sanity-check readouts render online.
    await expect(page.getByTestId('readout-wgs84-dd')).toBeVisible();
    await expect(page.getByTestId('readout-mgrs')).toBeVisible();

    // Flip offline.
    await context.setOffline(true);

    // Pan via the test hook (pure client-side; no network hit needed).
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter?: (lat: number, lon: number) => void }
        | undefined;
      hooks?.setCenter?.(23.565, 119.566);
    });
    await page.waitForTimeout(120);

    // WGS84 DD / MGRS / TWD97 are pure math — they must update offline.
    const tm = await page.getByTestId('readout-twd97-tm2').innerText();
    expect(tm).toMatch(/zone 119/);

    const dd = await page.getByTestId('readout-wgs84-dd').innerText();
    expect(dd).toMatch(/23\.56\d+.*119\.56\d+/);

    // Taipower: out-of-coverage for Magong (Penghu) — still renders the
    // localised "not in Taiwan coverage" label rather than crashing.
    await expect(page.getByTestId('out-of-coverage-taipower')).toHaveCount(1);
  });

  test('Go To parser works offline and map flies to the target', async ({ page, context }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('pwa_map:prefs')) {
        window.localStorage.setItem(
          'pwa_map:prefs',
          JSON.stringify({
            version: 1,
            visible: ['wgs84-dd', 'mgrs'],
            mgrsPrecision: 5,
            taipowerPrecision: 9,
            locale: 'en',
          }),
        );
      }
    });
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    await context.setOffline(true);

    await page.getByTestId('open-goto').click();
    await page.getByTestId('goto-input').fill('51R UH 55170 69437');
    await page.getByTestId('goto-submit').click();
    await page.waitForTimeout(900);

    const dd = await page.getByTestId('readout-dd').innerText();
    expect(dd).toMatch(/25\.03\d+.*121\.56\d+/);
  });
});
