# Phase 1 Data Model: Taiwan Coordinate Map (PWA)

**Feature**: `001-coord-map-pwa`
**Date**: 2026-04-24

The feature has no persisted database, but it does have a clear *client-side*
data model — the shapes that flow between the map, the coordinate math, the
readout, and browser storage. Every type is a pure TypeScript declaration
so it can be tested without a DOM.

This file is the source of truth for those types; code in `src/coord/` and
`src/types/` must mirror it exactly. When the implementation needs a new
field, update this file *first* (Constitution Principle V).

---

## 1. Geographic primitives (branded types)

Branded (nominal) types prevent accidental swaps (e.g., passing an Easting
where a Northing is expected).

```ts
// src/types/coord.ts

export type Lat = number & { readonly __brand: 'Lat' };   // degrees, -90..90
export type Lon = number & { readonly __brand: 'Lon' };   // degrees, -180..180
export type Easting  = number & { readonly __brand: 'E' };// metres
export type Northing = number & { readonly __brand: 'N' };// metres
export type Zone = 119 | 121;                             // TWD97 TM2 zone
export type Hemisphere = 'N' | 'S' | 'E' | 'W';
```

**Validation invariants**:
- `Lat`: finite, `-90 ≤ v ≤ 90`.
- `Lon`: finite, `-180 ≤ v ≤ 180`.
- `Easting`: finite, ≥ 0 for all Taiwan-plausible points.
- `Northing`: finite, ≥ 0 for all Taiwan-plausible points.
- `Zone`: exactly one of the two literals.

Constructors live in `src/coord/wgs84.ts` and friends; they return
`Result<T, RejectionReason>` rather than throw.

---

## 2. Coordinate values — one entity per supported format

Each format is a distinct *value object* (immutable). All six are
interconvertible through `WGS84DD` as the canonical hub.

### 2.1 `WGS84DD`

```ts
export interface WGS84DD {
  readonly kind: 'wgs84-dd';
  readonly lat: Lat;
  readonly lon: Lon;
}
```

- Canonical form used for storage, Go To intermediate, and all internal
  transfers.
- No `altitude` field (reference document explicitly rejects
  three-token inputs with `unsupported-precision`).

### 2.2 `WGS84DMS`

```ts
export interface DMSPart {
  readonly deg: number;        // integer, 0..180
  readonly min: number;        // integer, 0..59
  readonly sec: number;        // decimal, 0 ≤ sec < 60
  readonly hemisphere: Hemisphere;
}
export interface WGS84DMS {
  readonly kind: 'wgs84-dms';
  readonly lat: DMSPart;       // hemisphere N or S
  readonly lon: DMSPart;       // hemisphere E or W
}
```

- `hemisphere` overrides any numeric sign — all parts are unsigned magnitudes.
- A `+23° S` construction is rejected as `malformed` by the parser
  (reference §3 "hemisphere letter wins, and disagreement is malformed").

### 2.3 `TWD97TM2`

```ts
export interface TWD97TM2 {
  readonly kind: 'twd97-tm2';
  readonly easting: Easting;
  readonly northing: Northing;
  readonly zone: Zone;         // 119 or 121 — always explicit
}
```

- `zone` is always populated, even when the zone was auto-selected by the
  boundary rule (§9). UI always shows the zone label (FR-006).

### 2.4 `TWD67TM2`

```ts
export interface TWD67TM2 {
  readonly kind: 'twd67-tm2';
  readonly easting: Easting;
  readonly northing: Northing;
  // No `zone` — TWD67 TM2 is defined only at central meridian 121° E.
}
```

- Distinguished from `TWD97TM2` by the `kind` discriminant; do not "unify"
  them — the four-parameter shift applies only between these two, not
  within them.

### 2.5 `MGRSValue`

```ts
export type MGRSPrecision = 1 | 2 | 3 | 4 | 5;

export interface MGRSValue {
  readonly kind: 'mgrs';
  readonly gzd: string;        // e.g., "51R"  — 2 digits + 1 letter
  readonly square: string;     // e.g., "UH"   — 2 letters, I/O excluded
  readonly easting: number;    // unsigned integer, precision digits
  readonly northing: number;   // unsigned integer, precision digits
  readonly precision: MGRSPrecision;
}
```

- Canonical string: `${gzd} ${square} ${pad(easting, precision)} ${pad(northing, precision)}`.
- The `easting` and `northing` fields are digit-count-sensitive — they are
  NOT metres. Converting to metres requires the full GZD/UTM chain.

### 2.6 `TaipowerCode`

