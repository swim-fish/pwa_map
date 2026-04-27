# Feature Specification: Tile Cache Settings

**Feature Branch**: `007-tile-cache-settings`
**Created**: 2026-04-27
**Status**: Draft
**Input**: User description: "新增設定頁面頁: 顯示 tiles cache TTL (天), max cache 數量， 以其清除 cache 按鈕 (cache 僅供加速讀取). 依照地圖圖磚條款不可以讓使用者下載地圖，cache 僅作為短暫離線的備援機制. (1) 可調 TTL 最大 90 天 (2) 粗略估計 (3) 可以全部清除與分開清除. 追加 (4) MaxEntries 需要可以調整。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect tile cache footprint and clear it (Priority: P1)

A returning user notices the app feels heavy on their device. They open the
toolbar and tap a new gear icon, opening a "Settings" sheet that lists each
tile cache (OpenStreetMap, NLSC, Google) with its current entry count, the
currently-selected per-cache entry limit, the time-to-live (TTL) in days,
and a rough estimate of the browser storage quota the application is using
overall. They read a clearly-shown notice that this cache exists solely as
a short-term offline fallback and that bulk map downloading is forbidden by
tile-source licences. They tap "Clear all map tile cache", confirm in a
dialog, and the sheet redraws with all three caches at zero entries and a
success message.

**Why this priority**: This is the core observable value of the feature.
Without it, the user has no way to see or release tile-cache space on their
device. Every other capability (per-cache clear, TTL adjustment) is an
enhancement on top of this.

**Independent Test**: With three populated tile caches, opening Settings
shows three non-zero entry counts and the quota estimate; tapping
"Clear all", confirming, and reopening Settings shows zero entries for all
three caches and the quota estimate decreased. Fully testable end-to-end
without TTL editing or per-cache clearing in place.

**Acceptance Scenarios**:

1. **Given** the user has previously panned the map across two layers
   producing entries in two of the three tile caches, **When** they open
   the Settings sheet, **Then** they see exactly three rows (OSM / NLSC /
   Google), the two visited caches show non-zero entry counts, the third
   shows 0, the per-cache entry limit and current TTL are displayed,
   and the licence notice is visible above or alongside the cache list.
2. **Given** the Settings sheet is open with non-zero caches, **When** the
   user taps "Clear all map tile cache" and confirms in the dialog, **Then**
   all three tile caches show 0 entries on next render, an inline
   confirmation message is shown, and the storage quota estimate decreases.
3. **Given** the user opens the confirmation dialog, **When** they cancel,
   **Then** the cache contents are unchanged and the dialog dismisses.

---

### User Story 2 - Clear a single tile source independently (Priority: P2)

A user only uses Google tiles in practice and wants to free that space
without losing OSM/NLSC tiles they cached during a recent trip. From the
Settings sheet, each cache row offers a "Clear" affordance that, after
confirmation, empties only that source.

**Why this priority**: This is a useful-but-narrower workflow on top of P1.
Some users will never need it; the "Clear all" path covers the most common
intent. Independent of P1: with neither "clear all" nor TTL controls
present, per-row clears still deliver value.

**Independent Test**: Populate all three caches; from Settings, clear only
the Google row; confirm OSM and NLSC counts are unchanged while Google is 0.

**Acceptance Scenarios**:

1. **Given** all three caches have entries, **When** the user taps the
   per-row clear control on the Google row and confirms, **Then** only the
   Google row drops to 0; OSM and NLSC counts are unchanged; the inline
   message names the source that was cleared.
2. **Given** a per-row clear has just succeeded, **When** the user taps the
   per-row clear on the same row a second time, **Then** the action is
   either disabled (because the row is already empty) or completes
   instantly with no error.

---

### User Story 3 - Adjust how long cached tiles are retained (Priority: P3)

A privacy-conscious user wants the app to forget cached tiles sooner than
the default. From Settings they pick a shorter TTL (1 day) from a list of
preset choices. The app immediately purges any cache entries older than the
new TTL, persists the choice across app launches, and uses it for future
purges.

**Why this priority**: Improves user control and privacy posture but is
secondary to the "see and clear" core. Independent of P1/P2: even without
clear buttons, TTL editing alone delivers the value of "tiles I haven't
revisited expire sooner".

**Independent Test**: Pre-seed a cache with both fresh and 30-day-old
entries (via test fixture); change TTL from 7 to 1 day; without tapping
clear, the on-disk count of that cache drops to only the fresh subset on
next render of the Settings sheet.

