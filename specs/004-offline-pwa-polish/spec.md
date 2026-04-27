# Feature Specification: Offline-First PWA + Update Prompt + UI Polish

**Feature Branch**: `004-offline-pwa-polish`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "修正右下角地圖名稱背景顏色與文字太相近看不清楚 / PWA Web App 要可以離線（App 預設離線，當有新版本再提示使用者確認後更新）/ 修正 manifest.webmanifest 在 dev server 出現 'Line: 1, column: 1, Syntax error.'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Map continues to work without network after first load (Priority: P1)

A field operator opens the map at the office on Wi-Fi, pans around the
area they expect to work in, then heads out into the field where their
phone has no cellular signal. When they relaunch the installed PWA (or
re-open the browser tab) they expect the app shell to load instantly,
the crosshair / readout / Go-To / format / layer / locale UI to be
fully functional, and any tile they had previously seen on Wi-Fi to
still render at the same zoom level — no white canvas, no spinner that
never finishes.

**Why this priority**: This is the entire reason this PWA exists rather
than being a regular web app. Without it the install button is
misleading and the app fails its core promise the moment connectivity
drops. Every other concern in this feature is polish — this one is the
product.

**Independent Test**: Load the app once with the network online, pan
the map across the operator's region of interest, then disable network
in DevTools (or airplane-mode the device) and reload the page. The app
shell, all UI controls, the saved last-view, all stored preferences,
and the basemap tiles for the previously-visited region MUST be
visible and interactive within 3 seconds of reload.

**Acceptance Scenarios**:

1. **Given** the operator has loaded the app once on a stable network
   and panned the map across Taipei, **When** they disable network and
   reload the page, **Then** the app shell, toolbar, crosshair,
   coordinate readout, attribution bar, and the previously-cached
   basemap tiles for Taipei MUST render within 3 s.
2. **Given** the operator is offline with a cached tile region,
   **When** they pan to an area they did NOT previously visit, **Then**
   the app MUST NOT crash; un-cached tiles MAY be blank or show a
   placeholder, but the rest of the map and UI MUST keep working.
3. **Given** the operator is offline, **When** they open Go-To and
   submit a coordinate inside the cached region, **Then** the map MUST
   fly to that coordinate exactly as in the online flow.
4. **Given** the operator is offline, **When** they switch basemaps,
   **Then** if the new basemap has cached tiles for the current view
   the swap MUST succeed; if it does not, the existing tile-failure
   toast (feature 003) MUST appear and revert.

---

### User Story 2 - Operator confirms before a new version is installed (Priority: P2)

A new build of the app has been deployed. The operator already has the
old version open (or has it installed and re-opens it). Before the new
version replaces the running one, they expect a non-blocking prompt
that tells them an update is available, lets them keep using the
current version uninterrupted, and only swaps to the new version when
they explicitly confirm. They should not lose in-flight Go-To input,
zoom level, last-view, recents, or preferences when the update is
applied.

**Why this priority**: The current `autoUpdate` strategy can swap the
service worker silently while the operator is mid-task, which on next
navigation can cause a forced reload and lose unsaved input. A
controlled prompt is also a constitutional Principle III concern (no
surprises), and it gives the operator a chance to finish a task before
absorbing a UI change.

**Independent Test**: Deploy a new build (in test, manually rev the
service-worker version). With the app already open, observe that a
non-blocking "Update available" indicator appears within 10 s of the
app detecting the new SW. Tapping "Update" reloads to the new version;
tapping "Later" dismisses the prompt and the app continues running on
the old version. Recents, last-view, layer selection, and locale all
survive the update reload.

**Acceptance Scenarios**:

1. **Given** the app is running version A and a new build version B
   has been deployed, **When** the service worker detects the new
   version, **Then** a non-blocking notification MUST appear within
   10 s telling the operator an update is available with two actions:
   "Update now" and "Later".
2. **Given** the update prompt is visible, **When** the operator taps
   "Update now", **Then** the new service worker MUST activate and the
   page MUST reload into version B.
3. **Given** the update prompt is visible, **When** the operator taps
   "Later", **Then** the prompt MUST be dismissed, the app MUST
   continue running on version A without reload, and the prompt MUST
   reappear the next time the app is opened or the tab regains focus
   after at least 30 minutes (whichever is later).
4. **Given** a successful update reload, **When** the new version
   loads, **Then** all stored operator state — `pwa_map:prefs`,
   `pwa_map:lastView`, `pwa_map:gotoHistory_v1` — MUST be intact and
   readable by the new version (additive-only schema rule from ADR
   0021).
