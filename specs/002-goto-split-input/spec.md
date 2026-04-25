# Feature Specification: Go-To Split-Field Input

**Feature Branch**: `002-goto-split-input`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "Go To 參考 ..\atak_flutter_map\docs\ui\007-goto-modal-and-taipower-rows.md 座標輸入方式"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pick a format, type into labelled fields (Priority: P1)

An operator hearing a coordinate over voice dispatch ("Taipower G8152
FC56") must be able to enter it into the Go-To control without having
to remember the canonical delimiter between the first five characters
and the four or six trailing characters. They tap a **format chip**
at the top of the modal (e.g., `台電座標`), the body re-lays itself
into two labelled fields (`前 5 碼` and `後 4 或 6 碼`), the operator
types each half into the field labelled for it, presses `前往`, and
the map pans to the target.

Each of the six formats (WGS84 DD, WGS84 DMS, TWD97 TM2, TWD67 TM2,
MGRS, Taipower) gets its own split layout so users never have to
write degrees, minute-primes, double-primes, commas, or 100 km-square
whitespace by hand. An `自動偵測` chip is still present and keeps a
single free-text field for operators who prefer to paste a full
canonical string or who have stored one on a sticky note.

**Why this priority**: This is the whole point of the feature. The
existing single free-text dialog (shipped by feature 001-coord-map-pwa)
rejects a lot of almost-correct input — pasted DMS missing a prime,
Taipower without the space — and the only hint users get is an error
category like `malformed`. Split fields eliminate those rejections at
the UI layer because every field has one well-defined semantic slot.

**Independent Test**: Open the Go-To modal. Tap each of the seven
chips in turn. Verify the body reconfigures into the documented
field layout for each format (no field has to be inferred from the
chip label), with one exception: `自動偵測` shows the existing single
free-text field. Type known values into each layout's fields,
submit, and confirm the map lands on the published coordinate in
`test-vectors.json`.

**Acceptance Scenarios**:

1. **Given** the Go-To modal is open with `WGS84 (DD)` selected,
   **When** the operator types `25.033611` into `緯度` and
   `121.564472` into `經度` and presses `前往`, **Then** the map
   animates to Taipei 101 (WGS84 DD 25.033611, 121.564472) without
   changing the current zoom.
2. **Given** `WGS84 (DMS)` is selected, **When** the operator types
   `25`, `2`, `1.0` into the lat fields and selects `N`, then `121`,
   `33`, `52.099`, and selects `E`, and presses `前往`, **Then** the
   map animates to Taipei 101 within 1 m round-trip of the DD
   equivalent (FR-007 tolerance).
3. **Given** `MGRS` is selected, **When** the operator types `51R`
   into the zone+band field, `UH` into the 100 km square (auto-
   uppercased), `55170` into easting, `69437` into northing, and
   presses `前往`, **Then** the map animates to Taipei 101.
4. **Given** `台電座標` is selected, **When** the operator types
   `B7039` into 前 5 碼 and `BD32` into 後 4 碼, **Then** the map
   pans to the Taipower B7039 BD32 cell.
5. **Given** `TWD97 TM2` is selected and the operator types an easting
   + northing pair, **When** they submit, **Then** zone is resolved
   automatically per the §9 boundary rule (inherited from feature 001)
   and the toast surfaces the chosen zone.
6. **Given** the operator presses `Tab` inside any split layout,
   **When** focus is on any non-terminal field, **Then** focus
   advances to the next field left-to-right / top-to-bottom; on the
   terminal field, the soft-keyboard `Go` key submits directly.

---

### User Story 2 — Re-use a recent coordinate in one tap (Priority: P2)

An operator who has been jumping between a handful of targets during
a sortie can tap a **recent chip** in the modal to re-navigate
without re-typing. The recent list holds up to 10 entries, de-duped
by `(format, raw)`, FIFO-evicted on overflow, and persists across
app reloads.

Tap = submit-immediately-in-the-entry's-own-format (no prefill round
trip). Long-press = confirmation dialog then remove a single entry.
Hover / focus shows a tooltip `點擊使用此紀錄，長按可刪除` for
discoverability.

**Why this priority**: Saves time on repeat visits. Not blocking for
first-time input, so lower priority than US1.

**Independent Test**: Submit three distinct coordinates in three
different formats. Close and re-open the modal. Verify the three
recent chips appear in the most-recent-first order. Tap the middle
chip: the modal closes, the map pans, and the submitted entry rises
to the top of the list. Long-press another entry: the delete
confirmation appears; confirming removes exactly that entry and leaves
the others in order.

