# Contract: Layout Composer

**Feature**: `002-goto-split-input`
**Surface**: `src/coord/composer.ts`
**Consumers**: `GoToDialog.svelte`, layout components, integration tests.

The composer turns typed `LayoutFields` for an active `FormatSelection`
into a canonical raw string + a hint that names which sub-parser to
invoke. It MUST NOT change the parser grammar from feature 001.

---

## 1. Public API

```ts
// src/coord/composer.ts
import type { CoordinateKind } from '$types/coord';
import type { FormatSelection, LayoutFields } from '$types/goto';

export type SubParserHint =
  | { kind: 'auto' }                                    // run full dispatcher
  | { kind: 'wgs84-dd' }
  | { kind: 'wgs84-dms' }
  | { kind: 'mgrs' }
  | { kind: 'twd97-tm2'; zone: 'auto' | 119 | 121 }
  | { kind: 'twd67-tm2' }
  | { kind: 'taipower' };

export interface ComposedInput {
  readonly raw: string;
  readonly hint: SubParserHint;
}

export type ComposeResult =
  | { readonly ok: true; readonly value: ComposedInput }
  | { readonly ok: false; readonly error: ComposeError };

export interface ComposeError {
  readonly category: 'empty-field';
  readonly messageKey: string; // e.g. 'errors.emptyInput'
  readonly fieldId: string;    // e.g. 'lat', 'mgrs-square'
}

export function composeRaw(
  selection: FormatSelection,
  fields: LayoutFields,
): ComposeResult;
```

**Pre-conditions**:

- `selection.kind === 'auto' ↔ fields.kind === 'auto'`. The caller is
  responsible for keeping the discriminants aligned; misalignment is a
  programming error and yields a `ComposeError` with
  `messageKey: 'errors.composer.discriminantMismatch'`.

**Post-conditions**:

- On `ok: true`, `value.raw` is grammar-conformant per
  `specs/001-coord-map-pwa/contracts/go-to-grammar.md` for `value.hint`.
- On `ok: false`, no field is consulted further; the caller surfaces
  `error.messageKey` localised, focuses the field referenced by
  `error.fieldId` (FR-006 keyboard navigation).

---

## 2. Per-format composition rules

### 2.1 `auto`

`raw = fields.raw` verbatim. `hint = { kind: 'auto' }`. Empty after
trim → `error.messageKey = 'errors.emptyInput'`,
`error.fieldId = 'auto-raw'`.

### 2.2 `wgs84-dd`

```text
raw = `${lat.trim()}, ${lon.trim()}`
hint = { kind: 'wgs84-dd' }
```

Empty `lat` → `errors.emptyInput`, fieldId `dd-lat`. Empty `lon` →
`errors.emptyInput`, fieldId `dd-lon`. (Range / format errors are the
parser's job — keep responsibility separation.)

### 2.3 `wgs84-dms`

```text
raw = `${latDeg}°${latMin}′${latSec}″ ${latHem}, ` +
      `${lonDeg}°${lonMin}′${lonSec}″ ${lonHem}`
hint = { kind: 'wgs84-dms' }
```

Empty deg/min/sec → `errors.emptyInput`, fieldId
`dms-{lat|lon}-{deg|min|sec}`. Hemisphere is a segmented selector — it
always has a value, so no empty check needed.

### 2.4 `twd97-tm2`

```text
if (zone === 'auto'):
  raw  = `${easting.trim()}, ${northing.trim()}`
  hint = { kind: 'twd97-tm2', zone: 'auto' }
else:
  raw  = `${easting.trim()}, ${northing.trim()} (zone ${zone})`
  hint = { kind: 'twd97-tm2', zone }
```

Empty easting / northing → `errors.emptyInput`, fieldId
`tm2-{easting|northing}`.

### 2.5 `twd67-tm2`

```text
raw  = `TWD67 ${easting.trim()}, ${northing.trim()}`
hint = { kind: 'twd67-tm2' }
```

The `TWD67` qualifier is required by the existing grammar (see
go-to-grammar.md §2.6); composing it here ensures the user never has
to type it.

### 2.6 `mgrs`

```text
raw  = `${gzdBand.toUpperCase().trim()} ` +
       `${square.toUpperCase().trim()} ` +
       `${easting.trim()} ` +
       `${northing.trim()}`
hint = { kind: 'mgrs' }
```

Empty → `errors.emptyInput`, fieldId `mgrs-{gzd|square|easting|northing}`.
Easting / northing field strings should already be digit-only after
field-level filtering (research D7).

### 2.7 `taipower`

```text
raw  = `${first5.toUpperCase().trim()} ${last4or6.toUpperCase().trim()}`
hint = { kind: 'taipower' }
```

Empty → `errors.emptyInput`, fieldId `taipower-{first5|last4or6}`.

---

## 3. Routing the composed input through the parser

The caller (the `GoToDialog`) routes per `hint`:

```ts
function submit(composed: ComposedInput): GoToRequest {
  switch (composed.hint.kind) {
    case 'auto':
      return parseGoTo(composed.raw);
    case 'wgs84-dd':
      return parseDdOnly(composed.raw);
    case 'wgs84-dms':
      return parseDmsOnly(composed.raw);
    case 'mgrs':
      return parseMgrsOnly(composed.raw);
    case 'twd97-tm2':
      return composed.hint.zone === 'auto'
        ? parseTm2InferredOnly(composed.raw)
        : parseTm2ExplicitOnly(composed.raw, composed.hint.zone);
    case 'twd67-tm2':
      return parseTwd67Only(composed.raw);
    case 'taipower':
      return parseTaipowerOnly(composed.raw);
  }
}
```

The `parse{Format}Only` helpers MUST be added to `src/coord/parser.ts`
as **named re-exports** of the existing sub-parsers (no new logic).
Each returns a `GoToRequest` (the same union the dispatcher returns)
so the caller's downstream code is identical to the auto path.

**Rationale (D1)**: explicit-format chips bypass the dispatcher's
ordering so the user gets a format-specific rejection message
(FR-012). The dispatcher remains the source of truth for `auto`.

---

## 4. Test obligations

The composer's unit suite (`tests/unit/coord/composer.spec.ts`) MUST
cover, for each format:

1. A canonical happy-path field set composing to a raw string that the
   matching sub-parser accepts (cross-checked against
   `tests/unit/fixtures/test-vectors.json`).
2. Empty-field rejection per field, asserting the right `fieldId`.
3. MGRS lower-case / Taipower lower-case input upper-cases in the
   composed string.
4. TWD67 raw is prefixed `TWD67 ` exactly once.
5. TWD97 with `zone: 119`, `zone: 121`, and `zone: 'auto'` produce
   distinct raw strings AND distinct hints.
6. Discriminant mismatch (selection vs fields) returns
   `errors.composer.discriminantMismatch`.

Round-trip property: for every canonical accepted example in
`go-to-grammar.md` §2.{1..7}, there exists a `LayoutFields` value
whose composed `raw` is byte-identical to the example (modulo
documented field-level normalisation: case-folded MGRS, trimmed
whitespace).