5. **Given** there is no update available, **When** the operator opens
   the app, **Then** no update prompt MUST appear (no false positives).

---

### User Story 3 - Attribution badge is readable on every basemap and color scheme (Priority: P2)

An operator using the app in light mode on a bright satellite tile, or
in dark mode on the OSM basemap, expects the small attribution text in
the bottom-right corner to be legible. Today the badge uses a
near-white translucent background and the foreground colour follows
the OS color-scheme token, which means in dark mode the foreground
becomes near-white and the badge becomes invisible. The fix MUST
preserve the badge's role (legal attribution per OSM/Google/NLSC
licence) while meeting WCAG AA contrast on every supported basemap and
both color schemes.

**Why this priority**: Legal attribution is a tile-licence requirement
— if it is unreadable, the app is not in compliance even if a string
is rendered. Constitutional Principle III also mandates WCAG AA
contrast, so this is a constitutional gap, not just polish.

**Independent Test**: Open the app in light mode on each of the seven
catalogued basemaps and visually verify the attribution text is
readable. Repeat in dark mode (system setting). Programmatically check
the computed foreground/background contrast ratio is ≥ 4.5:1 for each
combination.

**Acceptance Scenarios**:

1. **Given** any of the 6 basemaps from the feature 003 catalogue is
   active in light mode, **When** the attribution bar is visible,
   **Then** the foreground / background contrast ratio MUST be ≥ 4.5:1
   measured against the badge's own background (not the underlying
   tile).
2. **Given** any of the 6 basemaps is active in dark mode, **When**
   the attribution bar is visible, **Then** the foreground / background
   contrast ratio MUST also be ≥ 4.5:1.
3. **Given** the Google road overlay is toggled on top of any basemap,
   **When** the attribution string includes both the basemap and the
   overlay (separated by `|`), **Then** the entire composed string
   MUST remain legible at 12 px in both color schemes.
4. **Given** the badge sits over a high-contrast tile region (e.g., a
   pure-white satellite cloud or a black water polygon), **When** the
   operator looks at the badge, **Then** the badge background MUST be
   opaque enough that the badge text is not affected by the underlying
   tile colour.

---

### User Story 4 - No manifest parse errors in the developer console (Priority: P3)

An operator (or a contributor) running the app in development sees the
console error
`manifest.webmanifest:1 Manifest: Line: 1, column: 1, Syntax error.`
This is harmless in dev (the SW is disabled in dev today) but it
trains both contributors and Chromium's installability heuristic to
ignore the manifest, which masks real problems and prevents the
"install" prompt from ever firing in dev. The fix MUST make the
console clean in both dev (`vite dev`) and production preview.

**Why this priority**: Lowest-impact of the four — it does not block
field work and only contributors see it. Still, console hygiene is a
constitutional Principle V concern (no errors in normal operation) and
fixing it removes a paper-cut for every contributor onboarded after.

**Independent Test**: Run `npm run dev` and open `http://localhost:5173`
in Chromium DevTools → Application → Manifest. The manifest MUST parse
cleanly (no syntax error). The Console panel MUST show zero entries
matching `manifest.webmanifest.*Syntax error`. Run `npm run build &&
npm run preview` and verify the same.

**Acceptance Scenarios**:

1. **Given** the dev server is running, **When** the operator opens
   the page in Chromium, **Then** the Console MUST contain zero
   `manifest.webmanifest.*Syntax error` entries.
2. **Given** the production preview is running, **When** the operator
   opens the page, **Then** DevTools → Application → Manifest MUST
   show all manifest fields parsed (name, short_name, icons, etc.) and
   the Console MUST contain zero manifest-related errors.
3. **Given** the operator opens the production preview on a Chromium
   browser that supports installability, **When** they meet the
   installability criteria (HTTPS or localhost, valid SW, valid
   manifest with required fields), **Then** the install affordance
   MUST be available.

---

### Edge Cases

- **Two tabs open during update**: Tab A taps "Update now", Tab B is
  still on the old version. Tab B MUST either show its own update
  prompt within 10 s (because the new SW is now waiting) or already be
  on the new version (because skipWaiting was issued). It MUST NOT be
  silently broken (e.g., loading new chunks against an old shell).
- **"Later" then close tab**: Operator dismisses the prompt and closes
  the tab; on the next launch the prompt MUST re-appear because the
  new SW is still in `waiting` state.
