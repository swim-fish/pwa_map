# Phase 1 Data Model — Settings About + Mobile Fixes + 3D / Terrain Lockdown

**Feature**: 012-settings-about-and-mobile-fixes
**Date**: 2026-04-28
**Plan**: [plan.md](./plan.md)

This feature is **lockdown-config + presentational** end-to-end: it
does not persist state, does not mutate the wire format, and does not
introduce a client-side schema migration. Three of the four user
stories (US2 narrow viewport, US3 About section, US4 README) are
purely presentational; only US1 (3D / Terrain lockdown) introduces a
new in-memory data shape — the lockdown register — which downstream
modules consume at construction / assembly time. That register is
captured here so the contracts and the tests have a single
authoritative reference.

## Persisted state

**None added.** No `localStorage` key is created, read, written, or
removed by this feature. The dismissal-timestamp key
(`pwa_map:installDismissedUntil`, ADR 0025), the preferences blob
(`pwa_map:prefs`, ADR 0021), the recents blob
(`pwa_map:gotoHistory_v1`, ADR 0018), and every tile cache name
(ADR 0027) are unchanged.

## In-memory data: the 3D / Terrain lockdown register

### Type surface

```ts
// src/map/threeDLockdown.ts (NEW)

/**
 * The closed set of MapLibre 3D / Terrain capability classes the app
 * deliberately keeps off in this version. Adding a new class
 * requires (a) a new entry here, (b) a new consumer rule in the
 * relevant call site, and (c) a new runtime assertion in the test
 * suite.
 */
export type LockdownClass =
  | 'pitch'
  | 'sky'
  | 'globe'
  | 'terrain'
  | 'fillExtrusion'
  | 'hillshade';

/**
 * Per-class registry entry.
 *
 * `lockedValue` is the value the class is locked to — interpreted
 * by the consumer of that class (e.g. for `'pitch'` it is the
 * MapLibre `maxPitch` numeric ceiling; for `'sky'` it is the
 * boolean `false` meaning "no sky layer in the assembled style").
 *
 * `reEnableHint` is a one-line operator instruction for a future
 * "enable 3D" feature — describes the EXACT call sites that must
 * change and (when applicable) the option name to flip.
 */
export interface LockdownEntry<TLocked> {
  readonly class: LockdownClass;
  readonly lockedValue: TLocked;
  readonly reEnableHint: string;
}

export interface LockdownRegister {
  readonly pitch: LockdownEntry<0>;                 // numeric maxPitch ceiling
  readonly sky: LockdownEntry<false>;               // boolean: false means strip
  readonly globe: LockdownEntry<'mercator'>;        // projection literal
  readonly terrain: LockdownEntry<null>;            // `setTerrain(...)` argument always null
  readonly fillExtrusion: LockdownEntry<false>;     // boolean: false means strip
  readonly hillshade: LockdownEntry<false>;         // boolean: false means strip
}

export const LOCKDOWN_REGISTER: LockdownRegister;
```

### Required values (locked baseline)

| Class | Locked value | Consumed by | How re-enable works |
|-------|--------------|-------------|---------------------|
| `pitch` | `0` (numeric `maxPitch` ceiling) | `MapView.svelte` construction options (`maxPitch`); also `touchPitch: false` flag set unconditionally alongside | Raise the `lockedValue` to e.g. `60`; map auto-respects the new ceiling without further changes |
| `sky` | `false` | `styleBuilder.ts` post-processing (delete `style.sky`) | Flip to `true`; remove the `delete style.sky` line; add a sky source/layer to a basemap definition |
| `globe` | `'mercator'` | `MapView.svelte` construction options (`projection`) | Change the locked literal to `'globe'`; the construction option propagates the new value |
| `terrain` | `null` | `MapView.svelte` (never calls `setTerrain`); `src/map/sources.ts` (no terrain DEM source registered) | Add a terrain RGB DEM source to `MAP_SOURCES`; call `map.setTerrain({ source: '<id>', exaggeration: ... })` in `MapView.svelte`'s post-style hook |
| `fillExtrusion` | `false` | `styleBuilder.ts` post-processing (filter `layer.type === 'fill-extrusion'`) | Flip to `true`; remove the corresponding filter clause; add a vector source + fill-extrusion layer |
| `hillshade` | `false` | `styleBuilder.ts` post-processing (filter `layer.type === 'hillshade'`) | Flip to `true`; remove the corresponding filter clause; add a terrain RGB DEM source + hillshade layer |

