# Phase 1 Data Model: Go-To Split-Field Input

**Feature**: `002-goto-split-input` | **Date**: 2026-04-25
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document inventories every entity introduced or extended by feature
002 and shows how they relate. All types live in `src/types/coord.ts`
(extended) or `src/types/goto.ts` (new file) so they can be re-imported
from components without circular paths.

Existing types from feature 001 (`WGS84DD`, `CoordinateKind`, `Zone`,
`MGRSPrecision`, `TaipowerPrecision`, `Locale`, `Rejection`,
`GoToRequestOk`) are reused verbatim.

---

## 1. FormatSelection

The active chip in the rack. Drives which layout body renders and
which sub-parser the composer routes to.

```ts
// src/types/goto.ts
export type FormatSelection =
  | { readonly kind: 'auto' }
  | { readonly kind: 'fixed'; readonly value: CoordinateKind };
```

- `kind: 'auto'` → renders `AutoLayout.svelte`; on submit, the raw
  string goes through the full `parseGoTo` dispatcher.
- `kind: 'fixed'` → renders the format's split layout; on submit, the
  composed raw goes through the named sub-parser only (per
  research D1).

**Validation**: the chip rack constrains `FormatSelection` to one of
the seven allowed values (`auto`, `wgs84-dd`, `wgs84-dms`, `twd97-tm2`,
`twd67-tm2`, `mgrs`, `taipower`). No other `CoordinateKind` is
selectable.

**State transitions**: arbitrary chip → arbitrary chip. Switching chips
preserves no field state across formats (each layout owns its own
fields). Deliberate: cross-format prefill would invite garbage data
(e.g., DD `25.03` typed into MGRS GZD `25R`).

---

## 2. LayoutFields (per format)

Each layout's typed field state. These are local Svelte component
state and are passed to the composer as a discriminated union:

```ts
// src/types/goto.ts
export type LayoutFields =
  | { kind: 'auto'; raw: string }
  | { kind: 'wgs84-dd'; lat: string; lon: string }
  | {
      kind: 'wgs84-dms';
      latDeg: string; latMin: string; latSec: string; latHem: 'N' | 'S';
      lonDeg: string; lonMin: string; lonSec: string; lonHem: 'E' | 'W';
    }
  | {
      kind: 'twd97-tm2';
      easting: string; northing: string;
      zone: 'auto' | 119 | 121;
    }
  | { kind: 'twd67-tm2'; easting: string; northing: string }
  | {
      kind: 'mgrs';
      gzdBand: string; square: string; easting: string; northing: string;
    }
  | {
      kind: 'taipower';
      first5: string;
      last4or6: string;
      precision: 9 | 11;
    };
```

**Validation rules**:

- `wgs84-dd`: `lat`, `lon` parseable as signed decimals; `|lat| ≤ 90`,
  `|lon| ≤ 180`. Validation runs in the composer; the field-level
  rejection is "empty" only.
- `wgs84-dms`: each scalar field digit-or-dot only;
  `0 ≤ deg`, `0 ≤ min < 60`, `0 ≤ sec < 60`. Hemisphere is constrained
  by the segmented selector.
- `twd97-tm2`: easting / northing positive decimals (no thousand
  separators per the existing grammar). `zone === 'auto'` triggers the
  inferred sub-parser; explicit zones invoke `parseTm2Explicit`.
- `twd67-tm2`: same as TWD97 minus zone (TWD67 has no zone selector).
- `mgrs`: `gzdBand` matches `/^\d{1,2}[C-HJ-NP-X]$/`; `square` matches
  `/^[A-HJ-NP-Z]{2}$/`; easting/northing digit strings of equal length
  ≥ 1 ≤ 5.
- `taipower`: `first5` matches `/^[A-X][0-9]{4}$/`; `last4or6` matches
  `/^[A-J]{2}[0-9]{2}$/` for `precision === 9` or
  `/^[A-J]{2}[0-9]{4}$/` for `precision === 11`.

**State transitions**: switching chip discards `LayoutFields`. Within a
layout, fields update independently per keystroke; submission is the
only state-elevating event.

---

## 3. RecentEntry / RecentList

Persisted recent-inputs store. See research D3 for storage rationale.

```ts
// src/types/goto.ts
export interface RecentEntry {
  readonly format: FormatSelection;
  readonly raw: string;       // canonical raw string (post-compose)
  readonly createdAt: number; // epoch millis
}

export interface RecentList {
  readonly version: 1;
  readonly entries: readonly RecentEntry[]; // ≤ 10, most-recent-first
}
```

**Persistence**: `localStorage['pwa_map:gotoHistory_v1']` (independent
of `pwa_map:prefs` per research D3).

**Identity**: `(format, raw)` is the de-dup key. Two entries with the
same `format` but different `raw` are distinct; same `raw` with
`format.kind === 'auto'` and `format.kind === 'fixed', value: 'wgs84-dd'`
are also distinct (because the disambiguation context is part of
identity).

