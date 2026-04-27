# Contract: `installDismissed` — localStorage parser & writer

**Module**: `src/storage/installDismissed.ts`
**Consumed by**: `src/pwa/installSignal.ts` only.
**Verifies**: spec FR-012, FR-013, FR-014; research D4.

## §1. Public surface

```ts
export const DISMISSAL_WINDOW_MS: number; // = 30 * 24 * 60 * 60 * 1000

export function getDismissedUntil(): number | null;
export function setDismissedUntil(timestampMs: number): void;

export const __INSTALL_DISMISSED_KEY: '__pwa_map_install_dismissed_until' | 'pwa_map:installDismissedUntil';
```

The exact literal of the key is `pwa_map:installDismissedUntil` (no
overrides). The `__INSTALL_DISMISSED_KEY` export exists for tests so
they can reset between runs without re-stringifying the key.

The module MUST export exactly these four symbols. No default export.
No additional helpers. Internal state MUST NOT be exposed.

## §2. Reader semantics — `getDismissedUntil()`

| Stored value (raw)                         | Returns          | Reason                                       |
| ------------------------------------------ | ---------------- | -------------------------------------------- |
| (key absent)                               | `null`           | Never dismissed (FR-014).                    |
| `'1796428800000'` (positive int, future)   | `1796428800000`  | Active dismissal (FR-013).                   |
| `'1700000000000'` (positive int, past)     | `null`           | Expired window — re-arm without rewriting.   |
| `'8.64e15'` (scientific notation, valid)   | `null`           | Reject: not a plain integer string.          |
| `'true'`, `'{"foo":1}'`, `''`              | `null`           | Corruption-tolerant; treat as absent.        |
| `'NaN'`, `'Infinity'`, `'-Infinity'`       | `null`           | Reject non-finite.                           |
| `'-1'`, `'0'`                              | `null`           | Reject non-positive.                         |
| `'1796428800000.5'` (fractional)           | `null`           | Reject: not an integer.                      |
| `'  1796428800000  '` (whitespace)         | `null`           | Reject: strict parse, no trim.               |
| `'1796428800000\n'`                        | `null`           | Reject: trailing newline.                    |
| (localStorage throws on access)            | `null`           | Private mode / SSR — graceful fallback.     |

The reader MUST NOT mutate localStorage in any of the rejection
branches — corrupt entries are tolerated, not cleaned up. Cleanup
happens implicitly the next time the writer runs (or via site-data
clear).

Implementation sketch:

```ts
const KEY = 'pwa_map:installDismissedUntil';
export const __INSTALL_DISMISSED_KEY = KEY;
export const DISMISSAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getDismissedUntil(): number | null {
  const s = safeStorage();
  if (!s) return null;
  let raw: string | null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  // Strict integer parse (no trim, no scientific, no fraction).
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n <= 0) return null;
  if (n <= Date.now()) return null;
  return n;
}
```

## §3. Writer semantics — `setDismissedUntil(timestampMs)`

| Input                                    | Effect                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Date.now() + DISMISSAL_WINDOW_MS`       | Writes `String(timestampMs)` to localStorage under the key.                                     |
| `NaN`, `Infinity`, `-Infinity`           | No-op (silently ignore — defence-in-depth; should not occur in production).                     |
| Non-positive integer                     | No-op.                                                                                          |
| Non-integer (`1.5`, `1e10` as JS number) | Coerces via `Math.floor(timestampMs)` THEN re-validates as positive integer. If invalid, no-op. |
| localStorage throws on write             | Swallows the error silently (quota / privacy mode).                                             |

Implementation sketch:

```ts
export function setDismissedUntil(timestampMs: number): void {
  if (!Number.isFinite(timestampMs)) return;
  const n = Math.floor(timestampMs);
  if (!Number.isSafeInteger(n) || n <= 0) return;
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(KEY, String(n));
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}
```

## §4. Required tests

`tests/unit/storage/installDismissed.spec.ts` MUST cover:

1. **Absent key** → `getDismissedUntil()` returns `null`.
2. **Future timestamp** → `setDismissedUntil(future)` then
   `getDismissedUntil()` returns `future`.
3. **Past timestamp** → write directly to localStorage with a past
   epoch ms; assert reader returns `null`. Assert localStorage value
   is **unchanged** (the reader must not clean up).
4. **Round-trip integrity** — write `n`, read `n` exact equality.
5. **Corruption: arbitrary strings** — for each of `'true'`,
   `'{"x":1}'`, `''`, `'NaN'`, `'Infinity'`, `'-Infinity'`,
   `'1.5'`, `'8.64e15'`, `' 1796428800000 '`, `'1796428800000\n'`:
   write directly, assert reader returns `null`.
6. **Negative / zero** — for `-1`, `0`: assert reader returns
   `null`.
7. **Writer rejection** — call `setDismissedUntil(NaN)`,
   `setDismissedUntil(Infinity)`, `setDismissedUntil(-1)`,
   `setDismissedUntil(0)`; assert localStorage was not written.
8. **Writer + reader fractional** — `setDismissedUntil(future +
   0.5)` → reader returns `Math.floor(future + 0.5)` (writer
   coerces).
9. **localStorage throws on read** — `vi.spyOn(localStorage,
   'getItem').mockImplementation(() => { throw new Error('quota'); })`;
   assert reader returns `null`, no rethrow.
10. **localStorage throws on write** — same spy on `setItem`; assert
    writer does not rethrow; subsequent read returns `null`.
11. **Window magic constant** — assert
    `DISMISSAL_WINDOW_MS === 30 * 24 * 60 * 60 * 1000`.
12. **Key constant** — assert `__INSTALL_DISMISSED_KEY ===
    'pwa_map:installDismissedUntil'`.

The spec MUST run with `localStorage.clear()` in `beforeEach`.

## §5. Schema stability commitment

The persisted shape is "a string-ified positive integer epoch
milliseconds, OR absent". This contract MUST NOT change without a
new feature spec that supersedes feature 005. ADR 0021 (additive
prefs evolution) is unaffected because this key is separate from
`pwa_map:prefs`.

If a future feature needs richer dismissal data (e.g., per-surface
windows), it MUST introduce a new key with a JSON shape; the
existing `pwa_map:installDismissedUntil` contract MUST continue to
read as defined here.
