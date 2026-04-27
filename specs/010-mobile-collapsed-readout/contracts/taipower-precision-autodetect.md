# Contract: Taipower input auto-precision

**Feature**: 010-mobile-collapsed-readout
**Surface**: TypeScript module — Go To Taipower parser (file path verified at implementation time per research.md §R7)
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-014, FR-015 · **Spec SCs**: SC-007

## Public surface (signature change)

The exported parser drops its precision argument:

```ts
// BEFORE (illustrative — feature 002 era):
function parseTaipowerInput(input: string, precision: TaipowerPrecision): ParseResult;

// AFTER (feature 010):
function parseTaipowerInput(input: string): ParseResult;

type ParseResult =
  | { ok: true; value: TaipowerCoordinate }
  | { ok: false; rejection: { kind: 'unsupported-precision'; messageKey: string } }
  | { ok: false; rejection: { kind: 'malformed' | 'out-of-coverage'; messageKey: string } };
```

The exact existing rejection enum names from feature 002 are
preserved — this contract changes only the *signature* of the
parser, not its rejection vocabulary or its locale keys.

## Length-based dispatch

```ts
const SEPARATOR_REGEX = /[\s\-_]/g;       // verified against existing parser at implementation time

export function detectTaipowerPrecision(input: string): 9 | 11 | null {
  const stripped = input.trim().replace(SEPARATOR_REGEX, '');
  if (stripped.length === 9) return 9;
  if (stripped.length === 11) return 11;
  return null;
}
```

The parser's body uses this helper as its first step:

```ts
const precision = detectTaipowerPrecision(input);
if (precision === null) return rejectWith('unsupported-precision');
// …continue with the existing precision-aware parse logic.
```

## Default-precision change

`src/storage/preferences.ts :: defaultPreferences()` ships
`taipowerPrecision: 11` for fresh installs only. The validator
`validatePreferences()` continues to accept any
`TaipowerPrecision` value from stored records; it does NOT silently
mutate stored values.

## Invariants

1. **Pure detect.** `detectTaipowerPrecision` is pure: same input → same output, no DOM, no `localStorage`, no `Date.now()`, no `Math.random()`.
2. **Length parity.** `detectTaipowerPrecision('xxxxxxxxx') === 9` (length 9) and `detectTaipowerPrecision('xxxxxxxxxxx') === 11` (length 11) and `detectTaipowerPrecision('xxxxxxxxxx') === null` (length 10).
3. **Whitespace tolerance.** Leading / trailing whitespace and the documented separator set are stripped before length classification (so `'  X-XX-XX-XX-XX  '` of stripped length 9 → 9).
4. **Rejection routing.** Length anything other than 9 or 11 (after strip) MUST surface the existing localised `'unsupported-precision'` rejection — message text and key both unchanged from feature 002.
5. **No silent mutation of preferences.** Stored `taipowerPrecision: 9` survives an upgrade to v3 unchanged. Only fresh installs get the new default of 11.
6. **Decoupled from preferences.** `parseTaipowerInput` does NOT read `taipowerPrecision` from `loadPreferences()` — input precision is data-driven; output precision (readout) is preference-driven.

## Verification

| Spec | Asserts |
| ---- | ------- |
| `tests/unit/taipower-parse-auto-precision.spec.ts` | Invariants 1, 2, 3, 4 for `detectTaipowerPrecision` and the parser. |
| `tests/unit/preferences-defaults.spec.ts` | Invariant 5 (fresh default = 11; stored 9 preserved). |
| `tests/unit/preferences-format-order.spec.ts` (existing pattern) | Cross-check that the v3 schema shape carries `taipowerPrecision` correctly through round-trip. |

## Non-goals

- Auto-detect on output / readout display (display precision remains preference-driven; research.md §R7 rejects auto-output).
- Backwards-compat shim that re-exports the old precision-arg signature (call sites are internal — the project's "no backwards-compat hacks" rule applies; all callers are updated in lockstep).
- New rejection keys for the length-10 edge case — reuse the existing `'unsupported-precision'` localised rejection.
