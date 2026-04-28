# Feature Specification: Browser Safe-Area Compliance and a Settings-Page Install Button for All Platforms

**Feature Branch**: `011-safe-area-install-buttons`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description (combined):

1. "修正 iOS/Android 瀏覽器安全區域(避免被上下的狀態列擋住)"
2. "設定頁面新增 Android/iOS/Desktop Chrome 安裝此 App 按鈕"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Top and bottom controls clear the iOS notch / Dynamic Island and the Android status bar (Priority: P1)

A user opening the app in an iPhone Safari tab (with the notch or
Dynamic Island at the top, and the gesture-bar / home indicator at the
bottom) currently has the top toolbar (Go To / Format / Layers /
Locale / Settings buttons) sliding *underneath* the notch, and the
zoom controls / coordinate readout / attribution bar pinned so close
to the gesture bar that taps mis-fire and label text is partially
clipped by the home indicator. The same problem appears on Android
Chrome with edge-to-edge display, on iOS PWA standalone mode (where
the system status bar overlays the page), and on Android PWA
standalone mode (where the bottom navigation gesture region overlays
the page). After this change, every persistent on-screen surface
sits inside the visual safe area on every supported browser:
- The top toolbar is offset down by `env(safe-area-inset-top)` so it
  is fully visible and tappable below the notch / Dynamic Island /
  status bar.
- The bottom-pinned surfaces (coordinate readout, zoom controls,
  attribution bar, transient toasts, install banner, iOS install
  sheet) are offset up by `env(safe-area-inset-bottom)` so they
  clear the home indicator / gesture bar.
- The same offsets apply on left / right where the device reports a
  non-zero inset (notably iPhone landscape, where the notch claims a
  side margin).
- The existing `viewport-fit=cover` meta declaration is retained so
  the page paints edge-to-edge while the controls themselves stay
  inside the safe area.

**Why this priority**: This is a usability blocker, not a polish
item — controls hidden under the notch are not just visually wrong,
they capture user taps that the OS interprets as system gestures
(swipe-down for Control Centre, swipe-up for app switcher), causing
the user to drop out of the app entirely. Every persistent UI surface
in the app is affected, and the fix is a tokens-and-CSS change with
no behavioural risk to coordinate logic.

**Independent Test**: Open the PWA in mobile Safari on an iPhone
14-class device (notch / Dynamic Island present) and in Chrome on a
Pixel-class device with edge-to-edge / gesture navigation enabled.
Verify the top toolbar's tap targets sit fully below the system
status bar / notch and that nothing in the toolbar is clipped or
overlapped. Rotate to landscape; verify the toolbar inset shifts to
the side opposite the notch. Verify the zoom controls, coordinate
readout, and attribution bar each sit fully above the home indicator
/ gesture bar with no visible overlap. Repeat in PWA standalone
mode (after installing) — the rule must hold there too.

**Acceptance Scenarios**:

1. **Given** the app is open in mobile Safari on an iOS device with a notch or Dynamic Island, **When** the user views the top toolbar (Go To / Format / Layers / Locale / Settings), **Then** every button's bounding rectangle sits entirely below the notch / Dynamic Island, no button is overlapped, and every button responds to a tap on its visible area.
2. **Given** the same app on an iOS device, **When** the user views the bottom-pinned surfaces (coordinate readout, zoom controls, attribution bar), **Then** the bottom edge of each surface sits at least as high above the screen bottom as the OS-reported `env(safe-area-inset-bottom)` allows — none of those surfaces is overlapped by the home indicator.
3. **Given** the app is open in Chrome on an Android device with edge-to-edge display, **When** the user views the same top and bottom surfaces, **Then** the same safe-area clearance applies — nothing is overlapped by the system status bar or the bottom navigation / gesture region.
4. **Given** the app is open in iOS Safari in landscape orientation on a notched iPhone, **When** the user views the top toolbar, **Then** the toolbar respects `env(safe-area-inset-left)` / `env(safe-area-inset-right)` so no button slides under the side notch.
5. **Given** the app has been installed and is launched in PWA standalone mode (iOS Safari "Add to Home Screen", Android Chromium WebAPK), **When** the user opens the app, **Then** the same safe-area offsets hold — no UI surface is overlapped by the system status bar at the top or the gesture bar / home indicator at the bottom.
6. **Given** any device that reports zero safe-area insets (e.g. a desktop browser, an older Android phone with no edge-to-edge display), **When** the user opens the app, **Then** the layout is unchanged from today's baseline — the safe-area offsets degrade to `0px` and do not introduce extra padding.
7. **Given** transient surfaces (copy toast, layer-fail toast, offline-ready toast, update prompt, install banner, iOS install sheet), **When** they appear on a notched iOS device or an edge-to-edge Android device, **Then** they also sit inside the safe area and do not overlap the system bars.

