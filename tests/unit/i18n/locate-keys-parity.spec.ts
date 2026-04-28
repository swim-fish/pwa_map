import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 013 — locate-feature i18n key parity
// (data-model.md notification region message catalog).
// Mirrors `tests/unit/i18n/settings-about-keys-parity.spec.ts` shape.

const LOCALES = ['zh', 'en', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

const REQUIRED_KEYS = [
  // Toast keys (4)
  'locate.error.permissionDenied',
  'locate.error.positionUnavailable',
  'locate.error.timeout',
  'locate.error.unavailable',
  // Button accessible names (4)
  'locate.button.aria.off',
  'locate.button.aria.show',
  'locate.button.aria.follow',
  'locate.button.aria.disabled',
  // Reduced-motion long-press announcement (1)
  'locate.button.aria.holdToStop',
  // Settings section (4)
  'settings.locate.heading',
  'settings.locate.preset.smart',
  'settings.locate.preset.fast',
  'settings.locate.preset.slow',
] as const;

function loadCatalogue(locale: Locale): Record<string, string> {
  const path = resolve(process.cwd(), `src/i18n/${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}

describe('feature 013 — locate i18n key parity', () => {
  for (const locale of LOCALES) {
    test(`${locale}.json declares every required locate-feature key`, () => {
      const cat = loadCatalogue(locale);
      for (const key of REQUIRED_KEYS) {
        expect(cat[key], `${locale}.json missing ${key}`).toBeTruthy();
        expect(cat[key], `${locale}.json ${key} is not a non-empty string`).toMatch(/\S/);
      }
    });
  }

  test('no locate value contains a forbidden zh-TW / zh-Hant substring (Constitution v1.1.0)', () => {
    for (const locale of LOCALES) {
      const cat = loadCatalogue(locale);
      for (const key of REQUIRED_KEYS) {
        const v = cat[key] ?? '';
        expect(v, `${locale}.json ${key} contains zh-TW`).not.toMatch(/zh-TW/i);
        expect(v, `${locale}.json ${key} contains zh-Hant`).not.toMatch(/zh-Hant/i);
      }
    }
  });
});
