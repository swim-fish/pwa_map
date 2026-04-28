import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 012 — Settings About i18n key parity (FR-017 / SC-009).
// Mirrors `tests/unit/i18n/controls-keys-parity.spec.ts` shape.

const LOCALES = ['zh', 'en', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

const REQUIRED_KEYS = [
  'settings.about.heading',
  'settings.about.liveMap',
  'settings.about.sourceCode',
] as const;

function loadCatalogue(locale: Locale): Record<string, string> {
  const path = resolve(process.cwd(), `src/i18n/${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}

describe('Settings About i18n key parity — feature 012 / FR-017 / SC-009', () => {
  for (const locale of LOCALES) {
    test(`${locale}.json declares every required Settings About key`, () => {
      const cat = loadCatalogue(locale);
      for (const key of REQUIRED_KEYS) {
        expect(cat[key], `${locale}.json missing ${key}`).toBeTruthy();
        expect(cat[key], `${locale}.json ${key} is not a non-empty string`).toMatch(/\S/);
      }
    });
  }

  test('no Settings About value contains a forbidden zh-TW / zh-Hant substring (Constitution v1.1.0)', () => {
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
