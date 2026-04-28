---
paths:
  - "src/components/SettingsSheet.svelte"
  - "src/app/tokens.css"
  - "tests/integration/settings-contrast.spec.ts"
  - "tests/integration/attribution-contrast.spec.ts"
  - "tests/integration/controls-contrast.spec.ts"
---

# Tokens + contrast spec checkpoints

Long-form context: [`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§ 9. Authoritative ADRs: 0014 (accessibility baseline), 0027 (tile
cache settings — first SettingsSheet contrast spec).

## NO HARD-CODED COLOURS in SettingsSheet

`tests/integration/settings-contrast.spec.ts` (feature 007 / FR-018)
is a regression net that scans `src/components/SettingsSheet.svelte`
for any literal `color:` / `background:` declaration matching
`#hex` / `rgba(...)` / `rgb(...)` / `hsl(...)` / `hsla(...)`.
Hard-coded colours fail the spec.

Pattern when adding a new colour to SettingsSheet:

1. Add a token to `src/app/tokens.css`. Light scheme on `:root`,
   dark scheme inside the existing
   `@media (prefers-color-scheme: dark) :root { ... }` block where
   applicable.
2. Reference via `var(--your-new-token)` inside SettingsSheet.

```css
/* tokens.css — light */
:root {
  --color-on-accent: #ffffff;
}

/* tokens.css — dark variant if needed */
@media (prefers-color-scheme: dark) {
  :root {
    /* override here if accent contrast differs in dark */
  }
}

/* SettingsSheet.svelte */
.install-section-confirm {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
```

## EXISTING token vocabulary (re-use first)

Before declaring a new token, check whether one of these covers
the semantic you need:

| Concern | Token |
| ------- | ----- |
| Surface (panel) background | `--color-surface`, `--color-surface-elev` |
| Foreground text | `--color-fg`, `--color-fg-muted` |
| Border | `--color-border` |
| Accent fill | `--color-accent` |
| Text on accent fill | `--color-on-accent` |
| Destructive action background | `--color-danger-bg` |
| Destructive action foreground | `--color-danger-fg` |
| Scrim overlay | `--color-scrim` |
| Readout panel background | `--readout-bg` |
| Readout panel foreground | `--readout-fg` |
| Attribution background | `--attribution-bg` |
| Attribution foreground | `--attribution-fg` |

If your need maps to an existing token, use it. Don't invent
parallel tokens with subtle wording divergence.

## CONTRAST tests for the danger button pair

`settings-contrast.spec.ts` includes WCAG-AA inline checks for the
`--color-danger-{bg,fg}` pair under both light and dark schemes
(must be ≥ 4.5:1). If you adjust those tokens, the inline
luminance calc in the test must continue to pass — verify locally
before pushing.

## EVERY locale ships every key

Adding a new i18n key means adding to ALL three locale catalogues:
`src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json`. The
parity is asserted by `tests/unit/i18n/controls-keys-parity.spec.ts`
and indirectly by every integration test that locale-iterates.

Locale convention (Constitution v1.1.0): `zh` is the canonical
identifier for Traditional Chinese. NEVER `zh-TW` / `zh-Hant`.
