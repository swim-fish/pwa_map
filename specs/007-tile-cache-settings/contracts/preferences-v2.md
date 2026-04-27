# Contract: `preferences.ts` v1→v2 amendment

**Module**: `src/storage/preferences.ts` (AMENDED, in place)
**Verifies**: spec FR-006, FR-007, FR-019; research D7.

This contract describes ONLY the v2-related changes. The v1 surface
(`loadPreferences` / `savePreferences` / `loadLastView` /
`saveLastView`) keeps its existing semantics for the v1 fields.

## §1. New types

```ts
import type { TtlDays, TileMaxEntries } from '$pwa/cachePolicy';

export interface FormatPreferencesV2 {
  readonly version: 2;

  // === inherited verbatim from v1 ===
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;

  // === new in v2 ===
  readonly tileTtlDays: TtlDays;
  readonly tileMaxEntries: TileMaxEntries;
}

export type FormatPreferences = FormatPreferencesV2;
```

The v1 interface (`FormatPreferencesV1`) is renamed to that explicit
name and kept in the same file for the migration path; `interface
FormatPreferences` becomes the alias `FormatPreferencesV2`. All
existing callers continue to use `FormatPreferences` — they
automatically pick up the v2 shape.

## §2. New `PREFS_VERSION` constant

```ts
const PREFS_VERSION = 2 as const;
```

## §3. New defaults

`defaultPreferences()` now sets:

```ts
return {
  version: 2,
  visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs'],
  mgrsPrecision: 5,
  taipowerPrecision: 9,
  locale: 'zh',
  mapLayer: 'nlsc-emap5',
  overlay: false,
  tileTtlDays: DEFAULT_TILE_TTL_DAYS,        // 7
  tileMaxEntries: DEFAULT_TILE_MAX_ENTRIES,  // 4096
};
```

## §4. Validator changes (`validatePreferences`)

The validator now accepts BOTH `version: 1` and `version: 2`:

| Input                                                      | Returns                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ version: 1, ... }` with v1 fields valid                 | A v2 object: all v1 fields preserved, `version: 2`, `tileTtlDays: 7`, `tileMaxEntries: 4096`.                                                                          |
| `{ version: 1, ... }` with v1 fields INVALID               | `null` (existing behaviour preserved).                                                                                                                                  |
| `{ version: 2, ..., tileTtlDays: 7, tileMaxEntries: 4096 }` | The v2 object verbatim.                                                                                                                                                 |
| `{ version: 2, ..., tileTtlDays: 999 }`                    | A v2 object with `tileTtlDays: 7` (default substituted), other fields preserved.                                                                                       |
| `{ version: 2, ..., tileMaxEntries: 99 }`                  | A v2 object with `tileMaxEntries: 4096` (default substituted), other fields preserved.                                                                                 |
| `{ version: 2, ..., tileTtlDays: undefined }`              | A v2 object with `tileTtlDays: 7` (default substituted).                                                                                                                |
| `{ version: 2, ..., tileMaxEntries: undefined }`           | A v2 object with `tileMaxEntries: 4096`.                                                                                                                                |
| Anything with `version` not in `{1, 2}`                    | `null` (existing behaviour preserved).                                                                                                                                  |

The v1 validator's existing logic for the inherited fields is reused
verbatim; only two new field-level checks are added:

```ts
const isTtlDays = (v: unknown): v is TtlDays =>
  typeof v === 'number' && (TTL_OPTIONS as readonly number[]).includes(v);

const isMaxEntries = (v: unknown): v is TileMaxEntries =>
  typeof v === 'number' && (MAX_ENTRIES_OPTIONS as readonly number[]).includes(v);
```

## §5. New helpers

For ergonomics from the SettingsSheet (avoid round-tripping the whole
prefs blob just to read or write one field):

```ts
export function loadTileTtlDays(): TtlDays;          // → loadPreferences().tileTtlDays
export function saveTileTtlDays(v: TtlDays): void;   // → load, copy with new value, save
export function loadTileMaxEntries(): TileMaxEntries;
export function saveTileMaxEntries(v: TileMaxEntries): void;
```

The `save*` helpers are NOT separate storage writes; they internally
call `loadPreferences()` → object spread with the new value → `savePreferences(...)`.
This keeps the storage record atomic and avoids partial-write races.

## §6. Forward / backward compatibility matrix

| Stored shape                          | Loaded by v1 build                       | Loaded by v2 build                                      |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| v1 record                             | Round-trips exactly.                     | Migrated to v2 with default `tileTtlDays`, `tileMaxEntries`. |
| v2 record (new fields valid)          | v1 validator drops `tileTtlDays` / `tileMaxEntries` (unknown keys); existing v1 fields preserved. **Future writes from the v1 build will overwrite to a v1 record, dropping the v2 fields.** This is the documented cost of rolling back a build. | Round-trips exactly.                                    |
| v2 record with `tileTtlDays: 999`     | (same as above)                           | Substitutes default `7`; other fields preserved.        |

## §7. What this module MUST NOT do

- MUST NOT remove or rename any v1 field.
- MUST NOT change the `PREFS_KEY` (`'pwa_map:prefs'`).
- MUST NOT change the `LAST_VIEW_KEY` (`'pwa_map:lastView'`) or the
  `MapViewState` validator (out of scope).
- MUST NOT introduce a new storage key.

## §8. Required tests

`tests/unit/storage/preferences-v2.spec.ts` MUST cover:

1. **`loadPreferences returns defaults when storage is empty`** — both
   `tileTtlDays === 7` and `tileMaxEntries === 4096`.
2. **`v1 record is upgraded with default v2 fields on load`** —
   write a v1 record by hand, call `loadPreferences()`, assert the
   v2 fields are at their defaults and v1 fields are preserved.
3. **`v2 record round-trips`** — for each `(ttl, max) ∈ TTL_OPTIONS ×
   MAX_ENTRIES_OPTIONS` (42 combinations), write via
   `savePreferences`, read via `loadPreferences`, assert equality.
4. **`out-of-range tileTtlDays is reset to default`** — store
   `{ version: 2, ..., tileTtlDays: 45 }`, load returns
   `tileTtlDays === 7`.
5. **`out-of-range tileMaxEntries is reset to default`** — store
   `{ version: 2, ..., tileMaxEntries: 9999 }`, load returns
   `tileMaxEntries === 4096`.
6. **`undefined v2 fields are populated with defaults`** — store
   `{ version: 2, ... }` lacking the two new keys, load returns the
   defaults.
7. **`loadTileTtlDays / saveTileTtlDays round-trip`** for each of the
   seven preset values.
8. **`loadTileMaxEntries / saveTileMaxEntries round-trip`** for each
   of the six preset values.
9. **`saveTileTtlDays preserves the rest of the prefs`** —
   `saveTileTtlDays(30)` followed by `loadPreferences()` returns the
   pre-existing `locale`, `mapLayer`, `mgrsPrecision`, etc., unchanged.
10. **`saveTileMaxEntries preserves the rest of the prefs`** — same
    pattern.
11. **`unknown version returns null from validator`** —
    `{ version: 3, ... }` → `loadPreferences` returns the defaults
    (because `validatePreferences` returns `null` for unknown
    versions, and the existing fallback path applies).
