# Feature Specification: Mobile UI Adjustments — Touch Targets, Segmented Coordinate Readout, Notification Stacking

**Feature Branch**: `009-mobile-ui-fixes`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "手機端 UI 調整，以利 手機端的按鈕可以點選的到(不能太小); 座標的顯示方式(分割顯示) 要與 Go To 一樣; 通知訊息與其他元件擋住問題"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable mobile touch targets (Priority: P1)

A user holding a phone with one thumb wants to tap any on-screen control — compass toggle, zoom in / zoom out, settings icon, toolbar items (Go To, Layers, Locate Me), copy buttons next to coordinate readout values, install banner actions, service-worker update actions, and any open dialog's confirm / dismiss buttons — and have the tap register on the first try without mis-targeting a neighbour and without triggering double-tap page zoom.

**Why this priority**: When a control cannot be tapped reliably, the user cannot use the app at all on a phone. This is foundational; every other improvement assumes controls work. It directly addresses the user's primary complaint ("按鈕可以點選的到 (不能太小)").

**Independent Test**: Open the PWA on a phone-class viewport (e.g. 360×640) and tap each on-screen control once. Each tap should activate the intended control on the first attempt, with no neighbouring control accidentally activated and no browser double-tap zoom triggered.

**Acceptance Scenarios**:

1. **Given** the app is open on a phone-size viewport, **When** the user taps the compass toggle, zoom in, zoom out, settings icon, any visible toolbar button, install banner action, update prompt action, or any coordinate-row copy button, **Then** the tap registers and the control's action runs.
2. **Given** a coordinate readout row that contains a value and a copy button, **When** the user taps the copy button, **Then** the copy action runs and the row itself is not scrolled or otherwise re-targeted.
3. **Given** two interactive controls are positioned next to each other, **When** the user taps in the visual area of one of them, **Then** the neighbouring control never activates by mistake.

---

### User Story 2 - Notifications never block interactive UI (Priority: P2)

When a transient banner appears (service-worker update available, install banner, copy-success, layer-load failure, offline-ready, zone hint), the user can still see and operate every map control, toolbar item, and coordinate readout value that was on screen before — and if two banners want to appear at once, neither obscures the other or any control.

**Why this priority**: Notifications that cover controls force the user to wait or dismiss before doing anything, breaking the flow of looking up coordinates. This addresses the user's third complaint ("通知訊息與其他元件擋住問題"). Ranked below P1 because the impact is transient (banners dismiss themselves), but it actively interferes with task completion while present.

**Independent Test**: Trigger each notification type on a phone viewport and confirm the toolbar, compass / zoom / settings controls, coordinate readout values, and any open dialog's primary action buttons remain fully visible and tappable while the notification is shown. Trigger two notifications at once and confirm they do not overlap each other.

**Acceptance Scenarios**:

1. **Given** the user is panning the map, **When** a transient banner (e.g. "offline ready") appears, **Then** every interactive control on screen — toolbar, compass, zoom, settings icon, coordinate copy buttons — remains visible and tappable.
2. **Given** the install banner is visible, **When** the service-worker update prompt also becomes visible, **Then** the two banners do not visually overlap each other and neither covers toolbar buttons or the coordinate readout.
3. **Given** a notification is visible, **When** the user taps a screen area that is *not* under the notification, **Then** the underlying control receives the tap exactly as if the notification were absent.
4. **Given** a dialog (Go To, Settings) is open, **When** any notification appears, **Then** the dialog's primary action buttons and close affordance remain visible and tappable.

---

### User Story 3 - Coordinate readout uses the same segmented layout as Go To (Priority: P3)

The on-screen coordinate readout shows the current map-centre / cursor coordinates broken into the same labelled fields that the Go To dialog uses for the same coordinate format. For example, a WGS84 DMS readout shows separate labelled values for latitude degrees / minutes / seconds / hemisphere, plus the same for longitude; an MGRS readout shows separate fields for grid-zone designator, 100 km square, easting, and northing — mirroring how Go To presents those parts as inputs.

**Why this priority**: This is a readability and consistency improvement. The existing readout already shows correct values; the change is a visual reformat. Lowest priority because the data is already accessible today, but it directly addresses the user's second complaint ("座標的顯示方式(分割顯示) 要與 Go To 一樣") and reduces the cognitive cost of mapping a readout value to a Go To input.

**Independent Test**: Switch the readout through each supported coordinate format and verify each format renders the same labelled-field structure that the corresponding Go To layout uses (field count, labels, order, hemisphere indicators).

**Acceptance Scenarios**:

1. **Given** the readout is set to WGS84 DMS, **When** the user views the readout, **Then** it shows separately labelled values for latitude degrees, minutes, seconds, hemisphere, and the same for longitude — matching the Go To DMS layout's structure.
2. **Given** the readout is set to TM2 (Taiwan), **When** the user views the readout, **Then** it shows separately labelled values for easting, northing, and zone, matching the Go To TM2 layout.
3. **Given** the readout is set to MGRS, **When** the user views the readout, **Then** it shows separately labelled values for the grid-zone designator / band, square, easting, and northing, matching the Go To MGRS layout.
4. **Given** any segmented readout row is visible, **When** the user taps the format's copy button, **Then** the copied text is the canonical single-string representation of that format, so existing share / paste workflows continue to work unchanged.

---

### Edge Cases

