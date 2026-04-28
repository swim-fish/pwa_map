# Feature Specification: Top-Left Map Controls + My-Location Button with Permission, Short-Tap Toggle, Long-Press Stop, and Update-Frequency Setting

**Feature Branch**: `013-locate-controls-layout`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description (combined):

1. "調整 指北針與放大縮小按鈕位置 移動到左側上方(先放指北針、定位按鈕、再放地圖縮放按鈕)" — relocate the existing on-map control cluster from the left-edge vertical centre to the upper-left, and reorder it so that compass is on top, the new my-location button sits below it, and the zoom-in / zoom-out buttons sit at the bottom of the cluster.
2. "iOS Android 等設備需要有定位的權限(如果沒有權限可以請求權限)" — the geolocation permission is requested from the device (iOS Safari, Android Chrome, desktop browsers) at the moment the user first taps the my-location button; if previously denied, surface a clear explanation and a retry path.
3. "定位模式預設(停止更新) 按下定位按鈕後啟用定位" — the app boots with location tracking OFF (no permission prompt, no marker, no GPS poll). Tracking only starts when the user taps the my-location button.
4. "定位按鈕 可以在地圖上標示出自己的位置、(在按一次 地圖中心固定在自己的位置、在按一次取消畫面固定在自己的位置)" — once active the button cycles between three states: (a) Off, (b) Show — a "you are here" marker on the map with free pan, (c) Follow — the same marker plus the map auto-recentres on every position update. A subsequent tap returns to Off.
5. "定位更新頻率可以在設定選取(智慧模式、快速更新、慢更新模式) 會記住會後的模式(停止更新<->記憶的模式)" — Settings sheet exposes three update-frequency presets (Smart / Fast / Slow). The chosen frequency is remembered across sessions; the my-location button toggles between Off and "active using the remembered frequency".
6. "可以切換到停止定位" — from any active state the user can switch back to Off via a long-press gesture or its keyboard equivalent.

## Clarifications

### Session 2026-04-28

- Q: From Off, what does the first short-tap activate to? → A: Option A — short-tap from Off transitions to Show (marker visible, map does NOT recentre). A subsequent short-tap toggles to Follow.
- Q: How does a keyboard-only user trigger Stop (long-press equivalent)? → A: Option C — `Shift+Enter` or `Shift+Space` on the focused my-location button triggers Stop. Declared via `aria-keyshortcuts` so assistive tech announces both the toggle (Enter / Space) and stop (Shift+Enter / Shift+Space) shortcuts.
- Q: If the user releases the button before the 1.5 s long-press threshold, how is it interpreted? → A: Option A — release before 1.5 s is treated as a short-tap (toggle fires); only a sustained press ≥ 1.5 s triggers Stop. OS-native long-press semantics.
- Q: When in Follow and the user manually pans the map, what should happen? → A: Option A — manual pan auto-demotes Follow to Show (FR-018 preserved); the marker keeps updating and a single short-tap restores Follow.
- Q: Should there be visual feedback during the 1.5 s long-press hold? → A: Option A — a radial progress fill animation around the button between press and 1.5 s; under `prefers-reduced-motion: reduce`, replace the animation with a static `aria-live` message ("按住停止…") and fire the same Stop after 1.5 s.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — On-map control cluster lives in the upper-left in the order compass → my-location → zoom (Priority: P1)

A returning user opens the map and immediately sees a compact vertical control cluster anchored at the upper-left corner of the map: a compass icon on top, a new "my location" icon directly below it, and the existing `+` / `−` zoom buttons at the bottom. The cluster respects the device's safe-area inset (notch, rounded corners, dynamic island, bottom home indicator) on every supported viewport and never overlaps the readout column at the bottom-right, the toolbar at the top-right, or the attribution badge.

**Why this priority**: Every other story in this feature depends on a visible home for the new my-location button. Relocating the existing compass + zoom cluster into the upper-left and inserting a new slot between compass and zoom is the geometric foundation; without it, the rest of the feature has nowhere to render. It is also the most immediately visible change for users — even before any location interaction occurs, the spatial reorganisation is observable on first paint.

