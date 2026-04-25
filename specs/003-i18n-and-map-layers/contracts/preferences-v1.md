# Contract: `pwa_map:prefs` schema (additive evolution)

**Feature**: `003-i18n-and-map-layers` (extends feature 001's schema)
**Surface**: `src/storage/preferences.ts`
**Consumers**: `App.svelte`, `LayerPicker.svelte`,
`LocalePicker.svelte`, integration + E2E tests.

This contract pins the additive fields (`mapLayer`, `overlay`) and
the validation rules. **No version bump from `version: 1`** — see
research D4.

---

## 1. Schema (extended)

```ts
import type { BasemapId } from '$map/sources';

export interface FormatPreferences {
  readonly version: 1;
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId; // NEW
  readonly overlay?: boolean;    // NEW
}
```

---

## 2. Validation rules (extending `validatePreferences`)

A persisted blob is **valid** iff (in addition to feature 001's
rules):

1. If `mapLayer` is present, it MUST equal one of:
   `'osm-standard' | 'nlsc-emap5' | 'google-hybrid' |
    'google-satellite' | 'google-terrain' | 'google-roadmap'`.
   Otherwise the entire blob is rejected.
2. If `overlay` is present, it MUST be a boolean.
   Otherwise the entire blob is rejected.
3. Absence of either field is valid; the validator returns the blob
   with the field omitted (defaults are applied at the consumer
   layer).

**Any validation failure → return `defaultPreferences()` (existing
pattern).**

---

## 3. Defaults

```ts
export function defaultPreferences(): FormatPreferences {
  return {
    version: 1,
    visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs'],
    mgrsPrecision: 5,
    taipowerPrecision: 9,
    locale: seedLocaleFromNavigator(),
    mapLayer: 'osm-standard',
    overlay: false,
  };
}
```

The defaults helper now sets concrete values for the new fields so
that downstream consumers can always read non-undefined values.

---

## 4. Persistence interactions

- Reading: any caller that wants the layer state reads
  `prefs.mapLayer ?? 'osm-standard'` and `prefs.overlay ?? false`.
- Writing: the writer always serialises both fields (they are
  always set in `defaultPreferences`), so on-disk blobs from
  feature 003 onwards always contain them.
- Backwards compat: pre-003 blobs (no `mapLayer` / `overlay`) load
  via the existing validator and the consumer applies defaults.
- Forward compat: future schema changes that need to break
  compatibility MUST bump `version` to 2 and migrate.

---

## 5. Test obligations

`tests/unit/storage/preferences.spec.ts` MUST cover (extending
existing tests):

1. **Pre-003 prefs blob** (no `mapLayer` / `overlay`) loads
   successfully; the validator returns it; consumer applies
   defaults.
2. **Round-trip** — `savePreferences` then `loadPreferences` returns
   `mapLayer` and `overlay` exactly.
3. **`mapLayer` invalid id** (`'foo'`) → entire blob rejected →
   `loadPreferences` returns defaults.
4. **`mapLayer` overlay id** (`'google-road-overlay'`) → rejected
   (overlay is not a basemap).
5. **`overlay` non-boolean** (string `"true"`) → rejected.
6. **Default helper** sets `mapLayer === 'osm-standard'` and
   `overlay === false`.
