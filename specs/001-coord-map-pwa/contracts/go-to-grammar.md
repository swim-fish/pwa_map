# Contract: Go To Input Grammar

**Feature**: `001-coord-map-pwa`
**Surface**: `src/coord/parser.ts` — the `parseGoTo()` function and its
sub-parsers for each format.
**Consumers**: `GoToDialog.svelte`, clipboard-paste handlers, Playwright
acceptance tests.

This file is the single authoritative translation of the reference
document's Input-grammar tables (§3–§8) into a parser contract. Every
rejected example in the reference document MUST appear as a `parser`
test case, reproducing both the rejection category and the triggering
input verbatim.

---

## 1. Top-level contract

```ts
// src/coord/parser.ts
export function parseGoTo(raw: string): GoToRequest;
```

- Input `raw` is trimmed of leading/trailing whitespace and Unicode
  normalised (`.normalize('NFC')`) before dispatch. Interior whitespace
  is preserved.
- Empty string → `Rejection{ category: 'malformed', messageKey: 'errors.emptyInput' }`.

The parser tries sub-parsers in the order declared in research R10:

```
WGS84 DD → WGS84 DMS → MGRS → TWD97 TM2 (zone-declared)
→ TWD97 TM2 (inferred) → TWD67 TM2 → Taipower
```

The first sub-parser whose grammar matches owns the input. If every
sub-parser rejects, the parser returns the **most specific** rejection —
one of `out-of-range`, `out-of-coverage`, `unsupported-precision`,
`malformed` — in that preference order.

---

## 2. Per-format sub-grammars

Each sub-grammar below reproduces the reference document's Accepted /
Rejected examples with the category that MUST be emitted.

### 2.1 WGS84 DD — `src/coord/wgs84.ts :: parseDd`

**Accepted**:

| Example | Notes |
|---|---|
| `25.033611, 121.564472` | canonical DD, comma separator |
| `N 25.033611, E 121.564472` | hemisphere-prefixed |
| `25.033611°N, 121.564472°E` | degree glyph optional |
| `-23.500000, 121.000000` | signed DD, southern hemisphere |

**Rejected** (category):

| Example | Category |
|---|---|
| `25.033611 121.564472 500` | `unsupported-precision` (third token / altitude) |
| `95.000000, 121.000000` | `out-of-range` (`|lat| > 90`) |
| `25.033611 121.564472` | `malformed` (no comma/semicolon/explicit hemisphere token) |
| `+25.033611° S, 121.564472° E` | `malformed` (sign ↔ hemisphere disagree) |

### 2.2 WGS84 DMS — `src/coord/wgs84.ts :: parseDms`

**Accepted**:

| Example | Notes |
|---|---|
| `25°02′01.0″ N, 121°33′52.099″ E` | Unicode glyphs |
| `25° 02' 01.000" N, 121° 33' 52.099" E` | ASCII d/'/"/delimiters (spaces ok) |
| `N 25° 2′ 1″, E 121° 33′ 52.099″` | hemisphere-prefixed |

**Rejected**:

| Example | Category |
|---|---|
| `25°60′00.0″ N, 121°00′00.0″ E` | `out-of-range` (`min ≥ 60`) |
| `25°02′60.0″ N, 121°00′00.0″ E` | `out-of-range` (`sec ≥ 60`) |
| `25°02′01.0″ Z, 121°33′52.099″ E` | `malformed` (unknown hemisphere letter) |
| `25º02′01.0″ N, 121°33′52.099″ E` | `malformed` (ordinal indicator `º` U+00BA; reference §3 Implementation notes) |

### 2.3 MGRS — `src/coord/mgrs.ts :: parseMgrs`

**Accepted**:

| Example | Notes |
|---|---|
| `51R UH 55170 69437` | canonical, precision 5 |
| `51RUH5517069437` | joined, no spaces |
| `51ruh5517069437` | lowercase (case-insensitive) |
| `51R UH 5 7` | precision 1 (10 km) — coarse but valid |
| `51R UH 5517 6943` | precision 4 (10 m) |

**Rejected**:

