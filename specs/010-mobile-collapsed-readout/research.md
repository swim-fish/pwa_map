# Phase 0 Research — Mobile Collapsed Coordinate Readout

**Feature**: 010-mobile-collapsed-readout
**Date**: 2026-04-27
**Plan**: [plan.md](./plan.md)

This document resolves the design choices the plan defers to research
and captures the rejected alternatives. There were no
`[NEEDS CLARIFICATION]` markers in the spec — every research item
below is an *implementation* decision that affects bundle size,
accessibility, or schema-evolution safety.

## R1 — Drag-and-drop mechanism

**Decision**: Implement drag-to-reorder with a self-contained Pointer
Events handler living inside `FormatPriorityRow.svelte` (per-row
listeners) plus a parent-side commit step in `FormatToggle.svelte`.
No third-party library.

**Rationale**:

- **Bundle budget** (Constitution Principle IV): the entire feature
  has a +1 KiB gzipped budget for the entry JS bundle. The leading
  third-party Svelte DnD library, `svelte-dnd-action` 0.9.x,
  weighs **~5.6 KiB gzipped** by itself — more than 5× the budget
  before this feature even adds its own logic. Even tree-shaken
  variants (e.g. `dnd-kit` ports) clear 2 KiB after Svelte 4
  interop. A self-contained Pointer Events handler is < 80 lines of
  TS + a `transform: translateY()` style, well inside budget.
- **API surface**: only six rows ever exist. The classical use
  cases for a DnD library — nested lists, multi-select, drop zones,
  cross-list drag, file drop — do not apply here. A linear, single
  list with whole-row drag is the simplest possible drag pattern.
- **Pointer Events coverage**: PE API support is universal in the
  project's target matrix (Chromium 120+, WebKit 17+, Firefox 120+).
  No fallback to `TouchEvent` / `MouseEvent` is needed.
- **Touch-action discipline**: setting `touch-action: none` on the
  drag handle (`.drag-handle`) prevents the browser from
  interpreting the gesture as a scroll or pan-zoom — a known
  pitfall on iOS that DnD libraries also have to solve, and that
  we get for free with the right CSS on the handle alone.
- **Accessibility deferral compatibility**: ADR 0030 records that
  keyboard reordering (`↑` / `↓`) is future work; a hand-rolled
  PE handler does not lock us into a library's accessibility
  story when we revisit it.

**Alternatives considered**:

- `svelte-dnd-action` (5.6 KiB gz). Rejected for bundle budget;
  also has its own announcement system that would conflict with
  this feature's `aria-live` line.
- HTML5 native drag API (`dragstart` / `dragover` / `drop`).
  Rejected because (a) it is brittle on touch — iOS Safari's HTML5
  drag still has known gaps for non-list-item elements, (b) we'd
  still need a touch-only path, doubling the surface, and (c) it
  cannot animate the dragged element's position smoothly without a
  library on top.
- A library-free "move up / move down" button pair per row, no
  drag at all. Rejected because the spec explicitly asks for drag
  ("可以拖移顯示順序") and because two extra tap targets per row
  inflates the row vertical footprint past what the narrow-viewport
  drawer can fit without scrolling.

## R2 — Collapse trigger (viewport detection)

**Decision**: Use a CSS `@media (max-width: 599.98px)` query to
control the visual collapse, and a Svelte reactive declaration
`$: shouldCollapse = matchMediaQuery && enabled.length >= 2` to
control the *render path* (so we can render only the priority-1 row
and avoid mounting the rest of the rows in their full DOM form on
narrow viewports).

**Rationale**:

- **No `ResizeObserver`**: an observer on the readout itself would
  be reactive to its own size changes — a feedback loop. An
  observer on the viewport is what `matchMedia` already gives us,
  one event per breakpoint cross.
- **No JS hit-test against zoom-controls**: the spec's overlap rule
  (FR-003) is a contract on the layout, not a runtime measurement.
  Choosing 600 px as the breakpoint (research §R6 below) gives a
  static guarantee on all phone-class viewports without per-frame
  geometry math.
- **Two-axis trigger**: viewport AND enabled count. If only one
  format is enabled the readout is already a single row — no
  collapse styling needed. The reactive flag enforces this at the
  Svelte level so the DOM never carries an empty "collapsed
  expander" affordance.
