# ADR 0010 — Go-To parser: ordered dispatch over seven sub-parsers

**Status**: Accepted
**Date**: 2026-04-24

## Context

Reference grammars §3–§8 define six coordinate systems plus a TWD97
inferred (no-zone) variant. Input is free-form — a pasted string or
typed tokens from any of the six. A classifier heuristic
("starts with two digits and a letter → MGRS") is brittle: a TWD97
easting starting with `51` could be misclassified.

## Decision

`parseGoTo(raw): GoToRequest` in `src/coord/parser.ts` dispatches to
seven sub-parsers in this fixed order:

1. WGS84 DD (`parseDd`)
2. WGS84 DMS (`parseDms`)
3. MGRS (`parseMgrsString`)
4. TWD97 TM2 zone-declared (`parseTm2Explicit`)
5. TWD97 TM2 zone-inferred (`parseTm2Inferred`)
6. TWD67 TM2 (`parseTwd67Input`, qualifier-gated)
7. Taipower (`parseTaipowerInput`)

Each sub-parser returns one of three verdicts: `accept` (wins
immediately), `reject` (this grammar claimed the input but fails
validation), or `decline` (not my format, keep trying). If every
parser ultimately rejects, the dispatcher returns the **most specific**
rejection per reference preference order:

```
out-of-coverage ≻ out-of-range ≻ unsupported-precision ≻ malformed
```

## Consequences

- Deterministic parse — every legal input has exactly one grammar
  assignment and one canonical error message on failure.
- `parseDd` is gated on DD-plausible magnitudes (`|lat|≤180, |lon|≤180`)
  OR explicit hemisphere/comma so MGRS-shaped inputs aren't falsely
  claimed by DD.
- The dispatcher itself is tiny (< 20 lines); all complexity lives in
  the per-grammar sub-parsers which can be unit-tested independently.

## Alternatives considered

- **ML classifier** — non-deterministic, requires training data.
- **Explicit format dropdown** — moves the parse decision onto the
  user; rejected for MVP.
