# UI Record 0013 — Top-Left Map Controls + My-Location Button

**Status**: Accepted (landed at `/speckit.implement` 2026-04-28)
**Affected screens**: app shell — on-map control cluster (top-left); Settings sheet (new "Location update frequency" section); notification region (new locate-error toast)
**Feature**: `specs/013-locate-controls-layout/`
**Supersedes**: feature 011's left-center placement of `.map-controls`.

## Context

Feature 006 introduced the on-map cluster (compass + zoom) at the bottom-right. Feature 011 moved it to a left-edge vertical-centre anchor for one-handed reach. Feature 013 relocates it again to the upper-left corner so a new my-location button can join compass + zoom in a single coherent group, freeing the entire vertical centre of the viewport for map gestures.

In parallel, the my-location button replaces the implicit "I don't know where I am" UX gap that has existed since the project's launch. Geolocation permission is requested only on user gesture, satisfying iOS Safari's user-gesture requirement and matching the user's explicit "default off" contract.

## Visible changes

1. **Cluster relocation top → upper-left.** `.map-controls` now anchors at `calc(var(--space-3) + var(--top-stack-zone-top))` from the top and `calc(var(--space-3) + var(--inline-stack-zone-left))` from the left. Vertical-centring CSS (`top: 50%; transform: translateY(-50%)`) is removed.
2. **DOM order top-to-bottom: compass → my-location → zoom-in → zoom-out.** A new `<LocateButton/>` sits between `<Compass/>` and `<ZoomControls/>`.
3. **My-location button visual states:**
   - **Off** — outline icon on the surface-elev background; no marker.
   - **Show** — accent-coloured icon; geolocation watcher is running; map does NOT auto-recentre.
   - **Follow** — accent-filled background with on-accent foreground; map auto-recentres on every fix.
   - **pressing** (during long-press hold) — 2 px accent ring grows in via a 1.5 s box-shadow transition; under `prefers-reduced-motion: reduce` the transition is disabled and an `aria-live="polite"` element announces "按住停止…".
4. **Settings → "定位更新頻率" section** — three radios: 智慧模式 (default) / 快速更新 / 慢更新. Selection persists across reloads via `pwa_map:prefs` v4. A change while the watcher is active live-applies via the `locateFrequencyStore` Svelte writable.
5. **Notification region — `locate-error-toast`** — surfaces the four error keys (`locate.error.permissionDenied` / `positionUnavailable` / `timeout` / `unavailable`) when the browser denies / times out / cannot serve geolocation.

## Design tokens

No new tokens introduced. All colours / spacings reuse existing values from `tokens.css`:

- `--color-surface-elev`, `--color-surface`, `--color-fg`, `--color-fg-muted`, `--color-border`, `--color-accent`, `--color-on-accent` — button visuals + Settings radio rows.
- `--space-1` (radio gap inside row), `--space-2` (cluster vertical gap), `--space-3` (cluster offset from viewport edges + row padding), `--tap-min` (44 px tap-target floor).
- `--top-stack-zone-top`, `--inline-stack-zone-left` — safe-area composition.

## Accessibility

- **Tap target**: button is `var(--tap-min)` (≥ 44 px) on every viewport.
- **Accessible name** changes per state (`locate.button.aria.off` / `.show` / `.follow` / `.disabled`) — screen-reader users hear the exact state on focus or after activation.
- **`aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"`** advertises both the toggle keys (Enter / Space) and the Stop chord (Shift+Enter / Shift+Space). The Stop chord is the keyboard-only path to Off, replacing the touch/mouse long-press for keyboard users (per Clarifications 2026-04-28 Q2).
- **`aria-live="polite"` element** announces "按住停止…" during long-press under reduced-motion (replaces the visual progress).
- **`aria-pressed`** flips when the button enters Show / Follow.
- **`aria-disabled`** turns true when geolocation is unavailable (insecure context, very old browser).
- **Reduced-motion**: long-press progress visual disabled; Follow recenter falls back to `setCenter` (instant) instead of `easeTo` (animated).
- **Focus ring**: native button `:focus-visible` ring inherits via the existing token system; no override.

## Locale changes

13 new i18n keys × 3 locales (`zh`, `en`, `ja`) = 39 entries:

| Key                                | zh                                              |
| ---------------------------------- | ----------------------------------------------- |
| `locate.error.permissionDenied`    | 定位權限被拒絕，請至裝置設定開啟。              |
| `locate.error.positionUnavailable` | 無法取得位置，可能是訊號不足或裝置 GPS 未就緒。 |
| `locate.error.timeout`             | 定位逾時，仍未取得位置。                        |
| `locate.error.unavailable`         | 此環境不支援定位。                              |
| `locate.button.aria.off`           | 啟用定位                                        |
| `locate.button.aria.show`          | 定位中（顯示）                                  |
| `locate.button.aria.follow`        | 定位中（跟隨）                                  |
| `locate.button.aria.disabled`      | 定位不可用                                      |
| `locate.button.aria.holdToStop`    | 按住停止…                                       |
| `settings.locate.heading`          | 定位更新頻率                                    |
| `settings.locate.preset.smart`     | 智慧模式                                        |
| `settings.locate.preset.fast`      | 快速更新                                        |
| `settings.locate.preset.slow`      | 慢更新                                          |

`zh` is canonical (Constitution v1.1.0). Parity asserted by `tests/unit/i18n/locate-keys-parity.spec.ts`.

## Behaviour reference (linked to FRs)

| FR / Acceptance | Behaviour                                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| FR-001 / FR-002 | Cluster top-left, order compass → locate → zoom-in → zoom-out                          |
| FR-003 / FR-008 | `calc(--space-3 + --*-stack-zone-*)` only; no `env(safe-area-inset-*)` direct          |
| FR-009 / FR-010 | First geolocation API call inside the `pointerup`/`click` user-gesture handler         |
| FR-014a         | Short-tap toggles Off→Show, Show↔Follow                                                |
| FR-014b–c       | Press-and-hold ≥ 1.5 s → Off; release < 1.5 s → short-tap                              |
| FR-014d         | `Shift+Enter` / `Shift+Space` → Stop                                                   |
| FR-014e         | Press-progress visual under default motion; aria-live announcement under reduce-motion |
| FR-014g         | Long-press from Off is a no-op                                                         |
| FR-018          | Manual map pan demotes Follow → Show via `manualPan` machine event                     |
| FR-021          | Settings frequency section with three radios                                           |
| FR-025          | Settings change live-applies to a running watcher within one cycle                     |
| FR-027 / FR-028 | Reload returns to Off; Stop is reachable from any active state                         |

## Out of scope (not implemented in this feature)

- On-screen heading / direction indicator (the marker is a position dot, not a directional cone).
- Marker accuracy radius circle (browser-reported accuracy is available but not rendered).
- Smart "promote to high accuracy on movement" cadence boost — deferred to keep bundle delta within the +6 KB per-feature budget (see plan.md Complexity Tracking). The Smart preset relies on the browser's built-in cadence governance + `maximumAge: 5_000`.

## Screenshots

Captured by `tests/e2e/cluster-layout.e2e.spec.ts` at four viewport sizes (T017 deferred — to be authored in a follow-up commit; the screenshots will be archived under `docs/ui/screenshots/0013-cluster-{viewport}.png`).
