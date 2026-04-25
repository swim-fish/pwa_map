import { test, expect, type Page } from '@playwright/test';

async function seedPrefs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('pwa_map:prefs')) {
      window.localStorage.setItem(
        'pwa_map:prefs',
        JSON.stringify({
          version: 1,
          visible: ['wgs84-dd', 'twd97-tm2', 'mgrs', 'taipower'],
          mgrsPrecision: 5,
          taipowerPrecision: 9,
          locale: 'zh',
          mapLayer: 'osm-standard',
          overlay: false,
        }),
      );
    }
  });
}

async function clearLayerPrefs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const flag = '__pwa_map_test_layer_cleared';
    try {
      if (!window.localStorage.getItem(flag)) {
        window.localStorage.removeItem('pwa_map:prefs');
        window.localStorage.setItem(flag, '1');
      }
    } catch {
      /* ignore */
    }
  });
}

async function openLayerPicker(page: Page): Promise<void> {
  await page.getByTestId('open-layers').click();
  await expect(page.getByTestId('layer-picker')).toBeVisible();
}

async function openLocalePicker(page: Page): Promise<void> {
  await page.getByTestId('open-locale').click();
  await expect(page.getByTestId('locale-picker')).toBeVisible();
}

test.describe('Story 3c — Layer picker (US1)', () => {
  test('US1.AS1: picker renders 6 basemaps + 1 overlay; default is OSM', async ({ page }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    await openLayerPicker(page);
    const rows = page.getByTestId('layer-row');
    await expect(rows).toHaveCount(6);
    await expect(page.getByTestId('layer-overlay')).toBeVisible();
    await expect(
      page.locator('[data-testid="layer-row"][data-layer-id="osm-standard"]'),
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('US1.AS2 + SC-001: switching to NLSC repaints + attribution updates ≤ 1.5 s', async ({
    page,
  }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    await openLayerPicker(page);
    const t0 = Date.now();
    await page.locator('[data-testid="layer-row"][data-layer-id="nlsc-emap5"]').click();
    await expect(page.getByTestId('layer-picker')).toHaveCount(0);
    await expect(page.getByTestId('attribution')).toContainText(/NLSC/, { timeout: 1500 });
    const elapsed = Date.now() - t0;
    expect(
      elapsed,
      `basemap swap to NLSC must be ≤ 1500 ms (SC-001); got ${elapsed}ms`,
    ).toBeLessThan(1500);
  });

  test('US1.AS3: toggling Google overlay adds it on top while picker stays open', async ({
    page,
  }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="google-satellite"]').click();
    // basemap pick closes the picker
    await expect(page.getByTestId('layer-picker')).toHaveCount(0);
    await openLayerPicker(page);
    await page.getByTestId('layer-overlay').click();
    // overlay toggle keeps the picker open
    await expect(page.getByTestId('layer-picker')).toBeVisible();
    await expect(page.getByTestId('layer-overlay')).toHaveAttribute('aria-checked', 'true');
  });

  test('US1.AS4: basemap + overlay choice survives reload', async ({ page }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    // Stub the Google tile endpoint so the failure-revert path can't fire in
    // sandboxed test environments where the public origin is unreachable.
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9d3yvncAAAAASUVORK5CYII=',
      'base64',
    );
    await page.route(/^https?:\/\/mt\d?\.google\.com\//, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: tinyPng,
      }),
    );
    await page.goto('/');
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="google-hybrid"]').click();
    await openLayerPicker(page);
    await page.getByTestId('layer-overlay').click();
    await page.waitForTimeout(150);
    await page.reload();
    await openLayerPicker(page);
    await expect(
      page.locator('[data-testid="layer-row"][data-layer-id="google-hybrid"]'),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('layer-overlay')).toHaveAttribute('aria-checked', 'true');
  });

  test('US1.AS5: Google labels stay in Traditional Chinese regardless of locale', async ({
    page,
  }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    // Verify the active style URL contains hl=zh-TW even if we flip to en.
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="google-roadmap"]').click();
    await openLocalePicker(page);
    await page.getByTestId('locale-row').filter({ hasText: 'English' }).click();
    // Sample any rendered tile request — it MUST still carry hl=zh-TW.
    const tileRequest = await page.waitForRequest(
      (req) => req.url().includes('mt1.google.com') && req.url().includes('lyrs=m'),
      { timeout: 4000 },
    );
    expect(tileRequest.url().includes('hl=zh-TW')).toBe(true);
  });

  test('FR-009: blocked tile origin → toast within 5 s + previous basemap visible', async ({
    page,
  }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    // Block NLSC origin.
    await page.route('**://wmts.nlsc.gov.tw/**', (route) => route.abort());
    await page.goto('/');
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="nlsc-emap5"]').click();
    await expect(page.getByTestId('layer-fail-toast')).toBeVisible({ timeout: 5000 });
    // After auto-revert, attribution returns to OSM.
    await expect(page.getByTestId('attribution')).toContainText(/OpenStreetMap/);
  });
});

