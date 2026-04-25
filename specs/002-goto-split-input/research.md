# Phase 0 Research: Go-To Split-Field Input

**Feature**: `002-goto-split-input` | **Date**: 2026-04-25
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves the design questions implicit in the spec before
Phase 1 begins. The spec deliberately stays UI-flavoured; this file
captures the architecture decisions that the Phase 1 contracts depend on.

No `NEEDS CLARIFICATION` markers were emitted in `plan.md` — the
ambiguous areas surfaced during planning are listed and resolved below.

---

## D1. Layout-fields → canonical raw string composition

**Decision**: Introduce a pure helper, `src/coord/composer.ts ::
composeRaw(selection, fields)`, that returns
`{ raw: string, hint: SubParserHint }`. The `raw` MUST satisfy the
grammar in `specs/001-coord-map-pwa/contracts/go-to-grammar.md` for the
chosen format so the existing `parseGoTo` dispatcher (or its
sub-parsers) accepts it without modification. The `hint` lets the
caller bypass dispatcher ordering when the user explicitly chose a
chip — invoking the format's sub-parser directly so the rejection
message is format-specific (FR-012).

**Rationale**:

- Keeps the parser grammar frozen (Spec assumption: "any grammar gap is
  a separate amendment against feature 001 contracts").
- Makes the composition logic unit-testable in isolation against
  `test-vectors.json` without touching the DOM.
- A `hint` is necessary because today's dispatcher returns
  `errors.noSeparator` (the WGS84 DD rejection) for an MGRS string with
  a missing 100 km square — without a hint, an MGRS chip user would see
  a comma-separator error, which is exactly the failure mode FR-012
  rules out.

**Alternatives considered**:

- *Embed composition inside each Svelte component*. Rejected: would
  scatter the canonical-grammar knowledge across seven UI files and
  duplicate the test surface. Composer is a single file, seven cases,
  one spec file.
- *Build a typed AST per format and feed it to the parser via a new
  entry point*. Rejected: doubles the parser surface for no behavioural
  win. The parser already accepts strings; respecting that contract is
  cheaper.
- *Compose then re-run the full dispatcher even for explicit chips*.
  Rejected: violates FR-012 (format-specific error messages). A user
  who picked MGRS and forgot the 100 km square should see an
  MGRS-specific rejection, not a fallthrough.

**Planned ADR**: `docs/adr/0017-goto-split-layout-architecture.md`
(written at `/speckit.implement` time per Principle V).

---

## D2. Disambiguator candidate generation for `自動偵測`

**Decision**: `src/coord/disambiguate.ts :: candidates(raw)` returns
`readonly Candidate[]` where `Candidate = { kind: CoordinateKind,
target: WGS84DD, label: string, sub: 'twd97-zone-119' | 'twd97-zone-121'
| 'twd67' | 'mgrs' | 'taipower' | 'wgs84-dd' | 'wgs84-dms' }`. The
function runs the relevant sub-parsers explicitly:

1. WGS84 DD / DMS → 0 or 1 candidate.
2. MGRS → 0 or 1 candidate.
3. TWD97 TM2 → independently try **both** zones (119 and 121) via
   `parseTm2Explicit` with each zone forced; keep every back-projection
   that lands inside a published Taiwan-coverage box.
4. TWD67 TM2 → invoke `parseTwd67` *without* a `TWD67` qualifier (the
   spec's auto-detect path) and keep the result if it back-projects
   into Taiwan.
5. Taipower → invoke `parseTaipower`; this format is unambiguous so it
   contributes ≤ 1 candidate.

The dispatcher rules in feature 001 already pick a winner deterministically;
the **Disambiguator only opens** when `candidates(raw).length ≥ 2`. If
the disambiguator generator returns a single candidate, the existing
dispatcher's pick is used and the bottom sheet never appears.

**Rationale**:

- "Ambiguous" in the spec specifically calls out (a) bare TM2 E/N pair
  that projects plausibly into both zones and (b) TM2 E/N that could
  also be a valid TWD67 pair. Generating candidates by re-running the
  sub-parsers per zone / per datum models exactly that ambiguity.
- Reusing the existing sub-parsers means the rejection-category rules
  from feature 001 still hold; we don't reinvent grammar handling.
- Having the candidate set decoupled from the dispatcher result means
  unit tests can assert "this raw produces 2 candidates" without
  mocking the map.

**Alternatives considered**:

- *Always show the disambiguator on auto-detect*. Rejected: violates
  SC-004 (0 % false positives on unambiguous input).
- *Inline the candidate logic into `parser.ts`*. Rejected: would
  expand the public parser surface with an unrelated concept (UI
  disambiguation) and complicate feature 001's contract. Keeping it in
  a separate `disambiguate.ts` makes the dependency direction
  one-way (composer/disambiguate depend on parser; parser depends on
  nothing in this feature).

---

## D3. Recent-inputs storage schema

**Decision**: New localStorage key `pwa_map:gotoHistory_v1`; same
schema-guard pattern as `pwa_map:prefs`. Schema:

```ts
interface RecentEntry {
  format: { kind: 'auto' } | { kind: 'fixed'; value: CoordinateKind };
  raw: string;
  createdAt: number; // epoch millis
}

interface RecentList {
  version: 1;
  entries: RecentEntry[]; // ≤ 10, most-recent-first
}
```

`load()` returns an empty list on parse failure or `version !== 1`
(SC-005). `add(format, raw)` de-dupes by `(format, raw)` (moves an
existing entry to position 0 with a fresh `createdAt`), trims to the
10 most-recent entries, persists. `remove(format, raw)` removes one
entry by `(format, raw)`. The store is a thin functional wrapper —
no Svelte store coupling — so it stays unit-testable like
`preferences.ts`.

**Rationale**:

- Independent key (not nested into `pwa_map:prefs`) avoids cross-feature
  migration risk if the prefs schema later needs a version bump (Spec
  assumption "Storage key").
- 10 × ~100 bytes ≈ 1 KB; well below quota concerns.
- FIFO (oldest-out) semantics with LRU-style move-to-front on duplicate
  matches the spec's described behaviour exactly (FR-007, US2.AS1–3).

**Alternatives considered**:

- *Store in IndexedDB*. Rejected: 10-entry list, sub-1 KB, sync API in
  `localStorage` is sufficient and matches the existing pattern.
- *Store under `pwa_map:prefs` with a new `gotoHistory` field*. Rejected:
  forces a `prefs` schema bump on every recents schema change and
  couples two storage concerns under one validation routine.

**Planned ADR**: `docs/adr/0018-recents-storage-schema.md`.

---

## D4. Destination indicator — DOM overlay vs MapLibre marker

**Decision**: Implement the destination indicator as a **DOM overlay
inside the modal-host root**, positioned at the viewport center via
`position: fixed; left: 50%; top: 50%`. It is pinned to the screen,
not the map; it does NOT pan with the map. On a user pan or zoom
gesture (subscribe to `MapController.onMove`), the indicator hides
immediately. After 3 s without interaction, it fades out. A second
successful Go-To replaces the first instance (Spec edge case "fast pan
sequence").

**Rationale**:

- Spec assumption explicitly allows DOM overlay vs MapLibre marker;
  DOM overlay sidesteps the marker-cleanup risk (markers persist in
  the marker set unless removed).
- "Pinned to screen" is the correct semantics — Spec US3.AS4: "if the
  user pans within 3 s, the destination indicator disappears
  immediately (does not drift with the map)". A MapLibre marker would
  drift with the map, which violates US3.AS4.
- Cheap: a single small `<div>` with a CSS transition handles fade-in
  and fade-out without JS animation hooks.

**Alternatives considered**:

- *MapLibre marker that auto-removes after 3 s*. Rejected: drifts with
  pan; violates US3.AS4.
- *Canvas-drawn indicator into the map's WebGL layer*. Rejected:
  excessive complexity for a 3-second decoration; introduces a frame
  loop the rest of the codebase doesn't need.

---

## D5. Zoom preservation in `MapController.flyTo`

**Decision**: Amend `MapController.flyTo` so that, when the caller does
not pass a `zoom` option, the map's **current zoom** is forwarded as
the target zoom (instead of today's behaviour: snap to 15 if current
zoom < 10). Today's snap-to-15 was an MVP convenience for the cold-start
case in feature 001; once the user has chosen a zoom, the Go-To flow
must respect it (FR-011, SC-003).

The signature is unchanged. Callers that do want to override zoom
(e.g., a future "zoom to fit" affordance) still pass `{ zoom: n }`
explicitly.

**Rationale**:

- The only existing call site is `App.svelte` reacting to a Go-To
  submit. It currently passes no `zoom`, so the behaviour change is
  scoped.
- Spec FR-011 phrases the requirement as a constraint on `flyTo`
  itself ("Successful Go-To MUST NOT change the current zoom level"),
  not on individual call sites — fixing it at the controller is the
  correct layer.
- Backwards-compatible: any future caller that passed an explicit
  `zoom` is unaffected.

**Alternatives considered**:

- *Read current zoom in App.svelte and pass it explicitly per call*.
  Rejected: spreads the rule across call sites instead of localising it
  to the abstraction that owns the map. A future call site would have to
  re-discover the rule.
- *Add a separate `flyToPreservingZoom(target)` helper*. Rejected: two
  near-identical methods invite call-site mistakes; the existing method
  already meant "fly while preserving caller-set context", the snap-to-15
  fallback was an undocumented convenience.

**Planned ADR**: `docs/adr/0019-flyto-zoom-preservation.md`.

---

## D6. Format-chip-rack accessibility

**Decision**: Render the chip rack as a `<div role="tablist">` with each
chip as a `<button role="tab">`; the active chip has `aria-selected="true"`
and the corresponding layout body has `role="tabpanel"`
+ `aria-labelledby` referencing the chip's id. Arrow-Left / Arrow-Right
move focus across chips per ARIA tablist conventions; `Tab` from a chip
enters the layout body (so a sighted user does not lose linear
keyboard order). Long-pressed recent chips use a separate
`<button>`-with-context-menu pattern, **not** tablist semantics, to
avoid double meanings.

**Rationale**:

- The chip rack matches the tablist mental model — exactly one is
  active, switching one re-lays the body.
- Keeps the existing `Tab` order (FR-006) within the layout body; the
  chip rack's arrow-key navigation is a parallel axis layered on top
  per ARIA conventions.
- `aria-selected` survives screen readers correctly and removes the
  need for visually-only highlight cues, satisfying Principle III's
  accessibility baseline.

**Alternatives considered**:

- *Render chips as a `<select>`*. Rejected: a select doesn't preserve
  the visual chip-rack design from the reference doc, and forces a
  click-to-open interaction that's hostile on touch.
- *Plain `<button>`s without tablist semantics*. Rejected: assistive-
  tech users would not know that activating one chip re-organises the
  body.

---

## D7. MGRS field input handling (case + digits)

**Decision**: At the field level, the GZD+band field and the 100 km
square field run `value.toUpperCase()` on every input event before
binding (FR-004). The easting and northing fields use
`inputmode="numeric"` and an `on:input` handler that strips any
non-`/^\d/` character (also FR-004). Validation still happens at
compose time so paste of mixed-case `51ruh5517069437` lands in the
canonical-uppercase composed string.

**Rationale**:

- Handling at the field level prevents an unrecoverable composition
  error reaching the user — they never see "invalid letter" for a
  value they typed lowercase.
- Spec edge cases explicitly call out: lowercase auto-cap, non-digit
  paste filtering. Doing it at the field rather than the composer
  keeps the field's visible value identical to what the composer will
  use, which is the least confusing UX.

**Alternatives considered**:

- *Allow any input and rely on composer rejection*. Rejected: visible
  error spam during normal lowercase typing.
- *Block non-digit keypress events in the easting/northing fields*.
  Rejected: doesn't catch paste; the input-time strip is the simpler
  path.

---

## D8. Hemisphere selector (DMS layout)

**Decision**: Render N/S and E/W as a two-segment `<div role="radiogroup">`
with each option as `role="radio"` and `aria-checked`. Default to N for
latitude, E for longitude on first open. The selected hemisphere is
folded into the composed raw string as a trailing letter
(`25°02′01.0″ N`) per the §3 grammar's accepted shape.

**Rationale**:

- A two-segment toggle communicates "two options, one selected" without
  needing the operator to read a dropdown, matching FR-005.
- Aligns with the chip-rack a11y pattern (radio for "exactly one of
  N", tablist for "exactly one chip"); both follow native ARIA
  conventions.

**Alternatives considered**:

- *Plain `<select>` dropdown*. Rejected: more taps on touch, hostile
  for one-handed phone use.
- *Sign on the degree field (`-25` for southern)*. Rejected: forces
  the operator to remember the sign convention exactly when they're
  reading a value off voice dispatch labelled `S`.

---

## D9. i18n keys

**Decision**: All new copy lives under three top-level branches:
`goto.chips.*` (chip labels), `goto.fields.*` (field labels per layout),
`goto.recent.*` (tooltip + delete confirm), `goto.errors.*` (per-format
message keys aligned to the existing `errors.*` catalogue —
e.g., `goto.errors.dms.minutesOutOfRange` is an alias for the
existing `errors.dms.minutesOutOfRange` to preserve a single source of
truth in the parser). The `zh` locale is the canonical key set per
constitution v1.1.0; `en` and `ja` follow the same fallback chain
(`ja → en → zh`).

**Rationale**:

- Grouping by component (chips / fields / recent / errors) maps cleanly
  to the layout component boundary and keeps the diff per-locale
  symmetrical.
- Aliasing rather than duplicating the parser's existing error message
  keys avoids translation drift between feature 001 and feature 002.

**Alternatives considered**:

- *Reuse the parser's `errors.*` keys verbatim from chip-specific
  surfaces*. Rejected: makes the chip surface coupled to parser
  internals; prefer aliases that can drift independently if a
  format-specific message ever needs a different wording in a chip
  context.

---

## D10. Long-press deletion of recent chips

**Decision**: Detect long-press as a 500 ms `pointerdown` without a
`pointerup` or `pointermove` exceeding 6 px. On detection, open a
`<dialog>`-style confirmation overlay reusing the existing dialog
tokens. Confirm = remove from `RecentList`. Cancel = no-op. Tap
(< 500 ms) submits the entry directly per FR-008.

**Rationale**:

- 500 ms is the platform-conventional long-press threshold (Material
  + iOS HIG agree); 6 px tolerance avoids false long-presses from a
  fingertip wobble.
- Reusing the dialog component (existing `dialog` CSS) keeps the
  visual language consistent — Principle III.

**Alternatives considered**:

- *Show a delete `×` glyph on hover*. Rejected: doesn't work on touch.
- *Swipe-to-delete*. Rejected: collides with horizontal scrolling of
  the chip strip on narrow viewports.

---

## Summary

All `NEEDS CLARIFICATION` items are resolved. Phase 1 may proceed:
data-model.md, the four contract files, and quickstart.md are derived
from these decisions; no decision in this list will require revisiting
unless a Phase 1 review finds an inconsistency.
