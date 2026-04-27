import { describe, test, expect } from 'vitest';
import zh from '../../../src/i18n/zh.json';
import en from '../../../src/i18n/en.json';
import ja from '../../../src/i18n/ja.json';

type Catalogue = Record<string, string>;
const ZH = zh as Catalogue;
const EN = en as Catalogue;
const JA = ja as Catalogue;

function settingsKeysOf(cat: Catalogue): string[] {
  return Object.keys(cat).filter((k) => k.startsWith('settings.'));
}

describe('settings.* keys parity across zh/en/ja', () => {
  test('zh settings keys are also in en + ja', () => {
    const zhKeys = settingsKeysOf(ZH);
    for (const k of zhKeys) {
      expect(EN[k], `en is missing ${k}`).toBeDefined();
      expect(JA[k], `ja is missing ${k}`).toBeDefined();
    }
  });

  test('en settings keys are also in zh + ja', () => {
    const enKeys = settingsKeysOf(EN);
    for (const k of enKeys) {
      expect(ZH[k], `zh is missing ${k}`).toBeDefined();
      expect(JA[k], `ja is missing ${k}`).toBeDefined();
    }
  });

  test('ja settings keys are also in zh + en', () => {
    const jaKeys = settingsKeysOf(JA);
    for (const k of jaKeys) {
      expect(ZH[k], `zh is missing ${k}`).toBeDefined();
      expect(EN[k], `en is missing ${k}`).toBeDefined();
    }
  });

  test('all three catalogues have the same number of settings.* keys', () => {
    expect(settingsKeysOf(ZH).length).toBe(settingsKeysOf(EN).length);
    expect(settingsKeysOf(ZH).length).toBe(settingsKeysOf(JA).length);
    expect(settingsKeysOf(ZH).length).toBeGreaterThanOrEqual(26);
  });
});

// Licence-language audit (SC-006): outside of the licence notice itself
// (which intentionally uses negation phrasing), no user-visible string
// in any locale may contain phrases that imply "download" / "prefetch" /
// "offline map" affordances. This is the build-time regression net for
// the FR-013 / FR-021 prohibition.

const LICENCE_KEY = 'settings.licenceNotice';
const FORBIDDEN_SUBSTRINGS: ReadonlyArray<{ pattern: RegExp; locale: 'zh' | 'en' | 'ja' | 'all' }> =
  [
    { pattern: /下載/, locale: 'zh' },
    { pattern: /離線地圖/, locale: 'zh' },
    { pattern: /預先快取/, locale: 'zh' },
    { pattern: /\bdownload\b/i, locale: 'en' },
    { pattern: /\bprefetch\b/i, locale: 'en' },
    { pattern: /offline map/i, locale: 'en' },
    { pattern: /area download/i, locale: 'en' },
    { pattern: /ダウンロード/, locale: 'ja' },
    { pattern: /オフラインマップ/, locale: 'ja' },
  ];

function settingsValuesOf(cat: Catalogue): Array<[string, string]> {
  return Object.entries(cat).filter(([k]) => k.startsWith('settings.') && k !== LICENCE_KEY);
}

describe('SC-006 licence-language audit (settings.* outside licenceNotice)', () => {
  test('zh settings strings (excluding licenceNotice) contain no "download"/"prefetch"/"offline map" substrings', () => {
    for (const [key, value] of settingsValuesOf(ZH)) {
      for (const { pattern, locale } of FORBIDDEN_SUBSTRINGS) {
        if (locale !== 'zh' && locale !== 'all') continue;
        expect(value, `zh.${key} contains forbidden substring ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test('en settings strings (excluding licenceNotice) contain no "download"/"prefetch"/"offline map" substrings', () => {
    for (const [key, value] of settingsValuesOf(EN)) {
      for (const { pattern, locale } of FORBIDDEN_SUBSTRINGS) {
        if (locale !== 'en' && locale !== 'all') continue;
        expect(value, `en.${key} contains forbidden substring ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test('ja settings strings (excluding licenceNotice) contain no "download"/"prefetch"/"offline map" substrings', () => {
    for (const [key, value] of settingsValuesOf(JA)) {
      for (const { pattern, locale } of FORBIDDEN_SUBSTRINGS) {
        if (locale !== 'ja' && locale !== 'all') continue;
        expect(value, `ja.${key} contains forbidden substring ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  test('the licence notice ITSELF uses the negation phrasing in each locale (positive assertion)', () => {
    expect(ZH[LICENCE_KEY]).toMatch(/不提供地圖下載/);
    expect(EN[LICENCE_KEY]).toMatch(/forbidden/i);
    expect(JA[LICENCE_KEY]).toMatch(/禁止/);
  });
});