**Lifecycle / state transitions**:

- `add(format, raw)` →
  - If matching `(format, raw)` exists: move to head with fresh
    `createdAt`.
  - Else: prepend; trim to 10 entries.
  - Persist.
- `remove(format, raw)` → drop the matching entry; persist.
- `load()` → returns `RecentList` or empty list on any error
  (FR-014, SC-005).
- `save()` → JSON-serialises and writes; ignores quota errors.

**Invariants**:

- `entries.length ≤ 10` always.
- No two entries share `(format, raw)`.
- `entries[0]` is the most recently used.

---

## 4. Candidate (Disambiguator)

Transient — never persisted.

```ts
// src/types/goto.ts
export interface Candidate {
  readonly kind: CoordinateKind;
  readonly target: WGS84DD;        // back-projected for preview
  readonly label: string;          // localised "TWD97 zone 121" etc.
  readonly sub:
    | 'wgs84-dd'
    | 'wgs84-dms'
    | 'mgrs'
    | 'twd97-zone-119'
    | 'twd97-zone-121'
    | 'twd67'
    | 'taipower';
  readonly raw: string;             // raw string the candidate decoded from (echo of input)
}
```

**Source of truth**: `src/coord/disambiguate.ts :: candidates(raw)`.

**Lifecycle**:

- Generated on every `自動偵測` submit.
- Passed to the bottom-sheet UI only when `length ≥ 2`.
- Discarded when the user picks one (operation flows through to
  `flyTo`) or cancels (modal stays put; map untouched per FR-009).

---

## 5. DestinationIndicator (transient view state)

```ts
// src/types/goto.ts
export interface DestinationIndicator {
  readonly visible: boolean;
  readonly createdAt: number;  // epoch millis at fade-in start
  readonly ttlMs: 3000;
}
```

**Lifecycle**:

- Set `{ visible: true, createdAt: now, ttlMs: 3000 }` on every
  successful `flyTo`.
- Set `{ visible: false }` on (a) `now - createdAt ≥ 3000` (fade out)
  or (b) `MapController.onMove` fired before fade-out (immediate hide,
  SC-007).
- A new successful `flyTo` while `visible === true` resets
  `createdAt = now` (replaces the previous indicator — Spec edge case
  "fast pan sequence").

**Where it lives**: a top-level Svelte store in `App.svelte` (or
co-located inside `DestinationIndicator.svelte` as component-local
state with a `start()` method exposed via `bind:`). The Phase 1
contract file `destination-indicator.md` pins the public API.

---

## 6. Relationships

```text
ChipRack ── selects ──▶ FormatSelection
                              │
                              ▼
                    chooses one of the 7 layout components
                              │
                              ▼
                       LayoutFields (component-local)
                              │
              user presses 前往
                              │
                              ▼
              composer.composeRaw(selection, fields)
                              │
                              ▼
                  { raw, hint } ── routed to ──▶ parseGoTo
                                                   │
                                                   ▼
                                  { ok: true, target } ──▶ flyTo (preserve zoom)
                                                                │
                                                                ▼
                                                  DestinationIndicator (start)
                                                                │
                                                                ▼
                                          recents.add(selection, raw)
                                                                │
                                                                ▼
                                                  RecentList (persisted)

For ambiguous auto-detect:
                  candidates(raw) → length ≥ 2 → Disambiguator opens
                                                       │
                                          user picks Candidate
                                                       │
                                                       ▼
                                       flyTo(candidate.target) (same downstream chain)
```

---

## 7. Files affected

| File | Status | What it owns |
|---|---|---|
| `src/types/goto.ts` | NEW | All types in this document. |
| `src/types/coord.ts` | UNCHANGED | Pre-existing `CoordinateKind`, `WGS84DD`, etc. |
| `src/coord/composer.ts` | NEW | `composeRaw(selection, fields)` (D1). |
| `src/coord/disambiguate.ts` | NEW | `candidates(raw)` (D2). |
| `src/storage/recents.ts` | NEW | `load()`, `add()`, `remove()` (D3). |
| `src/components/goto/*.svelte` | NEW | Per-layout UI ownership. |
| `src/components/GoToDialog.svelte` | REWRITTEN | Hosts chip rack + active layout + recents row + disambiguator + indicator. |
| `src/map/MapController.ts` | AMENDED | `flyTo` zoom-preservation (D5). |
| `tests/unit/coord/composer.spec.ts` | NEW | Composer round-trips. |
| `tests/unit/coord/disambiguate.spec.ts` | NEW | Candidate-set assertions. |
| `tests/unit/storage/recents.spec.ts` | NEW | Append/dedup/evict/version-guard. |
| `tests/integration/go-to-split.spec.ts` | NEW | Component-level wiring. |
| `tests/e2e/story-3b-split-and-recents.spec.ts` | NEW | E2E for US1 / US2 / US3. |