---

### User Story 2 - Install the app from the Settings sheet on Android, Desktop Chromium, and iOS (Priority: P1)

A user who wants to install the PWA but has missed (or dismissed) the
transient install banner currently has no in-app affordance to invoke
the install flow on demand. After this change, the Settings sheet
contains a dedicated "Install app" section with one primary action
that adapts its behaviour to the user's platform:
- **Android Chromium / Desktop Chromium** (`beforeinstallprompt`
  available): the button is enabled and labelled with a localised
  "Install app" verb. Tapping it invokes the native install prompt
  exactly the same way the existing transient banner does.
- **iOS Safari**: the button is replaced with the same
  "Add to Home Screen" instruction sheet the auto-banner shows today
  (Share icon → Add to Home Screen) — invoked by tapping the section's
  primary action.
- **iOS non-Safari** (Chrome / Firefox / Edge on iOS, which cannot
  install PWAs): the section displays the existing localised
  "open in Safari to install" hint with no actionable button.
- **Already installed** (running in standalone display mode, or
  `appinstalled` has fired this session): the section shows a
  localised "App is already installed" status line with no button.
- **Unsupported** (e.g. desktop Firefox / desktop Safari, where neither
  the prompt nor an iOS-style hint applies): the section is hidden
  entirely so it does not falsely promise an install path that does
  not exist.

The Settings-sheet install path uses the **same** capture / dismiss /
already-installed bookkeeping as the transient banner, so:
- A user who dismisses the transient banner and later opens Settings
  can still tap "Install app" — the dismissal silences the *banner*,
  not the on-demand entry point.
- A user who installs from Settings sees `appinstalled` propagate so
  the transient banner does not also pop up.

**Why this priority**: Install affordances inside the app's own
Settings page are an industry-standard pattern (the transient banner
is the auto-discovery surface; the Settings entry is the
on-demand surface). This is the only way for a user who dismissed
the banner to recover the install action without clearing the
30-day dismissal window or reinstalling. Tied to P1 with Story 1
because both ship together as the "mobile platform polish" feature
the user asked for in a single command.

**Independent Test**: On a Chromium-class Android browser with the
PWA install criteria met, open Settings; verify the "Install app"
section is present with an enabled button. Tap it; the OS install
prompt appears. Cancel; the button stays enabled (no banner-style
30-day suppression for the Settings entry). On iOS Safari, open
Settings; the same section appears but its primary action opens the
iOS Add-to-Home-Screen sheet. On iOS Chrome, the section shows the
"open in Safari" hint with no button. After installing and opening
the app in standalone mode, the section reads "App is already
installed". On desktop Firefox, the section is hidden.

**Acceptance Scenarios**:

1. **Given** Android Chromium has fired `beforeinstallprompt` and the user is not running in standalone mode, **When** the user opens the Settings sheet, **Then** an "Install app" section is visible with an enabled primary button labelled with the localised install verb.
2. **Given** the same conditions, **When** the user taps the install button, **Then** the OS install prompt appears (the same prompt the transient banner shows), the prompt's outcome is captured, and the section reflects the new state — if the user accepts and the OS fires `appinstalled`, the section switches to the "already installed" status line; if the user cancels, the button stays enabled and tappable again.
3. **Given** Desktop Chromium with the same install criteria met, **When** the user opens the Settings sheet, **Then** the same "Install app" section appears and tapping the button invokes the desktop OS install prompt.
4. **Given** iOS Safari (no `beforeinstallprompt` is fired by Apple's browser), **When** the user opens the Settings sheet, **Then** an "Install app" section is visible with a primary action labelled with a localised "Show how to add to Home Screen" verb; tapping it opens the same instructional sheet the transient iOS banner shows today (Share icon → Add to Home Screen → Add).
5. **Given** iOS Chrome / Firefox / Edge (non-Safari iOS browsers, which cannot install PWAs), **When** the user opens the Settings sheet, **Then** the section displays the existing localised "open in Safari to install" hint and shows no actionable button.
6. **Given** the app is running in standalone display mode (the user has already installed it), **When** the user opens Settings, **Then** the section shows a localised "App is already installed" status line — no install button is rendered, and no instructional sheet is offered.
7. **Given** a desktop browser that supports neither the install prompt nor the iOS instructions (e.g. desktop Firefox, desktop Safari), **When** the user opens Settings, **Then** the entire "Install app" section is hidden — no headline, no button, no hint.
8. **Given** the user dismissed the transient install banner earlier (the 30-day banner suppression is in effect), **When** the user opens Settings, **Then** the "Install app" section still appears in its appropriate state for the platform — the transient-banner dismissal does NOT suppress the on-demand Settings entry.
9. **Given** the user installs the app via the Settings button and the OS fires `appinstalled`, **When** any other install surface re-evaluates (the transient banner, a future Settings open), **Then** all of them treat the app as installed and none of them prompts again.

---

### User Story 3 - Install button stays inside the safe area on every supported viewport (Priority: P3)

The new Settings install section is part of the Settings sheet, which
is centred in the viewport and bounded by `max-height: calc(100vh - 32px)`.
On a notched device in PWA standalone mode the sheet's bottom edge can
sit very close to the home indicator, and on a small notched device in
landscape the sheet's content can scroll close to the side notch.
After this change, the Settings sheet itself respects
`env(safe-area-inset-*)` on every edge so its scroll content never
hides under a system bar; in particular the new install section's
button — which is the section's primary actionable surface — is
always reachable without requiring the user to fight the system
gesture region.

**Why this priority**: Story 1 already makes top-and-bottom *persistent*
controls safe-area-aware. This story extends the same rule to the
Settings sheet so that the new install button (Story 2) is reliably
tappable. P3 because it is a small CSS extension of Story 1's tokens
applied to one additional surface, not a new design.

**Independent Test**: On an iPhone in portrait, open Settings; scroll
to the bottom; the last row (the install button or the existing
"clear all" button, whichever is later in the layout) is fully visible
above the home indicator. Rotate to landscape; the sheet still has
the same clearance on the bottom and clearance on the side that holds
the notch. Open Settings on a desktop browser with no insets; the
sheet renders identically to today's baseline.

**Acceptance Scenarios**:

1. **Given** the Settings sheet is open on an iOS device with a non-zero `env(safe-area-inset-bottom)`, **When** the user scrolls to the bottom of the sheet, **Then** the last visible row sits at least the safe-area-inset-bottom value above the screen bottom, with no overlap from the home indicator.
2. **Given** the Settings sheet is open on an iPhone in landscape with a notch on the left edge, **When** the user views the sheet content, **Then** the sheet (or its scroll content) clears `env(safe-area-inset-left)` so no row's leading text is hidden under the notch.
3. **Given** the Settings sheet is open on a device with zero safe-area insets, **When** the user views the sheet, **Then** the sheet renders with the same dimensions and padding as today (the safe-area rule degrades to `0px`).

---

### Edge Cases

- A user resizes the browser window during use such that the OS's reported safe-area insets change (e.g. dragging a window onto a different monitor, rotating from portrait to landscape on iOS): every surface that consumes the inset MUST re-layout on the next paint without a page reload (this is the native CSS `env(...)` behaviour and the spec MUST not rely on a JavaScript inset cache).
- A user opens the app in a browser that does not implement the `env(safe-area-inset-*)` CSS environment variables (very old WebKit, some embedded WebViews): the fallback `0px` value MUST be used so the layout matches today's baseline rather than collapsing to `unset`.
- A user opens the app in a non-secure context (`http://` rather than `https://`) where Service Workers and the install prompt are disallowed: the Settings install section MUST follow the same "unsupported" branch as desktop Firefox and stay hidden — not show an install button that immediately fails.
- A user has the install banner currently visible at the bottom of the screen and then opens the Settings sheet, which contains the section's install button: the user is shown two install affordances simultaneously. This is acceptable — both surfaces share the same `installSignal` state, so accepting one (or `appinstalled` firing) collapses both. The spec MUST ensure neither surface enters an inconsistent state where one says "installed" and the other still offers to install.
- The user taps the Settings install button on Android, the OS prompt appears, and the user backgrounds the browser without responding: when the user returns and the `userChoice` promise eventually resolves to `dismissed`, the button MUST become tappable again (no `triggerInstall`-induced lockup).
- The user is on iOS Safari, opens Settings, taps "Show how to add to Home Screen", reads the instructions, dismisses the sheet, then re-opens Settings and taps the button again: the instructional sheet MUST appear again — the iOS instructional flow is informational, not consumable, so it MUST NOT be one-shot.
- A user with system text scaling at 200% on a small notched iPhone: the safe-area offsets MUST stack with the user's text scaling without forcing horizontal scroll on either the toolbar or the Settings sheet.
- The user installs the app from the Settings sheet successfully, then closes Settings; on the next Settings open in the same browser tab (no reload), the section MUST already be in the "already installed" state (no stale "Install app" button).
- A user is on Android Chromium but `beforeinstallprompt` has not yet fired (the page just loaded; the browser is still evaluating PWA install criteria): the Settings install section MUST gracefully render the same "unsupported" hidden state until the prompt is captured, then update reactively when it fires.
- A user reorders or interacts with cache controls inside the same Settings sheet that contains the new install section: the install section's state MUST NOT depend on, or interfere with, cache operations — installation and cache management are independent concerns sharing the same surface.

## Requirements *(mandatory)*

### Functional Requirements

#### Safe-area compliance

- **FR-001**: Every persistent on-screen UI surface that touches the viewport's top edge (currently the top toolbar) MUST add an offset equal to `env(safe-area-inset-top, 0px)` to its top position so it is fully visible below the iOS notch / Dynamic Island, the Android system status bar, or any equivalent overlay region.
- **FR-002**: Every persistent on-screen UI surface that touches the viewport's bottom edge (currently the coordinate readout, the zoom controls, the attribution bar) MUST add an offset equal to `env(safe-area-inset-bottom, 0px)` to its bottom position so it sits clear of the iOS home indicator, the Android gesture-navigation region, or any equivalent overlay.
- **FR-003**: Every persistent on-screen UI surface that touches the viewport's left or right edge (currently the top toolbar's right anchoring and the map controls' right anchoring, both relevant to iPhone landscape with a side-notched edge) MUST add the corresponding `env(safe-area-inset-left, 0px)` / `env(safe-area-inset-right, 0px)` to its inline-axis offset.
- **FR-004**: Every transient on-screen UI surface (the copy toast, the layer-fail toast, the offline-ready toast, the update prompt, the install banner, the iOS install sheet) MUST inherit the same safe-area offsets as the corresponding persistent surface in the same anchor zone — i.e. transient surfaces in the bottom zone MUST clear `env(safe-area-inset-bottom)` exactly like the readout does.
- **FR-005**: The existing `viewport-fit=cover` meta declaration in `index.html` MUST be retained so the underlying map paints edge-to-edge while the controls themselves stay inside the safe area; the spec MUST NOT change to `viewport-fit=auto`.
- **FR-006**: When `env(safe-area-inset-*)` is unsupported by the browser, every offset MUST resolve to its documented `0px` fallback so the rendered layout matches the pre-feature baseline — no surface MUST collapse, jump, or gain unintended padding.
- **FR-007**: The existing `--notification-zone-top` / `--notification-zone-bottom` design tokens (introduced in feature 009) MUST continue to apply `env(safe-area-inset-*)`. This feature MUST add equivalent tokens for the toolbar zone, the bottom-anchored map controls, and the readout zone, exposed under the same `--*-zone-*` naming convention so future surfaces can reuse them without re-deriving the calculation.
- **FR-008**: The Settings sheet MUST respect `env(safe-area-inset-*)` on every edge (top, bottom, left, right), so that its scroll content stays reachable on a notched device in portrait or landscape and in PWA standalone mode.

#### On-demand install entry inside Settings

- **FR-009**: The Settings sheet MUST contain an "Install app" section with the same heading style as the existing cache section. The section's visibility and contents MUST be derived from the existing `installSignal` store's current `surface` state and `deferredPrompt` value — this feature MUST NOT introduce a parallel install-state store.
- **FR-010**: When `installSignal.surface` is `android-chromium` or `desktop-chromium` AND `deferredPrompt` is non-null, the section MUST render an enabled primary button labelled with the localised install verb. Tapping the button MUST call the same `triggerInstall()` action the transient banner uses today, with the same outcome handling (record dismissal on `dismissed`, mark installed on `appinstalled`).
- **FR-011**: When `installSignal.surface` is `ios-safari`, the section MUST render an enabled primary button labelled with a localised "Show how to add to Home Screen" verb. Tapping the button MUST display the same iOS Add-to-Home-Screen instructions (Share icon → Add to Home Screen → Add) the transient iOS install sheet shows today. The instructional view MUST be re-openable any number of times.
- **FR-012**: When `installSignal.surface` is `ios-other`, the section MUST render the existing localised "open in Safari to install" hint with no actionable button.
- **FR-013**: When `installSignal.surface` is `standalone` OR `installSignal.installed` is `true`, the section MUST render a localised "App is already installed" status line with no button or instructional view.
- **FR-014**: When `installSignal.surface` is `unsupported`, the entire section (heading, body, and any actions) MUST be hidden — the section MUST NOT render an empty heading or a disabled button.
- **FR-015**: When `installSignal.surface` is `hidden` because the user previously dismissed the transient banner (the 30-day suppression window), the Settings section MUST instead render its appropriate platform-specific state (Android / iOS / standalone / unsupported) — the transient-banner dismissal MUST NOT suppress the Settings entry.
- **FR-016**: All localised strings introduced for the Settings install section (section heading, install button label, iOS instructional button label, "already installed" status, "open in Safari" hint where it does not already exist) MUST exist in every locale catalogue the project ships (`zh`, `en`, `ja`). Where the transient install banner / sheet already has an equivalent string, the Settings section MUST reuse the existing key rather than introducing a duplicate.
- **FR-017**: The `triggerInstall()` invocation initiated from the Settings install button MUST behave identically to the transient banner's invocation — same Promise lifecycle, same outcome handling, same `installSignal` updates. The Settings section MUST disable its primary button while the OS prompt is in flight (so a double-tap cannot call `triggerInstall()` twice on the same `deferredPrompt`).
- **FR-018**: After a successful install (the OS fires `appinstalled` while the Settings sheet is open), the Settings install section MUST update reactively to the "already installed" status without requiring the sheet to be closed and reopened.

### Key Entities

- **Safe-area zone token**: A CSS custom property exposing one of the four `env(safe-area-inset-*)` values (with documented `0px` fallbacks), composed with the project's spacing tokens. Each persistent UI zone (toolbar zone, map-controls zone, readout zone, notification zone, settings-sheet zone) reads exactly one of these tokens for each of its anchored edges. Centralising the calculation prevents per-component drift and is the single source of truth for "how far in from the system edge does the app paint".
- **Settings install section**: A subsection of the Settings sheet that derives its contents from the existing `installSignal` store. It does not own install state — it is a *view* over the same state the transient banner views. Its branches by surface map directly onto the existing `InstallSurface` enum (`android-chromium`, `desktop-chromium`, `ios-safari`, `ios-other`, `standalone`, `unsupported`, `hidden`).
- **Install affordance trio**: The three currently-existing install surfaces (transient `InstallBanner` for Chromium, transient `InstallIosSheet` for iOS Safari, the new Settings install section) that all subscribe to the same `installSignal`. They MUST agree on whether the app is installable, in flight, or installed at all times — the same `triggerInstall()` / `markInstalled()` / `recordDismissal()` actions drive all three.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a representative notched-iOS device (e.g. iPhone 14 simulator) in portrait Safari, 100% of the persistent top toolbar's tap targets and 100% of the persistent bottom-edge surfaces (readout, zoom controls, attribution bar) sit fully inside the visual safe area — no overlap with the notch / Dynamic Island, no overlap with the home indicator.
- **SC-002**: On the same device in landscape Safari, 100% of the same surfaces respect the side-notch `env(safe-area-inset-left)` / `env(safe-area-inset-right)`.
- **SC-003**: On a representative edge-to-edge Android device (e.g. Pixel 7 Chrome) with gesture navigation, the same 100% safe-area compliance holds for both top and bottom surfaces.
- **SC-004**: On a desktop browser with zero safe-area insets, the rendered layout (positions, sizes, paddings) of every persistent surface matches the pre-feature baseline within 1 CSS pixel — i.e. the change is invisible on platforms that report no insets.
- **SC-005**: For 100% of supported install surfaces (`android-chromium`, `desktop-chromium`, `ios-safari`), opening Settings produces an "Install app" section whose primary action either (a) invokes the OS install prompt (Chromium) or (b) opens the documented iOS instructions, and the action completes without throwing.
- **SC-006**: For 100% of unsupported install surfaces (`unsupported` desktop browsers like desktop Firefox / desktop Safari), opening Settings produces no "Install app" section at all (no heading, no body, no hidden disabled button).
- **SC-007**: For an `ios-other` (non-Safari iOS) browser, opening Settings produces the section with the localised "open in Safari to install" hint and no actionable button, in 100% of cases.
- **SC-008**: After a successful install via the Settings button (Android / Desktop Chromium path), 100% of the install affordances (the transient banner, the Settings section, any future install surface added by this feature) update to the "already installed" state within the same browser session — no surface continues to advertise an install path post-install.
- **SC-009**: On iOS Safari, opening Settings → tapping the iOS install button → dismissing the instructional sheet → re-opening Settings and re-tapping leaves the instructional sheet re-openable in 100% of attempts (no one-shot lockout).
- **SC-010**: On Android Chromium, tapping the Settings install button, cancelling the OS prompt, and tapping again successfully re-invokes `triggerInstall()` in 100% of attempts (no `deferredPrompt`-already-consumed error).
- **SC-011**: For every locale the project ships (`zh`, `en`, `ja`), 100% of the strings rendered by the Settings install section in any of its surface-derived branches are localised (no untranslated keys, no hard-coded English fallbacks visible to the user).

## Assumptions

- "Status bar" in the user's request covers the OS-level status bar and the iOS notch / Dynamic Island at the top, and the Android system gesture region / iOS home indicator at the bottom. These are the regions exposed by the four CSS `env(safe-area-inset-*)` variables; the spec uses those variables as the canonical mechanism rather than measuring system bars in JavaScript.
- The `viewport-fit=cover` meta declaration in `index.html` is the project's documented choice — keeping it lets the map paint edge-to-edge while the safe-area-aware controls remain inside the safe area.
- Feature 009 already established the `--notification-zone-top` / `--notification-zone-bottom` tokens that consume `env(safe-area-inset-*)`. This feature follows the same pattern — adding sibling `--toolbar-zone-*`, `--map-controls-zone-*`, `--readout-zone-*`, `--settings-sheet-zone-*` tokens — rather than re-implementing the calculation per component.
- The set of persistent UI surfaces affected is the surfaces that currently use `position: absolute`/`fixed` with `top` / `bottom` / `left` / `right` anchors: the toolbar, the coordinate readout, the zoom controls + compass (the `.map-controls` group), the attribution bar, the notification region (already done), and the Settings sheet. No new surfaces are introduced by this feature.
- The `installSignal` store, the `InstallSurface` enum, the `triggerInstall()` / `markInstalled()` / `recordDismissal()` actions, and the locale strings for the transient install banner / iOS sheet (`pwa.install.android.*`, `pwa.install.ios.*`, `pwa.install.iosOther.*`) all exist today — feature 005 introduced them — and this feature MUST reuse them rather than introducing parallel state or duplicate strings.
- The Settings install section's button while a Chromium prompt is in flight MUST be visibly disabled to prevent a double-call to `prompt()` on a single `deferredPrompt`. This matches the existing transient banner's `disabled={deferredPrompt === null}` pattern; the section MUST extend it to also disable while `await triggerInstall()` is pending.
- iOS Safari does not fire `beforeinstallprompt` and never will; the on-demand iOS path is therefore an instructional view, not an OS-mediated install. This is a platform constraint, not a workaround — the spec MUST NOT promise an automatic install on iOS Safari.
- The 30-day banner-dismissal window (`DISMISSAL_WINDOW_MS` from feature 005) governs the *transient banner only*. The on-demand Settings entry MUST be exempt from that window — a user who dismissed the auto-banner is explicitly saying "stop popping up at me", not "make the install action permanently inaccessible".
- The `unsupported` install surface (e.g. desktop Firefox) is hidden, not shown as a disabled button, because rendering an action the user cannot use is a worse experience than showing no action at all. This matches the project's existing pattern from feature 005, where the transient banner is also hidden in the `unsupported` branch.
- Schema evolution rule: this feature does NOT add any new persisted preference key — install state is already persisted (or deliberately not persisted) by feature 005's `installDismissed` storage and the OS's own install registry. Settings-sheet section visibility is purely derived from the in-memory `installSignal`.

## Addendum (post-implementation, 2026-04-28)

The following requirements were added during a same-day review pass
after the original implementation landed. They share feature 011's
scope (mobile polish + safe-area discipline) and ride the same
bundle. The corresponding ADR section is `0031` § "Post-implementation
amendments" and the UI record sections are `docs/ui/0011-*` § 2a–2c.

### Additional Functional Requirements

- **FR-019**: The `.map-controls` cluster (zoom in / out + compass)
  MUST be re-anchored to the **left edge, vertically centred**
  (`left + top: 50% + translateY(-50%)`) on every viewport, not just
  narrow ones. The left offset MUST honour
  `env(safe-area-inset-left)` via `--inline-stack-zone-left`. The
  prior `right + bottom` anchoring is removed.
- **FR-020**: The `.readout` panel MUST add a `var(--space-5)`
  (≈ 20 px) lift to its `bottom` declaration in the **base** rule —
  not gated by `@media` — so the bottom-right attribution badge
  stays visually uncovered on every viewport regardless of readout
  width.
- **FR-021**: The coordinate readout MUST be collapse-toggleable on
  every viewport when `≥ 2` formats are enabled. Tap on the
  readout body inverts a component-local override flag; the flag
  resets whenever `defaultCollapsed` flips (viewport threshold
  crossed) so the user always sees the viewport's natural state on
  a fresh entry.
- **FR-022**: The default readout view-mode MUST be derived from
  `defaultCollapsed = (enabled.length ≥ 2) AND (isNarrow OR isShort)`
  where `isNarrow` is `(max-width: calc(600px - 0.02px))` and
  `isShort` is `(max-height: calc(800px - 0.02px))`. Wide+tall
  viewports default to `'expanded'`; narrow OR short viewports
  default to `'collapsed'`. `< 2` enabled formats is always
  `'expanded'` and not toggleable.
- **FR-023**: The readout's visible DOM MUST omit the
  `goto.fields.zone` segment (TWD97-TM2 zone digit) and the
  `goto.fields.precision` segment (Taipower precision digit). The
  filter is presentation-only — `coordinateSegments()` in
  `src/coord/segments.ts` MUST keep emitting the full segment list
  (Go To round-trip parity), and the copy button MUST keep emitting
  the canonical full-format string (no data loss on paste-back).

### Additional Success Criteria

- **SC-012**: On a 360 × 640 viewport with the bottom-right
  attribution rendered, the readout's bounding rectangle MUST clear
  the attribution's bounding rectangle vertically by at least
  `var(--space-5)` (≈ 20 px) — verified visually on the deploy
  preview and asserted at the source level by
  `safe-area-layout.spec.ts`.
- **SC-013**: On a viewport where `(max-width: 600 OR max-height: 800)`
  matches AND `≥ 2` formats are enabled, the readout MUST mount
  with `data-mode='collapsed'` in 100% of fresh page loads.
- **SC-014**: On a viewport where `(min-width: 600 AND min-height: 800)`
  matches AND `≥ 2` formats are enabled, the readout MUST mount
  with `data-mode='expanded'` in 100% of fresh page loads.
- **SC-015**: For TWD97-TM2 and Taipower readout rows, the rendered
  segment count MUST equal the full segment count from
  `coordinateSegments()` minus 1 (zone or precision segment hidden).

### State changes vs the original spec

- `data-mode` literal `'tap-expanded'` from feature 010 is
  **removed**. New literal set: `'collapsed'` / `'expanded'`.
- New attribute `data-toggleable` (`'true'` / `'false'`) on the
  readout `<section>` root.
- `viewport-fit=cover` declaration is preserved (FR-005, unchanged).
- One additional CSS token `--color-on-accent` (`#ffffff`) was
  introduced in `tokens.css` to satisfy feature 007's
  `settings-contrast.spec.ts` "no hard-coded colours in
  SettingsSheet" rule when the new install-button uses
  `--color-accent` as its background. Documented separately because
  the original Plan said "no new colour token" — the contrast spec
  forced the addition.
