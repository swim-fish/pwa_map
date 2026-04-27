# Feature Specification: Mobile Collapsed Coordinate Readout, Drag-to-Reorder Priority, Taipower Auto-Precision, and TWD Zone Geographic Hints

**Feature Branch**: `010-mobile-collapsed-readout`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description (combined):

1. "較窄的畫面會因為座標顯示與地圖控制(+/-) 互相重疊；在手機頁面 座標顯示可以考慮收摺起來只顯示一個(在設定顯示格式 可以拖移顯示順序決定優先度，最上面最優先)"
2. "台電座標調整 顯示精度預設 11，精度判斷透過輸入資料判別"
3. "TWD 分帶選項加上本島的提示（zone121 是本島，zone119 是澎湖）"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phone-class readout no longer overlaps the zoom controls (Priority: P1)

A user holding a phone with one thumb wants to read the live coordinate
readout AND tap the `+` / `−` zoom buttons without either obscuring
the other. On viewports narrower than a phablet (under 600 CSS pixels)
the readout currently spans most of the lower edge and overlaps the
right-edge zoom controls; the user has to scroll, rotate, or
fight thumb-targeting to reach a button. After this change, when the
viewport is narrow AND two or more coordinate formats are enabled, the
readout collapses to a single-row form that shows only the
highest-priority format, freeing the area beside the zoom controls.

**Why this priority**: This is the user's primary complaint — controls
that overlap make the app effectively unusable one-handed on a phone.
Every later improvement assumes the readout and the zoom controls
co-exist without contention.

**Independent Test**: Open the PWA on a 360 × 640 viewport with three
or more formats enabled in Settings; the readout shows exactly one
labelled coordinate row. The bounding rectangle of that row does not
intersect the bounding rectangle of the zoom controls. Disable formats
until only one is enabled; the readout still shows that one format
without collapse styling. Resize to ≥ 600 CSS pixels wide; the readout
expands back to all enabled formats.

**Acceptance Scenarios**:

1. **Given** the app is open on a viewport narrower than 600 CSS pixels and at least two coordinate formats are enabled, **When** the user views the readout, **Then** only one labelled row is visible (the highest-priority enabled format) and that row's bounding rectangle does not intersect the zoom-controls' bounding rectangle.
2. **Given** the same narrow viewport, **When** only one coordinate format is enabled, **Then** the readout shows that single row in its normal (uncollapsed) appearance.
3. **Given** the app is open on a viewport ≥ 600 CSS pixels wide, **When** any number of formats are enabled, **Then** the readout shows every enabled format in priority order (no collapse).
4. **Given** a narrow viewport with the readout collapsed, **When** the user rotates the device or resizes to a wider viewport, **Then** the readout expands to show every enabled format without losing position lock.

---

### User Story 2 - Set the priority order of coordinate formats by drag-and-drop in Settings (Priority: P2)

A user wants to decide which coordinate format appears first — both as
the single visible row when the readout is collapsed on a phone, and
as the topmost row when the readout is expanded on any viewport. In
the Settings sheet's display-format section, every supported format is
listed in a draggable list. Dragging a row up or down changes its
priority; the topmost row is the highest priority. The new order
applies immediately to the readout (collapsed or expanded) and persists
across reloads.

**Why this priority**: Different users care about different formats —
a Taiwan-domestic surveyor reads TM2 first; a tourist reads DMS; an
MGRS-trained ranger reads MGRS. A fixed default order forces every
non-default user to either disable formats they want available or
accept the wrong one as the collapsed-mode display. Drag-to-reorder is
the simplest mechanism that lets the user own this choice without
adding a per-context preferences screen.

**Independent Test**: Open Settings; verify every supported coordinate
format appears as a draggable row in the display-format section. Drag
any row to a new position; verify the readout (on the same viewport,
without reloading) immediately reflects the new order. Reload the
page; the new order persists.

**Acceptance Scenarios**:

1. **Given** the Settings sheet is open and the display-format section is visible, **When** the user views the section, **Then** every supported format is listed as a row with an obvious drag affordance, ordered by current priority (highest at the top).
2. **Given** the user drags a format from position 3 to position 1, **When** the drag is released, **Then** the dragged format is at the top of the list, the formats it passed shift down by one, and the on-screen readout (in any view mode) updates its row order to match.
3. **Given** a phone-class viewport with the readout collapsed and three formats enabled, **When** the user drags the format currently shown in the collapsed readout from priority 1 to priority 3, **Then** the collapsed readout immediately switches to display the format that is now at priority 1.
4. **Given** the user reorders formats and closes the Settings sheet, **When** the user reloads the page, **Then** the new order is restored exactly.
5. **Given** a user upgrading from a prior version of the app whose stored preferences contain no priority order, **When** the user opens Settings or views the readout for the first time, **Then** the formats appear in the project's documented default priority order.

