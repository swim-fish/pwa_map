# Contract: Recent-Inputs Storage

**Feature**: `002-goto-split-input`
**Surface**: `src/storage/recents.ts`
**Consumers**: `GoToDialog.svelte`, `RecentChips.svelte`, integration tests.

This contract defines the persistent recent-Go-To list described by
US2 + FR-007 / FR-008 / FR-014 / SC-005.

---

## 1. Storage location

- `localStorage` key: `pwa_map:gotoHistory_v1`
- Key is independent of `pwa_map:prefs` (research D3).
- The bumpable `_v1` suffix encodes the schema version so a future
  schema change happens via key rename rather than in-place migration.

---

## 2. Schema

```ts
import type { FormatSelection } from '$types/goto';

interface PersistedEntry {
  format: FormatSelection;
  raw: string;
  createdAt: number; // epoch millis
}

interface PersistedList {
  version: 1;
  entries: PersistedEntry[];
}
```

### Validation rules (load path)

A persisted blob is **valid** iff:

1. JSON parses successfully.
2. Top-level is an object with `version === 1`.
3. `entries` is an array.
4. Each entry has:
   - `format.kind === 'auto'` OR
     (`format.kind === 'fixed'` AND
      `format.value` is one of the seven `CoordinateKind` strings).
   - `raw` is a non-empty string of length ≤ 256.
   - `createdAt` is a finite number ≥ 0.
5. `entries.length` ≤ 10. (If a future bug ever produces > 10, load
   silently truncates to the most-recent 10.)

**Any failure → return an empty `RecentList` (not null, not partial)**
per FR-014 and SC-005.

---

## 3. Public API

```ts
// src/storage/recents.ts
import type { FormatSelection, RecentEntry, RecentList } from '$types/goto';

export const RECENTS_KEY = 'pwa_map:gotoHistory_v1' as const;
export const MAX_RECENTS = 10 as const;

export function loadRecents(): RecentList;
export function saveRecents(list: RecentList): void;
export function addRecent(
  list: RecentList,
  format: FormatSelection,
  raw: string,
  now?: number, // injected for tests; defaults to Date.now()
): RecentList;
export function removeRecent(
  list: RecentList,
  format: FormatSelection,
  raw: string,
): RecentList;
```

All four are pure (`add` / `remove` return a new list) except
`saveRecents` which performs I/O. `loadRecents` performs I/O once and
falls back to `{ version: 1, entries: [] }` on any error.

`addRecent`'s rules:

1. If an existing entry has the same `(format, raw)`: remove it.
2. Prepend the new entry with `{ format, raw, createdAt: now }`.
3. If `entries.length > MAX_RECENTS`: drop tail entries until length is
   `MAX_RECENTS`.

`removeRecent` filters out the matching `(format, raw)` if it exists;
no-op otherwise. Identity comparison for `format` is structural —
`{ kind: 'auto' }` vs `{ kind: 'fixed', value: 'wgs84-dd' }` are
distinct keys.

---

## 4. Schema-guard behaviour

```ts
// load returns valid list, or empty list on any error
loadRecents(); // always returns { version: 1, entries: [] | RecentEntry[] }

// save silently swallows quota / privacy-mode errors (matches preferences.ts)
saveRecents({ version: 1, entries: [...] });
```

The implementation reuses the patterns from `src/storage/preferences.ts`
(safeStorage helper, JSON parse in try/catch, structural validation).

---

## 5. Test obligations

`tests/unit/storage/recents.spec.ts` MUST cover:

1. **Empty load** — no key set → returns `{ version: 1, entries: [] }`.
2. **Round-trip** — `saveRecents` then `loadRecents` returns the same
   list (entries-equal up to JSON serialisation).
3. **Version mismatch** — write `{ version: 2, entries: [] }` directly
   to localStorage → `loadRecents` returns empty.
4. **Corrupt JSON** — write `not-json` → `loadRecents` returns empty
   (no throw).
5. **Bad entry shape** — entry missing `raw` → entire list discarded.
6. **`addRecent` happy path** — adding to empty → `entries.length === 1`.
7. **`addRecent` LRU** — adding the same `(format, raw)` again moves
   it to head; length unchanged.
8. **`addRecent` FIFO eviction** — adding to a full 10-entry list →
   length stays 10; oldest entry dropped.
9. **`addRecent` distinct identity** — same `raw` with two different
   `format` values produces two entries (count = 2).
10. **`removeRecent`** — exact match removes one entry; no match is a
    no-op.
11. **Persistence size** — saving a full list keeps localStorage
    usage under 2 KB (sanity check against the spec's 1 KB estimate).

`tests/integration/go-to-split.spec.ts` MUST cover the
"persisted across reloads" scenario by simulating a localStorage value
on mount and asserting the recents row renders correctly.

---

## 6. Privacy / clearing

- The user has no in-app "clear recents" affordance in this feature
  (long-press deletes one entry at a time per FR-008). A future
  feature can layer one on top by calling `saveRecents({ version: 1,
  entries: [] })`.
- `localStorage` clears observe the same lifecycle as the other keys;
  this contract introduces no new clearing semantics.