test.describe('Story 3c — Locale picker (US2)', () => {
  test('US2.AS1 + SC-005: switching English flips UI within 200 ms with no flicker', async ({
    page,
  }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    // Wait for the toolbar button to render in zh.
    await expect(page.getByTestId('open-layers')).toContainText('圖層');
    await openLocalePicker(page);
    const t0 = Date.now();
    await page.getByTestId('locale-row').filter({ hasText: 'English' }).click();
    await expect(page.getByTestId('open-layers')).toContainText('Layers');
    const elapsed = Date.now() - t0;
    expect(elapsed, `locale flip must be ≤ 200 ms (SC-005); got ${elapsed}ms`).toBeLessThan(200);
  });

  test('US2.AS3: locale persists across reload', async ({ page }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    await openLocalePicker(page);
    await page.getByTestId('locale-row').filter({ hasText: '日本語' }).click();
    await expect(page.getByTestId('open-layers')).toContainText('レイヤー');
    await page.reload();
    await expect(page.getByTestId('open-layers')).toContainText('レイヤー');
  });

  test('US2.AS4 + FR-013: locale switch does NOT alter Google hl parameter', async ({ page }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    // Capture every Google tile URL the page issues across the entire test —
    // simpler and less timing-sensitive than waitForRequest.
    const seen: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('mt1.google.com') && u.includes('lyrs=y')) {
        seen.push(u);
      }
    });
    await page.goto('/');
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="google-hybrid"]').click();
    // Let MapLibre issue at least one tile for the chosen basemap.
    await page.waitForTimeout(800);
    expect(seen.length).toBeGreaterThan(0);
    for (const u of seen) {
      expect(u.includes('hl=zh-TW')).toBe(true);
    }
    // Now flip locale and ensure subsequent requests STILL carry hl=zh-TW.
    const beforeFlip = seen.length;
    await openLocalePicker(page);
    await page.getByTestId('locale-row').filter({ hasText: 'English' }).click();
    await page.waitForTimeout(400);
    const afterFlip = seen.slice(beforeFlip);
    for (const u of afterFlip) {
      expect(u.includes('hl=zh-TW')).toBe(true);
    }
  });
});

test.describe('Story 3c — Offline tile cache (US3)', () => {
  test('US3.AS1: cached NLSC tiles render after going offline', async ({ page, context }) => {
    await clearLayerPrefs(page);
    await seedPrefs(page);
    await page.goto('/');
    await openLayerPicker(page);
    await page.locator('[data-testid="layer-row"][data-layer-id="nlsc-emap5"]').click();
    // Allow tiles to fetch and cache.
    await page.waitForTimeout(2500);
    await context.setOffline(true);
    await page.evaluate(() => {
      const map = (
        window as unknown as {
          __mapTestHooks?: { startScriptedPan?: () => void };
        }
      ).__mapTestHooks;
      map?.startScriptedPan?.();
    });
    // No automated assertion of tile rendering (raster correctness needs a
    // visual comparison). Smoke check: no console errors that mention the
    // SW or fetch failure other than the expected offline state.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1500);
    expect(errors.length).toBe(0);
  });
});