**Independent Test**: Mount the app on the preview server with no saved last-view, no installed PWA prompt, and a fresh browser profile. The control cluster MUST be visible at the upper-left of the viewport, anchored below the device safe-area top inset and to the right of the safe-area left inset. Reading the cluster top-to-bottom MUST yield: compass, my-location, zoom-in, zoom-out. The cluster MUST NOT overlap the existing top-right toolbar (Settings / Go-To buttons), the bottom-right coordinate readout, the attribution badge, the install banner (if visible), or the update prompt (if visible). Resize to a 320 px × 568 px portrait viewport and re-check; rotate to landscape (568 px × 320 px) and re-check; switch to a 1440 px desktop viewport and re-check.

**Acceptance Scenarios**:

1. **Given** a fresh app load on a 390 px × 844 px iPhone-class viewport with simulated 47 px top safe-area inset and 0 px left inset, **When** the page paints, **Then** the control cluster's outer top edge MUST sit at exactly `var(--space-3) + 47 px` from the viewport top, the cluster's outer left edge MUST sit at `var(--space-3) + 0 px` from the viewport left, and the four icons MUST appear in the order compass → my-location → zoom-in → zoom-out reading top-to-bottom with `var(--space-2)` (≈ 8 px) gaps between adjacent icons.
2. **Given** a 1440 px × 900 px desktop viewport with no safe-area insets, **When** the page paints, **Then** the cluster MUST anchor at `var(--space-3)` from the top and `var(--space-3)` from the left, and the right edge of the cluster MUST be at least `var(--space-4)` away from any other interactive element.
3. **Given** any supported viewport, **When** the install banner / update prompt / offline-ready toast become visible at the top of the notification region, **Then** the control cluster MUST NOT overlap them (the notification region remains the topmost notification-level surface; the cluster sits below it, the existing top-stack safe-area accounting is preserved).
4. **Given** a 320 px × 568 px small-phone viewport, **When** the user pans the map, **Then** the cluster MUST remain fully on-screen, every icon MUST remain at least `var(--tap-min)` (≈ 44 px) tall, and the cluster's right edge MUST NOT cross the viewport horizontal midpoint.

---

### User Story 2 — First-time user requests geolocation permission via the my-location button (Priority: P1)

A user taps the new my-location button for the first time on iOS Safari (or Android Chrome, or a desktop browser). The app has NOT requested geolocation permission previously. The browser's native permission prompt appears as a direct response to the tap. If the user grants permission, a "you are here" marker appears at the user's current position within a few seconds and the button enters the Show state. If the user denies permission, a transient notification (in the existing notification region) explains in zh that location access is unavailable and points the user to the device settings; the button returns to Off and remains tappable for a future retry.

**Why this priority**: The permission request is the gate to every other location-related capability — Show, Follow, frequency selection. iOS Safari in particular requires the geolocation API to be invoked synchronously inside the user-gesture handler of the click, so getting this flow correct on the first attempt determines whether the rest of the feature is reachable at all. Defaulting to Off (no permission prompt on load) is also explicit user intent: do not surprise users with a permission dialog they did not invite.

**Independent Test**: With a fresh browser profile (no stored permission), load the app on iOS Safari 17+, Android Chrome 120+, and desktop Chrome / Firefox / Safari. The my-location button MUST be visible and interactive. The page MUST NOT have triggered any geolocation API call before the first tap (verified by `navigator.permissions.query({ name: 'geolocation' })` returning `prompt`, and by no permission UI appearing). Tap the button: the browser's native permission prompt MUST appear within the same gesture turn. Grant permission: a position marker MUST appear within 5 seconds of grant on a network-permitting environment, and the button MUST visually transition to Show. Reload the page with a fresh profile, tap, deny: a zh-language toast MUST appear in the notification region explaining the situation; the button MUST return to Off; tapping again MUST re-trigger the prompt (or, on browsers that suppress repeat prompts, surface a "open device settings" hint instead).

**Acceptance Scenarios**:

1. **Given** a fresh browser profile with geolocation permission state `prompt`, **When** the user taps the my-location button, **Then** the browser's native geolocation permission prompt MUST appear, AND the geolocation API MUST be invoked from inside the same user-gesture turn (so iOS Safari does not silently drop the request).
2. **Given** the user just granted permission, **When** the device returns its first position fix, **Then** a "you are here" marker MUST render on the map at that position within 5 seconds, AND the button MUST visually indicate the Show state (distinct from Off and Follow).
3. **Given** the user denies the permission prompt, **When** the prompt closes, **Then** a zh-language notification MUST explain the denial and point to device settings, AND the button MUST return to its Off visual, AND no marker MUST be drawn.
4. **Given** the browser permission state is already `denied` from a prior session, **When** the user taps the button, **Then** the app MUST NOT silently fail: it MUST surface the same explanatory zh notification and offer the same device-settings hint without freezing the button.
5. **Given** the geolocation API is unavailable (e.g., insecure HTTP context, very old browser), **When** the user taps the button, **Then** a zh notification MUST explain that location is unavailable for this environment, AND the button MUST visually disable itself for the remainder of the session.

---

### User Story 3 — States and gesture model: short-tap toggles Show ↔ Follow, long-press 1.5 s stops (Priority: P1)

Once the user has granted permission, the my-location button drives three visually distinct states via two distinct gestures — a short-tap and a press-and-hold — instead of a single-gesture cycle:

- **Off** — no marker; the geolocation watcher is stopped; no battery / network cost.
- **Show** — a marker is drawn at the user's reported position; the marker updates as new positions arrive at the configured frequency; the user is free to pan / zoom / rotate the map without the map jumping back.
- **Follow** — same marker plus the map auto-recentres on every new position update so the marker stays in the viewport's geometric centre. If the user manually pans the map (or initiates a pan-class gesture), the state auto-demotes from Follow to Show (the marker keeps updating, but the map stops chasing).

Gesture model:

- **Short-tap** (touch / mouse / `Enter` / `Space`):
  - From Off → Show (granting permission first if `prompt`).
  - From Show → Follow (the map animate-recentres immediately).
  - From Follow → Show (the map stays put; the marker keeps updating).
- **Long-press ≥ 1.5 s** (touch / mouse hold) and the keyboard equivalent **`Shift+Enter` / `Shift+Space`** while the button is focused:
  - From Show or Follow → Off (the watcher stops, the marker is cleared).
  - From Off → no-op (Stop has no meaning when nothing is running).
- **Release before the 1.5 s threshold** is treated as a short-tap (OS-native long-press semantics; the toggle fires).
- **Long-press visual feedback**: a radial progress fill animates around the button between press and 1.5 s. Under `prefers-reduced-motion: reduce`, the animation is replaced with a static `aria-live` message ("按住停止…") and the same Stop fires after 1.5 s.

The button's visual state MUST be unambiguous to a user with normal vision in good lighting and to an assistive-tech user. The `aria-keyshortcuts` attribute MUST advertise both the toggle keys and the Stop keys.

**Why this priority**: This is the core interaction model that distinguishes "show me where I am" from "keep me centred", and separates the destructive "stop tracking" action onto a deliberately distinct gesture so a stray short-tap does not silently kill the watcher. Without all three states (and a way to reach each one without surprises) the feature is reduced to a single-shot location pin and most of its value evaporates.

**Independent Test**: With permission granted in the testing profile, mount the app and exercise the gestures: short-tap once (Off → Show), verify the marker appears and the map does NOT jump; pan the map by 200 px and verify the marker stays at its geographic position (the map content moves, the marker stays attached to its lat/lon); short-tap again (Show → Follow), verify the map smoothly recentres so the marker is at the geometric centre, and as new positions arrive the map keeps following; pan the map by 200 px manually, verify the state auto-demotes to Show (the map stops chasing, the marker stays at its lat/lon and continues updating); short-tap again (Show → Follow), then long-press the button for 1.5 s with the radial progress visible, verify on release that the marker disappears, no further position updates are processed, and the button returns to Off. Repeat the long-press case while in Show. Verify that a press released at ≈ 0.8 s is treated as a short-tap (toggle). Verify keyboard: focus the button, press `Enter` to toggle, press `Shift+Enter` to Stop. Verify under simulated `prefers-reduced-motion: reduce` that the radial progress is replaced with a polite live-region announcement and the Stop still fires after 1.5 s.

**Acceptance Scenarios**:

1. **Given** the button is in Off and permission is already granted, **When** the user short-taps the button, **Then** the watcher MUST start, the first position MUST render as a marker within the configured frequency's tolerance, the button MUST visually indicate Show, AND the map MUST NOT recentre.
2. **Given** the button is in Show, **When** the user short-taps the button, **Then** the map MUST animate-recentre on the current position, the button MUST visually indicate Follow, AND every subsequent position update MUST recentre the map.
3. **Given** the button is in Follow, **When** the user short-taps the button, **Then** the map MUST stop chasing the marker, the watcher MUST keep running, the marker MUST keep updating, AND the button MUST return to its Show visual.
4. **Given** the button is in Show or Follow, **When** the user presses and holds the button continuously for ≥ 1.5 s, **Then** the watcher MUST stop on release, the marker MUST disappear, the map's pan / zoom / bearing MUST remain at their current values (no surprise reset), AND the button MUST return to Off.
5. **Given** the button is in Show or Follow, **When** the user begins a press but releases at any time before 1.5 s, **Then** the gesture MUST be treated as a short-tap (toggle Show ↔ Follow) AND no Stop MUST fire.
6. **Given** the button is in Off, **When** the user presses and holds for ≥ 1.5 s, **Then** the press MUST be a no-op (no permission prompt, no state change), AND any progress visual MUST NOT mislead the user into thinking Stop will fire.
7. **Given** the button is in Follow, **When** the user manually pans the map (drag, swipe, or arrow-key pan), **Then** the state MUST auto-demote to Show (marker continues updating, map stops chasing) WITHOUT requiring a gesture on the button.
8. **Given** any state, **When** the user activates the button with keyboard `Enter` or `Space`, **Then** the same short-tap behaviour from the corresponding state MUST apply.
9. **Given** the button is in Show or Follow and has keyboard focus, **When** the user presses `Shift+Enter` or `Shift+Space`, **Then** Stop MUST fire (equivalent to long-press), AND `aria-keyshortcuts` MUST advertise this shortcut alongside the toggle keys so screen readers announce both.
10. **Given** the user is mid-press at ≈ 0.7 s under default motion preferences, **When** the press is ongoing, **Then** a radial progress fill MUST be visible on the button at ≈ 47 % completion, AND the visual MUST disappear smoothly on release-before-threshold without firing Stop.
11. **Given** `prefers-reduced-motion: reduce`, **When** the user begins a press, **Then** the radial progress animation MUST be replaced with a polite `aria-live` announcement ("按住停止…"), AND the same 1.5 s threshold MUST trigger Stop.
12. **Given** any state, **When** the button is rendered, **Then** its accessible name in zh MUST clearly distinguish the three states (e.g., "啟用定位", "定位中（顯示）", "定位中（跟隨）") so screen-reader users can identify the current state.

---

### User Story 4 — Update-frequency preset persists across sessions and toggles via the locate button (Priority: P2)

A user opens Settings and sees a new "定位更新頻率" (Location update frequency) section with three radio-group options: 智慧模式 (Smart, default), 快速更新 (Fast), 慢更新 (Slow). The choice is persisted across reloads and PWA relaunches. The my-location button respects the chosen preset whenever it transitions from Off to active: Smart adapts to motion (frequent updates while moving, sparse while stationary), Fast favours accuracy and recency (frequent updates regardless), Slow favours battery and minimises updates. Switching between Off and active via the my-location button uses the most recently chosen preset (the "remembered mode"); Settings does NOT contain a "Stopped" radio because Stopped is exclusively the my-location button's responsibility.

**Why this priority**: The frequency presets unlock the feature for the two extreme cases — a user who needs high-fidelity tracking during active navigation (Fast) and a user on low-battery / low-bandwidth conditions who wants the marker without the cost (Slow). They do not block P1's core value (a default Smart preset is sensible), so they are P2: ship after the gesture model is solid, then expose the knobs.

**Independent Test**: With permission granted, set the my-location button to Show and confirm position updates arrive at the Smart cadence (verifiable via the test hook that timestamps each update). Open Settings, switch to Fast, close Settings, and confirm subsequent updates arrive at the Fast cadence within one cycle. Tap the my-location button to Off, then tap again: position updates MUST resume at Fast (the most-recent preset). Reload the page; the persisted Fast preset MUST still be in effect on the next activation. Switch to Slow, repeat the verification. Switch back to Smart and confirm adaptive behaviour resumes.