- **`599.98px` over `599px`**: avoids a half-pixel-rounding gap on
  retina viewports where browsers may report the inner width as
  `599.5` and miss both `< 600` and `≥ 600` rules at the boundary.
  A canonical pattern from Bootstrap and Material's compact
  breakpoint.

**Alternatives considered**:

- `ResizeObserver` on the readout container. Rejected: feedback
  loop risk, plus more code than `matchMedia`.
- JS-only breakpoint via `window.innerWidth` polled on `resize`.
  Rejected: throttling and SSR safety overhead. `matchMedia`
  fires once per breakpoint cross.
- A tablet sub-breakpoint (e.g. collapse at 480 px, partially
  collapse at 600 px). Rejected: the user's complaint is binary
  ("phone overlaps zoom"); a single break is the simplest design
  that solves it. Future tuning can add a sub-break later without
  schema changes.

## R3 — i18n key reuse

**Decision**: Reuse the following existing keys for the drag list
UI; introduce **zero** new keys.

| UI element                                  | Existing key                                  | Source feature |
| ------------------------------------------- | --------------------------------------------- | -------------- |
| Each row's format name                      | `format.labels.<kind>`                        | feature 001    |
| Drawer title                                | `toggle.title`                                | feature 001    |
| Drawer hint paragraph                       | `toggle.hint`                                 | feature 001    |
| Close button label                          | `toggle.close`                                | feature 001    |
| Drag handle `aria-label`                    | `toggle.title` (composed: "{title} · {kind}") | feature 001    |
| Live-region announcement                    | composed at runtime via `tStore` interpolation; uses `format.labels.<kind>` only | feature 001 |

**Rationale**:

- The locale-conventions rule (Constitution v1.1.0) and FR-013
  forbid new i18n keys for this feature. Locale catalogues for
  `zh`, `en`, `ja` already cover the format names and toggle UI
  vocabulary.
- The drag-handle `aria-label` and the live-region announcement
  use **composition**, not new keys: the screen reader hears
  "{format name} · {position} of {total}" — assembled from
  existing `format.labels.*` strings + the running ordinal. This
  is the same pattern feature 002's `goto.fields.*` followed in
  feature 009's segmented readout.

**Alternatives considered**:

- Adding `dragHandle.label`, `dragHandle.moved`,
  `dragHandle.position` keys. Rejected: violates FR-013; would
  require translator review for three locales for cosmetic strings.

## R4 — Preferences schema evolution

**Decision**: Bump `PREFS_VERSION` from `2` to `3`. Define
`FormatPreferencesV3` extending `FormatPreferencesV2` with one new
required field `formatOrder: readonly CoordinateKind[]` whose value
is constrained to:

- length **exactly** equal to `ALL_COORDINATE_KINDS.length` (= 6),
- contents are a permutation of `ALL_COORDINATE_KINDS` (every kind
  present, no duplicates),
- order encodes priority (index 0 = highest).

Migration rule (validator-side):

- v1 / v2 record without `formatOrder` → fill from default order,
  keep `visible` set untouched, write back v3.
- v3 record with malformed `formatOrder` (wrong length / dup /
  unknown kind) → fall back to default `formatOrder` only;
  unrelated v3 fields survive.
- The validator returns `version: 3` on every successful path —
  upgrade is silent (FR-007).

`visible` semantics are *unchanged* — it remains the set of
currently-enabled formats. The two arrays are independent except for
this invariant: every member of `visible` MUST appear in
`formatOrder`. The validator enforces the invariant and falls back
to default `formatOrder` if it would be violated.

**Rationale**:

- **Additive evolution** (ADR 0021): never delete or repurpose
  existing fields. `formatOrder` is a new array; it does not
  retype `visible`.
- **Length / permutation invariant**: keeps the type system
  honest — the readout can index `formatOrder[0]` without a
  runtime "what if the array is short" branch.
- **Disabled-format priority** (FR-011): because `formatOrder`
  carries all 6 kinds, a disabled format still has a recorded
  priority position; re-enabling restores its place.

**Alternatives considered**:

