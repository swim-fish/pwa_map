# Contract: `threeDLockdown` — single-source-of-truth registry for MapLibre 3D / Terrain capabilities

**Feature**: 012-settings-about-and-mobile-fixes
**Module**: `src/map/threeDLockdown.ts` (NEW)
**Consumed by**: `src/components/MapView.svelte`, `src/map/styleBuilder.ts`, `src/map/sources.ts` (JSDoc only)
**Spec FRs**: FR-001, FR-001a, FR-001b, FR-002, FR-004, FR-005, FR-008, FR-009
**Related ADRs**: ADR-0002 (map engine MapLibre), ADR-0020 (map source catalogue), ADR-0032 (NEW — three-d-lockdown register, this feature)

## §1. Public surface

```ts
export type LockdownClass =
  | 'pitch'
  | 'sky'
  | 'globe'
  | 'terrain'
  | 'fillExtrusion'
  | 'hillshade';

export interface LockdownEntry<TLocked> {
  readonly class: LockdownClass;
  readonly lockedValue: TLocked;
  readonly reEnableHint: string;
}

export interface LockdownRegister {
  readonly pitch: LockdownEntry<0>;
  readonly sky: LockdownEntry<false>;
  readonly globe: LockdownEntry<'mercator'>;
  readonly terrain: LockdownEntry<null>;
  readonly fillExtrusion: LockdownEntry<false>;
  readonly hillshade: LockdownEntry<false>;
}

export const LOCKDOWN_REGISTER: LockdownRegister;
```

The module exports exactly these symbols. It exports no functions
(consumers do their own composition), no factory, no DI plumbing, no
classes. The intent is "data only, frozen at import time".

## §2. Required values (locked baseline)

| Class | `lockedValue` | TS literal type |
|-------|---------------|-----------------|
| `pitch` | `0` | `0` |
| `sky` | `false` | `false` |
| `globe` | `'mercator'` | `'mercator'` |
| `terrain` | `null` | `null` |
| `fillExtrusion` | `false` | `false` |
| `hillshade` | `false` | `false` |

The TypeScript literal types are deliberately narrow so that a future
edit that flips a value to a non-locked value (e.g.,
`pitch.lockedValue = 60` to re-enable pitch) MUST broaden the literal
type explicitly — the compile error surfaces the change at build time.

## §3. Invariants

### I1 — Frozen at module load

`LOCKDOWN_REGISTER` is `Object.freeze`d at module-evaluation time.
Each `LockdownEntry` value inside the register is also frozen.
Mutation attempts in strict mode (the project default) silently fail
or throw, depending on engine.

```ts
// MUST hold:
expect(Object.isFrozen(LOCKDOWN_REGISTER)).toBe(true);
expect(Object.isFrozen(LOCKDOWN_REGISTER.pitch)).toBe(true);
// ... and so on for the other five entries.
```

### I2 — Closed key set

The set of keys on `LOCKDOWN_REGISTER` is exactly six. Adding a new
key requires (a) extending `LockdownClass`, (b) extending
`LockdownRegister`, (c) adding the entry to `LOCKDOWN_REGISTER`,
(d) adding a new consumer rule somewhere in the codebase, and
(e) adding a runtime assertion in the test suite.

```ts
// MUST hold:
expect(Object.keys(LOCKDOWN_REGISTER).sort()).toEqual([
  'fillExtrusion',
  'globe',
  'hillshade',
  'pitch',
  'sky',
  'terrain',
]);
```

### I3 — Re-enable hint completeness

Each `LockdownEntry.reEnableHint` is a non-empty string that
identifies (i) the call site(s) that read the entry, and (ii) the
operator instruction for re-enabling that class. The hint MUST be
≤ 140 characters (so it fits on a single screen line in JSDoc).

```ts
// MUST hold for every entry:
expect(entry.reEnableHint).toMatch(/\S/);
expect(entry.reEnableHint.length).toBeLessThanOrEqual(140);
```

The text content of each hint is reviewed in code review — the
contract enforces shape, not specific phrasing.

### I4 — No runtime escape hatch

The module MUST NOT read from any environment-derived source
(no `process.env`, no `import.meta.env`, no
`window.location.search`, no `localStorage`). The register is a
pure compile-time literal. Per FR-001b: "Re-enabling 3D is always
a deliberate code change."

Static check: a unit test reads the module source as text and
greps for forbidden substrings (`process.env`, `import.meta.env`,
`localStorage`, `URLSearchParams`, `window.location`). All MUST be
absent.

### I5 — No side effects at import

Importing `threeDLockdown.ts` MUST NOT register any global, attach
any event listener, or perform any I/O. The module body is a single
`Object.freeze({ ... })` expression assigned to the `const` export.

## §4. Consumer rules

### `MapView.svelte`

MUST `import { LOCKDOWN_REGISTER } from '$map/threeDLockdown'`. MUST
read `LOCKDOWN_REGISTER.pitch.lockedValue` to set the `maxPitch`
option on `new maplibregl.Map({...})`. MUST read
`LOCKDOWN_REGISTER.globe.lockedValue` to set the `projection`
option. MUST set `touchPitch: false` unconditionally alongside
(belt-and-braces against pitch ceiling bypass). MUST NOT call
`map.setTerrain(...)` anywhere in its lifecycle, before or after
style swaps.

