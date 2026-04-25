# Contract: Locale picker

**Feature**: `003-i18n-and-map-layers`
**Surface**: `src/components/LocalePicker.svelte` + the toolbar button
that toggles it.
**Consumers**: `App.svelte` (mounts), integration + E2E tests.

This contract defines the picker UI for FR-010..FR-013 and US2.

---

## 1. Props / events

```svelte
<LocalePicker
  open={boolean}
  selection={Locale}
  on:change={CustomEvent<Locale>}
  on:close={CustomEvent<void>}
/>
```

---

## 2. Markup + roles

- Toolbar trigger: `<button data-testid="open-locale"
  aria-haspopup="menu" aria-expanded={open}>`. Label:
  `toolbar.locale.button` (`語言` / `Language` / `言語`).
- Picker: `<div role="menu" data-testid="locale-picker"
  aria-labelledby="locale-picker-title">`.
- Each option: `<button role="menuitemradio"
  aria-checked={selection === locale} data-testid="locale-row-{locale}"
  data-locale={locale} on:click={() => pick(locale)}>{selfName}</button>`
  for `locale` in `['zh', 'en', 'ja']`.

The self-names are intentional plain literals (NOT i18n keys):

- `zh` → `中文`
- `en` → `English`
- `ja` → `日本語`

This way the operator can always recognise their own language even
when the current locale is one they cannot read.

---

## 3. Behaviour

| Event | Effect |
|---|---|
| Toolbar button click | Opens the picker (`open = true`); focus moves to the active locale row. |
| Pick a locale row | Dispatches `change` with the new locale; closes the picker. |
| Click outside / Escape | Dispatches `close`. |

---

## 4. Accessibility

- WCAG AA contrast.
- Active locale announced via `aria-checked`.
- Menu trapped focus while open.
- Self-names rendered as `lang="<locale>"` so screen readers
  announce them in the right voice.

---

## 5. Test obligations

### Integration

1. Picker renders three rows in `[zh, en, ja]` order with literal
   self-names.
2. Active locale row has `aria-checked="true"`; others false.
3. Picking `en` dispatches `change` with `'en'`.
4. After picking `en` and re-rendering with `selection: 'en'`,
   `aria-checked="true"` moves to the `en` row.
5. Escape dispatches `close`.

### E2E

US2 acceptance scenarios §1–§3 are covered by E2E.