- Reuse `visible` as the priority list (drop `formatOrder`).
  Rejected: `visible` is defined as the "enabled" set; conflating
  enabled-state with priority breaks FR-011 (disabled format
  retains priority).
- Replace `visible` with `formats: { kind, enabled: boolean }[]`.
  Rejected: not additive — every existing prefs reader would need
  re-shape work, and the migration is from "ordered set of
  enabled" to "ordered list of every kind", which is more
  invasive than adding a single new field.

## R5 — Live-region announcement strategy

**Decision**: One visually-hidden `<span class="sr-only"
aria-live="polite" data-testid="reorder-announcer">` lives inside
`FormatToggle.svelte`. After every commit (`pointerup` that resulted
in an actual position change), the span's text content is set to a
composed string — e.g.

```text
${tStore('format.labels.mgrs')} · 1 / 6
```

Screen readers announce on text change. The span is cleared after
2 s so re-orders to the same kind are still announced.

**Rationale**:

- One announcer per drawer keeps the live region count low.
- Composition over new keys (R3).
- Polite (not assertive) — drag re-ordering is informational, not
  urgent.
- Clearing after 2 s prevents stale text from re-announcing on
  unrelated re-renders.

**Alternatives considered**:

- A SR-only live region per row. Rejected: 6 live regions risk
  out-of-order announcements.
- Browser-native `aria-grabbed` / `aria-dropeffect`. Rejected:
  these are deprecated in WAI-ARIA 1.2.

## R6 — Why 600 CSS px

**Decision**: `--readout-collapse-bp: 600px`.

**Rationale**: 600 px is the crossover between Material 3's
"compact" and "medium" width classes; it is also the boundary
between iOS HIG's compact-width vs regular-width size classes for
the foldable / phablet families. At this width:

- A typical phablet in portrait (e.g. iPhone 14 Pro Max at 430 ×
  932 logical px) is collapsed.
- A typical small tablet in portrait (e.g. iPad mini at 744 ×
  1133) is **not** collapsed.
- A foldable like Z Fold's outer screen (374 px wide) is
  collapsed; the inner display (768+ px) is not.

**Alternatives considered**:

