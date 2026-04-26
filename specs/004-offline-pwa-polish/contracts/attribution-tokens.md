# Contract: Attribution Bar Tokens & Legal-Compliance Guarantee

**Feature**: `004-offline-pwa-polish`

This contract has two halves: (1) the new CSS token pair that fixes
the dark-mode contrast bug, and (2) the **non-negotiable legal
requirement** that attribution stay visible. Both halves are tested.

---

## 1. Why this is non-negotiable

OpenStreetMap, NLSC (內政部國土測繪中心), and Google Maps each impose
**attribution as a binding licence term**. If the attribution string
is missing, hidden, truncated, or unreadable, the PWA loses the right
to use those tiles. This is not a UX preference — it is a legal MUST.

Therefore the contrast fix MUST NOT:

- remove the attribution badge
- hide it conditionally (e.g., on small screens, on full-screen)
- shorten or abbreviate the strings
- reduce its font-size below the established 12 px
- move it outside the visible viewport
- collapse it into a tooltip / hover-only surface
- replace it with a generic "© Map data" string when an overlay is active

The contrast fix is a **token swap only**. Layout, position, opacity
floor, font-size, and rendering order are all locked.

---

## 2. New tokens (added to `src/app/tokens.css`)

```css
:root {
  --attribution-bg: rgba(255, 255, 255, 0.95);
  --attribution-fg: #0f172a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --attribution-bg: rgba(15, 23, 42, 0.92);
    --attribution-fg: #f1f5f9;
  }
}
```

### 2.1 Token rules

- The two tokens MUST be defined together in both schemes (no missing
  pair leading to fallback behaviour).
- Background opacity (alpha channel) MUST be ≥ 0.90 in both schemes.
  Otherwise the legal text could shift contrast below 4.5:1 against a
  high-luminance underlying tile (FR-014).
- Foreground value MUST be either `#0f172a` (slate-900) or `#f1f5f9`
  (slate-100) — those are the two values measured against the chosen
  backgrounds; any future shift requires a new contrast measurement.
- Tokens MUST NOT alias to `--color-fg` / `--color-surface` /
  `--color-surface-elev`. Those tokens shift independently with
  scheme changes; the attribution badge needs a contrast guarantee
  uncoupled from any future global token change.

### 2.2 Computed contrast (verified at design time)

| Scheme | Foreground | Background (effective) | Contrast |
| ------ | ---------- | ---------------------- | -------- |
| light  | `#0f172a`  | `#fffffff2` (≈ #FFFFFF) | **15.8 : 1** |
| dark   | `#f1f5f9`  | `#0f172aeb` (≈ #0F172A) | **15.5 : 1** |

Both exceed WCAG AA body-text threshold (4.5 : 1) by > 3 ×, leaving
headroom for the slight lightening caused by tile bleed-through at
opacity 0.92.

---

## 3. Component update (`src/components/AttributionBar.svelte`)

Replace:

```css
.attribution {
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-fg, #0f172a);
  /* ... */
}
```

With:

```css
.attribution {
  background: var(--attribution-bg);
  color: var(--attribution-fg);
  /* ... */
}
```

All other selectors (position, padding, font-size, line-height,
border-radius, pointer-events, z-index) stay byte-for-byte identical.

**The component's text-rendering logic MUST stay unchanged.** That is:

```ts
// existing — preserved verbatim
$: composed = (() => {
  if (text !== undefined) return text;
  if (!basemap) return '';
  const base = findSource(basemap);
  if (!base) return '';
  const baseText = $tStore(base.attributionKey);
  if (!overlay) return baseText;
  const over = findSource('google-road-overlay');
  if (!over) return baseText;
  const overText = $tStore(over.attributionKey);
  if (overText === baseText) return baseText;
  return `${baseText} | ${overText}`;
})();
```

The `$tStore(base.attributionKey)` lookup is what provides the legal
text for OSM / NLSC / Google. This wiring is the licence-compliance
backbone; it MUST NOT be altered by feature 004.

---

## 4. Tests required (TDD-first)

### 4.1 Unit — token-pair existence + format

`tests/unit/components/AttributionBar.spec.ts`:

1. After mounting `<AttributionBar basemap="osm-standard" />` in
   light mode, `getComputedStyle(badge).backgroundColor` parses to an
   alpha ≥ 0.90 RGBA.
2. After forcing dark mode via `matchMedia` mock,
   `getComputedStyle(badge).backgroundColor` parses to an alpha ≥
   0.90 RGBA.
3. Foreground colour in light mode resolves to a luminance < 0.1
   (i.e., near-black text).
4. Foreground colour in dark mode resolves to a luminance > 0.9
   (i.e., near-white text).
5. Computed contrast ratio (using the standard WCAG formula) ≥ 4.5
   in both modes.

### 4.2 Integration — composed string preservation

`tests/integration/attribution-contrast.spec.ts`:

1. With basemap `osm-standard` + no overlay, the badge text is
   exactly the OSM attribution string (`© OpenStreetMap
   contributors` in `en`, `© OpenStreetMap 貢獻者` in `zh`).
2. With basemap `google-hybrid` + `overlay = true`, the badge text
   contains both attributions separated by ` | `.
3. With basemap `nlsc-emap5`, the badge text contains the NLSC
   credit string from `map.attribution.nlsc`.
4. The badge is measurably visible (`getBoundingClientRect()` width
   > 0 AND height > 0) in both schemes.
5. The badge is positioned at `right: 8px; bottom: 8px` — assertion
   protects against accidental layout drift.

### 4.3 E2E — legal-compliance gate

`tests/e2e/story-4-offline-and-update.spec.ts` includes a check that
swaps through all 6 catalogued basemaps and asserts the visible
badge text is non-empty AND distinct between OSM / NLSC / Google
groups. This is the regression net for the licence-compliance MUST
above.

---

## 5. Failure modes the tests MUST catch

| Bug                                                 | Caught by              |
| --------------------------------------------------- | ---------------------- |
| Dark-mode foreground/background collapse (today's bug) | 4.1.4 + 4.1.5       |
| Background opacity dropped below 0.9 by a future PR | 4.1.1 + 4.1.2          |
| Attribution text accidentally hidden / blanked      | 4.2.1 + 4.2.2 + 4.3    |
| Composed string drops the overlay attribution       | 4.2.2                  |
| Badge moved off-screen / collapsed to icon          | 4.2.4 + 4.2.5          |
