# Contract — Preferences v4 + `locateFrequency` field

`pwa_map:prefs` schema bumps from v3 → v4 with one new field.
Migration follows ADR 0021's additive-evolution pattern.

## Schema diff

```diff
+export type LocateFrequencyPreset = 'smart' | 'fast' | 'slow';
+
+const LOCATE_FREQUENCIES: readonly LocateFrequencyPreset[] = ['smart', 'fast', 'slow'] as const;
+
+function isLocateFrequency(v: unknown): v is LocateFrequencyPreset {
+  return typeof v === 'string'
+    && (LOCATE_FREQUENCIES as readonly string[]).includes(v);
+}
+
-const PREFS_VERSION = 3 as const;
+const PREFS_VERSION = 4 as const;

-export interface FormatPreferencesV3 {
-  readonly version: 3;
+export interface FormatPreferencesV4 {
+  readonly version: 4;
   readonly visible: readonly CoordinateKind[];
   readonly mgrsPrecision: MGRSPrecision;
   readonly taipowerPrecision: TaipowerPrecision;
   readonly locale: Locale;
   readonly mapLayer?: BasemapId;
   readonly overlay?: boolean;
   readonly tileTtlDays: TtlDays;
   readonly tileMaxEntries: TileMaxEntries;
   readonly formatOrder: readonly CoordinateKind[];
+  readonly locateFrequency: LocateFrequencyPreset;
 }

-export type FormatPreferences = FormatPreferencesV3;
+export type FormatPreferences = FormatPreferencesV4;
+
+/* The v3 interface is RETAINED in source for the migration path
+ * (mirrors the pattern used for v1 / v2). It is not exported. */
+interface FormatPreferencesV3 { …unchanged… }
```

`defaultPreferences()` adds `locateFrequency: 'smart'` to its
return shape (FR-023).

`__TESTING__` exports add `LOCATE_FREQUENCIES` and a new constant
`LOCATE_FREQUENCY_DEFAULT = 'smart'` for explicit migration
assertion.

## Validator changes

`validatePreferences(raw)` accepts `version` ∈ {1, 2, 3, 4}
(unchanged: rejects `version` outside this set, returns
`null`). The new clause:

```ts
const versionAllowsLocateFrequency = o.version === 4;
const locateFrequency: LocateFrequencyPreset =
  versionAllowsLocateFrequency && isLocateFrequency(o.locateFrequency)
    ? o.locateFrequency
    : 'smart';
```

The returned object includes `locateFrequency`. v1 / v2 / v3
records, or a v4 record with a missing / invalid
`locateFrequency`, all silently fall back to `'smart'` (FR-026).

## Migration matrix (verified by `tests/unit/preferences-v4-migration.spec.ts`)

| Stored input                                               | Migrated output `locateFrequency` |
|------------------------------------------------------------|-------------------------------------|
| `{ version: 4, …, locateFrequency: 'smart' }`              | `'smart'` |
| `{ version: 4, …, locateFrequency: 'fast' }`               | `'fast'` |
| `{ version: 4, …, locateFrequency: 'slow' }`               | `'slow'` |
| `{ version: 4, …, locateFrequency: 'turbo' }`              | `'smart'` (fallback) |
| `{ version: 4, … }` (field absent)                         | `'smart'` (fallback) |
| `{ version: 3, …, formatOrder: [...] }`                    | `'smart'` (additive migration) |
| `{ version: 2, … }`                                        | `'smart'` |
| `{ version: 1, … }`                                        | `'smart'` |
| invalid JSON / missing key                                 | `defaultPreferences()` (full fallback) |
| `{ version: 5, … }` (future version, unknown)              | full fallback (validator rejects unknown version) |

## Read / write public surface (unchanged shape, augmented behaviour)

```ts
export function loadPreferences(): FormatPreferences;
export function savePreferences(prefs: FormatPreferences): void;
```

These are the public APIs `SettingsSheet.svelte` and
`geolocationController.ts` consume. Reading returns a v4 record;
writing serialises a v4 record (write-only-the-current-version
discipline, same as features 007 / 010).

A new convenience pair:

```ts
export function loadLocateFrequency(): LocateFrequencyPreset;
export function saveLocateFrequency(value: LocateFrequencyPreset): void;
```

Mirrors `loadTileTtlDays` / `saveTileTtlDays` from feature 007.
The savers internally call `loadPreferences()` + spread + save
to remain serialisation-safe across concurrent edits.

## ADR cross-reference

The bump is governed by ADR 0021 (`prefs-additive-evolution.md`).
The `0033-locate-gesture-and-frequency.md` ADR cites 0021 as a
load-bearing precedent in its "Consequences" section.

## Test contract — `tests/unit/preferences-v4-migration.spec.ts`

Required cases:

1. v4 round-trip — write `{ version: 4, …, locateFrequency: 'fast' }`
   → read returns the same value.
2. v4 with invalid frequency falls back to `'smart'`.
3. v4 with missing frequency falls back to `'smart'`.
4. v3 record migrates: `loadPreferences()` returns
   `version: 4, locateFrequency: 'smart'`.
5. v2 record migrates: same.
6. v1 record migrates: same.
7. Unknown version (5+) → full `defaultPreferences()` fallback.
8. Corrupt JSON → full `defaultPreferences()` fallback.
9. `defaultPreferences().locateFrequency === 'smart'`.
10. `loadLocateFrequency()` reads the stored value.
11. `saveLocateFrequency('slow')` round-trips and does NOT clobber
    other fields (reads existing prefs, swaps the field, writes).
