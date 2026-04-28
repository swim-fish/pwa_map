# Quickstart — 013-locate-controls-layout

A 15-minute manual verification walkthrough. Use this after
`/speckit.implement` lands and before opening the PR. Covers all
four user stories on three browsers / OS combinations.

## Prerequisites

- `npm install` (no new deps for this feature; install ensures
  the lockfile is in place).
- `npm run dev` — local Vite dev server at `http://localhost:5173`.
- A device or simulator for each platform you want to verify:
  iOS Safari ≥ 17 (real device or Xcode iOS Simulator), Android
  Chrome ≥ 120 (Android Studio emulator or real device with USB
  debugging), desktop Chrome / Firefox / Safari.
- A test profile with a clean `localStorage` (Application →
  Storage → Clear in DevTools, or a private window).

## US1 — Top-left cluster relocation (≈ 2 min)

1. Open `http://localhost:5173/` in desktop Chrome at 1440 × 900.
2. The control cluster MUST be visible at the upper-left corner.
   Reading top-to-bottom: compass (circle with N), my-location
   (a target / crosshair-style icon), zoom-in (`+`), zoom-out
   (`−`).
3. Inspect the cluster element in DevTools. Its computed `top`
   MUST be `12px` (`var(--space-3)` evaluates to 12 with no
   safe-area inset). `left` MUST also be `12px`.
4. Resize the viewport to 320 × 568 (small phone). Cluster MUST
   stay at the top-left and never overlap the bottom-right
   coordinate readout. Toolbar (Settings / Go-To buttons) MUST
   remain at the top-right with at least `var(--space-4)` (≈ 16
   px) horizontal gap from the cluster.
5. Open `Application → Manifest`, install the PWA. Launch the
   PWA window. Re-verify the cluster is at the upper-left
   inside the standalone window — the safe-area inset
   composition automatically accounts for any window-chrome
   inset.

## US2 — Permission flow on first short-tap (≈ 4 min)

Use a fresh browser profile (the geolocation permission MUST
start in `prompt` state).

1. Open the app. The my-location button MUST be visible and
   enabled. **No permission prompt MUST have appeared yet.**
2. Open DevTools console. Run
   `navigator.permissions.query({ name: 'geolocation' })
     .then(p => console.log(p.state))`.
   It MUST print `"prompt"` (NOT `"granted"` or `"denied"`).
3. Tap the my-location button (single short-tap).
4. The browser's native permission prompt MUST appear within
   the same gesture turn (no perceptible delay; the prompt is
   the first thing that happens after the tap).
5. Grant permission. Within 5 seconds a "you are here" marker
   MUST appear on the map. The button MUST visually indicate
   Show (distinct from Off — different fill / colour / icon
   pose).
6. Reload. Repeat steps 1–4 but DENY permission. A zh
   notification MUST appear in the notification region
   explaining the denial; the button MUST visually return to
   Off (NOT a "permanently disabled" visual).
7. With permission denied, tap the button again. A toast MUST
   re-appear with the same denial message. The button MUST
   stay Off.

## US3 — Gesture model (≈ 5 min)

With permission granted from US2:

### Short-tap toggles Show ↔ Follow

1. With state Off, tap once. State → Show. A marker appears.
   Manually pan the map by 200 px — the marker MUST stay
   attached to its lat/lon (the map content moves under it,
   the marker does not chase).
2. Tap again. State → Follow. The map MUST smoothly recentre
   on the marker. Wait for a fresh fix (~5 s on Smart) — the
   map MUST recentre again.
3. Tap a third time. State → Show (NOT Off). Marker still
   updates; map stops chasing.

### Long-press from active → Off

4. Tap once to enter Show. Now press and hold the my-location
   button for **at least 1.5 seconds**. A radial progress fill
   MUST animate around the button between press and 1.5 s.
   On release after threshold, state → Off; marker disappears;
   the watcher stops (verify via DevTools network panel — no
   more position fixes).
