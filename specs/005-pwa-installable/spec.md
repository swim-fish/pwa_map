# Feature Specification: PWA Install Affordance for Android & iOS

**Feature Branch**: `005-pwa-installable`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "PWA Web App android iOS App / Making PWAs installable"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Android operator installs the PWA from inside the app (Priority: P1)

A field operator opens the web app on their Android phone in Chrome
(or Edge / Samsung Internet — any Chromium browser). Today they have
no obvious way to install it: the browser's own three-dot menu has an
"Install app" entry buried two taps deep, and most operators never
find it. They expect a clear, in-app install affordance — a small
non-blocking banner that says "Install this app for offline use",
with a primary "Install" button that triggers the same native install
prompt. After accepting, the app appears on their home screen as a
standalone icon and launches without browser chrome.

**Why this priority**: This is the entire reason feature 005 exists.
The PWA is already installable per Chromium's heuristic (manifest +
SW + icons all valid since feature 004), but installation rate is
near-zero because the path is invisible. Without an in-app
affordance the previous offline-first work cannot reach the field
operators it was built for.

**Independent Test**: On a fresh Chrome profile on Android (or
Chromium desktop), open the production preview. Within 5 seconds an
install affordance appears at a non-blocking position (not modal,
not blocking the map). Tapping its primary "Install" button fires
Chromium's native install prompt; accepting completes installation
in under 30 s and the app icon appears on the home screen / launcher.

**Acceptance Scenarios**:

1. **Given** a Chromium browser that has fired `beforeinstallprompt`
   and the app is not running in standalone mode, **When** the user
   has not previously dismissed the prompt within the dismissal
   window, **Then** an in-app install affordance MUST appear within
   5 s of the event, with both an "Install" action and a "Not now"
   dismissal action.
2. **Given** the install affordance is visible, **When** the user
   taps "Install", **Then** the deferred `beforeinstallprompt` event
   MUST be invoked exactly once and the browser's native install
   sheet MUST appear.
3. **Given** the user accepts the native prompt, **When** the
   browser fires `appinstalled`, **Then** the in-app affordance MUST
   disappear and MUST NOT reappear in the same browser profile until
   the user uninstalls the app or clears site data.
4. **Given** the user rejects the native prompt or dismisses it,
   **When** they continue using the app, **Then** the in-app
   affordance MUST hide for at least the configured dismissal window
   and MUST NOT immediately re-prompt.
5. **Given** the user taps "Not now" on the in-app affordance,
   **When** the dismissal is recorded, **Then** the affordance MUST
   disappear and MUST NOT reappear within the same browser profile
   for at least 30 days.

---

### User Story 2 - iOS operator gets clear "Add to Home Screen" instructions (Priority: P2)

An operator on an iPhone opens the web app in Safari. iOS Safari
does not expose `beforeinstallprompt` and does not allow programmatic
install — the only path is the Share menu → "Add to Home Screen"
gesture. Operators rarely discover this on their own. They expect an
in-app instructional sheet that explains the gesture in plain
language and (ideally) shows a small visual hint of which icon to
tap. After they complete the gesture and re-launch from the home
screen, the app runs in standalone mode and the instructional sheet
never re-appears.

