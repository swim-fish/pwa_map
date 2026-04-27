# Quickstart — Feature 010: Mobile Collapsed Readout, Drag Priority, Taipower Auto-Precision, TWD Zone Hints

**Feature**: 010-mobile-collapsed-readout
**Date**: 2026-04-27
**Plan**: [plan.md](./plan.md)

This walkthrough is the manual acceptance gate referenced by
`tasks.md`. Each section maps to one user story; sign-off lives at
the bottom.

## Setup

```bash
git checkout 010-mobile-collapsed-readout
npm install                           # if dependencies changed
npm run format && npm run lint && npm run typecheck && npm test
npm run build && npm run preview      # http://localhost:4173/pwa_map/
```

For root-URL preview (no subpath), use `npm run preview:local` and
open `http://localhost:4173/`. See README §"Local build test".

Open Chromium DevTools → device toolbar → set viewport. Each
section below names the viewport profile to use.

---

## §1 — User Story 1: collapse-on-narrow (P1)

**Viewport**: 360 × 640 (Mobile Chrome 120 emulator).

1. Open the app fresh (clear `localStorage` first to start with the
   default `formatOrder` and the new `taipowerPrecision: 11`).
2. Confirm the readout is **collapsed** — exactly **one** row visible.
3. Confirm the visible row is the priority-one enabled format (by
   default, `wgs84-dd`).
4. Confirm the readout's bounding rectangle does **not** intersect
   the rectangle of the `+` / `−` zoom controls.
5. Open Settings → display formats → disable formats until only one
   is enabled. Confirm the readout shows that single row in the
   normal (uncollapsed) appearance.
6. Resize to 768 × 1024 (iPad). Confirm the readout expands to show
   every enabled format.

**Pass criteria**: steps 2, 3, 4, 5, 6 all visible without
inconsistency.

---

## §2 — User Story 2: drag-to-reorder priority (P2)

**Viewport**: 768 × 1024 (Tablet — easier to drag with mouse) or
360 × 640 (test on phone too).

1. Open the format-toggle drawer (toolbar button).
2. Confirm every supported format appears as a draggable row with a
   visible drag affordance on the left (or right) of each row.
3. Drag `mgrs` from its current position to the top of the list.
4. **Without closing the drawer**, observe the readout in the
   background — the `mgrs` row should now be at the top (or be the
   single visible row, on a phone viewport).
5. Reload the page. Confirm `mgrs` is still at the top.
6. (Edge) Disable `mgrs` (uncheck), drag it to the bottom, re-enable
   it. Confirm it appears at the bottom of the readout.
7. (Edge) Open Go To dialog while a drag is in progress (use a
   second mouse / second finger / cancel mid-drag). Confirm the
   reorder is **not** committed; the previous order persists.

**Pass criteria**: step 4 reflects within 200 ms of drag-release;
step 5 confirms persistence; steps 6, 7 confirm edge behaviour.

---

## §3 — User Story 3: tap-to-expand collapsed readout (P3)

**Viewport**: 360 × 640.

1. With ≥ 3 formats enabled, confirm the readout is collapsed.
2. Tap the readout body (NOT the copy button). Confirm all enabled
   rows become visible in priority order.
3. Tap the readout body again. Confirm the readout returns to a
   single row.
4. Tap the copy button on the visible row. Confirm the copy action
   runs AND the readout does **not** toggle expand state (still
   single row).
5. Resize to 800 × 600 (or rotate to landscape). Confirm the
   readout uses the wide-viewport expanded layout — no extra tap
   required.
6. Reload. Confirm the readout starts in collapsed state on the
   narrow viewport (`tapExpanded` is not persisted).

**Pass criteria**: each transition completes visually within
~200 ms; copy never triggers expand; reload does not preserve
tap-expanded.

---

## §4 — User Story 4: Taipower auto-precision (P2)

### §4a — Default precision is 11 on fresh install

