# ADR 0021 — `pwa_map:prefs` additive schema evolution

**Status**: Accepted (landed 2026-04-26)
**Date**: 2026-04-25
**Feature**: `003-i18n-and-map-layers`

## Context

Feature 003 needs to persist two new pieces of operator state — the
selected basemap id and the overlay-on flag — into the existing
`pwa_map:prefs` localStorage blob. The prefs schema in feature 001
ships at `version: 1` and feature 002 added no schema changes; any
breaking version bump would invalidate every user's stored prefs
(format-toggle visibility, MGRS / Taipower precision, locale).

## Decision

Add `mapLayer?: BasemapId` and `overlay?: boolean` as **optional**
fields without bumping `version` from 1. The validator
(`validatePreferences`) accepts blobs missing both fields (returns
the blob; consumers apply defaults from `defaultPreferences()`) and
rejects blobs whose `mapLayer` is not in the allowed enum or whose
`overlay` is not boolean (existing fall-back-to-defaults pattern
applies). The `defaultPreferences()` helper now sets
`mapLayer: 'osm-standard'`, `overlay: false` so on-disk blobs from
feature 003 onwards always include both fields.

## Consequences

- Pre-003 users keep their feature 001 / 002 settings on upgrade.
- Forward-compat: future schema changes that require breaking
  changes MUST bump `version` to 2 and migrate.
- Validation surface gains a small enum-membership check; the
  existing reject-and-fall-back pattern handles malformed values.

## Alternatives considered

- **Bump `version` to 2 and migrate** — rejected: invalidates every
  user's stored prefs for a purely additive change.
- **Store under a new key** (`pwa_map:mapLayer_v1`) — rejected:
  fragments persistence across multiple keys for state that is
  conceptually one preferences blob.
- **Only persist `mapLayer`; derive `overlay` from a separate
  state** — rejected: the overlay choice is a primary operator
  decision that must survive reload.

## Implementation outcome

Landed in `src/storage/preferences.ts`: `validatePreferences`
accepts `mapLayer?: BasemapId` and `overlay?: boolean` and rejects on
out-of-enum / non-boolean per the contract. `defaultPreferences()`
sets `mapLayer: 'osm-standard'`, `overlay: false`. Six unit tests in
`tests/unit/storage/preferences.spec.ts` cover the pre-003 blob
load, round-trip, invalid id rejection (including overlay-id
rejection), non-boolean overlay rejection, and the default helper.
Pre-003 users keep their feature 001 / 002 prefs on upgrade.

## References

- Research: `specs/003-i18n-and-map-layers/research.md` §D4
- Contract: `specs/003-i18n-and-map-layers/contracts/preferences-v1.md`
- Sister pattern: `src/storage/preferences.ts` (feature 001)
