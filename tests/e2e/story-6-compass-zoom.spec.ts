import { test, expect, type Page } from '@playwright/test';

interface MapHooks {
  triggerRotate: (deg: number) => void;
  triggerWheelZoom: (opts: { deltaY: number }) => void;
}

async function waitForMapHooks(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as unknown as { __mapTestHooks?: Partial<MapHooks> };
    return (
      typeof w.__mapTestHooks?.triggerRotate === 'function' &&
      typeof w.__mapTestHooks?.triggerWheelZoom === 'function'
    );
  });
}

function readReadoutLatLon(text: string): { lat: number; lon: number } | null {
  const match = text.match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
  if (!match) return null;
  return { lat: Number.parseFloat(match[1]), lon: Number.parseFloat(match[2]) };
}

test.describe('Feature 006 — compass + crosshair-anchored zoom', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });
    await page.goto('/');
    await page.getByTestId('map-root').waitFor({ state: 'visible' });
    await waitForMapHooks(page);
  });

  test('US1: triggerRotate(90) → compass --compass-bearing -90deg → click resets to 0', async ({
    page,
  }) => {
    await page.evaluate(() => {
      (window as unknown as { __mapTestHooks: MapHooks }).__mapTestHooks.triggerRotate(90);
    });
    const compass = page.getByTestId('compass');
    await expect(compass).toBeVisible({ timeout: 5_000 });
    await expect
      .poll(
        async () => compass.evaluate((el) => el.style.getPropertyValue('--compass-bearing').trim()),
        {
          timeout: 2_000,
        },
      )
      .toBe('-90deg');

    await compass.click();
    await expect
      .poll(
        async () => compass.evaluate((el) => el.style.getPropertyValue('--compass-bearing').trim()),
        {
          timeout: 2_000,
        },
      )
      .toMatch(/^-?0deg$/);
  });

  test('US2: wheel zoom in/out keeps the central crosshair coordinate fixed', async ({ page }) => {
    const readoutBefore = await page.getByTestId('readout-dd').innerText();
    const before = readReadoutLatLon(readoutBefore);
    expect(before).not.toBeNull();

    await page.evaluate(() => {
      (window as unknown as { __mapTestHooks: MapHooks }).__mapTestHooks.triggerWheelZoom({
        deltaY: -100,
      });
    });
    await page.waitForTimeout(200);
    const readoutAfter = await page.getByTestId('readout-dd').innerText();
    const after = readReadoutLatLon(readoutAfter);
    expect(after).not.toBeNull();
    if (before && after) {
      expect(Math.abs(after.lat - before.lat)).toBeLessThanOrEqual(0.0001);
      expect(Math.abs(after.lon - before.lon)).toBeLessThanOrEqual(0.0001);
    }
  });

  test('US2: + and - buttons fire crosshair-anchored zoom', async ({ page }) => {
    const readoutBefore = await page.getByTestId('readout-dd').innerText();
    const before = readReadoutLatLon(readoutBefore);
    expect(before).not.toBeNull();

    await page.getByTestId('zoom-in').click();
    await page.waitForTimeout(400);
    await page.getByTestId('zoom-out').click();
    await page.waitForTimeout(400);

    const readoutAfter = await page.getByTestId('readout-dd').innerText();
    const after = readReadoutLatLon(readoutAfter);
    expect(after).not.toBeNull();
    if (before && after) {
      expect(Math.abs(after.lat - before.lat)).toBeLessThanOrEqual(0.0001);
      expect(Math.abs(after.lon - before.lon)).toBeLessThanOrEqual(0.0001);
    }
  });

  test('SC-009: zero console errors across all interactions', async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as { __mapTestHooks: MapHooks }).__mapTestHooks.triggerRotate(45);
    });
    await page.getByTestId('compass').click();
    await page.evaluate(() => {
      (window as unknown as { __mapTestHooks: MapHooks }).__mapTestHooks.triggerWheelZoom({
        deltaY: -100,
      });
    });
    await page.getByTestId('zoom-in').click();
    await page.getByTestId('zoom-out').click();
    await page.waitForTimeout(500);
    expect(consoleErrors).toEqual([]);
  });
});