**Acceptance Scenarios**:

1. **Given** the TTL is at the default (7 days) and a cache contains both
   recent and 14-day-old entries, **When** the user changes the TTL to 1
   day, **Then** entries older than 1 day are removed and the cache entry
   count visibly decreases without the user pressing a clear button.
2. **Given** the user has selected a TTL of 30 days, **When** they fully
   close and reopen the app, **Then** the TTL is still 30 days in the
   Settings sheet on the next visit.
3. **Given** the user attempts to set a TTL outside the allowed range,
   **Then** only the seven preset values (1, 3, 7, 14, 30, 60, 90) are
   selectable; no free-form input accepts an out-of-range number.

---

### User Story 4 - Cap how many tiles each cache may hold (Priority: P3)

A user with a small-storage device wants to cap each tile cache to a
much lower entry count than the default. From Settings they pick a
smaller per-cache entry limit (e.g., 1024) from a list of preset
choices. The app immediately trims each cache so it holds at most the
new limit, removing oldest-first, persists the choice across app
launches, and uses it as the new ceiling for future cache writes.

**Why this priority**: Same priority tier as TTL — improves user
control over device storage but is secondary to the "see and clear"
core. Independent of the other stories: even without TTL editing or
clear buttons, this control alone delivers the value of "this app
will not silently grow past N tiles per source on my device".

**Independent Test**: Pre-seed a cache with 5000 entries (via test
fixture); change the per-cache entry limit from 4096 to 1024; without
tapping clear, the on-disk count of that cache drops to exactly 1024
on next render of the Settings sheet, with the most recently inserted
entries retained.

**Acceptance Scenarios**:

1. **Given** a cache contains more entries than the new limit, **When**
   the user changes the per-cache entry limit to a smaller value,
   **Then** the cache is trimmed down to exactly that limit (oldest-
   first removed), the entry count visibly decreases without the user
   pressing a clear button, and the new limit is shown next to each
   cache row.
2. **Given** the user has selected a per-cache entry limit, **When**
   they fully close and reopen the app, **Then** the limit is still
   persisted and applied to subsequent cache writes.
3. **Given** the user attempts to set a per-cache entry limit outside
   the allowed range, **Then** only the six preset values
   (256, 512, 1024, 2048, 4096, 8192) are selectable; no free-form
   input accepts an out-of-range number.

### Edge Cases

- **No tile caches yet** (first launch, never panned): Settings sheet
  still opens, shows three rows with 0 entries, displays "—" or 0 MB for
  quota estimate, and clear buttons are visible but no-ops.
- **Browser cannot report a storage estimate**: the quota display shows a
  "not available" placeholder rather than an error.
- **Browser does not expose cache inspection** (e.g., private browsing
  modes, very old browsers): the Settings sheet still renders, shows a
  non-blocking notice that cache inspection is unavailable in this
  context, and disables the clear buttons; the TTL preference still
  saves.
- **Quota near full / clear fails partway**: a per-cache failure surfaces
  an inline error naming which cache failed; succeeded caches still report
  0; the user can retry.
- **TTL change while a clear is in progress**: TTL change is queued until
  the clear completes; the UI does not allow two destructive actions
  concurrently.
- **App is offline**: Settings sheet still works (no network reads); clear
  and TTL changes are local; no message implies the user is in a
  "downloaded map" mode.
- **Very first visit, before any offline-fallback layer has been
  prepared**: Settings sheet shows zero entries and a benign "no cached
  tiles yet" hint; TTL is still editable and persisted.
- **Locale switching while sheet is open**: all sheet labels re-render in
  the new locale without requiring sheet re-open.

## Requirements *(mandatory)*

### Functional Requirements

#### Visibility & disclosure

- **FR-001**: Toolbar MUST expose a Settings entry point that is visually
  consistent with the existing layer and locale entry points and is
  reachable by both pointer and keyboard.
- **FR-002**: The Settings sheet MUST display a permanent notice stating
  that the tile cache exists solely as a short-term offline fallback and
  that bulk downloading or redistribution of map tiles is prohibited by
  the upstream tile-source licences. The notice MUST be visible without
  scrolling on a typical mobile viewport.
- **FR-003**: The Settings sheet MUST list one row per supported tile
  cache source (OpenStreetMap, NLSC, Google), each row showing: source
  label, current entry count, the shared current per-cache entry limit,
  and the shared current TTL value.
