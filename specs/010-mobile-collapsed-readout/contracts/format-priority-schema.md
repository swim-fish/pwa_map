# Contract: Format priority schema (`FormatPreferencesV3`)

**Feature**: 010-mobile-collapsed-readout
**Surface**: TypeScript module `src/storage/preferences.ts`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-006, FR-007, FR-011, FR-014 · **Spec SCs**: SC-003, SC-005

## Public surface

```ts
// src/storage/preferences.ts (excerpt — additive)

export interface FormatPreferencesV3 extends FormatPreferencesV2 {
  readonly version: 3;
  readonly formatOrder: readonly CoordinateKind[]; // length === 6, permutation of ALL_COORDINATE_KINDS
}

export type FormatPreferences = FormatPreferencesV3;

export const PREFS_VERSION = 3 as const;

export const DEFAULT_FORMAT_ORDER: readonly CoordinateKind[] = [
  'wgs84-dd',
  'wgs84-dms',
  'twd97-tm2',
  'twd67-tm2',
  'mgrs',
  'taipower',
] as const;

export function defaultPreferences(): FormatPreferences;       // SHIPS taipowerPrecision: 11
export function loadPreferences(): FormatPreferences;          // migrates v1 / v2 → v3 silently
export function savePreferences(prefs: FormatPreferences): void;
```

## Invariants

1. **Length = 6.** `formatOrder.length === ALL_COORDINATE_KINDS.length` on every successful load and save.
2. **Permutation.** `new Set(formatOrder).size === 6` and every entry passes `isCoordinateKind`.
3. **Visible-subset.** Every entry of `visible` appears in `formatOrder`; the order of `visible` is a strictly-increasing subsequence of `formatOrder`.
4. **Default-on-fresh.** With no stored record, `loadPreferences()` returns a value where `formatOrder` deep-equals `DEFAULT_FORMAT_ORDER` AND `taipowerPrecision === 11`.
5. **Preserve-on-upgrade.** With a stored v1 / v2 record, `loadPreferences()` returns a v3 where `formatOrder = DEFAULT_FORMAT_ORDER` AND `taipowerPrecision = (stored.taipowerPrecision ?? defaults)`. The stored `taipowerPrecision` is **never** silently mutated.
6. **Corrupted-formatOrder fallback.** A v3 record with malformed `formatOrder` (wrong length / dup / unknown kind / fails the visible-subset invariant) loads with `formatOrder = DEFAULT_FORMAT_ORDER`; unrelated v3 fields survive.

## Verification

| Spec | Asserts |
| ---- | ------- |
| `tests/unit/preferences-format-order.spec.ts` | Invariants 1, 2, 3, 4, 6. |
| `tests/unit/preferences-defaults.spec.ts` | Invariants 4 (taipowerPrecision side) and 5. |
| `tests/integration/settings-format-priority.spec.ts` | End-to-end: drag → save → reload → invariant 1–3 still hold. |

## Non-goals

- Cross-device sync of `formatOrder` (out of scope; per-installation only).
- Schema-level migration audit / dry-run tooling (the silent-fallback path is the contract).
- Per-format precision overrides beyond `mgrsPrecision` and `taipowerPrecision` (already in v2).