**Acceptance Scenarios**:

1. **Given** the user has never opened Settings, **When** the user taps the my-location button to Show, **Then** the watcher MUST run at the Smart preset's cadence (the documented default).
2. **Given** the user has switched the preset to Fast in Settings, **When** the user activates the button (Off → Show), **Then** the watcher MUST run at the Fast preset's cadence and persist this choice across reloads.
3. **Given** the user has switched the preset to Slow, **When** the user activates the button, **Then** the watcher MUST run at the Slow preset's cadence and persist this choice across reloads.
4. **Given** the user changes the preset while the button is in Show or Follow, **When** the new preset is selected, **Then** the change MUST take effect within one update cycle (no need to toggle Off and back On).
5. **Given** any persisted preset, **When** the user uninstalls and reinstalls the PWA, **Then** the persisted preset MUST survive (it is stored in the same persistence layer that already keeps last-view, locale, and tile-cache settings).
6. **Given** the persistence layer fails to read the preset (corrupt storage, fresh profile), **When** the app loads, **Then** the app MUST fall back to Smart and behave as if the preset had never been set.

---

### Edge Cases

- **Permission revoked mid-session** — User grants permission, activates Show or Follow, then revokes permission via OS settings. The next position-update callback fails with `PERMISSION_DENIED`. The app MUST stop the watcher, demote the button to Off, and surface a zh notification explaining the change. No further updates are attempted until the user taps again.
- **Position-unavailable error** (`POSITION_UNAVAILABLE`) — Indoor environment, GPS not yet locked, or hardware failure. The watcher MUST continue (per browser semantics this is recoverable), but the marker MUST NOT update with a stale fix. After a presets-specific timeout (Smart / Fast: 30 s; Slow: 90 s) without a new fix, surface a zh notification ("定位中… 仍未取得位置") and let the user choose to keep waiting or long-press the button (or `Shift+Enter` / `Shift+Space`) to reach Off.
- **Timeout error** (`TIMEOUT`) — Same handling as `POSITION_UNAVAILABLE` but logged separately so the diagnostic toast can distinguish them in dev tools.
- **HTTP (non-secure) context** — Geolocation API is unavailable. The button MUST be visually disabled at first paint (not just on tap) and its accessible name MUST explain why in zh.
- **Reload with active state** — After a reload, the my-location button MUST default to Off regardless of whether it was Show or Follow before reload. (Persisting the active state would let the page silently re-trigger the watcher on every load, which violates the "default off" contract from input #3 and on iOS Safari would also fail because there is no user gesture during page load.)
- **Switching basemap or locale while active** — The marker's geographic coordinate is independent of the basemap; switching layers MUST NOT reset the marker. Switching locale MUST update any zh / en accessible names without dropping the watcher.
- **Reduced motion** — In Follow mode, the recentre animation MUST honour `prefers-reduced-motion: reduce` (use `setCenter` instead of `easeTo`). The marker's "pulse" decoration (if present) MUST also be disabled under reduced motion.
- **Bearing rotation while in Follow** — The marker is geographically anchored, so map bearing rotation moves the marker around the screen following the rotation; the map continues to recentre on the marker's current geographic position. The marker's symbol MUST NOT itself rotate with bearing (it is not a heading indicator; this feature does not render device heading).
- **Marker accuracy radius** — Browsers report an accuracy radius alongside the position. The marker MAY render this radius as a faint circle to communicate uncertainty; this is a quality-of-life polish, not a hard requirement.
- **Settings sheet open while button is tapped** — These two surfaces are independent; the button remains interactive while Settings is open (the user can change frequency mid-flight per FR-021).
- **Coordinate readout interaction** — The new my-location marker MUST NOT interfere with the centre-crosshair coordinate readout. The readout continues to display the lat/lon under the visual centre crosshair, NOT the user's position. (The user's position is shown by the marker; the readout is shown by the crosshair. Two distinct affordances, deliberately not merged.)
- **Cluster + portrait safe-area collision on small phones** — On a 320 px × 568 px portrait viewport with a 47 px top safe-area inset, the cluster's outer top edge sits at ≈ 59 px from the viewport top, leaving the bottom 509 px usable for map gestures. No cluster icon MAY exceed `var(--tap-min)` (≈ 44 px) tall, so the cluster's full height stays under ≈ 200 px and the bottom of the cluster sits at ≈ 259 px from the viewport top — well clear of the bottom-anchored readout.
- **Long-press release before 1.5 s threshold** — A press released at any time before 1.5 s is treated as a short-tap (FR-014c); the toggle from FR-014a fires on release. Any in-progress radial fill animation MUST disappear smoothly without firing Stop, and any `aria-live` "按住停止…" announcement under reduced motion MUST be cleared so the screen reader does not falsely imply that Stop occurred.
- **Press cancelled by gesture interrupt** — If the user begins a press on the button but then drags off the button (touch slide), or the page loses focus, or another input cancels the press (e.g., pointer cancel from a system event), the press MUST be cancelled exactly as if the user had released early: no Stop fires, no toggle fires, the progress visual disappears.
- **Long-press while in Off** — A press held ≥ 1.5 s while the button is in Off MUST be a no-op; per FR-014g the radial progress visual MUST NOT render in this state, so the user is not misled into expecting Stop to fire.
- **Concurrent gesture during long-press** — If a position update arrives, a settings change is committed, or the basemap switches mid-press, the press MUST continue uninterrupted; only an explicit press release or a cancellation event ends it.

