# UI Record 0010 — Mobile Collapsed Readout, Drag-to-Reorder Priority, Taipower Auto-Precision, TWD Zone Hints

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/010-mobile-collapsed-readout/`
**Affected screens**: coordinate readout, format-toggle drawer (Settings · Visible formats), Go To dialog (TWD97-TM2 / TWD67-TM2 / Taipower layouts)

## Context

After feature 009 (`docs/ui/0009-mobile-ui-fixes.md`) raised every primary
control to the 44 × 44 CSS-pixel tap floor, real-world phone usage surfaced
a remaining bottom-edge collision: the coordinate readout's multi-row
panel still spanned most of the lower edge of the viewport on phone-class
viewports (under 600 CSS pixels), overlapping the right-edge zoom
controls. Two coordinate-input clarity items rode the same delivery cycle:

1. The Go To Taipower input forced the user to pre-pick a precision before
   typing — friction that the input length itself can resolve.
2. The TWD97 / TWD67 zone selectors offered "121" and "119" with no hint
   that 121 covers the main island and 119 covers the Penghu archipelago.

## Design goals

| Goal                                                                             | Source                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| Phone-class readout no longer overlaps the zoom controls.                        | US1 (P1), FR-001 / FR-002 / FR-003 / SC-001 |
| User can choose which format is the priority-one row via drag.                   | US2 (P2), FR-004 / FR-005 / FR-006 / FR-011 |
| Tap collapsed readout to expand transiently; tap again to collapse.              | US3 (P3), FR-008 / FR-009 / FR-010 / SC-004 |
| Taipower input parses precision from input length; default 11 on fresh installs. | US4 (P2), FR-014 / FR-015 / SC-007          |
| TWD zone options carry a localised geographic tag; auto label unchanged.         | US5 (P3), FR-016 / FR-017 / SC-008          |

## Layout & tokens

### New design token (`src/app/tokens.css`)

```css
/* Phone-vs-tablet split for the readout (feature 010, contracts/readout-collapse-mode.md) */
--readout-collapse-bp: 600px;
```

The CSS `@media` query in `CoordinateReadout.svelte` and the reactive
`window.matchMedia('(max-width: calc(var(--readout-collapse-bp) - 0.02px))')`
subscription consume the same token. The 0.02px adjustment matches
Bootstrap / Material's canonical half-pixel pattern (research §R6).

### New schema field (`src/storage/preferences.ts`)

`pwa_map:prefs` v3 adds `formatOrder: readonly CoordinateKind[]` of length
six (a permutation of every supported format). The default is the order
the formats currently render in (`wgs84-dd → wgs84-dms → twd97-tm2 →
twd67-tm2 → mgrs → taipower`). Migration from v1 / v2 is silent: missing
or malformed `formatOrder` falls back to the default; existing
`taipowerPrecision` is preserved verbatim. Fresh installs ship
`taipowerPrecision: 11` (was 9).

### New i18n keys (`src/i18n/{zh,en,ja}.json`)

Two new keys per locale, six new strings total:

| Key                             | zh   | en          | ja       |
| ------------------------------- | ---- | ----------- | -------- |
| `goto.fields.zoneTagMainIsland` | 本島 | Main Island | 本島     |
| `goto.fields.zoneTagPenghu`     | 澎湖 | Penghu      | 澎湖列島 |

Every other UI string in this feature reuses an existing key. The
`goto.fields.zoneAuto` key is unchanged.

## Interactions

### Coordinate readout (`<CoordinateReadout>`)

- **Wide viewport** (≥ 600 CSS px): every enabled format renders in
  `formatOrder` order, top-to-bottom (priority-one first).
- **Narrow viewport with ≥ 2 enabled formats**: only the priority-one
  enabled format renders; the panel carries `data-mode="collapsed"`,
  `role="button"`, `aria-expanded="false"`. Tap or `Enter` / `Space` on
  the panel body flips to `data-mode="tap-expanded"` (`aria-expanded="true"`,
  every enabled row visible). Tap again to return to collapsed.
- **Narrow viewport with 1 enabled format**: the single row renders
  without collapse styling; no tap-to-expand affordance is shown.
- **Resize past the breakpoint**: `tapExpanded` state clears
  synchronously; reload always starts in `collapsed` (state is component-local,
  never persisted).
- **Copy button**: `event.stopPropagation()` on the click handler ensures
  copying never toggles tap-expand (FR-010). The button keeps its
  `tap-target` class and 44 × 44 floor from feature 009.

### Format-toggle drawer (`<FormatToggle>`)

- Each row is a `<FormatPriorityRow>` with: a 44 × 44 drag handle on the
  left (Pointer Events lifecycle, `touch-action: none`), the existing
  enable / disable checkbox in the middle, the `format.labels.<kind>`
  text on the right.
- Drag the handle vertically; on release, the parent commits a new
  `formatOrder` via `reorderArray()` and dispatches `reorder` to
  `App.svelte`, which persists via `savePreferences`. The readout updates
  in the same Svelte tick (well under the 200 ms SC-002 budget).
- Drag cancellation (`pointercancel`, system gesture interrupt) discards
  the preview without committing. Releasing at the original index is a
  no-op — no spurious save.
- Disabled-format rows are still draggable; reordering still records the
  new priority position so re-enabling later restores the chosen
  position (FR-011).
- An `aria-live="polite"` visually-hidden announcer reads
  `"<format name> · <new index> / 6"` after each commit.

### Go To Taipower (`<TaipowerLayout>`)

- The user-facing precision selector is removed. The single input
  accepts both 9-character and 11-character codes; `maxlength` on the
  second field expands to 6.
- The parser auto-detects precision from the trimmed, separator-stripped
  input length (`detectTaipowerPrecision()` — pure helper exported from
  `src/coord/parser.ts`). Lengths other than 9 / 11 surface the existing
  localised `'unsupported-precision'` rejection (`errors.taipower.wrongLength`)
  — no new locale key.
- The readout's **display** precision continues to use
  `prefs.taipowerPrecision` so users who explicitly chose 9 keep
  9-character output. Fresh installs ship 11.

### Go To TWD zone selectors (`<Tm2Layout>`, `<Twd67Layout>`)

- The auto button is unchanged.
- The 121 button reads `121 (Main Island)` in `en`, `121 本島` in `zh`,
  `121 本島` in `ja`. The 119 button reads `119 (Penghu)` / `119 澎湖` /
  `119 澎湖列島`. The locale string drives the parenthesisation; the
  component does not branch on locale name.
- `Twd67Layout` gains a zone selector for label parity (FR-017). The
  TWD67 parser still treats every TWD67 input as zone 121; selecting 119
  surfaces the existing `errors.tm2.unknownZone` rejection from feature 002. Functional zone-119 support for TWD67 is out of scope.

## Accessibility notes

- Drag handle is `class="tap-target drag-handle"` (≥ 44 × 44 CSS px,
  `touch-action: none` to suppress browser pan / scroll).
- Readout root in `collapsed` / `tap-expanded` modes carries
  `role="button"`, `aria-expanded`, `tabindex="0"`. `Enter` and `Space`
  mirror the tap behaviour. In `expanded` mode the role is removed (the
  readout is purely presentational on wide viewports).
- Keyboard reordering (`↑` / `↓`) is **deferred to a future feature**
  (ADR 0030 §"Future work"). Each row remains keyboard-focusable and
  the checkbox remains keyboard-toggleable so the visible order stays
  readable.
- Live-region announcement for drag commits is `polite`, not `assertive`,
  and clears after 2 seconds so a re-order to the same kind announces
  again.

## Tokens / components changed

| Path                                        | Change                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app/tokens.css`                        | + `--readout-collapse-bp: 600px`                                                                                    |
| `src/storage/preferences.ts`                | + `FormatPreferencesV3`, `formatOrder`, `DEFAULT_FORMAT_ORDER`, default `taipowerPrecision: 11`, v1/v2/v3 migration |
| `src/components/CoordinateReadout.svelte`   | + `formatOrder` prop, `viewMode` state machine, `data-mode`, tap-to-expand, copy stopPropagation                    |
| `src/components/FormatPriorityRow.svelte`   | NEW — drag handle + checkbox; emits `reorderRequest` / `toggle`                                                     |
| `src/components/FormatToggle.svelte`        | renders `formatOrder` via `<FormatPriorityRow>`; emits `reorder`; aria-live announcer                               |
| `src/components/formatPriority.ts`          | NEW — pure `reorderArray<T>()`                                                                                      |
| `src/components/goto/TaipowerLayout.svelte` | drops precision selector; second input maxlength → 6                                                                |
| `src/components/goto/Tm2Layout.svelte`      | composes 121 / 119 labels with `zoneTagMainIsland` / `zoneTagPenghu`                                                |
| `src/components/goto/Twd67Layout.svelte`    | + zone selector with same composition rule (FR-017)                                                                 |
| `src/coord/parser.ts`                       | + `detectTaipowerPrecision()`; SHAPE-then-length check                                                              |
| `src/i18n/{zh,en,ja}.json`                  | + 2 keys × 3 locales                                                                                                |

## Screenshots

Screenshots are not committed for this iteration; the existing
`tests/e2e/mobile-collapsed-readout.e2e.spec.ts` Playwright spec is the
machine-verifiable visual evidence for the collapse-on-narrow + tap-expand
flows. A future polish pass may capture before / after PNGs at 360 × 640
and 1024 × 768 under `docs/ui/screenshots/0010-…/`.

## Open questions

- Keyboard reorder (`↑` / `↓` on a focused drag handle) is acknowledged
  as future work in ADR 0030. The visible order remains readable
  without it.
- Functional zone-119 support for TWD67 is out of scope — the selector
  is informational. A future feature would extend `parseTwd67Input` and
  `wgs84ToTwd67` to take an explicit zone.