**Acceptance Scenarios**:

1. **Given** the recent list has entries `[A, B, C]`,
   **When** the operator submits a new entry `D`,
   **Then** the list becomes `[D, A, B, C]` and is persisted.
2. **Given** the list already contains 10 entries and the operator
   submits an 11th distinct entry, **Then** the oldest entry is
   evicted; total count stays at 10.
3. **Given** the operator submits entry `X` already present,
   **Then** `X` moves to the front of the list (no duplicate row).
4. **Given** the operator long-presses a recent chip and confirms,
   **Then** exactly that entry is removed and the modal stays open.
5. **Given** the operator long-presses and cancels, **Then** the list
   is unchanged.
6. **Given** the user reloads the page, **Then** the persisted list
   renders in the same order.

---

### User Story 3 — Disambiguate ambiguous numeric input + confirm landing (Priority: P3)

When `自動偵測` produces more than one plausible interpretation
(e.g., a bare TM2 E/N pair that projects plausibly into both zones, or
that could also be a TWD67 pair), the system MUST NOT silently pick
one. A bottom-sheet **Disambiguator** lists the candidate
interpretations with their decoded WGS84 preview; the operator picks.
If the input is unambiguous (DD / DMS / MGRS / explicit-zone TM2 /
Taipower / TWD67-qualified), the disambiguator never appears.

After a successful Go-To, a **destination indicator** — a fading pin
icon — overlays the map center for 3 seconds or until the user pans
or zooms, whichever comes first. Its purpose is to give the operator
a brief visual confirmation that "yes, we arrived here" without
leaving a permanent marker on the map. The map's current **zoom
level is preserved** across every Go-To: the operator's chosen scale
(e.g., 1:25 000 for planning, 1:2 500 for last-mile) is never reset.

**Why this priority**: Safety net + polish. Both the disambiguator
and the destination indicator prevent classes of silent errors but
neither blocks the core entry flow (US1). Zoom preservation is a
constraint on the flyTo behaviour, not new UI.

**Independent Test**:

- Enter `306962.887, 2769619.124` into `自動偵測` and submit. Verify
  the disambiguator appears listing TWD97 zone 121 (Taipei 101) and
  TWD97 zone 119 (at a Penghu-adjacent latitude) and TWD67 (Taipei
  101 via four-parameter). Pick zone 121. Verify the map lands on
  Taipei 101 and the destination indicator fades in and out over 3 s.
- Set the map zoom to 18 (street level). Submit a Go-To to a point
  100 km away. Verify the zoom after landing is still 18.

**Acceptance Scenarios**:

1. **Given** ambiguous input, **When** the operator submits,
   **Then** the disambiguator lists at least two candidate formats
   with their decoded WGS84 previews.
2. **Given** the disambiguator is open, **When** the operator cancels,
   **Then** the map does not move.
3. **Given** a successful Go-To completes, **Then** a destination
   indicator fades in at the map center, stays visible for 3 s, and
   then fades out; it never leaves a permanent marker on the map.
4. **Given** a Go-To completes and the user pans the map within 3 s,
   **Then** the destination indicator disappears immediately (does
   not drift with the map).
5. **Given** the current zoom level is `z`, **When** any successful
   Go-To completes, **Then** the zoom level after the animation is
   still `z`.

---

### Edge Cases

- **Empty required field**: Pressing `前往` with any required field
  empty surfaces a localised error (`errors.emptyInput` or
  `errors.noSeparator` depending on format) and does NOT submit.
- **Paste of multiline text into a split field**: Newlines are
  stripped before composition; the raw composed string is fed to
  `parseGoTo()` normally.
- **MGRS 100 km-square letter case**: Lower-case input (e.g., `uh`)
  is auto-capitalised to `UH` before composition.
- **MGRS easting / northing non-digit paste**: Non-digit characters
  are filtered at the field level so the composed string is always
  grammar-clean.
- **DMS hemisphere mismatch with a signed degree** (e.g., `-25° … N`):
  Rejected as `malformed` by the existing parser (inherited from US3);
  the UI surfaces the localised message.
- **Recent list full + new submit is a duplicate**: Existing entry
  moves to the front; no eviction.
- **Destination indicator during a fast pan sequence**: If a second
  successful Go-To lands before the first indicator expires, the
  first disappears immediately and the second replaces it.
