# Contract: Coordinate Conversion API

**Feature**: `001-coord-map-pwa`
**Surface**: `src/coord/index.ts` (public) + supporting modules
**Consumers**: All UI components, Go-To parser, Playwright E2E harness, any
future external caller.

The coordinate module is the only place in the codebase allowed to import
`proj4` or `mgrs`. Everything else depends on this surface. That isolation
keeps the coord math independently testable (Principle II — TDD) and lets
us swap upstream libraries without UI churn.

---

## 1. Module initialisation

```ts
// src/coord/index.ts
export function initCoord(): void;
```

- MUST be called exactly once, before any conversion, during app boot
  (`src/app/main.ts`).
- Registers the canonical proj4 strings for EPSG:3826 and EPSG:3825
  (reference §4, §5). Does NOT register EPSG:3828 (reference §6 warning).
- Idempotent: second and subsequent calls are no-ops.

---

## 2. Canonical WGS84 helpers

```ts
export function makeLat(v: number): Result<Lat, Rejection>;
export function makeLon(v: number): Result<Lon, Rejection>;
export function makeWGS84DD(lat: number, lon: number): Result<WGS84DD, Rejection>;
```

- Reject non-finite numbers as `malformed`.
- Reject out-of-range as `out-of-range` (`|lat| > 90`, `|lon| > 180`).
- Never throw. Callers get a tagged `Result`.

---

## 3. Pairwise converters — all lossless to tolerance

Each converter is a pure function. Inputs and outputs use the Phase 1 data
model types verbatim.

### 3.1 WGS84 DD ↔ DMS

```ts
export function ddToDms(dd: WGS84DD): WGS84DMS;
export function dmsToDd(dms: WGS84DMS): WGS84DD;
```

- Round-trip to ≤ 1 × 10⁻⁷° (reference test vectors `wgs84-dmstodd-*`).
- DMS rendering uses Unicode `° ′ ″` glyphs by default; ASCII variants
  remain valid on input but are normalised on output.

### 3.2 WGS84 ↔ TWD97 TM2 (both zones)

```ts
export function wgs84ToTwd97(dd: WGS84DD, zone?: Zone): TWD97TM2;
export function twd97ToWgs84(tm2: TWD97TM2): WGS84DD;
```

- If `zone` omitted, applied per reference §9 (`lon < 120° → 119`, else
  121). Exactly 120.0° → 121 (§9).
- Forward: ±0.1 m vs. reference test vectors (`twd97-121-wgs84to-*`,
  `twd97-119-wgs84to-*`).
- Inverse: ±0.1 m — no published vectors; verified by round-trip in
  contract tests (`| (tm2 → wgs84 → tm2) − tm2 | ≤ 0.1 m`).

### 3.3 WGS84 ↔ TWD67 TM2 (via TWD97)

```ts
export function wgs84ToTwd67(dd: WGS84DD): TWD67TM2;
export function twd67ToWgs84(twd67: TWD67TM2): WGS84DD;
```

- Internal pipeline: WGS84 → TWD97 TM2 zone 121 → four-parameter shift
  → TWD67 TM2 (reference §6).
- ±3 m (reference `twd67-twd97to-*`).
- The simple two-constant offset (reference §6 deprecated path) MUST
  NOT be exposed; the four-parameter formula is the only supported
  path.

### 3.4 WGS84 ↔ MGRS

```ts
export function wgs84ToMgrs(dd: WGS84DD, precision?: MGRSPrecision): MGRSValue;
export function mgrsToWgs84(mgrs: MGRSValue): WGS84DD;
```

- `precision` defaults to 5 (1 m).
- Tail digits are **truncated**, not rounded (reference §7).
- ±1 m at precision 5 (`mgrs-from-wgs84-*`).

### 3.5 WGS84 ↔ Taipower (via TWD67)

```ts
export function wgs84ToTaipower(dd: WGS84DD, precision?: TaipowerPrecision): Result<TaipowerCode, Rejection>;
export function taipowerToWgs84(code: TaipowerCode): Result<WGS84DD, Rejection>;
```