**Why this priority**: iOS is roughly half of the target field-device
fleet; without an iOS path, this feature only solves Android. P2
because the actual install gesture happens outside our app (in
Safari's UI), so the value we can add is purely educational, but
without it iOS install rate stays near-zero.

**Independent Test**: On a fresh iOS Safari session (Safari only —
not iOS Chrome / Firefox, which use WebKit but cannot install PWAs),
open the production preview. An in-app instructional sheet MUST
appear within 5 s explaining the Share-menu gesture in the operator's
locale. After manually performing the gesture and launching from the
home screen, the next session MUST run in standalone mode and MUST
NOT show the sheet again.

**Acceptance Scenarios**:

1. **Given** the app is open in iOS Safari (not standalone), **When**
   the dismissal window has not started, **Then** an in-app
   instructional sheet MUST appear within 5 s with localised
   step-by-step text describing the Share → Add to Home Screen
   gesture.
2. **Given** the instructional sheet is visible, **When** the user
   taps "Got it" / "Not now", **Then** the sheet MUST disappear and
   MUST NOT reappear within the same browser profile for at least
   30 days.
3. **Given** the user has added the app to their home screen and
   re-launches from that icon, **When** the new session starts in
   standalone mode (`navigator.standalone === true` OR
   `matchMedia('(display-mode: standalone)').matches === true`),
   **Then** the instructional sheet MUST NOT appear.
4. **Given** the app is open in iOS Chrome / Firefox / Edge (which
   use WebKit and cannot install PWAs), **When** the page loads,
   **Then** the affordance MUST EITHER show a generic "open in Safari
   to install" hint OR not appear at all — it MUST NOT pretend
   installation is possible.

---

### User Story 3 - No noise for already-installed or recently-dismissed users (Priority: P3)

An operator who already installed the PWA, or who tapped "Not now"
yesterday, opens the app and expects no install nag. The whole
affordance MUST be invisible: no banner, no instructional sheet, no
empty container reserving layout space. The previously-installed
case is the most important sub-case — re-prompting an installed user
is both annoying and trains them to ignore future prompts.

**Why this priority**: Lowest impact (it prevents harm rather than
delivering new value), but constitutional Principle III (no
surprises) makes it non-negotiable. Without this, the feature
regresses UX for users who already completed the install flow.

**Independent Test**: (a) Launch the app from the home screen (or
from `chrome://apps`) so it starts in standalone mode → no install
affordance MUST be visible. (b) In a browser tab where "Not now" was
tapped within the last 30 days → no install affordance MUST be
visible. (c) Clear site data and re-load → the affordance re-appears
on the next qualifying load.

**Acceptance Scenarios**:

1. **Given** the app is launched in standalone mode (any platform),
   **When** the page loads, **Then** the install affordance MUST NOT
   render at all (not just be hidden via CSS — no DOM presence).
2. **Given** the user previously tapped "Not now" within the last
   30 days, **When** they re-open the app on the same browser
   profile, **Then** no install affordance MUST appear.
3. **Given** the user previously dismissed the affordance > 30 days
   ago, **When** they re-open the app, **Then** the affordance MAY
   re-appear (subject to the same standalone / `appinstalled` checks).
4. **Given** the browser profile is cleared (site data wiped),
   **When** the app re-loads on a qualifying browser, **Then** the
   affordance MUST be re-armed and behave as a first visit.

---

### Edge Cases

- **Firefox Android**: Firefox on Android does not fire
  `beforeinstallprompt`. The affordance MUST NOT appear (no install
  path exists), and the app MUST NOT show a broken "Install"
  button that does nothing.
- **In-app browsers (Facebook / Instagram / WeChat / LINE)**: These
  embed a stripped Chromium / WebKit and never fire
  `beforeinstallprompt`. Same handling as Firefox — affordance MUST
  NOT appear.
- **User cancels native install sheet**: The browser closes its sheet
  with no `appinstalled` event. The in-app affordance MUST treat
  this as an implicit "not now" and apply the dismissal window.
- **Two tabs open**: Tab A taps "Install" and accepts; Tab B is
  still open. Tab B MUST hide its affordance within 5 s of the
  `appinstalled` event firing on its own browser context (the event
  fires per-page).
- **App installed but later removed from home screen**: The
  `appinstalled` history is gone, but `navigator.serviceWorker`
  still has a registration. On next visit, `beforeinstallprompt`
  MAY fire again, in which case the affordance MAY re-appear (the
  user removed the install themselves so re-offering is welcome).
- **Manifest serves invalid JSON**: `beforeinstallprompt` will not
  fire, the affordance MUST NOT appear, and no console error MUST
  be raised by feature 005's own code (the manifest error itself
  is feature 004's concern).
- **iOS Safari in private-browsing mode**: `localStorage` is
  ephemeral; the dismissal record will not persist across tabs. The
  affordance MAY re-appear on each tab — acceptable degradation.
- **Reduced motion**: The affordance enter / exit animation MUST
  respect `prefers-reduced-motion: reduce` and skip the slide-in
  animation when set.

## Requirements *(mandatory)*

### Functional Requirements

#### Android & desktop Chromium install path (US1)

- **FR-001**: The app MUST register a `beforeinstallprompt` listener
  on the `window` object as early as possible during page lifecycle
  and call `event.preventDefault()` to defer the browser's automatic
  prompt.
- **FR-002**: The deferred event MUST be retained in memory so the
  in-app affordance can call `event.prompt()` later in response to
  a user gesture.
- **FR-003**: When `beforeinstallprompt` has fired AND the app is
  not in standalone mode AND no dismissal record is active AND
  `appinstalled` has not fired this session, the in-app install
  affordance MUST become visible within 5 s of the event.
- **FR-004**: The in-app affordance MUST offer two distinct actions:
  a primary "Install" action that calls `event.prompt()` and a
  secondary "Not now" action that records a dismissal and hides the
  affordance.
- **FR-005**: After `event.prompt()` resolves, the result of
  `event.userChoice` MUST be observed: if `outcome === 'accepted'`
  the affordance MUST hide; if `outcome === 'dismissed'` a
  dismissal MUST be recorded.
- **FR-006**: When the browser fires `appinstalled` on `window`,
  the affordance MUST hide for the rest of the install lifetime
  (not just the session) — re-showing requires the user to clear
  site data or uninstall.

#### iOS Safari instructional path (US2)

- **FR-007**: The app MUST detect "iOS Safari, not standalone" via
  user-agent inspection (`navigator.userAgent` matches iPhone /
  iPad / iPod AND does NOT match CriOS / FxiOS / EdgiOS) AND
  `navigator.standalone !== true`.
- **FR-008**: When the iOS Safari condition holds AND no dismissal
  record is active, an instructional sheet MUST appear within 5 s
  showing localised step-by-step instructions for the Share → Add
  to Home Screen gesture, including a recognisable icon hint for
  the Share button.
- **FR-009**: The instructional sheet MUST offer a "Got it" /
  "Not now" action that records a dismissal and hides the sheet.
- **FR-010**: For iOS browsers other than Safari (CriOS / FxiOS /
  EdgiOS), the affordance MUST EITHER not appear OR appear as a
  read-only "Open this page in Safari to install" hint without an
  active install action.

#### Suppression and re-arming (US3)

- **FR-011**: When `matchMedia('(display-mode: standalone)').matches`
  is true OR `navigator.standalone === true`, no install affordance
  MUST render at all (not "render then hide" — the DOM MUST be
  absent).
- **FR-012**: A dismissal MUST be persisted to `localStorage` under a
  dedicated key `pwa_map:installDismissedUntil` whose value is the
  epoch-millisecond timestamp at which the affordance MAY re-appear
  (`now + 30 * 24 * 60 * 60 * 1000` by default).
- **FR-013**: On every page load, the dismissal record MUST be read
  before deciding whether to render the affordance: if `Date.now()
  < installDismissedUntil`, the affordance MUST stay hidden.
- **FR-014**: Clearing site data (and therefore clearing
  `localStorage`) MUST re-arm the affordance — the dismissal key
  is the only persistence; absence of the key means "not dismissed".

#### Accessibility, i18n, and visual integration (cross-cutting)

- **FR-015**: All affordance copy (banner title, action labels, iOS
  instructional steps, "open in Safari" hint) MUST be localised in
  the existing `zh / en / ja` locales. New keys MUST live under
  `pwa.install.*` and follow Constitution Locale conventions
  (no `zh-TW`, `zh-Hant`, etc.).
- **FR-016**: The affordance MUST meet WCAG AA contrast (≥ 4.5:1)
  for body text and ≥ 3:1 for non-text UI in both light and dark
  color schemes, reusing the established design tokens from
  `src/app/tokens.css`.
- **FR-017**: Both action buttons MUST be ≥ 36 × 36 px tap targets.
  The instructional sheet's dismiss control MUST be reachable via
  keyboard (Tab focusable, Enter / Space activatable, Escape
  closes).
- **FR-018**: The affordance MUST NOT visually overlap the existing
  feature 004 update prompt (top-center) or the offline-ready /
  copy / zone-hint / layer-fail toasts (bottom-center). It MUST
  pick a non-conflicting viewport anchor.
- **FR-019**: The affordance enter / exit animation MUST respect
  `prefers-reduced-motion: reduce` and skip slide / fade animation
  when reduced motion is requested.
- **FR-020**: No console errors MUST be raised by feature 005's own
  code path during normal operation (qualifying load, dismissal,
  acceptance, suppression, or unsupported-browser path).

### Key Entities

- **InstallPromptState**: A transient in-memory record describing
  the current affordance state — `{ surface: 'android' | 'ios' |
  'unsupported' | 'hidden'; deferredPrompt: BeforeInstallPromptEvent
  | null; dismissedUntil: number | null; installed: boolean }`. Not
  persisted; rebuilt on every page load from
  `beforeinstallprompt`, `appinstalled`, `navigator.standalone`,
  `matchMedia`, and the `pwa_map:installDismissedUntil` key.
- **DismissalRecord**: A single `localStorage` entry under
  `pwa_map:installDismissedUntil`, value `string`-ified epoch ms
  ("the affordance MUST stay hidden until this timestamp"). Absence
  ≡ never dismissed. Any non-numeric or past-timestamp value MUST
  be treated as absent (corruption-tolerance, same pattern as
  feature 004's `pwa_map:offlineReadyShown`).
- **InstallSurface**: The visible affordance — one of three variants
  (Android-style banner with primary Install button; iOS
  instructional sheet with Share-icon hint; generic "open in Safari"
  hint). All three reuse the same outer container token / position
  but render different inner content.
- **PlatformDetection**: A pure-function inspection of
  `navigator.userAgent`, `navigator.standalone`, `matchMedia`, and
  the captured `beforeinstallprompt` event. Returns one of
  `'android-chromium' | 'ios-safari' | 'ios-other' | 'desktop-chromium'
  | 'unsupported' | 'standalone'`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a Chromium browser that has fired
  `beforeinstallprompt`, the in-app install affordance MUST surface
  within **5 s** of the event in **100 %** of qualifying sessions
  (measured via integration test that fires the event manually and
  asserts the affordance is rendered).
- **SC-002**: After the operator taps "Install" and accepts the
  native prompt on Android Chrome, the install MUST complete in
  ≤ **30 s** wall-clock under normal mobile network conditions
  (manual smoke metric; no CI gate).
- **SC-003**: On iOS Safari (not standalone), the instructional
  sheet MUST appear within **5 s** in **100 %** of sessions where
  no dismissal record is active.
- **SC-004**: When the app is launched in standalone mode (any
  platform), **0** install affordances MUST render — verified by
  an integration test that mocks
  `matchMedia('(display-mode: standalone)')` to true and asserts
  the affordance has no DOM presence.
- **SC-005**: A dismissal MUST persist for ≥ **30 days** within the
  same browser profile — verified by a unit test that stamps
  `dismissedUntil = Date.now() + 30 * 24 * 60 * 60 * 1000` and
  asserts the affordance stays hidden across simulated
  page-reloads until the timestamp is reached.
- **SC-006**: **100 %** of new affordance copy MUST be localised in
  `zh / en / ja` — verified by a build-time check that all
  `pwa.install.*` keys exist in all three locale files.
- **SC-007**: Cumulative bundle-size delta from this feature MUST be
  ≤ **4 KB** gzipped on the main bundle (one banner + one
  instructional sheet + a small platform-detection helper).
- **SC-008**: The feature MUST raise **0** browser-console errors
  across all six paths: (a) qualifying Android load, (b) iOS Safari
  load, (c) standalone load, (d) Firefox Android load, (e) iOS
  Chrome load, (f) install accepted then page reloaded.
- **SC-009**: All affordance buttons MUST measure ≥ **36 × 36 px**
  in jsdom integration tests — same tap-target rule applied to the
  feature 004 `UpdatePrompt` (Constitution Principle III).
- **SC-010**: WCAG AA contrast (≥ 4.5:1) MUST hold for all
  affordance text in both color schemes — verified by the same
  contrast-helper pattern feature 004 introduced for the
  attribution badge.

## Assumptions

- **Manifest hygiene from feature 004 is in place**. The manifest
  validates as JSON, contains `name`, `short_name`, `icons`,
  `start_url`, `display`, and the icons resolve. Without this,
  Chromium will not fire `beforeinstallprompt` and US1 silently
  fails — feature 004 is a hard prerequisite.
- **Target platforms inherit from features 001-003** — Android 10+
  Chromium and iOS 15+ Safari are the primary mobile targets;
  Chromium desktop is a secondary target that receives the same
  Android-style banner since `beforeinstallprompt` is shared
  across desktop and Android Chromium.
- **Dismissal window default is 30 days**. No data on field
  re-prompt tolerance was provided; 30 days matches typical
  industry practice for PWA install nudges.
- **iOS browsers other than Safari (Chrome / Firefox / Edge) cannot
  install PWAs** — they all use WebKit but Apple does not surface
  the A2HS path through them. The feature treats them as
  unsupported and either renders no affordance or a read-only
  "open in Safari to install" hint.
- **The persisted key `pwa_map:installDismissedUntil` is NEW** and
  follows ADR 0021 additive evolution — it is a separate key from
  `pwa_map:prefs` and does not modify any existing schema.
- **No new runtime dependency**. The feature uses only standard
  browser APIs (`beforeinstallprompt`, `appinstalled`,
  `matchMedia`, `navigator.standalone`, `localStorage`,
  `navigator.userAgent`).
- **Animation / transitions reuse existing `tokens.css` motion
  values** so reduced-motion handling is consistent with features
  001-004.
- **Existing tests for features 001-004 MUST continue to pass**
  without modification. Specifically the feature 004 `UpdatePrompt`
  toast and offline-ready toast MUST keep their current viewport
  anchors; the install affordance MUST pick a non-conflicting one.
- **iOS Safari A2HS does not fire any in-page event upon
  completion**. Confirmation that install succeeded relies on
  detecting standalone mode on the next launch — there is no
  programmatic equivalent to Chromium's `appinstalled` on iOS.
- **The feature does not change the `display` value in the
  manifest** (`'standalone'` from feature 004 is preserved). It
  also does not change `start_url` or `scope`.