---

### User Story 3 - Tap the collapsed readout to temporarily see all enabled formats (Priority: P3)

When the readout is collapsed on a phone, the user occasionally wants
to glance at the other enabled formats — for example, to read out an
MGRS to a partner while the priority-one format is DMS. Tapping the
collapsed readout area expands it in place to show every enabled
format in priority order; tapping again (or tapping anywhere outside
the readout) collapses it back to the priority-one row. The expanded
state is transient — it is not persisted across reloads, and it
auto-collapses on viewport resize / rotation that would normally
trigger collapsed mode.

**Why this priority**: A "collapse only" design without an expand
affordance throws away information density that every other viewport
preserves. This story restores parity at almost zero design cost — one
tap target on the existing readout — and is therefore P3 rather than
omitted.

**Independent Test**: On a 360 × 640 viewport with three or more
formats enabled, the collapsed readout is visible. Tap the readout
once; all enabled formats are visible in priority order. Tap the
readout again; it collapses back to one row. Reload the page; the
readout is back in collapsed state (the tap-expanded state was
transient).

**Acceptance Scenarios**:

1. **Given** the readout is collapsed and at least two formats are enabled, **When** the user taps anywhere on the readout body (other than the copy button), **Then** the readout expands to show every enabled format in priority order without changing the user's map position.
2. **Given** the readout is in the tap-expanded state, **When** the user taps the readout body again, **Then** the readout returns to the single-row collapsed view.
3. **Given** the readout is in the tap-expanded state, **When** the user resizes the viewport to ≥ 600 CSS pixels wide, **Then** the readout adopts the wide-viewport expanded layout (without an extra interaction step) and the tap-expanded sentinel state is cleared.
4. **Given** the readout is in the tap-expanded state, **When** the user reloads the page, **Then** the readout starts in collapsed state on a narrow viewport (the tap-expanded state is not persisted).
5. **Given** the readout is collapsed, **When** the user taps the copy button on the visible row, **Then** the tap-to-expand action does NOT trigger and only the copy action runs (so copy remains a one-tap operation).

---

### User Story 4 - Taipower coordinate uses auto-precision (Priority: P2)

The Taipower (台電) coordinate format ships in two precisions —
9-character (region + sub-region + 4-digit grid) and 11-character
(region + sub-region + 6-digit higher-resolution grid). Today the
user must explicitly choose one in Settings; on input (Go To dialog)
they must also pre-select the precision before pasting / typing,
which is friction that the input string itself can resolve. After
this change, (a) a fresh installation defaults to **11-character**
display precision (the higher-detail one), and (b) the Go To
Taipower input parses the precision automatically from the input's
length — a 9-character input is parsed as 9-precision, an
11-character input is parsed as 11-precision, with no precision
selector required on the input side.

**Why this priority**: The two precisions are not user-meaningful
*choices* — they are simply two different resolutions of the same
format. Forcing the user to pre-pick one breaks the principle that
"if I pasted a string, the app should understand it". Default 11
gives newcomers the more accurate format without changing existing
users' chosen precision (preserved during upgrade). P2 because the
existing precision selector still works for users who set it
manually; this story removes friction rather than gating any
fundamental capability.

**Independent Test**: On a fresh install (no prior `prefs`), open
the readout and inspect the Taipower row — it shows an 11-character
code. Open Go To, paste a 9-character Taipower code; it parses and
pans the map without any precision dialog. Paste an 11-character
code; same. Set Settings' Taipower precision to 9, paste an
11-character code; the Go To input still parses (auto-detected),
and the readout still shows 9 (preference unchanged).

**Acceptance Scenarios**:

1. **Given** a fresh installation with no prior preferences, **When** the user views the readout's Taipower row, **Then** it displays an 11-character code.
2. **Given** the Go To dialog open and the Taipower input visible, **When** the user enters a 9-character Taipower code, **Then** the system parses it as a 9-precision Taipower coordinate and pans the map without prompting the user for a precision.
3. **Given** the same dialog, **When** the user enters an 11-character Taipower code, **Then** the system parses it as 11-precision and pans the map without prompting.
4. **Given** an existing user whose stored preferences set `taipowerPrecision = 9`, **When** that user upgrades to this version, **Then** the readout's Taipower row continues to display a 9-character code (the explicit preference is preserved); the user can change it in Settings if they want 11.
5. **Given** the Go To Taipower input, **When** the user enters a length that is neither 9 nor 11, **Then** the system rejects the input with the existing localised "unsupported precision" message — no silent truncation, no padding.

---

### User Story 5 - TWD zone selector shows geographic context (Priority: P3)

The TWD97 / TWD67 TM2 coordinate systems use one of two central
meridians — 121°E (covering Taiwan main island) or 119°E (covering
the Penghu archipelago). When the user opens the Go To dialog and
chooses TWD97 or TWD67, the zone selector lists "121" and "119" as
options but offers no hint about which physical region each
corresponds to. Locals know the convention; first-time users do
not. After this change, the visible label of each zone option
includes a short geographic tag — `121 (本島)` for main island, `119 (澎湖)` for Penghu — in every supported locale.

**Why this priority**: The map already has sensible defaults
(`auto` zone resolution from feature 002), so users rarely need to
flip this selector by hand; this is a clarity polish for the small
fraction of cases where they do. P3 because it neither blocks
input nor changes any computed result — only the displayed label.

**Independent Test**: Open Go To; switch to TWD97-TM2; verify the
zone selector's options read "121 (本島)" / "119 (澎湖)" (and the
"auto" option keeps its existing label). Switch to TWD67-TM2;
verify the same labels. Switch the locale to `en` and `ja`; verify
the geographic tags translate (e.g. "121 (Main Island)" /
"119 (Penghu)" in `en`).

**Acceptance Scenarios**:

1. **Given** the Go To dialog is open and the user switches the active format to TWD97-TM2, **When** the zone selector is visible, **Then** the option representing zone 121 displays a label that combines the numeric zone with a geographic tag for "main island", and the option representing zone 119 displays a label that combines the numeric zone with a geographic tag for "Penghu".
2. **Given** the same dialog, **When** the user switches to TWD67-TM2, **Then** the zone selector's labels follow the same pattern as in scenario 1.
3. **Given** any TWD-using layout, **When** the user switches the app locale through `zh`, `en`, `ja`, **Then** the geographic tag part of the zone label translates appropriately for each locale (using existing locale catalogues — no untranslated string is shown).
4. **Given** the zone selector, **When** the user picks `auto`, **Then** the existing auto-resolution behaviour from feature 002 is unchanged — only the manual options' labels are affected by this story.

---

### Edge Cases

