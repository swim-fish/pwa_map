# Quickstart — Mobile UI Adjustments

**Feature**: 009-mobile-ui-fixes
**Plan**: [plan.md](./plan.md)

A guided 10-minute walkthrough for verifying the three changes
introduced by this feature on a developer machine. Use this when
implementing tasks (Phase 2) and again before opening the PR.

## Prereqs

- Node 22+, `npm install` completed.
- Working tree on `009-mobile-ui-fixes`.
- Latest formatter / lint / typecheck pass (`npm run format && npm run lint && npm run typecheck`).

## 0. Sanity build

```bash
npm run dev
```

Open `http://localhost:5173/` in a Chromium-based browser. Open
DevTools → device toolbar → set viewport to **iPhone 13 Pro
(390 × 844)** or any 360–414 px width Mobile profile.

## 1. Tap-target floor (US1, P1)

1. With the mobile viewport selected, hover each of:

   - The compass toggle (top-right column).
   - Zoom in / zoom out (top-right column).
   - The settings icon button.
   - Each toolbar button (Go To, Layers, Locate Me).
   - The copy button next to each visible coordinate row.
   - When triggered: any visible install banner / SW-update banner buttons.

   The DevTools "Inspect" tooltip should report each as **44 × 44 px or larger**.

2. Confirm none of the buttons overlap their neighbours visually.

3. Resize the viewport to 320 × 568 (iPhone SE 1st-gen). The page must
   not gain a horizontal scrollbar.

4. Run the focused unit + e2e specs:

   ```bash
   npx vitest run tests/unit/tap-target.spec.ts
   npx playwright test tests/e2e/mobile-tap-targets.e2e.spec.ts
   ```

   Both must pass green.

## 2. Notification region (US2, P2)

Trigger each banner class and confirm none of them obscures the
toolbar, the right-edge controls (compass / zoom / settings), the
readout, or — when a dialog is open — the dialog's primary action row.

1. **Service-worker update prompt**.
   - In DevTools → Application → Service workers, choose "Update
     on reload" and reload. The update prompt should appear at
     the **top center**, sized so that no part of it covers the
     toolbar at the top-left or the compass/zoom column at the
     top-right.

2. **Install banner**.
   - In an Android Chrome emulation, simulate
     `beforeinstallprompt` (DevTools → Application → Manifest →
     "Add to homescreen"). The install banner should appear in
     the same top-center stacking region, **below** the SW update
     prompt if both are present, with `var(--space-3)` of vertical
     gap between them.

3. **Inline transient toasts** (zone hint, copy success, layer-load
   failure, offline-ready). Trigger each by:

   - Zone hint: pan to the boundary of TM2 zone 119/121 and back.
   - Copy success: tap the readout's copy button next to any row.
   - Layer-load failure: switch to a layer whose tile URL fails to load.
   - Offline-ready: take the network offline; reload; the SW
     "ready for offline" banner appears once.

   For each, confirm the banner sits in the same region and does
   not cover the toolbar / readout / right-edge controls.

4. With **Go To** open (tap the toolbar button), trigger any
   notification. Confirm the dialog's primary action buttons remain
   visible and the notification has shifted to the bottom edge —
   `body[data-dialog-open]` is set, so
   `--notification-zone-bottom` applies.

5. Run the integration spec:

   ```bash
   npx vitest run tests/integration/notification-region.spec.ts
   ```

   It must pass green.

## 3. Segmented coordinate readout (US3, P3)

1. Open Settings → "Coordinate formats" and ensure all six formats
   (DD, DMS, TWD97-TM2, TWD67-TM2, MGRS, Taipower) are visible.

2. Pan the map so the crosshair is somewhere over Taiwan. Each
   readout row should now render as a **labelled-segment row**:

   - **WGS84 DMS** shows separate `Lat Deg` `Lat Min` `Lat Sec` `N/S`
     `Lon Deg` `Lon Min` `Lon Sec` `E/W` fields, mirroring
     `DmsLayout`.
   - **MGRS** shows `GZD/Band` `Square` `Easting` `Northing`,
     mirroring `MgrsLayout`.
   - **TWD97-TM2** shows `Easting` `Northing` `Zone`, mirroring
     `Tm2Layout`.
   - The two-segment formats (`wgs84-dd`, `twd67-tm2`) show two
     labelled fields.
   - Taipower shows three labelled fields when in coverage; the
     entire row reads "尚未在台灣涵蓋範圍內" (or the locale-equivalent)
     when out of coverage.

3. Tap the copy button next to any row. The clipboard contents
   MUST equal what the row showed *before* this feature shipped —
   i.e., the canonical single-string representation. Verify by
   pasting into a text editor.

4. Switch the active locale (`zh` → `en` → `ja`) via the locale
   picker. Each segment label MUST update to the locale-localised
   version *and remain identical to the corresponding Go To
   layout's label* in that locale.

5. Run the segments spec:

   ```bash
   npx vitest run tests/unit/coordinate-readout-segments.spec.ts
   ```

   It must pass green.

## 4. Whole-feature gate

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run bundle-size
npm run deploy:check    # optional, full deploy gate
```

All steps must pass. `bundle-size` should report ≤ +1 KiB gzipped
delta on the entry bundle vs the baseline measured before this
feature.

## 5. Documentation

Before opening the PR (Principle III + V):

- `docs/ui/0009-mobile-ui-fixes.md` exists and describes the
  visible changes.
- `docs/adr/0029-mobile-touch-target-and-notification-region.md`
  exists and is linked from `docs/adr/README.md`.
- `CLAUDE.md`'s `<!-- SPECKIT START -->` block points to
  `specs/009-mobile-ui-fixes/plan.md`.

## Troubleshooting

| Symptom                                                                 | Likely cause                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tap-target.spec.ts` fails with size 36 × 36                            | A component still hard-codes `width: 36px; height: 36px;` instead of `var(--tap-min)`.        |
| `notification-region.spec.ts` fails on toolbar overlap                  | A banner component still has its own `position: fixed; top: …` block.                         |
| `coordinate-readout-segments.spec.ts` fails on label-key parity         | A locale key in `goto.fields.*` differs from what `data-model.md` records — fix the contract. |
| `coordinate-readout-segments.spec.ts` fails on "canonical string equal" | The new code path bypasses the existing `format*()` helpers — route the copy button through them. |
| Horizontal scroll appears at 320 px                                     | A toolbar / banner / readout is wider than 320 px — narrow it via `max-width: calc(100vw - …)`. |
| `bundle-size` > +1 KiB                                                  | Likely a forgotten `import` or a heavy third-party dep — check `npm run build` output for new entries. |
