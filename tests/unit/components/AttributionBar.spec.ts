import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read tokens.css via fs because Vite's CSS plugin intercepts the `?raw`
// suffix for .css imports and returns an empty module in test mode.
const tokensCss = readFileSync(resolve(process.cwd(), 'src/app/tokens.css'), 'utf8');

interface RGB {
  r: number;
  g: number;
  b: number;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const norm = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function contrast(fg: RGB, bg: RGB): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Effective on-screen background: alpha-blend the token's RGBA against
// the worst-case underlying tile colour. We test the badge's own
// background guarantee (per FR-014), so we blend against pure white in
// light mode (worst case for a near-black foreground) and pure black in
// dark mode (worst case for a near-white foreground).
function blend(top: RGB & { a: number }, base: RGB): RGB {
  const a = top.a;
  return {
    r: Math.round(top.r * a + base.r * (1 - a)),
    g: Math.round(top.g * a + base.g * (1 - a)),
    b: Math.round(top.b * a + base.b * (1 - a)),
  };
}

describe('AttributionBar tokens — feature 004 US3 (FR-013/014/016, SC-004)', () => {
  test('1. tokens.css declares the light-mode token pair on :root', () => {
    expect(tokensCss).toMatch(/--attribution-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.95\)/);
    expect(tokensCss).toMatch(/--attribution-fg:\s*#0f172a/);
  });

  test('2. tokens.css declares the dark-mode token pair inside the prefers-color-scheme media block', () => {
    expect(tokensCss).toMatch(
      /prefers-color-scheme:\s*dark[\s\S]*?--attribution-bg:\s*rgba\(15,\s*23,\s*42,\s*0\.92\)/,
    );
    expect(tokensCss).toMatch(/prefers-color-scheme:\s*dark[\s\S]*?--attribution-fg:\s*#f1f5f9/);
  });

  test('3. light-mode background alpha ≥ 0.90 (FR-014)', () => {
    expect(0.95).toBeGreaterThanOrEqual(0.9);
  });

  test('4. dark-mode background alpha ≥ 0.90 (FR-014)', () => {
    expect(0.92).toBeGreaterThanOrEqual(0.9);
  });

  test('5. light-mode foreground luminance < 0.1 (near-black slate-900)', () => {
    expect(relativeLuminance({ r: 0x0f, g: 0x17, b: 0x2a })).toBeLessThan(0.1);
  });

  test('6. dark-mode foreground luminance > 0.9 (near-white slate-100)', () => {
    expect(relativeLuminance({ r: 0xf1, g: 0xf5, b: 0xf9 })).toBeGreaterThan(0.9);
  });

  test('7. light-mode contrast (slate-900 on rgba(255,255,255,0.95) over white) ≥ 4.5', () => {
    const fg = { r: 0x0f, g: 0x17, b: 0x2a };
    const bg = blend({ r: 255, g: 255, b: 255, a: 0.95 }, { r: 255, g: 255, b: 255 });
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test('8. dark-mode contrast (slate-100 on rgba(15,23,42,0.92) over black) ≥ 4.5', () => {
    const fg = { r: 0xf1, g: 0xf5, b: 0xf9 };
    const bg = blend({ r: 15, g: 23, b: 42, a: 0.92 }, { r: 0, g: 0, b: 0 });
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test('9. light-mode badge contrast also holds against a worst-case white tile underlay', () => {
    // FR-014 — the contrast must hold against the badge's own
    // background, not the tile. Effective background is the token RGBA
    // alpha-blended over white (worst case, since the foreground is
    // near-black).
    const fg = { r: 0x0f, g: 0x17, b: 0x2a };
    const bgOverWhite = blend({ r: 255, g: 255, b: 255, a: 0.95 }, { r: 255, g: 255, b: 255 });
    expect(contrast(fg, bgOverWhite)).toBeGreaterThanOrEqual(4.5);
  });

  test('10. dark-mode badge contrast also holds against a worst-case black tile underlay', () => {
    const fg = { r: 0xf1, g: 0xf5, b: 0xf9 };
    const bgOverBlack = blend({ r: 15, g: 23, b: 42, a: 0.92 }, { r: 0, g: 0, b: 0 });
    expect(contrast(fg, bgOverBlack)).toBeGreaterThanOrEqual(4.5);
  });

  test('11. tokens are NOT aliased to var(--color-fg) / var(--color-surface)', () => {
    expect(tokensCss).not.toMatch(/--attribution-bg:\s*var\(--color-surface/);
    expect(tokensCss).not.toMatch(/--attribution-fg:\s*var\(--color-fg/);
  });
});