## Requirements *(mandatory)*

### Functional Requirements

#### Layout (FR-001 — FR-008)

- **FR-001**: The on-map control cluster MUST be anchored at the upper-left of the map viewport.
- **FR-002**: The cluster MUST contain four controls in this top-to-bottom order: compass, my-location, zoom-in (`+`), zoom-out (`−`).
- **FR-003**: The cluster's left edge MUST compose `var(--space-3)` with `var(--inline-stack-zone-left)` via `calc(...)` (per the project's safe-area token rule), and its top edge MUST compose `var(--space-3)` with `var(--top-stack-zone-top)`.
- **FR-004**: The cluster MUST NOT overlap the top-right toolbar (Settings / Go-To buttons), the bottom-right coordinate readout, the attribution badge, the install banner, or the update prompt on any supported viewport.
- **FR-005**: Each icon in the cluster MUST be at least `var(--tap-min)` (≈ 44 px) tall and wide.
- **FR-006**: Adjacent icons MUST be separated by `var(--space-2)` (≈ 8 px) gaps.
- **FR-007**: The cluster MUST remain fully on-screen on a 320 px × 568 px portrait viewport and a 568 px × 320 px landscape viewport.
- **FR-008**: The cluster MUST NOT use the device safe-area inset env() function directly — only via the shared `--*-stack-zone-*` tokens.

#### Permission flow (FR-009 — FR-013)

- **FR-009**: The app MUST NOT call `navigator.geolocation.getCurrentPosition`, `navigator.geolocation.watchPosition`, or any other geolocation API at page load. The first such call MUST be triggered by the user's tap on the my-location button.
- **FR-010**: The geolocation API call MUST be invoked synchronously inside the same user-gesture handler as the tap, so iOS Safari does not silently drop the request.
- **FR-011**: When the user denies the permission prompt, the app MUST surface a zh-language notification in the existing notification region explaining the denial and pointing to device settings.
- **FR-012**: When the browser permission state is already `denied` from a prior session, tapping the button MUST surface the same explanatory notification without invoking the geolocation API (which would silently fail).
- **FR-013**: When the geolocation API is unavailable (insecure context, very old browser), the my-location button MUST render in a visually disabled state at first paint, with a zh accessible name explaining why.

#### States and gesture model (FR-014 — FR-020)

