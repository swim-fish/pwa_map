# ADR 0009 — i18n: minimal three-locale store (zh canonical, en, ja)

**Status**: Accepted
**Date**: 2026-04-24

## Context

Three locales with ~40 keys × 3 files ≈ 120 translations. Fallback chain
`ja → en → zh`. Constitution v1.1.0 mandates the identifier `zh` as the
SOLE canonical tag for Taiwan Traditional Chinese — no `zh-TW`,
`zh-Hant`, `zh-CN`, `zh-Hans`.

## Decision

- Custom store at `src/i18n/index.ts` — a Svelte `writable<Locale>`,
  a `t(key, vars?)` getter, a derived `tStore` for template subscriptions,
  `setLocale()` and `isLocale()`.
- Three JSON files at `src/i18n/{zh,en,ja}.json`. `zh.json` is canonical
  — every key MUST exist there first; `en.json` and `ja.json` are
  translated against it independently (no zh→ja machine gloss).
- Missing key falls back along `ja → en → zh` (per-locale chain); if
  all three miss, the bare key is returned so the gap is visible in
  both UI and tests.
- Locale persists in `FormatPreferences.locale`; default seeds from
  `navigator.language` on first boot.

## Consequences

- The identifier `zh` appears in every code symbol, JSON filename,
  persisted pref, UI selector, and i18n catalogue (zero exceptions).
- ~0 KB bundle cost beyond the three JSON files (~3 KB each gzipped).

## Alternatives considered

- **`svelte-i18n`** — ~12 KB, pluralisation DSL we don't need for
  ~40 keys. Rejected.
- **`intl-messageformat`** — ICU-MessageFormat; overkill, and the native
  `Intl.NumberFormat` / `Intl.DateTimeFormat` already handle our needs.
- **Hard-coded zh** — violates FR-009's human-readable obligation for
  non-zh users.
- **Runtime LLM translation for `ja`** — violates offline guarantee +
  adds a privacy surface.