- **SW registration fails entirely** (e.g., browser disabled SW): The
  app MUST continue to work as a regular online web app; no error
  toast for this case (it is an expected fallback path), but no
  uncaught promise rejections either.
- **Operator goes offline mid-tile-load**: Tiles that are partially
  cached MAY render; tiles whose request had not completed MUST fail
  silently (no error toast, no `tilefail` revert) — that path is
  reserved for HTTP 4xx/5xx fetch failures per ADR 0022.
- **Operator runs out of cache quota**: The runtime caching strategy
  has `maxEntries` already in place. If the cache is evicted between
  sessions, an offline reload MAY show un-tiled regions, and the rest
  of the app MUST still work.
- **Stale chunks served by old SW after a partial update**: The new
  SW activation MUST claim all clients atomically OR the operator
  MUST reload — there must not be a mixed-version state where an old
  HTML shell loads new JS chunks (or vice versa).
- **Manifest fix in dev mode**: When the dev fix is in place, hot-reload
  on a CSS or JS change MUST NOT break the manifest endpoint.
- **Attribution badge over a transparent map background**: If a
  basemap fails to load and the canvas is briefly empty, the badge
  background MUST still meet contrast against whatever colour the
  canvas falls back to (e.g., `--color-bg`).

## Requirements *(mandatory)*

### Functional Requirements

#### Offline-first behaviour (US1)

- **FR-001**: The app MUST register a service worker in production
  builds and use it as the offline-first runtime.
- **FR-002**: The app shell (HTML, JS bundles, CSS, fonts, manifest,
  icons) MUST be precached on first install so subsequent loads
  succeed without network.
- **FR-003**: Tile responses (OSM, NLSC, Google) MUST be served
  stale-while-revalidate by the service worker so previously-viewed
  regions remain visible offline; this rule is already in place from
  feature 003 and MUST NOT regress.
- **FR-004**: A first-time install MUST surface a one-time
  notification telling the operator the app is now available offline
  (e.g., a 5 s toast with the localised string `pwa.offline.ready`).
- **FR-005**: All interactive UI (toolbar, pickers, Go-To dialog,
  format toggle) MUST function offline using cached resources only.
- **FR-006**: Persisted state (`pwa_map:prefs`, `pwa_map:lastView`,
  `pwa_map:gotoHistory_v1`) MUST be readable offline and round-trip
  through page reloads.

#### Controlled-update flow (US2)

- **FR-007**: When the service worker detects a new version
  (`waiting` state), the app MUST display a non-blocking notification
  to the operator within 10 s of detection.
- **FR-008**: The notification MUST offer at least two distinct
  actions: confirm the update (which triggers `skipWaiting` + reload
  into the new version) and dismiss it (which keeps the operator on
  the current version).
- **FR-009**: When the operator dismisses the prompt, it MUST NOT
  reappear within the same session for at least 30 minutes; it MUST
  reappear on the next session start (page load) if the new SW is
  still waiting.
- **FR-010**: A successful update reload MUST preserve all persisted
  operator state (`pwa_map:prefs`, `pwa_map:lastView`,
  `pwa_map:gotoHistory_v1`).
- **FR-011**: The notification MUST be localised in zh / en / ja
  (using the existing i18n store; new keys under `pwa.update.*`).
- **FR-012**: If service-worker registration fails (e.g., browser does
  not support SW, or feature is disabled), the app MUST continue to
  function online without showing the update prompt and without
  surfacing an error to the operator.

#### Attribution readability (US3)

- **FR-013**: The attribution badge MUST achieve a foreground /
  background contrast ratio of at least 4.5:1 (WCAG AA for body text)
  in both `light` and `dark` color schemes.
- **FR-014**: The badge background MUST be opaque enough that the
  underlying tile colour does not reduce contrast below 4.5:1 — i.e.,
  the contrast guarantee MUST hold against the badge's own background,
  not against the map.
- **FR-015**: The badge MUST keep its role as a legal-attribution
  surface — it MUST display the attribution string for the active
  basemap, and when an overlay is also active it MUST display both
  (basemap and overlay) separated by `|`. No truncation, no
  abbreviation.
- **FR-016**: The badge MUST NOT change layout, position, or font-size
  (12 px in the bottom-right corner) — only the colour tokens / opacity
  may change.

#### Manifest hygiene (US4)

- **FR-017**: Loading the app via `vite dev` MUST NOT produce any
  `manifest.webmanifest` syntax-error entries in the browser console.