```ts
import { LOCKDOWN_REGISTER } from '$map/threeDLockdown';

map = new maplibregl.Map({
  container,
  style: styleFor(layer),
  center: [initialCenter.lon, initialCenter.lat],
  zoom: initialZoom,
  attributionControl: false,
  hash: false,
  // 3D / Terrain lockdown — see threeDLockdown.ts and ADR-0032.
  maxPitch: LOCKDOWN_REGISTER.pitch.lockedValue,
  touchPitch: false,
  projection: LOCKDOWN_REGISTER.globe.lockedValue,
});
```

### `styleBuilder.ts`

MUST `import { LOCKDOWN_REGISTER } from '$map/threeDLockdown'`. MUST
post-process `buildStyle`'s return value: (a) `delete` the assembled
`style.sky` key if `LOCKDOWN_REGISTER.sky.lockedValue === false`;
(b) filter `style.layers` to drop entries whose `type` is
`'fill-extrusion'` when `LOCKDOWN_REGISTER.fillExtrusion.lockedValue ===
false`, and `'hillshade'` when
`LOCKDOWN_REGISTER.hillshade.lockedValue === false`. The filter MUST
preserve the relative order of the remaining layers.

```ts
import { LOCKDOWN_REGISTER } from '$map/threeDLockdown';

export function buildStyle(...): StyleSpecification {
  // ... existing assembly ...
  const style: StyleSpecification = { version: 8, sources, layers };
  applyLockdown(style);
  return style;
}

function applyLockdown(style: StyleSpecification): void {
  if (!LOCKDOWN_REGISTER.sky.lockedValue) {
    delete (style as { sky?: unknown }).sky;
  }
  const blocked = new Set<string>();
  if (!LOCKDOWN_REGISTER.fillExtrusion.lockedValue) blocked.add('fill-extrusion');
  if (!LOCKDOWN_REGISTER.hillshade.lockedValue) blocked.add('hillshade');
  if (blocked.size > 0) {
    style.layers = style.layers.filter((l) => !blocked.has(l.type));
  }
}
```

### `src/map/sources.ts`

MUST add a JSDoc note at the top of the file referencing
`threeDLockdown.ts` and explicitly forbidding the registration of a
terrain RGB DEM source while the lockdown register pins
`terrain.lockedValue` to `null`. The JSDoc MUST cite ADR-0032. No
runtime import is needed — this is a *documentation* anchor for
future contributors.

## §5. Test contract

### T1 — Module shape

`tests/unit/three-d-lockdown.spec.ts`:

- `import { LOCKDOWN_REGISTER, type LockdownRegister } from '$map/threeDLockdown';`
- Asserts I1 (frozen).
- Asserts I2 (exactly six keys).
- Asserts each entry's `lockedValue` matches the spec table in §2.
- Asserts I3 (re-enable hint shape).
- Asserts I4 (no escape-hatch substrings in module source — load
  the file via `fs.readFileSync` in the test).
- Asserts I5 by importing the module twice (once via dynamic
  import) and confirming no globals were attached.

### T2 — Runtime consumption

`tests/integration/three-d-lockdown-runtime.spec.ts`:

- Mounts `MapView.svelte` in a jsdom canvas.
- Asserts `map.getMaxPitch()` (or equivalent) === `0` after
  construction.
- Asserts `map.getProjection().name` === `'mercator'` after
  construction.
- Asserts `map.getTerrain()` === `null` immediately after
  construction.
- Calls `map.setPitch(45)` and asserts `map.getPitch()` === `0`
  afterwards.
- Calls `map.setTerrain({ source: 'fake', exaggeration: 1 })`
  inside a try/catch — assertion is that
  `map.getTerrain()` remains `null` (whether MapLibre throws or
  no-ops, the lockdown is preserved).
- Swaps basemap (changes the `layer` prop), waits for the style
  rebuild, and re-asserts every check above.

### T3 — Style filter

`tests/integration/three-d-lockdown-runtime.spec.ts` (same file):

- Calls `buildStyle` directly with a synthetic basemap definition
  that injects a `'fill-extrusion'` layer and a top-level `sky` key
  via spread, then asserts the assembled style has no
  `'fill-extrusion'` layer and no `sky` key.
- Repeats with a `'hillshade'` layer.

## §6. Failure modes

| Scenario | Behaviour |
|----------|-----------|
| Consumer hard-codes `maxPitch: 0` instead of reading from the register | Allowed by TypeScript (the literal types match), but caught by a code-review checkpoint. The contract recommends ESLint's `no-magic-numbers` (already enabled) flagging the `0` if it is not a register reference. |
| `buildStyle` is bypassed (someone calls `map.setStyle(rawStyle)` with a hand-built style) | Out of scope for the lockdown register; the contract only governs `buildStyle`'s output. The integration test in T2 swaps basemaps via the supported props path; out-of-band style injection is treated as a test-bench concern. |
| Future MapLibre version removes `maxPitch` or `touchPitch` | The contract fails at compile time (the option no longer exists on the construction options type). The fix is to update the construction call alongside the upgrade, and the registry's `pitch.lockedValue` literal still describes intent. |
| Future MapLibre version flips default `projection` to `'globe'` | The explicit `projection: LOCKDOWN_REGISTER.globe.lockedValue` literal `'mercator'` defends against this. Test T2 also asserts the projection independently. |
| Module is dual-imported (e.g., once from `$map/threeDLockdown` and once via a relative path) | Vite + TypeScript resolve to the same module instance; freeze invariants are preserved across both import paths. T1 imports via the alias (the canonical form). |
