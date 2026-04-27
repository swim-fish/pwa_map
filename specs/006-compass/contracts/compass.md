# Contract: `Compass.svelte` — bearing-reactive compass control

**Component**: `src/components/Compass.svelte`
**Mounted from**: `src/app/App.svelte` (unconditionally — the
component does not have a "hidden" surface).
**Verifies**: spec FR-001..FR-005, FR-010..FR-015; research D1, D5, D6.

## §1. Render contract

The component MUST render a single `<button>` at all times. No
`{#if}` gating — the compass is always present (FR-001).

The button's transform MUST reactively reflect `$bearingSignal.bearing`:

```svelte
<button
  class="compass"
  data-testid="compass"
  aria-label={ariaLabel}
  on:click={onClick}
  style="--compass-bearing: {-$bearingSignal.bearing}deg"
>
  <!-- inline SVG, see §2 -->
</button>
```

The CSS rule `transform: rotate(var(--compass-bearing))` provides
the rotation. Using a CSS custom property (rather than inline
`style="transform: rotate(...)"`) keeps the rotation reactive and
testable: integration tests assert
`button.style.getPropertyValue('--compass-bearing')` rather than
parsing a complex `transform` matrix.

## §2. DOM structure

```svelte
<button
  type="button"
  class="compass"
  data-testid="compass"
  aria-label={$tStore('controls.compass.reset')}
  on:click={onClick}
  on:keydown={onKeydown}
  style="--compass-bearing: {-$bearingSignal.bearing}deg"
>
  <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
    <!-- outer ring -->
    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.5" />
    <!-- N label -->
    <text x="24" y="11" text-anchor="middle" fill="currentColor"
          font-size="9" font-weight="700">N</text>
    <!-- north arrow (chevron from centre to upper) -->
    <path d="M24 14 L20 24 L24 22 L28 24 Z" fill="currentColor" />
    <!-- centre dot -->
    <circle cx="24" cy="24" r="2" fill="currentColor" />
  </svg>
</button>
```

Required `data-testid` selectors:

| Selector  | Purpose                          |
| --------- | -------------------------------- |
| `compass` | the `<button>` itself             |

## §3. Behaviour

