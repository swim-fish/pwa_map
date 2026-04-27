import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 007 contrast-token regression net. Mirrors the feature-006
// `controls-contrast.spec.ts` source-check pattern: Vitest + jsdom does
// not apply Svelte scoped <style> via CSSOM, so we read the component
// source and assert that the WCAG-AA-compliant tokens are referenced —
// never replaced by raw hex / rgba values.

const SHEET = resolve(process.cwd(), 'src/components/SettingsSheet.svelte');
const TOKENS = resolve(process.cwd(), 'src/app/tokens.css');

describe('SettingsSheet contrast tokens — feature 007 FR-018 / SC-006', () => {
  test('SettingsSheet.svelte uses --color-surface-elev / --color-fg / --color-border', () => {
    const src = readFileSync(SHEET, 'utf8');
    expect(src).toMatch(/background:\s*var\(--color-surface-elev/);
    expect(src).toMatch(/color:\s*var\(--color-fg/);
    expect(src).toMatch(/var\(--color-border/);
  });

  test('SettingsSheet.svelte uses --color-danger-bg / --color-danger-fg for destructive buttons', () => {
    const src = readFileSync(SHEET, 'utf8');
    expect(src).toMatch(/background:\s*var\(--color-danger-bg/);
    expect(src).toMatch(/color:\s*var\(--color-danger-fg/);
  });

  test('SettingsSheet.svelte does NOT hard-code raw contrast-bearing colours', () => {
    const src = readFileSync(SHEET, 'utf8');
    const hardCoded = [...src.matchAll(/(background|color):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g)]
      .map((m) => m[0])
      .filter((s) => !/box-shadow/.test(s));
    expect(hardCoded).toEqual([]);
  });

  test('tokens.css declares the danger token pair on :root (light) and inside dark media block', () => {
    const tokens = readFileSync(TOKENS, 'utf8');
    expect(tokens).toMatch(/--color-danger-bg:\s*#dc2626/);
    expect(tokens).toMatch(/--color-danger-fg:\s*#ffffff/);
    expect(tokens).toMatch(/prefers-color-scheme:\s*dark[\s\S]*?--color-danger-bg:\s*#ef4444/);
    expect(tokens).toMatch(/prefers-color-scheme:\s*dark[\s\S]*?--color-danger-fg:\s*#0f172a/);
  });

  test('light-mode danger contrast ≥ 4.5 (white text on #dc2626)', () => {
    // Quick WCAG-AA check inlined to keep this spec self-contained.
    const luminance = (r: number, g: number, b: number): number => {
      const norm = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
    };
    const Lfg = luminance(0xff, 0xff, 0xff);
    const Lbg = luminance(0xdc, 0x26, 0x26);
    const ratio = (Math.max(Lfg, Lbg) + 0.05) / (Math.min(Lfg, Lbg) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('dark-mode danger contrast ≥ 4.5 (#0f172a text on #ef4444)', () => {
    const luminance = (r: number, g: number, b: number): number => {
      const norm = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
    };
    const Lfg = luminance(0x0f, 0x17, 0x2a);
    const Lbg = luminance(0xef, 0x44, 0x44);
    const ratio = (Math.max(Lfg, Lbg) + 0.05) / (Math.min(Lfg, Lbg) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
