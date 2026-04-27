import { test, expect, type Page } from '@playwright/test';

// Feature 009 — real-engine tap-target verification (FR-001 / FR-002 / FR-003 / SC-001 / SC-006).
// Vitest's source-string spec (tests/unit/tap-target.spec.ts) protects the
// CSS contract; this Playwright spec asserts the rendered geometry under
// a phone-class viewport on every browser project configured in
// playwright.config.ts. Mobile Chrome / iOS Safari coverage is approximated
// by running the existing Chromium / WebKit projects at a 360 × 640 viewport
// (and Firefox at the same viewport for cross-engine confidence).
//
// Per contracts/tap-target.md:
//   Invariant 1: every listed selector is ≥ 44 × 44 CSS px.
//   Invariant 2: no two listed bounding rectangles intersect.
//   Invariant 3: at 320 px width, no horizontal scroll.

const PHONE = { width: 360, height: 640 } as const;
const NARROW_PHONE = { width: 320, height: 640 } as const;

// Selectors that MUST resolve to ≥ 44×44 boxes when visible.
const TAP_SELECTORS = [
  '[data-testid="compass"]',
  '[data-testid="zoom-in"]',
  '[data-testid="zoom-out"]',
  '[data-testid="open-goto"]',
  '[data-testid="open-format-toggle"]',
  '[data-testid="open-layers"]',
  '[data-testid="open-locale"]',
  '[data-testid="settings-toolbar-button"]',
] as const;

async function waitForApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('map-root').waitFor({ state: 'visible' });
}

test.describe('Feature 009 — mobile tap targets', () => {
  test.use({ viewport: PHONE });

  test('every primary on-screen control renders at ≥ 44 × 44 CSS px on a 360 × 640 viewport', async ({
    page,
  }) => {
    await waitForApp(page);

    for (const sel of TAP_SELECTORS) {
      const el = page.locator(sel).first();
      await expect(el, `${sel} should be visible`).toBeVisible();
      const box = await el.boundingBox();
      expect(box, `${sel} should have a layout box`).not.toBe(null);
      expect(box!.width, `${sel} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${sel} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test('no two visible primary controls visually overlap on a 360 × 640 viewport', async ({
    page,
  }) => {
    await waitForApp(page);
    const boxes: { sel: string; rect: { x: number; y: number; w: number; h: number } }[] = [];
    for (const sel of TAP_SELECTORS) {
      const el = page.locator(sel).first();
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      if (b) boxes.push({ sel, rect: { x: b.x, y: b.y, w: b.width, h: b.height } });
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].rect;
        const b = boxes[j].rect;
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        expect(
          overlap,
          `${boxes[i].sel} and ${boxes[j].sel} bounding rectangles must not intersect`,
        ).toBe(false);
      }
    }
  });
});

test.describe('Feature 009 — narrow phone (320 px) horizontal scroll', () => {
  test.use({ viewport: NARROW_PHONE });

  test('document does not require horizontal scroll at 320 px width', async ({ page }) => {
    await waitForApp(page);
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // Allow a 1-px sub-pixel rounding margin.
    expect(scroll.scrollWidth - scroll.clientWidth).toBeLessThanOrEqual(1);
  });
});
