# ADR 0008 — Preference storage: localStorage with schema guard

**Status**: Accepted
**Date**: 2026-04-24

## Context

Two scalar states to persist across sessions: visible formats and the
last map view (center + zoom). Both need synchronous reads at boot
before the UI renders.

## Decision

- **`localStorage`** via `src/storage/preferences.ts`.
- Two keys: `pwa_map:prefs` (FormatPreferences v1) and `pwa_map:lastView`
  (MapViewState).
- Schema-guard validator discards any corrupt / version-mismatched blob
  and returns defaults.
- Locale is seeded from `navigator.language` on first boot
  (`zh-*` → `zh`, `ja-*` → `ja`, else `en`).

## Consequences

- Synchronous boot path — no async storage wiring in the UI tree.
- Defaults are always safe; corrupt storage never crashes the app.

## Alternatives considered

- **IndexedDB (via idb-keyval)** — async overhead for two scalars;
  overkill.
- **Cookies** — 4 KB cap and sent with every request; inappropriate.
