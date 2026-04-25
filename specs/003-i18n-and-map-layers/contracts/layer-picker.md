# Contract: Layer picker

**Feature**: `003-i18n-and-map-layers`
**Surface**: `src/components/LayerPicker.svelte` + the toolbar button
that toggles it.
**Consumers**: `App.svelte` (mounts), integration + E2E tests.

This contract defines the picker UI for FR-001..FR-005 and US1.

---

## 1. Props / events

```svelte
<LayerPicker
  open={boolean}
  selection={LayerSelection}
  on:change={CustomEvent<LayerSelection>}
  on:close={CustomEvent<void>}
/>
```

---

## 2. Markup + roles

- Toolbar trigger: `<button data-testid="open-layers"
  aria-haspopup="menu" aria-expanded={open}>`. Label:
  `toolbar.layers.button` (`圖層` / `Layers` / `レイヤー`).
- Picker: `<div role="menu" data-testid="layer-picker"
  aria-labelledby="layer-picker-title">`.
- Inside the menu:
  - Group headers: `<div role="presentation"
    data-testid="layer-group-{group}">{groupLabel}</div>` for each
    of `nlsc`, `google`, `other` (in catalogue order).
  - Basemap rows: `<button role="menuitemradio"
    aria-checked={isActive} data-testid="layer-row-{id}"
    data-layer-group={group} data-layer-id={id}
    on:click={() => pick(id)}>{label} {attribution}</button>`.
  - Separator: `<hr role="separator">`.
  - Overlay row: `<button role="menuitemcheckbox"
    aria-checked={overlay} data-testid="layer-overlay"
    on:click={() => toggleOverlay()}>{label}</button>`.

The active basemap's row carries `aria-checked="true"`; all others
`aria-checked="false"`.

---

## 3. Behaviour

| Event | Effect |
|---|---|
| Toolbar button click | Opens the picker (`open = true`); focus moves to the active basemap row. |
| Pick a basemap row | Dispatches `change` with `{ basemap: <picked>, overlay: <unchanged> }`; closes the picker. |
| Toggle the overlay row | Dispatches `change` with `{ basemap: <unchanged>, overlay: !overlay }`; keeps the picker open. |
| Click outside / Escape | Dispatches `close`. |
| Tab navigation | Standard ARIA menu pattern; `Up` / `Down` arrows cycle within the menu. |

The picker MUST NOT directly mutate prefs / controller state; it
only emits `change` and the parent (`App.svelte`) is responsible for
applying the change.

---

## 4. Accessibility

- WCAG AA contrast on labels and active-state highlight.
- Active basemap announced via `aria-checked` per row.
- Overlay toggle announced via `aria-checked`.
- Menu trapped focus while open; Escape closes; backdrop click
  closes.
- All copy resolves through the i18n store (FR-013 from feature 002
  applies — never hardcode strings).

---

## 5. Visual + design notes

Reuse `--color-accent` and `--color-surface-elev` from
`src/app/tokens.css`. The active basemap row uses `--color-accent`
for the leading dot, matching `FormatToggle`'s active style.

---

## 6. Test obligations

### Integration (`tests/integration/layers-and-locale.spec.ts`)

1. Picker renders 6 basemap rows in catalogue order
   (`osm-standard`, `nlsc-emap5`, `google-hybrid`,
   `google-satellite`, `google-terrain`, `google-roadmap`).
2. Picker renders 1 overlay row separately.
3. Active basemap row has `aria-checked="true"`; others false.
4. Picking a different basemap dispatches `change` with the
   selected id and the existing `overlay` value.
5. Toggling the overlay dispatches `change` with the existing
   basemap and inverted `overlay`; picker stays open.
6. Escape dispatches `close`.

### E2E (`tests/e2e/story-3c-layers-and-locale.spec.ts`)

Acceptance scenarios from US1 §1–§4 are covered by E2E.
