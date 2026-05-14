# Quickstart — 014-smart-promote-cadence

Eight-minute manual verification walk-through. Covers the Smart
preset's promote-on-movement burst on three reference platforms.

## Prerequisites

- Phone or laptop with a working GPS/Wi-Fi-position fix.
- Build deployed to a HTTPS origin (the geolocation API requires
  a secure context). Locally: `npm run dev` is served from
  `http://localhost:5173/pwa_map/` — geolocation works on
  `localhost` even over HTTP.
- The Smart preset is the default; if you previously changed it,
  reset via Settings → Locate frequency → Smart.

## Platform A — Android Chromium (any 120+ build)

1. Open the deployed PWA in Chrome on Android.
2. Open DevTools (remote-debug from desktop Chrome).
3. In DevTools console, run:
   ```js
   window.__locateController?.start?.('smart');
   ```
   (or just tap the my-location button if exposed) and grant the
   permission prompt.
4. Verify: the on-screen position dot appears within ~5 s.
5. Walk at normal pace for ~15 s. **Expected**: the dot updates
   within ≤ 5 s of starting to walk, then continues to update
   every ~1–3 s for the next 5 s. Confirm via DevTools network
   tab or by visually tracking the dot's smoothness vs. before
   walking (where it updated every 5–10+ s).
6. Stop walking. **Expected**: within ≤ 6 s the cadence drops
   back to the Smart-stationary rate (5–10 s between dot
   refreshes).
7. Walk again — burst should re-fire within ~10 s.

## Platform B — iOS Safari ≥ 17

Same procedure as Platform A. Verify the burst does not require
a fresh user-gesture (the gesture-coupling rule applies only to
the *first* `watchPosition` call per session — research §R2).

## Platform C — Desktop Chromium

1. Open the deployed PWA in desktop Chrome on a laptop with
   GPS or with Chrome's mock-location DevTools tooling.
2. In DevTools → "Sensors" panel, set a custom location.
3. Tap my-location, grant permission. Dot appears.
4. Use DevTools → "Sensors" to teleport the location by
   ~10 m every ~5 s for two consecutive jumps.
5. **Expected**: the burst fires after the second jump
   (visible as the dot updating immediately after the next
   simulated jump rather than waiting for the next base-Smart
   fix).
6. Keep the location stationary for ~10 s.
7. **Expected**: the burst tears down; no further bursts.

## Negative — Smart while stationary

1. Activate locate on Smart with a stationary device.
2. Wait ~60 s.
3. **Expected**: NO burst should occur. The dot updates only at
   the base Smart cadence (~5–10 s).
4. Open DevTools → Network panel and confirm no second
   `watchPosition` subscription is opened (the panel shows
   geolocation activity in the "Privacy and security" section
   of newer Chromium builds; alternatively, inspect
   `navigator.permissions.query({ name: 'geolocation' })`
   continuously).

## Negative — Fast preset

1. Settings → Locate frequency → Fast.
2. Walk for 15 s.
3. **Expected**: the dot already updates at ≤ 1 s cadence
   (Fast's normal behaviour). The promote-on-movement burst
   MUST NOT fire (FR-005 — only Smart promotes). No second
   simultaneous `watchPosition` subscription.

## Negative — Slow preset

1. Settings → Locate frequency → Slow.
2. Walk for 30 s.
3. **Expected**: the dot updates at the Slow throttled cadence
   (≥ 10 s between accepted fixes). The promote-on-movement
   burst MUST NOT fire on Slow.

## Negative — preset switch during burst

1. Trigger a burst (walk on Smart, observe rapid dot refresh).
2. **Within the 5 s burst window**, open Settings and switch
   to Fast.
3. **Expected**: the burst tears down (no overlap with Fast's
   subscription). Cadence transitions cleanly to Fast's
   ≤ 1 s rate.

## Sign-off

If all positive scenarios pass and all negative scenarios pass
(no spurious burst, no leaked subscription after preset switch /
stop), feature 014 is ready for the implement phase's automated
gate (`npm run format && npm run lint && npm run typecheck &&
npm test && npm run build && npm run bundle-size`).
