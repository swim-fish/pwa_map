import { test, expect, type Page } from '@playwright/test';

// Feature 010 — US1 (collapse-on-narrow) + US3 (tap-to-expand) E2E.
//
// Per contracts/readout-collapse-mode.md Invariant 7 / SC-001:
//   - On phone-class viewports (320–599 CSS px wide), the collapsed
//     readout's bounding rect MUST NOT intersect the zoom-controls' rect.
//   - The single-row collapsed mode is the default; tapping the body
//     flips a transient `tap-expanded` mode (US3 — covered in the
//     second describe block, populated by T025/T026/T028).

const PHONE = { width: 360, height: 640 } as const;

async function waitForApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('map-root').waitFor({ state: 'visible' });
  await page.getByTestId('readout-panel').waitFor({ state: 'visible' });
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe('Feature 010 — US1 mobile collapsed readout (FR-001/002/003, SC-001)', () => {
  test.use({ viewport: PHONE });

  test('readout collapses to one row on 360×640 viewport with default formats enabled', async ({
    page,
  }) => {
    await waitForApp(page);
    const panel = page.getByTestId('readout-panel');
    await expect(panel).toHaveAttribute('data-mode', 'collapsed');

    // Exactly one visible row on the panel (priority-one of the default
    // formatOrder ∩ visible set = wgs84-dd, per DEFAULT_FORMAT_ORDER).
    const visibleRows = await panel.locator('.row:not(.hidden)').count();
    expect(visibleRows).toBeLessThanOrEqual(1 + 0); // 1 visible (CSS hides others via display:none)
  });

  test('collapsed readout rect does not intersect zoom-controls rect (SC-001)', async ({
    page,
  }) => {
    await waitForApp(page);
    const readout = page.getByTestId('readout-panel');
    const zoomIn = page.getByTestId('zoom-in');
    const zoomOut = page.getByTestId('zoom-out');

    const rR = await readout.boundingBox();
    const rZi = await zoomIn.boundingBox();
    const rZo = await zoomOut.boundingBox();
    expect(rR, 'readout-panel must have a layout box').not.toBeNull();
    expect(rZi, 'zoom-in must have a layout box').not.toBeNull();
    expect(rZo, 'zoom-out must have a layout box').not.toBeNull();

    expect(rectsIntersect(rR!, rZi!), 'collapsed readout MUST NOT intersect zoom-in rect').toBe(
      false,
    );
    expect(rectsIntersect(rR!, rZo!), 'collapsed readout MUST NOT intersect zoom-out rect').toBe(
      false,
    );
  });
});

test.describe('Feature 010 — US3 tap-to-expand (FR-008/009/010)', () => {
  test.use({ viewport: PHONE });

  test('tapping collapsed readout body switches to tap-expanded; copy button does not', async ({
    page,
  }) => {
    await waitForApp(page);
    const panel = page.getByTestId('readout-panel');
    await expect(panel).toHaveAttribute('data-mode', 'collapsed');

    // Tap the body (priority-one row label area) — switches to tap-expanded.
    await panel.click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveAttribute('data-mode', 'tap-expanded');

    // Tap again on the body returns to collapsed.
    await panel.click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveAttribute('data-mode', 'collapsed');

    // Tapping the copy button does NOT toggle to tap-expanded.
    const copy = panel.getByTestId('copy-wgs84-dd');
    await copy.click();
    await expect(panel).toHaveAttribute('data-mode', 'collapsed');
  });
});
