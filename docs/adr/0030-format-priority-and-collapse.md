# ADR 0030 — Format priority list + responsive readout collapse + Taipower auto-precision + TWD zone tags

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/010-mobile-collapsed-readout/`
**Supersedes**: —
**Related**: ADR 0014 (Accessibility Baseline — tap-target + keyboard parity rules extended),
ADR 0017 (Go To split layout — TaipowerLayout / Tm2Layout / Twd67Layout shape preserved),
ADR 0021 (`pwa_map:prefs` additive evolution — v3 follows the same migration discipline),
ADR 0029 (Mobile touch-target + notification region — drag handle reuses `--tap-min` + `.tap-target`)

## Context

After feature 009 raised every primary control to the 44 × 44 CSS-pixel
tap floor, real-world phone usage surfaced a remaining bottom-edge
collision: the coordinate readout's multi-row panel still spanned most
of the lower edge of the viewport on phone-class viewports (under
600 CSS pixels), overlapping the right-edge zoom controls. Two
coordinate-input clarity items rode the same delivery cycle:

1. The Go To Taipower input forced the user to pre-pick a precision
   before typing — friction that the input length itself can resolve.
2. The TWD97 / TWD67 zone selectors showed bare "121" / "119" with no
   hint that 121 covers the main island and 119 covers Penghu.

A spec / plan / contracts / tasks cycle (`/speckit.specify` →
`/speckit.plan` → `/speckit.tasks` → `/speckit.implement`) produced the
five-user-story design recorded below; this ADR captures the
**decisions** that bind future contributors.

## Decision

### Part 1 — `formatOrder` schema field + v3 migration

`pwa_map:prefs` v3 adds a single field:

```ts
readonly formatOrder: readonly CoordinateKind[]; // length === 6, permutation of ALL_COORDINATE_KINDS
```

Migration rule (additive evolution, ADR 0021):

- v1 / v2 record loaded → fill `formatOrder = DEFAULT_FORMAT_ORDER`,
  preserve every other field verbatim (especially `taipowerPrecision`).
- v3 record with malformed `formatOrder` (wrong length, duplicate, or
  unknown kind) → silently fall back to `DEFAULT_FORMAT_ORDER`;
  unrelated v3 fields survive.
- The validator returns `version: 3` on every successful path.

**Default order** (the order the formats currently render in, so
existing users see no row reshuffle on the upgrade page-load):

```ts
const DEFAULT_FORMAT_ORDER = [
  'wgs84-dd',
  'wgs84-dms',
  'twd97-tm2',
  'twd67-tm2',
  'mgrs',
  'taipower',
] as const;
```

**Rationale**:

- Additive evolution keeps every prior reader of `prefs` working
  unchanged; only the readout / format-toggle code paths read the new
  field.
- `formatOrder` carries every supported kind (not just the enabled
  set) so a disabled format keeps a recorded priority position
  (FR-011); re-enabling it later restores the chosen position.
- Length / permutation invariant lets the readout index
  `formatOrder[0]` without a runtime "what if the array is short"
  branch.

### Part 2 — Responsive collapse via `--readout-collapse-bp` token

The breakpoint between collapsed and expanded readout is a single
design token in `src/app/tokens.css`:

```css
--readout-collapse-bp: 600px;
```

`CoordinateReadout.svelte`'s CSS `@media` rule and Svelte's reactive
`window.matchMedia('(max-width: calc(var(--readout-collapse-bp) - 0.02px))')`
subscription consume the same token. The 0.02px adjustment is the
canonical Bootstrap / Material half-pixel pattern (research §R6) that
prevents a no-man's-land at exactly the breakpoint on retina
viewports.

**Why 600 px** (Material 3 compact / medium boundary, iOS HIG compact
size class boundary):

- Phablets in portrait (e.g. iPhone 14 Pro Max at 430 × 932 logical px)
  collapse.
- Small tablets in portrait (e.g. iPad mini at 744 × 1133) do not
  collapse — they have plenty of horizontal room for the un-collapsed
  readout.
- Foldables collapse on the outer screen (374 px) but not on the inner
  screen (768+ px).

### Part 3 — Drag-to-reorder via Pointer Events (no third-party DnD)

The drag mechanism is a self-contained Pointer Events handler in
`src/components/FormatPriorityRow.svelte` (per-row listeners) plus a
parent-side commit step in `FormatToggle.svelte` (using the pure
`reorderArray<T>(arr, from, to)` helper from
`src/components/formatPriority.ts`).

**Rejection of `svelte-dnd-action`** (the leading Svelte DnD library):

- `svelte-dnd-action` 0.9.x weighs **~5.6 KiB gzipped** by itself —
  more than 5× the entire feature's +1 KiB gzipped budget before this
  feature's own logic ships.
- A six-row, single-list, whole-row drag does not need any of the
  library's advanced features (nested lists, multi-select, drop zones,
  cross-list drag, file drop).
- A self-contained Pointer Events handler is < 80 lines of TS plus a
  `transform: translateY()` style — well inside budget.

**Touch-action discipline**: `.drag-handle` has `touch-action: none` so
the browser does not interpret the gesture as a scroll or pan-zoom — a
known pitfall on iOS Safari that DnD libraries also have to solve, and
that we get for free with the right CSS on the handle alone.

**Same-position no-op** (Invariant 5): releasing at the original index
is a no-op — no `reorder` event fires, no spurious save.

### Part 4 — Keyboard reorder is future work, NOT a release blocker

The drag affordance is decorative-only for keyboard users in this
feature. The visible order remains keyboard-readable (rows still
focusable, drag handles still tabbable, checkbox still keyboard-toggleable).
A future feature 0xx will add `↑` / `↓` keyboard reorder; explicitly
documented here so future contributors know the deferral was
deliberate (ADR 0014's accessibility floor remains the touch-target
contract; keyboard reorder is an enhancement).

### Part 5 — Taipower auto-precision (input only; output preference preserved)

Three coordinated changes:

1. `defaultPreferences().taipowerPrecision` ships **11** for fresh
   installs (was 9). The validator never silently mutates a stored
   `taipowerPrecision: 9` to 11 on upgrade — Invariant 5 of
   `contracts/format-priority-schema.md`.
2. `parseTaipowerInput` (in `src/coord/parser.ts`) adds a new pure
   helper `detectTaipowerPrecision(input: string): 9 | 11 | null` that
   trims and strips the documented separator set
   (`/[\s\-_]/g`) before classifying by length. Length 9 → 9-precision,
   length 11 → 11-precision, anything else → existing localised
   `'unsupported-precision'` rejection (`errors.taipower.wrongLength` —
   key unchanged from feature 002, no new locale string).
3. `TaipowerLayout.svelte` drops the user-facing precision selector;
   the `LayoutFields` `taipower` discriminant drops its `precision`
   field; the composer's taipower case keeps the same string-build
   (no behaviour change beyond the field removal).

The readout's **display** precision continues to use
`prefs.taipowerPrecision`. Input precision is data-driven; output
precision is preference-driven — the single most important separation
this design preserves.

### Part 6 — Two new i18n keys (the only allowed exception to FR-013)

The TWD zone-tag composition introduces exactly two new keys per
locale (six new strings total):

| Key                             | zh   | en          | ja       |
| ------------------------------- | ---- | ----------- | -------- |
| `goto.fields.zoneTagMainIsland` | 本島 | Main Island | 本島     |
| `goto.fields.zoneTagPenghu`     | 澎湖 | Penghu      | 澎湖列島 |

FR-013 explicitly allows this exception because no existing locale key
carries the geographic semantic. Every other UI string in this feature
reuses an existing key. The `goto.fields.zoneAuto` key (feature 002)
is unchanged.

The component composes the visible label as `{zoneNumber} ({tag})` for
locales whose `goto.fields.zoneAuto` reads `"auto"` (English convention)
and `{zoneNumber} {tag}` otherwise (CJK convention). The component does
not branch on locale name; the locale string itself drives the
parenthesisation.

## Consequences

- Every existing prefs reader keeps working; v3's only new field is
  ignored by readers that don't ask for `formatOrder`.
- Existing PWA installations see no behaviour change on upgrade except
  for the readout collapsing on narrow viewports — which is the user's
  primary complaint, the change they asked for.
- Existing users who picked `taipowerPrecision: 9` keep 9-character
  Taipower output. Fresh installs get the more accurate 11.
- Feature 009's `coordinate-readout-segments.spec.ts` (the segment-shape
  regression guard) keeps the per-format segment shape unchanged. Only
  its layout-source-key parity check for `taipower` was relaxed because
  `TaipowerLayout` no longer references `goto.fields.precision`.
- The bundle delta vs `master` is well inside the +1 KiB gzipped
  budget (ADR 0014 Performance Verification Pipeline). No new runtime
  dep, no new dev dep, no new build plugin.

## Alternatives considered

### A. Adopt `svelte-dnd-action` (rejected)

5.6 KiB gzipped — more than 5× the feature's entire bundle budget.
Also brings its own announcement system that would conflict with
this feature's `aria-live` line.

### B. HTML5 native drag API (`dragstart` / `dragover` / `drop`) — rejected

Brittle on touch (iOS Safari has long-standing gaps on non-list-item
elements), would still need a separate touch path doubling the
surface, and cannot animate the dragged element smoothly without a
library on top.

### C. "Move up / down" buttons per row instead of drag — rejected

The spec explicitly asks for drag ("可以拖移顯示順序"). Two extra tap
targets per row would inflate the row vertical footprint past what
the narrow-viewport drawer can fit without scrolling.

### D. Reuse `visible` as the priority list (drop `formatOrder`) — rejected

`visible` is defined as the "enabled" set; conflating enabled-state
with priority breaks FR-011 (a disabled format must retain its
priority position so re-enabling restores its place).

### E. Auto-detect Taipower precision on output too (drop `taipowerPrecision` from prefs) — rejected

A user who pastes 11-precision today and 9-precision tomorrow would
see the readout flip back and forth — surprising, not convenient.
Display preference must decouple from input.

### F. Hard-code 本島 / Penghu in the component, no new i18n keys — rejected

Violates Constitution Principle V (English-primary doc + i18n
discipline) and breaks the `ja` and `en` locale outputs.

### G. Use unicode emoji / icon (🏝️ / 🏖️) for the geographic tag — rejected

Not localisable, not screen-reader-friendly, and violates the
project's "no emoji unless requested" policy.

## Future work

- Keyboard reorder (`↑` / `↓` on a focused drag handle).
- Functional zone-119 support for TWD67 (extend `parseTwd67Input` and
  `wgs84ToTwd67` to take an explicit zone). The current selector is
  informational only.
- Animated row reflow on commit (CSS `transition: transform` is
  acceptable; FLIP-style position-keyed re-animation is out of scope).
- A "Restore default order" button — the user can drag back manually;
  out of scope for this feature.