- 480 px (Bootstrap's `sm` breakpoint). Rejected: too narrow —
  Pixel 7 (412 × 915) and Galaxy S22 (360 × 800) would *both* not
  collapse, despite the user's complaint applying to exactly those
  classes.
- 768 px (Bootstrap's `md`). Rejected: would collapse iPad mini
  in portrait, which has plenty of horizontal room for the
  un-collapsed readout — over-conservative.
- A device-class detection based on `pointer: coarse` media query.
  Rejected: detects touch capability, not viewport size; a
  desktop-Chrome user with a touchscreen would be wrongly
  collapsed.

## R7 — Taipower auto-precision parser

**Decision**: The Go To Taipower parser (`src/coord/parse/taipower.ts`
or — pending verification of the actual filename — the equivalent
`parseTaipower(...)` exported from `$coord/index`) infers the precision
from the trimmed, separator-stripped input length. The exported
function signature drops its precision parameter entirely; callers
(currently only the Go To dispatcher) stop passing it.

**Length dispatch**:

| Trimmed, separator-stripped length | Action |
| ----------------------------------- | ------ |
| 9                                   | parse as 9-precision |
| 11                                  | parse as 11-precision |
| anything else                       | reject with the existing localised "unsupported precision" rejection (kept verbatim — no new locale key) |

**Separator strip**: the input is normalised by `.trim()` then by
removing every character in the project's documented separator set
for Taipower (matches what the existing parser already strips —
hyphens, full-width spaces, ASCII spaces). Whether the existing
parser already does this is verified by the unit test
`tests/unit/taipower-parse-auto-precision.spec.ts`; if not, the
parser is amended to add the strip step before the length classifier.

**Default precision**: `defaultPreferences()` ships
`taipowerPrecision: 11` for fresh installs (FR-014). Existing stored
preferences pass through the validator unchanged — the default
applies only when no record exists yet. This is enforced in
`tests/unit/preferences-defaults.spec.ts`.

**Rationale**:

- The two precisions are not user-meaningful *choices*; they are two
  different resolutions of the same format. Asking the user to
  classify before parsing breaks the principle "if I pasted a
  string, the app should understand it".
- The length signature is unambiguous — 9 ≠ 11, no overlap.
- Keeping the readout's *display* precision in `prefs` lets the
  user override the auto-detect for output even though input is
  always inferred. This separation is the single most important
  thing the design preserves: input is data-driven; output is
  preference-driven.

**Alternatives considered**:

- Auto-detect on output too (drop `taipowerPrecision` from prefs).
  Rejected: a user who pastes an 11-precision code today and tomorrow
  pastes a 9-precision code would see the readout flip back and
  forth — surprising, not convenient. Display preference must
  decouple from input.
- Default 9 for fresh installs. Rejected: the spec calls for 11
  ("顯示精度預設 11"), which is also the more accurate of the two
  precisions, so it is the better default for a new user.
- Allow either length on input AND keep the precision selector on
  the input layout. Rejected: contradicts the spirit of the user
  request and adds UI for no functional reason — if the parser can
  determine precision, the selector is dead UI.

## R8 — TWD zone label composition and the FR-013 exception

**Decision**: Add exactly two new locale keys per language:

- `goto.fields.zoneTagMainIsland`
- `goto.fields.zoneTagPenghu`

Sample values (subject to translation review):

| Locale | `zoneTagMainIsland` | `zoneTagPenghu` |
| ------ | -------------------- | ---------------- |
| `zh`   | `本島`              | `澎湖`           |
| `en`   | `Main Island`        | `Penghu`         |
| `ja`   | `本島`              | `澎湖列島`       |

The component composes the visible label as
`{zoneNumber} {tag}` for `zh` and `ja` (digits-then-tag pattern,
no parentheses needed because the CJK width clearly delimits) and
as `{zoneNumber} ({tag})` for `en` (parentheses follow English
convention). The composition is **NOT** locale-conditional in the
component code — the composition string itself is part of an
existing `tStore` interpolation pattern (`'goto.fields.zoneOption'`
or, if no exact existing key matches, a third new key
`goto.fields.zoneOptionWithTag`). The implementation chooses
between two paths:

- **Preferred**: reuse an existing interpolatable key with a
  `{zoneNumber}` and `{tag}` placeholder. If
  `tStore('goto.fields.zoneOption', { …})` is already in the
  catalogue (a search will be done at implementation time), we use
  that. **Total new keys: 2.**
- **Fallback**: introduce a third key `goto.fields.zoneOptionWithTag`
  that contains the format string per locale. **Total new keys: 3.**
  The plan's stated count is 2; if the third key is needed the plan
  notes it as a + 1 deviation in Complexity Tracking.

**Rationale**:

- FR-013 carves an explicit exception for the geographic tags
  because no existing locale key carries the "main island" /
  "Penghu" semantic. Searching the catalogues for terms like
  "main", "island", "penghu", "本島", "澎湖" returns no usable
  hit (verified at spec time; re-verify at implementation time).
- The "auto" zone option's label (`goto.fields.zoneAuto` from
  feature 002) is **untouched** — the geographic-tag rule applies
  only to the manual options.
- Composition over condition: the locale string contains the
  ordering, parentheses, and spacing — the component does not
  hard-code `{x} ({y})` vs `{x} {y}`.

**Alternatives considered**:

- Hard-code `本島` / `Penghu` directly in the component, no new
  i18n keys. Rejected: violates Constitution Principle V (English-
  primary doc + i18n discipline) and breaks the `ja` and `en`
  locale outputs.
- Translate the entire option label to a single key per zone
  (`goto.fields.zone121WithTag`, `zone119WithTag`). Rejected:
  duplicates the digit content already in `zone119` / `zone121`
  and prevents the existing keys from being reused independently.
- Use unicode emoji / icon for the tag (🏝️ / 🏖️). Rejected:
  not localisable, not screen-reader-friendly, and violates the
  project's "no emoji unless requested" policy.

## Open questions

None. Every design choice in plan §"Technical Context" is
reflected above with rationale + rejected alternatives. The two
deferred verifications (R7's exact parser file path + R8's
"existing interpolatable zoneOption key" lookup) are both
implementation-time confirmations, not design decisions — the
relevant unit tests (`taipower-parse-auto-precision`,
`zone-label`) will surface any mismatch as a RED test before any
production code lands.
