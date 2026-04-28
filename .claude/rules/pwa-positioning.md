---
paths:
  - "src/components/**/*.svelte"
  - "src/app/App.svelte"
  - "src/app/tokens.css"
  - "tests/integration/safe-area-layout.spec.ts"
  - "tests/unit/safe-area-tokens.spec.ts"
---

# PWA positioning + safe-area checkpoints

Hard-won patterns from features 009 / 010 / 011 mobile polish work.
Long-form context: [`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§§ 1, 2, 9, 10.

## SAFE-AREA: shared tokens only

Any new `position: fixed` / `position: absolute` rule that anchors a
component at a viewport edge MUST compose its `top` / `bottom` /
`left` / `right` declaration with the corresponding shared
safe-area-component token via `calc(...)`:

```css
top:    calc(<existing-spacing> + var(--top-stack-zone-top));
bottom: calc(<existing-spacing> + var(--bottom-stack-zone-bottom));
left:   calc(<existing-spacing> + var(--inline-stack-zone-left));
right:  calc(<existing-spacing> + var(--inline-stack-zone-right));
```

NEVER use `env(safe-area-inset-*)` directly outside `tokens.css`.
A grep guard in `tests/unit/safe-area-tokens.spec.ts` enforces this
across every `*.svelte` and `*.css` file under `src/`. Even comments
mentioning the literal `env(safe-area-inset` substring fail the
guard — paraphrase as "the device safe-area inset" instead.

`viewport-fit=cover` in `index.html` is load-bearing — do not change
it to `auto`. Same spec asserts the substring presence.

## BOTTOM PANELS: clear the attribution badge

Any new bottom-anchored panel that can grow wider than ~half the
viewport (e.g., `.readout`, future log / status panels) MUST add at
least `var(--space-5)` (≈ 20 px) extra above its `bottom` so the
right-anchored `.attribution` badge stays visible:

```css
.your-panel {
  bottom: calc(<existing-spacing> + var(--space-5) + var(--bottom-stack-zone-bottom));
}
```

Do NOT gate this fix by `@media (max-width: …)`. The overlap
reproduces on any viewport where the panel's right edge meets the
attribution column (~600–900 px landscape included). Universal lift
is cheaper to maintain than a breakpoint matrix.

## SETTINGS-SHEET: max() centring on every edge

The `.sheet` selector in `SettingsSheet.svelte` uses
`max(<spacing>, <safe-area>)` on every edge plus `margin: auto` for
centring. Do NOT revert to `transform: translate(-50%, -50%)` —
that idiom does not honour the bottom inset on a notched device.

```css
.sheet {
  top: max(var(--space-4), var(--top-stack-zone-top));
  bottom: max(var(--space-4), var(--bottom-stack-zone-bottom));
  left: max(var(--space-4), var(--inline-stack-zone-left));
  right: max(var(--space-4), var(--inline-stack-zone-right));
  margin: auto;
  max-width: min(440px, calc(100vw - 2 * max(var(--space-4), var(--inline-stack-zone-left), var(--inline-stack-zone-right))));
  max-height: calc(100vh - 2 * max(var(--space-4), var(--top-stack-zone-top), var(--bottom-stack-zone-bottom)));
}
```

## matchMedia: lazy + cleanup + 0.02 px

When a component needs reactive viewport state (CSS `@media` alone
can't drive Svelte conditional logic):

```ts
const QUERY = '(max-width: calc(<bp>px - 0.02px))';
let matches = false;
let mql: MediaQueryList | null = null;
let listener: ((e: MediaQueryListEvent | MediaQueryList) => void) | null = null;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  mql = window.matchMedia(QUERY);
  matches = mql.matches;
  listener = (e) => { matches = e.matches; };
  mql.addEventListener('change', listener as (e: MediaQueryListEvent) => void);
}

onDestroy(() => {
  if (mql && listener) mql.removeEventListener('change', listener as (e: MediaQueryListEvent) => void);
});
```

- ALWAYS lazy-check `typeof window !== 'undefined'` AND
  `typeof window.matchMedia === 'function'` (jsdom safety).
- ALWAYS cleanup in `onDestroy`.
- Use `(max-width: calc(<bp>px - 0.02px))` to keep CSS `@media` and
  JS subscription thresholds in lockstep.
- Composite conditions (e.g. narrow OR short) need TWO subscriptions,
  one per dimension. Don't try to OR inside a single query string.
