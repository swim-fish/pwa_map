import { test, expect, type Page } from '@playwright/test';

// Feature 012 — Go-To dialog narrow-viewport real-browser geometry.
// Spec FR-010..FR-014, SC-002, SC-003.
//
// Cycle through every format chip at three viewport widths and assert:
//   - the dialog never overflows horizontally (`scrollWidth ≤ clientWidth`)
//   - every input cell retains a short-axis dimension ≥ 44 px (ADR-0014).

const VIEWPORTS = [
  { width: 320, height: 568, label: '320×568 (iPhone SE-class)' },
  { width: 360, height: 640, label: '360×640 (small Android)' },
  { width: 390, height: 844, label: '390×844 (iPhone 12+)' },
];

const FORMATS = ['auto', 'wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'twd67-tm2', 'mgrs', 'taipower'];

async function openGoTo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('open-goto').click();
  await expect(page.getByTestId('goto-dialog')).toBeVisible();
}

async function selectFormat(page: Page, kind: string): Promise<void> {
  // Chips live in a single rack. Select by data-testkind data attribute
  // (set in ChipRack.svelte via the testKind field on each chip).
  const chip = page.locator(`[data-testid="goto-chip"][data-chip-kind="${kind}"]`);
  await chip.click();
}

test.describe('feature 012 — Go-To narrow-viewport fit', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.label}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      for (const fmt of FORMATS) {
        test(`${fmt} layout fits without horizontal overflow`, async ({ page }) => {
          await openGoTo(page);
          await selectFormat(page, fmt);

          const dialog = page.getByTestId('goto-dialog');
          const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
          expect(
            overflow,
            `dialog horizontal overflow at ${vp.label} / ${fmt}: ${overflow}px`,
          ).toBeLessThanOrEqual(0);

          // Every <input> / <textarea> inside the dialog must keep a
          // ≥ 44 px short-axis tap target at the narrowest viewport.
          if (vp.width === 320) {
            const fields = dialog.locator('input, textarea');
            const count = await fields.count();
            for (let i = 0; i < count; i++) {
              const box = await fields.nth(i).boundingBox();
              expect(box, `field ${i} bounding box at ${fmt}`).not.toBeNull();
              const short = Math.min(box!.width, box!.height);
              expect(
                short,
                `field ${i} short-axis ${short}px at ${fmt} (need ≥ 44)`,
              ).toBeGreaterThanOrEqual(44);
            }
          }
        });
      }
    });
  }
});
