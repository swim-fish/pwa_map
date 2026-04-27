# Phase 1 Data Model — Mobile Collapsed Coordinate Readout

**Feature**: 010-mobile-collapsed-readout
**Date**: 2026-04-27
**Plan**: [plan.md](./plan.md)

This feature is layout + persistence-light: it adds a single ordered
array to the existing `pwa_map:prefs` localStorage record, plus
component-local view-state for the collapsed / tap-expanded mode.

## Persisted state

### `FormatPreferencesV3` (extends V2)

Schema bump from `pwa_map:prefs.version: 2` → `3`. Storage key
unchanged: `pwa_map:prefs`. Owned by
`src/storage/preferences.ts`.

| Field                | Type                                          | Notes |
| -------------------- | --------------------------------------------- | ----- |
| `version`            | `3`                                           | Discriminator. Validator returns `3` on every successful path. |
| `visible`            | `readonly CoordinateKind[]`                   | Unchanged from v2 — enabled set. Order MUST agree with `formatOrder` (validator enforces). |
| `mgrsPrecision`      | `MGRSPrecision`                               | Unchanged. |
| `taipowerPrecision`  | `TaipowerPrecision`                           | Unchanged. |
| `locale`             | `Locale`                                      | Unchanged. |
| `mapLayer`           | `BasemapId \| undefined`                      | Unchanged. |
| `overlay`            | `boolean \| undefined`                        | Unchanged. |
| `tileTtlDays`        | `TtlDays`                                     | Unchanged. |
| `tileMaxEntries`     | `TileMaxEntries`                              | Unchanged. |
| `taipowerPrecision`  | `TaipowerPrecision`                           | Type unchanged. **Default ships as `11`** (was `9`). The validator does NOT silently mutate stored values — only `defaultPreferences()` returns the new default for fresh installs. |
| **`formatOrder`**    | **`readonly CoordinateKind[]`** (length **6**) | **NEW**. Permutation of `ALL_COORDINATE_KINDS`. Index 0 = highest priority. |

**Invariants** (validator-enforced):

1. `formatOrder.length === ALL_COORDINATE_KINDS.length` (= 6).
2. `new Set(formatOrder).size === 6` and every entry is a known
   `CoordinateKind`.
3. `visible.every(k => formatOrder.includes(k))` — every enabled
   format has a recorded priority.
4. The order of `visible` is a subsequence of `formatOrder`
   (i.e. `visible.map(k => formatOrder.indexOf(k))` is strictly
   increasing). When the user reorders priorities, the validator
   re-sorts `visible` to satisfy this invariant.

**Default order** (used when `formatOrder` is absent or fails
validation):

```ts
const DEFAULT_FORMAT_ORDER: readonly CoordinateKind[] = [
  'wgs84-dd',
  'wgs84-dms',
  'twd97-tm2',
  'twd67-tm2',
  'mgrs',
  'taipower',
] as const;
```

This is exactly `ALL_COORDINATE_KINDS` — the order rows currently
render in. By choosing it as the upgrade default, no existing user
sees a re-ordered readout on the upgrade page-load.

**State transitions**:

- v1 / v2 record loaded → fill `formatOrder` from `DEFAULT_FORMAT_ORDER`,
  re-sort `visible` to match, write back v3.
- v3 record with malformed `formatOrder` → replace `formatOrder` with
  `DEFAULT_FORMAT_ORDER`, re-sort `visible`, surface no error
  (silent fallback per FR-007).
- User reorders via drag → validator updates `formatOrder` AND
  re-sorts `visible`; `savePreferences` persists; the readout
  updates within the same Svelte tick (FR-005, SC-002).
- User toggles a format on / off → `visible` adds or removes one
  entry; `formatOrder` is untouched (FR-011).

## Component-local view state

### `CoordinateReadout.svelte` view mode

A reactive derivation, **not** persisted:

```text
viewMode = matches('(max-width: 599.98px)') && enabled.length >= 2
           ? (tapExpanded ? 'tap-expanded' : 'collapsed')
           : 'expanded'
```

Where:

- `enabled` is the current `visible` from the prefs store, projected
  through the priority order: `formatOrder.filter(k => visible.includes(k))`.
- `matches(...)` is a reactive matchMedia query subscription.
- `tapExpanded` is a `let tapExpanded = false` field local to
  `CoordinateReadout.svelte`. Tapping the readout body toggles it.
  It auto-clears in a `$:` reactive block when `matches('(max-width: 599.98px)')` becomes
  false, **without** persisting the cleared value.