- **FR-004**: The Settings sheet MUST display a single rough estimate of
  total browser-storage usage attributable to the application (in
  megabytes), labelled clearly as an estimate, not a precise figure.
- **FR-005**: The Settings sheet MUST display the current TTL value in
  days and the current per-cache entry limit alongside their editing
  controls.

#### Editing & destructive actions

- **FR-006**: Users MUST be able to choose the tile-cache TTL from a
  fixed list of preset day values: 1, 3, 7, 14, 30, 60, 90. No other
  values are accepted. The default for new installs is 7 days.
- **FR-007**: Changes to TTL or per-cache entry limit MUST persist
  across app restarts and device reboots.
- **FR-008**: When the TTL is changed, the system MUST remove any cached
  tile entries whose age exceeds the new TTL, and the on-screen entry
  counts MUST reflect the post-purge state.
- **FR-009**: Users MUST be able to clear all three tile caches together
  via a single "Clear all" action.
- **FR-010**: Users MUST be able to clear each tile cache (OSM / NLSC /
  Google) independently via per-row clear actions.
- **FR-011**: Every destructive action (Clear all, per-row clear) MUST
  require explicit confirmation in a dialog before any data is removed,
  and the dialog MUST name what is about to be cleared.
- **FR-012**: After a clear or purge succeeds, the system MUST display a
  brief inline confirmation that names what was cleared, and the entry
  counts and quota estimate on screen MUST refresh to the post-action
  state.
- **FR-019**: Users MUST be able to choose the per-cache entry limit
  from a fixed list of preset values: 256, 512, 1024, 2048, 4096, 8192.
  No other values are accepted. The default for new installs is 4096.
  The chosen value applies independently to each of the three tile
  caches (i.e., it is a per-cache cap, not a sum across caches).
- **FR-020**: When the per-cache entry limit is reduced below a
  cache's current entry count, the system MUST trim that cache to the
  new limit, removing oldest entries first, without the user needing
  to press a clear button. The on-screen entry counts MUST reflect
  the post-trim state.
- **FR-021**: When the per-cache entry limit is increased, the system
  MUST NOT pre-fetch tiles to fill the additional headroom. Caches
  fill only via the user's natural map browsing.

#### Constraints / what the system must NOT do

- **FR-013**: The system MUST NOT offer any feature that lets users
  pre-download, batch-download, schedule prefetching of, or export tiles
  outside the natural pan/zoom interaction. The Settings sheet must be
  read+release only.
- **FR-014**: Clearing actions MUST NOT remove the cached application
  shell (the assets needed to launch the app offline). Only the
  user-accumulated tile caches are affected.
- **FR-015**: The system MUST NOT display the cached map data as a
  user-owned "downloaded map" or comparable framing in any UI text or
  iconography. Wording must consistently treat the cache as a transient
  performance aid.

#### Resilience & accessibility

- **FR-016**: When the underlying browser storage APIs are unavailable
  (e.g., private mode, very old browser), the Settings sheet MUST still
  render with a benign explanatory message; the TTL preference must still
  be editable and persisted if user-storage is available; clear buttons
  MUST be disabled with a visible reason.
- **FR-017**: All Settings-sheet text MUST be available in the
  application's three supported locales (Taiwan Traditional Chinese
  `zh`, English, Japanese), and locale switches MUST take effect inside
  the sheet without re-open.
- **FR-018**: All Settings-sheet controls MUST be operable by keyboard
  (Tab to move, Enter/Space to activate, Escape to dismiss the sheet and
  any open confirmation), expose accessible labels, and meet the
  application's existing colour-contrast and tap-target standards.

### Key Entities *(include if feature involves data)*

- **Tile cache record (one per source)**: A logical grouping representing
  one upstream tile source's locally retained entries. Attributes
  surfaced to the user: source label, current entry count, current
  per-cache entry limit. Lifecycle: populated by normal map browsing;
  aged out by TTL policy; trimmed by per-cache entry limit; emptied by
  user clear actions. Not user-editable except via clear/TTL/limit.
- **Tile-cache TTL preference**: A single user-level setting (in days)
  that determines how long tile entries are retained before purging.
  Attributes: integer day value drawn from the fixed preset set.
  Lifecycle: persisted with other user preferences; enforced at app start
  and whenever the user changes its value.