- `precision` defaults to 9 (10 m resolution).
- Pipeline: WGS84 → TWD97 → TWD67 → region-letter lookup (reference §8
  anchor table) → encode digits + hundred-metre letters.
- Outer islands (region letter `Y` or `Z`) → `out-of-coverage`.
- Encoding uses floor (truncation) per reference §8 algorithm.

---

## 4. Direct format ↔ format helpers

Some conversions are common enough that the dispatcher exposes a direct
helper even though it fan-in through WGS84 DD. These are convenience
wrappers; do not add new hub-bypassing paths.

```ts
export function twd97ToTwd67(tm2: TWD97TM2): TWD67TM2;          // §6
export function twd67ToTwd97(tm2: TWD67TM2): TWD97TM2;          // §6 inverse
export function twd67ToTaipower(tm2: TWD67TM2, precision?: TaipowerPrecision): Result<TaipowerCode, Rejection>;
export function taipowerToTwd67(code: TaipowerCode): Result<TWD67TM2, Rejection>;
```

---

## 5. Formatters (canonical display strings)

```ts
import type { Locale } from '../types/coord'; // 'zh' | 'en' | 'ja'

export function formatWGS84DD(dd: WGS84DD, locale?: Locale): string;
export function formatWGS84DMS(dms: WGS84DMS, locale?: Locale): string;
export function formatTWD97TM2(tm2: TWD97TM2, locale?: Locale): string;
export function formatTWD67TM2(tm2: TWD67TM2, locale?: Locale): string;
export function formatMGRS(mgrs: MGRSValue): string;
export function formatTaipower(code: TaipowerCode): string;
```

- The formatter for each value MUST produce a string that, when fed back
  through the Go To parser, yields the original value within round-trip
  tolerance (round-trip invariant enforced by a Vitest property test).
- `locale` affects label language (e.g., English `zone 121` / zh
  `121 分帶` / ja `ゾーン 121`) but NEVER the numeric content. MGRS and
  Taipower strings are locale-invariant — they are codes, not prose.
- `locale` defaults to the current `FormatPreferences.locale` when
  omitted; an explicit argument always wins.

---

## 6. Coverage checks

```ts
export function coverageOf(kind: CoordinateKind, dd: WGS84DD): 'ok' | 'out-of-coverage';
```

- Used by the readout to populate `CoordinateReading.coverage` without
  attempting an encode that would fail.
- Bounding boxes are the ones in reference §4.Coverage / §5.Coverage /
  §6.Coverage / §8.Coverage.

---

## 7. Exhaustive contract tests

For every converter above, the test suite asserts:

1. **Vector match** — for each applicable vector in `test-vectors.json`,
   the converter's output is within the vector's `tolerance` of its
   `expected`. Failure = test fail, no soft fallback.
2. **Round trip** — for 100 randomised WGS84 DD points inside Taiwan's
   bounding boxes, `from(to(x)) ≈ x` within the combined tolerance of
   the two converters.
3. **Coverage boundary** — points inside and on the edge of each
   coverage box behave per the `ok` / `out-of-coverage` rule.
4. **Error surface** — malformed inputs return `Rejection` with the
   correct `category`; never throw.
5. **Benchmark** — single-point conversion time ≤ 1 ms at p99 on a
   mid-range reference machine (CI runs the benchmark but asserts only
   the median).

---

## 8. Error semantics — the short answer

- Pure converters (DD↔DMS, zone-explicit WGS84↔TM2, etc.) return the
  value directly; domain error categories (`out-of-coverage` for
  Taipower, bad zone, etc.) return `Result<T, Rejection>` so the caller
  can't ignore them.
- The parser (contract `go-to-grammar.md`) is the only place where
  `malformed`, `out-of-range`, and `unsupported-precision` originate —
  the converters themselves only ever produce `out-of-coverage`.