5. Tap once to re-enter Show. Press and hold for ~1.0 s, then
   release before the threshold. State MUST toggle to Follow
   (short-tap behaviour, NOT Off). The radial fill MUST clear
   smoothly without "snapping back" to 0%.

### Long-press from Off — no-op

6. With state Off, press and hold for 2 s. Nothing MUST
   happen — no permission prompt, no state change, no radial
   fill. Releasing the press MUST also be a no-op.

### Manual pan in Follow

7. Tap to enter Show; tap to enter Follow; verify map auto-
   recentres on the next fix. Now manually pan the map by 200
   px. State MUST demote to Show automatically (no button tap
   required). Marker continues updating; map stops chasing.

### Keyboard shortcuts

8. Click outside the map; press `Tab` until the my-location
   button is focused (visible focus ring). Press `Enter` —
   state MUST toggle (Off → Show → Follow → Show as in steps
   1–3). Press `Space` — same toggle.
9. While in Show or Follow, press `Shift+Enter`. State → Off.
   Press `Shift+Space` from Show — same.
10. From Off, press `Shift+Enter` — no-op (matches FR-014g).

### Reduced-motion fallback

11. macOS: System Settings → Accessibility → Display → Reduce
    motion = ON. Reload the page. Tap to Show, then press and
    hold the my-location button. The radial progress fill
    MUST NOT animate (no visible progress ring). With
    DevTools Accessibility tree open, the aria-live region
    MUST receive the text "按住停止…" on press and clear on
    release. After 1.5 s held, Stop fires.

## US4 — Update-frequency preset (≈ 3 min)

1. Open Settings (top-right). Scroll to the new
   "定位更新頻率" (Location update frequency) section.
2. Three radios: 智慧模式 (selected by default), 快速更新,
   慢更新.
3. Switch to 快速更新. Close Settings. Tap to enter Show. In
   DevTools network / sensors panel, position fixes MUST
   arrive at ≤ 1 s cadence.
4. Re-open Settings; switch to 慢更新. Close. Position fixes
   MUST drop to ≤ 1 fix per 10–15 s.
5. Reload the page. Open Settings; the 慢更新 radio MUST still
   be selected (persisted).
6. Tap the my-location button. The watcher MUST start using
   the persisted (Slow) preset, not the default Smart.
7. With state Show, open Settings; switch to 智慧模式; close.
   Within one update cycle the cadence MUST adapt.

## Mobile-specific verification (≈ 1 min)

On iOS Safari ≥ 17:

1. Open the deployed app or `http://<dev-ip>:5173/` from the
   phone (iOS Safari requires a secure context — use
   `https://`).
2. Verify US2 — permission prompt is iOS Safari's native
   sheet ("Allow … to use your location?"). Granting MUST
   render the marker.
3. Verify US3 long-press — touch and hold for 1.5 s; the
   radial fill MUST animate and Stop fires on release. Verify
   that iOS does NOT show the text-selection handle / context
   menu during the press (the `event.preventDefault()` in
   `pointerdown` plus `user-select: none` MUST suppress it).

On Android Chrome 120+:

1. Same steps as iOS.
2. Verify the cluster sits at the upper-left honouring the
   notch / dynamic-island simulator inset (Pixel 7 Pro emulator).

## Pass criteria

All 4 user stories' acceptance scenarios pass on:

- desktop Chrome 130+
- desktop Firefox 125+ (skip iOS-Safari-specific assertions)
- desktop Safari 17+ (skip iOS-Safari-specific assertions)
- iOS Safari ≥ 17
- Android Chrome ≥ 120

If any browser fails an acceptance scenario, file a bug-fix
commit under the same feature branch with:

1. A failing regression test that reproduces the bug on the
   pre-fix code.
2. The fix.
3. A note in `docs/ui/0013-locate-controls-layout.md` if the
   visible behaviour changed.
