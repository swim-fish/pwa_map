# Contract: Settings About section — i18n keys, link semantics, accessibility

**Feature**: 012-settings-about-and-mobile-fixes
**Module**: `src/components/SettingsSheet.svelte` (MODIFIED)
**Locales**: `src/i18n/zh.json`, `src/i18n/en.json`, `src/i18n/ja.json` (each MODIFIED)
**Spec FRs**: FR-015, FR-016, FR-017, FR-018, FR-019
**Related ADRs**: ADR-0009 (i18n three-locale `zh` / `en` / `ja`), ADR-0014 (accessibility baseline), ADR-0027 (tile cache settings — first SettingsSheet contrast spec), ADR-0031 (safe-area + on-demand install)

## §1. DOM contract

The About section is a `<section>` placed inside the
`SettingsSheet.svelte` sheet body, after the existing install section
and before the cache rows. Its DOM structure is:

```html
<section
  class="about-section"
  aria-labelledby="settings-about-heading"
  data-testid="settings-about-section"
>
  <h3 id="settings-about-heading" class="section-heading">{t('settings.about.heading')}</h3>
  <ul class="about-list">
    <li>
      <a
        href="https://swim-fish.github.io/pwa_map/"
        target="_blank"
        rel="noopener noreferrer"
        class="about-link tap-target"
        data-testid="settings-about-live-map-link"
      >{t('settings.about.liveMap')}</a>
    </li>
    <li>
      <a
        href="https://github.com/swim-fish/pwa_map"
        target="_blank"
        rel="noopener noreferrer"
        class="about-link tap-target"
        data-testid="settings-about-source-code-link"
      >{t('settings.about.sourceCode')}</a>
    </li>
  </ul>
</section>
```

The two `<a>` elements MUST be real anchors with the listed
`href`/`target`/`rel` attributes (FR-016). They MUST NOT be `<button>`
elements with synthesised navigation, and they MUST NOT use
JavaScript-only click handlers — long-press / share semantics on
mobile depend on the native anchor element.

Each `<a>` MUST carry the project-wide `tap-target` utility class
(min 44 × 44 CSS px floor, declared in `tokens.css`) and the
`about-link` class that adopts the secondary-button styling described
in §5. The button-like styling is added by Addendum A.3 — the
contract requires the visual prominence to communicate "this is a
clickable surface", but DOES NOT mandate the specific shape, padding,
or border-radius beyond the 44 px tap floor.

## §2. i18n key contract

Three new keys are required in **all three** locale catalogues. Any
locale missing a key fails the parity test.

| Key | English (`en.json`) | Traditional Chinese (`zh.json`) | Japanese (`ja.json`) |
|-----|---------------------|--------------------------------|---------------------|
| `settings.about.heading` | `About` | `關於` | `アプリについて` |
| `settings.about.liveMap` | `Live map` | `地圖網址` | `マップ URL` |
| `settings.about.sourceCode` | `Source code` | `原始碼` | `ソースコード` |

The `zh` catalogue value MUST be Traditional Chinese (台灣正體中文)
per Constitution v1.1.0 — the locale-key parity test rejects
Simplified Chinese substrings (using a list of unique-Simplified
codepoints).

## §3. URL contract

The two URLs are inline string literals in the Svelte template:

| Element | URL |
|---------|-----|
| Live map link | `https://swim-fish.github.io/pwa_map/` (trailing `/` matters — must match the `deploy.base` path in `vite.config.ts`) |
| Source code link | `https://github.com/swim-fish/pwa_map` |

Both URLs are **literal strings**, not constants — they appear in
exactly two places per URL (the in-app anchor and `README.md` for the
live URL; only `SettingsSheet.svelte` for the source URL). A shared
constant module is unwarranted at this scale.

## §4. Accessibility contract

### A1 — Tap targets

Each `<a>` MUST have a hit area ≥ 44 × 44 CSS px (ADR-0014). This is
satisfied by the existing list-item styling in `SettingsSheet.svelte`
plus the inherited link styling; no new tap-target spec is needed.

### A2 — Keyboard navigation

The two anchors MUST be reachable via Tab from the Settings
open-trigger in visual order (heading → live map link → source code
link → next existing section). The default browser focus order
satisfies this when the DOM is in the correct order; no `tabindex`
attribute is added.

### A3 — Focus ring

