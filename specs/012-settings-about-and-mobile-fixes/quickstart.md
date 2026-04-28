# Quickstart — Settings About + Mobile Fixes + 3D / Terrain Lockdown

**Feature**: 012-settings-about-and-mobile-fixes
**Plan**: [plan.md](./plan.md)

A guided ~15-minute walkthrough for verifying the four changes
introduced by this feature on a developer machine. Use this when
implementing tasks (Phase 2) and again before opening the PR.

## Prereqs

- Node 22+, `npm install` completed.
- Working tree on `012-settings-about-and-mobile-fixes`.
- Latest formatter / lint / typecheck pass:
  ```bash
  npm run format && npm run lint && npm run typecheck
  ```
- For Go-To narrow-viewport verification: Chromium-based browser with
  DevTools mobile emulation. Real iPhone (or iOS Simulator's Safari)
  on the same network for the safe-area / inline-inset cross-check
  on landscape.

## 0. Sanity build

```bash
npm run dev
# http://localhost:5173/pwa_map/
```

Confirm the existing app boots without console errors before
applying any changes.

## 1. 3D / Terrain lockdown register (US1)

### 1a — Module shape

After `tests/unit/three-d-lockdown.spec.ts` is RED, write
`src/map/threeDLockdown.ts`. Confirm the unit test passes:

```bash
npm test -- tests/unit/three-d-lockdown.spec.ts
```

Expected: 1 file, ~6 test cases, all green.

### 1b — Runtime consumption

Wire `MapView.svelte` to read the registry. Run the integration
test:

```bash
npm test -- tests/integration/three-d-lockdown-runtime.spec.ts
```

Expected: pitch / projection / terrain assertions all pass after
construction *and* after a basemap swap.

### 1c — Manual verification

```bash
npm run dev
```

In the browser:

- Open DevTools Console; type `window.__map = …` if a debug hook
  is exposed, or open the React DevTools / Svelte DevTools to
  reach the `MapView` component's `map` reference.
- Run `__map.getMaxPitch()` — expect `0`.
- Run `__map.setPitch(45); __map.getPitch()` — expect `0`.
- Run `__map.setTerrain({ source: 'fake', exaggeration: 1 })` —
  catch any throw; then `__map.getTerrain()` — expect `null`.
- Run `__map.getProjection()` — expect `{ name: 'mercator' }` or
  equivalent literal.
- Two-finger pinch on a touch screen: zoom changes, pitch stays
  at 0.
- Right-mouse-button drag: rotation changes, pitch stays at 0.
- <kbd>Shift</kbd>+<kbd>↑</kbd>: no visible tilt.

### 1d — Style filter

In DevTools Console:

- `__map.getStyle().sky` — expect `undefined`.
- `__map.getStyle().layers.find(l => l.type === 'fill-extrusion')`
  — expect `undefined`.
- `__map.getStyle().layers.find(l => l.type === 'hillshade')` —
  expect `undefined`.
- Toggle to a different basemap via the layer picker; repeat all
  three checks.

## 2. Go-To narrow-viewport fit (US2)

### 2a — Integration test (jsdom)

```bash
npm test -- tests/integration/go-to-narrow-viewport.spec.ts
```

Expected: 7 layouts × 3 widths = 21 cases, all green.

### 2b — E2E test (Playwright real browser)

```bash
npm run test:e2e -- go-to-narrow-viewport.e2e.spec.ts
```

Expected: real-browser geometry checks at 320 / 360 / 390 px pass
across Auto / DD / DMS / TM2 / TWD67 / MGRS / Taipower.

### 2c — Manual verification

In the browser at viewport widths 320, 360, 390 (use DevTools
device toolbar):

- Open the Go To dialog.
- Switch through every format (Auto, DD, DMS, TM2, TWD67, MGRS,
  Taipower).
- For each, verify:
  - No horizontal scrollbar on the dialog.
  - Every input is fully visible — no clipping.
  - Each input has a comfortable tap target (visual ≥ 44 px on
    short axis).
- At 360 px and above, the multi-column layouts persist (DD: 2
  cols; DMS: 3 cols + auto). At 320 px, all layouts collapse to 1
  column.

## 3. Settings → About section (US3)

### 3a — Integration test

```bash
npm test -- tests/integration/settings-about-section.spec.ts
```

Expected: link rendering + i18n + a11y assertions pass for all 3
locales.

### 3b — i18n parity test

```bash
npm test -- tests/unit/i18n/settings-about-keys-parity.spec.ts
```

Expected: 3 keys × 3 locales = 9 entries present.

### 3c — Manual verification

- Click the Settings (gear) toolbar button → sheet opens.
- Locate the **About** section (after the install section, before
  the cache rows).
- Verify both links visible: "Live map" and "Source code" (in the
  current UI locale).
- Click the Live map link — opens
  `https://swim-fish.github.io/pwa_map/` in a new tab.
- Click the Source code link — opens
  `https://github.com/swim-fish/pwa_map` in a new tab.
- Switch to `zh` via the locale picker — heading reads `關於`,
  links read `地圖網址` and `原始碼`.
- Switch to `ja` — heading `アプリについて`, links `マップ URL`
  and `ソースコード`.
- Tab through Settings — each link receives a visible focus ring.
- Long-press the Live map link on a touch device — native "copy
  link address" / share sheet appears.

### 3d — Contrast regression net

```bash
npm test -- tests/integration/settings-contrast.spec.ts
```

Expected: passes unchanged (no hard-coded colours in
`SettingsSheet.svelte` — see contract §5).

## 4. README live demo link (US4)

### 4a — Unit test

```bash
npm test -- tests/unit/readme-live-link.spec.ts
```

Expected: README contains the autolink form
`<https://swim-fish.github.io/pwa_map/>` within the first 30 lines.

### 4b — Manual verification

- View `README.md` rendered on GitHub
  (`https://github.com/swim-fish/pwa_map`) after pushing.
- Confirm "Live demo:" line appears above the Quickstart heading.
- Click the autolink — lands on the deployed app.

## 5. Final review-loop gates

```bash
npm run format       # in-place; idempotent
npm run lint         # --max-warnings 0
npm run typecheck    # 0 errors / 0 warnings
npm test             # all green
npm run build        # vite production build
npm run bundle-size  # entry chunk delta within +1 KiB JS / +0.5 KiB CSS
```

For PR-readiness:

```bash
npm run deploy:check # full pipeline including deploy-base spec
npm run test:e2e     # mobile / install / Go-To narrow-viewport
```

## 6. ADR + UI record

Before opening the PR, confirm:

- `docs/adr/0032-three-d-lockdown-register.md` exists and the new
  row is appended to `docs/adr/README.md`'s index.
- `docs/ui/0012-settings-about-and-mobile-fixes.md` exists and lists
  the visible UI changes (About section + Go-To narrow viewport).

## 7. Common pitfalls

- **Hard-coded colour in the About section** → contrast test fails;
  fix by switching to a token. See
  `.claude/rules/pwa-tokens-and-contrast.md`.
- **Missing locale key in one of `en` / `ja`** → parity test fails;
  fix by adding the key. The `zh` value is the canonical Traditional
  Chinese form.
- **Bundle delta > +1 KiB JS** → check the lockdown register source
  for accidental large literals; check the i18n catalogues for
  unintended bulk strings.
- **`maxPitch` set inline as a literal `0` instead of via the
  registry** → linter / code review catches; fix by importing
  `LOCKDOWN_REGISTER`.
- **Go-To narrow-viewport breakpoint written as
  `(max-width: 360px)` instead of `(max-width: calc(360px - 0.02px))`**
  → caught by code review against
  `.claude/rules/pwa-positioning.md`. Fix by using the calc form.
- **Filter helper mutates the basemap argument** → integration test
  asserts the basemap stays frozen; fix by allocating a new array
  or by always using `.filter` (which returns a new array).
