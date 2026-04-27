# Phase 0 Research: Tile Cache Settings

**Feature**: `007-tile-cache-settings` | **Date**: 2026-04-27
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves every "NEEDS CLARIFICATION" implied by the plan
into concrete decisions. Decisions are numbered D1..D10 and are
referenced by ID from `data-model.md`, the `contracts/` files, and
`tasks.md`.

---

## D1. Both TTL and per-cache MaxEntries are enforced at the **app layer**, NOT by re-configuring workbox

**Decision**: Set the workbox `runtimeCaching.options.expiration` knobs
in `vite.config.ts` to **the user-selectable maxima**: `maxAgeSeconds =
90 days` and `maxEntries = 8192`. The *user-selected* TTL
(1 / 3 / 7 / 14 / 30 / 60 / 90 days) and per-cache entry limit
(256 / 512 / 1024 / 2048 / 4096 / 8192) are then enforced by an
app-level routine (`enforceCachePolicy()` in `cachePurge.ts`, which
internally fans out to `purgeExpired` and `enforceMaxEntries` for each
cache) that runs at:

1. App start, immediately after `registerSW()` in `src/app/main.ts`
   (fire-and-forget; awaiting it would delay first paint).
2. Immediately after the user changes the TTL inside the sheet.
3. Immediately after the user changes the per-cache entry limit
   inside the sheet.

The purge routine reads each cached `Response.headers.get('date')` (an
`HTTP-date` per RFC 7231 §7.1.1.1, which `Date.parse` understands) and
deletes any entry older than `nowMs − ttlDays * 86400_000`.

**Rationale**: Both workbox knobs are **baked into the generated
service-worker JS at build time**. Changing either at runtime would
require re-building, re-deploying, and re-registering a new service
worker — far beyond the scope of "adjust a number in a settings sheet".
The correct architecture is:

- Workbox = passive backstop. Hard ceilings at 90 days and 8192
  entries (the user-selectable maxima). Runs inside the SW on every
  fetch as part of the normal write path; will never trim more
  aggressively than the user-selected values, but will catch the
  catastrophic-runaway case if the app-level enforcer never gets to
  run (e.g., the user uninstalls the app before it loads).
- App-level `purgeExpired` + `enforceMaxEntries` = active enforcer.
  Runs from the page context on app start + on every TTL or limit
  change. Reads the same `Cache` storage and deletes by date header
  (for TTL) or by insertion order (for max-entries — see D11).

This is the textbook "the SW decides what to write, the app decides
what to keep" split — used by Twitter Lite, Pinterest's PWA, and the
Workbox docs' own "advanced cache management" cookbook.

The `Response.headers.get('date')` header is set by the upstream tile
servers (verified by `curl -I` against
`https://wmts.nlsc.gov.tw/wmts/EMAP5/...` and `https://mt1.google.com/vt/...`
— both echo a `Date` header on every 200 response). For the rare
opaque response (cross-origin without CORS) that strips the date
header, `purgeExpired` falls back to deleting the entry on the first
purge cycle ≥ TTL after the *cache-write time recorded by workbox's
own metadata* (see D2).

**Alternatives considered**:

- **Re-build the SW with the new `maxAgeSeconds` on every TTL edit** —
  requires regenerating `sw.js` from a server endpoint or using
  `injectManifest` + a custom-written SW that reads TTL from
  `IndexedDB`. The complexity (new SW source file, message-channel
  wiring from page → SW for the TTL change, full SW reinstall on every
  edit) is unjustified for a setting most users will set once.
- **Drop workbox's expiration and only use app-level purge** —
  rejected; app-level purge runs on app start, but the SW continues to
  populate caches between purges. Without the workbox ceiling, a user
  who never opens the app for six months would accumulate unbounded
  tiles up to `maxEntries: 4096`. Belt-and-braces is cheap.
- **Use IndexedDB to record per-entry timestamps for purge** —
  workbox's `ExpirationPlugin` already does this for `maxEntries`
  enforcement (at `workbox-expiration` IndexedDB store). Reading those
  timestamps from page context is possible but couples us to workbox
  internals. The `Response.date` header is a public, stable contract.

---

## D2. Per-entry age = `Response.headers.get('date')`, fallback to "delete on first purge"

