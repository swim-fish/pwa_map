import { test, expect, type Page } from '@playwright/test';

// Feature 004 E2E coverage. Three describe blocks:
//   - US1 offline reload (FR-001..FR-006, SC-001, SC-008)
//   - US2 update prompt   (FR-007..FR-012, SC-002, SC-003, SC-005)
//   - US4 manifest hygiene (FR-017..FR-020, SC-006)
//
// US3 attribution contrast is covered by Vitest unit + integration
// (jsdom can compute getComputedStyle deterministically); we still
// assert visible attribution text indirectly here as a backstop.
//
// All tests run against the chromium project's preview server (port
// 4173 by playwright.config.ts). For US4's dev path, PLAYWRIGHT BASE
// URL can be overridden — see env BASE_URL handling in the spec body.

const TAIPEI_CENTER: [number, number] = [121.564472, 25.033611];

async function panAcrossTaipei(page: Page): Promise<void> {
  await page.evaluate(([lon, lat]: [number, number]) => {
    const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
      | { setCenter?: (lat: number, lon: number) => void }
      | undefined;
    hooks?.setCenter?.(lat, lon);
  }, TAIPEI_CENTER);
  // Pan in a few directions to warm runtime cache for adjacent tiles.
  await page.evaluate(() => {
    const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
      | { startScriptedPan?: () => void }
      | undefined;
    hooks?.startScriptedPan?.();
  });
  await page.waitForTimeout(1500);
}

test.describe('US1 offline reload (feature 004 SC-001 + SC-008)', () => {
  test.describe.configure({ mode: 'serial' });

  test('after warm-up + setOffline(true), reload renders shell + attribution within 3s', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'pwa_map:prefs',
        JSON.stringify({
          version: 1,
          visible: ['wgs84-dd'],
          mgrsPrecision: 5,
          taipowerPrecision: 9,
          locale: 'en',
          mapLayer: 'osm-standard',
          overlay: false,
        }),
      );
    });

    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });

    // Wait for the SW to activate so subsequent reloads come from cache.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15_000,
    });

    await panAcrossTaipei(page);

    await context.setOffline(true);

    const t0 = Date.now();
    await page.reload();
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    await expect(page.getByTestId('attribution')).toBeVisible();
    const elapsed = Date.now() - t0;

    // SC-001 — within 3 s.
    expect(elapsed).toBeLessThanOrEqual(3000);

    // Attribution text is non-empty (legal-compliance backstop).
    const attribText = (await page.getByTestId('attribution').innerText()).trim();
    expect(attribText.length).toBeGreaterThan(0);
  });
});

test.describe('US2 update prompt (feature 004 SC-002 + SC-003 + SC-005)', () => {
  test.describe.configure({ mode: 'serial' });

  test('triggerUpdateAvailable() shows the prompt with both buttons', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    const t0 = Date.now();
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__pwaTestHooks as
        | { triggerUpdateAvailable?: () => void }
        | undefined;
      hooks?.triggerUpdateAvailable?.();
    });
    await expect(page.getByTestId('update-prompt')).toBeVisible({ timeout: 10_000 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThanOrEqual(10_000); // SC-002
    await expect(page.getByTestId('update-prompt-confirm')).toBeVisible();
    await expect(page.getByTestId('update-prompt-later')).toBeVisible();
  });

  test('Later dismisses, and a second trigger inside the postpone window does NOT re-show', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__pwaTestHooks as
        | { triggerUpdateAvailable?: () => void }
        | undefined;
      hooks?.triggerUpdateAvailable?.();
    });
    await expect(page.getByTestId('update-prompt')).toBeVisible();
    await page.getByTestId('update-prompt-later').click();
    await expect(page.getByTestId('update-prompt')).toHaveCount(0);

    // Second trigger immediately — postpone window is in effect.
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__pwaTestHooks as
        | { triggerUpdateAvailable?: () => void }
        | undefined;
      hooks?.triggerUpdateAvailable?.();
    });
    await page.waitForTimeout(300);
    await expect(page.getByTestId('update-prompt')).toHaveCount(0);
  });

  test('persisted state survives an update-confirm reload (SC-005)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'pwa_map:prefs',
        JSON.stringify({
          version: 1,
          visible: ['wgs84-dd', 'mgrs'],
          mgrsPrecision: 5,
          taipowerPrecision: 9,
          locale: 'en',
          mapLayer: 'osm-standard',
          overlay: false,
        }),
      );
      window.localStorage.setItem(
        'pwa_map:lastView',
        JSON.stringify({
          center: { kind: 'wgs84-dd', lat: 25.033611, lon: 121.564472 },
          zoom: 13,
          bearing: 0,
          pitch: 0,
        }),
      );
      window.localStorage.setItem('pwa_map:gotoHistory_v1', JSON.stringify([]));
    });
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });

    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__pwaTestHooks as
        | { triggerUpdateAvailable?: () => void }
        | undefined;
      hooks?.triggerUpdateAvailable?.();
    });
    await expect(page.getByTestId('update-prompt')).toBeVisible();

    // Confirm — the test hook's confirmUpdate is a no-op (no real SW
    // to skip-wait), so we manually reload to mimic the post-confirm
    // flow.
    await page.getByTestId('update-prompt-confirm').click();
    await page.waitForTimeout(200);
    await page.reload();
    await page.getByTestId('map-root').waitFor({ state: 'visible' });

    const after = await page.evaluate(() => ({
      prefs: localStorage.getItem('pwa_map:prefs'),
      lastView: localStorage.getItem('pwa_map:lastView'),
      history: localStorage.getItem('pwa_map:gotoHistory_v1'),
    }));
    expect(after.prefs).not.toBeNull();
    expect(after.lastView).not.toBeNull();
    expect(after.history).not.toBeNull();
    expect(() => JSON.parse(after.prefs!)).not.toThrow();
    expect(() => JSON.parse(after.lastView!)).not.toThrow();
    expect(() => JSON.parse(after.history!)).not.toThrow();
  });
});

test.describe('US4 manifest hygiene (feature 004 SC-006)', () => {
  test.describe.configure({ mode: 'serial' });

  test('console contains zero manifest syntax errors after page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    const matches = errors.filter((e) => /manifest\.webmanifest.*Syntax error/i.test(e));
    expect(matches).toEqual([]);
  });

  test('GET /manifest.webmanifest returns valid JSON with required fields', async ({ page }) => {
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/manifest+json');
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.name).toBe('string');
    expect(typeof body.short_name).toBe('string');
    expect(Array.isArray(body.icons)).toBe(true);
    expect(typeof body.start_url).toBe('string');
    expect(typeof body.display).toBe('string');
  });
});
