# Quickstart: Offline-First PWA + Update Prompt + UI Polish

**Feature**: `004-offline-pwa-polish` | **Date**: 2026-04-26

This quickstart shows a contributor or operator how to verify each of
the four user stories shipped by feature 004. It assumes the
production build (`npm run build && npm run preview`) — the offline
path requires a real service worker, which is intentionally disabled
in `vite dev`.

---

## Prerequisites

- Node 20+
- The repo built once: `npm install && npm run build && npm run preview`
- A Chromium browser on `localhost:4173`

```bash
npm install
npm run build
npm run preview            # serves at http://localhost:4173/
```

---

## US1 — App works offline after first visit

1. Open `http://localhost:4173/` in Chromium.
2. Pan the map across Taipei (Daan, Songshan, Xinyi). The crosshair
   coordinate should update; tiles should render normally.
3. Open DevTools → Application → Service Workers. Confirm a worker
   is **active**.
4. DevTools → Network → tick **Offline**. Reload (`F5`).
5. **Expect**:
   - The app shell loads in under 3 s.
   - The crosshair, coordinate readout, toolbar, attribution badge
     are all visible and interactive.
   - The basemap tiles for the regions you panned across in step 2
     are present.
   - Tiles for un-panned regions may be blank (un-cached); the map
     does not crash.
6. Untick **Offline** and reload to restore normal operation.

---

## US2 — Update prompt with controlled confirmation

The deterministic test path uses the test-only window hook:

1. Open `http://localhost:4173/?testHooks=1` (or set
   `localStorage.setItem('pwa_map:testHooks', '1')` in console).
2. Open DevTools → Console.
3. Run:
   ```js
   window.__pwaTestHooks.triggerUpdateAvailable();
   ```
4. **Expect**: a top-center toast appears within ~1 s with the title
   "有新版本可用 / Update available / アップデートあり" (depending on
   locale) and two buttons.
5. Tap **Later** (or press Escape). The toast disappears. Run
   `window.__pwaTestHooks.triggerUpdateAvailable()` again immediately
   — the prompt MUST stay hidden (postpone window).
6. Optionally fast-forward the postpone window in tests with
   `vi.advanceTimersByTime(31 * 60 * 1000)` (Vitest only — there is
   no production way to skip the timer).
7. Tap **Update now** in step 4 (clean run): the page reloads.

The real SW upgrade path (deploying a new build) is exercised by the
unit tests for `registerSW.ts` (with a mocked `useRegisterSW`) and is
not part of this manual check because it requires a CI deploy
sequence.

---

## US3 — Attribution badge is readable in light + dark

1. macOS: System Settings → Appearance → Light. Linux/Windows: OS
   theme → light.
2. `http://localhost:4173/` — verify the bottom-right badge text is
   easily readable on the OSM, NLSC, and Google basemaps.
3. Switch OS theme to Dark.
4. Reload. Verify the same on each basemap. Compare against the
   feature 003 baseline (where the dark-mode badge was effectively
   invisible).

Programmatic check (Chromium DevTools console):

```js
const badge = document.querySelector('[data-testid="attribution"]');
const cs = getComputedStyle(badge);
console.log(cs.backgroundColor, cs.color);
```

Both colours should resolve to opaque slate/white pairs with WCAG-AA
contrast (verified by the integration test, but readable visually
in seconds).

---

## US4 — Manifest parses cleanly in dev and prod

### Dev path

1. `npm run dev` (port 5173).
2. Open `http://localhost:5173/`, then DevTools → Console.
3. **Expect**: no entry matching `manifest.webmanifest.*Syntax error`.
4. DevTools → Application → Manifest. **Expect**: all fields parsed
   (Name, Short name, Icons, Start URL, Display). No "syntax error"
   warning at the top of the panel.
5. Direct fetch:
   ```bash
   curl -i http://localhost:5173/manifest.webmanifest
   ```
   Expect status `200`, `Content-Type: application/manifest+json`,
   and a JSON body with `name`, `icons`, etc.

### Prod path

1. `npm run build && npm run preview` (port 4173).
2. Repeat steps 2–5 above against `http://localhost:4173/`.

---

## Running the automated test suite

```bash
# All tests (unit + integration)
npm test

# E2E only — requires a running build
npm run build
npm run preview &
PREVIEW_PID=$!
npx playwright test tests/e2e/story-4-offline-and-update.spec.ts
kill $PREVIEW_PID
```

The E2E spec covers all four user stories above with deterministic
timing assertions matching SC-001 / SC-002 / SC-003 / SC-006.

---

## Performance verification (optional, once per release)

```bash
npm run build
ls -la dist/assets/*.js | awk '{print $5, $9}'   # bundle sizes
```

Compare the sum of gzipped main-bundle sizes against the feature 003
baseline. Delta MUST be ≤ 3 KB (SC-007). Use `du -bs dist/assets/*.gz`
if you have pre-compressed bundles enabled, otherwise pipe through
`gzip -9 | wc -c` per file.

```bash
# Manually gzip-measure each bundle
for f in dist/assets/*.js; do
  printf '%s\t%d\n' "$f" "$(gzip -9c "$f" | wc -c)"
done | sort -k2 -n
```