- **FR-014**: The my-location button MUST expose three states (Off, Show, Follow) reachable via the gestures defined in FR-014a–FR-014h; no single gesture MUST cycle through all three.
- **FR-014a**: A short-tap (touch / mouse / keyboard `Enter` / `Space`) on the button MUST transition: Off → Show; Show → Follow; Follow → Show.
- **FR-014b**: A press-and-hold (touch / mouse) sustained for ≥ 1.5 s MUST transition: Show → Off; Follow → Off; Off → no-op.
- **FR-014c**: A press released before 1.5 s MUST be treated as a short-tap (FR-014a applies); Stop MUST NOT fire on early release.
- **FR-014d**: While the button has keyboard focus, `Shift+Enter` or `Shift+Space` MUST fire Stop (semantically equivalent to a completed long-press); the `aria-keyshortcuts` attribute MUST advertise both the toggle keys (Enter / Space) and the Stop keys (Shift+Enter / Shift+Space).
- **FR-014e**: During a press (between press-down and 1.5 s), a radial progress fill animation MUST be visible on the button under default motion preferences. Under `prefers-reduced-motion: reduce`, the animation MUST be replaced with a polite `aria-live` announcement ("按住停止…"); the same 1.5 s threshold MUST still trigger Stop.
- **FR-014f**: The first short-tap from Off MUST transition to Show (NOT directly to Follow), so that the first geolocation fix appears without a surprise camera move.
- **FR-014g**: A long-press from Off MUST be a no-op; any progress visual MUST be suppressed in this state to avoid implying that Stop will fire.
- **FR-014h**: All three states MUST be reachable from any other state in at most two consecutive gestures (Off → Show via short-tap; Show → Follow via short-tap; Follow → Show via short-tap; Show → Off via long-press; Follow → Off via long-press; Off → Follow via short-tap then short-tap).
- **FR-015**: In Off, no geolocation watcher MUST be running and no marker MUST be rendered.
- **FR-016**: In Show, a marker MUST be rendered at the user's current position and updated as new positions arrive at the configured frequency; the map MUST NOT auto-recentre.
- **FR-017**: In Follow, the marker MUST be rendered AND the map MUST auto-recentre on every new position update, with the recentre animation honouring `prefers-reduced-motion`.
- **FR-018**: When the user manually pans the map while in Follow, the state MUST automatically demote to Show (no explicit gesture on the button required); the marker MUST keep updating.
- **FR-019**: The button's visual state MUST be unambiguously distinguishable across Off, Show, and Follow (icon shape change, fill state, halo, or equivalent treatment) to a user with normal vision in good lighting.
- **FR-020**: The button's accessible name in zh MUST distinguish the three states for screen-reader users.

#### Update-frequency preset (FR-021 — FR-026)

- **FR-021**: Settings sheet MUST expose a "定位更新頻率" section with three options: 智慧模式 (Smart, default), 快速更新 (Fast), 慢更新 (Slow).
- **FR-022**: The chosen preset MUST persist across reloads and PWA relaunches via the same persistence layer used for last-view, locale, and tile-cache settings.
- **FR-023**: The default preset MUST be Smart.
- **FR-024**: When the my-location button transitions from Off to Show, the watcher MUST start using the currently-persisted preset.
- **FR-025**: When the user changes the preset while the button is in Show or Follow, the change MUST take effect within one update cycle without requiring the user to toggle Off and back On.
- **FR-026**: When the persistence layer cannot read the preset (corrupt storage, fresh profile), the app MUST fall back to Smart silently.

#### Stop semantics (FR-027 — FR-029)

- **FR-027**: From any active state (Show or Follow), Off MUST always be reachable via either a press-and-hold ≥ 1.5 s or the keyboard `Shift+Enter` / `Shift+Space` shortcut (no dead-end state); short-tap alone MUST NOT reach Off (it only toggles between Show and Follow).
- **FR-028**: After a reload, the my-location button MUST default to Off regardless of the prior session's state.
- **FR-029**: When permission is revoked mid-session (OS-level), the watcher MUST stop on the next failing callback, the button MUST demote to Off, and a zh notification MUST surface in the notification region.

### Key Entities