| Trigger                              | Action                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on:click`                           | Calls `controller.resetBearing(animated)` where `animated = !reducedMotion` (component reads `prefers-reduced-motion: reduce` at script-init, mirroring `InstallBanner.svelte` from feature 005).                                                                                                                                                                       |
| `on:keydown` with `Enter` or `Space` | Same as `on:click`. The default `<button>` keyboard semantics already handle this; the explicit handler is a defence-in-depth so we can prevent double-fire from `keydown` + `keypress` legacy paths.                                                                                                                                                                  |
| `on:click` when bearing already 0    | The component still calls `resetBearing(animated)`. The controller's silent-no-op logic (research D4 + map-controller-amendment.md §5) handles the no-op; the component does NOT pre-check bearing. This keeps the component oblivious to controller internals and lets the `0.5°` tolerance live in one place. The result: no animation, no console error.            |

## §4. Visual / layout

| Property        | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Position        | (none — positioned by the parent `.map-controls` wrapper in `App.svelte`; see research D1 + zoom-controls.md §5)        |
| Size            | `width: 36px; height: 36px;` (SC-005 tap target)                                                                       |
| Background      | `var(--color-surface-elev, rgba(255, 255, 255, 0.95))` — same as toolbar buttons                                       |
| Foreground      | `var(--color-fg, #0f172a)` — `currentColor` cascades into the SVG strokes / fills                                      |
| Border          | `1px solid var(--color-border, #cbd5e1)`                                                                               |
| Border radius   | `50%` (circular button — visually echoes the compass shape)                                                            |
| Shadow          | `0 1px 3px rgba(15, 23, 42, 0.12)` — same as toolbar buttons                                                            |
| Rotation        | `transform: rotate(var(--compass-bearing));` — reactive via CSS custom property; default value is `0deg`               |
| Transition      | `transition: transform 200ms ease-out;` (default); skipped under `prefers-reduced-motion: reduce` per §6              |

The button does **not** scale or flash on hover; the `:active`
state has a subtle `transform: rotate(var(--compass-bearing))
scale(0.96)` for tap feedback, also gated by reduced motion.

## §5. Accessibility (FR-004, FR-010..FR-015)

| Aspect              | Requirement                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Element             | A real `<button type="button">` (NOT a styled `<div>`). Keyboard activation works via the browser's default semantics.                                  |
| `aria-label`        | Bound to `$tStore('controls.compass.reset')` — localised "Reset to north" / "重置為正北" / "北を上に戻す". Static (does not change with bearing).         |
| Tap target          | ≥ 36 × 36 px (SC-005). Verified by integration test using `getBoundingClientRect`.                                                                       |
| Keyboard            | `Tab` reaches the button; `Enter` / `Space` activate. `Escape` is NOT bound (the compass has no "open" state).                                          |
| Contrast            | SVG strokes (`currentColor`) MUST meet ≥ 4.5:1 against `--color-surface-elev` in both light AND dark schemes. Verified by the same source-token check pattern feature 005 uses (`tests/integration/install-contrast.spec.ts` precedent). |
| Reduced motion      | `transform` transition skipped per §6 CSS rule (FR-014).                                                                                                |

## §6. Reduced-motion CSS

```css
@media (prefers-reduced-motion: reduce) {
  .compass {
    transition: none !important;
  }
  .compass:active {
    transform: rotate(var(--compass-bearing)) !important;
  }
}
```

Combined with the JS path that calls `resetBearing(false)` when
reduced motion is on, both the icon snap AND the underlying map
snap are immediate.

## §7. i18n keys

The component reads two keys via `$tStore(...)`. Keys MUST exist
in all three locale files; missing-key fallback returns the key
verbatim per the existing i18n behaviour.

| Key                            | zh                | en                       | ja                          |
| ------------------------------ | ----------------- | ------------------------ | --------------------------- |
| `controls.compass.label`       | `指南針`          | `Compass`                | `コンパス`                  |
| `controls.compass.reset`       | `重置為正北`      | `Reset to north`         | `北を上に戻す`              |

The `controls.compass.bearingFmt` key (research D8) is reserved
for a future enhancement (live bearing announcement via
`aria-live`). Phase 0 of feature 006 leaves it unused; the key is
still added to the JSON files for forward compatibility.

## §8. Required tests

`tests/integration/compass.spec.ts` MUST cover at minimum:

1. **Mount with `bearing === 0`**: button renders, `data-testid="compass"`,
   `aria-label === 'Reset to north'` (en), `--compass-bearing: -0deg`.
2. **Bearing change to 90**: after `controller.emitBearing(90)`, the
   button's `--compass-bearing` MUST be `-90deg` (CSS custom property
   reads via `style.getPropertyValue('--compass-bearing')`).
3. **Bearing change to 270**: same path, `--compass-bearing: -270deg`.
4. **Click fires `controller.resetBearing(true)`** when reduced-motion
   is OFF (verify via spy on a stub controller).
5. **Click fires `controller.resetBearing(false)`** when reduced-
   motion is ON (`vi.stubGlobal('matchMedia', q =>
   ({ matches: q.includes('reduce') }))`).
6. **Enter / Space activates** the same path as click.
7. **Tap target**: `getBoundingClientRect()` width and height ≥ 36.
8. **Locale switch**: setLocale('zh') → aria-label becomes
   `'重置為正北'`. setLocale('ja') → `'北を上に戻す'`.

## §9. Out of scope

- The component does NOT subscribe to MapLibre directly. All bearing
  reads go through `bearingSignal`.
- The component does NOT render a tilt indicator. Pitch is always 0.
- The component does NOT animate its own rotation manually — it
  uses CSS `transition: transform 200ms ease-out` and relies on
  Svelte's reactivity to set the `--compass-bearing` CSS custom
  property. (Manual animation would conflict with the smooth
  bearing-during-drag tracking.)