Each `<a>` MUST receive the project's existing focus-ring treatment
when focused via keyboard. The focus ring MUST satisfy WCAG-AA
contrast against `--color-surface`. Token reuse (no new tokens)
inherits the contrast guarantee from `tokens.css`.

### A4 — Activation

Each `<a>` MUST be activatable via Enter (default for anchors). Space
is not required (anchors don't activate on Space by default — Spec
acceptance scenario 4 is satisfied by Enter alone, but the test
permits both).

### A5 — Heading semantics

`<h3>` is the correct heading level (the install section above also
uses `<h3>`; the SettingsSheet wrapper has an `<h2>`). The heading
MUST be associated with the `<section>` via `aria-labelledby` so
screen readers announce the section's purpose.

## §5. Contrast contract

The About section MUST NOT introduce any new hard-coded colour. The
existing regression net at
`tests/integration/settings-contrast.spec.ts` (feature 007 / FR-018)
loads `SettingsSheet.svelte` as text and greps for literal
`color:` / `background:` declarations matching `#hex` / `rgba(...)` /
etc. The About section's CSS MUST use only `var(--color-fg)`,
`var(--color-fg-muted)`, and the existing focus-ring tokens.

If any new visual styling is needed (e.g., link underline colour),
the relevant existing token MUST be reused — see
`.claude/rules/pwa-tokens-and-contrast.md` for the token vocabulary.

## §6. Component-state contract

The About section is **stateless** — it has no UI flag that toggles
visibility, no in-flight indicator, no expansion state. It is
presentational only.

This means the SettingsSheet's existing
`$: if (!open) { ... }` cleanup block (per
`.claude/rules/pwa-component-state.md`) does NOT need amendment.

If a future revision introduces a UI flag inside the About section
(e.g., a "show app version" toggle), that flag MUST be added to the
cleanup block per the rule.

## §7. Test contract

### T1 — Section renders with all three keys translated

`tests/integration/settings-about-section.spec.ts`:

- For each locale in `['zh', 'en', 'ja']`:
  - Mount `SettingsSheet` with `open: true`.
  - Assert the heading text equals the locale's
    `settings.about.heading` translation.
  - Assert each link text equals the corresponding translation.

### T2 — Links have the correct attributes

Same file:

- Assert the live-map link's `href` is exactly
  `https://swim-fish.github.io/pwa_map/`, `target` is `_blank`,
  and `rel` includes both `noopener` and `noreferrer`.
- Assert the source-code link's `href` is exactly
  `https://github.com/swim-fish/pwa_map`, with the same `target`
  and `rel`.

### T3 — i18n key parity

`tests/unit/i18n/settings-about-keys-parity.spec.ts`:

- Asserts `settings.about.heading`, `settings.about.liveMap`, and
  `settings.about.sourceCode` exist in all three locale JSONs.
- Asserts none of the values contains a `zh-TW` / `zh-Hant`
  substring (Constitution v1.1.0).

### T4 — Contrast regression net unchanged

`tests/integration/settings-contrast.spec.ts` continues to pass
without modification — verifies via CI gate that the About section
does not introduce hard-coded colours.

### T5 — Keyboard activation

`tests/integration/settings-about-section.spec.ts`:

- Focuses the live-map link programmatically and dispatches a synth
  Enter keydown.
- Asserts the link's `defaultPrevented` is `false` (so the browser
  follows the href as expected).

(In jsdom, the actual `window.open` is intercepted; the test asserts
the keydown reached the anchor and was not consumed by an ancestor.)

## §8. Failure modes

| Scenario | Behaviour |
|----------|-----------|
| Locale ships only one of the three new keys | Parity test (T3) fails. Constitution Principle V's "every locale ships every key" rule. |
| `zh.json` value contains Simplified Chinese characters | Parity test detects unique-Simplified codepoints and fails. |
| Anchor `href` rewritten to a relative path | Test T2 fails (asserts exact URL strings). Mitigation: code review checks; the URL is a literal in the template. |
| `target` or `rel` removed | Test T2 fails. |
| About section accidentally introduces a hard-coded colour | `settings-contrast.spec.ts` regression net catches it. |
| New UI flag added inside the About section without amending the `if (!open)` cleanup | Caught by `pwa-component-state.md` review checkpoint and (where applicable) by integration tests that re-open the sheet and assert state cleared. |
