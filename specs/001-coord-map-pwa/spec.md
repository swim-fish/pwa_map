# Feature Specification: Taiwan Coordinate Map (PWA)

**Feature Branch**: `001-coord-map-pwa`
**Created**: 2026-04-24
**Status**: Draft
**Input**: User description: "參考 ..\atak_flutter_map\docs\coord-reference 座標轉換設計一個
PWA端 地圖。著重在 不同座標的顯示與轉換。Go To 移動到目標位置。中心點使用準星來表示座標位置"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Live coordinate readout under a fixed center crosshair (Priority: P1)

When the user opens the app they see a Taiwan-covering base map with a crosshair
reticle fixed to the exact geometric center of the map view. Below the map, a
live readout shows the WGS84 (lat, lon) coordinates of whatever location the
crosshair is currently over. As the user pans the map, the readout updates
continuously — the crosshair does not move relative to the screen; the map
slides under it.

**Why this priority**: Without this, the app is not a "coordinate map". The
crosshair + live readout is the minimum viable slice — it proves the map is
working, proves the coordinate pipeline is working, and lets users do a basic
"where is this?" task on the first load.

**Independent Test**: Launch the app, confirm a crosshair sits exactly in the
screen's center, pan the map to a known landmark (e.g., Taipei 101), and verify
the WGS84 readout matches the published landmark coordinate within the
tolerance defined in the coordinate reference document.

**Acceptance Scenarios**:

1. **Given** the app has loaded and the map is centered on Taipei 101, **When**
   the user looks at the coordinate readout, **Then** WGS84 DD shows
   `25.033611, 121.564472` within ±0.000002° tolerance.
2. **Given** the crosshair is over a non-Taiwan location (e.g., the user has
   panned to mid-Pacific), **When** the readout updates, **Then** WGS84 DD
   still displays a valid value AND the map surface flags the crosshair as
   "out of coverage for Taiwan-specific formats".
3. **Given** the user is actively panning the map, **When** the pan is in
   flight, **Then** the readout updates at least 10 times per second so the
   displayed coordinate visually tracks the crosshair.

---

### User Story 2 — Multi-format coordinate display and simultaneous conversion (Priority: P2)

The user sees the same crosshair position rendered in multiple coordinate
systems at once: WGS84 Decimal Degrees, WGS84 Degrees-Minutes-Seconds, TWD97
TM2 (zone auto-selected), TWD67 TM2, MGRS, and Taipower grid. Each format is
labelled, correctly converted, and updates in lock-step when the user pans.
The user can pick which formats are visible to avoid clutter on small
screens.

**Why this priority**: The user's stated focus is "different coordinate display
and conversion". US1 only displays one format; US2 delivers the actual
differentiating value of the product.

**Independent Test**: Park the crosshair at Taipei 101; verify every visible
format matches the test vectors in the reference document (`wgs84-*`,
`twd97-121-wgs84to-001`, `twd67-twd97to-001`, `mgrs-from-wgs84-001`, and the
corresponding Taipower code) within each format's stated tolerance.

**Acceptance Scenarios**:

1. **Given** the crosshair is at Taipei 101, **When** the user inspects all
   formats, **Then** TWD97 TM2 shows `E 306962.887, N 2769619.124 (zone 121)`
   within 0.1 m, TWD67 TM2 shows `E 306132.271, N 2769822.821` within 3.0 m,
   MGRS shows `51R UH 55170 69437` within 1 m, and the Taipower code matches
   the anchor-table derivation within 5 m.
2. **Given** the crosshair is at Magong port (119.566°, 23.565°), **When** the
   TWD97 TM2 readout is inspected, **Then** the zone label reads `zone 119`
   (not 121) and the values match `E 307778.298, N 2606963.573`.
3. **Given** the crosshair crosses the 120° E meridian, **When** the user
   observes the TWD97 TM2 label, **Then** the zone switches from 119 to 121
   at exactly `lon = 120.000000° E` per the documented boundary rule.
4. **Given** the user opens the format-visibility settings, **When** they
   hide Taipower, **Then** the Taipower line disappears from the readout and
   the preference persists across app reloads.