- **Disambiguator cancellation while another Go-To is in flight**:
  First cancellation wins; second Go-To behaves as a fresh request.
- **Corrupt persisted recent list JSON**: Discard and return an empty
  list (same schema-guard discipline as `FormatPreferences`).
- **Operator with stored Taipower code pasted into Auto-detect**:
  The Auto-detect parser (inherited from US3) handles Taipower via
  `parseGoTo` → `parseTaipowerInput`; no disambiguator triggers
  because Taipower is unambiguous.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a **format chip rack** at the top of
  the Go-To modal containing exactly seven chips in this order:
  `自動偵測`, `台電座標`, `WGS84 (DD)`, `WGS84 (DMS)`, `TWD67 TM2`,
  `TWD97 TM2`, `MGRS`. The chip rack MUST wrap onto multiple lines
  on narrow viewports so every chip stays tappable.
- **FR-002**: System MUST re-lay the modal body based on the active
  chip. `自動偵測` shows a single free-text field. Every other chip
  shows a split layout with exactly one field per documented semantic
  component, per the layouts in `docs/ui/007-goto-modal-and-taipower-rows.md`.
- **FR-003**: System MUST assemble the canonical raw string from the
  active layout's fields before invoking the parser; the composed
  string MUST conform to the grammar in
  `specs/001-coord-map-pwa/contracts/go-to-grammar.md` for the chosen
  format.
- **FR-004**: For MGRS easting and northing fields, system MUST
  restrict input to decimal digits. For MGRS zone+band and 100 km
  square fields, system MUST up-case typed input before forwarding.
- **FR-005**: For WGS84 DMS hemisphere, system MUST render a
  two-segment selector (N / S for latitude; E / W for longitude)
  rather than a dropdown.
- **FR-006**: System MUST support keyboard navigation: `Tab` advances
  focus left-to-right / top-to-bottom across the active layout;
  `Shift+Tab` reverses. On the last field, the `Enter` key MUST
  submit.
- **FR-007**: System MUST persist a **recent-inputs list** of at most
  10 entries, stored as `(format, rawString, createdAt)` tuples,
  de-duped by `(format, rawString)`, FIFO-evicted on overflow,
  persisted across reloads.
- **FR-008**: Tapping a recent chip MUST submit that entry
  immediately in its own format (no field prefill round-trip) and
  close the modal on success. Long-pressing a recent chip MUST open
  a localised confirmation dialog; confirming removes exactly that
  entry.
- **FR-009**: When the `自動偵測` parser produces more than one
  plausible interpretation of the raw input, system MUST open a
  **Disambiguator** surface listing every candidate (format label +
  decoded WGS84 preview) and MUST NOT move the map until the operator
  explicitly picks one. Cancelling the disambiguator leaves the map
  untouched.
- **FR-010**: After every successful Go-To, system MUST overlay a
  **Destination Indicator** at the map center that fades out after
  3 seconds or when the user manually pans or zooms, whichever comes
  first. The indicator MUST NOT persist as a marker after it
  disappears.
- **FR-011**: Successful Go-To MUST NOT change the current zoom
  level. The map's zoom after the fly animation MUST equal the
  zoom before the submission.
- **FR-012**: The modal MUST reuse the existing parser
  (`parseGoTo` dispatcher from feature 001) for `自動偵測`. For
  explicit-format chips, the composed raw string MUST be validated
  against that format's sub-parser directly and the user MUST
  receive a format-specific error message on rejection (e.g.,
  `errors.dms.minutesOutOfRange`, not the generic
  `errors.noSeparator`).
- **FR-013**: All user-facing strings in the Go-To modal (chip
  labels, field labels, error text, tooltip copy, destination-
  indicator aria-label) MUST resolve via the existing i18n store
  with `zh` as the canonical key set, `ja → en → zh` fallback
  chain.
- **FR-014**: Recent-list storage MUST use a schema-guarded
  localStorage key. On parse failure or version mismatch, the entire
  list MUST be discarded and an empty list returned (no partial
  restoration).

### Key Entities *(include if feature involves data)*

- **FormatSelection**: The currently selected chip —
  `{ kind: 'auto' | CoordinateKind }`. Controls which body layout
  renders.
- **GoToRawInput**: The canonical raw string assembled from the
  active layout's fields, passed verbatim to the parser.
- **RecentEntry**: `{ format: FormatSelection, raw: string,
  createdAt: timestamp }`. Persisted.
