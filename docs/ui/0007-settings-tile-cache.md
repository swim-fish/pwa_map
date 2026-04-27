# UI Record 0007 — Tile Cache Settings sheet

**Status**: Accepted (landed at `/speckit.implement` 2026-04-27)
**Affected screens**: app shell — top-right toolbar (gear button as
the fifth toolbar item, alongside Go-To / Format / Layers / Locale)
and a centred modal sheet that opens on tap. Adds one secondary
confirmation dialog for destructive actions.
**Feature**: `specs/007-tile-cache-settings/`

## Context

Features 001–006 accumulate map tile cache data into three browser
`CacheStorage` namespaces (`osm-tiles`, `nlsc-tiles`, `google-tiles`)
via the workbox `runtimeCaching` rules. Until now the user had no
in-app surface to **inspect** how much was cached, no way to
**release** that storage, and no way to **adjust** the retention
policy (TTL or per-source entry cap). The only release path was
manual via DevTools → Application → Cache Storage, which is invisible
to mainstream users.

Map-tile licences (OpenStreetMap, NLSC, Google) explicitly forbid
bulk download / redistribution / area export. So the design must
present the cache as a transient performance fallback — never as a
"download a region" feature.

## Design goals

1. **Visible, clear, simple** — three rows (one per source) showing
   `count / cap` and a per-row Clear button; one TTL `<select>`; one
   per-source MaxEntries `<select>`; one big Clear-all button.
2. **Always-visible licence reminder** — a permanent notice at the
   top of the sheet stating that the cache is a short-term offline
   fallback and that bulk downloading is forbidden by licence.
3. **Confirmation before destructive action** — every Clear path
   opens a confirm dialog naming what will be cleared.
4. **No "download" affordance, anywhere** — the source code is
   audited (`tests/unit/i18n/settings-keys-parity.spec.ts`) for
   `download`/`下載`/`ダウンロード`/`prefetch`/`offline map`
   substrings outside the licence notice itself.
5. **Single-source-of-truth constants** — `cachePolicy.ts` exports
   the cache names, ceilings, defaults, and preset lists; both
   `vite.config.ts` (build-time workbox config) and
   `SettingsSheet.svelte` consume the same constants so the displayed
   numbers match the SW's actual behaviour.

## Layout & tokens

### Toolbar gear button

- Lives as the rightmost item inside `App.svelte`'s top-right
  toolbar (`.toolbar` group), to the right of the Locale opener.
- `data-testid="settings-toolbar-button"`, `aria-label`
  bound to `settings.toolbar.button`, `aria-haspopup="dialog"`.
- Glyph: `⚙` (U+2699). Compact glyph chosen over a custom SVG path
  for bundle-size discipline (~150 bytes saved vs. the multi-segment
  gear icon initially trialled).
- Inherits `.toolbar-btn` styling (white surface, 1 px slate
  border, `--space-3` padding, `--space-2` gap from the previous
  toolbar item). Adds `.settings-toolbar-btn { min-width: 36px;
padding: var(--space-2); }` so the icon target meets the
  ≥ 36 × 36 px tap-target floor.

### Modal sheet

- Centred via `position: fixed; top: 50%; left: 50%; transform:
translate(-50%, -50%);` — z-index 41 above the scrim (z-index 40)
  and below the confirmation dialog (z-index 50).
- Width: `min(440px, calc(100vw - var(--space-4) * 2))`.
- Padding: `var(--space-5)` (20 px).
- Border + shadow + radius from existing tokens
  (`--color-border`, `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18)`,
  `border-radius: 12px`).
- Background: `var(--color-surface-elev)` so it tracks the
  light/dark theme.
- Scrim: full-viewport `<button class="scrim">` using the new
  `--color-scrim: rgba(15, 23, 42, 0.6)` token (added in this
  feature). Click dismisses the sheet.

### Cache row

- `display: grid; grid-template-columns: 1fr auto auto;` so the
  source label takes the remaining space, the `count / cap` text
  is right-aligned, and the Clear button anchors at the far right.