- The user enables only one format on a narrow viewport: the readout shows that one row in its normal (non-collapsed) appearance and the tap-to-expand affordance is absent — there is nothing to expand.
- The user enables zero formats: the readout area is hidden entirely; collapsed mode and the drag list are still independently meaningful (settings still lists every supported format with a drag affordance).
- The user drags a format that is currently disabled: reordering still applies — the disabled format does not appear in the readout but its priority is recorded so that re-enabling it later restores the chosen position.
- A user rotates the device from portrait to landscape so that the viewport crosses the 600 CSS-pixel boundary mid-interaction: the readout transitions between collapsed and expanded layouts smoothly without losing the user's current map view.
- A user with system text scaling at 200% on a narrow viewport: the collapsed single row still fits within the screen and does not overlap the zoom controls (text scale interacts with the available width budget).
- An expanded readout on a narrow viewport (tap-expanded) that grows to several formats long: the expanded readout must not push the zoom controls off-screen or trigger horizontal scroll; vertical clipping with internal scroll is acceptable, horizontal clipping is not.
- A user reorders formats while the Go To dialog or Settings confirm dialog is open: the readout (which sits behind the dialog) reflects the new order as soon as the dialog dismisses.
- A user pastes a Taipower code with extra leading / trailing whitespace: the parser MUST trim before measuring length so a 9-or-11-character code surrounded by whitespace is still auto-detected.
- A user pastes a Taipower code that contains hyphens or other separators: the parser MUST strip the project's documented separator set before measuring length (consistent with the existing parser behaviour).
- The locale catalogues for `zh`, `en`, `ja` differ in word order for the geographic tag (e.g. "本島" appears after the digits in `zh` but "Main Island" may sit after a space in `en`); the rendered label MUST follow the locale's natural order without hard-coding any one form in the component.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The coordinate readout MUST present a "collapsed" appearance — a single labelled row showing only the highest-priority enabled coordinate format — when both of the following hold: (a) the viewport is narrower than 600 CSS pixels and (b) two or more coordinate formats are enabled.
- **FR-002**: When the collapsed conditions in FR-001 do not hold, the readout MUST present an "expanded" appearance — every enabled coordinate format on its own labelled row, in priority order from top to bottom.
- **FR-003**: In the collapsed appearance, the readout's bounding rectangle MUST NOT visually overlap the rectangle of the zoom-in / zoom-out controls on viewports between 320 and 599 CSS pixels wide, in either portrait or landscape.
- **FR-004**: The Settings sheet's display-format section MUST list every coordinate format the project supports as a draggable row, ordered top-to-bottom by current priority (highest at the top), with an explicit visual drag affordance on each row.
- **FR-005**: Dragging a row to a new position MUST update the priority order immediately — the on-screen readout (collapsed or expanded) MUST reflect the new order without requiring the user to close the Settings sheet or reload.
- **FR-006**: The priority order MUST persist across page reloads using the project's existing preferences storage.
- **FR-007**: When the priority order is read for the first time on a system whose stored preferences predate this feature, the system MUST fall back to a documented default priority order — without prompting the user — and MUST persist that default the next time the order is changed.
- **FR-008**: When the readout is in the collapsed appearance and at least two formats are enabled, the user MUST be able to tap the readout body to enter a "tap-expanded" state in which every enabled format is visible in priority order; tapping the readout body again MUST return it to the single-row collapsed appearance.
- **FR-009**: The tap-expanded state MUST NOT persist across page reloads and MUST clear automatically when the viewport widens past 600 CSS pixels.
- **FR-010**: The copy button on the visible coordinate row MUST remain a one-tap operation — tapping it MUST NOT also toggle collapse / tap-expand.
- **FR-011**: Reordering a coordinate format that is currently *disabled* MUST still record the new priority position; re-enabling the format later MUST present it at its recorded priority position.
- **FR-012**: The drag interaction MUST be operable via touch input on phones and via pointer (mouse) input on desktop; keyboard reordering for accessibility MAY be addressed in a later feature but the visual order MUST remain readable when no drag is in progress.
- **FR-013**: All visible labels (format names, drag affordance announcements) MUST reuse existing localised strings from the project's locale catalogues (`zh`, `en`, `ja`); the feature MUST NOT introduce new locale keys for content that already has an established translation. Geographic tags for the TWD zone selector (FR-016 / FR-017) are an exception — they MAY introduce up to two new locale keys per language (one for "main island", one for "Penghu") if no equivalent existing key is available.
- **FR-014**: The default `taipowerPrecision` for newly-installed preferences MUST be 11 (the higher-resolution form). On upgrade from a prior version, the user's previously stored `taipowerPrecision` value MUST be preserved verbatim — the default change applies only to fresh installs.
- **FR-015**: The Go To Taipower input parser MUST automatically determine the input's precision from the trimmed, separator-stripped input length: a length-9 input MUST be parsed as 9-character precision, a length-11 input as 11-character precision. Any other length MUST be rejected with the existing localised "unsupported precision" rejection — no silent truncation, no silent padding, no precision selector required on the input side.
- **FR-016**: The Go To dialog's zone selector for TWD97-TM2 MUST display the numeric zone value combined with a localised geographic tag — the option representing zone 121 MUST identify it as "main island", and the option representing zone 119 MUST identify it as "Penghu". The exact display order (digits first vs tag first, separator character) MUST follow each locale's natural convention.
- **FR-017**: The same display rule (FR-016) MUST apply to the Go To dialog's zone selector for TWD67-TM2. The "auto" zone option's label is NOT affected by this rule and MUST keep its existing localised label.

### Key Entities