- **RecentList**: `{ version: 1, entries: RecentEntry[] }`. Persisted
  to `localStorage['pwa_map:gotoHistory_v1']`, max 10 entries.
- **DisambiguatorChoice**: Candidate interpretation — `{ format:
  CoordinateKind, target: WGS84DD, label: string }`. Transient.
- **DestinationIndicator**: Transient viewport-overlay state —
  `{ visible: boolean, createdAt: timestamp, ttlMs: 3000 }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can enter a coordinate from voice dispatch
  (format + five or six tokens) and land on the target in **≤ 15
  seconds** from opening the modal to completing the fly animation,
  95th percentile, under `npm run preview` locally. (The Go-To
  latency sub-budget of ≤ 1 s from feature 001 SC-003 still applies
  to the submit→readout step.)
- **SC-002**: **Zero** canonical-delimiter-related rejections occur
  during the split-field flow: every rejected submission returns a
  *value-based* error category (`out-of-range`, `out-of-coverage`,
  `unsupported-precision`) or `malformed` for a field with wrong
  glyph (e.g., letter in an MGRS digit field). A rejection whose
  root cause is "user forgot to type the `°` glyph" MUST NOT occur.
- **SC-003**: **100 % of Go-To submissions preserve the map zoom
  level** — before vs after delta is exactly 0 for 100 automated
  Playwright runs at randomly-seeded starting zooms from 2 to 18.
- **SC-004**: On ambiguous auto-detect input, the Disambiguator
  appears in **100 % of trials** (no silent picks). When the input
  is unambiguous, the Disambiguator appears in **0 % of trials** (no
  false positives).
- **SC-005**: The recent list survives full page reloads with
  **100 % fidelity** on entries that were valid when persisted.
  Corrupt or version-mismatched stored data MUST result in an empty
  list (never a crash).
- **SC-006**: Tapping a recent chip completes the re-navigation in
  **≤ 1 second** (submit → flyTo → readout update), measured from
  chip-tap to readout-text-change.
- **SC-007**: The destination indicator disappears within
  **≤ 150 ms** of a user pan or zoom gesture that occurs before the
  3 s TTL expires.

## Assumptions

- **Dependency**: This feature builds on feature `001-coord-map-pwa`.
  The coord module (`src/coord/`), `parseGoTo` dispatcher, and
  `MapController.flyTo` exist and behave as specified by
  `specs/001-coord-map-pwa/contracts/`. This feature does NOT change
  the parser grammar; it only adds a new composition UI layer.
- **Dependency**: MapLibre GL JS provides the underlying map; the
  destination indicator is implemented as a DOM overlay centred on
  the viewport (not a MapLibre marker), so it auto-expires without
  polluting the marker set.
- **Locale**: Per Constitution v1.1.0 Locale conventions, the
  reference document's `zh-TW` attribution is canonicalised to
  `zh` in every code symbol, JSON key, and preference value. The
  copy in the reference document is a *translation source*, not a
  tag-casing source.
- **Reference doc scope**: The source document at
  `../atak_flutter_map/docs/ui/007-goto-modal-and-taipower-rows.md`
  describes both a Go-To modal rewrite AND a Coord-panel card-grid
  rewrite AND a Settings-screen format-selection section. This
  feature covers **only the Go-To modal input redesign** plus the
  destination indicator + zoom preservation behaviours. The Coord-
  panel and Settings redesigns are already covered by feature 001's
  `CoordinateReadout` (multi-row) + `FormatToggle` (modal) and are
  **out of scope** for 002.
- **Storage key**: Recent history uses a new localStorage key
  `pwa_map:gotoHistory_v1` (independent from `pwa_map:prefs` and
  `pwa_map:lastView` to avoid cross-feature migration risk).
- **Persistence size**: Max 10 recent entries × ~100 bytes each
  ≈ 1 KB; well below any quota concern.
- **Accessibility baseline**: Inherits Principle III accessibility
  invariants from feature 001 (WCAG AA contrast; `aria-live=
  "assertive"` error region; focus-on-open; `Escape` closes). New
  split-layout fields MUST each have an explicit `<label for=…>`.
- **Out of scope**: Desktop-specific right-click / left-swipe cycling
  gestures (mentioned in the reference doc for the CoordPanel) do
  not apply here — this feature is Go-To-only, and the multi-row
  readout from feature 001 already shows every format at once.
- **Out of scope**: Any change to the existing `parseGoTo` dispatcher
  grammar. If a grammar gap is discovered during implementation,
  that is a separate amendment against feature 001 contracts.
