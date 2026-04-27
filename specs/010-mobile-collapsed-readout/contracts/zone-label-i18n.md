# Contract: TWD zone label i18n composition

**Feature**: 010-mobile-collapsed-readout
**Surface**: i18n catalogues `src/i18n/{zh,en,ja}.json` + Svelte components `src/components/goto/{Tm2Layout,Twd67Layout}.svelte`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-013, FR-016, FR-017 · **Spec SCs**: SC-008

## New locale keys

Two keys per locale, six new strings total. These are the **only**
new i18n keys this feature introduces.

| Key                              | `zh`     | `en`           | `ja`        |
| -------------------------------- | -------- | -------------- | ----------- |
| `goto.fields.zoneTagMainIsland`  | `本島`   | `Main Island`  | `本島`      |
| `goto.fields.zoneTagPenghu`      | `澎湖`   | `Penghu`       | `澎湖列島`  |

(Final translated values are subject to translator review during
implementation; these are the seed values.)

## Composition rule

The visible label of each non-`auto` zone option is composed at
render time from the existing zone-number key and the new tag key.
Two acceptable composition forms:

- **`zh` / `ja`** — digits then tag, single space separator:
  `${tStore('goto.fields.zone121')} ${tStore('goto.fields.zoneTagMainIsland')}`
  → `121 本島`
- **`en`** — digits then parenthesised tag:
  `${tStore('goto.fields.zone121')} (${tStore('goto.fields.zoneTagMainIsland')})`
  → `121 (Main Island)`

The component MUST NOT branch on locale name — the composition lives
in the locale string itself if a parenthesised form is required for
some locales. If implementation finds an existing interpolatable
composition key (e.g. `goto.fields.zoneOption` from feature 002 with
`{zone}` and `{tag}` placeholders), the component SHOULD reuse it
instead of inlining the join. Otherwise the simplest path is a
single `tStore(...)` call followed by string concatenation per
locale convention; the unit test fixes the exact rendered output
per locale.

## Invariants

1. **Auto unchanged.** `goto.fields.zoneAuto` (feature 002) is **NOT** modified; the `auto` zone option's label is unchanged in every locale.
2. **Mapping fixed.** `zone121` MUST always pair with `zoneTagMainIsland`; `zone119` MUST always pair with `zoneTagPenghu`. These pairings are not user-configurable.
3. **Three locales, no untranslated fallback visible.** Every locale (`zh`, `en`, `ja`) carries the two new keys; missing-key fallback (English-as-fallback in `tStore`) MUST NOT surface in the rendered UI in any of the three supported locales.
4. **TM2 + TWD67 parity.** Both `Tm2Layout` and `Twd67Layout` apply the same composition rule (FR-016 vs FR-017).
5. **No new keys beyond these two.** The total new-key count for feature 010 is exactly 2 (× 3 locales = 6 strings). Anything more is a Plan §"Complexity Tracking" deviation.

## Verification

| Spec | Asserts |
| ---- | ------- |
| `tests/unit/zone-label.spec.ts` | Invariants 1, 2, 3, 4 across `zh`, `en`, `ja` for both layouts; rendered text snapshots per locale. |
| `tests/unit/locale-catalogue-shape.spec.ts` *(extends existing if present)* | Invariant 5 — the catalogue diff vs master baseline contains exactly the two new keys per locale. |

## Non-goals

- Tag for the `auto` option (it has its own existing label).
- Tag for any non-Taiwan TWD zone (none exist in the project's coverage).
- Localising the *zone digits* themselves (still rendered as ASCII `121` / `119` regardless of locale).
- Changing the auto-zone resolution algorithm (feature 002) in any way — labels only.