- Source label uses `font-weight: 500` (medium) at 14 px.
- Count uses `var(--font-numeric)` at 13 px.
- Per-row Clear button is a neutral surface button (NOT danger
  styling) — danger styling is reserved for "Clear all" since that
  affects the maximum amount of data.

### TTL + MaxEntries controls

- Native `<select>` widgets — chosen over custom dropdowns for
  zero-cost a11y (single tab stop, native screen-reader behaviour
  on every platform).
- `min-width: 96px; min-height: 36px` so the value fits and the tap
  target is comfortable.

### Confirmation dialog

- Separate `<div role="dialog" aria-modal="true">` rendered when
  `confirmTarget !== null`, z-index 50 (above the sheet).
- Body text switches on `target.kind`: "all" uses
  `settings.confirm.body.all`; "one" interpolates the localised
  source label.
- Cancel = neutral surface button. Confirm = danger styling
  (`--color-danger-bg` + `--color-danger-fg`).

### New tokens introduced in this feature

| Token               | Light value          | Dark value (in `prefers-color-scheme: dark` block) | Purpose                           |
| ------------------- | -------------------- | -------------------------------------------------- | --------------------------------- |
| `--color-danger-bg` | `#dc2626`            | `#ef4444`                                          | Background of destructive buttons |
| `--color-danger-fg` | `#ffffff`            | `#0f172a`                                          | Text on destructive buttons       |
| `--color-scrim`     | `rgba(15,23,42,0.6)` | (inherited)                                        | Modal-sheet backdrop              |

WCAG-AA contrast verified by `tests/integration/settings-contrast.spec.ts`:

- `#ffffff` on `#dc2626` (light): 4.83:1 ✅ ≥ 4.5
- `#0f172a` on `#ef4444` (dark): 5.12:1 ✅ ≥ 4.5

## Interactions

| Trigger                      | Outcome                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap toolbar gear             | `settingsOpen = true` → sheet renders → on mount `refresh()` populates rows from `countCacheEntries(name)` × 3 + `estimateQuota()`.                                                                     |
| Click scrim or close button  | `dispatch('close')` → parent sets `settingsOpen = false` → sheet unmounts.                                                                                                                              |
| Press Escape                 | If a confirm dialog is open, dismisses it. Otherwise dismisses the sheet.                                                                                                                               |
| Click "Clear all"            | `confirmTarget = { kind: 'all' }` → confirm dialog renders → on confirm: `clearAllTileCaches()` → re-render rows + status banner. On cancel: dialog closes, no I/O.                                     |
| Click per-row Clear          | `confirmTarget = { kind: 'one', name }` → confirm dialog with body naming the source → on confirm: `clearCache(name)` → re-render + status banner.                                                      |
| Disabled per-row Clear       | When `count === 0` (or `count === null` if cache inspection unavailable per FR-016) the button is `disabled`.                                                                                           |
| Change TTL `<select>`        | `saveTileTtlDays(newValue)` → `enforceCachePolicy(newValue, currentMax)` (purges entries older than the new TTL) → re-render rows + status banner naming the count purged.                              |
| Change MaxEntries `<select>` | `saveTileMaxEntries(newValue)` → `enforceCachePolicy(currentTtl, newValue)` (trims oldest-first) → re-render rows + status banner naming the count trimmed. RAISING the cap performs no fetch (FR-021). |

The TTL and MaxEntries handlers do NOT use the confirm dialog
because they are bounded by the user's own choice. The licence
notice + the inline status banner provide adequate disclosure.

## Accessibility notes

- The toolbar gear is a real `<button type="button">` with an
  `aria-label` (NOT just the `⚙` glyph). Screen readers announce
  it as "Settings" / "設定" / "設定" depending on locale.
- The sheet `<div>` carries `role="dialog" aria-modal="true"
aria-labelledby="settings-title"`. The `<h2 id="settings-title">`
  inside provides the accessible name.
- The confirm dialog uses the same dialog/modal/labelledby pattern.
- Status banner uses `role="status" aria-live="polite"` so the
  message is announced after the destructive action completes
  without interrupting the user's focus.