- **Coordinate format priority list**: An ordered list of every supported coordinate format. Order encodes priority (index 0 = highest). Each entry retains its enabled / disabled state independently of its position. The list is the single source of truth for both the collapsed-readout selection and the expanded-readout row order.
- **Readout view mode**: A derived value with three possible states — `collapsed` (narrow viewport + ≥ 2 enabled formats), `expanded` (wide viewport, or narrow viewport with ≤ 1 enabled format), `tap-expanded` (transient override of `collapsed` triggered by user tap; cleared on viewport widen or page reload).
- **Taipower input precision**: A derived value of either 9 or 11, computed at parse time from the trimmed, separator-stripped length of the user's Go To Taipower input. Distinct from the user's stored `taipowerPrecision` preference, which controls *display* precision in the readout.
- **TWD zone label**: A composite string formed at render time as `<numeric-zone> <geographic-tag>`, where the geographic tag is "main island" for zone 121 and "Penghu" for zone 119, both translated via the locale catalogue. Only applies to the manual options in the zone selector (the "auto" option is excluded).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On phone-class viewports between 320 and 599 CSS pixels wide with three or more formats enabled, the readout's bounding rectangle does not visually overlap the zoom-controls' bounding rectangle in 100% of test viewports (portrait + landscape).
- **SC-002**: A user reordering coordinate formats from the Settings sheet sees the on-screen readout reflect the new order within 200 ms of releasing the drag, in 100% of drag operations.
- **SC-003**: After reordering coordinate formats and reloading the page, the priority order is restored exactly (same format at every position) in 100% of cases.
- **SC-004**: On a phone-class viewport, the user can switch between the single-row collapsed view and a full-list tap-expanded view in ≤ 1 tap each direction, with the visual transition completing in under 200 ms.
- **SC-005**: Existing PWA installations that upgrade to this feature retain their previously selected enabled-formats set AND their previously stored `taipowerPrecision` value without data loss; users see the documented default priority order and a `taipowerPrecision` of 11 only on fresh installations.
- **SC-006**: In a follow-up qualitative check on phone-class viewports, at least 80% of mobile users report that the readout no longer "blocks" the zoom buttons (vs the prior baseline of "frequently blocks").
- **SC-007**: For 100% of valid Taipower inputs of length 9 or 11 (after trimming and stripping the documented separator set), the Go To dialog parses without prompting the user for precision and pans the map to the correct location.
- **SC-008**: For 100% of valid TWD97-TM2 / TWD67-TM2 zone selectors rendered (manual options 121 and 119), the displayed label includes a non-empty geographic tag in the active locale (`zh`, `en`, `ja`).

## Assumptions

- The 600 CSS-pixel collapse threshold is taken from the broader phone-vs-tablet break used elsewhere in modern responsive UI (Material's compact breakpoint, iOS HIG's compact width class) and is the right default for this project's single-page map UI; tablet-class layouts (≥ 600 CSS pixels) are treated as "expanded" without further sub-thresholds.
- "支援的座標格式" (the set of coordinate formats subject to priority ordering) is the same six formats already supported by the readout and Go To today (DD, DMS, TWD97-TM2, TWD67-TM2, MGRS, Taipower); no new formats are introduced by this feature.
- The display-format section of the Settings sheet already has rows per format (for the enabled / disabled toggle); this feature replaces the static row order with a draggable, priority-ordered list and lets the same row continue to host its enable / disable affordance.
- The project's existing preferences storage (a single localStorage key under the project's namespace) is the persistence mechanism for the priority order; this feature adds a new ordered-array field to that schema rather than introducing a separate storage key. Schema evolution follows the project's documented additive-evolution practice.
- The "default priority order" used as the upgrade fallback is the order the formats currently render in (DD, DMS, TWD97-TM2, TWD67-TM2, MGRS, Taipower); the implementation plan will codify this as a project constant.
- Drag input is offered as a single mechanism (no separate "move up / move down" buttons in the initial release); accessibility-driven keyboard reordering is acknowledged as a future enhancement and is not a blocker for this feature's release.
- The fix must work without introducing new permissions, network calls, or persistent storage beyond the existing preferences key, and without changing the canonical copy-string output for any format.
- The Taipower auto-precision rule (FR-015) is consistent with the project's existing parse-then-validate pattern in the Go To dialog (feature 002): the parser inspects the input itself rather than asking the user to pre-classify it.
- The default-precision change (FR-014) applies to the *unstored* default returned by `defaultPreferences()`. Users with existing preferences continue with their stored value; the validator does NOT silently mutate `taipowerPrecision: 9` to `11` on upgrade.
- The "main island" / "Penghu" tags are short geographic descriptors, not legal names. The locale catalogues for `zh`, `en`, `ja` may need at most two new keys per language (e.g. `goto.fields.zoneTagMainIsland`, `goto.fields.zoneTagPenghu`); this is an exception to FR-013 because no equivalent existing key carries the geographic semantic.
- The `auto` zone option's existing localised label (`goto.fields.zoneAuto` from feature 002) is unchanged by this feature.