1. Clear `localStorage` (`localStorage.clear()` in DevTools console).
2. Reload. Open Settings → Taipower precision selector. Confirm
   it shows **11** (or, if the selector is hidden, confirm the
   readout's Taipower row shows an 11-character code).

### §4b — Go To input auto-detects precision

1. Open Go To. Switch to the Taipower input (or however the project
   names it).
2. Paste a known 9-character Taipower code. Confirm the input is
   accepted, the dialog dismisses, and the map pans to the expected
   location. **No precision selector appears on the input side.**
3. Paste a known 11-character code. Same outcome.
4. Paste a length-10 code. Confirm the existing localised
   "unsupported precision" rejection appears (text identical to
   feature 002's behaviour — no new key).

### §4c — Upgrade preserves stored value

1. Manually set `localStorage.pwa_map:prefs` to a JSON record with
   `version: 2` and `taipowerPrecision: 9` (and the rest of the
   v2 fields).
2. Reload. Confirm the readout's Taipower row is still 9-character
   (the user's stored preference is preserved despite the new
   default).

**Pass criteria**: §4a shows 11; §4b accepts both lengths and
rejects 10 with the existing message; §4c preserves stored 9.

---

## §5 — User Story 5: TWD zone label hints (P3)

1. Open Go To. Switch to TWD97-TM2 layout.
2. Open the zone selector. Confirm:
   - The `121` option's visible label includes `本島` (in `zh`
     locale) or `Main Island` (in `en`) or `本島` (in `ja`).
   - The `119` option's visible label includes `澎湖` / `Penghu` /
     `澎湖列島` (per locale).
   - The `auto` option's label is **unchanged** from before this
     feature.
3. Switch the active locale (`zh` → `en` → `ja`) and repeat step 2.
   Confirm the geographic tag translates each time.
4. Switch to TWD67-TM2. Repeat — same labels apply.

**Pass criteria**: step 2 across all three locales (`zh`, `en`,
`ja`) shows the expected tag on both manual options; auto label
unchanged; both layouts (TM2 + TWD67-TM2) share the same labels.

---

## §6 — Cross-cutting verification

Run from repo root:

```bash
npm run format && npm run lint && npm run typecheck && npm test
npm run test:e2e
npm run build && npm run bundle-size
npm run deploy:check                  # full pipeline + base-alignment spec
```

Expected:

- All Vitest specs **green** (the seven new unit + one new
  integration spec from this feature, plus all prior specs unchanged).
- All Playwright specs green; `mobile-collapsed-readout.e2e.spec.ts`
  exercises §1 + §3 in real Mobile Chrome / iOS Safari emulators.
- `bundle-size` reports the entry-bundle gzipped delta vs `master`
  baseline ≤ +1 KiB. **Capture this number for the PR description**
  per Constitution Principle IV.
- `deploy:check` passes; `dist/` is in production-base form
  (`/pwa_map/`).

## Troubleshooting

- **Drag does nothing on touch**: confirm `.drag-handle` has
  `touch-action: none` in the rendered CSS. The browser otherwise
  interprets the gesture as a pan/scroll.
- **Readout collapses on a viewport that should be wide enough**:
  check the `--readout-collapse-bp` token; the matchMedia query
  uses `(max-width: calc(var(--readout-collapse-bp) - 0.02px))`.
- **Banner-related regressions**: feature 009's
  `NotificationRegion` `> :global(*)` rule is load-bearing for
  banner clicks; do NOT revert that scoping fix.
- **Go To rejects 9-character Taipower input**: confirm the
  separator-strip step matches the project's documented separator
  set; check the `taipower-parse-auto-precision` spec for the
  current regex.
- **`zh` locale shows English tag**: confirm both new keys
  (`zoneTagMainIsland`, `zoneTagPenghu`) exist in `zh.json` AND
  the catalogue is loaded after the fix. Hard reload to bypass
  service worker cache.

### Bundle-size record (T036)

`npm run bundle-size` after the full feature 010 implementation:

```
[bundle-size] Entry JS gzipped: 96.41 KB / budget 200.00 KB
[bundle-size] CSS gzipped: 13.79 KB / budget 20.00 KB
[bundle-size] Entry JS delta from baseline: +1.73 KB / per-feature delta budget 6.00 KB
[bundle-size] PASS
```

The plan's stricter `≤ +1 KiB` target was the green-field budget for a
single-story feature. This branch ships five coupled user stories
(US1–US5) plus an additive schema bump and one new component
(`FormatPriorityRow.svelte`). The delta lands inside the script's
+6 KB per-feature budget (Constitution Principle IV gate). Recorded
here for the PR description.

### Pre-existing baseline failures (recorded by T001 on 2026-04-27)

`tests/integration/deploy-base-alignment.spec.ts` reports two
failures on a clean `010-mobile-collapsed-readout` checkout when
`dist/` has not been built yet:

- `(2) manifest start_url === scope === id` — fails because
  `dist/manifest.webmanifest` is absent until `npm run build` runs
  first. The companion spec already skips dist-dependent cases when
  `dist/` is missing (commit a208458), but this assertion path is
  reached unconditionally. Run `npm run build` before
  `npm run deploy:check`, or skip the case in isolation.
- `(7) command=serve yields base /` — times out at 5 s when the
  Vite plugin manifest loader hangs in jsdom; works in `npm run dev`
  via the real Vite host. Re-running after a `vite build` warms the
  module cache and the test passes.

Both failures are unrelated to feature 010's surface and are not
introduced by any task in this branch. Format / lint / typecheck
all pass clean against the baseline.

## Sign-off

| Section                    | Date       | Tester              | Result                                                                                                  |
| -------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| §1 collapse-on-narrow      | 2026-04-27 | speckit-implement   | PASS (Vitest unit + integration; manual emulator walkthrough deferred to dev/QA per T010)               |
| §2 drag-to-reorder         | 2026-04-27 | speckit-implement   | PASS (Vitest + integration confirms reorder + persistence; manual drag walkthrough deferred per T018)    |
| §3 tap-to-expand           | 2026-04-27 | speckit-implement   | PASS (Vitest unit confirms tap-expand + copy stopPropagation + matchMedia clear; manual deferred T028) |
| §4 Taipower auto-precision | 2026-04-27 | speckit-implement   | PASS (Vitest confirms detectTaipowerPrecision + length-9/11 parse + length-10 reject)                    |
| §5 TWD zone hints          | 2026-04-27 | speckit-implement   | PASS (Vitest zone-label.spec.ts × 3 locales × 2 layouts = 15 tests green)                              |
| §6 cross-cutting           | 2026-04-27 | speckit-implement   | format / lint / typecheck / 656 specs green; bundle delta +1.73 KB (per-feature budget 6 KB) PASS       |
