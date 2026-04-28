# PWA Mobile + Desktop UX Lessons (2026-04-28)

A consolidated record of issues encountered shipping mobile / desktop
polish for this PWA across features 005, 009, 010, 011 — and the
patterns that prevent them from re-appearing. Read this before
starting any work that touches positioning, install affordances, the
coordinate readout, or new component-local UI state.

The accompanying rules under [`.claude/rules/`](../.claude/rules/)
encode the same checkpoints in path-scoped form so they auto-load
when editing the relevant source files.

---

## Index

1. [Safe-area positioning (iOS notch / Android edge-to-edge)](#1-safe-area-positioning)
2. [Bottom-anchored panels vs the bottom-right attribution](#2-bottom-anchored-panels)
3. [PWA install affordance — derived store vs upstream signal](#3-install-affordance)
4. [iOS Safari install path](#4-ios-safari-install-path)
5. [Component-local UI state cleanup on `!open`](#5-component-local-cleanup)
6. [Section-level keydown handlers ignore nested controls](#6-section-keydown-guard)
7. [Viewport-derived defaults must reset user overrides at every threshold](#7-viewport-derived-defaults)
8. [Coordinate readout segment filter is presentation-only](#8-segment-filter)
9. [SettingsSheet contrast tokens — no hard-coded colours](#9-settingssheet-contrast)
10. [matchMedia subscription pattern](#10-matchmedia-pattern)
11. [Bundle budget reality vs plan target](#11-bundle-budget)
12. [TDD discipline + verification gates](#12-tdd-gates)

---

## 1. Safe-area positioning

### Symptom

On iOS Safari with a notch / Dynamic Island and on Android Chrome
with edge-to-edge gesture navigation:

- Top toolbar slides under the notch — buttons unreachable, taps
  capture as system gestures (swipe-down for Control Centre, etc.).
- Bottom-pinned readout / zoom / attribution overlap the home
  indicator / gesture region.
- Same problem appears in PWA standalone mode (after Add to Home
  Screen / WebAPK install) where the system bars overlay the page.

### Root cause

Pre-feature 011, only the notification region (`feature 009 / ADR
0029`) honoured `env(safe-area-inset-*)`. Every other surface used
literal offsets (`top: var(--space-3)` etc.). With
`viewport-fit=cover` set in `index.html` the page paints
edge-to-edge — but components anchored at edges with literal
spacing collide with system bars.

### Fix pattern

`tokens.css` declares **four shared safe-area component tokens**:

```css
--top-stack-zone-top: env(safe-area-inset-top, 0px);
--bottom-stack-zone-bottom: env(safe-area-inset-bottom, 0px);
--inline-stack-zone-left: env(safe-area-inset-left, 0px);
--inline-stack-zone-right: env(safe-area-inset-right, 0px);
```

Every persistent UI surface composes them with its own `--space-*`
literal via `calc(...)`:

```css
.toolbar {
  top: calc(var(--space-3) + var(--top-stack-zone-top));
  right: calc(var(--space-3) + var(--inline-stack-zone-right));
}
```

The Settings sheet uses a different idiom because it must honour
**every** edge while preserving visual centring on no-inset devices:

```css
.sheet {
  top: max(var(--space-4), var(--top-stack-zone-top));
  bottom: max(var(--space-4), var(--bottom-stack-zone-bottom));
  left: max(var(--space-4), var(--inline-stack-zone-left));
  right: max(var(--space-4), var(--inline-stack-zone-right));
  margin: auto;
}
```

### Lesson

- **Never** use `env(safe-area-inset-*)` directly outside
  `tokens.css`. A grep guard in
  `tests/unit/safe-area-tokens.spec.ts` enforces this — adding a
  stray `env(safe-area-inset...` to any component fails the test.
- The `0px` fallback is non-negotiable. Without it, browsers that
  don't implement the variable resolve to `unset`, collapsing the
  layout.
- `viewport-fit=cover` in `index.html` is load-bearing — without it
  the page would not paint edge-to-edge and the safe-area edits
  would have no work to do. Same spec asserts the substring
  presence.

---

## 2. Bottom-anchored panels

### Symptom

The coordinate readout (bottom-left) covered the attribution badge
(bottom-right) on viewports between roughly 600–900 CSS pixels wide,
including landscape phones and small tablets. The readout's
`max-width: min(640px, calc(100vw - 24px))` extends across the
bottom row; attribution sits at the same vertical strip; horizontal
overlap = visual occlusion.

### Root cause

The readout's `bottom: var(--space-3)` (12 px) puts its baseline at
viewport-12 px. Attribution at `bottom: var(--space-2)` (8 px) +
~20 px height sits at viewport-28..viewport-8. Vertically they
overlap by 16 px. Combined with horizontal overlap → readout panel
hides attribution.

The first attempt gated a `+var(--space-5)` lift inside a
`@media (max-width: 600px)` block. That left tablet-class widths
(601–900 px) still overlapping.

### Fix pattern

Move the lift into the **base** `.readout` rule (no `@media` gate):

```css
.readout {
  bottom: calc(var(--space-3) + var(--space-5) + var(--bottom-stack-zone-bottom));
}
```

`var(--space-5) = 20 px` clears the attribution badge's height with
~4 px buffer. Universal — affects every viewport including desktop
(where it costs nothing because the right-edge attribution is far
from the readout horizontally).

### Lesson

- Any new bottom-anchored panel that can grow wider than half the
  viewport MUST add ≥ `var(--space-5)` clearance above its
  `bottom` to avoid covering the right-anchored attribution.
- Don't gate clearance fixes by `@media`. The overlap reproduces on
  any viewport where the panel's right edge meets the
  attribution's column. Universal lift is cheaper to maintain than
  an evolving breakpoint matrix.

---

## 3. Install affordance

### Symptom

A user who dismissed the transient install banner (feature 005)
had no in-app way to re-invoke the install flow without manually
clearing `pwa_map:installDismissedUntil`. Adding a Settings-page
"Install app" entry that consumed `installSignal.surface` directly
would inherit the 30-day dismissal — re-creating the same gap.

### Root cause

Feature 005's `installSignal.applyGates()` collapses both
"30-day banner dismissal" and "app installed" into the single
`'hidden'` literal. Two distinct user states share one signal value:

- **Dismissed-banner**: user said "stop popping at me", but still
  wants the option on demand.
- **Installed**: app is in standalone mode, no install action
  applies.

The transient banner correctly suppresses on `'hidden'`. The
on-demand Settings entry must NOT.

### Fix pattern

A new derived store
`src/pwa/installSettingsSurface.ts` exposes the **un-suppressed**
surface for the Settings entry:

```ts
export const installSettingsSurface: Readable<SettingsInstallSurface> = derived(
  installSignal,
  ($s) => {
    if ($s.installed) return 'standalone';
    const base = detectInstallSurface(readProbe($s.deferredPrompt !== null));
    if (base === 'standalone') return 'standalone';
    if (base === 'hidden') return 'unsupported'; // unreachable defence
    return base;
  },
);
```

The transient `InstallBanner` / `InstallIosSheet` keep using
`installSignal.surface`. Only the Settings entry subscribes to the
derived store. Both surfaces share the same `triggerInstall()` /
`markInstalled()` actions — install state is single-source-of-truth,
just _suppression_ differs.

### Lesson

- Two distinct UX states (silenced pop-up vs install action
  unavailable) need two distinct signals if they have different
  user-facing semantics.
- A Svelte `derived(...)` store is the right shape — zero new
  persisted state, zero new event listener, re-evaluates
  synchronously on every upstream change.
- The original signal is FROZEN by ADR 0025. Derive in a sibling
  module. Don't mutate the upstream signal's contract.
- Spec FR-015 must be cited every time someone proposes "let's
  share `installSignal.surface` everywhere". The split is
  intentional.

---

## 4. iOS Safari install path

### Symptom

Tempting to write "click Install on iOS Safari → install fires"
into the Settings install flow. iOS Safari does NOT fire
`beforeinstallprompt`. Apple offers no programmatic install API.

### Fix pattern

The iOS Safari branch of the Settings install section opens an
**instructional dialog** (Share icon → Add to Home Screen → Add)
mirroring the existing `InstallIosSheet.svelte`. Reuse the
`pwa.install.ios.{title,step1,step2,step3,shareIconAlt,dismiss}`
locale keys verbatim — do not invent parallel keys.

### Lesson

- Always document Apple's PWA install constraint in the spec — it
  is a platform fact, not a workaround.
- Reuse `pwa.install.ios.*` strings for any iOS instructional
  surface. They are the project's translated source-of-truth for
  the Add-to-Home-Screen procedure.

---

## 5. Component-local cleanup

### Symptom

`SettingsSheet.svelte` opened the iOS install instructions dialog
on button click, set `showIosInstructions = true`. User closed
Settings via the scrim or the close button (NOT Escape inside the
dialog). On the next Settings open, the iOS dialog appeared
immediately without the user pressing the install-help button —
stale UI.

### Root cause

The `Escape` keydown handler cleared `showIosInstructions`. The
scrim-click and close-button paths called `dispatch('close')`,
flipping `open: false`. The component's reactive cleanup block
(`$: if (!open) { ... }`) reset `statusMessage` and `confirmTarget`
but not `showIosInstructions`. The flag survived the unmount-equivalent.

### Fix pattern

Add every component-local UI flag to the existing `!open` cleanup:

```ts
$: if (!open) {
  statusMessage = '';
  confirmTarget = null;
  showIosInstructions = false;
}
```

### Lesson

- **Audit the `!open` cleanup block** every time you add a new
  component-local UI flag (overlay state, expansion state, dialog
  visibility, in-flight toggle). The Escape-key handler is one of
  several close paths.
- Pattern: any boolean that controls overlay rendering MUST be
  reset in the `!open` block, not only in the user-action handlers.

---

## 6. Section keydown guard

### Symptom

`CoordinateReadout.svelte`'s root `<section>` carries `role="button"`

- `on:keydown={onBodyKeydown}` + `on:click={onBodyTap}` to support
  keyboard activation of the panel-toggle. After feature 011 made
  this section toggleable on every viewport, pressing Enter on the
  nested copy button (a `<button>` descendant) triggered:

1. The native button click → `onCopy()` → copy works.
2. The Enter keydown bubbles up → `onBodyKeydown()` → `preventDefault()`
   - `onBodyTap()` → panel collapses or expands.

Result: every Enter on copy collapses/expands the panel — keyboard
users can't use the copy buttons normally.

### Root cause

`onBodyKeydown` did not check `ev.target` vs `ev.currentTarget`.
The `onCopy` mouse handler uses `ev.stopPropagation()` to suppress
click bubbling, but `KeyboardEvent` was not similarly guarded.

### Fix pattern

```ts
function onBodyKeydown(ev: KeyboardEvent): void {
  if (!toggleable) return;
  if (ev.target !== ev.currentTarget) return; // ignore bubbled keys from descendants
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    onBodyTap();
  }
}
```

### Lesson

- **Section-level keydown handlers MUST guard against bubbled
  events from interactive descendants.** The `target !== currentTarget`
  check is the simplest reliable filter.
- The mouse handler equivalent: child handlers call
  `ev.stopPropagation()` (e.g. `onCopy`'s first line). Both shapes
  are valid — pick one and apply consistently across the
  component.
- Add a regression test that synthesises a `KeyboardEvent` on the
  child and asserts `defaultPrevented === false` on the parent.

---

## 7. Viewport-derived defaults

### Symptom

Feature 011 reworked the readout's collapse mode so:

- Default state derived from `(isNarrow OR isShort)` (and `enabled.length ≥ 2`).
- User tap inverts a `userToggled` flag (the override).
- The override resets when `defaultCollapsed` flips.

Bug found in PR review: the user toggles formats off in Settings,
crossing `enabled.length` from 2 → 1 (`toggleable` flips false →
single-row, no-toggle), then re-enables a format (back to 2 →
`toggleable` true). The `userToggled` flag was never reset because
`defaultCollapsed` itself didn't flip on the format edit. Stale
override forces the readout into the non-default mode.

### Root cause

The reset condition tracked only one of two relevant variables. The
threshold change (`toggleable: false → true`) is a separate edge
that also invalidates the previous override.

### Fix pattern

Track BOTH the default state AND the toggleable threshold:

```ts
let lastDefaultCollapsed = defaultCollapsed;
let lastToggleable = toggleable;
$: if (defaultCollapsed !== lastDefaultCollapsed || toggleable !== lastToggleable) {
  lastDefaultCollapsed = defaultCollapsed;
  lastToggleable = toggleable;
  userToggled = false;
}
```

### Lesson

- A user-override flag MUST reset on EVERY threshold that changes
  the universe of valid states. Tracking only one threshold leaves
  stale overrides on the others.
- For the readout, the relevant thresholds are:
  - Viewport class change (`isNarrow OR isShort` flip)
  - Toggleable threshold (`enabled.length >= 2` flip)
- Add a regression test that crosses the exact threshold the bug
  hit (e.g. 2 → 1 → 2 enabled formats with a tap-override in the
  middle).

---

## 8. Segment filter

### Symptom

The coordinate readout displayed `分帶` (TWD97-TM2 zone digit) and
`精度` (Taipower precision digit) inline as labelled segments.
Both are **configured in Settings** rather than primary coordinate
data. Showing them inline added visual noise and risked confusion
("does that 11 mean an 11th something?").

### Fix pattern

Filter at the readout component (presentation-only). The pure
`coordinateSegments()` helper in `src/coord/segments.ts` keeps
emitting the full segment list — the Go To layouts and the
contract from feature 009's data-model still depend on parity:

```ts
const HIDDEN_SEGMENT_LABEL_KEYS = new Set<string>([
  'goto.fields.zone',
  'goto.fields.precision',
]);

// Inside rowFor():
segments: seg.segments.filter((s) => !HIDDEN_SEGMENT_LABEL_KEYS.has(s.labelKey)),
```

### Lesson

- **Display filters live in the display component, not in the
  data helper.** The pure helper is shared with Go To and any
  future consumer; pruning at the source breaks downstream
  parity contracts.
- Add new noisy segments to the `HIDDEN_SEGMENT_LABEL_KEYS` set in
  `CoordinateReadout.svelte`. The set is the single registry of
  "Settings-configured parameters that don't belong inline".
- The copy button MUST keep emitting the canonical full-format
  string (so Go To round-trip works with zero data loss). The
  hide is one-way: hide-on-display, full-on-copy.

---

## 9. SettingsSheet contrast

### Symptom

Adding `color: #ffffff` to a new button inside
`SettingsSheet.svelte`'s `<style>` block silently failed
`tests/integration/settings-contrast.spec.ts`'s "no hard-coded
contrast-bearing colours" rule (feature 007 / ADR 0014 regression
net).

### Fix pattern

Add a token to `tokens.css` first, then reference it:

```css
/* tokens.css */
--color-on-accent: #ffffff;

/* SettingsSheet.svelte */
.install-section-confirm {
  background: var(--color-accent);
  color: var(--color-on-accent);
}
```

### Lesson

- Any colour used in `SettingsSheet.svelte` MUST be a `var(--color-*)`
  reference. Hard-coded hex / rgba / hsl literals fail the
  regression spec.
- If no existing token fits, declare a new one in `tokens.css`
  (light + dark scheme variants where applicable). Then use it.
- Other components are not (yet) gated by the same spec, but follow
  the same pattern for forward compatibility.

---

## 10. matchMedia pattern

### Symptom

A reactive `matchMedia` subscription is needed when CSS `@media`
alone can't drive Svelte conditional logic (e.g., to derive
`defaultCollapsed`). Naive `window.matchMedia(...).matches` reads
once and never updates. SSR / jsdom paths crash if `window` is
undefined.

### Fix pattern

```ts
const QUERY = '(max-width: calc(600px - 0.02px))';
let isNarrow = false;
let mql: MediaQueryList | null = null;
let listener: ((e: MediaQueryListEvent | MediaQueryList) => void) | null = null;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  mql = window.matchMedia(QUERY);
  isNarrow = mql.matches;
  listener = (e) => {
    isNarrow = e.matches;
  };
  mql.addEventListener('change', listener as (e: MediaQueryListEvent) => void);
}

onDestroy(() => {
  if (mql && listener) {
    mql.removeEventListener('change', listener as (e: MediaQueryListEvent) => void);
  }
});
```

Note the `0.02px` half-pixel adjustment so the `@media` query and
the JS subscription agree at the integer threshold (the existing
project pattern from `--readout-collapse-bp`).

### Lesson

- Always lazy-check `typeof window !== 'undefined'` AND
  `typeof window.matchMedia === 'function'` before subscribing —
  some test stubs only provide the property part-way.
- Always cleanup in `onDestroy`. Forgetting leaks listeners on
  hot-reload.
- Use `(max-width: calc(<bp> - 0.02px))` to keep CSS and JS
  thresholds in lockstep.
- Composite query (e.g. `narrow OR short`) is two separate
  subscriptions, one per dimension. Don't try to OR inside the
  query string — the spec doesn't support it portably.

---

## 11. Bundle budget

### Symptom

Plan §"Performance Goals" said "Bundle delta ≤ +1 KiB gzipped on
the entry JS bundle". Actual delivered: **+3.15 KB** (≈ 3× over).
Project-enforced budget (`scripts/check-bundle-size.js`) is
+6 KB per-feature → PASSES — but the plan target was overshoot.

### Root cause

The post-implementation iOS instructions dialog inlines a Share-icon
SVG identical to `InstallIosSheet.svelte`. ~1 KB of CSS + SVG
duplicated. The dual-matchMedia subscription in `CoordinateReadout`
adds ~0.5 KB. The new `installSettingsSurface` derived store adds
~0.5 KB. Locale strings add ~0.1 KB.

### Lesson

- The plan's stated budget is the SLO. The script's enforced
  budget is the SLA. Stay below SLO; if you can't, document the
  reason in the plan's Complexity Tracking table BEFORE merging.
- Inline SVGs are bigger than they look once gzipped (paths +
  attributes). If duplicated across two components, extract a
  shared snippet (e.g. `<InstallIosInstructions>` shared between
  `InstallIosSheet.svelte` and the Settings dialog) to recover
  the bytes.
- Dual-purpose subscriptions (e.g. dual matchMedia) cost more than
  one. Justify each new subscription in the spec.
- `npm run bundle-size` after EVERY commit during a feature, not
  just at the end. Discovery on PR open is too late.

---

## 12. TDD gates

The project's review loop, in order, before any change is "done":

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build && npm run bundle-size
npm run deploy:check    # full pipeline
```

Constitution Principle II (TDD, NON-NEGOTIABLE): every behavioural
change lands a RED test before its implementation lands GREEN. Every
PR review fix in this feature added a regression test:

- `userToggled` reset on threshold crossing →
  `coordinate-readout-tap-expand.spec.ts` "userToggled clears when
  enabled-set crosses the 2-format threshold"
- Section keydown guard →
  `coordinate-readout-tap-expand.spec.ts` "keydown on copy button
  does NOT trigger panel toggle"
- `showIosInstructions` cleanup on close →
  `settings-install-section.spec.ts` "iOS instructions dialog is
  dismissed when the Settings sheet closes via scrim/close"

### Lesson

- A code-review fix without a regression test re-opens the door
  for the same bug to re-land. Always pair the fix with a test
  that fails on the old code and passes on the new.

---

## Cross-references

- Constitution: `.specify/memory/constitution.md`
- Feature 005 (PWA installable): ADR 0025, UI 0005, spec 005
- Feature 009 (mobile UI fixes): ADR 0029, UI 0009, spec 009
- Feature 010 (mobile collapsed readout): ADR 0030, UI 0010, spec 010
- Feature 011 (safe-area + Settings install): ADR 0031, UI 0011,
  spec 011
- Path-scoped checkpoints: `.claude/rules/`