- A notification appears while a dialog (Go To, Settings) is open: the notification must not block the dialog's primary action or close affordance.
- The coordinate readout is set to a format the user just switched to: the segmented layout updates without leaving an empty or stale field visible for more than a transient frame.
- Two adjacent buttons sit at the minimum touch size: tap targets must remain non-overlapping and visibly distinct.
- Very long values (e.g. high-precision easting / northing) inside a segmented readout field must not push toolbar buttons off screen or trigger horizontal scroll on phone widths down to 320 CSS pixels.
- Landscape phone orientation (e.g. 640×360) keeps every button at the touch-target minimum and keeps notifications clear of the toolbar.
- A user with system text scaling at 200% still sees buttons that meet the touch-target minimum and notifications that do not overlap controls.
- A new notification class added in the future inherits the same non-overlap zone, without per-class CSS overrides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every interactive control reachable on a phone-class viewport (compass toggle, zoom in / out, settings icon, toolbar buttons, install banner actions, update prompt actions, coordinate copy buttons, and dialog confirm / dismiss buttons) MUST present a tap target of at least 44×44 CSS pixels.
- **FR-002**: Adjacent interactive controls MUST keep their tap targets non-overlapping at the 44×44 minimum so that each control has an unambiguous tap area.
- **FR-003**: Enlarging tap targets MUST NOT cause horizontal scrolling on phone viewports down to 320 CSS pixels in either portrait or landscape.
- **FR-004**: The on-screen coordinate readout MUST display each shown coordinate format as a row of separately labelled fields whose count, labels, order, and hemisphere indicators match the Go To dialog's layout for the same format.
- **FR-005**: The coordinate readout MUST keep its existing per-format copy affordance, and the copied text MUST be the canonical single-string representation of that format (unchanged by this feature).
- **FR-006**: Switching the active coordinate format in the readout MUST update the segmented layout without leaving stale or empty fields visible after the switch settles.
- **FR-007**: Transient notifications (service-worker update prompt, install banner, copy-success, layer-load failure, offline-ready, zone hint, and any future banner of the same class) MUST be positioned so that, on a phone-class viewport, they do not visually overlap the toolbar, the compass / zoom / settings controls, the coordinate readout, or any open dialog's primary action buttons.
- **FR-008**: When two or more notifications would be visible at the same time, the system MUST present them so they do not overlap each other — either by stacking with explicit spacing or by queuing additional notifications behind the active one.
- **FR-009**: Tapping in a region that is *not* visually covered by an active notification MUST deliver the tap to the underlying control exactly as if the notification were absent.
- **FR-010**: All adjustments above MUST preserve existing keyboard operability and visible focus indicators on non-touch viewports.
- **FR-011**: All adjustments MUST preserve current localised strings and the existing reading direction for both readout labels and notification messages.

### Key Entities

- **Tap target**: An interactive control rendered to the user with a minimum hit-area size and a non-overlapping zone with respect to its neighbours.
- **Coordinate readout row**: A read-only display of one coordinate format, composed of (a) a format label, (b) one or more labelled value fields whose structure mirrors the Go To layout for the same format, and (c) a copy affordance that yields the canonical single-string representation.
- **Transient notification**: A short-lived overlay message shown above the map; defined by its trigger, its dismissal behaviour, and a position zone that excludes interactive map controls and any open dialog's action buttons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360×640 phone viewport, a user can hit every primary on-screen control on the first tap in at least 95% of attempts during a 10-control walkthrough, with no double-tap zoom triggered.
- **SC-002**: On the same viewport, none of the listed transient notifications visually overlaps the toolbar, the compass / zoom / settings controls, or the coordinate readout in 100% of test triggers across portrait and landscape.
- **SC-003**: Two notifications shown simultaneously never visually overlap each other in 100% of test triggers.
- **SC-004**: For each supported coordinate format, the readout's number of visible labelled fields matches the corresponding Go To layout's number of input fields exactly, with matching labels and ordering, in 100% of formats checked.
- **SC-005**: Switching coordinate formats in the readout completes its visual transition in under 200 ms with no empty or stale field visible after the transition.
- **SC-006**: On phone widths down to 320 CSS pixels, the page does not require horizontal scrolling to reach any on-screen control after the changes.
- **SC-007**: In a follow-up qualitative check, at least 80% of mobile users report "easy to tap" buttons (vs the prior baseline of "sometimes hard").

## Assumptions

- The minimum touch-target size of 44×44 CSS pixels is taken from widely accepted mobile guidelines (WCAG 2.5.5 Level AAA, iOS HIG, Material guidelines) and is the right default unless the user signals otherwise.
- "手機端" covers both portrait and landscape phone orientations and the small phablets in between; tablet-specific tuning is out of scope for this feature.
- The set of coordinate formats whose layout the readout must mirror is the set already supported by the readout today (DD, DMS, TM2, TWD67-TM2, MGRS, Taipower); no new formats are introduced by this feature.
- The single-string output produced by today's coordinate-format helpers remains the canonical text used for copy / share; the segmented layout is purely a display-time reformat.
- "Notifications" here means the existing transient-banner classes (service-worker update prompt, install banner, copy-success, layer-load failure, offline-ready, zone hint); persistent in-dialog status text is out of scope.
- The fix must work without changing currently localised strings and without introducing new permissions, network calls, or persistent storage.
- Visual changes still satisfy the constitution's accessibility expectations, and the existing `docs/ui/` documentation will be updated alongside the implementation per Principle III.
