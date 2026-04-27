import { describe, test, expect } from 'vitest';
import zh from '../../../src/i18n/zh.json';
import en from '../../../src/i18n/en.json';
import ja from '../../../src/i18n/ja.json';

// Feature 006 SC-008 — every controls.* key MUST exist in all three
// locales. Build-time regression net so a future PR cannot silently
// ship Chinese-only or English-only strings.

const PREFIX = /^controls\./;

function pickPrefixed(obj: Record<string, string>): string[] {
  return Object.keys(obj).filter((k) => PREFIX.test(k));
}

describe('controls.* i18n key parity — feature 006 SC-008', () => {
  test('every controls.* key in zh.json exists in en.json and ja.json', () => {
    const zhKeys = pickPrefixed(zh as unknown as Record<string, string>);
    expect(zhKeys.length).toBeGreaterThan(0);
    const enObj = en as unknown as Record<string, string>;
    const jaObj = ja as unknown as Record<string, string>;
    for (const key of zhKeys) {
      expect(enObj[key], `en is missing key: ${key}`).toBeTypeOf('string');
      expect(jaObj[key], `ja is missing key: ${key}`).toBeTypeOf('string');
    }
  });

  test('every controls.* key in en.json exists in zh.json and ja.json', () => {
    const enKeys = pickPrefixed(en as unknown as Record<string, string>);
    const zhObj = zh as unknown as Record<string, string>;
    const jaObj = ja as unknown as Record<string, string>;
    for (const key of enKeys) {
      expect(zhObj[key], `zh is missing key: ${key}`).toBeTypeOf('string');
      expect(jaObj[key], `ja is missing key: ${key}`).toBeTypeOf('string');
    }
  });

  test('every controls.* key in ja.json exists in zh.json and en.json', () => {
    const jaKeys = pickPrefixed(ja as unknown as Record<string, string>);
    const zhObj = zh as unknown as Record<string, string>;
    const enObj = en as unknown as Record<string, string>;
    for (const key of jaKeys) {
      expect(zhObj[key], `zh is missing key: ${key}`).toBeTypeOf('string');
      expect(enObj[key], `en is missing key: ${key}`).toBeTypeOf('string');
    }
  });
});
