# Quickstart — Safe-Area Compliance and Settings-Page Install Button

**Feature**: 011-safe-area-install-buttons
**Plan**: [plan.md](./plan.md)

A guided 15-minute walkthrough for verifying the two changes
introduced by this feature on a developer machine. Use this when
implementing tasks (Phase 2) and again before opening the PR.

## Prereqs

- Node 22+, `npm install` completed.
- Working tree on `011-safe-area-install-buttons`.
- Latest formatter / lint / typecheck pass (`npm run format && npm run lint && npm run typecheck`).
- Chromium-based browser with DevTools mobile emulation; for the iOS
  Safari path, a real iPhone (or the Xcode iOS Simulator's Safari)
  on the same network — Chrome's "iOS" UA string spoof is **not**
  enough because `env(safe-area-inset-*)` requires real engine
  reporting.

## 0. Sanity build

```bash
npm run dev
```

Open `http://localhost:5173/` in a Chromium-based browser. Open
DevTools → device toolbar → set viewport to **iPhone 14 Pro
(393 × 852)** or any 360–414 px width Mobile profile with Dynamic
Island.

## 1. Safe-area on every persistent surface (US1, P1)

**Browser-emulated check (Chromium DevTools)**:

1. Open Chrome DevTools → ⠇ → "More tools" → "Sensors". Set
   "Touch" to "Force enabled".
2. Switch the device toolbar to "iPhone 14 Pro" (or any Dynamic-Island
   profile). The notch / Dynamic Island appears as a black
   rectangle inset into the top of the page.
3. Visually confirm the **toolbar** sits fully *below* the Dynamic
   Island. Inspect the `.toolbar` element; its computed `top` MUST
   resolve to `12px + env(safe-area-inset-top)` — i.e. greater than
   the literal `12px` of pre-feature behaviour.
4. Confirm the **map controls** (zoom in / out + compass) cluster
   sits fully *above* the home indicator. Inspect `.map-controls`;
   its computed `bottom` MUST resolve to
   `var(--space-4) + var(--space-6) + env(safe-area-inset-bottom)`.
5. Confirm the **coordinate readout** sits above the home indicator.
6. Confirm the **attribution bar** sits above the home indicator
   (and above the readout if both are visible).
7. Rotate the emulated device to **landscape**; the notch shifts to
   one side. Confirm the toolbar's right offset now includes
   `env(safe-area-inset-right)` so no toolbar button hides under
   the notch.

**Real device check (iPhone Safari)**:

1. Connect the iPhone to the dev machine; in Mobile Safari open
   `http://<dev-machine-LAN-IP>:5173/`.
2. Tilt the phone to landscape; the notch is on one side. Confirm
   the toolbar buttons are reachable without thumb-fighting the
   notch.
3. Add to Home Screen → launch the PWA from the home screen
   (standalone mode). The same safe-area rules MUST apply
   (FR-005 / FR-008 / SC-001 / SC-002).

**Real device check (Android Chrome)**:

1. On a Pixel-class Android device with edge-to-edge gesture
   navigation, open the PWA in Chrome.
2. Confirm the toolbar clears the system status bar at the top.
3. Confirm the bottom-anchored surfaces clear the gesture area at
   the bottom.

**Run the focused unit + integration specs**:

```bash
npx vitest run tests/unit/safe-area-tokens.spec.ts
npx vitest run tests/integration/safe-area-layout.spec.ts
```

Both must pass green. The unit spec verifies the token shape,
the `0px` fallback, the `viewport-fit=cover` preservation, and the
"no `env()` outside `tokens.css`" grep guard. The integration spec
verifies that with stubbed non-zero insets, every surface's
bounding rect clears each viewport edge by at least the stubbed
inset.

## 2. Settings-sheet install section (US2, P1)

**Chromium branch (Android emulation OR real Chromium desktop)**:

1. With the dev server running, open the PWA in Chrome on a desktop
   that meets the install criteria (HTTPS or localhost; manifest
   present; service worker registered). The transient install
   banner may appear at the bottom — dismiss it via the "Not now"
   button to demonstrate that the Settings entry remains
   independent.
2. Tap the ⚙ Settings icon in the toolbar. The sheet opens.
3. Confirm a new **Install app** section is visible at the top of
   the sheet, immediately below the licence notice. The button
   reads the localised "Install" verb.
4. Tap the install button. The OS install prompt appears.
5. Cancel the prompt. The button MUST remain enabled (no 30-day
   suppression for the Settings entry — FR-015).
6. Tap the install button again. The OS prompt reappears. Accept
   it. The browser installs the PWA; on the next render of the
   Settings sheet (which is reactive — no close + reopen needed),
   the section flips to the "App is already installed" status line
   (FR-018).

**iOS Safari branch (real iPhone)**:

1. On a real iPhone in Mobile Safari, navigate to the PWA URL.
2. Tap the ⚙ Settings icon. The sheet opens.
3. Confirm the **Install app** section is visible. Its primary
   action is a button labelled with the localised iOS title (e.g.
   "加入主畫面" in `zh`).
4. Tap the button. An instructions dialog opens with three steps
   (Share icon → Add to Home Screen → Add). Confirm the Share-icon
   SVG is rendered inline next to step 1.
5. Tap the dialog's close button (or press Escape on a paired
   keyboard). The dialog closes.