---

### User Story 3 — Go To a target coordinate (Priority: P2)

The user opens a "Go To" input, pastes or types a coordinate in any supported
format, and the map pans/zooms so the crosshair lands on that coordinate.
Accepted inputs include: WGS84 DD, WGS84 DMS (Unicode or ASCII glyphs),
TWD97 TM2 (zone 119 or 121), TWD67 TM2, MGRS (precision 1 through 5), and
Taipower grid (9-char and 11-char forms). Invalid input is rejected with a
human-readable reason drawn from the defined categories (`malformed`,
`out-of-range`, `out-of-coverage`, `unsupported-precision`).

**Why this priority**: The second half of the user's brief is "Go To — move
to the target location". This story delivers the active navigation capability
that complements the passive readout in US2.

**Independent Test**: In the Go To box, paste each of the following and
confirm the crosshair lands within tolerance on the expected point:
`25.033611, 121.564472` (Taipei 101 DD), `51R UH 55170 69437` (same, MGRS),
`E 306962.887 N 2769619.124 zone 121` (same, TWD97), a Magong port value in
zone 119. Also paste a malformed string and confirm the rejection message
names one of the four rejection categories.

**Acceptance Scenarios**:

1. **Given** the Go To box is empty, **When** the user pastes
   `25.033611, 121.564472` and submits, **Then** the map animates to that
   location and, after the animation, the WGS84 DD readout re-reports the
   same value within 0.000001° tolerance.
2. **Given** the Go To box contains `51R UH 55170 69437`, **When** the user
   submits, **Then** the map lands on Taipei 101 and MGRS re-derives the
   same string when the format is re-read at the landed position.
3. **Given** the user enters `25° 60′ 00.0″ N, 121° 00′ 00.0″ E` (minute
   field out of range), **When** they submit, **Then** the map does NOT
   move and an error message appears citing category `out-of-range` and
   explaining "minutes must be 0 to 59".
4. **Given** the user enters a Taipower code starting with `Y` (Penghu
   Taipower, which is out-of-coverage for this application), **When** they
   submit, **Then** the rejection message cites `out-of-coverage` and
   suggests entering the equivalent WGS84 DD or MGRS instead.
5. **Given** the user enters `E 306962.887 N 2769619.124` with no zone
   declaration and a value plausible for both zones, **When** the system
   applies the §9 boundary rule, **Then** the system resolves to zone 121
   (the `lon ≥ 120° E` branch, inferred from the implied WGS84 after
   inverse projection) AND surfaces a "zone auto-selected" hint so the
   user can override if needed.

---

### User Story 4 — Copy current coordinate to clipboard (Priority: P3)

The user taps a "copy" affordance next to any visible format and the exact
displayed string is placed on the system clipboard, ready to paste into a
message, a ticket, or another mapping tool.

**Why this priority**: Nice-to-have polish. Without it, users can hand-copy
the readout. With it, the app is useful as a coordinate-format converter even
without any Go To.

**Independent Test**: Park the crosshair at Taipei 101, tap copy next to MGRS,
paste into a text editor, and verify the pasted string equals
`51R UH 55170 69437` exactly (including whitespace) and that it re-parses
back to the same coordinate when pasted into Go To.

**Acceptance Scenarios**:

1. **Given** the crosshair is at a valid Taiwan location, **When** the user
   taps copy for WGS84 DMS, **Then** the clipboard contains the canonical
   DMS form (with Unicode degree / prime / double-prime glyphs).
2. **Given** a user has copied an MGRS string and immediately pastes it
   into Go To, **When** they submit, **Then** the crosshair returns to the
   original position within 1 m tolerance.

---

### Edge Cases

- **Zone boundary**: Point is exactly on `lon = 120.000000° E`. The system
  assigns zone 121 per the reference document's §9 rule and labels the zone
  explicitly so the user is never silently in a different zone than they
  expect.
- **Outer islands beyond Taipower coverage**: Taipower grid letters `Y`
  (Penghu) and `Z` (Kinmen / Matsu) are rejected with `out-of-coverage`.
  Other formats (WGS84 / MGRS) still render correctly for those locations.