| State          | Visible rows                                 | Tap on body         | Resize ≥ 600 px                             |
| -------------- | -------------------------------------------- | -------------------- | ------------------------------------------- |
| `collapsed`    | One row (priority 1 of `enabled`)            | → `tap-expanded`     | → `expanded`                                 |
| `tap-expanded` | All rows in priority order                   | → `collapsed`        | → `expanded` (and `tapExpanded` cleared)     |
| `expanded`    | All rows in priority order                   | (no special handler) | (no transition)                              |

**Invariants**:

- `tapExpanded` is NEVER persisted to localStorage or any other
  storage (FR-009).
- The transition between `collapsed` and `tap-expanded` is a CSS
  `max-height` + `opacity` transition, ≤ 200 ms (SC-004).
- The copy button has `event.stopPropagation()` on its click
  handler so tapping copy does NOT also toggle `tapExpanded`
  (FR-010).

### `FormatToggle.svelte` drag state

Owned by the parent of `FormatPriorityRow.svelte`. NOT persisted.

| Field                  | Type                              | Notes |
| ---------------------- | --------------------------------- | ----- |
| `dragKind`             | `CoordinateKind \| null`          | The kind currently being dragged; `null` when no drag is active. |
| `pointerStartY`        | `number \| null`                  | The `clientY` of `pointerdown`; used to derive `translateY` for the live preview. |
| `dropPreviewIndex`     | `number \| null`                  | The index where, if released now, the dragged row would land. Updated on each `pointermove`. Used to drive a CSS placeholder visual. |
| `pointerCancelGuard`   | `boolean`                         | Set `true` on `pointercancel`; on `pointerup`, if `pointerCancelGuard === true`, the commit is skipped (FR-005 honours abort). |

**Lifecycle**:

```text
pointerdown on .drag-handle → set dragKind, pointerStartY, capture pointer
pointermove                 → update dropPreviewIndex; live row translates
pointerup (no cancel)       → commit reorder: emit `reorder` event with new order; reset state
pointerup (cancel)          → skip commit; reset state
pointercancel               → set pointerCancelGuard; reset state
```

The commit math:

```ts
function reorderArray<T>(arr: readonly T[], from: number, to: number): readonly T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

is a pure function and is unit-tested in
`tests/unit/format-priority-list.spec.ts`.

## Tokens added

`src/app/tokens.css` adds one token:

| Token                       | Value     | Purpose |
| --------------------------- | --------- | ------- |
| `--readout-collapse-bp`     | `600px`   | Single source of truth for the narrow / wide split. Consumed by `CoordinateReadout.svelte`'s `@media` query (`@media (max-width: calc(var(--readout-collapse-bp) - 0.02px))`) AND by the unit/integration test which asserts the rule cardinality. |

## i18n catalogue changes

Two new keys added to each of `src/i18n/zh.json`, `src/i18n/en.json`,
`src/i18n/ja.json` (six new strings total):

| Key                                  | `zh` (sample) | `en` (sample)  | `ja` (sample)    |
| ------------------------------------ | ------------- | -------------- | ---------------- |
| `goto.fields.zoneTagMainIsland`      | `本島`        | `Main Island`  | `本島`            |
| `goto.fields.zoneTagPenghu`          | `澎湖`        | `Penghu`       | `澎湖列島`        |

These are the only new i18n keys this feature introduces, and FR-013
explicitly allows the exception. The composition rule is documented
in `contracts/zone-label-i18n.md`.

The `goto.fields.zoneAuto`, `zone119`, `zone121` keys are **NOT**
modified — only the rendered label is composed at render time.

## Taipower input precision (transient)

A non-persisted derived value computed inside the Go To Taipower
parser:

```ts
type DetectedPrecision = 9 | 11 | null;

function detectTaipowerPrecision(input: string): DetectedPrecision {
  const stripped = input.trim().replace(SEPARATOR_REGEX, '');
  if (stripped.length === 9) return 9;
  if (stripped.length === 11) return 11;
  return null; // → existing localised "unsupported precision" rejection
}
```

Where `SEPARATOR_REGEX` matches the project's documented Taipower
separator set (already used by the existing parser; verified at
implementation time).

**Invariants**:

- The function is pure: no DOM, no `localStorage`, no `Date.now()`.
- The function never throws; it returns `null` on unsupported lengths.
- The persisted `taipowerPrecision` preference is **NOT** read by
  this function — input precision is data-driven, output precision
  is preference-driven (research.md §R7).

## Out of scope (explicit non-data-model)

- The `pwa_map:lastView` key (feature 001) — not changed.
- The `pwa_map:installDismissedUntil` key (feature 005) — not changed.
- The Go To layout components' input-state shape — not changed.
- Any new map / coordinate format — none. The set is still the same
  six kinds.
- Cross-device sync of `formatOrder` — out of scope; `formatOrder`
  is per-installation, like every other prefs field.
