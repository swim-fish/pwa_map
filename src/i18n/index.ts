import { writable, get, derived, type Readable } from 'svelte/store';
import type { Locale } from '$types/coord';
import zh from './zh.json';
import en from './en.json';
import ja from './ja.json';

type Catalogue = Record<string, string>;

const CATALOGUES: Record<Locale, Catalogue> = {
  zh: zh as Catalogue,
  en: en as Catalogue,
  ja: ja as Catalogue,
};

const FALLBACK_CHAIN: Readonly<Record<Locale, readonly Locale[]>> = {
  zh: ['zh'],
  en: ['en', 'zh'],
  ja: ['ja', 'en', 'zh'],
};

const SUPPORTED_LOCALES: readonly Locale[] = ['zh', 'en', 'ja'];

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

export const locale = writable<Locale>('zh');

export function setLocale(next: Locale): void {
  locale.set(next);
}

function lookup(
  catalogues: Record<Locale, Catalogue>,
  chain: readonly Locale[],
  key: string,
): string | undefined {
  for (const loc of chain) {
    const v = catalogues[loc]?.[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const current = get(locale);
  const chain = FALLBACK_CHAIN[current];
  const template = lookup(CATALOGUES, chain, key);
  if (template === undefined) {
    // Missing translation — return the key itself so it is visible in the UI and surfaces in tests.
    return key;
  }
  return interpolate(template, vars);
}

export const tStore: Readable<(key: string, vars?: Record<string, string | number>) => string> =
  derived(locale, ($locale) => {
    const chain = FALLBACK_CHAIN[$locale];
    return (key: string, vars?: Record<string, string | number>): string => {
      const template = lookup(CATALOGUES, chain, key);
      if (template === undefined) return key;
      return interpolate(template, vars);
    };
  });

export { SUPPORTED_LOCALES };