**Decision**: `purgeExpired(name, ttlDays, now)` walks `cache.keys()`,
calls `cache.match(req)` for each, reads
`Response.headers.get('date')`, computes
`ageMs = now − Date.parse(dateHeader)`, and if `ageMs > ttlDays * 86400_000`,
calls `cache.delete(req)`. If the date header is missing or unparseable
(e.g., opaque cross-origin response), the entry is **deleted
unconditionally** on this purge cycle — the assumption being that the
user just expressed an intent to retain only fresh tiles and a
date-less entry is by definition impossible to verify as fresh.

**Rationale**: The HTTP `Date` header is mandatory per RFC 7231 §7.1.1.2
("An origin server MUST send a `Date` header field in all responses,
except [under restricted resource conditions]") and all three of our
upstream tile sources comply. The fallback rule is conservative: it
errs on the side of forgetting, not retaining — which is the user's
stated intent when shortening TTL.

To bound the runtime cost, `purgeExpired` reads cache entries in
batches of 256 with `await new Promise((r) => setTimeout(r, 0))`
between batches (yields the main thread). Worst case (4096 entries, all
needing inspection): 16 batches × ~25 ms each ≈ 400 ms wall-clock,
distributed across at least 16 frames so no single frame blocks more
than ~25 ms.

**Alternatives considered**:

- **Use `Last-Modified` instead of `Date`** — rejected; `Last-Modified`
  is the *resource* mtime (which for a tile may be years old), not the
  *cache write* time. We want "how long has this entry been on the
  device", not "how old is the underlying data".
- **Record write-time ourselves at SW write** — would require a custom
  SW (see D1's first alternative). Rejected for the same reason.
- **Use the `Age` response header** — only set by intermediary caches
  (proxies, CDNs); not reliable for direct tile responses.

---

## D3. Sheet anchored at top-right via the existing toolbar; gear is the **fourth** toolbar button

**Decision**: A new `<button>` sits as the rightmost child of the
existing top-right toolbar (`App.svelte`'s toolbar group), to the
right of `LocalePicker`'s opener. Tapping it opens the
`SettingsSheet.svelte` modal as a centred dialog (NOT anchored to the
gear, because the sheet's content is taller than the toolbar opener
can sensibly host).

Toolbar order, top-right (left → right):

```
[Go-to] [Format] [Layers] [Locale] [Settings (gear)]
```

The sheet itself uses the same modal pattern as
`LocalePicker.svelte`'s expanded form: `position: fixed`,
`inset: 0`, scrim overlay at `rgba(15, 23, 42, 0.6)`, panel anchored
top-centre with `max-width: 440px` and `border-radius: 12px`. Escape /
scrim-click dismiss.

**Rationale**: Settings is the lowest-frequency toolbar action; placing
it last in the toolbar (rightmost) follows the convention of every
mainstream map / app where Settings is "off to the side". Using a true
modal (rather than the popover-style `LocalePicker` open state) is
required because the sheet has 3 cache rows + TTL select + 4 buttons +
disclosure copy — too tall for a popover that drops down from the
toolbar.

**Conflict map** (existing surfaces from features 001–006):

| Surface                                       | Anchor                            | Owner       |
| --------------------------------------------- | --------------------------------- | ----------- |
| Toolbar (Go-to / Format / Layers / Locale)    | top-right                         | feature 003 |
| **Settings gear (NEW)**                       | **top-right, end of toolbar**     | feature 007 |
| `UpdatePrompt`                                | top-centre                        | feature 004 |
| Toast column (copy / zone / layer / offline)  | top-centre, ~32 px below header   | features 001–004 |
| Coordinate readout                            | bottom-left                       | feature 001 |
| Attribution badge                             | bottom-right (single-line)        | feature 003 |
| Compass + zoom controls                       | bottom-right above attribution    | feature 006 |
| Layer / Locale picker (popovers)              | top-right (toolbar-anchored)      | feature 003 |
| `InstallBanner` (Android/desktop)             | bottom-right above attribution    | feature 005 |
| `InstallIosSheet`                             | bottom-centre                     | feature 005 |
| **SettingsSheet (NEW)**                       | **modal centre, scrim background**| feature 007 |

**Alternatives considered**:

- **Settings as the leftmost toolbar item** — rejected; pushes the
  most-used items (Go-to, Format) to the right where they're harder
  to reach on right-handed thumb-typing.
- **Long-press on the attribution badge to open Settings** —
  rejected; non-discoverable; violates the principle that settings
  must be reachable in one tap from the home screen.
- **Bottom-right modal** — rejected; conflicts with both the install
  banner and the new compass + zoom cluster from feature 006.

---

## D4. TTL preset list: 1 / 3 / 7 / 14 / 30 / 60 / 90 days; rendered as a `<select>`

**Decision**: TTL is a `<select>` with seven `<option>` children (1, 3,
7, 14, 30, 60, 90). The default for new installs is 7 (matches
historical workbox default + matches the value most users would pick).
On change, the component:

1. Calls `saveTileTtlDays(value)` → `localStorage`.
2. Calls `purgeAllExpired(value)` → walks all three tile caches and
   deletes anything older than `value` days.
3. Re-reads counts via `countCacheEntries(name)` and re-renders the
   three rows.

**Rationale**: `<select>` is the most accessible widget for a small
discrete-choice set: a single tab stop, native screen-reader behaviour
on every platform, no custom keyboard handling needed. A slider with
discrete steps would also work but adds a custom component for no
gain. A free-form `<input type="number" min="1" max="90">` was
rejected because (a) it lets the user enter values outside the preset
set (e.g., 45 days), which has no clear semantic — workbox doesn't
care about the in-between values, only the ceiling — and (b) it
violates SC-007's "presets only" rule (which exists so the test surface
is finite and the UI is predictable).

The preset list is **fixed in source** under
`cachePolicy.TTL_OPTIONS = [1, 3, 7, 14, 30, 60, 90] as const` so it
is single-sourced for both the validator (preferences-v2) and the
component.

**Alternatives considered**:

- **Slider `<input type="range">` with discrete `step` snapping** —
  rejected; harder to label per-step on small screens; the snap
  behaviour is platform-inconsistent.
- **Three radio buttons (Short / Medium / Long)** — rejected; too
  coarse, hides the actual day count from the user, and a
  privacy-conscious user can't pick "1 day" without a tooltip.
- **Free numeric input** — rejected per above (value space too
  large; harder to test exhaustively).

---

## D5. Quota estimate: `navigator.storage.estimate()` rendered in MB, "≈" prefix, gracefully degrades

**Decision**: On each open of the sheet (and after each clear), call:

```ts
const r = await navigator.storage?.estimate?.();
const usageMb = r?.usage ? r.usage / (1024 * 1024) : null;
```

Render as `≈ 12 MB` (one decimal place, locale-aware separator via
`Number.prototype.toLocaleString`). If `navigator.storage` or
`.estimate` is missing (private-mode WebKit, very old Firefox), render
the localised "—" placeholder per FR-016.

The displayed figure is the **origin-wide** estimate, not per-cache;
the i18n string explicitly labels it (`settings.quota.estimateLabel`)
as "rough total" so the user does not infer a per-cache breakdown.

**Rationale**: `navigator.storage.estimate()` is the only browser-
provided API that returns origin-wide storage usage without iterating
every cache entry. Iterating cache entries to compute per-cache bytes
would require `Response.clone().blob().size` per entry × 4096 × 3
caches = up to ~12k blob materialisations on every sheet open. Even at
1 ms each that's 12 seconds — a non-starter.

The "≈" prefix is a small but important UX signal: the API explicitly
documents the result as an estimate (browsers may add randomised
padding to prevent storage-fingerprinting), and we mirror that
honesty. The user-explicit "粗略估計" framing in the spec request is
preserved verbatim by this design.

**Alternatives considered**:

- **Per-cache byte size by iterating Blob sizes** — rejected (perf;
  see above).
- **Show only the numeric value without "≈"** — rejected; misleads
  the user into treating it as exact.
- **Hide the quota line entirely** — rejected; the user explicitly
  asked for "粗略估計" of total usage.

---

## D6. Confirmation dialog: in-component, no `window.confirm`; native-`<dialog>` with focus trap

**Decision**: When the user taps "Clear all" or any per-row "Clear",
the component renders a `<dialog>` element (HTML5 native dialog,
opened via `dialog.showModal()`) with:

- A title (`settings.confirm.title`)
- A body that names what is about to be cleared (e.g., "Clear all
  cached map tiles?" / "Clear cached Google tiles?")
- Two buttons: "Cancel" (default) and "Clear" (danger styling).
- Escape closes (browser default for `showModal()`).
- Focus moves to "Cancel" on open (browser default for `showModal()`).
- Tab cycles within the dialog (browser default for `showModal()`).

The dialog reuses the `RecentChips.svelte` long-press delete dialog
pattern from feature 003 (`goto.recent.deleteConfirm.*` keys) — so the
visual + interaction language is already familiar to the user.

**Rationale**: `window.confirm()` is forbidden because (1) it blocks
the JS event loop, breaking our concurrent purge logic, (2) the visual
treatment is browser-controlled and inconsistent across our five
target browsers, and (3) it cannot be styled or localised within our
i18n framework. Native `<dialog>` is supported on all our targets (it
has been baseline since 2022 across Chromium, WebKit, and Firefox) and
gives focus trap, Escape close, and modal scrim **for free**, which
removes ~80 lines of accessibility plumbing we'd otherwise have to
write and test.

**Alternatives considered**:

- **`window.confirm()`** — rejected per above.
- **Custom modal `<div>` with hand-rolled focus trap** — feasible
  (`InstallBanner.svelte` does something similar) but reinvents what
  `<dialog>` gives us natively. We pay a ~400-byte gzipped delta
  versus rolling our own.
- **No confirmation, "Undo" toast instead** — rejected; the cache
  write that an undo would have to re-perform is not in our control
  (only the SW can re-populate caches via natural fetch). A failed
  undo would be more confusing than a confirmation up-front.

---

## D7. `preferences.ts` v1→v2 migration: additive fields, dual-version validator

**Decision**: Bump `PREFS_VERSION` from `1` to `2`. The validator
accepts BOTH `version: 1` and `version: 2`:

- `version: 1` → return the parsed object with `tileTtlDays = 7` AND
  `tileMaxEntries = 4096` (the defaults).
- `version: 2` → require `tileTtlDays` to be one of `TTL_OPTIONS` and
  `tileMaxEntries` to be one of `MAX_ENTRIES_OPTIONS`; drop the
  invalid field and substitute its default.

`savePreferences` always writes `version: 2`. After a single load+save
cycle the on-disk record is upgraded.

```ts
export interface FormatPreferencesV2 extends FormatPreferencesV1 {
  readonly version: 2;
  readonly tileTtlDays: TtlDays;          // [1, 3, 7, 14, 30, 60, 90]
  readonly tileMaxEntries: TileMaxEntries; // [256, 512, 1024, 2048, 4096, 8192]
}

export type FormatPreferences = FormatPreferencesV2;
```

**Rationale**: This follows ADR 0021 ("additive prefs evolution") to
the letter — never remove a field, only add. Keeping both versions
parseable means a user who rolls back to a pre-007 build can still
read their preferences (the field is silently dropped by the v1
validator's whitelist behaviour).

The `tileTtlDays` field is `readonly TtlDays` (a literal-union type
of the seven preset values), so the type system enforces that no
caller can pass an out-of-range value without a cast.

**Alternatives considered**:

- **Drop v1 support entirely** — rejected; a user mid-migration who
  loads the old build would lose their preferences (fail-back to
  defaults). Cheap to support both.
- **Store TTL / max-entries in separate localStorage keys** — rejected;
  the prefs blob is already the canonical home for per-user app
  preferences (locale, format selection, MGRS precision, map layer).
  Splitting cache settings out introduces extra storage keys for no
  gain.
- **Add only `tileTtlDays` and treat max-entries as a separate v3
  bump later** — rejected; adding both fields in the same v2 bump
  costs nothing extra (both are independent additive fields with
  the same dual-validator pattern) and avoids a second migration
  step in three months' time.

---

## D8. Pure modules accept injected `caches` / `storage` for testability

**Decision**: All three new modules export functions that accept
optional dependency-injection parameters:

```ts
// cacheStats.ts
export async function countCacheEntries(
  name: string,
  storage: CacheStorage = globalThis.caches,
): Promise<number>;

export async function estimateQuota(
  storage: { estimate?: () => Promise<StorageEstimate> } | undefined =
    globalThis.navigator?.storage,
): Promise<{ usage: number | null; quota: number | null }>;

// cachePurge.ts
export async function clearCache(
  name: string,
  storage: CacheStorage = globalThis.caches,
): Promise<{ deleted: number }>;

export async function clearAllTileCaches(
  storage: CacheStorage = globalThis.caches,
): Promise<{ perCache: Record<string, number> }>;

export async function purgeExpired(
  name: string,
  ttlDays: number,
  now: number = Date.now(),
  storage: CacheStorage = globalThis.caches,
): Promise<{ deleted: number; kept: number }>;

export async function enforceMaxEntries(
  name: string,
  cap: number,
  storage: CacheStorage = globalThis.caches,
): Promise<{ deleted: number; kept: number }>;

export async function enforceCachePolicy(
  ttlDays: number,
  cap: number,
  now: number = Date.now(),
  storage: CacheStorage = globalThis.caches,
): Promise<{ perCache: Record<string, { deleted: number; kept: number }> }>;
```

Tests pass a hand-rolled `CacheStorage`-shaped fake (a `Map<string,
Map<string, Response>>`) and a `now` literal. Production callers use
the defaults.

**Rationale**: Mirrors the test-doubles pattern in
`tests/unit/storage/recents.spec.ts` (which injects a fake `Storage`).
Avoiding `vi.mock('caches')` keeps the modules' dependencies explicit
in their type signatures and removes any reliance on Vitest's
auto-mocking magic. The fake `CacheStorage` lives in
`tests/unit/helpers/cacheStorageFake.ts` (a single ~40-line file that
implements the four methods we use: `open`, `delete`, `keys`, and the
returned `Cache`'s `keys` / `match` / `delete`).

**Alternatives considered**:

- **`vi.mock('global').caches`** — rejected; brittle, hides the
  dependency, makes the modules harder to read.
- **Take a fully-typed `CacheStorage` adapter interface** — rejected;
  unnecessary indirection. The structural interface
  `{ open, delete, ... }` works directly.

---

## D9. The `clearAllTileCaches` function MUST refuse to touch `workbox-precache-v2-*`

**Decision**: `clearAllTileCaches` does NOT iterate
`storage.keys()` (which would return all cache names including
`workbox-precache-v2-*`). It iterates the **fixed array** `TILE_CACHE_NAMES =
['osm-tiles', 'nlsc-tiles', 'google-tiles']` from `cachePolicy.ts`
and calls `clearCache(name)` for each. Adding a new tile source in a
future feature is a one-line edit to `TILE_CACHE_NAMES`.

A unit test asserts that, given a fake storage containing
`['osm-tiles', 'nlsc-tiles', 'google-tiles', 'workbox-precache-v2-...']`,
`clearAllTileCaches` empties the first three and leaves the precache
**bit-identical**.

**Rationale**: This is the load-bearing safety check for FR-014. The
precache holds the app shell that lets the PWA launch offline; deleting
it would silently break the offline-ready promise that feature 004's
toast advertises. Encoding the safety check as "explicit allowlist" (as
opposed to "denylist `workbox-precache-v2-*`") is more robust because
a future workbox version that renames the precache to e.g.
`workbox-precache-v3-*` would still be safe.

**Alternatives considered**:

- **Iterate `caches.keys()` and skip names that start with
  `workbox-`** — rejected; depends on workbox naming, which we don't
  own.
- **Have the SW expose a `clearTileCaches` message handler we call
  from page context** — rejected; adds cross-context message plumbing
  for no gain. The page can call `caches.delete()` directly.

---

## D11. MaxEntries preset list + oldest-first deletion via `cache.keys()` insertion order

**Decision**: Per-cache entry limit is a `<select>` with six `<option>`
children: 256, 512, 1024, 2048, 4096, 8192 (powers of two). The
default for new installs is 4096 (the value the application
historically shipped with as the workbox `maxEntries`). On change,
the component:

1. Calls `saveTileMaxEntries(value)` → `localStorage`.
2. Calls `enforceCachePolicy()` → for each tile cache, if the current
   key count exceeds the new limit, walks `cache.keys()` and deletes
   the **first** `(count - limit)` keys via `cache.delete(req)`.
3. Re-reads counts via `countCacheEntries(name)` and re-renders the
   three rows.

The per-cache entry limit is a **per-cache** cap (i.e., each of OSM /
NLSC / Google may hold up to `limit` entries), matching the workbox
config's per-rule `maxEntries`. It is NOT a sum across the three
caches — that would require a cross-cache LRU which the platform
does not provide.

**Rationale on deletion order**: The Cache API spec
(WHATWG / MDN) guarantees that `cache.keys()` returns request keys
"in the order they were inserted into the cache." Workbox writes to
the cache only via `cache.put(req, res)` from the fetch interceptor,
in chronological order as the user pans/zooms. Therefore the first
keys returned by `cache.keys()` are the oldest writes. Deleting from
the front of the iterator is an O(delta) approximation of "delete
oldest first" that does NOT require reading per-entry date headers
(unlike `purgeExpired`'s D2 approach).

The approximation is imperfect after partial-deletes (a previous
`purgeExpired` cycle leaves "holes" in the iteration, then subsequent
inserts append to the end — so the iteration order is no longer
perfectly chronological). For the purpose of "trim the cache near
the user-chosen cap" this slop is immaterial; spec assumption
explicitly tolerates it.

**Why not date-header sort like `purgeExpired`?**: At 8192 entries × 1
ms per `cache.match` × 1 sort = ~10 s wall-clock, far over the
budget. Insertion-order deletion is O(delta) — typical case for
"4096 → 1024" trims ~3000 entries in <500 ms (D11 perf budget).

**Why per-cache (not summed)?**: The platform's `Cache` namespaces
are independent; there is no "evict from any cache" operation. To
sum across caches we'd have to reconstruct a global LRU by reading
date headers from all three caches every time — same perf cliff as
above.

**Why these six values (powers of two)?**: 256 is the smallest cap
that gives a usable single-screen pan radius (~9 viewport-fulls of
tiles around the centre at zoom 13). 8192 matches the workbox-
documented default upper bound for raster runtime caches on
PWA-friendly devices. Powers of two between read as "this is a
technical limit knob, not a UX dial" — which matches our intent of
"keep the choice space small and exhaustively testable" (D4
rationale, mirrored).

**Alternatives considered**:

- **Sort by date header before deleting** — rejected (perf cliff
  above).
- **Delete from the end of `cache.keys()`** — would delete the
  newest entries, which is the opposite of the user's intent
  (the most-recently-visited tiles are what they want to keep
  cached for the fastest reload).
- **Slider / radio / numeric input** — rejected per D4
  rationale (same arguments apply).
- **Single global cap summed across caches** — rejected per
  "Why per-cache" above.

---

## D12. TDD ordering reaffirmation

**Decision**: Constitution Principle II (Test-First Development —
NON-NEGOTIABLE) is restated explicitly because feature 007 has THREE
high-risk areas:

1. **`clearAllTileCaches` MUST NOT delete the precache** (D9). A
   regression here would silently break offline launch on the next
   refresh, with no console error.
2. **`purgeExpired` MUST NOT delete fresh entries**. A regression
   here (e.g., off-by-one on the `>` vs `>=` comparator) would
   over-aggressively wipe usable cache entries every time the app
   starts.
3. **`enforceMaxEntries` MUST delete oldest-first and stop exactly
   at `cap`**. A regression here (e.g., off-by-one, wrong iteration
   direction, or stopping too early) would either silently keep the
   cache over the user's chosen limit OR over-delete and waste the
   user's cached tiles.

The TDD discipline is:

1. Write the unit spec for the behaviour.
2. Run `npm test` and confirm the spec is **RED** (it must fail
   because the behaviour is not yet implemented).
3. Implement only enough production code to turn the spec green.
4. Refactor with the test green.

The three safety properties above MUST land their unit tests BEFORE
any production code in `cachePurge.ts`.

**Rationale**: Same as research D9 in feature 006 — the cost of a
regression in any of these areas is silently degraded user
experience that no automated CI other than these tests can catch.
Test-first is the cheapest preventive measure.

**Alternatives considered**: None. TDD is non-negotiable per
constitution.

---

## Cross-decision matrix

| ID  | Affects                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- |
| D1  | `vite.config.ts`, `cachePolicy.ts`, `cachePurge.ts`, `main.ts`                                     |
| D2  | `cachePurge.ts` (`purgeExpired`), `cachePurge.spec.ts`                                             |
| D3  | `App.svelte`, `SettingsSheet.svelte`, `docs/ui/0007-settings-tile-cache.md`                        |
| D4  | `cachePolicy.ts` (`TTL_OPTIONS`), `SettingsSheet.svelte`, `preferences.ts` validator               |
| D5  | `cacheStats.ts` (`estimateQuota`), `SettingsSheet.svelte`, i18n keys                               |
| D6  | `SettingsSheet.svelte` (dialog block), integration test                                            |
| D7  | `preferences.ts`, `preferences-v2.spec.ts`, ADR 0027                                                |
| D8  | All three new pure modules + `tests/unit/helpers/cacheStorageFake.ts`                              |
| D9  | `cachePurge.ts` (`clearAllTileCaches`), `cachePurge.spec.ts`, ADR 0027                             |
| D11 | `cachePolicy.ts` (`MAX_ENTRIES_OPTIONS`), `cachePurge.ts` (`enforceMaxEntries`), `SettingsSheet.svelte`, `preferences.ts` validator, ADR 0027 |
| D12 | `tasks.md` ordering                                                                                |
