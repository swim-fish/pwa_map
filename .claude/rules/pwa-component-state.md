---
paths:
  - "src/components/**/*.svelte"
---

# PWA component-local state checkpoints

Patterns caught by PR review on feature 011. Long-form context:
[`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§§ 5, 6, 7.

## CLEANUP: every UI flag MUST reset on `!open`

Components with an `open: boolean` prop AND component-local UI
flags (overlay visibility, dialog state, in-flight toggles,
expansion state) MUST reset every flag inside the existing
`$: if (!open) { ... }` cleanup block — NOT only inside the
Escape-key handler:

```ts
$: if (!open) {
  statusMessage = '';
  confirmTarget = null;
  showIosInstructions = false; // ← every overlay flag goes here
  // ... any other component-local UI booleans ...
}
```

Why: scrim-click, close-button, parent unmount, and Escape are all
distinct close paths. The Escape handler covers one. The reactive
`!open` block covers all. Skipping a flag means stale UI on the
next open (e.g. an instructional dialog auto-popping without the
user pressing the trigger button).

## SECTION KEYDOWN: ignore bubbled events from descendants

Components rendering a `<section role="button" on:keydown=...>` (or
similar interactive container) MUST guard the keydown handler so
keys bubbling from interactive descendants (`<button>`, `<input>`,
etc.) keep their native behaviour:

```ts
function onSectionKeydown(ev: KeyboardEvent): void {
  if (!toggleable) return;
  if (ev.target !== ev.currentTarget) return; // ← ignore bubbled keys
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    onSectionTap();
  }
}
```

Without this guard, pressing Enter on a nested copy / dismiss /
toggle button:

1. Triggers the native button click.
2. Bubbles up → `preventDefault()` on the section → toggles section
   state.

This is a keyboard-a11y regression — keyboard users can't activate
nested controls without side effects.

The mouse equivalent: child handlers call `ev.stopPropagation()`
inside their own click handler (e.g. `onCopy`). Both shapes are
valid; pick one consistently per component.

Add a regression test that synthesises a bubbling `KeyboardEvent`
on the descendant and asserts `defaultPrevented === false` plus
the section's state is unchanged.

## VIEWPORT-DERIVED DEFAULTS: reset overrides at every threshold

A component that derives its default UI state from one or more
viewport conditions AND offers a user-override toggle MUST reset
the override when ANY of the relevant thresholds flip — not just
the most-obvious one:

```ts
// CoordinateReadout.svelte pattern.
$: defaultCollapsed = enabled.length >= 2 && (isNarrow || isShort);
$: toggleable = enabled.length >= 2;

let lastDefaultCollapsed = defaultCollapsed;
let lastToggleable = toggleable;
$: if (defaultCollapsed !== lastDefaultCollapsed || toggleable !== lastToggleable) {
  lastDefaultCollapsed = defaultCollapsed;
  lastToggleable = toggleable;
  userToggled = false;
}
```

Tracking only `defaultCollapsed` leaves stale overrides when the
user crosses the toggleable boundary (e.g. drops to 1 enabled
format, then back to 2) — the override carries through and forces
the non-default mode on re-entry.

The relevant thresholds in this codebase, for reference:

- Viewport class change (`isNarrow OR isShort` flip).
- Toggleable threshold (`enabled.length >= 2` flip).
- Add new threshold variables to the reset condition whenever the
  default-state derivation gains a new input.

Add a regression test that crosses the exact threshold the bug
hits — e.g. the readout test "userToggled clears when enabled-set
crosses the 2-format threshold".

## PROP CHANGES: `$set` triggers reactive re-eval

In Svelte 4 unit tests, mounting a component once and calling
`cmp.$set({ visible: [...] })` triggers reactive re-evaluation
just like a parent prop change in production. Use this in tests
to drive threshold crossings without re-mounting:

```ts
mount({ visible: ['wgs84-dd', 'wgs84-dms'], ... });
cmp?.$set({ visible: ['wgs84-dd'] });          // 2 → 1: toggleable false
cmp?.$set({ visible: ['wgs84-dd', 'wgs84-dms'] }); // 1 → 2: toggleable true
```
