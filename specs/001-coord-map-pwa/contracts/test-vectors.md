# Contract: Test-Vector Consumption

**Feature**: `001-coord-map-pwa`
**Surface**: `tests/unit/fixtures/test-vectors.json` + the custom matcher
exposed in `tests/unit/helpers/vector-matchers.ts`.
**Consumers**: Every Vitest spec under `tests/unit/coord/`.

---

## 1. Source of truth

`tests/unit/fixtures/test-vectors.json` is an **exact byte-for-byte copy**
of the reference document's
`docs/coord-reference/test-vectors.json` at version `2.0.0` (dated
`2026-04-24`). The copy is checked into the repo; CI compares the copy's
SHA-256 against a pinned expected digest and fails if they differ.

Rationale: pinning protects tests from reference-document drift, while
making the upgrade path (`Δ SHA → update digest → re-run tests`) explicit
and auditable.

Upgrade procedure when the reference document publishes a new version:

1. Bump the pinned digest in `tests/unit/fixtures/vectors-digest.txt`.
2. Copy the new JSON into `test-vectors.json`.
3. Run the test suite; any failure is a real semantic change, not
   drift.
4. Log an ADR describing the upgrade under `docs/adr/NNNN-...md`
   (Principle V).

---

## 2. Matcher API

```ts
// tests/unit/helpers/vector-matchers.ts
export interface ToleranceSpec {
  value: number;
  unit: 'm' | 'deg' | 'arcsec' | 'cell';
}

export function expectWithinTolerance(
  actual: Record<string, number | string>,
  expected: Record<string, number | string>,
  tolerance: ToleranceSpec,
  axis?: 'lat' | 'lon' | 'easting' | 'northing' | 'all',
): void;
```

- For `unit: 'm'`: compares numeric fields as metres; `|a - e| ≤ value`.
- For `unit: 'deg'`: compares as decimal degrees; fields expected to be
  `lat` / `lon` / `dd`.
- For `unit: 'arcsec'`: converts to arcseconds first (multiply DMS `sec`
  delta by 1 for seconds, `min` delta by 60, `deg` delta by 3600) before
  comparing.
- For `unit: 'cell'`: Taipower — asserts the encoded cell's 4-letter +
  2-digit prefix is byte-identical, and the remaining digits differ by
  ≤ 1 cell at the digit's resolution.

String-only fields (`mgrs`, `hemisphere`, `direction`) are compared by
strict equality after Unicode NFC normalisation — no tolerance.

---

## 3. Runner pattern

Each spec under `tests/unit/coord/*.spec.ts` loads the JSON once,
filters by `direction`, and iterates. Example:

```ts
// tests/unit/coord/twd97.spec.ts
import { describe, test } from 'vitest';
import vectors from '../fixtures/test-vectors.json';
import { expectWithinTolerance } from '../helpers/vector-matchers';
import { wgs84ToTwd97 } from '../../../src/coord';

describe('WGS84 → TWD97 TM2', () => {
  const applicable = vectors.vectors.filter(v => v.direction === 'WGS84_TO_TM2');
  test.each(applicable)('$id — $input.lat,$input.lon', (v) => {
    const actual = wgs84ToTwd97({
      kind: 'wgs84-dd',
      lat: v.input.lat,
      lon: v.input.lon,
    });
    expectWithinTolerance(actual, v.expected, v.tolerance);
  });
});
```

- Every listed vector contributes one test case.
- No skipping: every converter must cover 100% of its applicable vectors.
- CI prints the vector `id` on failure so the offending reference entry
  is one click away.

---

## 4. Directions → test files matrix

| `direction`           | Vitest spec file                         | Underlying function |
|-----------------------|------------------------------------------|---------------------|
| `DD_TO_DMS`           | `tests/unit/coord/wgs84.spec.ts`         | `ddToDms`           |
| `DMS_TO_DD`           | `tests/unit/coord/wgs84.spec.ts`         | `dmsToDd`           |
| `WGS84_TO_TM2`        | `tests/unit/coord/twd97.spec.ts`         | `wgs84ToTwd97`      |
| `TM2_TO_WGS84`        | `tests/unit/coord/twd97.spec.ts`         | `twd97ToWgs84`      |
| `TWD97_TO_TWD67`      | `tests/unit/coord/twd67.spec.ts`         | `twd97ToTwd67`      |
| `TWD67_TO_TWD97`      | `tests/unit/coord/twd67.spec.ts`         | `twd67ToTwd97`      |
| `WGS84_TO_MGRS`       | `tests/unit/coord/mgrs.spec.ts`          | `wgs84ToMgrs`       |
| `MGRS_TO_WGS84`       | `tests/unit/coord/mgrs.spec.ts`          | `mgrsToWgs84`       |
| `WGS84_TO_TAIPOWER`   | `tests/unit/coord/taipower.spec.ts`      | `wgs84ToTaipower`   |
| `TAIPOWER_TO_WGS84`   | `tests/unit/coord/taipower.spec.ts`      | `taipowerToWgs84`   |

If the reference document defines a `direction` that has no `applicable`
vectors in the JSON (e.g., `TAIPOWER_TO_WGS84` may be absent in v2.0.0),
the spec still sets up the matcher and skips the `test.each` block —
but emits a `console.info` line so the gap is visible in CI output.

---

## 5. Tolerance rules (from the reference tables)

These are the authoritative tolerances that the custom matcher applies.
Implementation must *not* introduce looser thresholds.

| Source table | Tolerance | Notes |
|---|---|---|
| WGS84 DD → DMS | 0.01 arcsec | Per `wgs84-ddtodms-*` |
| WGS84 DMS → DD | 1 × 10⁻⁷° | Per `wgs84-dmstodd-*` |
| WGS84 ↔ TWD97 TM2 | 0.1 m | Per `twd97-*` |
| TWD97 ↔ TWD67 (four-param) | 3.0 m | Per `twd67-*` |
| WGS84 ↔ MGRS (precision 5) | 1 m | Per `mgrs-*` |
| WGS84 ↔ MGRS (precision ≤ 4) | (10^(5-p)) m | Per reference §7 precision table |
| WGS84 ↔ Taipower (10 m) | 5 m | Per reference §8 hierarchy table |

For precision-sensitive vectors (MGRS at p < 5, Taipower 11-char), the
matcher reads `tolerance` directly from the vector and applies it
without widening.

---

## 6. What belongs here vs. in round-trip tests

Test-vector tests assert **agreement with externally-verified reference
values** — i.e., "we get the same answer as proj4 / NGA / government
doc X".

Round-trip tests (described in `coord-api.md §7.2`) assert **internal
consistency** — i.e., "forward then inverse recovers the original within
double the one-direction tolerance". Both classes are required and
neither is a substitute for the other.