- **FR-018**: Loading the app via the production build (`vite build`
  + preview / static host) MUST also produce zero manifest errors.
- **FR-019**: The manifest served to the browser MUST be valid JSON,
  contain the required fields (`name`, `short_name`, `icons`,
  `start_url`, `display`), and reference icons that exist at the
  declared paths.
- **FR-020**: The fix for dev mode MUST NOT enable the production
  service worker in dev (so tests, HMR, and dev tooling are
  unaffected) — only the manifest endpoint needs to resolve cleanly.

### Key Entities

- **AppVersion**: A discrete deployed build of the app, identified by
  the bundled service-worker file hash. Two AppVersion instances may
  coexist briefly during an update (the active one and the waiting
  one). The operator interacts with a single AppVersion at a time per
  tab.
- **UpdatePromptState**: A per-session in-memory record
  (`{ visible: boolean; postponedUntil: number | null }`). Not
  persisted across sessions — the SW `waiting` state itself is the
  source of truth.
- **OfflineCache**: The browser-managed Cache Storage entry containing
  precached app shell + runtime-cached tiles. Already implicitly
  defined by the existing `runtimeCaching` rules; this feature does
  not change its schema.
- **Manifest**: The PWA manifest document (`manifest.webmanifest`).
  Must be valid JSON; the existing `manifest` block in the build
  config is the source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning operator with the app installed and network
  fully disabled MUST see the app shell, toolbar, crosshair, readout,
  and previously-cached tiles render within **3 s** of opening the app
  (measured from `navigationStart` to the first paint that includes a
  cached tile).
- **SC-002**: When a new SW version is deployed, **100 %** of running
  app sessions MUST surface the update prompt within **10 s** of the
  new SW reaching the `waiting` state.
- **SC-003**: A "Later" dismissal MUST keep the prompt hidden for at
  least **30 minutes** within the same session and MUST cause **no**
  forced reload during that window.
- **SC-004**: Across the 12 (basemap × color-scheme) combinations
  (6 basemaps × 2 schemes), **100 %** of attribution-badge contrast
  measurements MUST meet WCAG AA (≥ 4.5:1).
- **SC-005**: After a controlled update, **100 %** of preserved state
  fields (`pwa_map:prefs`, `pwa_map:lastView`,
  `pwa_map:gotoHistory_v1`) MUST be readable by the new version
  without data loss.
- **SC-006**: The browser console for both `vite dev` and the
  production preview MUST contain **zero** entries matching the regex
  `manifest\.webmanifest.*Syntax error`.
- **SC-007**: Cumulative bundle-size delta from this feature MUST be
  ≤ **3 KB** gzipped on the main bundle (one toast component + a
  small registration-strategy change; SW manifest changes do not
  count toward the main-bundle budget).
- **SC-008**: The first-time-install offline-ready toast MUST be
  surfaced exactly **once per install lifetime** (not on every visit).

## Assumptions

- The app's existing service-worker runtime (vite-plugin-pwa +
  Workbox) is the basis; this feature changes the registration
  strategy and adds a UI prompt, but does not introduce a new SW
  framework.
- "Offline" means *previously-visited* regions only — un-visited tile
  areas are NOT pre-warmed; the operator is expected to pan their
  region of interest while online before going offline. This matches
  feature 003's runtime-caching design.
- The update prompt re-appears on the next session if the operator
  taps "Later" — there is no out-of-band notification (no push, no
  email, no tab-to-tab signalling).
- A 30-minute postpone window is long enough to finish a typical
  field task and short enough that the operator is not stranded on a
  stale version. (No data on field-task duration was provided; this
  is a reasonable default.)
- The attribution-bar fix is a styling-only change — no new component,
  no new DOM. The fix targets the existing `.attribution` selector in
  `src/components/AttributionBar.svelte`.
- The manifest fix may require either a static manifest fixture in
  `public/` so the dev server serves it directly, or enabling
  vite-plugin-pwa's dev manifest path. Either approach is acceptable
  as long as it does not enable the SW in dev (tests + HMR rely on
  no SW being installed during development).
- The persisted `pwa_map:*` localStorage shapes do NOT change in this
  feature — ADR 0021 (additive evolution) still applies; if any field
  is added it MUST be optional with a documented default.
- Existing tests (unit, integration, E2E) for features 001–003 MUST
  continue to pass without modification, except where they explicitly
  measure the regressions this feature fixes.