- **Crosshair far outside Taiwan**: WGS84 formats keep working globally;
  TWD97 / TWD67 / Taipower display a "not available outside Taiwan" label
  rather than a bogus number.
- **Zoom level too low**: At very low zoom the crosshair may cover a 100 km+
  area on screen, so the coordinate is precise but the user's intent may
  not be. The readout accuracy is unaffected; no special handling required.
- **Paste with locale punctuation**: Thousand-separator commas
  (`E 306,962.887`) and full-width degree indicators are rejected as
  `malformed` per the reference grammar; the error message names the
  offending character.
- **Hemisphere ↔ sign conflict**: Input like `+25.033611° S, 121° E` is
  rejected as `malformed` because the sign and hemisphere letter disagree.
- **Network loss mid-pan**: Base map tiles may fail to load while the map
  is still pannable; the crosshair readout continues updating because it
  depends only on map state, not tile delivery.
- **Clipboard permission denied**: Copy action falls back to displaying
  the string in a selectable text field so users can copy manually.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an interactive map covering Taiwan main
  island, Penghu, Kinmen, Matsu, and outer-island territories that the
  reference document declares in-coverage.
- **FR-002**: System MUST render a crosshair reticle fixed to the exact
  geometric center of the visible map viewport. The reticle MUST remain
  centered when the user pans, zooms, resizes the window, or changes
  device orientation.
- **FR-003**: System MUST compute and display the coordinates corresponding
  to the crosshair's current position at all times while the map is
  visible.
- **FR-004**: System MUST display the crosshair's coordinates in ALL of
  the following formats when they are available for the current location:
  WGS84 Decimal Degrees, WGS84 Degrees-Minutes-Seconds, TWD97 TM2 (zone
  explicitly labelled), TWD67 TM2, MGRS, Taipower grid.
- **FR-005**: System MUST let users toggle which formats are visible and
  MUST persist that preference across app reloads.
- **FR-006**: System MUST automatically pick the TWD97 TM2 zone per the
  boundary rule: zone 119 when `lon < 120° E`, zone 121 when
  `lon ≥ 120° E`. The selected zone MUST appear as an explicit label next
  to the TWD97 reading.
- **FR-007**: Coordinate readouts MUST remain correct within the tolerance
  published by the reference document for each format: ±1 × 10⁻⁷°
  (DMS ↔ DD), ±0.1 m (TWD97 TM2), ±3 m (TWD67 TM2), ±1 m (MGRS at
  precision 5), ±5 m (Taipower 10 m-level).
- **FR-008**: System MUST provide a Go To control that accepts input in
  any of the six supported formats and moves the map so the crosshair
  lands on the entered position.
- **FR-009**: System MUST validate Go To input against the reference
  document's input grammar for each format and MUST reject malformed or
  unsupported input with a human-readable message that names one of these
  categories: `malformed`, `out-of-range`, `out-of-coverage`,
  `unsupported-precision`.
- **FR-010**: System MUST NOT move the map when Go To input is rejected;
  the user's previous view is preserved.
- **FR-011**: System MUST let the user copy the current reading of any
  visible format to the clipboard; the copied text MUST equal the
  displayed string byte-for-byte.
- **FR-012**: System MUST operate as a Progressive Web App: installable
  to the device, usable after the first online load even when the network
  is subsequently unavailable (coordinate computation and UI MUST NOT
  require network; only tile updates do).
- **FR-013**: System MUST display the base map provider's attribution
  string as required by that provider's licence.
- **FR-014**: System MUST indicate when the crosshair position is outside
  the coverage of a Taiwan-specific format (TWD97, TWD67, Taipower) by
  replacing the numeric value with a short explanatory label rather than
  showing a misleading number.
- **FR-015**: System MUST update the displayed coordinate within 100 ms of
  a map pan-end event under normal operating conditions (local
  computation, no network dependency).
