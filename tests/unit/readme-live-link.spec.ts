import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 012 — README live demo link contract (FR-020 / FR-021 / SC-005).

const README = resolve(process.cwd(), 'README.md');
const LIVE_URL = 'https://swim-fish.github.io/pwa_map/';
const ABOVE_THE_FOLD_LINES = 30;

describe('README live demo link — feature 012 / FR-020 / SC-005', () => {
  test('README.md contains the live-deploy URL above the fold', () => {
    const text = readFileSync(README, 'utf8');
    const head = text.split('\n').slice(0, ABOVE_THE_FOLD_LINES).join('\n');
    expect(head).toContain(LIVE_URL);
  });

  test('the URL is rendered as a Markdown autolink (legible in plain text)', () => {
    const text = readFileSync(README, 'utf8');
    const head = text.split('\n').slice(0, ABOVE_THE_FOLD_LINES).join('\n');
    // Autolink form `<https://...>` survives both rendered and plain-text
    // viewers per research.md §R7. Use a literal `includes` rather than
    // a `RegExp(LIVE_URL)` — the URL contains regex metacharacters
    // (notably `.`) that an unescaped pattern would match more loosely
    // than intended (Copilot review on PR #4).
    expect(head.includes(`<${LIVE_URL}>`)).toBe(true);
  });

  test('the live link aligns with the deploy-base in vite.config.ts', () => {
    const text = readFileSync(README, 'utf8');
    // The live URL ends with the project's deploy-base path
    // (`/pwa_map/`) — the deploy-base spec asserts the path side; this
    // test asserts the README mirrors it.
    expect(text).toContain('/pwa_map/');
  });
});