- **Location tracking state** — The runtime state of the my-location feature. Attributes: state (Off / Show / Follow), permission state (`prompt` / `granted` / `denied` / `unavailable`), last known position (lat / lon / accuracy / timestamp), in-progress press start timestamp (for the long-press 1.5 s detector; null when no press is active). Lives in component-local Svelte stores; not persisted (per FR-028).
- **Update-frequency preset** — The persisted user choice among Smart / Fast / Slow. Stored in the existing persistence layer alongside last-view, locale, and tile-cache settings. Default Smart.
- **Position fix** — A single result from `navigator.geolocation.watchPosition`. Attributes: lat, lon, accuracy radius (m), timestamp, optional heading / speed (unused in this feature).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On every supported viewport (320 px portrait minimum to 1440 px desktop maximum), the upper-left control cluster is fully on-screen, never overlaps another fixed surface, and its four icons appear in the order compass → my-location → zoom-in → zoom-out.
- **SC-002**: The first position fix renders within 5 seconds of the user granting permission on a network-permitting environment.
- **SC-003**: 100 % of supported browser/OS combinations (iOS Safari 17+, Android Chrome 120+, desktop Chrome / Firefox / Safari) trigger the native permission prompt synchronously inside the user-gesture handler of the first tap.
- **SC-004**: A user can reach every state pair within at most two consecutive gestures: short-tap toggles Show ↔ Follow with the visual state correct within 100 ms of release; press-and-hold ≥ 1.5 s (or `Shift+Enter` / `Shift+Space` while focused) reaches Off from any active state with the marker cleared and the watcher stopped within 100 ms of the threshold.
- **SC-005**: A change to the update-frequency preset takes effect within one update cycle (≤ 1 s for Fast, ≤ 5 s for Smart-while-moving, ≤ 15 s for Slow).
- **SC-006**: The persisted update-frequency preset survives PWA reinstall and browser-profile-level state preservation (verified by reload cycle tests).
- **SC-007**: Bundle size delta for this feature (gzipped JS) is under +6 KB per the project's bundle budget; the plan-level target SHOULD be tighter (≤ +3 KB) and any overshoot MUST be documented in the plan's Complexity Tracking before merge.
- **SC-008**: After a permission denial, a fresh tap re-triggers the explanatory zh notification within 100 ms and never silently fails.

## Assumptions

- **Gesture model is short-tap toggle + long-press stop** (per Clarifications 2026-04-28 Q1–Q3, Q5). Short-tap toggles Show ↔ Follow with first-tap-from-Off going to Show; press-and-hold ≥ 1.5 s reaches Off from any active state; release before 1.5 s is OS-native short-tap. The earlier draft assumption of a 3-tap cycle Off → Show → Follow → Off has been replaced.
- **Manual pan in Follow demotes to Show, not Off** (per Clarifications 2026-04-28 Q4). Demoting straight to Off would feel destructive (the user just wanted to look around, not stop tracking). Demoting to Show preserves the watcher and lets a single subsequent short-tap resume Follow.
- **Keyboard equivalents are explicit shortcuts, not held keys** (per Clarifications 2026-04-28 Q2). `Shift+Enter` / `Shift+Space` reach Off; `Enter` / `Space` toggle. KeyboardEvent.repeat-based "hold a key" timing is unreliable across browsers and is deliberately avoided.
- **Reload returns to Off**. Per FR-028, no auto-resume; the user must re-tap. This protects iOS Safari (which would silently fail to start the watcher without a user gesture) and matches the "default off" contract the user explicitly stated.
- **Smart preset is the default** for the update-frequency setting. Smart is the most sensible default for the broadest audience; users who need extreme accuracy or extreme battery savings opt in.
- **Smart / Fast / Slow are presets, not user-tunable parameters**. The exact internal cadence numbers (intervals, accuracy thresholds) are an implementation concern of `/speckit.plan`; this spec only contracts the user-visible behaviour: Fast updates feel "live", Slow updates feel "every 10–15 seconds", Smart adapts to whether the device is moving.
- **No on-screen heading indicator in this feature**. The marker is a position dot, not a directional cone. Device heading is a separate (future) capability orthogonal to this feature.
- **No marker accuracy circle by default**. The browser-reported accuracy radius MAY be rendered as a faint circle later (quality-of-life polish), but it is NOT in this feature's requirements.
- **Notification region reuse**. Permission denial / unavailable / timeout messages reuse the existing `NotificationRegion.svelte` component — no new toast system is introduced.
- **Settings persistence reuse**. The frequency preset uses the same persistence pathway already used for last-view, locale, and tile-cache settings — no new storage layer.
- **zh is the canonical locale identifier** for Traditional Chinese strings (Constitution v1.1.0). All accessible names, notification copy, and Settings labels follow this convention; en strings are added in parallel where the existing locale system already exposes both.
- **The compass + zoom controls' existing behaviours are unchanged** — only their position in the cluster moves. Zoom continues to anchor on the centre crosshair (per feature 006); compass continues to reset bearing to 0° on tap (per feature 006).