- **Tile-cache per-cache entry-limit preference**: A single user-level
  setting (count of entries) that caps how many entries each tile cache
  may hold. Attributes: integer drawn from the fixed preset set;
  applies independently to each of the three tile caches. Lifecycle:
  persisted with other user preferences; enforced at app start and
  whenever the user changes its value (oldest entries removed first
  when the limit is lowered).
- **Storage quota estimate**: A read-only, browser-provided rough figure
  representing the total origin storage in use. Attributes: usage in
  bytes (formatted MB), explicitly framed as an estimate. Lifecycle:
  refreshed each time the Settings sheet opens and after each clear.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with three populated tile caches can locate the
  Settings entry point, open the Settings sheet, and confirm a
  "Clear all" action reducing all three caches to zero in under 30
  seconds on first attempt, without external instructions.
- **SC-002**: 100% of destructive actions (Clear all, per-row clear,
  TTL change that triggers purge, per-cache entry-limit reduction that
  triggers trim) emit a confirmation step before any data is removed.
- **SC-003**: 100% of UI strings introduced by the Settings sheet have
  parity across the three supported locales (`zh`, English, Japanese);
  no English fallbacks visible in the non-English locales.
- **SC-004**: Opening the Settings sheet completes (entry counts and
  quota estimate visible) in under 150 ms at the 95th percentile on a
  representative mid-range mobile device.
- **SC-005**: A "Clear all" action on three caches each holding the
  per-cache ceiling completes in under 1.5 seconds at the 95th
  percentile, and the UI remains responsive (scroll, dismiss) during
  the operation.
- **SC-006**: Zero user-visible affordances exist anywhere in the
  application that initiate bulk pre-download, area download,
  scheduled prefetch, or export of map tiles. (Verifiable by full-text
  search of the production UI strings and by a UI walkthrough audit.)
- **SC-007**: A TTL change AND a per-cache entry-limit change each
  persist across at least one full cold restart of the application in
  100% of test runs.
- **SC-008**: After clearing a cache, the next render of the Settings
  sheet shows that cache at 0 entries and the storage estimate is no
  greater than its pre-clear value, in 100% of test runs.
- **SC-009**: After lowering the per-cache entry limit while a cache
  holds more entries than the new limit, the next render of the
  Settings sheet shows that cache at exactly the new-limit count, in
  100% of test runs. The trimmed-away entries are oldest-first, so
  the most recently visited tiles remain.

## Assumptions

- The application's existing toolbar is the natural home for the
  Settings entry point; users discover settings via the toolbar in the
  same way they discover the layer and locale pickers today.
- The fixed TTL preset list (1, 3, 7, 14, 30, 60, 90 days) is sufficient
  granularity for end-user control; free-form input is intentionally not
  supported to keep the choice space small and to make the feature
  trivially testable. The 90-day ceiling matches the upper bound the
  user explicitly requested.
- The fixed per-cache entry-limit preset list
  (256, 512, 1024, 2048, 4096, 8192) is sufficient granularity for
  end-user control. The 8192 ceiling acts as the hard upper bound that
  the underlying browser-storage layer also enforces; the 4096 default
  matches the value the application historically shipped with.
- The "oldest-first" trimming order is approximated by the order in
  which tiles were originally written into the cache (which the
  underlying browser-storage layer preserves for the iteration order
  of cache keys); minor inversions caused by per-entry deletes are
  tolerated as immaterial to the user's intent of "keep me near the
  limit".
- A single, origin-wide rough storage estimate (rather than per-cache
  byte sizes) is acceptable; per-cache bytes would be an order of
  magnitude more expensive to compute on demand and offer little extra
  user value.
- The application has no remote sync of preferences; the TTL and any
  cleared-state are local to the device.
- The cache-clearing capability acts on the same set of tile caches the
  application populates today (OSM / NLSC / Google groups). When a new
  tile source is added in a future feature, that future feature is
  responsible for adding its source to this Settings sheet.
- The licence/disclosure copy will be authored in coordination with the
  three upstream tile sources' attribution requirements already used in
  the application.

## Out of Scope

- Any "download an area for offline use", "save this region", "schedule
  prefetch", or "export map" capability.
- Per-tile inspection (browsing or deleting individual cache entries).
- Free-form numeric input for either TTL or per-cache entry limit
  (the preset lists are exhaustive).
- Cache hit-rate, throughput, or other performance telemetry surfaces.
- Cross-device sync of the TTL or per-cache entry-limit preference.
- Automatic background purging on a timer independent of user action and
  app launch (a future feature can revisit this).
- Migrating or deleting the cached application shell (precache).
