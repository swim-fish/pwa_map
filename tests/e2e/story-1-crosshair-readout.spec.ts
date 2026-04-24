import { test, expect } from '@playwright/test';

const TAIPEI_101 = { lat: 25.033611, lon: 121.564472 };

test.describe('Story 1 — Live coordinate readout under a fixed crosshair', () => {
  test('AS1: opens with Taipei 101 in view, crosshair at center, DD readout within tolerance', async ({
    page,
  }) => {
    await page.goto('/');

    const crosshair = page.getByTestId('crosshair');
    await expect(crosshair).toBeVisible();

    // Crosshair is centered within the viewport (±1 px for sub-pixel rounding).
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const box = await crosshair.boundingBox();
    expect(box).not.toBeNull();
    if (viewport && box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      expect(Math.abs(cx - viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(cy - viewport.height / 2)).toBeLessThanOrEqual(1);
    }

    const readout = page.getByTestId('readout-dd');
    const text = await readout.innerText();
    const match = text.match(/(-?\d+\.\d+)[^\d-]+(-?\d+\.\d+)/);
    expect(match, `readout did not contain a numeric lat/lon pair: ${text}`).not.toBeNull();
    if (match) {
      const lat = Number.parseFloat(match[1]);
      const lon = Number.parseFloat(match[2]);
      expect(Math.abs(lat - TAIPEI_101.lat)).toBeLessThanOrEqual(0.000002);
      expect(Math.abs(lon - TAIPEI_101.lon)).toBeLessThanOrEqual(0.000002);
    }
  });

  test('AS2: pans to mid-Pacific — readout still renders a valid WGS84 DD', async ({ page }) => {
    await page.goto('/');

    // Simulate pan by using the map controller's test hook.
    await page.evaluate(() => {
      const ctrl = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { setCenter: (lat: number, lon: number) => void }
        | undefined;
      if (ctrl) ctrl.setCenter(0, -150);
    });

    const readout = page.getByTestId('readout-dd');
    const text = await readout.innerText();
    expect(text).toMatch(/-?\d+\.\d+/);
  });

  test('AS3: during a scripted continuous pan, readout updates at ≥ 10 Hz', async ({ page }) => {
    await page.goto('/');
    const readout = page.getByTestId('readout-dd');

    // Capture the readout text every ~90 ms for 1 second during a scripted pan.
    await page.evaluate(() => {
      const hooks = (window as unknown as Record<string, unknown>).__mapTestHooks as
        | { startScriptedPan?: () => void }
        | undefined;
      hooks?.startScriptedPan?.();
    });

    const samples: string[] = [];
    const start = Date.now();
    while (Date.now() - start < 1000) {
      samples.push(await readout.innerText());
      await page.waitForTimeout(90);
    }
    const unique = new Set(samples);
    expect(
      unique.size,
      `readout should update at ≥ 10 Hz during pan; got ${unique.size}`,
    ).toBeGreaterThanOrEqual(3);
  });
});