- All buttons + selects are reachable by Tab; Enter / Space activate
  buttons; Escape dismisses (via the document-level keydown handler
  registered with `<svelte:window>`).
- All button text + the source labels are localised in `zh / en /
ja`. The licence notice uses Taiwan Traditional Chinese
  terminology (使用者, 圖磚, 不提供) per the project locale
  convention.
- Tap targets ≥ 36 × 36 px verified structurally (jsdom does not
  apply Svelte scoped CSS, so the assertion is done via element
  presence + the CSS source check in
  `tests/integration/settings-contrast.spec.ts`).

## Reduced-motion behaviour

The sheet ships **no** entry / exit animations in the implementation
that landed (the original keyframes were trimmed during the
bundle-size optimisation pass). There is therefore nothing to skip
under `prefers-reduced-motion: reduce`. If animations are added back
later, the `@media (prefers-reduced-motion: reduce)` block must
disable them — same pattern as features 005 + 006.

## Screenshots

(See `docs/ui/screenshots/` once captured — the manual-smoke pass T042
collects the six required shots: zh / en / ja × light / dark of the
sheet open state, plus one of the confirmation dialog and one of the
status banner. Screenshots are not committed inline in this MR per the
project's existing UI-record style — they are added in a follow-up
once the feature is field-tested in real Chromium.)

## Bundle delta budget — variance note

The original plan declared a ≤ 4 KB bundle delta budget. The
mid-plan scope addition of US4 (MaxEntries adjustability) added a
second `<select>`, two new status templates, and 4 additional i18n
keys × 3 locales. Final measured delta: **+5.56 KB gzipped**.

The plan was amended in-place to declare a ≤ 6 KB budget for this
feature, with this UI record + ADR 0027 capturing the rationale per
Constitution Principle IV ("budgets must be measured; regressions are
defects unless explicitly bumped with documented rationale"). Total
entry JS: ≈ 95 KB / 200 KB absolute budget (>100 KB headroom remains).

## Open questions

- Should the per-cache entry-limit changes also use a confirmation
  dialog when LOWERING below the current count? Currently the
  inline status banner reports the trim count after the fact. This
  was a deliberate choice to keep the feature uncluttered, but
  could be revisited if user-testing shows surprise at the
  destructive nature of a lowered cap.
- Should we surface the per-source byte size (not just entry count)?
  Doing so requires per-entry blob materialisation — see research
  D5 — and was rejected on perf grounds. If a future browser API
  exposes per-cache bytes cheaply, this row text could be enriched.

## Acceptance traceability

- spec FR-001..FR-005 (visibility): rendered via the `<dialog>` +
  three `<div class="cache-row">` + quota line + TTL/MaxEntries
  selects.
- spec FR-006, FR-019: TTL `<select>` (7 options) + MaxEntries
  `<select>` (6 options) with values from `cachePolicy`.
- spec FR-007: persistence via `saveTileTtlDays` /
  `saveTileMaxEntries` to `pwa_map:prefs` v2.
- spec FR-008, FR-020: TTL/MaxEntries change calls
  `enforceCachePolicy` which fans out `purgeExpired` +
  `enforceMaxEntries` per cache.
- spec FR-009, FR-010, FR-011: Clear-all + per-row Clear, both
  gated by confirm dialog.
- spec FR-013, FR-014, FR-015, FR-021: enforced both in code (no
  prefetch/download symbols in `cachePurge`) and in i18n
  (settings-keys-parity audit), plus `clearAllTileCaches` iterates
  the fixed `TILE_CACHE_NAMES` allowlist (research D9).
- spec FR-016: `count: number | null` flows from `cacheStats` →
  rendered as the localised "—" placeholder when null.
- spec FR-017: all strings via `$tStore` against three locale
  catalogues; locale switch re-renders the sheet without re-open.
- spec FR-018: WCAG-AA contrast tokens; ≥ 36 × 36 px tap targets;
  Tab/Enter/Space/Escape keyboard semantics.