```ts
export type TaipowerPrecision = 9 | 11;  // char count

export interface TaipowerCode {
  readonly kind: 'taipower';
  readonly region: string;            // single letter A..X (Y/Z rejected)
  readonly subRegion: string;         // 4 digits
  readonly hundredMeter: string;      // 2 letters A..J
  readonly tenMeter: string;          // 2 digits
  readonly oneMeter: string | null;   // 2 digits if precision 11, else null
  readonly precision: TaipowerPrecision;
}
```

- Canonical string: `${region}${subRegion} ${hundredMeter}${tenMeter}${oneMeter ?? ''}`.
- `region` must be one of A–X; `Y` / `Z` rejected with `out-of-coverage`
  (R12 in research.md).

---

## 3. Union type — `CoordinateValue`

```ts
export type CoordinateValue =
  | WGS84DD
  | WGS84DMS
  | TWD97TM2
  | TWD67TM2
  | MGRSValue
  | TaipowerCode;

export type CoordinateKind = CoordinateValue['kind'];
```

- Discriminated by `kind`; every consumer is a `switch (value.kind)` with
  exhaustiveness checking on.
- Never drop `kind` — it is load-bearing for UI rendering and test-vector
  pairing.

---

## 4. Result & rejection types

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export type RejectionCategory =
  | 'malformed'
  | 'out-of-range'
  | 'out-of-coverage'
  | 'unsupported-precision';

export interface Rejection {
  readonly category: RejectionCategory;
  readonly messageKey: string;   // i18n key, resolved at render time
  readonly raw: string;          // offending input, for echoing
  readonly attemptedAs?: CoordinateKind; // last grammar tried
}
```

- `RejectionCategory` is the closed enum the reference document defines in
  every format's Input grammar; exposing it through the UI satisfies FR-009.
- `messageKey` is an i18n key (e.g., `errors.dms.minutesOutOfRange`), not a
  pre-formatted string; the UI looks it up per locale.

---

## 5. `CoordinateReading` — what the UI actually renders

A single row in the readout panel.

```ts
export interface CoordinateReading {
  readonly kind: CoordinateKind;
  readonly value: CoordinateValue | null;  // null iff coverage = 'out-of-coverage'
  readonly display: string;                // pre-formatted canonical string
  readonly coverage: 'ok' | 'out-of-coverage';
  readonly outOfCoverageLabel?: string;    // i18n key, set iff coverage != 'ok'
}
```

- `value` is null exactly when `coverage == 'out-of-coverage'`; this is the
  "not available outside Taiwan" case (FR-014).
- `display` is already locale-formatted — saves the UI from re-formatting
  every frame during pan.
- `kind` is redundant with `value.kind` when `value != null`, but kept so
  out-of-coverage rows still know which row they represent.

---

## 6. `MapViewState` — transient + persisted map state

```ts
export interface MapViewState {
  readonly center: WGS84DD;
  readonly zoom: number;       // MapLibre zoom, typically 0..22
  readonly bearing: number;    // degrees, 0 = north up
  readonly pitch: number;      // degrees, 0 = top-down
}
```

- Persisted to `localStorage['pwa_map:lastView']` on `moveend` (debounced).
- Restored on app boot; if missing or invalid → default to Taipei 101
  (25.033611, 121.564472) at zoom 13.
- `bearing` and `pitch` are kept at 0 in MVP; the fields exist because
  MapLibre writes them unconditionally and we want lossless restore.

---

## 7. `FormatPreferences` — persisted user choices

```ts
export type Locale = 'zh' | 'en' | 'ja';

export interface FormatPreferences {
  readonly version: 1;                       // schema version for migration
  readonly visible: readonly CoordinateKind[]; // ordered, duplicates rejected
  readonly mgrsPrecision: MGRSPrecision;      // default 5
  readonly taipowerPrecision: TaipowerPrecision; // default 9
  readonly locale: Locale;                    // default 'zh'
}
```

- Persisted to `localStorage['pwa_map:prefs']` as JSON.
- `version` gates future migrations; on `version != 1` (future) the code
  path is a migration or reset, not a silent parse.
- `locale` is one of the three supported UI languages: `zh`
  (Traditional Chinese, default), `en` (English), `ja` (Japanese).
  Fallback chain for missing keys: `ja → en → zh` (research R9).
- Default value when unset: `{ version: 1, visible: ['wgs84-dd',
  'wgs84-dms', 'twd97-tm2', 'mgrs'], mgrsPrecision: 5, taipowerPrecision:
  9, locale: 'zh' }` — unless the very first boot finds a matching
  `navigator.language`, in which case that seeds `locale` (but the
  persisted record wins on every subsequent boot).

---

## 8. `GoToRequest` — the Go-To parse result

```ts
export interface GoToRequestOk {
  readonly ok: true;
  readonly raw: string;
  readonly parsedAs: CoordinateKind;
  readonly target: WGS84DD;          // always the final destination
  readonly zoneAutoResolved?: Zone;  // set iff ambiguity was auto-resolved
}