6. Tap the section's primary action again. The dialog re-opens
   (FR-011).

**iOS-other branch (iPhone Chrome)**:

1. On the same iPhone, open the PWA in Chrome (or Firefox / Edge
   for iOS).
2. Tap ⚙ Settings → confirm the section reads the localised
   "open in Safari to install" hint and shows NO actionable button.

**Already-installed branch**:

1. After installing the PWA from the Chromium branch (step 6 above)
   OR from the iOS Safari branch (Add to Home Screen completed),
   open the installed PWA from the home screen.
2. Tap ⚙ Settings → the section reads the localised "App is already
   installed" status line (FR-013).

**Unsupported branch**:

1. On desktop Firefox (which neither fires `beforeinstallprompt`
   nor matches an iOS device UA), open the PWA.
2. Tap ⚙ Settings → the **Install app** section MUST NOT be
   rendered at all (no heading, no body, no hidden disabled button)
   (FR-014).

**Run the focused unit + integration specs**:

```bash
npx vitest run tests/unit/install-settings-surface.spec.ts
npx vitest run tests/integration/settings-install-section.spec.ts
```

Both must pass green.

## 3. Settings sheet itself respects the safe area (US3, P3)

1. On a real iPhone in Safari, open the PWA → Settings.
2. Scroll the Settings sheet to the bottom. The "Clear all" button
   (the previously-last interactive row) MUST sit at least the
   safe-area-inset-bottom value above the screen bottom — no
   overlap with the home indicator.
3. Rotate to landscape; the sheet's left / right margins MUST
   honour `env(safe-area-inset-left)` / `env(safe-area-inset-right)`
   so no row's leading text hides under the notch.
4. Repeat in PWA standalone mode after install — the rule MUST
   still hold.

## 4. End-to-end Playwright

```bash
npx playwright test tests/e2e/safe-area-install.e2e.spec.ts
```

The e2e spec runs both the iPhone 14 (Mobile Safari) and Pixel 7
(Mobile Chrome) profiles end-to-end, exercising the safe-area
compliance and the Settings install button under real engine-reported
insets.

## 5. Whole-feature gate

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run bundle-size
npm run deploy:check    # optional, full deploy gate
```

All steps must pass. `bundle-size` should report:

- ≤ +1 KiB gzipped delta on the entry JS bundle.
- ≤ +0.5 KiB gzipped delta on the entry CSS bundle.

## 6. Documentation

Before opening the PR (Principle III + V):

- `docs/ui/0011-safe-area-install-buttons.md` exists and describes
  the safe-area work and the new Settings install section.
- `docs/adr/0031-safe-area-and-on-demand-install.md` exists and is
  linked from `docs/adr/README.md`. It must explicitly note that it
  *extends* (not supersedes) ADR 0025 (PWA install surfaces) and
  ADR 0029 (mobile touch-target + notification region).
- `CLAUDE.md`'s `<!-- SPECKIT START -->` block points to
  `specs/011-safe-area-install-buttons/plan.md`.

## Troubleshooting

| Symptom                                                                 | Likely cause                                                                                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safe-area-tokens.spec.ts` fails on the grep guard                      | A component still uses `env(safe-area-inset-*)` directly outside `tokens.css`. Replace it with the corresponding `--*-stack-zone-*` token.            |
| `safe-area-tokens.spec.ts` fails on the `viewport-fit=cover` assertion  | `index.html` lost the meta declaration. Restore it.                                                                                                    |
| `safe-area-layout.spec.ts` fails on rect intersection                   | A surface still uses a literal `top` / `bottom` / `left` / `right` value. Switch it to the `calc(<existing-literal> + var(--*-stack-zone-*))` form.   |
| `install-settings-surface.spec.ts` fails on FR-015 (dismissal bypass)   | The derived store is reading `installSignal.surface` (which the dismissal flattens to `'hidden'`) instead of re-deriving from the underlying probe + `installed` flag. Restructure per `contracts/install-settings-surface.md` §2. |
| `settings-install-section.spec.ts` fails on FR-018 (reactive update)    | The section is wrapping `installSignal` / `installSettingsSurface` in a non-reactive `let`. Use Svelte's `$store` syntax so the section re-renders on every store update. |
| iOS instructions dialog only opens once                                  | The component is using a `let openedOnce = false` guard. Remove it — the dialog is informational, not consumable (FR-011).                            |
| Chromium install button stays disabled after the user cancels the prompt | The `installInFlight` local flag is not being reset in the `triggerInstall()` Promise's `finally` clause.                                              |
| `bundle-size` > +1 KiB JS or +0.5 KiB CSS                                | Likely a forgotten `import` or a heavy third-party dep — check `npm run build` output for new entries. The whole feature should add ~6 strings of i18n + ~6 CSS tokens + ~40 lines of TS. |