### Freeze invariants

- `LOCKDOWN_REGISTER` MUST be `Object.freeze`d at module load.
- Each `LockdownEntry` object inside the register MUST also be
  `Object.freeze`d.
- Tests MUST assert that mutation attempts (e.g.,
  `(LOCKDOWN_REGISTER as any).pitch.lockedValue = 60`) silently
  fail in strict mode (or throw in dev mode).
- The set of keys on `LOCKDOWN_REGISTER` MUST be exactly the six
  literals listed above. A test asserts
  `Object.keys(LOCKDOWN_REGISTER).sort()` equals
  `['fillExtrusion', 'globe', 'hillshade', 'pitch', 'sky', 'terrain']`.

### Import contract

| Consumer | What it imports | What it does with it |
|----------|-----------------|----------------------|
| `src/components/MapView.svelte` | `LOCKDOWN_REGISTER.pitch.lockedValue`, `LOCKDOWN_REGISTER.globe.lockedValue` | Sets `maxPitch` and `projection` in `new maplibregl.Map({...})` options. Also unconditionally sets `touchPitch: false`. Never calls `map.setTerrain(...)`. |
| `src/map/styleBuilder.ts` | `LOCKDOWN_REGISTER.sky`, `LOCKDOWN_REGISTER.fillExtrusion`, `LOCKDOWN_REGISTER.hillshade` | Post-processes `buildStyle` output: deletes `style.sky` if `LOCKDOWN_REGISTER.sky.lockedValue === false`; filters layers whose `type` matches a class with `lockedValue === false`. |
| `src/map/sources.ts` | The type `LockdownClass` (for documentation purposes only) | JSDoc cross-reference forbidding the registration of a terrain RGB DEM source. No runtime use; the import exists so an IDE jump-to-symbol surfaces the lockdown context. |

Consumers MUST NOT hard-code the locked values in their own source —
the registry is the single source of truth.

## Visible content data: Settings About area

The About section renders three pieces of human-readable text and
two URLs. Text comes from i18n, URLs are hard-coded constants.

### i18n keys (all three locales required)

| Key | English text | Notes |
|-----|--------------|-------|
| `settings.about.heading` | `About` | Section heading. Translated to `關於` in `zh.json` and `アプリについて` in `ja.json`. |
| `settings.about.liveMap` | `Live map` | Anchor text for the live deployment link. |
| `settings.about.sourceCode` | `Source code` | Anchor text for the GitHub repository link. |

The locale-key parity rule
(`tests/unit/i18n/controls-keys-parity.spec.ts` + a new focused
spec at `tests/unit/i18n/settings-about-keys-parity.spec.ts`) MUST
pass — all three keys MUST exist in `zh.json`, `en.json`, and
`ja.json`.

### URL constants

| Constant | Value |
|----------|-------|
| Live map URL | `https://swim-fish.github.io/pwa_map/` |
| Source code URL | `https://github.com/swim-fish/pwa_map` |

These are inline string literals in `SettingsSheet.svelte`. They are
not translated and not exported — there is no shared constant module
for URLs because they appear in only two places (the in-app link and
`README.md`), and centralising for two consumers is YAGNI.

## Visible content data: README

`README.md` gains a one-line bold-prefix link near the top:

```markdown
**Live demo**: <https://swim-fish.github.io/pwa_map/>
```

A unit test (`tests/unit/readme-live-link.spec.ts`) loads the file as
text and asserts the URL appears within the first 30 lines.

## CSS data: Go-To narrow-viewport breakpoint

Each Go-To layout component grows a single `@media` block:

```css
@media (max-width: calc(360px - 0.02px)) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

The `360px` literal is the breakpoint between "narrow phone (collapse)"
and "regular phone or larger (preserve current layout)". The literal
is the same for every Go-To layout (per research.md §R5) and is not
extracted to a shared CSS variable (single-use across 6 sites).