export type GoToRequest = GoToRequestOk | { readonly ok: false; readonly error: Rejection };
```

- `parsedAs` tells the UI which grammar won, so the success toast can
  say "辨識為 TWD97 TM2 zone 121".
- `zoneAutoResolved` satisfies FR-016.

---

## 9. Relationships (data flow)

```
┌─────────────────────┐  pan/zoom  ┌─────────────────────┐
│  User gesture       │──────────▶│  MapViewState       │
│  (mouse/touch/keys) │            │  (src/map/…)        │
└─────────────────────┘            └──────────┬──────────┘
                                              │ center.lat, center.lon
                                              ▼
                                    ┌────────────────────────┐
                                    │  WGS84DD (canonical)   │
                                    └──────────┬─────────────┘
                                               │ fan-out
   ┌──────────────┬──────────────┬─────────────┼──────────────┬──────────────┐
   ▼              ▼              ▼             ▼              ▼              ▼
WGS84DMS     TWD97TM2       TWD67TM2       MGRSValue     TaipowerCode   (coverage
                                                                          check)
   └──────────────┴──────────────┴─────────────┴──────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │  CoordinateReading[]        │
                   │  (filtered by FormatPrefs)  │
                   └─────────────┬───────────────┘
                                 │ render
                                 ▼
                         CoordinateReadout.svelte

 ┌──────────────┐  submit  ┌──────────────────────┐  target  ┌──────────┐
 │ Go To input  │────────▶│  parser.parse()      │─────────▶│ MapView  │
 │ (raw string) │          │  → GoToRequest       │          │ flyTo()  │
 └──────────────┘          └──────────────────────┘          └──────────┘
                                     │ if !ok
                                     ▼
                           ┌──────────────────────┐
                           │  Rejection (toast)   │
                           └──────────────────────┘
```

---

## 10. State-transition rules

### 10.1 Coverage verdict (applied per format per reading)

```text
Input: (lat, lon)
For each TW-specific format K in {TWD97, TWD67, Taipower}:
  if (lat, lon) is inside K's coverage bounding box (reference §4.Coverage,
       §5.Coverage, §6.Coverage, §8.Coverage):
      coverage = 'ok'
      compute value; render canonical string
  else:
      coverage = 'out-of-coverage'
      value = null
      display = i18n('coverage.notInTaiwan')

WGS84 DD / DMS: coverage is always 'ok' globally.
MGRS: 'ok' anywhere on Earth except polar (|lat| > 84) — which Taiwan is not.
```

### 10.2 Zone auto-selection (applied during Go-To parse only)

```text
Input: TM2 E/N pair without zone declaration
Try zone 121 inverse → (lat121, lon121)
Try zone 119 inverse → (lat119, lon119)

If lon121 >= 120:    accept zone 121
Elif lon119 < 120:   accept zone 119
Elif both:           accept zone 121 (§9 default)
Else:                reject as 'out-of-range'

zoneAutoResolved = chosen zone
```

### 10.3 FormatPreferences migration

```text
Read localStorage['pwa_map:prefs']
If null → return default
If not JSON-parseable → discard, return default
If version != 1 → (future: call migration; MVP: discard, return default)
Validate each field; discard entire blob on any invariant violation
```

---

## 11. Test-vector binding

`tests/unit/fixtures/test-vectors.json` is an exact copy of the reference
document's `test-vectors.json` v2.0.0. Each vector maps to a `(kind, kind)`
pair per the `direction` enum (reference `test-vectors.schema.json`):

| direction            | from `kind` | to `kind`  |
|----------------------|-------------|------------|
| `DD_TO_DMS`          | wgs84-dd    | wgs84-dms  |
| `DMS_TO_DD`          | wgs84-dms   | wgs84-dd   |
| `WGS84_TO_TM2`       | wgs84-dd    | twd97-tm2  |
| `TM2_TO_WGS84`       | twd97-tm2   | wgs84-dd   |
| `WGS84_TO_MGRS`      | wgs84-dd    | mgrs       |
| `MGRS_TO_WGS84`      | mgrs        | wgs84-dd   |
| `TWD97_TO_TWD67`     | twd97-tm2   | twd67-tm2  |
| `TWD67_TO_TWD97`     | twd67-tm2   | twd97-tm2  |
| `WGS84_TO_TAIPOWER`  | wgs84-dd    | taipower   |
| `TAIPOWER_TO_WGS84`  | taipower    | wgs84-dd   |

The Vitest spec loads the JSON, groups by direction, and invokes the right
pure function. Tolerance comparisons use the vector's `tolerance.unit` to
pick a comparator (metres, arcsec, degrees, or 100 m-cell).