- **FR-016**: When Go To auto-resolves an ambiguous zone, system MUST
  surface the auto-resolution to the user (e.g., "interpreted as TWD97
  zone 121") so the user can correct it before relying on the result.

### Key Entities *(feature involves data)*

- **Map View**: the current visible extent — center in WGS84, zoom level,
  pan/zoom state. Pure UI state; persisted only as "last view" for session
  restoration.
- **Coordinate Reading**: a single point expressed in one format (e.g.,
  `WGS84-DMS`, `TWD97-TM2-z121`). Carries the numeric values, the format
  label, the zone (for TM2 family), the precision level (for MGRS), and
  the coverage verdict (`ok`, `out-of-coverage`).
- **Go To Request**: a user-supplied raw string plus the parsed format it
  was interpreted as. On failure, carries the rejection category and a
  message. On success, yields a WGS84 DD target used to move the map.
- **Format Preferences**: the user's chosen subset of visible formats and
  their ordering; persisted between sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine the WGS84 coordinate of any point on a
  Taiwan-covering base map within 3 seconds of opening the app (load + pan
  + readout visible).
- **SC-002**: 100% of conversions match the published test vectors in the
  reference document within each format's stated tolerance.
- **SC-003**: 95% of valid Go To submissions move the map to the correct
  target within 1 second of submission (excluding initial app load).
- **SC-004**: 100% of invalid Go To submissions produce a rejection message
  naming one of the four defined categories within 500 ms.
- **SC-005**: Users can complete a round-trip "read coordinate at
  crosshair → copy → paste into Go To → return to original point" within
  10 seconds and land within 1 m of the starting position.
- **SC-006**: After the first online load, the app remains usable (pan,
  read, Go To, copy) for 100% of the supported formats when the device is
  subsequently offline; only tile refresh fails.
- **SC-007**: On a mid-range 2024 smartphone, coordinate readouts update
  at ≥ 10 Hz during continuous pan.
- **SC-008**: On first visit over a 10 Mbps connection, the map is
  interactive within 3 seconds; on repeat visits (cached), within 1
  second.

## Assumptions

- **Scope**: coverage is Taiwan and documented outlying islands per the
  reference document. Global coordinates can still be *displayed* in WGS84
  formats, but Taiwan-specific formats show an out-of-coverage label
  outside their defined bands.
- **Base map**: a Taiwan-covering tile source that is PWA-friendly (CORS
  permissive, no referer requirement, attribution-only licence or
  government-open) will be chosen at plan time from the reference
  document's §10 table. The user does not pick the provider; the product
  does.
- **Default visible formats**: WGS84 DD, WGS84 DMS, TWD97 TM2, and MGRS
  are visible by default. TWD67 and Taipower are togglable but hidden
  initially to keep the readout compact on small screens.
- **UI languages**: the application ships with three user-selectable
  locales — Traditional Chinese (`zh`, the default because the brief
  is in zh and the problem domain is Taiwan), English (`en`), and
  Japanese (`ja`). Users can switch locales at runtime; the choice is
  persisted alongside the format preferences. `zh` is the canonical
  key set; `en` and `ja` are translated against it. Format labels and
  rejection-category names are translated in every locale; the underlying
  coordinate numerals and MGRS / Taipower strings are locale-invariant.
- **Coordinate precision shown**: WGS84 DD to 6 decimals, DMS seconds to
  3 decimals, TWD97 / TWD67 metres to 3 decimals, MGRS at precision 5 by
  default (user-switchable), Taipower 10 m-level (9-char) by default.
- **Input grammar**: the system accepts exactly the grammars documented
  in the reference document; deviations (e.g., thousand separators) are
  rejected as `malformed` rather than being heuristically cleaned.
- **Offline model**: coordinate computation, Go To validation, and all
  conversion math run locally with no network call. Only base map tiles
  may require network; those are cached per PWA conventions.
- **Device**: modern browsers on both desktop and mobile. Touch gestures
  and mouse / keyboard are both first-class; no feature requires one
  over the other.
- **Reference document versioning**: the coordinate reference document is
  pinned as a read-only input at version 2.0.0 (dated 2026-04-24); any
  future revision requires a spec update before adoption.
