# Contract: `coordinateSegments(kind, position, prefs)`

**Feature**: 009-mobile-ui-fixes
**Surface**: New TypeScript module `src/coord/segments.ts`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-004, FR-005, FR-006, FR-011 · **Spec SCs**: SC-004, SC-005

## Public module surface

```ts
// src/coord/segments.ts

import type { CoordinateKind, WGS84DD } from '$types/coord';

export type CoordinateSegment = {
  /** i18n key from the existing `goto.fields.*` namespace. */
  labelKey: string;
  /** Pre-formatted display string for one field of one format. */
  value: string;
};

export type CoordinateSegmentsResult =
  | { coverage: 'ok'; segments: CoordinateSegment[] }
  | { coverage: 'out-of-coverage' };

export function coordinateSegments(
  kind: CoordinateKind,
  position: WGS84DD,
  prefs: { mgrsPrecision: number; taipowerPrecision: number },
): CoordinateSegmentsResult;
```

That is the only export.

## Per-kind segment specification

The `segments` array, when `coverage === 'ok'`, MUST satisfy the
following per-kind shape exactly:

| `kind`        | `segments[i].labelKey` (in order)                                                                                        | `segments[i].value` source                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `wgs84-dd`    | `goto.fields.lat`, `goto.fields.lon`                                                                                     | from `formatWGS84DD(position)` split on the canonical separator (comma).             |
| `wgs84-dms`   | `goto.fields.latDeg`, `goto.fields.latMin`, `goto.fields.latSec`, `goto.fields.latHem`, `goto.fields.lonDeg`, `goto.fields.lonMin`, `goto.fields.lonSec`, `goto.fields.lonHem` | from `wgs84DdToDms(position)` field-wise (numeric values rendered with the same precision the existing `formatWGS84DMS` uses). |
| `twd97-tm2`   | `goto.fields.tm2Easting`, `goto.fields.tm2Northing`, `goto.fields.tm2Zone`                                                | from `wgs84ToTwd97(position)` field-wise (zone label uses the same display as `formatTWD97TM2`). |
| `twd67-tm2`   | `goto.fields.tm2Easting`, `goto.fields.tm2Northing`                                                                       | from `wgs84ToTwd67(position)` field-wise.                                            |
| `mgrs`        | `goto.fields.mgrsGzdBand`, `goto.fields.mgrsSquare`, `goto.fields.mgrsEasting`, `goto.fields.mgrsNorthing`                | from `wgs84ToMgrs(position, prefs.mgrsPrecision)` decomposed on the canonical token boundaries inside `formatMGRS(...)`. |
| `taipower`    | `goto.fields.taipowerFirst5`, `goto.fields.taipowerLast`, `goto.fields.taipowerPrecision`                                  | from `wgs84ToTaipower(position, prefs.taipowerPrecision)` field-wise. If the result is `{ ok: false }`, return `{ coverage: 'out-of-coverage' }`. |

If a label key from this table does not exist in the locale
catalogue at implementation time (because feature 002 used a slightly
different name), the implementer MUST update this contract to point
at the actual key — NOT add a new key. Adding new locale strings is
explicitly out of scope (Plan §Locale Conventions).

## Invariants

1. **Shape parity with Go To.** For every `kind`, the count, order,
   and `labelKey` of the returned segments equal — element-wise —
   the count, order, and field-label i18n keys consumed by the
   corresponding Go To layout component (`DdLayout`, `DmsLayout`,
   `Tm2Layout`, `Twd67Layout`, `MgrsLayout`, `TaipowerLayout`). This
   is the FR-004 guarantee.
2. **Canonical-string round-trip.** For every `kind`, when
   `coverage === 'ok'`, joining the segments' `value` strings with
   the canonical separator for that `kind` (comma + space for DD;
   space for DMS / TM2 / TWD67-TM2 / MGRS / Taipower) yields a
   string equal — character-for-character — to
   `format{Kind}(...)` for the same input. This is the FR-005
   guarantee in test form.
3. **Pure & side-effect-free.** No DOM, no `localStorage`, no
   `Date.now()`, no `Math.random()`, no global mutation. Calling
   `coordinateSegments` with the same arguments yields an array
   that is structurally identical to a previous call's output.
4. **No mutation of inputs.** `position` and `prefs` are not modified.
5. **No new locale keys.** Every `labelKey` returned is already
   present in the catalogues for `zh`, `en`, `ja`.
6. **Out-of-coverage routing.** When the input falls outside the
   format's coverage zone (`coverageOf(kind, position) ===
   'out-of-coverage'`, or Taipower's `{ ok: false }`), the function
   returns `{ coverage: 'out-of-coverage' }` without throwing.
7. **Performance budget.** Calling `coordinateSegments` for all six
   kinds on one position completes in ≤ 5 ms on a mid-tier mobile
   CPU profile — verified once in a Vitest bench (`bench/`),
   matching the existing performance budget granularity.

## Verification

`tests/unit/coordinate-readout-segments.spec.ts` exercises:

- Invariant 1 by importing each Go To layout's `<input>`/radio
  field-key list (extracted by `data-testid` enumeration in the
  layout components) and comparing element-wise.
- Invariant 2 by joining segments and asserting equality with the
  existing `format*()` helpers' output.
- Invariant 6 by feeding a position outside Taiwan and asserting
  the sentinel result for `taipower` and `twd97-tm2`.
- Invariants 3, 4, 5 by static inspection of the implementation
  plus a snapshot of the locale catalogue keys.

`bench/coord-segments.bench.ts` (optional, only if `bench/`
infrastructure already runs in CI) covers Invariant 7.

## Non-goals

- The pure helper does NOT render any DOM. The readout component
  consumes its output and renders it.
- The pure helper does NOT carry any "format change animation"
  hint; the SC-005 ≤ 200 ms transition budget is owned by the
  readout component's CSS.
- The pure helper does NOT rewrite or re-implement any of the
  existing `format*()` helpers.