| Example | Category |
|---|---|
| `51Q` | `unsupported-precision` (no 100-km square / digits) |
| `51R UH 12345 6789` | `malformed` (odd digit count in tail) |
| `51R II 12345 67890` | `malformed` (`I` excluded from letter alphabet) |
| `51R UH 55 70 123` | `malformed` (mismatched easting/northing lengths) |
| `50Z QM 00000 00000` | `out-of-coverage` (latitude band `Z` unassigned) |

### 2.4 TWD97 TM2 zone-declared — `src/coord/twd97.ts :: parseTm2Explicit`

Accepts input only when a zone is present (as `zone=119`, `zone 119`,
`(zone 119)`, or the `E 306962 N 2769619 (zone 121)` form). If no zone
declaration is present, this sub-parser declines so the inferred
sub-parser gets a try.

**Accepted**:

| Example | Notes |
|---|---|
| `306962.887, 2769619.124 (zone 121)` | comma separator, parenthetic zone |
| `E 307778 N 2606963 (zone 119)` | labelled E/N with zone |
| `306962.887, 2769619.124, zone=121` | key-value zone |

**Rejected**:

| Example | Category |
|---|---|
| `306962.887, 2769619.124, 550` | `unsupported-precision` (altitude token) |
| `-306962, 2769619 (zone 121)` | `out-of-range` (negative easting) |
| `306962.887; 2769619.124 (zone 121)` | `malformed` (semicolon separator) |
| `306962.887, 2769619.124, zone=120` | `out-of-range` (zone not in {119, 121}) |
| `30.3152, 27.70714 (zone 121)` | `out-of-range` (km-scale values) |

### 2.5 TWD97 TM2 zone-inferred — `src/coord/twd97.ts :: parseTm2Inferred`

Accepts the TM2 E/N shape *without* a zone declaration; emits
`zoneAutoResolved` per R11. Back-projects against both zones and picks
per §9. If both projections fall inside plausible Taiwan bands, picks
zone 121 (§9 default). Surfaces `zoneAutoResolved` on success.

**Accepted** (same shape as 2.4 minus the zone tokens):

| Example | Notes |
|---|---|
| `306962.887, 2769619.124` | inferred → zone 121 |
| `E 307778 N 2606963` | inferred → zone 119 (Magong band) |
| `306962.887 2769619.124` | whitespace separator |

**Rejected**:

| Example | Category |
|---|---|
| `306962.887,2769619.124,altitude=12` | `unsupported-precision` |
| `-306962, 2769619` | `out-of-range` (negative easting) |
| `306,962.887 2,606,963.573` | `malformed` (thousand separators) |
| `99999.999, 9999999.999` | `out-of-range` (both zones' back-projection outside Taiwan) |

### 2.6 TWD67 TM2 — `src/coord/twd67.ts :: parseTm2`

Requires a `TWD67` or `twd67=true` qualifier in the raw text; otherwise
TM2-shaped input is assumed to be TWD97 per the §4/§5/§6 contrast.

**Accepted**:

| Example | Notes |
|---|---|
| `TWD67 306132.271, 2769822.821` | qualifier-prefixed |
| `TWD67 E 306132 N 2769822` | labelled |
| `306132.271, 2769822.821, twd67=true` | key-value qualifier |

**Rejected**:

| Example | Category |
|---|---|
| `TWD67 306132 m, 2769822 m` | `malformed` (unit suffix rejected) |
| `TWD67 -306132, 2769822` | `out-of-range` (negative easting) |
| `TWD67 306132.271, 2769822.821, zone=119` | `out-of-range` (TWD67 has no zone 119) |
| `TWD67 306.132 km, 2769.822 km` | `malformed` (km unit) |

### 2.7 Taipower — `src/coord/taipower.ts :: parseTaipower`

**Accepted**:

| Example | Notes |
|---|---|
| `H7547 FA23` | spaced 9-char form |
| `H7547FA23` | joined 9-char form |
| `H7547 FA2367` | 11-char (1 m) form |
| `h7547fa23` | lowercase (case-insensitive) |

**Rejected**:

| Example | Category |
|---|---|
| `Y1234 AB56` | `out-of-coverage` (Penghu region letter) |
| `Z0000 AA00` | `out-of-coverage` (Kinmen/Matsu region letter) |
| `H7547 IA23` | `malformed` (letter `I` excluded from 100 m alphabet A–J) |
| `H7547 FA2` | `malformed` (odd digit count) |
| `H7547FA` | `unsupported-precision` (missing 10 m digits) |
| `12345 AB67` | `malformed` (leading char must be a letter) |

---

## 3. Rejection message catalogue

Each sub-parser emits `Rejection.messageKey` from a known catalogue.
Keys live in `src/i18n/zh.json` and `en.json`.

| messageKey | category | When emitted |
|---|---|---|
| `errors.emptyInput` | malformed | `raw` is empty after trim |
| `errors.noSeparator` | malformed | WGS84 DD / DMS without comma or hemisphere tokens |
| `errors.thirdToken` | unsupported-precision | altitude/elevation token detected |
| `errors.latOutOfRange` | out-of-range | `|lat| > 90` |
| `errors.lonOutOfRange` | out-of-range | `|lon| > 180` |
| `errors.dms.minutesOutOfRange` | out-of-range | `min ≥ 60` |
| `errors.dms.secondsOutOfRange` | out-of-range | `sec ≥ 60` |
| `errors.hemisphereMismatch` | malformed | sign and hemisphere disagree |
| `errors.mgrs.oddDigits` | malformed | MGRS tail has odd digit count |
| `errors.mgrs.invalidLetter` | malformed | MGRS uses `I` or `O` |
| `errors.mgrs.polarBand` | out-of-coverage | latitude band outside standard MGRS alphabet |
| `errors.tm2.negativeEasting` | out-of-range | negative easting for Taiwan |
| `errors.tm2.negativeNorthing` | out-of-range | negative northing for Taiwan |
| `errors.tm2.unknownZone` | out-of-range | zone not in {119, 121} |
| `errors.tm2.bothZonesFail` | out-of-range | inferred parse: both zones project outside Taiwan |
| `errors.twd67.kmUnit` | malformed | km unit suffix rejected |
| `errors.taipower.outerIsland` | out-of-coverage | region letter Y or Z |
| `errors.taipower.invalidHundredMeter` | malformed | 100-m letter outside A–J |
| `errors.taipower.wrongLength` | unsupported-precision | length not 9 or 11 chars |
| `errors.taipower.notALetter` | malformed | first char not a letter |

---

## 4. Ordering and ambiguity — worked examples

Two Go-To worked examples showing how the dispatcher's ordering resolves
genuinely ambiguous input:

### 4.1 `25.033611, 121.564472`

- `parseDd` accepts → `WGS84DD{25.033611, 121.564472}`. MGRS / TM2
  sub-parsers are never tried.

### 4.2 `306962.887, 2769619.124`

- `parseDd` rejects (`|lat| > 90` — 306962 is out of range).
- `parseDms` rejects (no `° ′ ″` glyphs and no minutes/seconds tokens).
- `parseMgrs` rejects (starts with digits but no GZD/letter pair).
- `parseTm2Explicit` rejects (no zone declaration).
- `parseTm2Inferred` accepts; back-project lands at `(25.034°, 121.564°)`
  for zone 121; zone 121's rule (`lon ≥ 120`) applies; result is
  `TWD97TM2{306962.887, 2769619.124, zone: 121}` with
  `zoneAutoResolved = 121`.

### 4.3 `H7547 FA23`

- DD / DMS / MGRS / TM2 all reject (doesn't match their grammars).
- `parseTwd67` rejects (missing `TWD67` qualifier).
- `parseTaipower` accepts → `TaipowerCode{region:'H', subRegion:'7547',
  hundredMeter:'FA', tenMeter:'23', oneMeter:null, precision: 9}`.

### 4.4 `Y1234 AB56`

- DD / DMS / MGRS / TM2 / TWD67 all reject.
- `parseTaipower` emits `out-of-coverage` with `errors.taipower.outerIsland`.
- The dispatcher returns that `Rejection` (rather than an earlier
  `malformed`) because `out-of-coverage` outranks `malformed`.
