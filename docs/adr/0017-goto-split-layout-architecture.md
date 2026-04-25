# ADR 0017 — Go-To split-layout architecture

**Status**: Accepted (landed 2026-04-25)
**Date**: 2026-04-25
**Feature**: `002-goto-split-input`

## Context

Feature 002 replaces the single free-text Go-To input with seven
format-aware layouts (one per supported coordinate format plus
`自動偵測`). The composer must turn typed `LayoutFields` into a
canonical raw string that satisfies the grammar in
`specs/001-coord-map-pwa/contracts/go-to-grammar.md` so the existing
`parseGoTo` dispatcher accepts it without modification. Format-explicit
chips additionally need a way to surface the matching format-specific
rejection message (FR-012) instead of a generic dispatcher fallthrough.

## Decision

Introduce a pure helper `src/coord/composer.ts :: composeRaw(selection,
fields): ComposeResult` that returns either
`{ ok: true, value: { raw, hint } }` or
`{ ok: false, error: { messageKey, fieldId } }`. The `hint` discriminates
which sub-parser the caller should invoke:

- `auto` → `parseGoTo` (full dispatcher).
- `wgs84-dd` → `parseDdOnly`.
- `wgs84-dms` → `parseDmsOnly`.
- `mgrs` → `parseMgrsOnly`.
- `twd97-tm2` (with zone) → `parseTm2InferredOnly` or
  `parseTm2ExplicitOnly`.
- `twd67-tm2` → `parseTwd67Only`.
- `taipower` → `parseTaipowerOnly`.

Each `parse{Format}Only` is a thin re-export of the existing internal
sub-parser — no grammar change.

## Consequences

- The parser grammar from feature 001 stays frozen.
- Composition logic is unit-testable in isolation against
  `tests/unit/fixtures/test-vectors.json`.
- Format-specific chips bypass dispatcher ordering, so a user who
  picked MGRS and forgot the 100 km square sees an MGRS-specific
  rejection (FR-012 satisfied).
- One pure module to evolve when new layouts are added.

## Alternatives considered

- **Embed composition inside each Svelte component** — rejected:
  scatters canonical-grammar knowledge across seven UI files.
- **Build a typed AST per format and feed it to the parser** —
  rejected: doubles parser surface for no behavioural win.
- **Compose then re-run the full dispatcher even for explicit chips**
  — rejected: violates FR-012.

## Implementation outcome

Landed in `src/coord/composer.ts` and the seven layout components under
`src/components/goto/` (plus the rewritten `GoToDialog.svelte`). The
`parser.ts` named re-exports (`parseDdOnly`, `parseDmsOnly`,
`parseMgrsOnly`, `parseTm2InferredOnly`, `parseTm2ExplicitOnly`,
`parseTwd67Only`, `parseTaipowerOnly`) match the contract one-for-one.
All seven layouts route through the matching sub-parser; format-specific
rejection messages reach the user as required by FR-012.

## References

- Research: `specs/002-goto-split-input/research.md` §D1
- Contract: `specs/002-goto-split-input/contracts/composer.md`
