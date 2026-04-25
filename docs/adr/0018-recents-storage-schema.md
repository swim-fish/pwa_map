# ADR 0018 — Recents storage schema

**Status**: Accepted (landed 2026-04-25)
**Date**: 2026-04-25
**Feature**: `002-goto-split-input`

## Context

Feature 002 adds a recent-Go-To list (max 10 entries, dedup by
`(format, raw)`, FIFO-evicted, MRU-ordered) that persists across
reloads. The existing `src/storage/preferences.ts` already implements
the pattern of localStorage + JSON-in-try/catch + structural validation

- silent-fallback-on-error. We need the same robustness for recents
  without coupling to the prefs schema.

## Decision

Use a separate localStorage key `pwa_map:gotoHistory_v1` with the
schema:

```ts
interface PersistedEntry {
  format: { kind: 'auto' } | { kind: 'fixed'; value: CoordinateKind };
  raw: string;
  createdAt: number;
}

interface PersistedList {
  version: 1;
  entries: PersistedEntry[]; // ≤ 10, MRU-first
}
```

`loadRecents` returns `{ version: 1, entries: [] }` on any parse,
shape, or version error. `addRecent(list, format, raw)` dedups,
prepends, trims to 10. `removeRecent` filters by `(format, raw)`.
`saveRecents` swallows quota / privacy-mode errors.

The `_v1` suffix encodes the schema version in the key so a future
schema change happens via key rename, not in-place migration.

## Consequences

- One new localStorage key, ~1 KB max footprint.
- No coupling between `pwa_map:prefs` and recents schemas.
- Pure functional API (`add`, `remove` return new lists) keeps tests
  trivial.
- Corrupt data on disk silently resets the list (FR-014 + SC-005).

## Alternatives considered

- **IndexedDB** — rejected: 10-entry list, sync API in localStorage is
  enough.
- **Nest under `pwa_map:prefs`** — rejected: forces a prefs schema bump
  on every recents change; couples two storage concerns under one
  validator.

## Implementation outcome

Landed in `src/storage/recents.ts`. `loadRecents` returns
`{ version: 1, entries: [] }` on every error path; `addRecent` /
`removeRecent` are pure; `saveRecents` swallows quota errors. The
`RecentChips.svelte` component renders the list MRU-first and detects
500 ms long-press via pointer events with a 6 px tolerance, matching
research D10. Long-press opens the `goto-recent-delete-confirm` modal
inside the dialog.

## References

- Research: `specs/002-goto-split-input/research.md` §D3
- Contract: `specs/002-goto-split-input/contracts/recents-storage.md`
- Sister pattern: `src/storage/preferences.ts`
